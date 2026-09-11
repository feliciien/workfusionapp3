
import type { NextApiRequest, NextApiResponse } from "next";
import {
  ChallengeConfiguration,
  ChallengeTier,
  TraderProfile,
  ChallengeAccount,
  ChallengeAccountStatus,
  RuleViolation
} from "@/lib/workfusion/prop-firm";
import { getAccountEngine, AccountEngine } from "@/lib/workfusion/prop-firm/account-engine";
import { getEvaluationEngine } from "@/lib/workfusion/prop-firm/evaluation-engine";
import { getRuleEngine } from "@/lib/workfusion/prop-firm/rule-engine";
import { getRiskEngine } from "@/lib/workfusion/prop-firm/risk-engine";
import { getSession } from "@/lib/workfusion/session";
import { challengeConfigurations, getChallengeConfig, getActiveChallenges } from "@/lib/workfusion/prop-firm/challenge-config";

// ============================================================================
// API HANDLER
// ============================================================================

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = getSession(req);
    const userId = session.authenticated ? session.id : "anonymous";
    const user = {
      id: userId,
      email: session.email,
      role: session.role,
    };

    const { challengeId } = req.query;

    switch (req.method) {
      case "GET":
        return handleGet(req, res, challengeId as string);
      case "POST":
        return handlePost(req, res, user.id);
      case "PUT":
        return handlePut(req, res, challengeId as string, user.id);
      case "DELETE":
        return handleDelete(req, res, challengeId as string, user.id);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Challenges API error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ============================================================================
// GET - List challenges or get specific challenge
// ============================================================================

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  challengeId?: string
) {
  if (challengeId) {
    const config = getChallengeConfig(challengeId);
    if (!config) {
      return res.status(404).json({ error: "Challenge not found" });
    }
    return res.status(200).json({ challenge: config });
  }

  const activeOnly = req.query.active === "true";
  const challenges = activeOnly ? getActiveChallenges() : challengeConfigurations;

  return res.status(200).json({ challenges, count: challenges.length });
}

// ============================================================================
// POST - Purchase challenge or create challenge account
// ============================================================================

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { action, challengeId, mt5Login, mt5Server } = req.body;

  const accountEngine = getAccountEngine();

  if (action === "purchase") {
    // Purchase a challenge
    if (!challengeId) {
      return res.status(400).json({ error: "challengeId is required" });
    }

    const config = getChallengeConfig(challengeId);
    if (!config) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    if (!config.isActive) {
      return res.status(400).json({ error: "Challenge is not active" });
    }

    // Validate MT5 credentials provided
    if (!mt5Login || !mt5Server) {
      return res.status(400).json({
        error: "MT5 credentials required",
        required: ["mt5Login", "mt5Server"],
      });
    }

    // Get or create trader profile
    let trader = accountEngine.getTraderProfile(userId);
    if (!trader) {
      // Create new trader profile (in production, this would come from auth)
      trader = accountEngine.createTraderProfile(
        user.email || "trader@example.com",
        "Trader",
        "User",
        "US"
      );
    }

    // Create challenge account
    const challengeAccount = accountEngine.createChallengeAccount(
      trader.id,
      config,
      mt5Login,
      mt5Server
    );

    if (!challengeAccount) {
      return res.status(500).json({ error: "Failed to create challenge account" });
    }

    return res.status(201).json({
      success: true,
      challengeAccount,
      message: `Challenge purchased: ${config.name}`,
    });
  }

  if (action === "reset") {
    // Reset a challenge account
    if (!challengeId) {
      return res.status(400).json({ error: "challengeId is required" });
    }

    const account = accountEngine.getChallengeAccount(challengeId);
    if (!account) {
      return res.status(404).json({ error: "Challenge account not found" });
    }

    // Verify ownership
    if (account.traderId !== userId) {
      return res.status(403).json({ error: "Not authorized to reset this challenge" });
    }

    const config = getChallengeConfig(account.challengeConfigId);
    if (!config || !config.resetPrice) {
      return res.status(400).json({ error: "Reset not available for this challenge" });
    }

    const resetAccount = accountEngine.resetChallengeAccount(challengeId, config.resetPrice);

    if (!resetAccount) {
      return res.status(500).json({ error: "Failed to reset challenge account" });
    }

    return res.status(200).json({
      success: true,
      challengeAccount: resetAccount,
      message: `Challenge reset: ${config.name}`,
    });
  }

  return res.status(400).json({ error: "Invalid action. Use purchase or reset" });
}

// ============================================================================
// PUT - Update challenge account status or process MT5 event
// ============================================================================

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  challengeId?: string,
  userId?: string
) {
  if (!challengeId) {
    return res.status(400).json({ error: "challengeId is required" });
  }

  const accountEngine = getAccountEngine();
  const account = accountEngine.getChallengeAccount(challengeId);

  if (!account) {
    return res.status(404).json({ error: "Challenge account not found" });
  }

  // Verify ownership
  if (account.traderId !== userId) {
    return res.status(403).json({ error: "Not authorized to modify this challenge" });
  }

  const { action, event } = req.body;
  const config = getChallengeConfig(account.challengeConfigId);

  if (!config) {
    return res.status(500).json({ error: "Challenge configuration not found" });
  }

  if (action === "process_event" && event) {
    // Process MT5 trading event
    const evaluationEngine = getEvaluationEngine();
    const result = evaluationEngine.processEvent(account, event);

    if (result) {
      accountEngine.updateChallengeAccount(account.id, {
        currentBalance: account.currentBalance,
        currentEquity: account.currentEquity,
        floatingPL: account.floatingPL,
        dailyRealizedPL: account.dailyRealizedPL,
        totalRealizedPL: account.totalRealizedPL,
        dailyDrawdownPct: account.dailyDrawdownPct,
        totalDrawdownPct: account.totalDrawdownPct,
        maxDailyDrawdownPct: account.maxDailyDrawdownPct,
        maxTotalDrawdownPct: account.maxTotalDrawdownPct,
        tradingDaysCount: account.tradingDaysCount,
        tradesToday: account.tradesToday,
        totalTrades: account.totalTrades,
        lastTradeAt: account.lastTradeAt,
        openPositions: account.openPositions,
        totalExposure: account.totalExposure,
        maxExposureReached: account.maxExposureReached,
        ruleViolations: account.ruleViolations,
        currentStatus: account.currentStatus,
        statusChangedAt: account.statusChangedAt,
        completedAt: account.completedAt,
        currentPhase: account.currentPhase,
        phaseStartedAt: account.phaseStartedAt,
      });

      return res.status(200).json({
        success: true,
        evaluationResult: result,
        message: `Event processed. Status: ${account.currentStatus}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event processed. No state change.",
    });
  }

  if (action === "complete") {
    // Complete challenge (manual or auto)
    const result = accountEngine.completeChallenge(account.id, config.scalingPlan);

    if (result) {
      return res.status(200).json({
        success: true,
        result,
        message: `Challenge completed: ${result.challengeAccount.currentStatus}`,
      });
    }

    return res.status(500).json({ error: "Failed to complete challenge" });
  }

  return res.status(400).json({ error: "Invalid action. Use process_event or complete" });
}

// ============================================================================
// DELETE - Delete challenge account (admin only)
// ============================================================================

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  challengeId?: string,
  userId?: string
) {
  if (!challengeId) {
    return res.status(400).json({ error: "challengeId is required" });
  }

  // In production, verify admin role
  const session = getSession(req);
  if (!session.authenticated || session.role !== "owner") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const accountEngine = getAccountEngine();
  const deleted = accountEngine.deleteChallengeAccount(challengeId);

  if (!deleted) {
    return res.status(404).json({ error: "Challenge account not found" });
  }

  return res.status(200).json({
    success: true,
    message: "Challenge account deleted",
  });
}

