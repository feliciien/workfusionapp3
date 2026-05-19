import type { WorkerCheck } from "./types";

export function compileCheck(code: string): WorkerCheck {
  const diagnostics: string[] = [];
  const source = code || "";
  let score = 100;

  if (source.trim().length < 4000) {
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

  if (diagnostics.length === 0) diagnostics.push("Static compile pre-check passed. Run MetaEditor before live use.");

  return {
    status: score >= 82 ? "pass" : score >= 60 ? "warning" : "fail",
    score: Math.max(1, score),
    diagnostics,
  };
}

export function backtestEstimate(code: string, idea: string) {
  const compile = compileCheck(code);
  const text = `${code} ${idea}`.toLowerCase();
  const trades = text.includes("session") || text.includes("london") ? 186 : 92;
  const profitFactor = compile.score >= 82 ? 1.34 : compile.score >= 60 ? 1.08 : 0.84;
  const maxDrawdown = compile.score >= 82 ? 4.8 : compile.score >= 60 ? 7.6 : 13.2;
  const warnings = [
    "This is an estimator, not a real MT5 Strategy Tester result.",
    "Promotion requires exported MT4/MT5 backtest reports and forward demo validation.",
  ];

  return {
    status: compile.status,
    trades,
    profitFactor,
    maxDrawdown,
    fundingReadiness: Math.min(98, Math.max(1, Math.round(compile.score * 0.9))),
    warnings,
    diagnostics: compile.diagnostics,
  };
}
