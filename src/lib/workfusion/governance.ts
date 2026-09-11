export type GovernStatus = "attack" | "defend" | "stop" | "review";

export type PropFirmRule = {
  id: string;
  label: string;
  targetProfitPct: number;
  maxDailyLossPct: number;
  maxTotalLossPct: number;
  minTradingDays: number;
};

export type PayoutGovernanceInput = {
  firm?: string;
  accountSize?: number;
  equity?: number;
  dailyPnl?: number;
  tradingDays?: number;
  openPositions?: number;
  targetProfitPct?: number;
  maxDailyLossPct?: number;
  maxTotalLossPct?: number;
  minTradingDays?: number;
};

export type PayoutGovernanceResult = {
  firm: string;
  rule: PropFirmRule;
  status: GovernStatus;
  humanStatus: string;
  action: string;
  warnings: string[];
  metrics: {
    accountSize: number;
    equity: number;
    profit: number;
    progressPct: number;
    targetEquity: number;
    targetRemaining: number;
    targetRemainingPct: number;
    dailyPnl: number;
    dailyLossUsed: number;
    dailyLossLimit: number;
    dailyLossRemaining: number;
    dailyLossRemainingPct: number;
    minEquity: number;
    totalLossUsed: number;
    totalLossRemaining: number;
    totalLossRemainingPct: number;
    tradingDays: number;
    minTradingDays: number;
    tradingDaysRemaining: number;
    openPositions: number;
  };
};

export const propFirmRules: Record<string, PropFirmRule> = {
  generic: {
    id: "generic",
    label: "Generic 10/5/10 challenge",
    targetProfitPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    minTradingDays: 3,
  },
  ftmo: {
    id: "ftmo",
    label: "FTMO-style challenge",
    targetProfitPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    minTradingDays: 4,
  },
  fundingpips: {
    id: "fundingpips",
    label: "FundingPips-style challenge",
    targetProfitPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    minTradingDays: 3,
  },
  acg: {
    id: "acg",
    label: "Alpha Capital Group-style challenge",
    targetProfitPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    minTradingDays: 3,
  },
  fivepercentonline: {
    id: "fivepercentonline",
    label: "FivePercentOnline-style challenge",
    targetProfitPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    minTradingDays: 3,
  },
};

function numberField(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedFirm(value: unknown) {
  const text = String(value || "generic").toLowerCase().replace(/[^a-z0-9]+/gu, "");
  if (text.includes("fundingpips")) return "fundingpips";
  if (text.includes("fivepercent")) return "fivepercentonline";
  if (text.includes("alphacapital") || text.includes("acg")) return "acg";
  if (text.includes("ftmo")) return "ftmo";
  return "generic";
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number) {
  return `$${round2(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(value: number) {
  return `${round2(value).toFixed(2)}%`;
}

export function evaluatePayoutGovernance(input: PayoutGovernanceInput): PayoutGovernanceResult {
  const firm = normalizedFirm(input.firm);
  const baseRule = propFirmRules[firm] || propFirmRules.generic;
  const rule: PropFirmRule = {
    ...baseRule,
    targetProfitPct: numberField(input.targetProfitPct, baseRule.targetProfitPct),
    maxDailyLossPct: numberField(input.maxDailyLossPct, baseRule.maxDailyLossPct),
    maxTotalLossPct: numberField(input.maxTotalLossPct, baseRule.maxTotalLossPct),
    minTradingDays: numberField(input.minTradingDays, baseRule.minTradingDays),
  };

  const accountSize = Math.max(0, numberField(input.accountSize, 100000));
  const equity = Math.max(0, numberField(input.equity, accountSize));
  const dailyPnl = numberField(input.dailyPnl, 0);
  const tradingDays = Math.max(0, numberField(input.tradingDays, 0));
  const openPositions = Math.max(0, numberField(input.openPositions, 0));

  const profit = equity - accountSize;
  const progressPct = accountSize > 0 ? (profit / accountSize) * 100 : 0;
  const targetEquity = accountSize * (1 + rule.targetProfitPct / 100);
  const targetRemaining = Math.max(0, targetEquity - equity);
  const targetRemainingPct = Math.max(0, rule.targetProfitPct - progressPct);
  const dailyLossLimit = accountSize * (rule.maxDailyLossPct / 100);
  const dailyLossUsed = Math.max(0, -dailyPnl);
  const dailyLossRemaining = dailyLossLimit - dailyLossUsed;
  const dailyLossRemainingPct = accountSize > 0 ? (dailyLossRemaining / accountSize) * 100 : 0;
  const minEquity = accountSize * (1 - rule.maxTotalLossPct / 100);
  const totalLossUsed = Math.max(0, accountSize - equity);
  const totalLossRemaining = equity - minEquity;
  const totalLossRemainingPct = accountSize > 0 ? (totalLossRemaining / accountSize) * 100 : 0;
  const tradingDaysRemaining = Math.max(0, rule.minTradingDays - tradingDays);

  const warnings: string[] = [];
  const targetReached = targetRemaining <= 0.01;
  const minDaysMet = tradingDaysRemaining === 0;
  const dailyBreached = dailyLossRemaining <= 0;
  const totalBreached = totalLossRemaining <= 0;
  const closeToTarget = targetRemainingPct <= 2.5;
  const thinDailyBuffer = dailyLossRemainingPct < 1.25;
  const thinTotalBuffer = totalLossRemainingPct < 3.5;

  let status: GovernStatus = "review";
  let action = "Review rules and evidence before increasing risk.";

  if (dailyBreached || totalBreached) {
    status = "stop";
    action = "Stop new risk and review breach exposure immediately.";
  } else if (openPositions > 0) {
    status = "review";
    action = "Review open exposure before adding risk or requesting payout.";
  } else if (targetReached && minDaysMet) {
    status = "review";
    action = "Payout review candidate: verify firm portal, account history, and no open risk.";
  } else if (thinDailyBuffer || thinTotalBuffer || progressPct < -0.5) {
    status = "defend";
    action = "Defend the account: preserve drawdown buffer and avoid extra frequency.";
  } else if (closeToTarget && minDaysMet) {
    status = "attack";
    action = "Attack carefully: account is close enough to target to prioritize clean opportunities.";
  } else {
    status = "review";
    action = "Continue controlled building; target is still pending and risk buffer is usable.";
  }

  if (!targetReached) warnings.push(`${money(targetRemaining)} still needed before target.`);
  if (!minDaysMet) warnings.push(`${tradingDaysRemaining} trading day(s) still required.`);
  if (thinDailyBuffer) warnings.push(`Daily buffer is thin at ${pct(dailyLossRemainingPct)}.`);
  if (thinTotalBuffer) warnings.push(`Total drawdown buffer is thin at ${pct(totalLossRemainingPct)}.`);
  if (openPositions > 0) warnings.push(`${openPositions} open position(s) still active.`);

  const humanStatus = humanGovernanceMessage(status, targetRemaining, dailyLossRemainingPct, totalLossRemainingPct);

  return {
    firm,
    rule,
    status,
    humanStatus,
    action,
    warnings,
    metrics: {
      accountSize: round2(accountSize),
      equity: round2(equity),
      profit: round2(profit),
      progressPct: round2(progressPct),
      targetEquity: round2(targetEquity),
      targetRemaining: round2(targetRemaining),
      targetRemainingPct: round2(targetRemainingPct),
      dailyPnl: round2(dailyPnl),
      dailyLossUsed: round2(dailyLossUsed),
      dailyLossLimit: round2(dailyLossLimit),
      dailyLossRemaining: round2(dailyLossRemaining),
      dailyLossRemainingPct: round2(dailyLossRemainingPct),
      minEquity: round2(minEquity),
      totalLossUsed: round2(totalLossUsed),
      totalLossRemaining: round2(totalLossRemaining),
      totalLossRemainingPct: round2(totalLossRemainingPct),
      tradingDays: round2(tradingDays),
      minTradingDays: round2(rule.minTradingDays),
      tradingDaysRemaining: round2(tradingDaysRemaining),
      openPositions: round2(openPositions),
    },
  };
}

function humanGovernanceMessage(status: GovernStatus, targetRemaining: number, dailyBufferPct: number, totalBufferPct: number) {
  if (status === "stop") return "Stop new risk. A firm or internal drawdown boundary is breached or too close to breach.";
  if (status === "attack") return `Close enough to target for selective risk, but protect ${pct(dailyBufferPct)} daily buffer.`;
  if (status === "defend") return `Defend the account. Target is ${money(targetRemaining)} away and drawdown buffer is not comfortable.`;
  return `Review mode. Target is ${money(targetRemaining)} away with ${pct(totalBufferPct)} total drawdown buffer.`;
}

function pdfEscape(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/\(/gu, "\\(").replace(/\)/gu, "\\)");
}

function pdfLine(text: string, y: number, size = 11) {
  return `BT /F1 ${size} Tf 54 ${y} Td (${pdfEscape(text)}) Tj ET\n`;
}

export function buildGovernancePdf(result: PayoutGovernanceResult) {
  const lines = [
    `Workfusion Govern - Prop Firm Payout Report`,
    `Firm profile: ${result.rule.label}`,
    `Status: ${result.status.toUpperCase()}`,
    result.humanStatus,
    `Action: ${result.action}`,
    `Account size: ${money(result.metrics.accountSize)} | Equity: ${money(result.metrics.equity)} | Profit: ${money(result.metrics.profit)}`,
    `Target left: ${money(result.metrics.targetRemaining)} (${pct(result.metrics.targetRemainingPct)})`,
    `Daily buffer: ${money(result.metrics.dailyLossRemaining)} (${pct(result.metrics.dailyLossRemainingPct)})`,
    `Total DD buffer: ${money(result.metrics.totalLossRemaining)} (${pct(result.metrics.totalLossRemainingPct)})`,
    `Trading days: ${result.metrics.tradingDays}/${result.metrics.minTradingDays} | Positions: ${result.metrics.openPositions}`,
    `Warnings: ${result.warnings.length ? result.warnings.join(" | ") : "none"}`,
    `Disclosure: software workflow only. No trading, broker access, or performance guarantee.`,
  ];

  let y = 760;
  let content = pdfLine(lines[0], y, 17);
  y -= 34;
  for (const line of lines.slice(1)) {
    content += pdfLine(line.slice(0, 105), y, 10);
    y -= 22;
  }

  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}endstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}
