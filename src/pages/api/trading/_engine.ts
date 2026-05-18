export type TradingPayload = {
  idea?: string;
  market?: string;
  preset?: string;
  platform?: string;
  propMode?: boolean;
  currentRisk?: number;
  currentCompliance?: number;
  code?: string;
  errors?: string;
  content?: string;
  filename?: string;
};

export function normalizePlatform(value: unknown) {
  const text = String(value || "mt5").toLowerCase();
  if (text.includes("mt4") || text === "mq4") return "mt4";
  return "mt5";
}

export function scoreIdea(payload: TradingPayload) {
  const idea = String(payload.idea || payload.content || "").toLowerCase();
  let riskScore = 62;
  let compliance = 58;

  if (payload.propMode) {
    riskScore += 12;
    compliance += 16;
  }
  if (idea.includes("0.5%") || idea.includes("0.5")) {
    riskScore += 10;
    compliance += 8;
  } else if (idea.includes("1%") || idea.includes("1.0")) {
    riskScore += 5;
    compliance += 4;
  }
  if (idea.includes("stop") || idea.includes("sl") || idea.includes("fixed")) riskScore += 8;
  if (idea.includes("1:2") || idea.includes("2rr") || idea.includes("rr")) riskScore += 6;
  if (idea.includes("martingale") || idea.includes("grid")) {
    riskScore -= idea.includes("no martingale") ? 0 : 22;
    compliance -= idea.includes("no martingale") ? 0 : 18;
  }
  if (idea.includes("news")) compliance += 4;
  if (idea.includes("session") || idea.includes("london") || idea.includes("new york")) compliance += 5;

  riskScore = clamp(riskScore, 1, 98);
  compliance = clamp(compliance, 1, 98);
  const fundingReadiness = clamp(Math.round((riskScore + compliance) / 2), 1, 98);
  return { riskScore, compliance, fundingReadiness };
}

export function buildSummary(payload: TradingPayload) {
  const market = payload.market || "selected market";
  const preset = String(payload.preset || "100k").toUpperCase();
  const mode = payload.propMode ? "prop-firm protected" : "standard";
  return `Generated ${mode} EA plan for ${market} using ${preset} challenge assumptions.`;
}

export function buildRecommendation(payload: TradingPayload, score: { riskScore: number; compliance: number }) {
  if (score.riskScore < 65 || score.compliance < 65) {
    return "Tighten fixed stop-loss rules, reduce risk per trade, and add a session/spread filter before live testing.";
  }
  if (score.compliance >= 85) {
    return "Ready for demo compilation and walk-forward testing. Keep risk capped and verify broker spread behavior.";
  }
  return "Good draft. Improve it with explicit news handling, max trades per day, and daily loss lockout.";
}

export function generateMql(payload: TradingPayload, score: { riskScore: number; compliance: number }) {
  const platform = normalizePlatform(payload.platform);
  const symbol = payload.market === "XAUUSD" ? "XAUUSD" : "Symbol()";
  const extension = platform === "mt4" ? "mq4" : "mq5";
  return `// Workfusion Trading AI generated ${extension} draft
// Review, compile, and forward-test before live use.
// Risk score: ${score.riskScore}/100 | Prop compliance: ${score.compliance}/100

#property strict

input double RiskPerTradePct = ${payload.propMode ? "0.50" : "1.00"};
input int StopLossPoints = 300;
input int TakeProfitPoints = 600;
input int MaxTradesPerDay = 3;
input double MaxDailyLossPct = ${payload.propMode ? "1.50" : "3.00"};
input int MaxSpreadPoints = 45;

int OnInit()
{
   Print("Workfusion EA draft loaded for ${symbol}");
   return(INIT_SUCCEEDED);
}

void OnTick()
{
   if(!RiskGatePasses()) return;
   // TODO: Insert final entry conditions from the strategy brief:
   // ${sanitizeForComment(payload.idea || "No strategy idea provided.")}
}

bool RiskGatePasses()
{
   // Add broker-specific spread, daily loss, and session checks here.
   return(true);
}
`;
}

export function fixedMql(payload: TradingPayload) {
  const source = String(payload.code || "");
  const errorText = String(payload.errors || "No compiler errors provided.");
  return `// Workfusion EA Debugger output
// Compiler notes reviewed: ${sanitizeForComment(errorText).slice(0, 220)}
// This is a clean scaffold. Merge your final entry logic after compilation.

#property strict

double accountEquity = 0.0;

int OnInit()
{
   accountEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   Print("EA initialized. Equity: ", accountEquity);
   return(INIT_SUCCEEDED);
}

void OnTick()
{
   // Original code length: ${source.length} characters.
   // Add validated trading logic here after fixing declarations and scope errors.
}
`;
}

export function debrief(payload: TradingPayload) {
  const text = String(payload.content || payload.idea || "").toLowerCase();
  const issues = [
    text.includes("martingale") ? "Martingale/grid language increases tail risk" : "Risk model needs explicit daily stop logic",
    text.includes("spread") ? "Spread handled, but should be tested per session" : "No explicit spread filter found",
    text.includes("news") ? "News rule mentioned, needs exact blackout window" : "No news or event-risk guard found",
  ];
  const fixes = [
    "Add max spread, max trades per day, and daily loss lockout inputs",
    "Run demo forward test before funded account use",
    "Compare PF and drawdown across at least three market regimes",
  ];
  return { issues, fixes };
}

export function optimize(payload: TradingPayload) {
  const baseRisk = Number(payload.currentRisk || 70);
  const baseCompliance = Number(payload.currentCompliance || 72);
  return {
    riskScore: clamp(baseRisk + 8, 1, 98),
    compliance: clamp(baseCompliance + 12, 1, 98),
    fundingReadiness: clamp(Math.round((baseRisk + baseCompliance) / 2) + 10, 1, 98),
    params: {
      lotSizing: payload.propMode ? "0.50% fixed fractional" : "1.00% fixed fractional",
      stopLossPoints: "300",
      takeProfitPoints: "600",
      sessionFilter: "London/New York only",
      spreadFilter: "45 points max",
      dailyLockout: payload.propMode ? "1.50% max daily loss" : "manual",
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeForComment(value: string) {
  return value.replace(/\*\//g, "").replace(/\n/g, " ").trim();
}
