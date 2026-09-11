/**
 * Rule Engine - Central Source of Truth for All Trading Rules
 * 
 * This is the core deterministic rule engine that evaluates trading compliance
 * for challenges, evaluations, and funded accounts. All rules must be
 * configurable without rewriting business logic.
 */

import {
  ChallengeConfiguration,
  ChallengeAccount,
  FundedAccount,
  TradingEvent,
  RuleViolation,
  RiskState,
  RiskStateTransition,
  ChallengeAccountStatus,
  FundedAccountStatus,
  OpenPosition,
  ChallengeTier
} from "./types";

// ============================================================================
// RULE DEFINITIONS
// ============================================================================

export interface TradingRule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: "WARNING" | "BREACH";
  
  // Rule Logic
  evaluate: (context: RuleEvaluationContext) => RuleEvaluationResult;
  
  // Configuration
  configurable: boolean;
  defaultConfig: Record<string, unknown>;
  configSchema?: Record<string, RuleConfigProperty>;
  
  // Metadata
  appliesTo: ("CHALLENGE" | "FUNDED" | "EVALUATION")[];
  phase?: 1 | 2;                 // If phase-specific
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RuleCategory =
  | "DRAWDOWN"           // Daily/Total drawdown limits
  | "PROFIT_TARGET"      // Profit target requirements
  | "TRADING_DAYS"       // Minimum trading days
  | "POSITION_SIZE"      // Max position size limits
  | "EXPOSURE"           // Total exposure limits
  | "LEVERAGE"           // Leverage restrictions
  | "INSTRUMENTS"        // Allowed/restricted instruments
  | "NEWS"               // News trading restrictions
  | "WEEKEND"            // Weekend holding restrictions
  | "HOLDING_TIME"       // Max holding time
  | "CONSISTENCY"        // Consistency rules
  | "FREQUENCY"          // Trading frequency limits
  | "SCALING"            // Scaling eligibility rules
  | "CUSTOM";            // Custom firm rules

export interface RuleConfigProperty {
  type: "NUMBER" | "BOOLEAN" | "STRING" | "ARRAY";
  description: string;
  required: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  enum?: string[];
}

export interface RuleEvaluationContext {
  // Account state
  account: ChallengeAccount | FundedAccount;
  challengeConfig: ChallengeConfiguration;
  
  // Current metrics
  currentBalance: number;
  currentEquity: number;
  floatingPL: number;
  dailyRealizedPL: number;
  totalRealizedPL: number;
  highestEquity: number;
  highestBalance: number;
  
  // Drawdown
  dailyDrawdownPct: number;
  totalDrawdownPct: number;
  
  // Trading activity
  tradingDaysCount: number;
  tradesToday: number;
  totalTrades: number;
  
  // Positions
  openPositions: OpenPosition[];
  totalExposure: number;
  
  // Time context
  currentTime: Date;
  serverTime: Date;
  isWeekend: boolean;
  isNewsWindow: boolean;
  
  // Phase info (for challenges)
  currentPhase?: 1 | 2;
  phaseStartedAt?: Date;
  
  // Custom data
  customData?: Record<string, unknown>;
}

export interface RuleEvaluationResult {
  passed: boolean;
  severity: "WARNING" | "BREACH" | "NONE";
  message: string;
  value?: number;                // Current value
  limit?: number;                // Limit that was checked
  metadata?: Record<string, unknown>;
  suggestedAction?: string;
}

// ============================================================================
// RULE ENGINE CLASS
// ============================================================================

export class RuleEngine {
  private rules: Map<string, TradingRule> = new Map();
  private ruleConfigs: Map<string, Record<string, unknown>> = new Map();
  
  constructor() {
    this.registerBuiltInRules();
  }
  
  /**
   * Register a new trading rule
   */
  registerRule(rule: TradingRule): void {
    this.rules.set(rule.id, rule);
    if (rule.configurable && rule.defaultConfig) {
      this.ruleConfigs.set(rule.id, { ...rule.defaultConfig });
    }
  }
  
  /**
   * Update rule configuration
   */
  updateRuleConfig(ruleId: string, config: Record<string, unknown>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.configurable) return false;
    
    const currentConfig = this.ruleConfigs.get(ruleId) || {};
    this.ruleConfigs.set(ruleId, { ...currentConfig, ...config });
    return true;
  }
  
  /**
   * Get rule configuration
   */
  getRuleConfig(ruleId: string): Record<string, unknown> | undefined {
    return this.ruleConfigs.get(ruleId);
  }
  
  /**
   * Get all active rules for account type
   */
  getActiveRules(accountType: "CHALLENGE" | "FUNDED" | "EVALUATION", phase?: 1 | 2): TradingRule[] {
    return Array.from(this.rules.values()).filter(rule => 
      rule.isActive && 
      rule.appliesTo.includes(accountType) &&
      (phase === undefined || rule.phase === undefined || rule.phase === phase)
    );
  }
  
  /**
   * Evaluate all rules for an account
   */
  evaluateAllRules(context: RuleEvaluationContext): RuleEvaluationResult[] {
    const accountType = context.account.accountType || 
      ("challengeConfig" in context.account ? "CHALLENGE" : "FUNDED");
    const phase = "currentPhase" in context.account ? context.account.currentPhase : undefined;
    
    const rules = this.getActiveRules(accountType, phase);
    return rules.map(rule => this.evaluateRule(rule, context));
  }
  
  /**
   * Evaluate a single rule
   */
  evaluateRule(rule: TradingRule, context: RuleEvaluationContext): RuleEvaluationResult {
    const config = this.ruleConfigs.get(rule.id) || rule.defaultConfig || {};
    const contextWithConfig = { ...context, ruleConfig: config };
    
    try {
      return rule.evaluate(contextWithConfig);
    } catch (error) {
      return {
        passed: false,
        severity: "BREACH",
        message: `Rule evaluation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: { error: true, ruleId: rule.id }
      };
    }
  }
  
  /**
   * Determine risk state from rule evaluations
   */
  determineRiskState(results: RuleEvaluationResult[]): RiskState {
    const hasBreach = results.some(r => r.severity === "BREACH" && !r.passed);
    const hasWarning = results.some(r => r.severity === "WARNING" && !r.passed);
    
    if (hasBreach) return "BREACHED";
    if (hasWarning) return "AT_RISK"; // Could also be "WARNING" based on count
    return "NORMAL";
  }
  
  /**
   * Determine account status from risk state and rules
   */
  determineAccountStatus(
    riskState: RiskState,
    results: RuleEvaluationResult[],
    isChallenge: boolean
  ): ChallengeAccountStatus | FundedAccountStatus {
    // Check for specific breach types
    const dailyDrawdownBreach = results.some(r => 
      r.severity === "BREACH" && !r.passed && r.metadata?.ruleCategory === "DRAWDOWN" && r.metadata?.drawdownType === "DAILY"
    );
    const totalDrawdownBreach = results.some(r => 
      r.severity === "BREACH" && !r.passed && r.metadata?.ruleCategory === "DRAWDOWN" && r.metadata?.drawdownType === "TOTAL"
    );
    const profitTargetMet = results.some(r => 
      r.passed && r.metadata?.ruleCategory === "PROFIT_TARGET" && r.metadata?.targetMet === true
    );
    const minDaysMet = results.some(r => 
      r.passed && r.metadata?.ruleCategory === "TRADING_DAYS" && r.metadata?.daysMet === true
    );
    
    if (isChallenge) {
      if (dailyDrawdownBreach || totalDrawdownBreach) return "BREACHED";
      if (profitTargetMet && minDaysMet) return "PASSED";
      if (hasWarning(results)) return "WARNING";
      if (riskState === "AT_RISK") return "AT_RISK";
      return "ACTIVE";
    } else {
      // Funded account
      if (dailyDrawdownBreach || totalDrawdownBreach) return "BREACHED";
      if (riskState === "AT_RISK") return "AT_RISK";
      if (hasWarning(results)) return "WARNING";
      return "ACTIVE";
    }
  }
  
  /**
   * Generate rule violations from evaluation results
   */
  generateViolations(
    results: RuleEvaluationResult[],
    accountId: string,
    traderId: string
  ): RuleViolation[] {
    return results
      .filter(r => !r.passed && r.severity !== "NONE")
      .map(result => ({
        id: `viol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ruleId: result.metadata?.ruleId || "unknown",
        ruleName: result.metadata?.ruleName || "Unknown Rule",
        severity: result.severity,
        message: result.message,
        value: result.value ?? 0,
        limit: result.limit ?? 0,
        timestamp: new Date().toISOString(),
        acknowledged: false,
        metadata: result.metadata
      }));
  }
  
  /**
   * Register built-in rules
   */
  private registerBuiltInRules(): void {
    // Daily Drawdown Rule
    this.registerRule({
      id: "daily_drawdown",
      name: "Maximum Daily Loss",
      description: "Daily loss must not exceed the configured percentage of initial balance",
      category: "DRAWDOWN",
      severity: "BREACH",
      configurable: true,
      defaultConfig: { maxDailyLossPct: 5 },
      configSchema: {
        maxDailyLossPct: { type: "NUMBER", description: "Maximum daily loss percentage", required: true, min: 0.1, max: 20 }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { maxDailyLossPct: 5 };
        const limit = config.maxDailyLossPct as number;
        const dailyLossPct = Math.abs(Math.min(0, context.dailyRealizedPL)) / context.account.initialBalance * 100;
        
        return {
          passed: dailyLossPct <= limit,
          severity: "BREACH",
          message: `Daily loss ${dailyLossPct.toFixed(2)}% ${dailyLossPct > limit ? "exceeds" : "within"} limit of ${limit}%`,
          value: dailyLossPct,
          limit,
          metadata: { ruleCategory: "DRAWDOWN", drawdownType: "DAILY", ruleId: "daily_drawdown" },
          suggestedAction: dailyLossPct > limit ? "Stop trading for today" : undefined
        };
      }
    });
    
    // Total Drawdown Rule
    this.registerRule({
      id: "total_drawdown",
      name: "Maximum Total Drawdown",
      description: "Total drawdown from peak equity must not exceed configured percentage",
      category: "DRAWDOWN",
      severity: "BREACH",
      configurable: true,
      defaultConfig: { maxTotalLossPct: 10 },
      configSchema: {
        maxTotalLossPct: { type: "NUMBER", description: "Maximum total drawdown percentage", required: true, min: 1, max: 50 }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { maxTotalLossPct: 10 };
        const limit = config.maxTotalLossPct as number;
        const drawdownPct = (context.highestEquity - context.currentEquity) / context.highestEquity * 100;
        
        return {
          passed: drawdownPct <= limit,
          severity: "BREACH",
          message: `Total drawdown ${drawdownPct.toFixed(2)}% ${drawdownPct > limit ? "exceeds" : "within"} limit of ${limit}%`,
          value: drawdownPct,
          limit,
          metadata: { ruleCategory: "DRAWDOWN", drawdownType: "TOTAL", ruleId: "total_drawdown" },
          suggestedAction: drawdownPct > limit ? "Account breached - stop all trading" : undefined
        };
      }
    });
    
    // Profit Target Rule
    this.registerRule({
      id: "profit_target",
      name: "Profit Target",
      description: "Account must reach the profit target percentage",
      category: "PROFIT_TARGET",
      severity: "WARNING",
      configurable: true,
      defaultConfig: { profitTargetPct: 10 },
      configSchema: {
        profitTargetPct: { type: "NUMBER", description: "Profit target percentage", required: true, min: 1, max: 100 }
      },
      appliesTo: ["CHALLENGE", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { profitTargetPct: 10 };
        const target = config.profitTargetPct as number;
        const profitPct = (context.currentEquity - context.account.initialBalance) / context.account.initialBalance * 100;
        const targetMet = profitPct >= target;
        
        return {
          passed: targetMet,
          severity: "WARNING",
          message: `Profit target ${profitPct.toFixed(2)}% ${targetMet ? "reached" : "not yet reached"} (target: ${target}%)`,
          value: profitPct,
          limit: target,
          metadata: { ruleCategory: "PROFIT_TARGET", targetMet, ruleId: "profit_target" },
          suggestedAction: targetMet ? "Target reached - verify minimum trading days" : "Continue trading toward target"
        };
      }
    });
    
    // Minimum Trading Days Rule
    this.registerRule({
      id: "min_trading_days",
      name: "Minimum Trading Days",
      description: "Trader must have minimum number of trading days with activity",
      category: "TRADING_DAYS",
      severity: "WARNING",
      configurable: true,
      defaultConfig: { minTradingDays: 3 },
      configSchema: {
        minTradingDays: { type: "NUMBER", description: "Minimum required trading days", required: true, min: 1, max: 30 }
      },
      appliesTo: ["CHALLENGE", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { minTradingDays: 3 };
        const required = config.minTradingDays as number;
        const daysMet = context.tradingDaysCount >= required;
        
        return {
          passed: daysMet,
          severity: "WARNING",
          message: `Trading days: ${context.tradingDaysCount}/${required} ${daysMet ? "met" : "required"}`,
          value: context.tradingDaysCount,
          limit: required,
          metadata: { ruleCategory: "TRADING_DAYS", daysMet, ruleId: "min_trading_days" },
          suggestedAction: daysMet ? "Minimum days requirement satisfied" : `Need ${required - context.tradingDaysCount} more trading day(s)`
        };
      }
    });
    
    // Max Position Size Rule
    this.registerRule({
      id: "max_position_size",
      name: "Maximum Position Size",
      description: "Individual position size must not exceed percentage of account equity",
      category: "POSITION_SIZE",
      severity: "BREACH",
      configurable: true,
      defaultConfig: { maxPositionSizePct: 5 },
      configSchema: {
        maxPositionSizePct: { type: "NUMBER", description: "Max position size as % of equity", required: true, min: 0.1, max: 100 }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { maxPositionSizePct: 5 };
        const limit = config.maxPositionSizePct as number;
        
        let maxPositionPct = 0;
        let violatingPosition: OpenPosition | null = null;
        
        for (const pos of context.openPositions) {
          const positionValue = pos.volume * pos.currentPrice; // Simplified
          const positionPct = (positionValue / context.currentEquity) * 100;
          if (positionPct > maxPositionPct) {
            maxPositionPct = positionPct;
            violatingPosition = pos;
          }
        }
        
        return {
          passed: maxPositionPct <= limit,
          severity: "BREACH",
          message: violatingPosition 
            ? `Position ${violatingPosition.symbol} at ${maxPositionPct.toFixed(2)}% ${maxPositionPct > limit ? "exceeds" : "within"} limit of ${limit}%`
            : "No open positions",
          value: maxPositionPct,
          limit,
          metadata: { 
            ruleCategory: "POSITION_SIZE", 
            ruleId: "max_position_size",
            violatingSymbol: violatingPosition?.symbol 
          },
          suggestedAction: maxPositionPct > limit ? "Reduce position size immediately" : undefined
        };
      }
    });
    
    // Max Exposure Rule
    this.registerRule({
      id: "max_exposure",
      name: "Maximum Total Exposure",
      description: "Total exposure across all positions must not exceed limit",
      category: "EXPOSURE",
      severity: "BREACH",
      configurable: true,
      defaultConfig: { maxExposurePct: 20 },
      configSchema: {
        maxExposurePct: { type: "NUMBER", description: "Max total exposure as % of equity", required: true, min: 1, max: 500 }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { maxExposurePct: 20 };
        const limit = config.maxExposurePct as number;
        const exposurePct = context.currentEquity > 0 ? (context.totalExposure / context.currentEquity) * 100 : 0;
        
        return {
          passed: exposurePct <= limit,
          severity: "BREACH",
          message: `Total exposure ${exposurePct.toFixed(2)}% ${exposurePct > limit ? "exceeds" : "within"} limit of ${limit}%`,
          value: exposurePct,
          limit,
          metadata: { ruleCategory: "EXPOSURE", ruleId: "max_exposure" },
          suggestedAction: exposurePct > limit ? "Close positions to reduce exposure" : undefined
        };
      }
    });
    
    // Max Leverage Rule
    this.registerRule({
      id: "max_leverage",
      name: "Maximum Leverage",
      description: "Account leverage must not exceed configured maximum",
      category: "LEVERAGE",
      severity: "BREACH",
      configurable: true,
      defaultConfig: { maxLeverage: 30 },
      configSchema: {
        maxLeverage: { type: "NUMBER", description: "Maximum allowed leverage", required: true, min: 1, max: 500 }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { maxLeverage: 30 };
        const limit = config.maxLeverage as number;
        const currentLeverage = context.currentEquity > 0 ? context.totalExposure / context.currentEquity : 0;
        
        return {
          passed: currentLeverage <= limit,
          severity: "BREACH",
          message: `Current leverage ${currentLeverage.toFixed(2)}:1 ${currentLeverage > limit ? "exceeds" : "within"} limit of ${limit}:1`,
          value: currentLeverage,
          limit,
          metadata: { ruleCategory: "LEVERAGE", ruleId: "max_leverage" },
          suggestedAction: currentLeverage > limit ? "Reduce leverage immediately" : undefined
        };
      }
    });
    
    // News Restriction Rule
    this.registerRule({
      id: "news_restriction",
      name: "News Trading Restriction",
      description: "No new positions allowed during high-impact news windows",
      category: "NEWS",
      severity: "BREACH",
      configurable: true,
      defaultConfig: { newsRestrictionMinutes: 5 },
      configSchema: {
        newsRestrictionMinutes: { type: "NUMBER", description: "Minutes before/after news to restrict trading", required: true, min: 0, max: 60 }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { newsRestrictionMinutes: 5 };
        const restrictionMinutes = config.newsRestrictionMinutes as number;
        
        if (!context.isNewsWindow || restrictionMinutes === 0) {
          return {
            passed: true,
            severity: "NONE",
            message: "No news restriction active",
            value: 0,
            limit: restrictionMinutes,
            metadata: { ruleCategory: "NEWS", ruleId: "news_restriction" }
          };
        }
        
        // Check for new positions opened during news window
        const recentPositions = context.openPositions.filter(pos => {
          const openTime = new Date(pos.openTime);
          const diffMinutes = (context.currentTime.getTime() - openTime.getTime()) / 60000;
          return diffMinutes <= restrictionMinutes;
        });
        
        const hasViolation = recentPositions.length > 0;
        
        return {
          passed: !hasViolation,
          severity: "BREACH",
          message: hasViolation 
            ? `${recentPositions.length} position(s) opened during news restriction window`
            : "No positions opened during news window",
          value: recentPositions.length,
          limit: restrictionMinutes,
          metadata: { ruleCategory: "NEWS", ruleId: "news_restriction", violatingPositions: recentPositions.map(p => p.ticket) },
          suggestedAction: hasViolation ? "Close positions opened during news window" : undefined
        };
      }
    });
    
    // Weekend Holding Rule
    this.registerRule({
      id: "weekend_holding",
      name: "Weekend Holding Restriction",
      description: "Positions must be closed before weekend if not allowed",
      category: "WEEKEND",
      severity: "BREACH",
      configurable: true,
      defaultConfig: { weekendHoldingAllowed: false },
      configSchema: {
        weekendHoldingAllowed: { type: "BOOLEAN", description: "Allow holding positions over weekend", required: true }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { weekendHoldingAllowed: false };
        const allowed = config.weekendHoldingAllowed as boolean;
        
        if (!context.isWeekend || allowed) {
          return {
            passed: true,
            severity: "NONE",
            message: allowed ? "Weekend holding allowed" : "Not weekend",
            value: 0,
            limit: allowed ? 1 : 0,
            metadata: { ruleCategory: "WEEKEND", ruleId: "weekend_holding" }
          };
        }
        
        const hasOpenPositions = context.openPositions.length > 0;
        
        return {
          passed: !hasOpenPositions,
          severity: "BREACH",
          message: hasOpenPositions 
            ? `${context.openPositions.length} position(s) held over weekend (not allowed)`
            : "No positions held over weekend",
          value: context.openPositions.length,
          limit: 0,
          metadata: { ruleCategory: "WEEKEND", ruleId: "weekend_holding" },
          suggestedAction: hasOpenPositions ? "Close all positions before weekend" : undefined
        };
      }
    });
    
    // Max Holding Time Rule
    this.registerRule({
      id: "max_holding_time",
      name: "Maximum Holding Time",
      description: "Positions must not be held longer than configured maximum hours",
      category: "HOLDING_TIME",
      severity: "WARNING",
      configurable: true,
      defaultConfig: { maxHoldingHours: 168 }, // 1 week default
      configSchema: {
        maxHoldingHours: { type: "NUMBER", description: "Maximum hours to hold a position", required: true, min: 1, max: 720 }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { maxHoldingHours: 168 };
        const limit = config.maxHoldingHours as number;
        
        let maxHoldHours = 0;
        let violatingPosition: OpenPosition | null = null;
        
        for (const pos of context.openPositions) {
          const openTime = new Date(pos.openTime);
          const holdHours = (context.currentTime.getTime() - openTime.getTime()) / 3600000;
          if (holdHours > maxHoldHours) {
            maxHoldHours = holdHours;
            violatingPosition = pos;
          }
        }
        
        const hasViolation = maxHoldHours > limit;
        
        return {
          passed: !hasViolation,
          severity: "WARNING",
          message: violatingPosition
            ? `Position ${violatingPosition.symbol} held for ${maxHoldHours.toFixed(1)}h ${hasViolation ? "exceeds" : "within"} limit of ${limit}h`
            : "No open positions",
          value: maxHoldHours,
          limit,
          metadata: { ruleCategory: "HOLDING_TIME", ruleId: "max_holding_time", violatingSymbol: violatingPosition?.symbol },
          suggestedAction: hasViolation ? "Consider closing long-held positions" : undefined
        };
      }
    });
    
    // Consistency Rule
    this.registerRule({
      id: "consistency_rule",
      name: "Consistency Rule",
      description: "No single day profit can exceed configured percentage of total profit",
      category: "CONSISTENCY",
      severity: "WARNING",
      configurable: true,
      defaultConfig: { enabled: true, maxDailyProfitPctOfTotal: 30 },
      configSchema: {
        enabled: { type: "BOOLEAN", description: "Enable consistency rule", required: true },
        maxDailyProfitPctOfTotal: { type: "NUMBER", description: "Max daily profit as % of total profit", required: true, min: 5, max: 100 }
      },
      appliesTo: ["CHALLENGE", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { enabled: true, maxDailyProfitPctOfTotal: 30 };
        const enabled = config.enabled as boolean;
        const limit = config.maxDailyProfitPctOfTotal as number;
        
        if (!enabled || context.totalRealizedPL <= 0) {
          return {
            passed: true,
            severity: "NONE",
            message: "Consistency rule not applicable",
            value: 0,
            limit,
            metadata: { ruleCategory: "CONSISTENCY", ruleId: "consistency_rule" }
          };
        }
        
        const dailyProfitPct = Math.max(0, context.dailyRealizedPL) / context.totalRealizedPL * 100;
        const hasViolation = dailyProfitPct > limit;
        
        return {
          passed: !hasViolation,
          severity: "WARNING",
          message: `Best day profit ${dailyProfitPct.toFixed(2)}% of total ${hasViolation ? "exceeds" : "within"} consistency limit of ${limit}%`,
          value: dailyProfitPct,
          limit,
          metadata: { ruleCategory: "CONSISTENCY", ruleId: "consistency_rule" },
          suggestedAction: hasViolation ? "Diversify trading across more days" : undefined
        };
      }
    });
    
    // Max Trades Per Day Rule
    this.registerRule({
      id: "max_trades_per_day",
      name: "Maximum Trades Per Day",
      description: "Number of trades per day must not exceed limit",
      category: "FREQUENCY",
      severity: "WARNING",
      configurable: true,
      defaultConfig: { maxTradesPerDay: 20 },
      configSchema: {
        maxTradesPerDay: { type: "NUMBER", description: "Maximum trades allowed per day", required: true, min: 1, max: 500 }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        const config = context.ruleConfig || { maxTradesPerDay: 20 };
        const limit = config.maxTradesPerDay as number;
        
        return {
          passed: context.tradesToday <= limit,
          severity: "WARNING",
          message: `Trades today: ${context.tradesToday}/${limit} ${context.tradesToday > limit ? "exceeded" : "within limit"}`,
          value: context.tradesToday,
          limit,
          metadata: { ruleCategory: "FREQUENCY", ruleId: "max_trades_per_day" },
          suggestedAction: context.tradesToday > limit ? "Stop trading for today" : undefined
        };
      }
    });
    
    // Min Trade Duration Rule
    this.registerRule({
      id: "min_trade_duration",
      name: "Minimum Trade Duration",
      description: "Trades must be held for minimum configured seconds",
      category: "FREQUENCY",
      severity: "BREACH",
      configurable: true,
      defaultConfig: { minTradeDurationSeconds: 30 },
      configSchema: {
        minTradeDurationSeconds: { type: "NUMBER", description: "Minimum seconds to hold a trade", required: true, min: 1, max: 3600 }
      },
      appliesTo: ["CHALLENGE", "FUNDED", "EVALUATION"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluate: (context) => {
        // This rule is evaluated on position close events, not continuously
        // For continuous evaluation, we check open positions that would violate if closed now
        const config = context.ruleConfig || { minTradeDurationSeconds: 30 };
        const limit = config.minTradeDurationSeconds as number;
        
        let minHoldSeconds = Infinity;
        let violatingPosition: OpenPosition | null = null;
        
        for (const pos of context.openPositions) {
          const openTime = new Date(pos.openTime);
          const holdSeconds = (context.currentTime.getTime() - openTime.getTime()) / 1000;
          if (holdSeconds < minHoldSeconds) {
            minHoldSeconds = holdSeconds;
            violatingPosition = pos;
          }
        }
        
        const hasViolation = minHoldSeconds < limit && minHoldSeconds !== Infinity;
        
        return {
          passed: !hasViolation,
          severity: "BREACH",
          message: violatingPosition
            ? `Position ${violatingPosition.symbol} held for ${minHoldSeconds.toFixed(0)}s ${hasViolation ? "below" : "above"} minimum of ${limit}s`
            : "No open positions",
          value: minHoldSeconds === Infinity ? 0 : minHoldSeconds,
          limit,
          metadata: { ruleCategory: "FREQUENCY", ruleId: "min_trade_duration", violatingSymbol: violatingPosition?.symbol },
          suggestedAction: hasViolation ? "Do not close position until minimum duration met" : undefined
        };
      }
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function hasWarning(results: RuleEvaluationResult[]): boolean {
  return results.some(r => r.severity === "WARNING" && !r.passed);
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let ruleEngineInstance: RuleEngine | null = null;

export function getRuleEngine(): RuleEngine {
  if (!ruleEngineInstance) {
    ruleEngineInstance = new RuleEngine();
  }
  return ruleEngineInstance;
}

export function resetRuleEngine(): void {
  ruleEngineInstance = null;
}

