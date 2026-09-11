import type { NextApiRequest, NextApiResponse } from "next";
import {
  FundedAccount,
  FundedAccountStatus,
  PayoutRequest,
  PayoutStatus,
  TradingEvent,
  ScalingPlan,
  ScalingLevel
} from "@/lib/workfusion/prop-firm";
import { getAccountEngine, AccountEngine } from "@/lib/workfusion/prop-firm/account-engine";
import { getEvaluationEngine } from "@/lib/workfusion/prop-firm/evaluation-engine";
import { getSession } from "@/lib/workfusion/session";

// ============================================================================
// MOCK SCALING PLANS (would be from database in production)
// ============================================================================

const scalingPlans: ScalingPlan[] = [
  {
    id: "default_scaling",
    name: "Default Scaling Plan",
    levels: [
      {
        level: 1,
        name: "Level 1 - $10K",
        accountSize: 10000,
        requiredProfitPct: 0,
        maxDrawdownPct: 10,
        profitSplitTraderPct: 80,
        profitSplitFirmPct: 20
      },
      {
        level: 2,
        name: "Level 2 - $25K",
        accountSize: 25000,
        requiredProfitPct: 10,
        requiredConsistencyMonths: 1,
        maxDrawdownPct: 10,
        profitSplitTraderPct: 80,
        profitSplitFirmPct: 20
      },
      {
        level: 3,
        name: "Level 3 - $50K",
        accountSize: 50000,
        requiredProfitPct: 20,
        requiredConsistencyMonths: 2,
        maxDrawdownPct: 10,
        profitSplitTraderPct: 80,
        profitSplitFirmPct: 20
      },
      {
        level: 4,
        name: "Level 4 - $100K",
        accountSize: 100000,
        requiredProfitPct: 30,
        requiredConsistencyMonths: 3,
        maxDrawdownPct: 10,
        profitSplitTraderPct: 80,
        profitSplitFirmPct: 20
      },
      {
        level: 5,
        name: "Level 5 - $250K",
        accountSize: 250000,
        requiredProfitPct: 50,
        requiredConsistencyMonths: 6,
        maxDrawdownPct: 10,
        profitSplitTraderPct: 85,
        profitSplitFirmPct: 15
      },
      {
        level: 6,
        name: "Level 6 - $500K",
        accountSize: 500000,
        requiredProfitPct: 75,
        requiredConsistencyMonths: 12,
        maxDrawdownPct: 10,
        profitSplitTraderPct: 85,
        profitSplitFirmPct: 15
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSessionUser(req: NextApiRequest): { id: string; email: string } | null {
  const session = getSession(req);
  if (!session) return null;
  return { id: session, email: "trader@example.com" };
}

function getAccountEngineInstance(): AccountEngine {
  return getAccountEngine();
}

function getEvaluationEngineInstance() {
  return getEvaluationEngine();
}

// ============================================================================
// API HANDLER
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = getSessionUser(req);
  
  if (!user && req.method !== "GET") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const { method, query, body } = req;
  const accountId = query.accountId as string;
  
  try {
    switch (method) {
      case "GET":
        return handleGet(req, res, accountId);
      case "POST":
        return handlePost(req, res, user.id);
      case "PUT":
        return handlePut(req, res, accountId, user.id);
      case "DELETE":
        return handleDelete(req, res, accountId, user.id);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Funded API error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// ============================================================================
// GET - List funded accounts or get specific account
// ============================================================================

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  accountId?: string
) {
  const accountEngine = getAccountEngineInstance();
  
  if (accountId) {
    // Get specific funded account
    const account = accountEngine.getFundedAccount(accountId);
    if (!account) {
      return res.status(404).json({ error: "Funded account not found" });
    }
    
    // Get evaluation summary
    const summary = getEvaluationEngineInstance().getEvaluationSummary(account);
    
    // Get performance metrics if period specified
    const { periodStart, periodEnd } = req.query;
    let performance = null;
    if (periodStart && periodEnd) {
      // In production, this would use the performance engine
      performance = { message: "Performance metrics would be calculated here" };
    }
    
    return res.status(200).json({ 
      fundedAccount: account,
      evaluation: summary,
      performance
    });
  }
  
  // List all funded accounts for user
  const { status, traderId } = req.query;
  
  let accounts = accountEngine.getTraderFundedAccounts(traderId as string || user.id);
  
  if (status) {
    accounts = accounts.filter(a => a.currentStatus === status);
  }
  
  // Add evaluation summaries
  const accountsWithSummary = accounts.map(account => ({
    ...account,
    evaluation: getEvaluationEngineInstance().getEvaluationSummary(account)
  }));
  
  return res.status(200).json({ 
    fundedAccounts: accountsWithSummary,
    count: accountsWithSummary.length
  });
}

// ============================================================================
// POST - Request payout or process MT5 event
// ============================================================================

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { action, accountId, requestedAmount, paymentMethod, event } = req.body;
  
  const accountEngine = getAccountEngineInstance();
  
  if (action === "payout") {
    // Request payout from funded account
    if (!accountId) {
      return res.status(400).json({ error: "accountId is required" });
    }
    
    const account = accountEngine.getFundedAccount(accountId);
    if (!account) {
      return res.status(404).json({ error: "Funded account not found" });
    }
    
    // Verify ownership
    if (account.traderId !== userId) {
      return res.status(403).json({ error: "Not authorized to request payout from this account" });
    }
    
    if (!requestedAmount || requestedAmount <= 0) {
      return res.status(400).json({ error: "requestedAmount must be positive" });
    }
    
    if (!paymentMethod) {
      return res.status(400).json({ error: "paymentMethod is required" });
    }
    
    const result = accountEngine.requestPayout(
      accountId,
      requestedAmount,
      paymentMethod
    );
    
    if (!result) {
      return res.status(500).json({ error: "Failed to process payout request" });
    }
    
    return res.status(200).json({
      success: true,
      fundedAccount: result.fundedAccount,
      payoutRequest: result.payoutRequest,
      message: `Payout request submitted for ${result.payoutRequest.approvedAmount} USD`
    });
  }
  
  if (action === "process_event") {
    // Process MT5 trading event
    if (!accountId) {
      return res.status(400).json({ error: "accountId is required" });
    }
    
    if (!event) {
      return res.status(400).json({ error: "event is required" });
    }
    
    const account = accountEngine.getFundedAccount(accountId);
    if (!account) {
      return res.status(404).json({ error: "Funded account not found" });
    }
    
    // Verify ownership
    if (account.traderId !== userId) {
      return res.status(403).json({ error: "Not authorized to process events for this account" });
    }
    
    const updatedAccount = accountEngine.processFundedEvent(event, accountId);
    
    if (!updatedAccount) {
      return res.status(500).json({ error: "Failed to process event" });
    }
    
    const summary = getEvaluationEngineInstance().getEvaluationSummary(updatedAccount);
    
    return res.status(200).json({
      success: true,
      fundedAccount: updatedAccount,
      evaluation: summary
    });
  }
  
  return res.status(400).json({ error: "Invalid action. Use payout or process_event" });
}

// ============================================================================
// PUT - Update funded account (scaling, admin actions)
// ============================================================================

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  accountId?: string,
  userId?: string
) {
  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }
  
  const accountEngine = getAccountEngineInstance();
  const account = accountEngine.getFundedAccount(accountId);
  
  if (!account) {
    return res.status(404).json({ error: "Funded account not found" });
  }
  
  // Verify ownership
  if (account.traderId !== userId) {
    return res.status(403).json({ error: "Not authorized to modify this account" });
  }
  
  const { action } = req.body;
  
  if (action === "scaling_request") {
    // Request scaling review
    const scalingPlan = scalingPlans[0];
    const nextLevel = scalingPlan.levels.find(l => l.level === account.scalingLevel + 1);
    
    if (!nextLevel) {
      return res.status(400).json({ error: "Already at maximum scaling level" });
    }
    
    // Check eligibility
    const totalReturnPct = ((account.currentEquity - account.allocatedCapital) / account.allocatedCapital) * 100;
    if (totalReturnPct < nextLevel.requiredProfitPct) {
      return res.status(400).json({ 
        error: "Not yet eligible for scaling",
        requiredProfitPct: nextLevel.requiredProfitPct,
        currentProfitPct: totalReturnPct
      });
    }
    
    // Check consistency months if required
    if (nextLevel.requiredConsistencyMonths) {
      // In production, this would check actual trading history
      // For now, we will allow the request
    }
    
    account.scalingRequestedAt = new Date().toISOString();
    account.currentStatus = "SCALING_PENDING";
    account.statusChangedAt = new Date().toISOString();
    account.updatedAt = new Date().toISOString();
    
    accountEngine.fundedAccounts.set(accountId, account);
    
    return res.status(200).json({
      success: true,
      fundedAccount: account,
      message: `Scaling request submitted for ${nextLevel.name}`,
      nextLevel
    });
  }
  
  return res.status(400).json({ error: "Invalid action" });
}

// ============================================================================
// DELETE - Not typically used for funded accounts
// ============================================================================

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  accountId?: string,
  userId?: string
) {
  return res.status(405).json({ error: "Funded accounts cannot be deleted" });
}

// ============================================================================
// ADMIN ENDPOINTS (would be separate in production)
// ============================================================================

// Admin: Approve/reject scaling
// POST /api/prop-firm/funded/admin/scaling
// { accountId, approved, adminNotes }

// Admin: Approve/reject payout
// POST /api/prop-firm/funded/admin/payout
// { payoutId, approved, adminNotes }

// Admin: Get all funded accounts
// GET /api/prop-firm/funded/admin
// ?status=&page=&limit=
