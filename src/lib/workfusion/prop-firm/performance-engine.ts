/**
 * Performance Engine - Calculates Trading Analytics and Quantitative Talent Scores
 * 
 * Calculates: Return, Profit factor, Maximum drawdown, Sharpe ratio, Sortino ratio,
 * Win rate, Average win/loss, Expectancy, Recovery factor, Risk-adjusted return,
 * Consistency, Trading frequency, Exposure, Strategy characteristics, and Quantitative Talent Score.
 */

import {
  ChallengeAccount,
  FundedAccount,
  TradingEvent,
  TraderPerformanceMetrics,
  QuantTalentCandidate,
  OpenPosition
} from "./types";
import { getEvaluationEngine } from "./evaluation-engine";

// ============================================================================
// PERFORMANCE ENGINE CLASS
// ============================================================================

export class PerformanceEngine {
  private evaluationEngine: any;
  
  constructor(evaluationEngine?: any) {
    this.evaluationEngine = evaluationEngine || getEvaluationEngine();
  }
  
  /**
   * Calculate performance metrics for an account over a period
   */
  calculatePerformanceMetrics(
    account: ChallengeAccount | FundedAccount,
    periodStart: string,
    periodEnd: string
  ): TraderPerformanceMetrics {
    const isChallenge = "challengeConfigId" in account;
    const accountType = isChallenge ? "CHALLENGE" : "FUNDED";
    
    // Get trading events for the period (would come from database in production)
    // For now, we will simulate from account state
    const events = this.getAccountEventsInPeriod(account, periodStart, periodEnd);
    
    // Calculate basic returns

    const initialBalance = isChallenge ? account.initialBalance : account.allocatedCapital;
    const endingBalance = account.currentBalance;
    const endingEquity = account.currentEquity;
    const totalReturnPct = ((endingEquity - initialBalance) / initialBalance) * 100;
    
    // Calculate trade statistics
    const tradeStats = this.calculateTradeStatistics(events);
    
    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(account, events);
    
    // Calculate ratios
    const ratios = this.calculateRatios(tradeStats, riskMetrics, account);
    
    // Calculate consistency metrics
    const consistency = this.calculateConsistencyMetrics(events, account);
    
    // Calculate exposure metrics
    const exposure = this.calculateExposureMetrics(events, account);
    
    // Calculate timing metrics
    const timing = this.calculateTimingMetrics(events, account);
    
    // Calculate strategy characteristics
    const strategy = this.calculateStrategyCharacteristics(events, account);
    
    // Calculate quantitative talent score
    const quantTalentScore = this.calculateQuantTalentScore(
      tradeStats,
      riskMetrics,
      ratios,
      consistency,
      exposure,
      timing,
      strategy,
      isChallenge
    );
    
    const quantTalentTier = this.getQuantTalentTier(quantTalentScore);
    
    return {
      traderId: account.traderId,
      accountId: account.id,
      accountType,
      periodStart,
      periodEnd,
      
      // Returns
      totalReturnPct,
      monthlyReturnPct: this.calculateMonthlyReturn(account, periodStart, periodEnd),
      annualizedReturnPct: this.calculateAnnualizedReturn(totalReturnPct, periodStart, periodEnd),
      
      // Risk
      maxDrawdownPct: riskMetrics.maxDrawdownPct,
      maxDailyDrawdownPct: riskMetrics.maxDailyDrawdownPct,
      currentDrawdownPct: riskMetrics.currentDrawdownPct,
      var95: riskMetrics.var95,
      var99: riskMetrics.var99,
      
      // Ratios
      profitFactor: ratios.profitFactor,
      sharpeRatio: ratios.sharpeRatio,
      sortinoRatio: ratios.sortinoRatio,
      calmarRatio: ratios.calmarRatio,
      recoveryFactor: ratios.recoveryFactor,
      
      // Trade Statistics
      totalTrades: tradeStats.totalTrades,
      winningTrades: tradeStats.winningTrades,
      losingTrades: tradeStats.losingTrades,
      winRatePct: tradeStats.winRatePct,
      avgWin: tradeStats.avgWin,
      avgLoss: tradeStats.avgLoss,
      largestWin: tradeStats.largestWin,
      largestLoss: tradeStats.largestLoss,
      avgWinLossRatio: tradeStats.avgWinLossRatio,
      expectancy: tradeStats.expectancy,
      
      // Consistency
      profitableDays: consistency.profitableDays,
      losingDays: consistency.losingDays,
      totalTradingDays: consistency.totalTradingDays,
      dailyProfitConsistencyPct: consistency.dailyProfitConsistencyPct,
      maxConsecutiveWins: consistency.maxConsecutiveWins,
      maxConsecutiveLosses: consistency.maxConsecutiveLosses,
      
      // Exposure
      avgExposurePct: exposure.avgExposurePct,
      maxExposurePct: exposure.maxExposurePct,
      avgLeverage: exposure.avgLeverage,
      maxLeverage: exposure.maxLeverage,
      
      // Timing
      avgHoldTimeHours: timing.avgHoldTimeHours,
      avgTradesPerDay: timing.avgTradesPerDay,
      
      // Strategy Characteristics
      strategyType: strategy.strategyType,
      preferredInstruments: strategy.preferredInstruments,
      preferredSessions: strategy.preferredSessions,
      
      // Quantitative Talent Score
      quantTalentScore,
      quantTalentTier,
      
      calculatedAt: new Date().toISOString()
    };
  }
  
  /**
   * Calculate quantitative talent score (0-100)
   */
  private calculateQuantTalentScore(
    tradeStats: any,
    riskMetrics: any,
    ratios: any,
    consistency: any,
    exposure: any,
    timing: any,
    strategy: any,
    isChallenge: boolean
  ): number {
    // Weighted scoring model for quantitative talent
    const weights = {
      profitability: 0.20,      // Profit factor, expectancy
      riskManagement: 0.25,     // Drawdown, volatility, ratios
      consistency: 0.20,        // Win rate, streak management
      discipline: 0.15,         // Trade frequency, holding time
      strategyQuality: 0.10,    // Strategy characteristics
      scalability: 0.10         // Performance consistency across time
    };
    
    // Profitability score (0-100)
    let profitabilityScore = 0;
    if (tradeStats.profitFactor > 0) {
      // Profit factor of 1.0 = 50 points, 2.0 = 80 points, 3.0+ = 100 points
      profitabilityScore = Math.min(100, 50 + (tradeStats.profitFactor - 1) * 30);
    }
    if (tradeStats.expectancy > 0) {
      // Expectancy scaled to 0-100 (assuming $10 per trade is good)
      profitabilityScore = Math.max(profitabilityScore, Math.min(100, tradeStats.expectancy * 5));
    }
    
    // Risk management score (0-100)
    let riskManagementScore = 100; // Start perfect, deduct for issues
    if (riskMetrics.maxDrawdownPct > 0) {
      // Deduct points for drawdown (10% DD = 0 points, 0% DD = 100 points)
      riskManagementScore -= Math.min(100, riskMetrics.maxDrawdownPct * 10);
    }
    if (ratios.sharpeRatio !== null) {
      // Sharpe ratio: 0 = 50 points, 1 = 75 points, 2+ = 100 points
      riskManagementScore = Math.max(
        riskManagementScore,
        Math.min(100, 50 + ratios.sharpeRatio * 25)
      );
    }
    if (ratios.sortinoRatio !== null) {
      // Sortino ratio similar to Sharpe but penalizes downside volatility more
      riskManagementScore = Math.max(
        riskManagementScore,
        Math.min(100, 50 + ratios.sortinoRatio * 25)
      );
    }
    
    // Consistency score (0-100)
    let consistencyScore = 0;
    if (tradeStats.winRatePct >= 0) {
      // Win rate: 30% = 0 points, 50% = 50 points, 70% = 100 points
      consistencyScore = Math.min(100, Math.max(0, (tradeStats.winRatePct - 30) * 5));
    }
    // Bonus for managing losing streaks
    if (consistency.maxConsecutiveLosses <= 3) {
      consistencyScore += 10;
    } else if (consistency.maxConsecutiveLosses <= 5) {
      consistencyScore += 5;
    }
    consistencyScore = Math.min(100, consistencyScore);
    
    // Discipline score (0-100)
    let disciplineScore = 50; // Start neutral
    // Penalize over-trading or under-trading
    const idealTradesPerDay = 2; // 2 trades per day ideal
    if (timing.avgTradesPerDay > 0) {
      const tradeDeviation = Math.abs(timing.avgTradesPerDay - idealTradesPerDay) / idealTradesPerDay;
      disciplineScore -= Math.min(30, tradeDeviation * 30); // Max 30 point penalty
    }
    // Penalize extremely short or long holding times
    const idealHoldTimeHours = 6; // 6 hours ideal
    if (timing.avgHoldTimeHours > 0) {
      const holdTimeScore = Math.max(0, 100 - Math.abs(timing.avgHoldTimeHours - idealHoldTimeHours) * 5);
      disciplineScore = (disciplineScore + holdTimeScore) / 2;
    }
    disciplineScore = Math.max(0, Math.min(100, disciplineScore));
    
    // Strategy quality score (0-100)
    let strategyScore = 50; // Start neutral
    // Favor strategies with clear characteristics
    if (strategy.strategyType !== "MIXED") {
      strategyScore += 20;
    }
    if (strategy.preferredInstruments.length > 0 && strategy.preferredInstruments.length <= 3) {
      strategyScore += 15; // Focus on few instruments
    }
    if (strategy.preferredSessions.length > 0) {
      strategyScore += 15; // Trading specific sessions
    }
    strategyScore = Math.min(100, strategyScore);
    
    // Scalability score (0-100) - simplified
    let scalabilityScore = 50;
    if (!isChallenge) {
      scalabilityScore += 20; // Funded accounts show more scalability
    }
    if (consistency.totalTradingDays > 20) {
      scalabilityScore += 15;
    }
    scalabilityScore = Math.min(100, scalabilityScore);
    
    // Calculate weighted total
    const totalScore = 
      profitabilityScore * weights.profitability +
      riskManagementScore * weights.riskManagement +
      consistencyScore * weights.consistency +
      disciplineScore * weights.discipline +
      strategyScore * weights.strategyQuality +
      scalabilityScore * weights.scalability;
    
    return Math.round(Math.max(0, Math.min(100, totalScore)));
  }
  
  /**
   * Get quant talent tier from score
   */
  private getQuantTalentTier(score: number): "EMERGING" | "DEVELOPING" | "PROFICIENT" | "EXPERT" | "ELITE" {
    if (score >= 90) return "ELITE";
    if (score >= 75) return "EXPERT";
    if (score >= 60) return "PROFICIENT";
    if (score >= 40) return "DEVELOPING";
    return "EMERGING";
  }
  
  /**
   * Get account events in period (placeholder - would query database)
   */
  private getAccountEventsInPeriod(
    account: ChallengeAccount | FundedAccount,
    periodStart: string,
    periodEnd: string
  ): TradingEvent[] {
    // In production, this would query the database for events in the period
    // For now, return empty array
    return [];
  }
  
  /**
   * Calculate trade statistics from events
   */
  private calculateTradeStatistics(events: TradingEvent[]): any {
    // This would analyze closed trades from events
    // For now, return defaults
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRatePct: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      avgWinLossRatio: 0,
      expectancy: 0,
      profitFactor: 1.0
    };
  }
  
  /**
   * Calculate risk metrics from account and events
   */
  private calculateRiskMetrics(account: ChallengeAccount | FundedAccount, events: TradingEvent[]): any {
    return {
      maxDrawdownPct: account.maxTotalDrawdownPct,
      maxDailyDrawdownPct: account.maxDailyDrawdownPct,
      currentDrawdownPct: account.totalDrawdownPct,
      var95: undefined,
      var99: undefined
    };
  }
  
  /**
   * Calculate risk-adjusted ratios
   */
  private calculateRatios(tradeStats: any, riskMetrics: any, account: ChallengeAccount | FundedAccount): any {
    const sharpeRatio = riskMetrics.currentDrawdownPct > 0 
      ? (tradeStats.expectancy * Math.sqrt(252)) / riskMetrics.currentDrawdownPct 
      : null;
    
    const sortinoRatio = tradeStats.losingTrades > 0
      ? (tradeStats.expectancy * Math.sqrt(252)) / Math.abs(tradeStats.avgLoss)
      : null;
    
    const calmarRatio = riskMetrics.maxDrawdownPct > 0
      ? tradeStats.totalReturnPct / riskMetrics.maxDrawdownPct
      : null;
    
    const recoveryFactor = riskMetrics.maxDrawdownPct > 0
      ? tradeStats.totalReturnPct / riskMetrics.maxDrawdownPct
      : null;
    
    return {
      profitFactor: tradeStats.profitFactor,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      recoveryFactor
    };
  }
  
  /**
   * Calculate consistency metrics
   */
  private calculateConsistencyMetrics(events: TradingEvent[], account: ChallengeAccount | FundedAccount): any {
    return {
      profitableDays: 0,
      losingDays: 0,
      totalTradingDays: account.tradingDaysCount,
      dailyProfitConsistencyPct: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0
    };
  }
  
  /**
   * Calculate exposure metrics
   */
  private calculateExposureMetrics(events: TradingEvent[], account: ChallengeAccount | FundedAccount): any {
    const equity = account.currentEquity;
    const exposure = account.totalExposure;
    return {
      avgExposurePct: equity > 0 ? (exposure / equity) * 100 : 0,
      maxExposurePct: equity > 0 ? (account.maxExposureReached / equity) * 100 : 0,
      avgLeverage: equity > 0 ? exposure / equity : 0,
      maxLeverage: equity > 0 ? account.maxExposureReached / equity : 0
    };
  }
  
  /**
   * Calculate timing metrics
   */
  private calculateTimingMetrics(events: TradingEvent[], account: ChallengeAccount | FundedAccount): any {
    return {
      avgHoldTimeHours: 0,
      avgTradesPerDay: account.tradingDaysCount > 0 ? account.totalTrades / account.tradingDaysCount : 0
    };
  }
  
  /**
   * Calculate strategy characteristics
   */
  private calculateStrategyCharacteristics(events: TradingEvent[], account: ChallengeAccount | FundedAccount): any {
    return {
      strategyType: "MIXED" as const,
      preferredInstruments: [],
      preferredSessions: [] as ("ASIAN" | "LONDON" | "NEW_YORK")[]
    };
  }
  
  /**
   * Calculate monthly return
   */
  private calculateMonthlyReturn(account: ChallengeAccount | FundedAccount, periodStart: string, periodEnd: string): number {
    const isChallenge = "challengeConfigId" in account;
    const initialBalance = isChallenge ? account.initialBalance : account.allocatedCapital;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    if (months <= 0) return 0;
    return ((account.currentEquity - initialBalance) / initialBalance) * 100 / months;
  }
  
  /**
   * Calculate annualized return
   */
  private calculateAnnualizedReturn(totalReturnPct: number, periodStart: string, periodEnd: string): number {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 0) return 0;
    const years = days / 365;
    return (Math.pow(1 + totalReturnPct / 100, 1 / years) - 1) * 100;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let performanceEngineInstance: PerformanceEngine | null = null;

export function getPerformanceEngine(): PerformanceEngine {
  if (!performanceEngineInstance) {
    performanceEngineInstance = new PerformanceEngine();
  }
  return performanceEngineInstance;
}

export function resetPerformanceEngine(): void {
  performanceEngineInstance = null;
}

