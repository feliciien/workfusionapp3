import type { NextApiRequest, NextApiResponse } from "next";
import {
  TraderProfile,
  TraderLifecycleState,
  KycDocument,
  TraderPerformanceMetrics,
  QuantTalentCandidate
} from "@/lib/workfusion/prop-firm";
import { getAccountEngine, AccountEngine } from "@/lib/workfusion/prop-firm/account-engine";
import { getEvaluationEngine } from "@/lib/workfusion/prop-firm/evaluation-engine";
import { getPerformanceEngine } from "@/lib/workfusion/prop-firm/performance-engine";
import { getSession } from "@/lib/workfusion/session";

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

function getPerformanceEngineInstance() {
  return getPerformanceEngine();
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
  const traderId = query.traderId as string;
  
  try {
    switch (method) {
      case "GET":
        return handleGet(req, res, traderId);
      case "POST":
        return handlePost(req, res, user.id);
      case "PUT":
        return handlePut(req, res, traderId, user.id);
      case "DELETE":
        return handleDelete(req, res, traderId, user.id);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Trader API error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// ============================================================================
// GET - Get trader profile or specific data
// ============================================================================

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  traderId?: string
) {
  const accountEngine = getAccountEngineInstance();
  
  if (traderId) {
    // Get specific trader profile
    const profile = accountEngine.getTraderProfile(traderId);
    if (!profile) {
      return res.status(404).json({ error: "Trader not found" });
    }
    
    // Don't return sensitive info in list views
    const { kycDocuments, ...safeProfile } = profile;
    
    // Get lifecycle state
    const lifecycleState = getTraderLifecycleState(profile);
    
    // Get account summaries
    const challengeAccounts = accountEngine.getTraderChallengeAccounts(traderId);
    const fundedAccounts = accountEngine.getTraderFundedAccounts(traderId);
    
    // Get financial summary
    const financial = accountEngine.getTraderFinancialSummary(traderId);
    
    return res.status(200).json({ 
      trader: {
        ...safeProfile,
        lifecycleState,
        kycVerified: profile.kycStatus === "VERIFIED"
      },
      accounts: {
        challenges: challengeAccounts.map(acc => ({
          id: acc.id,
          status: acc.currentStatus,
          challengeName: acc.challengeConfig.name,
          progressPct: ((acc.currentEquity - acc.initialBalance) / acc.initialBalance) * 100
        })),
        funded: fundedAccounts.map(acc => ({
          id: acc.id,
          status: acc.currentStatus,
          allocatedCapital: acc.allocatedCapital,
          currentEquity: acc.currentEquity,
          profitPct: ((acc.currentEquity - acc.allocatedCapital) / acc.allocatedCapital) * 100
        }))
      },
      financial
    });
  }
  
  // Get trader's own profile
  const profile = accountEngine.getTraderProfile(user.id);
  if (!profile) {
    return res.status(404).json({ error: "Trader profile not found" });
  }
  
  // Return detailed profile for own view
  const { kycDocuments, ...safeProfile } = profile;
  const lifecycleState = getTraderLifecycleState(profile);
  
  return res.status(200).json({ 
    trader: {
      ...safeProfile,
      lifecycleState,
      kycDocuments
    }
  });
}

// ============================================================================
// POST - Update trader profile or subscription
// ============================================================================

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { action } = req.body;
  const accountEngine = getAccountEngineInstance();
  
  if (action === "update_profile") {
    // Update trader profile
    const { firstName, lastName, country, phone, dateOfBirth } = req.body;
    
    const updates: Partial<TraderProfile> = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (country !== undefined) updates.country = country;
    if (phone !== undefined) updates.phone = phone;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
    
    const updated = accountEngine.updateTraderProfile(userId, updates);
    if (!updated) {
      return res.status(404).json({ error: "Trader not found" });
    }
    
    return res.status(200).json({
      success: true,
      trader: updated,
      message: "Profile updated"
    });
  }
  
  if (action === "update_subscription") {
    // Update AI subscription
    const { tier, status } = req.body;
    let expiresAt: string | undefined;
    
    if (status === "ACTIVE" || status === "TRIALING") {
      // Set expiration based on tier
      const now = new Date();
      let months = 1; // Default 1 month
      
      if (tier === "PRO") months = 1;
      if (tier === "QUANT") months = 3;
      if (tier === "FREE") status = "ACTIVE"; // Free is always active
      
      now.setMonth(now.getMonth() + months);
      expiresAt = now.toISOString();
    }
    
    const updated = accountEngine.updateAiSubscription(userId, tier, status, expiresAt);
    if (!updated) {
      return res.status(404).json({ error: "Trader not found" });
    }
    
    return res.status(200).json({
      success: true,
      trader: updated,
      message: `Subscription updated to ${tier}`
    });
  }
  
  if (action === "kyc_upload") {
    // Upload KYC document
    const { documentType, fileUrl } = req.body;
    
    if (!documentType || !fileUrl) {
      return res.status(400).json({ error: "documentType and fileUrl are required" });
    }
    
    const kycDoc: KycDocument = {
      id: `kyc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: documentType as any,
      status: "PENDING",
      fileUrl,
      verifiedAt: undefined,
      rejectionReason: undefined
    };
    
    const updated = accountEngine.updateKycStatus(
      userId,
      "PENDING",
      [...(accountEngine.getTraderProfile(userId)?.kycDocuments || []), kycDoc]
    );
    
    if (!updated) {
      return res.status(404).json({ error: "Trader not found" });
    }
    
    return res.status(200).json({
      success: true,
      trader: updated,
      message: "KYC document uploaded - awaiting review"
    });
  }
  
  return res.status(400).json({ error: "Invalid action" });
}

// ============================================================================
// PUT - Update trader lifecycle or advanced actions
// ============================================================================

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  traderId?: string,
  userId?: string
) {
  const accountEngine = getAccountEngineInstance();
  const targetId = traderId || userId;
  
  if (targetId !== userId) {
    // Only allow updating own profile unless admin
    return res.status(403).json({ error: "Not authorized" });
  }
  
  const { action } = req.body;
  
  if (action === "refresh_lifecycle") {
    // Refresh lifecycle state based on current accounts
    const profile = accountEngine.getTraderProfile(targetId);
    if (!profile) {
      return res.status(404).json({ error: "Trader not found" });
    }
    
    const lifecycleState = getTraderLifecycleState(profile);
    const updated = accountEngine.updateTraderProfile(targetId, {
      lifecycleState
    });
    
    return res.status(200).json({
      success: true,
      trader: updated,
      lifecycleState,
      message: "Lifecycle state refreshed"
    });
  }
  
  return res.status(400).json({ error: "Invalid action" });
}

// ============================================================================
// DELETE - Not typically used for trader profiles
// ============================================================================

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  traderId?: string,
  userId?: string
) {
  return res.status(405).json({ error: "Trader profiles cannot be deleted" });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTraderLifecycleState(profile: TraderProfile): TraderLifecycleState {
  // Base lifecycle state on profile status and account activity
  const accountEngine = getAccountEngineInstance();
  
  if (profile.status === "PENDING_VERIFICATION") {
    return "VISITOR";
  }
  
  if (profile.status === "SUSPENDED") {
    return "SUSPENDED";
  }
  
  if (profile.status === "TERMINATED") {
    return "TERMINATED";
  }
  
  // Check for active challenges
  const activeChallenges = accountEngine.getTraderChallengeAccounts(profile.id)
    .filter(acc => ["ACTIVE", "WARNING", "AT_RISK"].includes(acc.currentStatus));
  
  if (activeChallenges.length > 0) {
    const latestChallenge = activeChallenges.reduce((latest, acc) => 
      new Date(acc.updatedAt) > new Date(latest.updatedAt) ? acc : latest
    );
    
    switch (latestChallenge.currentStatus) {
      case "ACTIVE": return latestChallenge.currentPhase === 1 ? "CHALLENGE_ACTIVE" : "EVALUATION_ACTIVE";
      case "WARNING": return latestChallenge.currentPhase === 1 ? "CHALLENGE_WARNING" : "EVALUATION_WARNING";
      case "AT_RISK": return latestChallenge.currentPhase === 1 ? "CHALLENGE_AT_RISK" : "EVALUATION_AT_RISK";
    }
  }
  
  // Check for funded accounts
  const activeFunded = accountEngine.getTraderFundedAccounts(profile.id)
    .filter(acc => ["ACTIVE", "WARNING", "AT_RISK", "SCALING_PENDING", "SCALING_APPROVED", "PAYOUT_PENDING", "PAYOUT_PROCESSING"].includes(acc.currentStatus));
  
  if (activeFunded.length > 0) {
    const latestFunded = activeFunded.reduce((latest, acc) => 
      new Date(acc.updatedAt) > new Date(latest.updatedAt) ? acc : latest
    );
    
    switch (latestFunded.currentStatus) {
      case "ACTIVE": return "FUNDED_ACTIVE";
      case "WARNING": return "FUNDED_WARNING";
      case "AT_RISK": return "FUNDED_AT_RISK";
      case "BREACHED": return "FUNDED_BREACHED";
      case "SCALING_PENDING": return "FUNDED_SCALING";
      case "SCALING_APPROVED": return "FUNDED_SCALING";
      case "SCALING_REJECTED": return "FUNDED_ACTIVE";
      case "PAYOUT_PENDING": return "FUNDED_ACTIVE";
      case "PAYOUT_PROCESSING": return "FUNDED_ACTIVE";
    }
  }
  
  // Check for passed challenges
  const passedChallenges = accountEngine.getTraderChallengeAccounts(profile.id)
    .filter(acc => acc.currentStatus === "PASSED");
  
  if (passedChallenges.length > 0) {
    return "EVALUATION_PASSED";
  }
  
  // Check for breached/expired challenges
  const endedChallenges = accountEngine.getTraderChallengeAccounts(profile.id)
    .filter(acc => ["BREACHED", "EXPIRED"].includes(acc.currentStatus));
  
  if (endedChallenges.length > 0) {
    const latestEnded = endedChallenges.reduce((latest, acc) => 
      new Date(acc.updatedAt || acc.createdAt) > new Date(latest.updatedAt || latest.createdAt) ? acc : latest
    );
    
    if (latestEnded.currentStatus === "BREACHED") {
      return "CHALLENGE_BREACHED";
    }
    if (latestEnded.currentStatus === "EXPIRED") {
      return "CHALLENGE_EXPIRED";
    }
  }
  
  // Default based on subscription and KYC
  if (profile.kycStatus === "VERIFIED" && profile.aiSubscriptionTier !== "FREE") {
    return "REGISTERED";
  }
  
  if (profile.kycStatus === "VERIFIED") {
    return "REGISTERED";
  }
  
  return "VISITOR";
}
