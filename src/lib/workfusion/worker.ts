import type { WorkerCheck } from "./types";
import { detectMqlIssueKinds } from "./mql-diagnostics";

export function compileCheck(code: string): WorkerCheck {
  const diagnostics: string[] = [];
  const source = code || "";
  let score = 100;
  let forcedStatus: WorkerCheck["status"] | null = null;

  if (source.trim().length < 5000) {
    diagnostics.push("Code is too short to be a complete EA.");
    score -= 45;
  }
  if (!source.includes("OnInit")) {
    diagnostics.push("Missing OnInit lifecycle function.");
    score -= 18;
  }
  if (!source.includes("OnTick")) {
    diagnostics.push("Missing OnTick execution function.");
    score -= 22;
  }
  if (!source.includes("#property strict")) {
    diagnostics.push("Add #property strict for safer MQL compilation.");
    score -= 8;
  }
  if (/TODO|Insert final entry|merge your final entry|Add validated trading logic/i.test(source)) {
    diagnostics.push("Template/TODO placeholder detected. Generate complete entry and execution logic before download.");
    score -= 30;
  }
  if (/martingale|grid/i.test(source) && !/no martingale/i.test(source)) {
    diagnostics.push("Martingale/grid language detected. Require explicit tail-risk controls.");
    score -= 24;
  }
  if (!/Risk|StopLoss|MaxDailyLoss|MaxSpread/i.test(source)) {
    diagnostics.push("No explicit risk/spread guard found.");
    score -= 16;
  }
  if (!/\btrade\.(Buy|Sell)\s*\(|\bOrderSend\s*\(/.test(source)) {
    diagnostics.push("No concrete market execution call found (trade.Buy/trade.Sell or OrderSend).");
    score -= 22;
  }
  if (!/CalculateLotSize|RiskPerTradePct|NormalizeVolume/i.test(source)) {
    diagnostics.push("No explicit position-sizing function found.");
    score -= 14;
  }
  if (!/MaxTradesPerDay|tradesToday/i.test(source)) {
    diagnostics.push("No max-trades-per-day guard found.");
    score -= 10;
  }
  const issueKinds = detectMqlIssueKinds({ code: source });
  if (issueKinds.includes("invalid_stops") && !/SYMBOL_TRADE_STOPS_LEVEL|MODE_STOPLEVEL/i.test(source)) {
    diagnostics.push("Invalid-stops context detected but no broker stop-level validation found.");
    score -= 18;
  }
  if (issueKinds.includes("invalid_stops") && !/SYMBOL_TRADE_FREEZE_LEVEL|MODE_FREEZELEVEL/i.test(source)) {
    diagnostics.push("Invalid-stops context detected but no freeze-level validation found.");
    score -= 10;
  }
  if (issueKinds.includes("invalid_stops") && !/ResultRetcode|GetLastError|retcode/i.test(source)) {
    diagnostics.push("Invalid-stops context detected but no trade retcode logging found.");
    score -= 8;
  }
  if (issueKinds.includes("ctrade_setup")) {
    diagnostics.push("CTrade setup issue detected. Check Trade.mqh include, CTrade object declaration, object name case, and semicolons before CTrade.");
    score -= 38;
    forcedStatus = "fail";
  }
  if (issueKinds.includes("mt4_to_mql5_migration")) {
    diagnostics.push("MT4-style order API detected in an MQL5 context. Migrate OP_BUY/OP_SELL/MarketInfo/old OrderSend patterns to CTrade or MqlTradeRequest.");
    score -= 38;
    forcedStatus = "fail";
  }
  if (issueKinds.includes("indicator_handle_copybuffer")) {
    diagnostics.push("MQL4-style indicator call detected. In MQL5, create indicator handles and read values with CopyBuffer.");
    score -= 30;
    forcedStatus = "fail";
  }
  if (issueKinds.includes("history_deals")) {
    diagnostics.push("History/deal access issue detected. Use HistorySelect, HistoryDealGetTicket, and HistoryDealGetInteger/Double/String instead of duplicate HistoryDeals includes or MT4-style helpers.");
    score -= 30;
    forcedStatus = "fail";
  }
  if (issueKinds.includes("invalid_volume")) {
    diagnostics.push("Invalid volume risk detected. Normalize lots with SYMBOL_VOLUME_MIN, SYMBOL_VOLUME_MAX, SYMBOL_VOLUME_STEP, and reject 0.00 or off-step volumes.");
    score -= 16;
  }
  if (issueKinds.includes("invalid_filling")) {
    diagnostics.push("Unsupported filling-mode risk detected. Use SetTypeFillingBySymbol or SYMBOL_FILLING_MODE instead of hard-coded fill policies.");
    score -= 14;
  }
  if (issueKinds.includes("array_out_of_range")) {
    diagnostics.push("Array out-of-range risk detected. Check CopyBuffer return count and ArraySize before reading indicator buffers.");
    score -= 14;
  }
  if (issueKinds.includes("backtest_overfit")) {
    diagnostics.push("Backtest credibility risk detected. Require walk-forward/out-of-sample evidence, trade-count adequacy, and spread/slippage sensitivity.");
    score -= 12;
  }

  if (diagnostics.length === 0) diagnostics.push("Static compile pre-check passed. Run MetaEditor before live use.");

  return {
    status: forcedStatus || (score >= 82 ? "pass" : score >= 60 ? "warning" : "fail"),
    score: Math.max(1, score),
    diagnostics,
  };
}

export function backtestEstimate(code: string, idea: string) {
  const compile = compileCheck(code);
  const issueKinds = detectMqlIssueKinds({ code: `${code}\n${idea}` });
  const text = `${code} ${idea}`.toLowerCase();
  const trades = text.includes("session") || text.includes("london") ? 186 : 92;
  const credibilityPenalty = issueKinds.includes("backtest_overfit") ? 0.18 : 0;
  const profitFactor = compile.score >= 82 ? 1.34 - credibilityPenalty : compile.score >= 60 ? 1.08 - credibilityPenalty : 0.84;
  const maxDrawdown = compile.score >= 82 ? 4.8 + credibilityPenalty * 20 : compile.score >= 60 ? 7.6 + credibilityPenalty * 20 : 13.2;
  const warnings = [
    "This is an estimator, not a real MT5 Strategy Tester result.",
    "Promotion requires exported MT4/MT5 backtest reports and forward demo validation.",
    ...(issueKinds.includes("backtest_overfit") ? ["Overfitting/backtest credibility language detected. Require walk-forward, out-of-sample, and parameter-sensitivity evidence."] : []),
  ];

  return {
    status: compile.status,
    trades,
    profitFactor: Number(profitFactor.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(1)),
    fundingReadiness: Math.min(98, Math.max(1, Math.round(compile.score * 0.9))),
    warnings,
    diagnostics: compile.diagnostics,
    resourceSlugs: issueKinds.includes("backtest_overfit") ? ["avoid-overfitting-mt5-ea-backtests"] : [],
  };
}
