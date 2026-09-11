/**
 * Account Engine - Manages Trading Accounts
 * 
 * Manages challenge accounts, evaluation accounts, funded accounts,
 * account balances, equity, trading limits, account status, scaling levels,
 * and payout eligibility.
 */

import {
  ChallengeAccount,
  FundedAccount,
  ChallengeConfiguration,
  TradingEvent,
  TraderProfile,
  KycDocument,
  ScalingPlan,
  ScalingLevel,
  LedgerEntry,
  LedgerEntryType
} from "./types";
import { getEvaluationEngine, EvaluationEngine } from "./evaluation-engine";
import { getRuleEngine, RuleEngine } from "./rule-engine";
import { getRiskEngine, RiskEngine } from "./risk-engine";

// ============================================================================
// ACCOUNT ENGINE CLASS
// ============================================================================

export class AccountEngine {
  private evaluationEngine: EvaluationEngine;
  private ruleEngine: RuleEngine;
  private riskEngine: RiskEngine;
  
  // In-memory stores (would be replaced with database in production)
  private traderProfiles: Map<string, TraderProfile> = new Map();
  private challengeAccounts: Map<string, ChallengeAccount> = new Map();
  private fundedAccounts: Map<string, FundedAccount> = new Map();
  private ledgerEntries: LedgerEntry[] = [];
  
  constructor(
    evaluationEngine?: EvaluationEngine,
    ruleEngine?: RuleEngine,
    riskEngine?: RiskEngine
  ) {
    this.evaluationEngine = evaluationEngine || getEvaluationEngine();
    this.ruleEngine = ruleEngine || getRuleEngine();
    this.riskEngine = riskEngine || getRiskEngine();
  }
  
  // ============================================================================
  // TRADER PROFILE MANAGEMENT
  // ============================================================================
  
  /**
   * Create new trader profile
   */
  createTraderProfile(
    email: string,
    firstName: string,
    lastName: string,
    country: string,
    phone?: string,
    dateOfBirth?: string
  ): TraderProfile {
    const now = new Date().toISOString();
    
    const profile: TraderProfile = {
      id: `trader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      firstName,
      lastName,
      country,
      phone,
      dateOfBirth,
      kycStatus: "PENDING",
      kycVerifiedAt: undefined,
      kycDocuments: [],
      status: "PENDING_VERIFICATION",
      lifecycleState: "VISITOR",
      aiSubscriptionTier: "FREE",
      aiSubscriptionStatus: "TRIALING",
      aiSubscriptionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7-day trial
      createdAt: now,
      updatedAt: now,
      lastLoginAt: undefined
    };
    
    this.traderProfiles.set(profile.id, profile);
    return profile;
  }
  
  /**
   * Get trader profile
   */
  getTraderProfile(traderId: string): TraderProfile | undefined {
    return this.traderProfiles.get(traderId);
  }
  
  /**
   * Update trader profile
   */
  updateTraderProfile(
    traderId: string,
    updates: Partial<Omit<TraderProfile, "id" | "createdAt">>
  ): TraderProfile | undefined {
    const profile = this.traderProfiles.get(traderId);
    if (!profile) return undefined;
    
    const updatedProfile = { ...profile, ...updates, updatedAt: new Date().toISOString() };
    this.traderProfiles.set(traderId, updatedProfile);
    return updatedProfile;
  }
  
  /**
   * Update KYC status
   */
  updateKycStatus(
    traderId: string,
    status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED",
    documents?: KycDocument[],
    verifiedBy?: string
  ): TraderProfile | undefined {
    const profile = this.traderProfiles.get(traderId);
    if (!profile) return undefined;
    
    profile.kycStatus = status;
    profile.kycVerifiedAt = status === "VERIFIED" ? new Date().toISOString() : undefined;
    if (documents) profile.kycDocuments = documents;
    profile.updatedAt = new Date().toISOString();
    
    // If KYC verified, update account status
    if (status === "VERIFIED" && profile.status === "PENDING_VERIFICATION") {
      profile.status = "ACTIVE";
      profile.lifecycleState = "REGISTERED";
    }
    
    this.traderProfiles.set(traderId, profile);
    return profile;
  }
  
  /**
   * Update AI subscription
   */
  updateAiSubscription(
    traderId: string,
    tier: "FREE" | "PRO" | "QUANT",
    status: "ACTIVE" | "CANCELLED" | "PAST_DUE" | "TRIALING",
    expiresAt?: string
  ): TraderProfile | undefined {
    const profile = this.traderProfiles.get(traderId);
    if (!profile) return undefined;
    
    profile.aiSubscriptionTier = tier;
    profile.aiSubscriptionStatus = status;
    profile.aiSubscriptionExpiresAt = expiresAt;
    profile.updatedAt = new Date().toISOString();
    
    this.traderProfiles.set(traderId, profile);
    return profile;
  }
  
  /**
   * Update trader login
   */
  updateLastLogin(traderId: string): TraderProfile | undefined {
    const profile = this.traderProfiles.get(traderId);
    if (!profile) return undefined;
    
    profile.lastLoginAt = new Date().toISOString();
    this.traderProfiles.set(traderId, profile);
    return profile;
  }
  
  // ============================================================================
  // CHALLENGE ACCOUNT MANAGEMENT
  // ============================================================================
  
  /**
   * Create challenge account from purchase
   */
  createChallengeAccount(
    traderId: string,
    config: ChallengeConfiguration,
    mt5Login: number,
    mt5Server: string
  ): ChallengeAccount | undefined {
    // Validate trader exists and can purchase challenge
    const trader = this.traderProfiles.get(traderId);
    if (!trader) {
      throw new Error(`Trader ${traderId} not found`);
    }
    
    if (trader.status !== "ACTIVE") {
      throw new Error(`Trader ${traderId} account is not active (status: ${trader.status})`);
    }
    
    if (!config.isActive) {
      throw new Error(`Challenge ${config.id} is not active`);
    }
    
    // Record ledger entry for challenge purchase
    this.recordLedgerEntry({
      entryType: "CHALLENGE_PURCHASE",
      traderId,
      amount: config.price,
      description: `Challenge purchase: ${config.name} (${config.accountSize} USD)`,
      referenceId: config.id,
      referenceType: "CHALLENGE_CONFIG"
    });
    
    // Create challenge account
    const account = this.evaluationEngine.createChallengeAccount(
      traderId,
      config,
      mt5Login,
      mt5Server
    );
    
    this.challengeAccounts.set(account.id, account);
    return account;
  }
  
  /**
   * Get challenge account
   */
  getChallengeAccount(accountId: string): ChallengeAccount | undefined {
    return this.challengeAccounts.get(accountId);
  }
  
  /**
   * Get challenge accounts for trader
   */
  getTraderChallengeAccounts(traderId: string): ChallengeAccount[] {
    return Array.from(this.challengeAccounts.values())
      .filter(acc => acc.traderId === traderId);
  }
  
  /**
   * Update challenge account from MT5 event
   */
  processChallengeEvent(
    event: TradingEvent,
    accountId: string,
    config: ChallengeConfiguration
  ): ChallengeAccount | undefined {
    const account = this.challengeAccounts.get(accountId);
    if (!account) return undefined;
    
    // Validate event belongs to account
    if (event.accountId !== accountId) {
      throw new Error(`Event accountId ${event.accountId} does not match challenge account ${accountId}`);
    }
    
    // Evaluate the event
    const evaluationResult = this.evaluationEngine.evaluateChallengeAccount(event, account, config);
    
    // Update account in map
    this.challengeAccounts.set(accountId, account);
    
    // Record significant events in ledger
    this.recordChallengeLedgerEvents(account, evaluationResult);
    
    return account;
  }
  
  /**
   * Reset challenge account
   */
  resetChallengeAccount(
    accountId: string,
    resetPrice: number
  ): ChallengeAccount | undefined {
    const account = this.challengeAccounts.get(accountId);
    if (!account) return undefined;
    
    // Validate account can be reset
    const validStatuses = ["BREACHED", "EXPIRED", "PASSED"];
    if (!validStatuses.includes(account.currentStatus)) {
      throw new Error(`Challenge account ${accountId} cannot be reset from status ${account.currentStatus}`);
    }
    
    // Record ledger entry for reset fee
    this.recordLedgerEntry({
      entryType: "CHALLENGE_RESET",
      traderId: account.traderId,
      accountId,
      amount: resetPrice,
      description: `Challenge reset: ${account.challengeConfig.name}`,
      referenceId: account.id,
      referenceType: "CHALLENGE_ACCOUNT"
    });
    
    // Reset the account
    const resetAccount = this.evaluationEngine.resetChallengeAccount(account, account.challengeConfig);
    this.challengeAccounts.set(accountId, resetAccount);
    
    return resetAccount;
  }
  
  /**
   * Complete challenge (passed/failed) and create funded account if passed
   */
  completeChallenge(
    accountId: string,
    scalingPlan?: ScalingPlan
  ): { 
    challengeAccount: ChallengeAccount; 
    fundedAccount?: FundedAccount;
    evaluationResult: any 
  } | undefined {
    const account = this.challengeAccounts.get(accountId);
    if (!account) return undefined;
    
    // Only completed challenges can be finalized
    const completedStatuses = ["PASSED", "BREACHED", "EXPIRED"];
    if (!completedStatuses.includes(account.currentStatus)) {
      throw new Error(`Challenge account ${accountId} is not completed (status: ${account.currentStatus})`);
    }
    
    let fundedAccount: FundedAccount | undefined;
    
    // If passed, create funded account
    if (account.currentStatus === "PASSED" && scalingPlan) {
      fundedAccount = this.evaluationEngine.createFundedAccount(
        account.traderId,
        account,
        account.challengeConfig.accountSize, // Initial capital equals challenge size
        scalingPlan
      );
      
      if (fundedAccount) {
        this.fundedAccounts.set(fundedAccount.id, fundedAccount);
        
        // Record ledger entry for funding
        this.recordLedgerEntry({
          entryType: "PROFIT_SHARE_FIRM", // This represents the firm allocation
          traderId: account.traderId,
          accountId: fundedAccount.id,
          amount: 0, // No immediate profit share - this is capital allocation
          description: `Funded account created: ${fundedAccount.id}`,
          referenceId: fundedAccount.id,
          referenceType: "FUNDED_ACCOUNT"
        });
      }
    }
    
    // Update challenge account status to completed
    account.currentStatus = account.currentStatus; // Already set
    account.statusChangedAt = new Date().toISOString();
    this.challengeAccounts.set(accountId, account);
    
    return {
      challengeAccount: account,
      fundedAccount,
      evaluationResult: {
        accountId: account.id,
        traderId: account.traderId,
        previousStatus: account.currentStatus,
        newStatus: account.currentStatus,
        previousLifecycleState: "CHALLENGE_PASSED",
        newLifecycleState: account.currentStatus === "PASSED" ? "EVALUATION_PASSED" : 
                         account.currentStatus === "BREACHED" ? "CHALLENGE_BREACHED" : 
                         "CHALLENGE_EXPIRED",
        triggeredBy: "CHALLENGE_COMPLETION",
        reason: `Challenge ${account.currentStatus.toLowerCase()}`,
        ruleViolations: [],
        timestamp: new Date().toISOString()
      }
    };
  }
  
  // ============================================================================
  // FUNDED ACCOUNT MANAGEMENT
  // ============================================================================
  
  /**
   * Get funded account
   */
  getFundedAccount(accountId: string): FundedAccount | undefined {
    return this.fundedAccounts.get(accountId);
  }
  
  /**
   * Get funded accounts for trader
   */
  getTraderFundedAccounts(traderId: string): FundedAccount[] {
    return Array.from(this.fundedAccounts.values())
      .filter(acc => acc.traderId === traderId);
  }
  
  /**
   * Update funded account from MT5 event
   */
  processFundedEvent(
    event: TradingEvent,
    accountId: string
  ): FundedAccount | undefined {
    const account = this.fundedAccounts.get(accountId);
    if (!account) return undefined;
    
    // Validate event belongs to account
    if (event.accountId !== accountId) {
      throw new Error(`Event accountId ${event.accountId} does not match funded account ${accountId}`);
    }
    
    // Evaluate the event
    const evaluationResult = this.evaluationEngine.evaluateFundedAccount(event, account);
    
    // Update account in map
    this.fundedAccounts.set(accountId, account);
    
    // Record significant events in ledger
    this.recordFundedLedgerEvents(account, evaluationResult);
    
    return account;
  }
  
  /**
   * Process scaling request
   */
  processScalingRequest(
    accountId: string,
    approved: boolean,
    adminNotes?: string
  ): FundedAccount | undefined {
    const account = this.fundedAccounts.get(accountId);
    if (!account) return undefined;
    
    // This would need the scaling plan from configuration
    // For now, we will create a default one
    const scalingPlan: ScalingPlan = {
      id: "default_scaling",
      name: "Default Scaling Plan",
      levels: [
        {
          level: 1,
          name: "Level 1",
          accountSize: 10000,
          requiredProfitPct: 0,
          maxDrawdownPct: 10,
          profitSplitTraderPct: 80,
          profitSplitFirmPct: 20
        },
        {
          level: 2,
          name: "Level 2",
          accountSize: 25000,
          requiredProfitPct: 10,
          requiredConsistencyMonths: 1,
          maxDrawdownPct: 10,
          profitSplitTraderPct: 80,
          profitSplitFirmPct: 20
        },
        {
          level: 3,
          name: "Level 3",
          accountSize: 50000,
          requiredProfitPct: 20,
          requiredConsistencyMonths: 2,
          maxDrawdownPct: 10,
          profitSplitTraderPct: 80,
          profitSplitFirmPct: 20
        },
        {
          level: 4,
          name: "Level 4",
          accountSize: 100000,
          requiredProfitPct: 30,
          requiredConsistencyMonths: 3,
          maxDrawdownPct: 10,
          profitSplitTraderPct: 80,
          profitSplitFirmPct: 20
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const updatedAccount = this.evaluationEngine.processScaling(account, scalingPlan, approved, adminNotes);
    this.fundedAccounts.set(accountId, updatedAccount);
    
    // Record ledger entry for scaling
    if (approved) {
      this.recordLedgerEntry({
        entryType: "OPERATIONAL_ADJUSTMENT",
        traderId: account.traderId,
        accountId,
        amount: 0, // Scaling itself does not create immediate P&L
        description: `Account scaled to level ${updatedAccount.scalingLevel}`,
        referenceId: account.id,
        referenceType: "FUNDED_ACCOUNT"
      });
    }
    
    return updatedAccount;
  }
  
  /**
   * Request payout from funded account
   */
  requestPayout(
    accountId: string,
    requestedAmount: number,
    paymentMethod: "BANK_TRANSFER" | "PAYPAL" | "CRYPTO" | "WIRE"
  ): { 
    fundedAccount: FundedAccount;
    payoutRequest: any 
  } | undefined {
    const account = this.fundedAccounts.get(accountId);
    if (!account) return undefined;
    
    // Validate account can request payout
    if (account.currentStatus !== "ACTIVE" && account.currentStatus !== "SCALING_APPROVED") {
      throw new Error(`Cannot request payout from account in status ${account.currentStatus}`);
    }
    
    const payoutResult = this.evaluationEngine.requestPayout(
      account,
      requestedAmount,
      paymentMethod
    );
    
    this.fundedAccounts.set(accountId, account);
    
    // Record ledger entry for payout request
    this.recordLedgerEntry({
      entryType: "TRADER_PAYOUT",
      traderId: account.traderId,
      accountId,
      amount: -payoutResult.approvedAmount, // Negative = payout expense
      description: `Payout request: ${payoutResult.approvedAmount} USD`,
      referenceId: payoutResult.id,
      referenceType: "PAYOUT_REQUEST"
    });
    
    return {
      fundedAccount: account,
      payoutRequest: payoutResult
    };
  }
  
  /**
   * Approve payout
   */
  approvePayout(
    payoutId: string,
    approvedBy: string,
    notes?: string
  ): any | undefined {
    // In a real implementation, we would look up the payout request
    // For now, return undefined as this requires payout storage
    return undefined;
  }
  
  /**
   * Complete payout
   */
  completePayout(
    payoutId: string,
    paymentReference: string,
    paymentFee: number = 0
  ): any | undefined {
    // In a real implementation, we would look up the payout request
    // For now, return undefined as this requires payout storage
    return undefined;
  }
  
  // ============================================================================
  // FINANCIAL LEDGER
  // ============================================================================
  
  /**
   * Record ledger entry
   */
    private recordLedgerEntry(entry: Omit<LedgerEntry, "id" | "createdAt" | "currency" | "createdBy" | "isReconciled">): LedgerEntry {
      const now = new Date().toISOString();
      const ledgerEntry: LedgerEntry = {
        id: `ledger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...entry,
        currency: "USD",
        createdAt: now,
        createdBy: "SYSTEM", // Would be user/system ID in production
        isReconciled: false
      };

      this.ledgerEntries.push(ledgerEntry);

      // Keep ledger manageable (in production, this would be archived)
      if (this.ledgerEntries.length > 100000) {
        this.ledgerEntries = this.ledgerEntries.slice(-50000); // Keep last 50k
      }

      return ledgerEntry;
    }
  
  /**
   * Record challenge-specific ledger events
   */
  private recordChallengeLedgerEvents(
    account: ChallengeAccount,
    evaluationResult: any
  ): void {
    // Record breaches as operational adjustments (refunds, etc.)
    const breaches = evaluationResult.ruleViolations.filter((v: any) => v.severity === "BREACH");
    if (breaches.length > 0 && evaluationResult.newStatus === "BREACHED") {
      this.recordLedgerEntry({
        entryType: "OPERATIONAL_ADJUSTMENT",
        traderId: account.traderId,
        accountId: account.id,
        amount: 0, // No immediate financial impact from breach
        description: `Challenge breached: ${breaches.map((b: any) => b.message).join("; ")}`,
        referenceId: account.id,
        referenceType: "CHALLENGE_ACCOUNT"
      });
    }
  }
  
  /**
   * Record funded account-specific ledger events
   */
  private recordFundedLedgerEvents(
    account: FundedAccount,
    evaluationResult: any
  ): void {
    // Record breaches
    const breaches = evaluationResult.ruleViolations.filter((v: any) => v.severity === "BREACH");
    if (breaches.length > 0 && evaluationResult.newStatus === "BREACHED") {
      this.recordLedgerEntry({
        entryType: "OPERATIONAL_ADJUSTMENT",
        traderId: account.traderId,
        accountId: account.id,
        amount: 0,
        description: `Funded account breached: ${breaches.map((b: any) => b.message).join("; ")}`,
        referenceId: account.id,
        referenceType: "FUNDED_ACCOUNT"
      });
    }
  }
  
  /**
   * Get ledger entries for trader
   */
  getTraderLedgerEntries(traderId: string, limit: number = 100): LedgerEntry[] {
    return this.ledgerEntries
      .filter(entry => entry.traderId === traderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
  
  /**
   * Get ledger entries by type
   */
  getLedgerEntriesByType(type: LedgerEntryType, limit: number = 100): LedgerEntry[] {
    return this.ledgerEntries
      .filter(entry => entry.entryType === type)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
  
  /**
   * Get financial summary for trader
   */
  getTraderFinancialSummary(traderId: string): {
    totalRevenue: number;
    totalExpenses: number;
    netRevenue: number;
    challengeRevenue: number;
    resetRevenue: number;
    subscriptionRevenue: number;
    profitShareRevenue: number;
    payoutExpenses: number;
    otherExpenses: number;
    entryCount: number;
  } {
    const entries = this.ledgerEntries.filter(e => e.traderId === traderId);
    
    let totalRevenue = 0;
    let totalExpenses = 0;
    let challengeRevenue = 0;
    let resetRevenue = 0;
    let subscriptionRevenue = 0;
    let profitShareRevenue = 0;
    let payoutExpenses = 0;
    let otherExpenses = 0;
    
    for (const entry of entries) {
      if (entry.amount > 0) {
        totalRevenue += entry.amount;
        switch (entry.entryType) {
          case "CHALLENGE_PURCHASE":
            challengeRevenue += entry.amount;
            break;
          case "CHALLENGE_RESET":
            resetRevenue += entry.amount;
            break;
          case "SUBSCRIPTION_PRO":
          case "SUBSCRIPTION_QUANT":
            subscriptionRevenue += entry.amount;
            break;
          case "PROFIT_SHARE_FIRM":
            profitShareRevenue += entry.amount;
            break;
        }
      } else {
        totalExpenses += Math.abs(entry.amount);
        switch (entry.entryType) {
          case "TRADER_PAYOUT":
            payoutExpenses += Math.abs(entry.amount);
            break;
          default:
            otherExpenses += Math.abs(entry.amount);
            break;
        }
      }
    }
    
    return {
      totalRevenue,
      totalExpenses,
      netRevenue: totalRevenue - totalExpenses,
      challengeRevenue,
      resetRevenue,
      subscriptionRevenue,
      profitShareRevenue,
      payoutExpenses,
      otherExpenses,
      entryCount: entries.length
    };
  }
  
  /**
   * Get financial summary for firm (aggregate)
   */
  getFirmFinancialSummary(periodStart?: string, periodEnd?: string): {
    totalRevenue: number;
    totalExpenses: number;
    netRevenue: number;
    challengeRevenue: number;
    resetRevenue: number;
    subscriptionRevenue: number;
    profitShareRevenue: number;
    payoutExpenses: number;
    otherExpenses: number;
    activeTraders: number;
    activeChallenges: number;
    activeFundedAccounts: number;
    entryCount: number;
  } {
    let entries = this.ledgerEntries;
    
    if (periodStart) {
      entries = entries.filter(e => new Date(e.createdAt) >= new Date(periodStart));
    }
    if (periodEnd) {
      entries = entries.filter(e => new Date(e.createdAt) <= new Date(periodEnd));
    }
    
    let totalRevenue = 0;
    let totalExpenses = 0;
    let challengeRevenue = 0;
    let resetRevenue = 0;
    let subscriptionRevenue = 0;
    let profitShareRevenue = 0;
    let payoutExpenses = 0;
    let otherExpenses = 0;
    
    for (const entry of entries) {
      if (entry.amount > 0) {
        totalRevenue += entry.amount;
        switch (entry.entryType) {
          case "CHALLENGE_PURCHASE":
            challengeRevenue += entry.amount;
            break;
          case "CHALLENGE_RESET":
            resetRevenue += entry.amount;
            break;
          case "SUBSCRIPTION_PRO":
          case "SUBSCRIPTION_QUANT":
            subscriptionRevenue += entry.amount;
            break;
          case "PROFIT_SHARE_FIRM":
            profitShareRevenue += entry.amount;
            break;
        }
      } else {
        totalExpenses += Math.abs(entry.amount);
        switch (entry.entryType) {
          case "TRADER_PAYOUT":
            payoutExpenses += Math.abs(entry.amount);
            break;
          default:
            otherExpenses += Math.abs(entry.amount);
            break;
        }
      }
    }
    
    const activeChallenges = Array.from(this.challengeAccounts.values())
      .filter(a => ["ACTIVE", "WARNING", "AT_RISK"].includes(a.currentStatus)).length;
    const activeFundedAccounts = Array.from(this.fundedAccounts.values())
      .filter(a => ["ACTIVE", "WARNING", "AT_RISK", "SCALING_PENDING", "SCALING_APPROVED", "PAYOUT_PENDING", "PAYOUT_PROCESSING"].includes(a.currentStatus)).length;
    const activeTraders = new Set([
      ...Array.from(this.challengeAccounts.values()).map(a => a.traderId),
      ...Array.from(this.fundedAccounts.values()).map(a => a.traderId)
    ]).size;
    
    return {
      totalRevenue,
      totalExpenses,
      netRevenue: totalRevenue - totalExpenses,
      challengeRevenue,
      resetRevenue,
      subscriptionRevenue,
      profitShareRevenue,
      payoutExpenses,
      otherExpenses,
      activeTraders,
      activeChallenges,
      activeFundedAccounts,
      entryCount: entries.length
    };
  }
  
  /**
   * Get all active challenges
   */
  getActiveChallenges(): ChallengeAccount[] {
    return Array.from(this.challengeAccounts.values())
      .filter(a => ["ACTIVE", "WARNING", "AT_RISK"].includes(a.currentStatus));
  }
  
  /**
   * Get all active funded accounts
   */
  getActiveFundedAccounts(): FundedAccount[] {
    return Array.from(this.fundedAccounts.values())
      .filter(a => ["ACTIVE", "WARNING", "AT_RISK", "SCALING_PENDING", "SCALING_APPROVED", "PAYOUT_PENDING", "PAYOUT_PROCESSING"].includes(a.currentStatus));
  }
  
  /**
   * Get account by MT5 login (for MT5 integration)
   */
  getAccountByMt5Login(mt5Login: number, mt5Server: string): ChallengeAccount | FundedAccount | undefined {
    for (const account of this.challengeAccounts.values()) {
      if (account.mt5Login === mt5Login && account.mt5Server === mt5Server) {
        return account;
      }
    }
    for (const account of this.fundedAccounts.values()) {
      if (account.mt5Login === mt5Login && account.mt5Server === mt5Server) {
        return account;
      }
    }
    return undefined;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let accountEngineInstance: AccountEngine | null = null;

export function getAccountEngine(): AccountEngine {
  if (!accountEngineInstance) {
    accountEngineInstance = new AccountEngine();
  }
  return accountEngineInstance;
}

export function resetAccountEngine(): void {
  accountEngineInstance = null;
}
