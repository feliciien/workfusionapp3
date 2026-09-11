/**
 * Risk Engine - Real-Time Risk Monitoring
 * 
 * Tracks equity, balance, floating P/L, realized P/L, daily P/L, drawdown,
 * exposure, position size, margin, leverage, correlated exposure, concentration,
 * trading frequency, and abnormal behavior.
 * 
 * Must be capable of triggering: NORMAL -> WARNING -> AT_RISK -> BREACHED
 * Risk calculations must be deterministic and fully auditable.
 */

import {
  ChallengeAccount,
  FundedAccount,
  TradingEvent,
  OpenPosition,
  RiskState,
  RiskStateTransition,
  RuleViolation,
  ChallengeAccountStatus,
  FundedAccountStatus
} from "./types";
import { getRuleEngine, RuleEngine, RuleEvaluationContext } from "./rule-engine";

// ============================================================================
// RISK METRICS
// ============================================================================

export interface RiskMetrics {
  // Core Financial
  balance: number;
  equity: number;
  floatingPL: number;
  dailyRealizedPL: number;
  totalRealizedPL: number;
  
  // Drawdown
  dailyDrawdownPct: number;
  totalDrawdownPct: number;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  highestEquity: number;
  highestBalance: number;
  
  // Margin
  usedMargin: number;
  freeMargin: number;
  marginLevel: number;           // equity / usedMargin * 100
  
  // Exposure & Leverage
  totalExposure: number;
  maxExposureReached: number;
  currentLeverage: number;
  maxLeverageReached: number;
  
  // Positions
  openPositionCount: number;
  totalVolume: number;
  longVolume: number;
  shortVolume: number;
  
  // Trading Activity
  tradesToday: number;
  totalTrades: number;
  tradingDaysCount: number;
  
  // Correlated Exposure (simplified)
  correlatedExposurePct: number;
  
  // Concentration
  largestPositionPct: number;
  largestPositionSymbol?: string;
  
  // Timestamps
  calculatedAt: string;
}

export interface RiskSnapshot {
  accountId: string;
  accountType: "CHALLENGE" | "FUNDED";
  traderId: string;
  riskState: RiskState;
  riskMetrics: RiskMetrics;
  ruleViolations: RuleViolation[];
  stateTransitions: RiskStateTransition[];
  timestamp: string;
}

// ============================================================================
// RISK ENGINE CLASS
// ============================================================================

export class RiskEngine {
  private ruleEngine: RuleEngine;
  private snapshots: Map<string, RiskSnapshot[]> = new Map();
  private maxSnapshotsPerAccount: number = 10000;
  
  constructor(ruleEngine?: RuleEngine) {
    this.ruleEngine = ruleEngine || getRuleEngine();
  }
  
  /**
   * Process a trading event and update risk metrics
   */
  processEvent(
    event: TradingEvent,
    account: ChallengeAccount | FundedAccount,
    challengeConfig: any
  ): RiskSnapshot {
    // Update account state from event
    this.updateAccountFromEvent(account, event);
    
    // Calculate current risk metrics
    const riskMetrics = this.calculateRiskMetrics(account, challengeConfig);
    
    // Evaluate all rules
    const ruleContext = this.buildRuleContext(account, challengeConfig, riskMetrics);
    const ruleResults = this.ruleEngine.evaluateAllRules(ruleContext);
    
    // Generate violations
    const violations = this.ruleEngine.generateViolations(
      ruleResults,
      account.id,
      account.traderId
    );
    
    // Determine risk state
    const riskState = this.ruleEngine.determineRiskState(ruleResults);
    
    // Determine account status
    const isChallenge = "challengeConfigId" in account;
    const accountStatus = this.ruleEngine.determineAccountStatus(
      riskState,
      ruleResults,
      isChallenge
    );
    
    // Check for state transition
    const previousState = this.getPreviousRiskState(account.id);
    const transitions: RiskStateTransition[] = [];
    if (previousState && previousState !== riskState) {
      transitions.push({
        fromState: previousState,
        toState: riskState,
        triggeredBy: violations.length > 0 ? violations[0].ruleId : "MANUAL",
        reason: violations.length > 0 
          ? violations.map(v => v.message).join("; ")
          : "Manual state change",
        timestamp: new Date().toISOString(),
        metadata: { violations: violations.map(v => v.id) }
      });
    }
    
    // Update account status
    account.currentStatus = accountStatus;
    account.statusChangedAt = new Date().toISOString();
    account.ruleViolations = [...account.ruleViolations, ...violations];
    
    // Create snapshot
    const snapshot: RiskSnapshot = {
      accountId: account.id,
      accountType: isChallenge ? "CHALLENGE" : "FUNDED",
      traderId: account.traderId,
      riskState,
      riskMetrics,
      ruleViolations: violations,
      stateTransitions: transitions,
      timestamp: new Date().toISOString()
    };
    
    // Store snapshot
    this.storeSnapshot(account.id, snapshot);
    
    return snapshot;
  }
  
  /**
   * Calculate risk metrics for an account
   */
  calculateRiskMetrics(account: ChallengeAccount | FundedAccount, config: any): RiskMetrics {
    const isChallenge = "challengeConfigId" in account;
    const initialBalance = isChallenge ? account.initialBalance : account.allocatedCapital;
    const currentEquity = account.currentEquity;
    const currentBalance = account.currentBalance;
    const floatingPL = account.floatingPL;
    const dailyRealizedPL = account.dailyRealizedPL;
    const totalRealizedPL = account.totalRealizedPL;
    const highestEquity = account.highestEquity;
    const highestBalance = account.highestBalance;
    
    // Daily drawdown
    const dailyDrawdownPct = initialBalance > 0 
      ? (Math.abs(Math.min(0, dailyRealizedPL)) / initialBalance) * 100 
      : 0;
    
    // Total drawdown (from highest equity)
    const totalDrawdownPct = highestEquity > 0
      ? ((highestEquity - currentEquity) / highestEquity) * 100
      : 0;
    
    // Margin calculations (simplified)
    const usedMargin = account.openPositions.reduce((sum, pos) => {
      // Simplified margin calculation
      return sum + (pos.volume * pos.openPrice * 0.033); // ~30:1 leverage
    }, 0);
    
    const freeMargin = currentEquity - usedMargin;
    const marginLevel = usedMargin > 0 ? (currentEquity / usedMargin) * 100 : 0;
    
    // Exposure
    const totalExposure = account.totalExposure;
    const maxExposureReached = account.maxExposureReached;
    const currentLeverage = currentEquity > 0 ? totalExposure / currentEquity : 0;
    const maxLeverageReached = account.maxExposureReached > 0 && currentEquity > 0
      ? account.maxExposureReached / currentEquity 
      : 0;
    
    // Position analysis
    const openPositionCount = account.openPositions.length;
    const totalVolume = account.openPositions.reduce((sum, pos) => sum + pos.volume, 0);
    const longVolume = account.openPositions
      .filter(p => p.type === "BUY")
      .reduce((sum, pos) => sum + pos.volume, 0);
    const shortVolume = account.openPositions
      .filter(p => p.type === "SELL")
      .reduce((sum, pos) => sum + pos.volume, 0);
    
    // Largest position
    let largestPositionPct = 0;
    let largestPositionSymbol: string | undefined;
    for (const pos of account.openPositions) {
      const positionValue = pos.volume * pos.currentPrice;
      const positionPct = currentEquity > 0 ? (positionValue / currentEquity) * 100 : 0;
      if (positionPct > largestPositionPct) {
        largestPositionPct = positionPct;
        largestPositionSymbol = pos.symbol;
      }
    }
    
    // Correlated exposure (simplified - same currency pairs)
    const correlatedExposurePct = this.calculateCorrelatedExposure(account, currentEquity);
    
    return {
      balance: currentBalance,
      equity: currentEquity,
      floatingPL,
      dailyRealizedPL,
      totalRealizedPL,
      dailyDrawdownPct,
      totalDrawdownPct,
      maxDailyDrawdownPct: account.maxDailyDrawdownPct,
      maxTotalDrawdownPct: account.maxTotalDrawdownPct,
      highestEquity,
      highestBalance,
      usedMargin,
      freeMargin,
      marginLevel,
      totalExposure,
      maxExposureReached,
      currentLeverage,
      maxLeverageReached,
      openPositionCount,
      totalVolume,
      longVolume,
      shortVolume,
      tradesToday: account.tradesToday,
      totalTrades: account.totalTrades,
      tradingDaysCount: account.tradingDaysCount,
      correlatedExposurePct,
      largestPositionPct,
      largestPositionSymbol,
      calculatedAt: new Date().toISOString()
    };
  }
  
  /**
   * Calculate correlated exposure (simplified)
   */
  private calculateCorrelatedExposure(account: ChallengeAccount | FundedAccount, equity: number): number {
    // Group positions by base currency
    const currencyExposure: Record<string, number> = {};
    
    for (const pos of account.openPositions) {
      const baseCurrency = pos.symbol.substring(0, 3); // e.g., EUR from EURUSD
      const positionValue = pos.volume * pos.currentPrice;
      
      if (!currencyExposure[baseCurrency]) {
        currencyExposure[baseCurrency] = 0;
      }
      currencyExposure[baseCurrency] += positionValue;
    }
    
    // Find max correlated exposure
    let maxCorrelated = 0;
    for (const exposure of Object.values(currencyExposure)) {
      const pct = equity > 0 ? (exposure / equity) * 100 : 0;
      if (pct > maxCorrelated) maxCorrelated = pct;
    }
    
    return maxCorrelated;
  }
  
  /**
   * Build rule evaluation context from account and metrics
   */
  private buildRuleContext(
    account: ChallengeAccount | FundedAccount,
    config: any,
    metrics: RiskMetrics
  ): RuleEvaluationContext {
    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    // Simplified news window check - would integrate with economic calendar
    const isNewsWindow = false;
    
    return {
      account: account as any,
      challengeConfig: config,
      currentBalance: metrics.balance,
      currentEquity: metrics.equity,
      floatingPL: metrics.floatingPL,
      dailyRealizedPL: metrics.dailyRealizedPL,
      totalRealizedPL: metrics.totalRealizedPL,
      highestEquity: metrics.highestEquity,
      highestBalance: metrics.highestBalance,
      dailyDrawdownPct: metrics.dailyDrawdownPct,
      totalDrawdownPct: metrics.totalDrawdownPct,
      tradingDaysCount: metrics.tradingDaysCount,
      tradesToday: metrics.tradesToday,
      totalTrades: metrics.totalTrades,
      openPositions: account.openPositions,
      totalExposure: metrics.totalExposure,
      currentTime: now,
      serverTime: now,
      isWeekend,
      isNewsWindow,
      currentPhase: "currentPhase" in account ? account.currentPhase : undefined,
      phaseStartedAt: "phaseStartedAt" in account ? new Date(account.phaseStartedAt) : undefined
    };
  }
  
  /**
   * Update account state from trading event
   */
  private updateAccountFromEvent(account: ChallengeAccount | FundedAccount, event: TradingEvent): void {
    switch (event.eventType) {
      case "POSITION_OPEN":
        if (event.ticket && event.symbol && event.volume && event.price) {
          const newPosition: OpenPosition = {
            ticket: event.ticket,
            symbol: event.symbol,
            type: event.orderType === "BUY" || event.orderType === "BUY_LIMIT" || event.orderType === "BUY_STOP" ? "BUY" : "SELL",
            volume: event.volume,
            openPrice: event.price,
            currentPrice: event.price,
            stopLoss: event.stopLoss,
            takeProfit: event.takeProfit,
            swap: 0,
            commission: event.commission || 0,
            profit: 0,
            openTime: event.eventTime,
            magicNumber: event.magicNumber,
            comment: event.comment
          };
          account.openPositions.push(newPosition);
          account.tradesToday++;
          account.totalTrades++;
          account.lastTradeAt = event.eventTime;
        }
        break;
        
      case "POSITION_CLOSE":
        if (event.ticket && event.profit !== undefined) {
          const posIndex = account.openPositions.findIndex(p => p.ticket === event.ticket);
          if (posIndex >= 0) {
            const closedPos = account.openPositions.splice(posIndex, 1)[0];
            account.currentBalance += event.profit;
            account.currentEquity += event.profit;
            account.dailyRealizedPL += event.profit;
            account.totalRealizedPL += event.profit;
            
            // Update highest equity/balance
            if (account.currentEquity > account.highestEquity) {
              account.highestEquity = account.currentEquity;
            }
            if (account.currentBalance > account.highestBalance) {
              account.highestBalance = account.currentBalance;
            }
          }
        }
        break;
        
      case "POSITION_UPDATE":
        if (event.ticket && event.floatingPL !== undefined) {
          const pos = account.openPositions.find(p => p.ticket === event.ticket);
          if (pos) {
            pos.currentPrice = event.price || pos.currentPrice;
            pos.profit = event.floatingPL;
            pos.swap = event.swap || pos.swap;
            pos.commission = event.commission || pos.commission;
            
            // Update account floating PL
            account.floatingPL = account.openPositions.reduce((sum, p) => sum + p.profit, 0);
            account.currentEquity = account.currentBalance + account.floatingPL;
            
            // Update highest equity
            if (account.currentEquity > account.highestEquity) {
              account.highestEquity = account.currentEquity;
            }
          }
        }
        break;
        
      case "ACCOUNT_STATE_SNAPSHOT":
        if (event.balanceAfter !== undefined) account.currentBalance = event.balanceAfter;
        if (event.equityAfter !== undefined) account.currentEquity = event.equityAfter;
        if (event.marginAfter !== undefined) account.openPositions; // Would update margin
        break;
        
      case "DAILY_ROLLOVER":
        // Reset daily counters
        account.dailyRealizedPL = 0;
        account.tradesToday = 0;
        account.tradingDaysCount++;
        break;
    }
    
    // Update total exposure
    account.totalExposure = account.openPositions.reduce((sum, pos) => {
      return sum + (pos.volume * pos.currentPrice);
    }, 0);
    
    if (account.totalExposure > account.maxExposureReached) {
      account.maxExposureReached = account.totalExposure;
    }
  }
  
  /**
   * Get previous risk state for account
   */
  private getPreviousRiskState(accountId: string): RiskState | null {
    const snapshots = this.snapshots.get(accountId);
    if (!snapshots || snapshots.length === 0) return null;
    return snapshots[snapshots.length - 1].riskState;
  }
  
  /**
   * Store risk snapshot
   */
  private storeSnapshot(accountId: string, snapshot: RiskSnapshot): void {
    const snapshots = this.snapshots.get(accountId) || [];
    snapshots.push(snapshot);
    
    // Trim old snapshots
    if (snapshots.length > this.maxSnapshotsPerAccount) {
      snapshots.splice(0, snapshots.length - this.maxSnapshotsPerAccount);
    }
    
    this.snapshots.set(accountId, snapshots);
  }
  
  /**
   * Get risk history for account
   */
  getRiskHistory(accountId: string, limit: number = 100): RiskSnapshot[] {
    const snapshots = this.snapshots.get(accountId) || [];
    return snapshots.slice(-limit);
  }
  
  /**
   * Get current risk state for account
   */
  getCurrentRiskState(accountId: string): RiskSnapshot | null {
    const snapshots = this.snapshots.get(accountId);
    if (!snapshots || snapshots.length === 0) return null;
    return snapshots[snapshots.length - 1];
  }
  
  /**
   * Get all accounts in a specific risk state
   */
  getAccountsByRiskState(state: RiskState): RiskSnapshot[] {
    const result: RiskSnapshot[] = [];
    for (const snapshots of this.snapshots.values()) {
      if (snapshots.length > 0) {
        const latest = snapshots[snapshots.length - 1];
        if (latest.riskState === state) {
          result.push(latest);
        }
      }
    }
    return result;
  }
  
  /**
   * Force risk state recalculation (for admin/manual review)
   */
  recalculateRiskState(
    account: ChallengeAccount | FundedAccount,
    config: any
  ): RiskSnapshot {
    // Create a dummy event to trigger full recalculation
    const dummyEvent: TradingEvent = {
      id: `recalc_${Date.now()}`,
      accountId: account.id,
      accountType: "challengeConfigId" in account ? "CHALLENGE" : "FUNDED",
      traderId: account.traderId,
      eventType: "ACCOUNT_STATE_SNAPSHOT",
      eventTime: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      balanceAfter: account.currentBalance,
      equityAfter: account.currentEquity
    };
    
    return this.processEvent(dummyEvent, account, config);
  }
  
  /**
   * Acknowledge a rule violation
   */
  acknowledgeViolation(accountId: string, violationId: string, acknowledgedBy: string): boolean {
    // In a real implementation, this would update the violation in the database
    // For now, we just return true
    return true;
  }
  
  /**
   * Get risk summary for dashboard
   */
  getRiskSummary(accountId: string): {
    riskState: RiskState;
    metrics: RiskMetrics;
    violationCount: number;
    breachCount: number;
    warningCount: number;
    lastUpdate: string;
  } | null {
    const snapshot = this.getCurrentRiskState(accountId);
    if (!snapshot) return null;
    
    const breachCount = snapshot.ruleViolations.filter(v => v.severity === "BREACH").length;
    const warningCount = snapshot.ruleViolations.filter(v => v.severity === "WARNING").length;
    
    return {
      riskState: snapshot.riskState,
      metrics: snapshot.riskMetrics,
      violationCount: snapshot.ruleViolations.length,
      breachCount,
      warningCount,
      lastUpdate: snapshot.timestamp
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let riskEngineInstance: RiskEngine | null = null;

export function getRiskEngine(): RiskEngine {
  if (!riskEngineInstance) {
    riskEngineInstance = new RiskEngine();
  }
  return riskEngineInstance;
}

export function resetRiskEngine(): void {
  riskEngineInstance = null;
}


