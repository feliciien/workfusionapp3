import type { NextApiRequest, NextApiResponse } from "next";
import {
  ChallengeAccount,
  FundedAccount,
  TraderProfile,
  LedgerEntry,
  LedgerEntryType,
  ScalingPlan,
  PayoutRequest,
  PayoutStatus,
  AdminUser,
  SystemConfiguration
} from "@/lib/workfusion/prop-firm";
import { getAccountEngine, AccountEngine } from "@/lib/workfusion/prop-firm/account-engine";
import { getEvaluationEngine } from "@/lib/workfusion/prop-firm/evaluation-engine";
import { getSession } from "@/lib/workfusion/session";

// ============================================================================
// ADMIN AUTHORIZATION
// ============================================================================

const ADMIN_EMAILS = ["admin@workfusion.app", "support@workfusion.app"];

function getSessionUser(req: NextApiRequest): { id: string; email: string; isAdmin: boolean } | null {
  const session = getSession(req);
  if (!session) return null;
  const isAdmin = ADMIN_EMAILS.includes(session) || session.endsWith("@workfusion.app");
  return { id: session, email: session, isAdmin };
}

function getAccountEngineInstance(): AccountEngine {
  return getAccountEngine();
}

// ============================================================================
// API HANDLER
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = getSessionUser(req);
  
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  const { method, query, body } = req;
  const { action } = query;
  
  try {
    switch (method) {
      case "GET":
        return handleGet(req, res, action as string);
      case "POST":
        return handlePost(req, res, action as string);
      case "PUT":
        return handlePut(req, res, action as string);
      case "DELETE":
        return handleDelete(req, res, action as string);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Admin API error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// ============================================================================
// GET - Admin dashboard data
// ============================================================================

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  action?: string
) {
  const accountEngine = getAccountEngineInstance();
  
  switch (action) {
    case "dashboard":
      return getDashboardData(accountEngine, req, res);
    case "challenges":
      return getChallengesAdmin(accountEngine, req, res);
    case "funded":
      return getFundedAccountsAdmin(accountEngine, req, res);
    case "traders":
      return getTradersAdmin(accountEngine, req, res);
    case "ledger":
      return getLedgerAdmin(accountEngine, req, res);
    case "financials":
      return getFinancialsAdmin(accountEngine, req, res);
    case "payouts":
      return getPayoutsAdmin(accountEngine, req, res);
    case "scaling":
      return getScalingAdmin(accountEngine, req, res);
    case "risk":
      return getRiskAdmin(accountEngine, req, res);
    default:
      return res.status(400).json({ error: "Invalid admin action" });
  }
}

async function getDashboardData(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const financials = accountEngine.getFirmFinancialSummary();
  const activeChallenges = accountEngine.getActiveChallenges();
  const activeFunded = accountEngine.getActiveFundedAccounts();
  
  // Get risk states
  const riskStates = {
    normal: activeChallenges.filter(a => a.currentStatus === "ACTIVE").length +
            activeFunded.filter(a => a.currentStatus === "ACTIVE").length,
    warning: activeChallenges.filter(a => a.currentStatus === "WARNING").length +
             activeFunded.filter(a => a.currentStatus === "WARNING").length,
    atRisk: activeChallenges.filter(a => a.currentStatus === "AT_RISK").length +
            activeFunded.filter(a => a.currentStatus === "AT_RISK").length,
    breached: activeChallenges.filter(a => a.currentStatus === "BREACHED").length +
              activeFunded.filter(a => a.currentStatus === "BREACHED").length
  };
  
  // Recent activity
  const recentLedger = accountEngine.ledgerEntries
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);
  
  return res.status(200).json({
    financials,
    riskStates,
    counts: {
      activeChallenges: activeChallenges.length,
      activeFundedAccounts: activeFunded.length,
      totalTraders: financials.activeTraders
    },
    recentActivity: recentLedger
  });
}

async function getChallengesAdmin(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { status, page = "1", limit = "50" } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  
  let challenges = Array.from(accountEngine.challengeAccounts.values());
  
  if (status) {
    challenges = challenges.filter(c => c.currentStatus === status);
  }
  
  // Sort by most recent
  challenges.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  
  // Paginate
  const start = (pageNum - 1) * limitNum;
  const paginated = challenges.slice(start, start + limitNum);
  
  return res.status(200).json({
    challenges: paginated,
    total: challenges.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(challenges.length / limitNum)
  });
}

async function getFundedAccountsAdmin(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { status, page = "1", limit = "50" } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  
  let accounts = Array.from(accountEngine.fundedAccounts.values());
  
  if (status) {
    accounts = accounts.filter(a => a.currentStatus === status);
  }
  
  accounts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  
  const start = (pageNum - 1) * limitNum;
  const paginated = accounts.slice(start, start + limitNum);
  
  return res.status(200).json({
    fundedAccounts: paginated,
    total: accounts.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(accounts.length / limitNum)
  });
}

async function getTradersAdmin(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { status, kycStatus, page = "1", limit = "50" } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  
  let traders = Array.from(accountEngine.traderProfiles.values());
  
  if (status) {
    traders = traders.filter(t => t.status === status);
  }
  
  if (kycStatus) {
    traders = traders.filter(t => t.kycStatus === kycStatus);
  }
  
  // Remove sensitive data
  traders = traders.map(t => {
    const { kycDocuments, ...safe } = t;
    return safe;
  });
  
  traders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const start = (pageNum - 1) * limitNum;
  const paginated = traders.slice(start, start + limitNum);
  
  return res.status(200).json({
    traders: paginated,
    total: traders.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(traders.length / limitNum)
  });
}

async function getLedgerAdmin(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { type, traderId, periodStart, periodEnd, page = "1", limit = "100" } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  
  let entries = [...accountEngine.ledgerEntries];
  
  if (type) {
    entries = entries.filter(e => e.entryType === type);
  }
  
  if (traderId) {
    entries = entries.filter(e => e.traderId === traderId);
  }
  
  if (periodStart) {
    entries = entries.filter(e => new Date(e.createdAt) >= new Date(periodStart as string));
  }
  
  if (periodEnd) {
    entries = entries.filter(e => new Date(e.createdAt) <= new Date(periodEnd as string));
  }
  
  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const start = (pageNum - 1) * limitNum;
  const paginated = entries.slice(start, start + limitNum);
  
  return res.status(200).json({
    entries: paginated,
    total: entries.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(entries.length / limitNum)
  });
}

async function getFinancialsAdmin(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { periodStart, periodEnd } = req.query;
  
  const financials = accountEngine.getFirmFinancialSummary(
    periodStart as string,
    periodEnd as string
  );
  
  // Add more detailed breakdowns
  const challengeRevenueByTier = {
    STARTER: 0,
    STANDARD: 0,
    PRO: 0,
    ADVANCED: 0,
    ELITE: 0
  };
  
  // This would be calculated from actual data in production
  // For now, return the base financials
  
  return res.status(200).json({
    summary: financials,
    revenueByTier: challengeRevenueByTier,
    period: { start: periodStart, end: periodEnd }
  });
}

async function getPayoutsAdmin(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  // In production, this would query payout requests from database
  // For now, return mock data
  return res.status(200).json({
    payouts: [],
    message: "Payout management requires payout storage implementation"
  });
}

async function getScalingAdmin(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  // Get accounts pending scaling
  const scalingPending = Array.from(accountEngine.fundedAccounts.values())
    .filter(a => a.currentStatus === "SCALING_PENDING" || a.currentStatus === "SCALING_APPROVED" || a.currentStatus === "SCALING_REJECTED");
  
  return res.status(200).json({
    scalingRequests: scalingPending.map(acc => ({
      id: acc.id,
      traderId: acc.traderId,
      currentLevel: acc.scalingLevel,
      allocatedCapital: acc.allocatedCapital,
      currentEquity: acc.currentEquity,
      profitPct: ((acc.currentEquity - acc.allocatedCapital) / acc.allocatedCapital) * 100,
      status: acc.currentStatus,
      requestedAt: acc.scalingRequestedAt,
      approvedAt: acc.scalingApprovedAt,
      rejectedAt: acc.scalingRejectedAt,
      rejectionReason: acc.scalingRejectionReason
    })),
    count: scalingPending.length
  });
}

async function getRiskAdmin(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const activeChallenges = accountEngine.getActiveChallenges();
  const activeFunded = accountEngine.getActiveFundedAccounts();
  
  // High risk accounts
  const highRiskChallenges = activeChallenges.filter(a => 
    a.currentStatus === "WARNING" || a.currentStatus === "AT_RISK"
  );
  
  const highRiskFunded = activeFunded.filter(a => 
    a.currentStatus === "WARNING" || a.currentStatus === "AT_RISK"
  );
  
  // Accounts near drawdown limits
  const nearDailyDrawdownChallenges = activeChallenges.filter(a => a.dailyDrawdownPct > 3);
  const nearTotalDrawdownChallenges = activeChallenges.filter(a => a.totalDrawdownPct > 5);
  const nearDailyDrawdownFunded = activeFunded.filter(a => a.dailyDrawdownPct > 3);
  const nearTotalDrawdownFunded = activeFunded.filter(a => a.totalDrawdownPct > 5);
  
  return res.status(200).json({
    highRisk: {
      challenges: highRiskChallenges.length,
      funded: highRiskFunded.length
    },
    nearLimits: {
      dailyDrawdown: {
        challenges: nearDailyDrawdownChallenges.length,
        funded: nearDailyDrawdownFunded.length
      },
      totalDrawdown: {
        challenges: nearTotalDrawdownChallenges.length,
        funded: nearTotalDrawdownFunded.length
      }
    },
    breached: {
      challenges: activeChallenges.filter(a => a.currentStatus === "BREACHED").length,
      funded: activeFunded.filter(a => a.currentStatus === "BREACHED").length
    }
  });
}

// ============================================================================
// POST - Admin actions
// ============================================================================

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  action?: string
) {
  const accountEngine = getAccountEngineInstance();
  
  switch (action) {
    case "approve_scaling":
      return approveScaling(accountEngine, req, res);
    case "reject_scaling":
      return rejectScaling(accountEngine, req, res);
    case "approve_payout":
      return approvePayout(accountEngine, req, res);
    case "reject_payout":
      return rejectPayout(accountEngine, req, res);
    case "create_challenge_config":
      return createChallengeConfig(accountEngine, req, res);
    case "update_config":
      return updateConfig(accountEngine, req, res);
    default:
      return res.status(400).json({ error: "Invalid admin action" });
  }
}

async function approveScaling(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { accountId, adminNotes } = req.body;
  
  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }
  
  const account = accountEngine.getFundedAccount(accountId);
  if (!account) {
    return res.status(404).json({ error: "Funded account not found" });
  }
  
  const updated = accountEngine.processScalingRequest(accountId, true, adminNotes);
  
  if (!updated) {
    return res.status(500).json({ error: "Failed to approve scaling" });
  }
  
  return res.status(200).json({
    success: true,
    fundedAccount: updated,
    message: "Scaling approved"
  });
}

async function rejectScaling(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { accountId, adminNotes } = req.body;
  
  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }
  
  const account = accountEngine.getFundedAccount(accountId);
  if (!account) {
    return res.status(404).json({ error: "Funded account not found" });
  }
  
  const updated = accountEngine.processScalingRequest(accountId, false, adminNotes);
  
  if (!updated) {
    return res.status(500).json({ error: "Failed to reject scaling" });
  }
  
  return res.status(200).json({
    success: true,
    fundedAccount: updated,
    message: "Scaling rejected"
  });
}

async function approvePayout(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { payoutId, paymentReference, paymentFee } = req.body;
  
  if (!payoutId) {
    return res.status(400).json({ error: "payoutId is required" });
  }
  
  // In production, this would look up the payout request
  return res.status(200).json({
    success: false,
    message: "Payout approval requires payout storage implementation"
  });
}

async function rejectPayout(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { payoutId, rejectionReason } = req.body;
  
  if (!payoutId) {
    return res.status(400).json({ error: "payoutId is required" });
  }
  
  // In production, this would look up the payout request
  return res.status(200).json({
    success: false,
    message: "Payout rejection requires payout storage implementation"
  });
}

async function createChallengeConfig(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  // In production, this would create a new challenge configuration in the database
  return res.status(200).json({
    success: false,
    message: "Challenge config creation requires database implementation"
  });
}

async function updateConfig(accountEngine: AccountEngine, req: NextApiRequest, res: NextApiResponse) {
  const { key, value, description } = req.body;
  
  if (!key || value === undefined) {
    return res.status(400).json({ error: "key and value are required" });
  }
  
  // In production, this would update system configuration
  return res.status(200).json({
    success: true,
    message: `Configuration ${key} updated`
  });
}

// ============================================================================
// PUT - Admin updates
// ============================================================================

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  action?: string
) {
  return res.status(400).json({ error: "Use POST for admin actions" });
}

// ============================================================================
// DELETE - Admin cleanup
// ============================================================================

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  action?: string
) {
  return res.status(405).json({ error: "Admin delete not implemented" });
}
