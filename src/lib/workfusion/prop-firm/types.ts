/**
 * Core Type Definitions for WorkFusion Prop Firm Platform
 * 
 * These types form the foundation of the prop firm operating system.
 * They support the complete trader lifecycle from challenge to funded trader
 * to quantitative talent identification for BoltIQ Capital.
 */

// ============================================================================
// TRADER LIFECYCLE STATES
// ============================================================================

export type TraderLifecycleState =
  | "VISITOR"
  | "REGISTERED"
  | "CHALLENGE_PURCHASED"
  | "CHALLENGE_ACTIVE"
  | "CHALLENGE_WARNING"
  | "CHALLENGE_AT_RISK"
  | "CHALLENGE_BREACHED"
  | "CHALLENGE_PASSED"
  | "CHALLENGE_EXPIRED"
  | "EVALUATION_ACTIVE"
  | "EVALUATION_WARNING"
  | "EVALUATION_AT_RISK"
  | "EVALUATION_BREACHED"
  | "EVALUATION_PASSED"
  | "EVALUATION_EXPIRED"
  | "FUNDED_ACTIVE"
  | "FUNDED_WARNING"
  | "FUNDED_AT_RISK"
  | "FUNDED_BREACHED"
  | "FUNDED_SCALING"
  | "ELITE_TRADER"
  | "QUANT_TALENT_POOL"
  | "BOLTIQ_ASSESSMENT"
  | "SUSPENDED"
  | "TERMINATED";

// ============================================================================
// CHALLENGE / EVALUATION TYPES
// ============================================================================

export type ChallengeTier = "STARTER" | "STANDARD" | "PRO" | "ADVANCED" | "ELITE";

export interface ChallengeConfiguration {
  id: string;
  name: string;
  tier: ChallengeTier;
  description: string;
  accountSize: number;           // e.g., 10000, 25000, 50000, 100000
  price: number;                 // Challenge fee in USD
  resetPrice?: number;           // Optional reset fee
  
  // Core Trading Rules
  profitTargetPct: number;       // e.g., 10 for 10%
  maxDailyLossPct: number;       // e.g., 5 for 5%
  maxTotalLossPct: number;       // e.g., 10 for 10%
  minTradingDays: number;        // Minimum trading days required
  
  // Position & Exposure Limits
  maxPositionSizePct?: number;   // Max position as % of account
  maxExposurePct?: number;       // Max total exposure
  maxLeverage?: number;          // Max leverage allowed
  
  // Instrument & Time Restrictions
  allowedInstruments?: string[]; // e.g., ["FOREX", "INDICES", "COMMODITIES"]
  restrictedInstruments?: string[];
  newsRestrictionMinutes?: number; // Minutes before/after high-impact news
  weekendHoldingAllowed?: boolean;
  maxHoldingHours?: number;      // Max hours to hold a position
  
  // Consistency Rules
  consistencyRule?: {
    enabled: boolean;
    maxDailyProfitPctOfTotal?: number; // Max daily profit as % of total profit
  };
  
  // Trading Frequency
  maxTradesPerDay?: number;
  minTradeDurationSeconds?: number;
  
  // Evaluation Phases
  phaseCount: 1 | 2;             // 1-phase or 2-phase evaluation
  phaseConfigs?: PhaseConfiguration[];
  
  // Scaling
  scalingEnabled: boolean;
  scalingPlan?: ScalingPlan;
  
  // Profit Split
  profitSplitTraderPct: number;  // e.g., 80 for 80%
  profitSplitFirmPct: number;    // e.g., 20 for 20%
  
  // Status
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PhaseConfiguration {
  phase: 1 | 2;
  profitTargetPct: number;
  maxDailyLossPct: number;
  maxTotalLossPct: number;
  minTradingDays: number;
  // Phase 2 typically has tighter rules
}

// ============================================================================
// SCALING PLAN
// ============================================================================

export interface ScalingPlan {
  id: string;
  name: string;
  levels: ScalingLevel[];
  createdAt: string;
  updatedAt: string;
}

export interface ScalingLevel {
  level: number;
  name: string;
  accountSize: number;
  requiredProfitPct: number;     // Profit % needed to reach this level
  requiredConsistencyMonths?: number;
  maxDrawdownPct: number;
  profitSplitTraderPct: number;
  profitSplitFirmPct: number;
  maxPositions?: number;
  maxExposurePct?: number;
}

// ============================================================================
// TRADER ACCOUNT & PROFILE
// ============================================================================

export interface TraderProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  phone?: string;
  dateOfBirth?: string;
  
  // KYC/AML
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  kycVerifiedAt?: string;
  kycDocuments?: KycDocument[];
  
  // Account Status
  status: "ACTIVE" | "SUSPENDED" | "TERMINATED" | "PENDING_VERIFICATION";
  lifecycleState: TraderLifecycleState;
  
  // Subscription
  aiSubscriptionTier: "FREE" | "PRO" | "QUANT";
  aiSubscriptionStatus: "ACTIVE" | "CANCELLED" | "PAST_DUE" | "TRIALING";
  aiSubscriptionExpiresAt?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface KycDocument {
  id: string;
  type: "PASSPORT" | "DRIVERS_LICENSE" | "NATIONAL_ID" | "UTILITY_BILL" | "BANK_STATEMENT";
  status: "PENDING" | "APPROVED" | "REJECTED";
  fileUrl: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

// ============================================================================
// CHALLENGE ACCOUNT (Trading Account during Evaluation)
// ============================================================================

export interface ChallengeAccount {
  id: string;
  traderId: string;
  challengeConfigId: string;
  challengeConfig: ChallengeConfiguration; // Denormalized for performance
  
  // Account Identification
  mt5Login: number;              // MT5 account login
  mt5Server: string;             // MT5 server name
  mt5Password?: string;          // Encrypted investor password (read-only)
  
  // Phase Tracking
  currentPhase: 1 | 2;
  phaseStartedAt: string;
  
  // Financial State
  initialBalance: number;        // Starting balance (e.g., 100000)
  currentBalance: number;        // Current balance (closed trades only)
  currentEquity: number;         // Current equity (balance + floating P/L)
  floatingPL: number;            // Floating profit/loss
  dailyRealizedPL: number;       // Realized P/L for current day
  totalRealizedPL: number;       // Total realized P/L since start
  highestEquity: number;         // Highest equity reached (for drawdown calc)
  highestBalance: number;        // Highest balance reached
  
  // Drawdown Tracking
  dailyDrawdownPct: number;      // Current daily drawdown %
  totalDrawdownPct: number;      // Current total drawdown %
  maxDailyDrawdownPct: number;   // Maximum daily drawdown reached
  maxTotalDrawdownPct: number;   // Maximum total drawdown reached
  
  // Trading Activity
  tradingDaysCount: number;      // Number of trading days with activity
  tradesToday: number;           // Trades executed today
  totalTrades: number;           // Total trades in challenge
  lastTradeAt?: string;
  
  // Position Tracking
  openPositions: OpenPosition[];
  totalExposure: number;         // Current total exposure in base currency
  maxExposureReached: number;    // Maximum exposure reached
  
  // Rule Compliance
  ruleViolations: RuleViolation[];
  currentStatus: ChallengeAccountStatus;
  statusChangedAt: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  startedAt?: string;            // When trading actually began
  completedAt?: string;          // When challenge ended (passed/failed)
}

export type ChallengeAccountStatus =
  | "CREATED"
  | "PENDING_MT5_SETUP"
  | "ACTIVE"
  | "WARNING"
  | "AT_RISK"
  | "BREACHED"
  | "PASSED"
  | "EXPIRED"
  | "SUSPENDED"
  | "RESET_PENDING"
  | "RESET_COMPLETED";

export interface OpenPosition {
  ticket: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  swap: number;
  commission: number;
  profit: number;                // Floating profit
  openTime: string;
  magicNumber?: number;
  comment?: string;
}

export interface RuleViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: "WARNING" | "BREACH";
  message: string;
  value: number;                 // The value that triggered violation
  limit: number;                 // The limit that was exceeded
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

// ============================================================================
// FUNDED ACCOUNT
// ============================================================================

export interface FundedAccount {
  id: string;
  traderId: string;
  challengeAccountId: string;    // The challenge that led to funding
  
  // Account Details
  mt5Login: number;
  mt5Server: string;
  mt5Password?: string;
  
  // Capital Allocation
  allocatedCapital: number;      // Current capital allocation (e.g., 100000)
  scalingLevel: number;          // Current scaling level (1, 2, 3...)
  maxAllocation: number;         // Maximum allocation for this trader
  
  // Profit Sharing
  profitSplitTraderPct: number;
  profitSplitFirmPct: number;
  highWaterMark: number;         // Highest equity for profit calculation
  accruedTraderProfit: number;   // Profit owed to trader (not yet paid)
  accruedFirmProfit: number;     // Profit owed to firm (not yet paid)
  
  // Risk Metrics
  currentBalance: number;
  currentEquity: number;
  floatingPL: number;
  dailyRealizedPL: number;
  totalRealizedPL: number;
  dailyDrawdownPct: number;
  totalDrawdownPct: number;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
    highestEquity: number;
    highestBalance: number;
  
  // Trading Activity
  tradingDaysCount: number;
  tradesToday: number;
  totalTrades: number;
  lastTradeAt?: string;
  
  // Position Tracking
  openPositions: OpenPosition[];
  totalExposure: number;
  maxExposureReached: number;
  
  // Compliance
  ruleViolations: RuleViolation[];
  currentStatus: FundedAccountStatus;
  statusChangedAt: string;
  
  // Payouts
  pendingPayoutAmount: number;
  lastPayoutAt?: string;
  totalPaidOut: number;
  
  // Scaling
  scalingEligibleAt?: string;    // When trader became eligible for next level
  scalingRequestedAt?: string;
  scalingApprovedAt?: string;
  scalingRejectedAt?: string;
  scalingRejectionReason?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  fundedAt: string;              // When account was funded
}

export type FundedAccountStatus =
  | "ACTIVE"
  | "WARNING"
  | "AT_RISK"
  | "BREACHED"
  | "SCALING_PENDING"
  | "SCALING_APPROVED"
  | "SCALING_REJECTED"
  | "PAYOUT_PENDING"
  | "PAYOUT_PROCESSING"
  | "SUSPENDED"
  | "TERMINATED"
  | "CLOSED";

// ============================================================================
// TRADING EVENTS (from MT5)
// ============================================================================

export interface TradingEvent {
  id: string;
  accountId: string;             // Challenge or Funded account ID
  accountType: "CHALLENGE" | "FUNDED";
  traderId: string;
  
  // Event Details
  eventType: TradingEventType;
  eventSubType?: string;
  
  // Position Data (for position events)
  ticket?: number;
  symbol?: string;
  orderType?: "BUY" | "SELL" | "BUY_LIMIT" | "SELL_LIMIT" | "BUY_STOP" | "SELL_STOP";
  volume?: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  magicNumber?: number;
  comment?: string;
  
  // Financial Impact
  profit?: number;               // Realized profit for close events
  swap?: number;
  commission?: number;
  floatingPL?: number;           // For position updates
  
  // Account State After Event
  balanceAfter?: number;
  equityAfter?: number;
  marginAfter?: number;
  freeMarginAfter?: number;
  marginLevelAfter?: number;
  
  // Timestamps
  eventTime: string;             // Server time of event
  receivedAt: string;            // When we received it
  processedAt?: string;          // When we processed it
}

export type TradingEventType =
  | "POSITION_OPEN"
  | "POSITION_CLOSE"
  | "POSITION_MODIFY"
  | "POSITION_UPDATE"            // Floating P/L update
  | "ORDER_PLACE"
  | "ORDER_MODIFY"
  | "ORDER_DELETE"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "FEE"
  | "SWAP"
  | "COMMISSION"
  | "MARGIN_CALL"
  | "STOP_OUT"
  | "DAILY_ROLLOVER"
  | "ACCOUNT_STATE_SNAPSHOT";    // Periodic full state snapshot

// ============================================================================
// RISK STATE MACHINE
// ============================================================================

export type RiskState = 
  | "NORMAL"
  | "WARNING"
  | "AT_RISK"
  | "BREACHED";

export interface RiskStateTransition {
  fromState: RiskState;
  toState: RiskState;
  triggeredBy: string;           // Rule ID or "MANUAL"
  reason: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// PAYOUT SYSTEM
// ============================================================================

export interface PayoutRequest {
  id: string;
  traderId: string;
  fundedAccountId: string;
  
  // Amounts
  grossProfit: number;           // Total profit since last payout/HWM
  eligibleProfit: number;        // Profit eligible for split (after rules)
  traderShare: number;           // Trader's portion
  firmShare: number;             // Firm's portion
  requestedAmount: number;       // Amount trader requested
  approvedAmount: number;        // Amount approved
  
  // Status
  status: PayoutStatus;
  requestedAt: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  paidAt?: string;
  
  // Payment Details
  paymentMethod?: "BANK_TRANSFER" | "PAYPAL" | "CRYPTO" | "WIRE";
  paymentReference?: string;
  paymentFee?: number;
  netAmount?: number;
  
  // Review
  reviewedBy?: string;
  reviewNotes?: string;
  rejectionReason?: string;
}

export type PayoutStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED";

// ============================================================================
// FINANCIAL LEDGER
// ============================================================================

export type LedgerEntryType =
  // Revenue
  | "CHALLENGE_PURCHASE"
  | "CHALLENGE_RESET"
  | "SUBSCRIPTION_PRO"
  | "SUBSCRIPTION_QUANT"
  | "PROFIT_SHARE_FIRM"
  // Expenses/Payouts
  | "TRADER_PAYOUT"
  | "REFUND"
  | "CHARGEBACK"
  | "PAYMENT_FEE"
  | "KYC_COST"
  | "INFRASTRUCTURE_COST"
  | "SUPPORT_COST"
  | "OPERATIONAL_ADJUSTMENT";

export interface LedgerEntry {
  id: string;
  entryType: LedgerEntryType;
  traderId?: string;
  accountId?: string;            // Challenge or Funded account ID
  
  // Financial
  amount: number;                // Positive = revenue, Negative = expense
  currency: "USD";
  
  // References
  referenceId?: string;          // e.g., challenge ID, payout ID
  referenceType?: string;
  
  // Metadata
  description: string;
  metadata?: Record<string, unknown>;
  
  // Audit
  createdAt: string;
  createdBy: string;             // System or admin user ID
  isReconciled: boolean;
  reconciledAt?: string;
  reconciledBy?: string;
}

// ============================================================================
// PERFORMANCE ANALYTICS
// ============================================================================

export interface TraderPerformanceMetrics {
  traderId: string;
  accountId: string;
  accountType: "CHALLENGE" | "FUNDED";
  periodStart: string;
  periodEnd: string;
  
  // Returns
  totalReturnPct: number;
  monthlyReturnPct?: number;
  annualizedReturnPct?: number;
  
  // Risk
  maxDrawdownPct: number;
  maxDailyDrawdownPct: number;
  currentDrawdownPct: number;
  var95?: number;                // Value at Risk 95%
  var99?: number;
  
  // Ratios
  profitFactor: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  recoveryFactor?: number;
  
  // Trade Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgWinLossRatio: number;
  expectancy: number;
  
  // Consistency
  profitableDays: number;
  losingDays: number;
  totalTradingDays: number;
  dailyProfitConsistencyPct?: number; // % of days profitable
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  
  // Exposure
  avgExposurePct: number;
  maxExposurePct: number;
  avgLeverage: number;
  maxLeverage: number;
  
  // Timing
  avgHoldTimeHours: number;
  avgTradesPerDay: number;
  
  // Strategy Characteristics
  strategyType?: "SCALPING" | "DAY_TRADING" | "SWING" | "POSITION" | "MIXED";
  preferredInstruments?: string[];
  preferredSessions?: ("ASIAN" | "LONDON" | "NEW_YORK")[];
  
  // Quantitative Talent Score (0-100)
  quantTalentScore?: number;
  quantTalentTier?: "EMERGING" | "DEVELOPING" | "PROFICIENT" | "EXPERT" | "ELITE";
  
  calculatedAt: string;
}

// ============================================================================
// QUANT TALENT POOL (BoltIQ Pipeline)
// ============================================================================

export interface QuantTalentCandidate {
  id: string;
  traderId: string;
  
  // Performance Summary
  bestChallengeScore: number;
  bestFundedPerformance: TraderPerformanceMetrics;
  consistencyScore: number;      // 0-100
  riskManagementScore: number;   // 0-100
  strategyQualityScore: number;  // 0-100
  overallTalentScore: number;    // 0-100
  
  // Classification
  tier: "EMERGING" | "DEVELOPING" | "PROFICIENT" | "EXPERT" | "ELITE";
  strategyArchetype: string;     // e.g., "Mean Reversion Scalper", "Trend Follower"
  
  // BoltIQ Pipeline
  boltIqStatus: "NOT_ASSESSED" | "IN_REVIEW" | "INTERVIEW_SCHEDULED" | "TECHNICAL_TEST" | "OFFER_EXTENDED" | "HIRED" | "DECLINED" | "ARCHIVED";
  boltIqAssessedAt?: string;
  boltIqAssessedBy?: string;
  boltIqNotes?: string;
  
  // Tracking
  discoveredAt: string;
  lastUpdatedAt: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ADMIN / CONFIGURATION
// ============================================================================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "RISK_MANAGER" | "SUPPORT" | "ANALYST";
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SystemConfiguration {
  id: string;
  key: string;
  value: string;
  type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
  description: string;
  isPublic: boolean;             // Can be exposed to frontend
  updatedAt: string;
  updatedBy: string;
}

// ============================================================================
// WEBHOOK / INTEGRATION EVENTS
// ============================================================================

export interface WebhookEvent {
  id: string;
  eventType: string;             // e.g., "challenge.passed", "funded.breached"
  payload: Record<string, unknown>;
  targetUrl: string;
  status: "PENDING" | "DELIVERED" | "FAILED" | "RETRYING";
  attempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  createdAt: string;
  deliveredAt?: string;
}


