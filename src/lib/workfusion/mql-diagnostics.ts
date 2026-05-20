export type MqlIssueKind =
  | "invalid_stops"
  | "ctrade_setup"
  | "mt4_to_mql5_migration"
  | "indicator_handle_copybuffer"
  | "history_deals"
  | "no_trade_path";

export type MqlIssueAnalysis = {
  kinds: MqlIssueKind[];
  summary: string;
  issues: string[];
  fixes: string[];
  resourceSlugs: string[];
};

type MqlIssueInput = {
  code?: unknown;
  errors?: unknown;
  platform?: unknown;
};

export function analyzeMqlIssues(input: MqlIssueInput): MqlIssueAnalysis {
  const code = String(input.code || "");
  const errors = String(input.errors || "");
  const platform = normalizePlatform(input.platform, code);
  const text = `${code}\n${errors}`;
  const kinds = detectMqlIssueKinds({ code, errors, platform });
  const issues: string[] = [];
  const fixes: string[] = [];
  const resourceSlugs: string[] = [];

  if (kinds.includes("invalid_stops")) {
    issues.push(
      "Invalid stops are execution validation failures, not normal compiler errors.",
      "The EA must validate SL/TP against live Bid/Ask, current spread, stop level, and freeze level before sending the request.",
      "A small XAUUSD stop can be inside the spread even when a manual or pending-order test appears to work.",
    );
    fixes.push(
      "Add SYMBOL_TRADE_STOPS_LEVEL and SYMBOL_TRADE_FREEZE_LEVEL validation.",
      "For buy orders, validate SL below Bid and TP above Ask by enough points.",
      "For sell orders, validate SL above Ask and TP below Bid by enough points.",
      "Log Bid, Ask, spread, SL, TP, minimum distance, retcode, and retcode description for every failed request.",
    );
    resourceSlugs.push("fix-invalid-stops-mt5-ea");
  }

  if (kinds.includes("ctrade_setup")) {
    issues.push(
      "CTrade usage is inconsistent or incomplete. Common causes are missing #include <Trade/Trade.mqh>, missing CTrade object declaration, or case mismatch between trade and Trade.",
      "A successful CTrade method call still needs retcode inspection because the boolean return is only the local request result.",
    );
    fixes.push(
      "Include the standard MQL5 trade class once with #include <Trade/Trade.mqh>.",
      "Declare one CTrade object, for example CTrade trade;, and call it with exactly the same case everywhere.",
      "After trade.Buy, trade.Sell, or trade.PositionModify, log trade.ResultRetcode() and trade.ResultRetcodeDescription().",
    );
    resourceSlugs.push("mql5-ctrade-include-trade-object-setup");
  }

  if (kinds.includes("mt4_to_mql5_migration")) {
    issues.push(
      "The code appears to mix MT4 order constants/functions with an MQL5 EA target.",
      "OP_BUY, OP_SELL, MarketInfo, Ask/Bid globals, and the old OrderSend signature are MQL4-style patterns and often cause undeclared identifier or wrong-parameter errors in MQL5.",
    );
    fixes.push(
      "For MQL5, use CTrade or MqlTradeRequest/MqlTradeResult instead of the old MQL4 OrderSend signature.",
      "Replace OP_BUY/OP_SELL with MQL5 order types or CTrade Buy/Sell methods.",
      "Use SymbolInfoDouble(_Symbol, SYMBOL_BID/SYMBOL_ASK) and SymbolInfoInteger/SymbolInfoDouble instead of MT4-only globals and MarketInfo.",
    );
    resourceSlugs.push("mql4-to-mql5-migration-checklist");
  }

  if (kinds.includes("indicator_handle_copybuffer")) {
    issues.push(
      "The indicator code looks like an MT4-style direct value call, but MQL5 indicator functions normally return handles.",
      "Without CopyBuffer and handle checks, the EA can compile incorrectly, use stale values, or fail with wrong-parameter errors.",
    );
    fixes.push(
      "Create indicator handles in OnInit and check for INVALID_HANDLE.",
      "Use CopyBuffer(handle, bufferIndex, start, count, array) to read indicator values.",
      "Use ArraySetAsSeries for signal arrays when reading current/previous bars, and release handles in OnDeinit.",
    );
    resourceSlugs.push("fix-mql5-copybuffer-indicator-handle");
  }

  if (kinds.includes("history_deals")) {
    issues.push(
      "The deal-history code appears to rely on non-standard HistoryDeals includes or MT4-style deal helpers.",
      "In MQL5, deal history should be queried through HistorySelect, HistoryDealsTotal, HistoryDealGetTicket, and HistoryDealGetInteger/Double/String.",
    );
    fixes.push(
      "Remove manually downloaded or duplicate HistoryDeals.mqh files unless you know exactly why they are needed.",
      "Call HistorySelect(from, to), loop HistoryDealsTotal(), get each ticket with HistoryDealGetTicket(i), then read properties with HistoryDealGetInteger/Double/String.",
      "Group closed PnL by DEAL_MAGIC, DEAL_SYMBOL, and DEAL_ENTRY instead of guessing from orders only.",
    );
    resourceSlugs.push("fix-mql5-history-deal-functions");
  }

  if (kinds.includes("no_trade_path")) {
    issues.push("The EA may compile but still never trade because permissions, filters, signal frequency, or execution gates block every path.");
    fixes.push("Log one decision pipeline: permission -> spread/session -> signal -> exposure -> stop validation -> trade retcode.");
    resourceSlugs.push("ea-compiles-but-does-not-trade-mt5");
  }

  const summary = kinds.length
    ? `Detected ${kinds.map((kind) => kind.replaceAll("_", " ")).join(", ")} pattern(s) in the MQL workflow.`
    : "No known high-frequency MQL5 issue pattern was detected.";

  return {
    kinds,
    summary,
    issues: unique(issues),
    fixes: unique(fixes),
    resourceSlugs: unique(resourceSlugs),
  };
}

export function detectMqlIssueKinds(input: { code: string; errors?: string; platform?: string }): MqlIssueKind[] {
  const rawSource = input.code || "";
  const source = stripMqlComments(rawSource);
  const errors = input.errors || "";
  const platform = normalizePlatform(input.platform, rawSource);
  const text = `${source}\n${errors}`;
  const lower = text.toLowerCase();
  const kinds: MqlIssueKind[] = [];

  if (/invalid stops|retcode\s*=?\s*10016|error\s*130|trade_retcodes?_invalid_stops/iu.test(text)) {
    kinds.push("invalid_stops");
  }

  if (
    /\bCTrade\b/u.test(text) ||
    /\btrade\.(Buy|Sell|PositionModify|PositionClose|BuyLimit|SellLimit)\s*\(/u.test(text) ||
    /\bTrade\.(Buy|Sell|PositionModify|PositionClose|BuyLimit|SellLimit)\s*\(/u.test(text) ||
    /['"](?:trade|Trade)['"]\s*-\s*(undeclared identifier|unexpected token|some operator expected)/iu.test(text)
  ) {
    const missingInclude = !/#include\s*[<"]Trade[\\/]+Trade\.mqh[>"]/iu.test(source);
    const missingObject = !/\bCTrade\s+[A-Za-z_]\w*\s*;/u.test(source);
    const usesLowerTradeObject = /\btrade\.(Buy|Sell|PositionModify|PositionClose|BuyLimit|SellLimit)\s*\(/u.test(source);
    const usesUpperTradeObject = /\bTrade\.(Buy|Sell|PositionModify|PositionClose|BuyLimit|SellLimit)\s*\(/u.test(source);
    const caseMismatch =
      (/\bCTrade\s+trade\s*;/u.test(source) && usesUpperTradeObject) ||
      (/\bCTrade\s+Trade\s*;/u.test(source) && usesLowerTradeObject);
    const missingSemicolonBeforeTrade = /input\s+\w+(?:\s+\w+)?\s+\w+\s*=\s*[^;\n]+\r?\n\s*CTrade\b/u.test(source);
    if (missingInclude || missingObject || caseMismatch || missingSemicolonBeforeTrade || /undeclared identifier|unexpected token/iu.test(errors)) {
      kinds.push("ctrade_setup");
    }
  }

  const hasMt4OrderApi =
    /\b(OP_BUY|OP_SELL|OP_BUYLIMIT|OP_SELLLIMIT|MarketInfo\s*\(|RefreshRates\s*\(|OrderSelect\s*\(|OrdersTotal\s*\()/u.test(source) ||
    /\bOrderSend\s*\([^;]+OP_/u.test(source);
  const hasMt4MigrationErrors =
    /['"](OP_BUY|OP_SELL|OrderSend|Ask|Bid)['"]\s*-\s*undeclared identifier|wrong parameters count/iu.test(errors) &&
    /\b(OP_BUY|OP_SELL|OrderSend|Ask|Bid)\b/u.test(source);
  if ((platform === "mt5" && hasMt4OrderApi) || hasMt4MigrationErrors) {
    kinds.push("mt4_to_mql5_migration");
  }

  if (platform === "mt5" && (hasMql4StyleIndicatorCall(source) || (/CopyBuffer|indicator handle|wrong parameters count/iu.test(errors) && /\bi(MA|RSI|Stochastic|MACD|Bands)\s*\(/u.test(source)))) {
    kinds.push("indicator_handle_copybuffer");
  }

  const hasBrokenHistoryApi =
    /HistoryDeals\.mqh|MqlDeal\b|\bDealGet(Integer|Double|String)\b|HistoryDealGetStruct/u.test(text) ||
    /cannot open file.*HistoryDeals\.mqh|ambiguous call.*HistoryDeal|undeclared identifier.*(?:MqlDeal|DealGet|HistoryDealGetStruct)/iu.test(errors);
  const hasIncompleteHistoryLoop =
    /HistoryDealsTotal\s*\(/u.test(source) && (!/HistorySelect\s*\(/u.test(source) || !/HistoryDealGetTicket\s*\(/u.test(source));
  if (hasBrokenHistoryApi || hasIncompleteHistoryLoop) {
    kinds.push("history_deals");
  }

  if (/does not trade|no trades|zero trades|not opening trades|strategy tester.*0/iu.test(lower)) {
    kinds.push("no_trade_path");
  }

  return unique(kinds);
}

function normalizePlatform(value: unknown, code: string) {
  const text = String(value || "").toLowerCase();
  if (text.includes("mt4") || text === "mq4") return "mt4";
  if (text.includes("mt5") || text === "mq5") return "mt5";
  if (/\bOrderSend\s*\(/u.test(code) && !/\bCTrade\b|\bMqlTradeRequest\b/u.test(code)) return "mt4";
  return "mt5";
}

function hasMql4StyleIndicatorCall(source: string) {
  const expectedMaxParams: Record<string, number> = {
    iMA: 6,
    iRSI: 4,
    iStochastic: 7,
    iMACD: 6,
    iBands: 6,
  };

  return Object.entries(expectedMaxParams).some(([name, maxParams]) => {
    return extractFunctionCalls(source, name).some((call) => splitTopLevelParams(call).length > maxParams);
  });
}

function stripMqlComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function extractFunctionCalls(source: string, name: string) {
  const calls: string[] = [];
  let index = 0;
  const token = `${name}(`;
  while ((index = source.indexOf(token, index)) !== -1) {
    let depth = 0;
    const start = index + token.length;
    for (let cursor = index + name.length; cursor < source.length; cursor++) {
      const char = source[cursor];
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (depth === 0) {
        calls.push(source.slice(start, cursor));
        index = cursor + 1;
        break;
      }
      if (cursor === source.length - 1) index = source.length;
    }
  }
  return calls;
}

function splitTopLevelParams(value: string) {
  const params: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(" || char === "[" || char === "{") depth++;
    if (char === ")" || char === "]" || char === "}") depth--;
    if (char === "," && depth === 0) {
      params.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) params.push(current.trim());
  return params;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}
