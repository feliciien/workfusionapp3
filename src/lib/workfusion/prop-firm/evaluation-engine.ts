/**
 * Evaluation Engine - Manages Complete Trader Lifecycle
 * 
 * States: CREATED -> ACTIVE -> WARNING -> AT_RISK -> BREACHED | PASSED | EXPIRED | SUSPENDED | FUNDED
 * 
 * The evaluation engine processes trading events and continuously determines
 * the trader'\''s current state.
 */

import {
  ChallengeAccount,
  FundedAccount,
  ChallengeConfiguration,
  TradingEvent,
  TraderLifecycleState,
  ChallengeAccountStatus,
  FundedAccountStatus,
  ChallengeTier,
  ScalingPlan,
  ScalingLevel,
  PayoutRequest,
  PayoutStatus,
  TraderProfile,
  RuleViolation
} from "./types";
import { getRiskEngine, RiskEngine } from "./risk-engine";
import { getRuleEngine, RuleEngine } from "./rule-engine";

// ============================================================================
// EVALUATION RESULT
// ============================================================================

export interface EvaluationResult {
  accountId: string;
  traderId: string;
  previousStatus: ChallengeAccountStatus | FundedAccountStatus;
  newStatus: ChallengeAccountStatus | FundedAccountStatus;
  previousLifecycleState: TraderLifecycleState;
  newLifecycleState: TraderLifecycleState;
  triggeredBy: string;
  reason: string;
  ruleViolations: RuleViolation[];
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// EVALUATION ENGINE CLASS
// ============================================================================

export class EvaluationEngine {
  private riskEngine: RiskEngine;
  private ruleEngine: RuleEngine;
  
  constructor(riskEngine?: RiskEngine, ruleEngine?: RuleEngine) {
    this.riskEngine = riskEngine || getRiskEngine();
    this.ruleEngine = ruleEngine || getRuleEngine();
  }
  
  /**
   * Process a trading event and evaluate account status
   */
  evaluateChallengeAccount(
    event: TradingEvent,
    account: ChallengeAccount,
    config: ChallengeConfiguration
  ): EvaluationResult {
    const previousStatus = account.currentStatus;
    const previousLifecycleState = this.getChallengeLifecycleState(account);
    
    // Process event through risk engine
    const snapshot = this.riskEngine.processEvent(event, account, config);
    
    // Check for phase completion (2-phase challenges)
    if (config.phaseCount === 2 && account.currentPhase === 1) {
      const phase1Result = this.checkPhaseCompletion(account, config, 1);
      if (phase1Result) {
        return phase1Result;
      }
    }
    
    // Check for challenge completion (passed/failed)
    const completionResult = this.checkChallengeCompletion(account, config);
    if (completionResult) {
      return completionResult;
    }
    
    // Check for expiration
    const expirationResult = this.checkExpiration(account, config);
    if (expirationResult) {
      return expirationResult;
    }
    
    // Determine new lifecycle state
    const newLifecycleState = this.getChallengeLifecycleState(account);
    
    return {
      accountId: account.id,
      traderId: account.traderId,
      previousStatus,
      newStatus: account.currentStatus,
      previousLifecycleState,
      newLifecycleState,
      triggeredBy: event.id,
      reason: this.generateReason(account, previousStatus),
      ruleViolations: snapshot.ruleViolations,
      metadata: { riskState: snapshot.riskState },
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Evaluate funded account
   */
  evaluateFundedAccount(
    event: TradingEvent,
    account: FundedAccount
  ): EvaluationResult {
    const previousStatus = account.currentStatus;
    const previousLifecycleState = this.getFundedLifecycleState(account);
    
    // Process event through risk engine (no challenge config for funded)
    const snapshot = this.riskEngine.processEvent(event, account, account);
    
    // Check for breach
    if (account.currentStatus === "BREACHED") {
      return {
        accountId: account.id,
        traderId: account.traderId,
        previousStatus,
        newStatus: "BREACHED",
        previousLifecycleState,
        newLifecycleState: "FUNDED_BREACHED",
        triggeredBy: event.id,
        reason: "Funded account breached risk limits",
        ruleViolations: snapshot.ruleViolations,
        metadata: { riskState: snapshot.riskState },
        timestamp: new Date().toISOString()
      };
    }
    
    // Check for scaling eligibility
    const scalingResult = this.checkScalingEligibility(account);
    if (scalingResult) {
      return scalingResult;
    }
    
    // Check for payout eligibility
    const payoutResult = this.checkPayoutEligibility(account);
    if (payoutResult) {
      return payoutResult;
    }
    
    const newLifecycleState = this.getFundedLifecycleState(account);
    
    return {
      accountId: account.id,
      traderId: account.traderId,
      previousStatus,
      newStatus: account.currentStatus,
      previousLifecycleState,
      newLifecycleState,
      triggeredBy: event.id,
      reason: this.generateReason(account, previousStatus),
      ruleViolations: snapshot.ruleViolations,
      metadata: { riskState: snapshot.riskState },
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Check if challenge phase is complete
   */
  private checkPhaseCompletion(
    account: ChallengeAccount,
    config: ChallengeConfiguration,
    phase: 1 | 2
  ): EvaluationResult | null {
    const phaseConfig = config.phaseConfigs?.[phase - 1];
    if (!phaseConfig) return null;
    
    const profitPct = ((account.currentEquity - account.initialBalance) / account.initialBalance) * 100;
    const profitTargetMet = profitPct >= phaseConfig.profitTargetPct;
    const minDaysMet = account.tradingDaysCount >= phaseConfig.minTradingDays;
    const dailyDrawdownOk = account.dailyDrawdownPct < phaseConfig.maxDailyLossPct;
    const totalDrawdownOk = account.totalDrawdownPct < phaseConfig.maxTotalLossPct;
    
    if (phase === 1 && profitTargetMet && minDaysMet && dailyDrawdownOk && totalDrawdownOk) {
      // Phase 1 passed - move to phase 2
      account.currentPhase = 2;
      account.phaseStartedAt = new Date().toISOString();
      account.currentStatus = "ACTIVE";
      account.statusChangedAt = new Date().toISOString();
      
      return {
        accountId: account.id,
        traderId: account.traderId,
        previousStatus: "ACTIVE",
        newStatus: "ACTIVE",
        previousLifecycleState: "CHALLENGE_ACTIVE",
        newLifecycleState: "EVALUATION_ACTIVE",
        triggeredBy: "PHASE_COMPLETION",
        reason: `Phase 1 passed - profit target ${profitPct.toFixed(2)}% reached with ${account.tradingDaysCount} trading days`,
        ruleViolations: [],
        metadata: { phase: 2, profitPct, tradingDays: account.tradingDaysCount },
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  }
  
  /**
   * Check if challenge is complete (passed or failed)
   */
  private checkChallengeCompletion(
    account: ChallengeAccount,
    config: ChallengeConfiguration
  ): EvaluationResult | null {
    const phaseConfig = config.phaseConfigs?.[account.currentPhase - 1] || {
      profitTargetPct: config.profitTargetPct,
      maxDailyLossPct: config.maxDailyLossPct,
      maxTotalLossPct: config.maxTotalLossPct,
      minTradingDays: config.minTradingDays
    };
    
    const profitPct = ((account.currentEquity - account.initialBalance) / account.initialBalance) * 100;
    const profitTargetMet = profitPct >= phaseConfig.profitTargetPct;
    const minDaysMet = account.tradingDaysCount >= phaseConfig.minTradingDays;
    const dailyDrawdownBreached = account.dailyDrawdownPct >= phaseConfig.maxDailyLossPct;
    const totalDrawdownBreached = account.totalDrawdownPct >= phaseConfig.maxTotalLossPct;
    
    // Check for breach
    if (dailyDrawdownBreached || totalDrawdownBreached) {
      account.currentStatus = "BREACHED";
      account.completedAt = new Date().toISOString();
      account.statusChangedAt = new Date().toISOString();
      
      return {
        accountId: account.id,
        traderId: account.traderId,
        previousStatus: account.currentStatus,
        newStatus: "BREACHED",
        previousLifecycleState: this.getChallengeLifecycleState(account),
        newLifecycleState: dailyDrawdownBreached ? "CHALLENGE_BREACHED" : "CHALLENGE_BREACHED",
        triggeredBy: "DRAWDOWN_BREACH",
        reason: dailyDrawdownBreached 
          ? `Daily drawdown ${account.dailyDrawdownPct.toFixed(2)}% breached limit of ${phaseConfig.maxDailyLossPct}%`
          : `Total drawdown ${account.totalDrawdownPct.toFixed(2)}% breached limit of ${phaseConfig.maxTotalLossPct}%`,
        ruleViolations: [],
        metadata: { 
          profitPct, 
          dailyDrawdownPct: account.dailyDrawdownPct, 
          totalDrawdownPct: account.totalDrawdownPct 
        },
        timestamp: new Date().toISOString()
      };
    }
    
    // Check for pass (final phase)
    const isFinalPhase = config.phaseCount === 1 || account.currentPhase === config.phaseCount;
    if (isFinalPhase && profitTargetMet && minDaysMet) {
      account.currentStatus = "PASSED";
      account.completedAt = new Date().toISOString();
      account.statusChangedAt = new Date().toISOString();
      
      return {
        accountId: account.id,
        traderId: account.traderId,
        previousStatus: account.currentStatus,
        newStatus: "PASSED",
        previousLifecycleState: this.getChallengeLifecycleState(account),
        newLifecycleState: "CHALLENGE_PASSED",
        triggeredBy: "CHALLENGE_PASSED",
        reason: `Challenge passed - profit target ${profitPct.toFixed(2)}% reached with ${account.tradingDaysCount} trading days`,
        ruleViolations: [],
        metadata: { 
          profitPct, 
          tradingDays: account.tradingDaysCount,
          phase: account.currentPhase,
          eligibleForFunding: true
        },
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  }
  
  /**
   * Check for challenge expiration
   */
  private checkExpiration(
    account: ChallengeAccount,
    config: ChallengeConfiguration
  ): EvaluationResult | null {
    if (!account.startedAt) return null;
    
    const startDate = new Date(account.startedAt);
    const now = new Date();
    const daysElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Default max challenge duration: 30 days for phase 1, 60 days for phase 2
    const maxDays = config.phaseCount === 2 && account.currentPhase === 2 ? 60 : 30;
    
    if (daysElapsed > maxDays) {
      account.currentStatus = "EXPIRED";
      account.completedAt = new Date().toISOString();
      account.statusChangedAt = new Date().toISOString();
      
      return {
        accountId: account.id,
        traderId: account.traderId,
        previousStatus: account.currentStatus,
        newStatus: "EXPIRED",
        previousLifecycleState: this.getChallengeLifecycleState(account),
        newLifecycleState: "CHALLENGE_EXPIRED",
        triggeredBy: "EXPIRATION",
        reason: `Challenge expired after ${Math.floor(daysElapsed)} days (max: ${maxDays})`,
        ruleViolations: [],
        metadata: { daysElapsed: Math.floor(daysElapsed), maxDays },
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  }
  
  /**
   * Check scaling eligibility for funded account
   */
  private checkScalingEligibility(account: FundedAccount): EvaluationResult | null {
    // This would check against the scaling plan
    // For now, return null - scaling is handled separately
    return null;
  }
  
  /**
   * Check payout eligibility for funded account
   */
  private checkPayoutEligibility(account: FundedAccount): EvaluationResult | null {
    // Payouts are typically requested by trader, not auto-triggered
    // This would check if enough profit has accrued
    return null;
  }
  
  /**
   * Get challenge lifecycle state from account status
   */
  private getChallengeLifecycleState(account: ChallengeAccount): TraderLifecycleState {
    switch (account.currentStatus) {
      case "CREATED": return "CHALLENGE_PURCHASED";
      case "PENDING_MT5_SETUP": return "CHALLENGE_PURCHASED";
      case "ACTIVE": return account.currentPhase === 1 ? "CHALLENGE_ACTIVE" : "EVALUATION_ACTIVE";
      case "WARNING": return account.currentPhase === 1 ? "CHALLENGE_WARNING" : "EVALUATION_WARNING";
      case "AT_RISK": return account.currentPhase === 1 ? "CHALLENGE_AT_RISK" : "EVALUATION_AT_RISK";
      case "BREACHED": return account.currentPhase === 1 ? "CHALLENGE_BREACHED" : "EVALUATION_BREACHED";
      case "PASSED": return account.currentPhase === 1 ? "CHALLENGE_PASSED" : "EVALUATION_PASSED";
      case "EXPIRED": return account.currentPhase === 1 ? "CHALLENGE_EXPIRED" : "EVALUATION_EXPIRED";
      case "SUSPENDED": return "SUSPENDED";
      case "RESET_PENDING": return "CHALLENGE_PURCHASED";
      case "RESET_COMPLETED": return "CHALLENGE_ACTIVE";
      default: return "CHALLENGE_ACTIVE";
    }
  }
  
  /**
   * Get funded lifecycle state from account status
   */
  private getFundedLifecycleState(account: FundedAccount): TraderLifecycleState {
    switch (account.currentStatus) {
      case "ACTIVE": return "FUNDED_ACTIVE";
      case "WARNING": return "FUNDED_WARNING";
      case "AT_RISK": return "FUNDED_AT_RISK";
      case "BREACHED": return "FUNDED_BREACHED";
      case "SCALING_PENDING": return "FUNDED_SCALING";
      case "SCALING_APPROVED": return "FUNDED_SCALING";
      case "SCALING_REJECTED": return "FUNDED_ACTIVE";
      case "PAYOUT_PENDING": return "FUNDED_ACTIVE";
      case "PAYOUT_PROCESSING": return "FUNDED_ACTIVE";
      case "SUSPENDED": return "SUSPENDED";
      case "TERMINATED": return "TERMINATED";
      case "CLOSED": return "TERMINATED";
      default: return "FUNDED_ACTIVE";
    }
  }
  
  /**
   * Generate human-readable reason for status change
   */
  private generateReason(account: ChallengeAccount | FundedAccount, previousStatus: string): string {
    const currentStatus = account.currentStatus;
    
    if (previousStatus === currentStatus) {
      return "Status unchanged - routine evaluation";
    }
    
    switch (currentStatus) {
      case "WARNING":
        return "Risk metrics approaching limits - warning issued";
      case "AT_RISK":
        return "Multiple risk warnings - account at risk of breach";
      case "BREACHED":
        return "Risk limit breached - trading suspended";
      case "PASSED":
        return "Challenge evaluation passed - eligible for funding";
      case "EXPIRED":
        return "Challenge time limit reached";
      case "SCALING_PENDING":
        return "Scaling review initiated";
      case "SCALING_APPROVED":
        return "Scaling approved - capital increase pending";
      case "SCALING_REJECTED":
        return "Scaling request rejected";
      case "PAYOUT_PENDING":
        return "Payout requested - under review";
      case "PAYOUT_PROCESSING":
        return "Payout approved - processing payment";
      default:
        return `Status changed from ${previousStatus} to ${currentStatus}`;
    }
  }
  
  /**
   * Create challenge account from purchase
   */
  createChallengeAccount(
    traderId: string,
    config: ChallengeConfiguration,
    mt5Login: number,
    mt5Server: string
  ): ChallengeAccount {
    const now = new Date().toISOString();
    
    return { accountType: "CHALLENGE",
      id: `chal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      traderId,
      challengeConfigId: config.id,
      challengeConfig: config,
      mt5Login,
      mt5Server,
      currentPhase: 1,
      phaseStartedAt: now,
      initialBalance: config.accountSize,
      currentBalance: config.accountSize,
      currentEquity: config.accountSize,
      floatingPL: 0,
      dailyRealizedPL: 0,
      totalRealizedPL: 0,
      highestEquity: config.accountSize,
      highestBalance: config.accountSize,
      dailyDrawdownPct: 0,
      totalDrawdownPct: 0,
      maxDailyDrawdownPct: 0,
      maxTotalDrawdownPct: 0,
      tradingDaysCount: 0,
      tradesToday: 0,
      totalTrades: 0,
      openPositions: [],
      totalExposure: 0,
      maxExposureReached: 0,
      ruleViolations: [],
      currentStatus: "CREATED",
      statusChangedAt: now,
      createdAt: now,
      updatedAt: now
    };
  }
  
  /**
   * Create funded account from passed challenge
   */
  createFundedAccount(
    traderId: string,
    challengeAccount: ChallengeAccount,
    allocatedCapital: number,
    scalingPlan?: ScalingPlan
  ): FundedAccount {
    const now = new Date().toISOString();
    const config = challengeAccount.challengeConfig;
    const initialLevel = scalingPlan?.levels[0] || {
      level: 1,
      name: "Level 1",
      accountSize: allocatedCapital,
      requiredProfitPct: 0,
      maxDrawdownPct: config.maxTotalLossPct,
      profitSplitTraderPct: config.profitSplitTraderPct,
      profitSplitFirmPct: config.profitSplitFirmPct
    };
    
    return { accountType: "FUNDED",
      id: `fund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      traderId,
      challengeAccountId: challengeAccount.id,
      mt5Login: challengeAccount.mt5Login,
      mt5Server: challengeAccount.mt5Server,
      allocatedCapital,
      scalingLevel: 1,
      maxAllocation: scalingPlan?.levels[scalingPlan.levels.length - 1]?.accountSize || allocatedCapital * 10,
      profitSplitTraderPct: config.profitSplitTraderPct,
      profitSplitFirmPct: config.profitSplitFirmPct,
      highWaterMark: allocatedCapital,
      accruedTraderProfit: 0,
      accruedFirmProfit: 0,
      currentBalance: allocatedCapital,
      currentEquity: allocatedCapital,
        highestEquity: allocatedCapital,
        highestBalance: allocatedCapital,
      floatingPL: 0,
      dailyRealizedPL: 0,
      totalRealizedPL: 0,
      dailyDrawdownPct: 0,
      totalDrawdownPct: 0,
      maxDailyDrawdownPct: 0,
      maxTotalDrawdownPct: 0,
      tradingDaysCount: 0,
      tradesToday: 0,
      totalTrades: 0,
      openPositions: [],
      totalExposure: 0,
      maxExposureReached: 0,
      ruleViolations: [],
      currentStatus: "ACTIVE",
      statusChangedAt: now,
      pendingPayoutAmount: 0,
      totalPaidOut: 0,
      fundedAt: now,
      createdAt: now,
      updatedAt: now
    };
  }
  
  /**
   * Process challenge reset
   */
  resetChallengeAccount(account: ChallengeAccount, config: ChallengeConfiguration): ChallengeAccount {
    const now = new Date().toISOString();
    
    account.currentBalance = config.accountSize;
    account.currentEquity = config.accountSize;
    account.floatingPL = 0;
    account.dailyRealizedPL = 0;
    account.totalRealizedPL = 0;
    account.highestEquity = config.accountSize;
    account.highestBalance = config.accountSize;
    account.dailyDrawdownPct = 0;
    account.totalDrawdownPct = 0;
    account.maxDailyDrawdownPct = 0;
    account.maxTotalDrawdownPct = 0;
    account.tradingDaysCount = 0;
    account.tradesToday = 0;
    account.totalTrades = 0;
    account.lastTradeAt = undefined;
    account.openPositions = [];
    account.totalExposure = 0;
    account.maxExposureReached = 0;
    account.ruleViolations = [];
    account.currentStatus = "RESET_COMPLETED";
    account.statusChangedAt = now;
    account.currentPhase = 1;
    account.phaseStartedAt = now;
    account.startedAt = undefined;
    account.completedAt = undefined;
    account.updatedAt = now;
    
    return account;
  }
  
  /**
   * Process scaling for funded account
   */
  processScaling(
    account: FundedAccount,
    scalingPlan: ScalingPlan,
    approved: boolean,
    adminNotes?: string
  ): FundedAccount {
    const now = new Date().toISOString();
    const nextLevel = scalingPlan.levels.find(l => l.level === account.scalingLevel + 1);
    
    if (approved && nextLevel) {
      account.scalingLevel = nextLevel.level;
      account.allocatedCapital = nextLevel.accountSize;
      account.profitSplitTraderPct = nextLevel.profitSplitTraderPct;
      account.profitSplitFirmPct = nextLevel.profitSplitFirmPct;
      account.maxAllocation = scalingPlan.levels[scalingPlan.levels.length - 1].accountSize;
      account.currentStatus = "SCALING_APPROVED";
      account.scalingApprovedAt = now;
    } else {
      account.currentStatus = "SCALING_REJECTED";
      account.scalingRejectedAt = now;
      account.scalingRejectionReason = adminNotes;
    }
    
    account.statusChangedAt = now;
    account.updatedAt = now;
    
    return account;
  }
  
  /**
   * Process payout request
   */
  requestPayout(
    account: FundedAccount,
    requestedAmount: number,
    paymentMethod: "BANK_TRANSFER" | "PAYPAL" | "CRYPTO" | "WIRE"
  ): PayoutRequest {
    const now = new Date().toISOString();
    
    // Calculate eligible profit (above high water mark)
    const grossProfit = account.currentEquity - account.highWaterMark;
    const eligibleProfit = Math.max(0, grossProfit);
    const traderShare = (eligibleProfit * account.profitSplitTraderPct) / 100;
    const firmShare = (eligibleProfit * account.profitSplitFirmPct) / 100;
    const approvedAmount = Math.min(requestedAmount, traderShare);
    
    const payoutRequest: PayoutRequest = {
      id: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      traderId: account.traderId,
      fundedAccountId: account.id,
      grossProfit,
      eligibleProfit,
      traderShare,
      firmShare,
      requestedAmount,
      approvedAmount,
      status: "REQUESTED",
      requestedAt: now,
      paymentMethod,
          };
    
    account.pendingPayoutAmount = approvedAmount;
    account.currentStatus = "PAYOUT_PENDING";
    account.statusChangedAt = now;
    account.updatedAt = now;
    
    return payoutRequest;
  }
  
  /**
   * Approve payout
   */
  approvePayout(
    account: FundedAccount,
    payoutRequest: PayoutRequest,
    approvedBy: string,
    notes?: string
  ): PayoutRequest {
    const now = new Date().toISOString();
    
    payoutRequest.status = "APPROVED";
    payoutRequest.approvedAt = now;
    payoutRequest.reviewedBy = approvedBy;
    payoutRequest.reviewNotes = notes;
    
    account.currentStatus = "PAYOUT_PROCESSING";
    account.statusChangedAt = now;
    account.updatedAt = now;
    
    return payoutRequest;
  }
  
  /**
   * Complete payout
   */
  completePayout(
    account: FundedAccount,
    payoutRequest: PayoutRequest,
    paymentReference: string,
    paymentFee: number = 0
  ): PayoutRequest {
    const now = new Date().toISOString();
    
    payoutRequest.status = "PAID";
    payoutRequest.paidAt = now;
    payoutRequest.paymentReference = paymentReference;
    payoutRequest.paymentFee = paymentFee;
    payoutRequest.netAmount = payoutRequest.approvedAmount - paymentFee;
    
    // Update account
    account.highWaterMark = account.currentEquity;
    account.accruedTraderProfit = 0;
    account.accruedFirmProfit = 0;
    account.pendingPayoutAmount = 0;
    account.lastPayoutAt = now;
    account.totalPaidOut += payoutRequest.netAmount;
    account.currentStatus = "ACTIVE";
    account.statusChangedAt = now;
    account.updatedAt = now;
    
    return payoutRequest;
  }
  
  /**
   * Get evaluation summary for dashboard
   */
  getEvaluationSummary(account: ChallengeAccount | FundedAccount): {
    status: string;
    progress: {
      profitTarget: { current: number; target: number; met: boolean };
      minTradingDays: { current: number; target: number; met: boolean };
      dailyDrawdown: { current: number; limit: number; ok: boolean };
      totalDrawdown: { current: number; limit: number; ok: boolean };
    };
    riskState: string;
    violations: { breaches: number; warnings: number };
    nextMilestone?: string;
  } {
    const isChallenge = "challengeConfigId" in account;
    const config = isChallenge ? account.challengeConfig : {
      profitTargetPct: 0,
      maxDailyLossPct: 10,
      maxTotalLossPct: 10,
      minTradingDays: 0
    };
    
      const startingBalance = isChallenge ? account.initialBalance : account.allocatedCapital;
const profitPct = ((account.currentEquity - startingBalance) / startingBalance) * 100;
const profitTarget = config.profitTargetPct || 10;
    
    return {
      status: account.currentStatus,
      progress: {
        profitTarget: {
          current: profitPct,
          target: profitTarget,
          met: profitPct >= profitTarget
        },
        minTradingDays: {
          current: account.tradingDaysCount,
          target: config.minTradingDays || 0,
          met: account.tradingDaysCount >= (config.minTradingDays || 0)
        },
        dailyDrawdown: {
          current: account.dailyDrawdownPct,
          limit: config.maxDailyLossPct || 10,
          ok: account.dailyDrawdownPct < (config.maxDailyLossPct || 10)
        },
        totalDrawdown: {
          current: account.totalDrawdownPct,
          limit: config.maxTotalLossPct || 10,
          ok: account.totalDrawdownPct < (config.maxTotalLossPct || 10)
        }
      },
      riskState: "NORMAL", // Would come from risk engine
      violations: {
        breaches: account.ruleViolations.filter(v => v.severity === "BREACH").length,
        warnings: account.ruleViolations.filter(v => v.severity === "WARNING").length
      },
      nextMilestone: this.getNextMilestone(account, config)
    };
  }
  
  /**
   * Get next milestone for trader
   */
    private getNextMilestone(
    account: ChallengeAccount | FundedAccount,
    config: any
  ): string | undefined {
    const isChallenge = "challengeConfigId" in account;
    if (isChallenge) {
      // Challenge account
      if (account.currentStatus === "BREACHED" || account.currentStatus === "EXPIRED") {
        return "Challenge ended - consider reset or new challenge";
      }
      if (account.currentStatus === "PASSED") {
        return "Eligible for funded account";
      }
      
      const startingBalance = account.initialBalance;
      const profitPct = ((account.currentEquity - startingBalance) / startingBalance) * 100;
      const profitTarget = config.profitTargetPct || 10;
      const daysNeeded = Math.max(0, (config.minTradingDays || 0) - account.tradingDaysCount);
      
      if (profitPct < profitTarget) {
        return `Need ${(profitTarget - profitPct).toFixed(1)}% more profit to reach target`;
      }
      if (daysNeeded > 0) {
        return `Need ${daysNeeded} more trading day(s)`;
      }
      return "Approaching challenge completion";
    } else {
      // Funded account
      if (account.currentStatus === "BREACHED") {
        return "Account breached - trading suspended";
      }
      if (account.accruedTraderProfit > 0) {
        return `${account.accruedTraderProfit.toFixed(2)} USD available for payout`;
      }
      return "Trading actively - monitor performance";
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let evaluationEngineInstance: EvaluationEngine | null = null;

export function getEvaluationEngine(): EvaluationEngine {
  if (!evaluationEngineInstance) {
    evaluationEngineInstance = new EvaluationEngine();
  }
  return evaluationEngineInstance;
}

export function resetEvaluationEngine(): void {
  evaluationEngineInstance = null;
}










