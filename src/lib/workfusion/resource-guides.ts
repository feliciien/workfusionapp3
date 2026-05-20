export type ResourceGuide = {
  slug: string;
  cluster: "Compiler Fixes" | "EA Generation" | "MT4 Debugging" | "Prop Firm Risk" | "Code Review";
  pillarSlug: string;
  persona: string;
  source: string;
  title: string;
  metaTitle: string;
  description: string;
  searchIntent: string;
  h1: string;
  intro: string;
  sections: Array<{ title: string; body: string; bullets: string[] }>;
  checklist: string[];
  cta: string;
  related: string[];
};

export const resourceGuides: Record<string, ResourceGuide> = {
  "fix-undeclared-identifier-mql5-ea": {
    slug: "fix-undeclared-identifier-mql5-ea",
    cluster: "Compiler Fixes",
    pillarSlug: "mql5-compiler-fixer",
    persona: "mq5_developer",
    source: "resource_fix_undeclared_identifier_mql5_ea",
    title: "Fix undeclared identifier in an MQL5 EA",
    metaTitle: "Fix Undeclared Identifier in MQL5 EA | Workfusion",
    description: "A practical checklist for fixing undeclared identifier errors in MT5 Expert Advisor code before compiling again.",
    searchIntent: "The developer has a MetaEditor error and needs the missing variable, function, include, or object declared correctly.",
    h1: "Fix the MQL5 undeclared identifier error without turning the EA into a patchwork.",
    intro:
      "The undeclared identifier error usually means MetaEditor reached a name that was never defined in the visible scope. The fast fix is not only adding a variable. You need to confirm whether the missing name should be an input, a local variable, a helper function, an enum, or a trading object.",
    sections: [
      {
        title: "Find what kind of identifier is missing",
        body: "Start with the first compiler line, not the last. Later errors often cascade from the first unresolved name.",
        bullets: ["If the name looks like a setting, make it an input", "If it looks like a helper, add the function signature", "If it looks like trade or position access, check includes and object creation"],
      },
      {
        title: "Fix scope before logic",
        body: "Many EAs compile badly because values are declared inside one function and reused inside another. Shared state should be deliberate, named clearly, and initialized in OnInit when needed.",
        bullets: ["Keep strategy settings as input values", "Keep temporary values local inside OnTick", "Keep persistent values as globals only when they are real EA state"],
      },
      {
        title: "Run a full readiness pass",
        body: "After the identifier compiles, check that the EA still has explicit risk, spread, and position guards. A compile fix should not weaken the trading controls.",
        bullets: ["Confirm MaxSpreadPoints exists", "Confirm risk per trade is bounded", "Confirm MaxOpenTrades or equivalent guard exists"],
      },
    ],
    checklist: ["Read the first compiler error first", "Declare the missing name in the correct scope", "Avoid duplicate global variables", "Recompile after each structural fix", "Run a risk/readiness check before download"],
    cta: "Paste the error and full EA draft into Workfusion Compiler Fixer to generate a complete corrected pass.",
    related: ["mql5-code-review-before-backtesting", "mql5-ctrade-include-trade-object-setup", "mql5-compile-errors-cheat-sheet"],
  },
  "fix-invalid-stops-mt5-ea": {
    slug: "fix-invalid-stops-mt5-ea",
    cluster: "Compiler Fixes",
    pillarSlug: "mql5-compiler-fixer",
    persona: "mq5_developer",
    source: "resource_fix_invalid_stops_mt5_ea",
    title: "Fix invalid stops in an MT5 EA",
    metaTitle: "Fix Invalid Stops in MT5 EA | Workfusion",
    description: "How to diagnose invalid stop-loss and take-profit errors in MT5 Expert Advisors before live or tester execution.",
    searchIntent: "The EA compiles, but order placement fails because SL or TP is too close, wrong side, or not normalized.",
    h1: "Fix MT5 invalid stops before your EA wastes test runs.",
    intro:
      "Invalid stops are not usually a compiler issue. They are execution validation failures. The EA sends a stop-loss or take-profit that the broker, symbol, or current price does not accept.",
    sections: [
      {
        title: "Check direction and distance",
        body: "Buy and sell orders require stops on different sides of the live quote. Then the distance must respect spread, stop level, and freeze level.",
        bullets: ["Buy SL below Bid and buy TP above Ask", "Sell SL above Ask and sell TP below Bid", "Distance must exceed symbol stop, freeze, and spread restrictions"],
      },
      {
        title: "Normalize price precision",
        body: "Gold, indices, forex, and synthetic symbols often use different digits. Normalize stops with the symbol digits before sending the trade.",
        bullets: ["Use SymbolInfoInteger for digits", "NormalizeDouble stop prices", "Avoid hard-coded pip assumptions"],
      },
      {
        title: "Keep risk calculation separate",
        body: "The stop distance drives lot size. Do not hide stop fixes inside the sizing function. First calculate valid levels, then calculate risk from those levels.",
        bullets: ["Validate stop distance", "Calculate lot from risk and stop size", "Reject the trade if stop validation fails"],
      },
    ],
    checklist: ["Read Bid and Ask", "Read current spread", "Read stop level and freeze level", "Normalize SL and TP", "Reject trades with invalid distances", "Log retcode, price, SL, TP, and reason"],
    cta: "Use Workfusion to review the EA execution block and add stop validation before the next compile/test cycle.",
    related: ["prop-firm-spread-filter-ea", "fixed-risk-lot-sizing-mql5-ea", "mql5-logging-diagnostics-ea"],
  },
  "mql5-ctrade-include-trade-object-setup": {
    slug: "mql5-ctrade-include-trade-object-setup",
    cluster: "Compiler Fixes",
    pillarSlug: "mql5-compiler-fixer",
    persona: "mq5_developer",
    source: "resource_mql5_ctrade_include_trade_object_setup",
    title: "MQL5 CTrade include and trade object setup",
    metaTitle: "MQL5 CTrade Include and Trade Object Setup | Workfusion",
    description: "Set up the MQL5 CTrade object correctly so Buy, Sell, PositionClose, and result checks compile cleanly.",
    searchIntent: "The developer is missing the standard trade include or has trade.Buy and trade.Sell errors.",
    h1: "Set up CTrade correctly before debugging the rest of the EA.",
    intro:
      "A lot of MQL5 execution errors begin with a missing include or an inconsistent trade object. Fix this foundation before spending time on strategy logic.",
    sections: [
      {
        title: "Add the standard include once",
        body: "The standard trade class should be included near the top of the EA. Keep it visible and avoid wrapping it inside conditional blocks.",
        bullets: ["Use the standard trade include", "Create one CTrade object", "Keep the object name consistent across the EA"],
      },
      {
        title: "Check execution result",
        body: "A compile-clean trade call is not enough. The EA should inspect the result and log why a trade failed.",
        bullets: ["Log retcode and comment", "Log symbol, volume, SL, and TP", "Do not retry blindly on every tick"],
      },
      {
        title: "Keep trade calls behind risk gates",
        body: "The trade object should be called only after spread, session, exposure, and daily loss checks pass.",
        bullets: ["RiskGatePasses before trade.Buy or trade.Sell", "MaxOpenTrades check before entry", "Cooldown after failed or successful entries"],
      },
    ],
    checklist: ["Include the trade class", "Create one trade object", "Use consistent object naming", "Log trade result codes", "Call trade methods only after risk gates"],
    cta: "Generate a Workfusion EA draft with CTrade, execution checks, and risk gates already wired together.",
    related: ["fix-undeclared-identifier-mql5-ea", "expert-advisor-state-machine-design", "debug-ea-opens-too-many-trades"],
  },
  "mql5-oninit-ontick-ea-skeleton": {
    slug: "mql5-oninit-ontick-ea-skeleton",
    cluster: "Compiler Fixes",
    pillarSlug: "mt5-ea-generator",
    persona: "mq5_developer",
    source: "resource_mql5_oninit_ontick_ea_skeleton",
    title: "MQL5 OnInit and OnTick EA skeleton",
    metaTitle: "MQL5 OnInit OnTick EA Skeleton | Workfusion",
    description: "A clean MT5 Expert Advisor skeleton structure for OnInit, OnTick, risk gates, signal checks, and execution.",
    searchIntent: "The developer needs a clean Expert Advisor scaffold instead of a partial snippet.",
    h1: "Use a complete OnInit and OnTick skeleton before adding strategy logic.",
    intro:
      "A useful EA skeleton does more than compile. It separates initialization, market reading, risk gates, signal logic, execution, and logging so future debugging stays controlled.",
    sections: [
      {
        title: "Initialize inputs and handles",
        body: "OnInit should validate inputs and create indicator handles when the EA uses indicators. It should fail fast if critical inputs are invalid.",
        bullets: ["Validate risk percent", "Validate spread and session settings", "Create and check indicator handles"],
      },
      {
        title: "Keep OnTick readable",
        body: "OnTick should read market state, run gates, evaluate signals, then execute. It should not become one giant block.",
        bullets: ["Read bid, ask, spread, and time", "Run risk and exposure guards", "Call entry logic only after filters pass"],
      },
      {
        title: "Log decisions, not noise",
        body: "Logs should explain why a trade was allowed or blocked. Excessive tick logs make real issues harder to find.",
        bullets: ["Log block reasons", "Log order request details", "Log state changes only when they matter"],
      },
    ],
    checklist: ["Validate inputs in OnInit", "Use helper functions for risk gates", "Keep execution separate from signal logic", "Add structured logging", "Compile before adding more indicators"],
    cta: "Use Workfusion EA Generator to create a full skeleton from your strategy brief.",
    related: ["turn-strategy-idea-into-mt5-ea-spec", "mql5-code-review-before-backtesting", "mql5-logging-diagnostics-ea"],
  },
  "ea-compiles-but-does-not-trade-mt5": {
    slug: "ea-compiles-but-does-not-trade-mt5",
    cluster: "Compiler Fixes",
    pillarSlug: "mql5-code-review",
    persona: "mq5_developer",
    source: "resource_ea_compiles_but_does_not_trade_mt5",
    title: "MT5 EA compiles but does not trade",
    metaTitle: "MT5 EA Compiles But Does Not Trade | Workfusion",
    description: "A structured diagnostic checklist for MT5 Expert Advisors that compile but produce no trades.",
    searchIntent: "The EA compiles and runs, but Strategy Tester or a chart shows zero trades.",
    h1: "Diagnose an MT5 EA that compiles but never opens trades.",
    intro:
      "Zero trades can come from platform permissions, symbol mismatch, spread filters, session filters, signal thresholds, invalid stops, or risk gates. Treat it as a decision pipeline problem.",
    sections: [
      {
        title: "Separate permission from strategy",
        body: "First confirm the EA is actually allowed to trade in the environment. If trading is disabled, no strategy fix will help.",
        bullets: ["Check Algo Trading and EA permissions", "Check Strategy Tester journal", "Check server-side restrictions for live accounts"],
      },
      {
        title: "Inspect filters before signals",
        body: "Spread, session, max trades, and daily loss filters often block all entries. Print one concise block reason instead of guessing.",
        bullets: ["Log spread versus cap", "Log current hour versus allowed hours", "Log exposure and daily loss state"],
      },
      {
        title: "Measure signal frequency",
        body: "A valid signal that appears once every year is not usable for most EA workflows. Count how often signal conditions become true.",
        bullets: ["Add signal counters", "Backtest several windows", "Compare trades per day against your target"],
      },
    ],
    checklist: ["Confirm EA permission", "Confirm symbol and timeframe", "Log first block reason", "Count signal opportunities", "Review risk and spread settings"],
    cta: "Run Workfusion Code Review to classify whether the block is permission, filter, signal, or execution related.",
    related: ["prop-firm-spread-filter-ea", "backtest-failure-triage-mt5-ea", "mql5-logging-diagnostics-ea"],
  },
  "turn-strategy-idea-into-mt5-ea-spec": {
    slug: "turn-strategy-idea-into-mt5-ea-spec",
    cluster: "EA Generation",
    pillarSlug: "mt5-ea-generator",
    persona: "mq5_developer",
    source: "resource_turn_strategy_idea_into_mt5_ea_spec",
    title: "Turn a strategy idea into an MT5 EA spec",
    metaTitle: "Turn Strategy Idea Into MT5 EA Spec | Workfusion",
    description: "Convert a trading idea into a clear MT5 Expert Advisor specification before generating code.",
    searchIntent: "The user has a strategy idea but needs a structured spec that can become MQL5 code.",
    h1: "Write the EA spec before asking for MQL5 code.",
    intro:
      "A strong EA starts as a precise spec. The code generator needs market, timeframe, entry rules, exit rules, risk limits, invalidation rules, and testing assumptions.",
    sections: [
      {
        title: "Define entry and invalidation",
        body: "Entry logic should say exactly what must be true. Invalidation should say when the setup is no longer valid.",
        bullets: ["Specify timeframe and symbol", "Define indicator periods and thresholds", "Define when the signal expires"],
      },
      {
        title: "Define risk separately",
        body: "Risk rules should not be buried inside the entry logic. Keep lot sizing, drawdown limits, spread caps, and max trades explicit.",
        bullets: ["Risk per trade", "Max daily loss", "Max open trades", "Spread and session filters"],
      },
      {
        title: "Define test success",
        body: "Without a pass/fail gate, every backtest becomes subjective. Set trade count, drawdown, and profit factor expectations before optimizing.",
        bullets: ["Minimum trade sample", "Maximum drawdown", "Minimum PF", "Out-of-sample review"],
      },
    ],
    checklist: ["Market and timeframe", "Entry rule", "Exit rule", "Risk rule", "Blocked-trade reasons", "Backtest gate"],
    cta: "Paste the spec into Workfusion and generate the first complete MT5 EA draft.",
    related: ["mql5-oninit-ontick-ea-skeleton", "ea-input-parameters-checklist", "prepare-ea-for-strategy-tester"],
  },
  "moving-average-crossover-ea-risk-guards": {
    slug: "moving-average-crossover-ea-risk-guards",
    cluster: "EA Generation",
    pillarSlug: "mt5-ea-generator",
    persona: "mq5_developer",
    source: "resource_moving_average_crossover_ea_risk_guards",
    title: "Moving average crossover EA with risk guards",
    metaTitle: "Moving Average Crossover EA With Risk Guards | Workfusion",
    description: "A practical structure for building a moving average crossover EA with spread, session, stop, and sizing controls.",
    searchIntent: "The user wants a common EA example but needs it built with real risk controls.",
    h1: "Build the moving average crossover EA around risk gates, not just crosses.",
    intro:
      "A crossover EA is easy to sketch and easy to abuse. The production-quality version needs guardrails around spread, duplicate entries, stop distance, and market regime.",
    sections: [
      {
        title: "Prevent duplicate entries",
        body: "A crossover can remain true across multiple ticks. The EA must detect the new cross event, not keep entering while the condition is true.",
        bullets: ["Compare previous and current MA relationship", "Use bar-close confirmation if needed", "Add cooldown after entry"],
      },
      {
        title: "Add execution filters",
        body: "Spread and session filters can prevent weak entries during noisy conditions. They should log when they block a trade.",
        bullets: ["MaxSpreadPoints input", "Allowed hours input", "One open trade per symbol"],
      },
      {
        title: "Size from stop distance",
        body: "Fixed lots make tests easier but risk inconsistent. A safer draft calculates volume from risk percent and stop distance.",
        bullets: ["RiskPerTradePct", "Normalize volume", "Reject if stop is too tight or too wide"],
      },
    ],
    checklist: ["Detect cross event", "Avoid duplicate orders", "Validate spread", "Calculate risk-based lots", "Backtest several market regimes"],
    cta: "Use Workfusion to generate a crossover EA draft that includes risk gates from the first version.",
    related: ["fixed-risk-lot-sizing-mql5-ea", "max-open-trades-cooldown-ea", "prepare-ea-for-strategy-tester"],
  },
  "breakout-ea-session-filter-mt5": {
    slug: "breakout-ea-session-filter-mt5",
    cluster: "EA Generation",
    pillarSlug: "mt5-ea-generator",
    persona: "mq5_developer",
    source: "resource_breakout_ea_session_filter_mt5",
    title: "Breakout EA with MT5 session filters",
    metaTitle: "Breakout EA Session Filter MT5 | Workfusion",
    description: "Design a breakout Expert Advisor with session filters, spread guards, and controlled entry frequency.",
    searchIntent: "The user is building a breakout EA and wants to control when it can trade.",
    h1: "Build breakout EAs with session filters from the start.",
    intro:
      "Breakout systems depend heavily on time of day, spread, and volatility regime. A session filter is not decoration; it is part of the strategy definition.",
    sections: [
      {
        title: "Define the breakout window",
        body: "The EA should know the range-building window and the trade window. Mixing them creates unclear tests.",
        bullets: ["Range start and end", "Trade start and end", "One breakout per range unless explicitly allowed"],
      },
      {
        title: "Filter bad execution conditions",
        body: "Breakouts can trigger during spread spikes. The EA should block entries when spread exceeds the configured cap.",
        bullets: ["Spread cap", "Minimum range size", "Maximum range size"],
      },
      {
        title: "Make missed trades explainable",
        body: "When a breakout does not trade, the logs should identify whether the block was time, spread, duplicate trade, or range quality.",
        bullets: ["Log range status", "Log break direction", "Log block reason"],
      },
    ],
    checklist: ["Separate range window from trade window", "Limit duplicate breakouts", "Validate spread", "Log block reasons", "Backtest by session"],
    cta: "Generate a breakout EA draft in Workfusion and inspect the session and spread guard logic before testing.",
    related: ["ea-compiles-but-does-not-trade-mt5", "prop-firm-spread-filter-ea", "backtest-failure-triage-mt5-ea"],
  },
  "ea-input-parameters-checklist": {
    slug: "ea-input-parameters-checklist",
    cluster: "EA Generation",
    pillarSlug: "mt5-ea-generator",
    persona: "mq5_developer",
    source: "resource_ea_input_parameters_checklist",
    title: "EA input parameters checklist",
    metaTitle: "EA Input Parameters Checklist | Workfusion",
    description: "The core input settings every serious MT4/MT5 Expert Advisor draft should expose before testing.",
    searchIntent: "The developer wants to know what configurable inputs an EA should include.",
    h1: "Expose the EA inputs that matter for testing and risk control.",
    intro:
      "Good inputs let you test without rewriting code. Bad inputs hide risk, force manual edits, and make backtest results hard to compare.",
    sections: [
      {
        title: "Risk inputs",
        body: "Risk inputs define the maximum damage a draft is allowed to take during testing and live review.",
        bullets: ["RiskPerTradePct", "MaxDailyLossPct", "MaxOpenTrades", "MaxSpreadPoints"],
      },
      {
        title: "Strategy inputs",
        body: "Strategy inputs should describe signal logic without mixing in account-specific assumptions.",
        bullets: ["Indicator periods", "Thresholds", "Session windows", "Cooldown bars or minutes"],
      },
      {
        title: "Diagnostics inputs",
        body: "A debug mode can make blocked trades visible without flooding the journal on every tick.",
        bullets: ["EnableDebugLogs", "LogBlockedReasons", "MagicNumber"],
      },
    ],
    checklist: ["Risk inputs are explicit", "Magic number is unique", "Debug logs can be toggled", "Session and spread are configurable", "Defaults are conservative"],
    cta: "Use Workfusion to regenerate your EA with a clearer input surface before optimization.",
    related: ["turn-strategy-idea-into-mt5-ea-spec", "prop-firm-ea-readiness-checklist", "mql5-code-review-before-backtesting"],
  },
  "prepare-ea-for-strategy-tester": {
    slug: "prepare-ea-for-strategy-tester",
    cluster: "EA Generation",
    pillarSlug: "mt5-ea-generator",
    persona: "mq5_developer",
    source: "resource_prepare_ea_for_strategy_tester",
    title: "Prepare an EA for Strategy Tester",
    metaTitle: "Prepare EA for MT5 Strategy Tester | Workfusion",
    description: "A practical checklist before running an MT5 Strategy Tester backtest on a new Expert Advisor draft.",
    searchIntent: "The user has a draft EA and wants to avoid wasting Strategy Tester runs.",
    h1: "Prepare your EA before the Strategy Tester run.",
    intro:
      "Strategy Tester is not a code review tool. Before running it, make sure the EA compiles, has sensible inputs, logs block reasons, and can produce enough trades to evaluate.",
    sections: [
      {
        title: "Run compile and static checks",
        body: "A clean compile is the entry ticket. Then check for template leftovers, missing trade calls, and missing risk controls.",
        bullets: ["No TODO placeholders", "OnInit and OnTick present", "Trade execution path present"],
      },
      {
        title: "Set a test matrix",
        body: "Use a small test first, then expand. A failed one-week test is cheaper than a failed five-year run.",
        bullets: ["Smoke test", "One month", "Three months", "Walk-forward review"],
      },
      {
        title: "Capture report context",
        body: "Save the set file, date range, model, symbol, spread assumptions, and result report together.",
        bullets: ["Report path", "Set file name", "EA version", "Data model"],
      },
    ],
    checklist: ["Compile clean", "Inputs validated", "Short smoke test first", "Save set file", "Review trade count and PF together"],
    cta: "Run Workfusion compile and readiness checks before launching your next Strategy Tester batch.",
    related: ["backtest-failure-triage-mt5-ea", "mql5-code-review-before-backtesting", "expert-advisor-handoff-checklist"],
  },
  "fix-ordersend-error-130-mql4": {
    slug: "fix-ordersend-error-130-mql4",
    cluster: "MT4 Debugging",
    pillarSlug: "mt4-ea-debugger",
    persona: "mt4_developer",
    source: "resource_fix_ordersend_error_130_mql4",
    title: "Fix OrderSend error 130 in MQL4",
    metaTitle: "Fix OrderSend Error 130 MQL4 | Workfusion",
    description: "Diagnose invalid stops, stop level, digits, and price normalization issues behind MQL4 OrderSend error 130.",
    searchIntent: "The MT4 EA fails with OrderSend error 130 and needs stop-level validation.",
    h1: "Fix MQL4 OrderSend error 130 with stop validation.",
    intro:
      "OrderSend error 130 usually means invalid stops. The EA may compile correctly, but the broker rejects SL or TP because price, distance, or normalization is wrong.",
    sections: [
      {
        title: "Validate stop direction",
        body: "Buy and sell stops must be placed on the correct side of Bid and Ask. A wrong-side stop is rejected immediately.",
        bullets: ["Buy SL below Bid or Ask context", "Sell SL above Ask or Bid context", "TP on the opposite profitable side"],
      },
      {
        title: "Read broker stop level",
        body: "MarketInfo can return minimum stop distance rules. Use them before calling OrderSend.",
        bullets: ["MODE_STOPLEVEL", "MODE_FREEZELEVEL when relevant", "NormalizeDouble with Digits"],
      },
      {
        title: "Reject instead of guessing",
        body: "If the stop is invalid, log and skip the trade. Do not send random adjusted orders without recording why.",
        bullets: ["Log requested SL and TP", "Log minimum distance", "Log symbol and spread"],
      },
    ],
    checklist: ["Check stop side", "Read stop level", "Normalize prices", "Handle five-digit symbols", "Log rejected orders"],
    cta: "Paste the MQL4 order block into Workfusion Debugger to get a cleaner draft and fix notes.",
    related: ["mql4-compile-errors-cheat-sheet", "mt4-ea-magic-number-order-management", "debug-ea-opens-too-many-trades"],
  },
  "mql4-to-mql5-migration-checklist": {
    slug: "mql4-to-mql5-migration-checklist",
    cluster: "MT4 Debugging",
    pillarSlug: "mt4-ea-debugger",
    persona: "mt4_developer",
    source: "resource_mql4_to_mql5_migration_checklist",
    title: "MQL4 to MQL5 migration checklist",
    metaTitle: "MQL4 to MQL5 Migration Checklist | Workfusion",
    description: "A practical checklist for moving Expert Advisor logic from MT4 to MT5 without breaking order handling.",
    searchIntent: "The developer has an MT4 EA and wants to adapt the logic to MQL5.",
    h1: "Migrate EA logic from MQL4 to MQL5 deliberately.",
    intro:
      "MQL5 is not just MQL4 with different function names. Position accounting, trade classes, symbol functions, and event handling are different enough to require a migration checklist.",
    sections: [
      {
        title: "Translate execution model",
        body: "MQL4 OrderSend patterns often become CTrade calls or MqlTradeRequest structures in MQL5.",
        bullets: ["Replace order loops with position/order APIs", "Use symbol-specific data functions", "Check netting versus hedging assumptions"],
      },
      {
        title: "Rebuild indicator access",
        body: "MQL5 indicators often use handles and CopyBuffer. Do not assume old direct indicator calls map one-to-one.",
        bullets: ["Create handles in OnInit", "Release handles when needed", "Check CopyBuffer return values"],
      },
      {
        title: "Retest risk logic",
        body: "Lot sizing, stops, spread, and account metrics should be revalidated after migration.",
        bullets: ["Normalize volume", "Validate stops", "Retest max exposure", "Log all migrated assumptions"],
      },
    ],
    checklist: ["Map order functions", "Map indicator functions", "Review position model", "Rebuild risk sizing", "Compile before optimizing"],
    cta: "Use Workfusion to review the migrated draft and find missing MQL5 structure before Strategy Tester.",
    related: ["mql5-ctrade-include-trade-object-setup", "mql5-oninit-ontick-ea-skeleton", "mql5-code-review-before-backtesting"],
  },
  "mt4-ea-magic-number-order-management": {
    slug: "mt4-ea-magic-number-order-management",
    cluster: "MT4 Debugging",
    pillarSlug: "mt4-ea-debugger",
    persona: "mt4_developer",
    source: "resource_mt4_ea_magic_number_order_management",
    title: "MT4 EA magic number and order management",
    metaTitle: "MT4 EA Magic Number Order Management | Workfusion",
    description: "Use magic numbers, symbol filters, and order loops correctly in MQL4 Expert Advisors.",
    searchIntent: "The developer needs to prevent an MT4 EA from managing the wrong trades.",
    h1: "Use magic numbers so your MT4 EA manages only its own trades.",
    intro:
      "An MT4 EA without disciplined magic number filtering can close, modify, or count trades it does not own. That makes testing unreliable and live use dangerous.",
    sections: [
      {
        title: "Filter by symbol and magic number",
        body: "Every order loop should check both symbol and magic number before counting, closing, or modifying positions.",
        bullets: ["OrderSymbol equals chart symbol", "OrderMagicNumber equals EA input", "Skip manual or unrelated orders"],
      },
      {
        title: "Count exposure correctly",
        body: "MaxOpenTrades should count only the EA's own trades unless the rule intentionally covers all exposure.",
        bullets: ["Separate own trades from account exposure", "Log count source", "Avoid duplicate entries"],
      },
      {
        title: "Make ownership visible",
        body: "Use comments and logs to make it clear which EA instance created or modified each trade.",
        bullets: ["Order comment prefix", "MagicNumber input", "Symbol-specific logs"],
      },
    ],
    checklist: ["Use MagicNumber input", "Filter every order loop", "Count own trades separately", "Do not touch manual trades by default", "Log ownership"],
    cta: "Run Workfusion MT4 Debugger to flag missing symbol and magic number filters.",
    related: ["debug-ea-opens-too-many-trades", "fix-ordersend-error-130-mql4", "mql4-compile-errors-cheat-sheet"],
  },
  "mql4-compile-errors-cheat-sheet": {
    slug: "mql4-compile-errors-cheat-sheet",
    cluster: "MT4 Debugging",
    pillarSlug: "mt4-ea-debugger",
    persona: "mt4_developer",
    source: "resource_mql4_compile_errors_cheat_sheet",
    title: "MQL4 compile errors cheat sheet",
    metaTitle: "MQL4 Compile Errors Cheat Sheet | Workfusion",
    description: "A quick guide to common MQL4 compile errors and the structural fixes to try first.",
    searchIntent: "The developer wants quick explanations of common MT4 MetaEditor compiler messages.",
    h1: "Fix MQL4 compiler errors by category, not guesswork.",
    intro:
      "The fastest MQL4 debugging starts by classifying the error: missing declaration, wrong type, missing brace, legacy function pattern, or bad function call.",
    sections: [
      {
        title: "Declaration errors",
        body: "Undeclared variables, missing extern inputs, and function names out of scope should be fixed before runtime issues.",
        bullets: ["Declare inputs at top level", "Avoid duplicate names", "Check function spelling"],
      },
      {
        title: "Type errors",
        body: "MQL4 can be strict around string, int, double, and bool conversions. Normalize your types before adding more logic.",
        bullets: ["Cast intentionally", "Normalize prices as double", "Avoid comparing strings to numbers"],
      },
      {
        title: "Structure errors",
        body: "Missing braces and semicolons can create misleading later errors. Reformat before rewriting the strategy.",
        bullets: ["Match braces", "Close function blocks", "Compile after structural fixes"],
      },
    ],
    checklist: ["Classify the first error", "Fix declarations first", "Fix types second", "Reformat braces", "Compile in small steps"],
    cta: "Paste the MQL4 compiler output into Workfusion and get a full fixed draft, not only a small snippet.",
    related: ["fix-ordersend-error-130-mql4", "mt4-ea-magic-number-order-management", "debug-ea-opens-too-many-trades"],
  },
  "debug-ea-opens-too-many-trades": {
    slug: "debug-ea-opens-too-many-trades",
    cluster: "MT4 Debugging",
    pillarSlug: "mt4-ea-debugger",
    persona: "mt4_developer",
    source: "resource_debug_ea_opens_too_many_trades",
    title: "Debug an EA that opens too many trades",
    metaTitle: "Debug EA Opens Too Many Trades | Workfusion",
    description: "Find duplicate-entry, missing cooldown, magic number, and signal-state issues in an EA that overtrades.",
    searchIntent: "The EA opens repeated trades and the developer needs duplicate-entry controls.",
    h1: "Stop an EA from opening repeated trades on the same signal.",
    intro:
      "Overtrading is usually a state problem. The signal remains true across many ticks, and the EA has no memory that it already acted.",
    sections: [
      {
        title: "Detect new signals, not persistent conditions",
        body: "A condition can stay true for many ticks. Entry logic should detect a transition or a confirmed bar event.",
        bullets: ["Track previous signal state", "Use new-bar checks", "Avoid every-tick duplicate entries"],
      },
      {
        title: "Add exposure and cooldown gates",
        body: "MaxOpenTrades and cooldown rules give the EA hard limits even when signal logic fails.",
        bullets: ["MaxOpenTrades input", "Cooldown minutes or bars", "One trade per signal option"],
      },
      {
        title: "Log why the second trade was blocked",
        body: "If the EA cannot explain why it did not open a duplicate, the gate is not observable enough.",
        bullets: ["Log existing position count", "Log last entry time", "Log magic number filters"],
      },
    ],
    checklist: ["Use new-bar detection", "Track last signal", "Limit open trades", "Add cooldown", "Log duplicate blocks"],
    cta: "Use Workfusion Debugger to add duplicate-entry and cooldown guards to your EA draft.",
    related: ["max-open-trades-cooldown-ea", "mt4-ea-magic-number-order-management", "mql5-ctrade-include-trade-object-setup"],
  },
  "daily-drawdown-guard-ea": {
    slug: "daily-drawdown-guard-ea",
    cluster: "Prop Firm Risk",
    pillarSlug: "prop-firm-ea-risk-checker",
    persona: "prop_trader",
    source: "resource_daily_drawdown_guard_ea",
    title: "Daily drawdown guard for an EA",
    metaTitle: "Daily Drawdown Guard for EA | Workfusion",
    description: "Design a daily loss guard for an Expert Advisor so trading stops when the account approaches the daily risk limit.",
    searchIntent: "The prop trader wants an EA to respect daily loss limits before account breach.",
    h1: "Add a daily drawdown guard before testing prop-style EAs.",
    intro:
      "Prop-style risk control begins with stopping the EA before the account reaches a daily loss breach. The guard should be external to signal logic and impossible for the strategy branch to skip.",
    sections: [
      {
        title: "Define day start and baseline",
        body: "Daily loss depends on the broker server day and the baseline equity or balance. Pick one rule and log it.",
        bullets: ["Server date boundary", "Start-of-day equity", "Current equity and realized PnL"],
      },
      {
        title: "Block before the breach",
        body: "Use a safety buffer. Waiting until the exact limit is reached can fail because spread and slippage move quickly.",
        bullets: ["MaxDailyLossPct input", "Buffer percent", "No new trades when near limit"],
      },
      {
        title: "Make the block auditable",
        body: "A prop-ready EA should record when trading was stopped and which metric triggered the stop.",
        bullets: ["Log daily loss amount", "Log limit", "Log resume time"],
      },
    ],
    checklist: ["Define server day", "Track start equity", "Use safety buffer", "Block new entries", "Log daily stop state"],
    cta: "Run Workfusion Risk Checker to confirm your EA exposes daily loss controls before any serious test.",
    related: ["prop-firm-ea-readiness-checklist", "fixed-risk-lot-sizing-mql5-ea", "expert-advisor-audit-trail"],
  },
  "prop-firm-spread-filter-ea": {
    slug: "prop-firm-spread-filter-ea",
    cluster: "Prop Firm Risk",
    pillarSlug: "prop-firm-ea-risk-checker",
    persona: "prop_trader",
    source: "resource_prop_firm_spread_filter_ea",
    title: "Spread filter for prop firm EAs",
    metaTitle: "Spread Filter for Prop Firm EA | Workfusion",
    description: "Use spread filters to prevent an EA from entering during poor execution conditions without killing all trade frequency.",
    searchIntent: "The trader wants to avoid spread-related losses and blocked trades on prop accounts.",
    h1: "Build a spread filter that protects execution without collapsing trade frequency.",
    intro:
      "A spread filter can save an EA from bad fills, but a cap that is too strict can remove almost every trade. Treat the cap as a tested parameter, not a random number.",
    sections: [
      {
        title: "Measure spread on the actual symbol",
        body: "Broker symbols differ. XAUUSD, XAUUSD.raw, and synthetic custom symbols can behave differently.",
        bullets: ["Read spread from symbol data", "Log spread at blocked entry", "Compare broker symbols separately"],
      },
      {
        title: "Backtest pass rate",
        body: "A spread cap should be tested against the active strategy hours. The right question is how often the cap permits valid setups.",
        bullets: ["Pass rate by hour", "Pass rate by session", "Trade count after filter"],
      },
      {
        title: "Avoid live-only surprises",
        body: "If live spread is often above the backtest assumption, the EA should show that as a dashboard blocker instead of silently doing nothing.",
        bullets: ["Blocked reason: spread", "Current spread versus cap", "Broker-specific notes"],
      },
    ],
    checklist: ["Measure actual spread", "Set cap per symbol", "Log spread blocks", "Check trade count impact", "Review cap in walk-forward tests"],
    cta: "Use Workfusion to flag missing spread guards and compare whether your cap is realistic.",
    related: ["ea-compiles-but-does-not-trade-mt5", "breakout-ea-session-filter-mt5", "prop-firm-ea-readiness-checklist"],
  },
  "max-open-trades-cooldown-ea": {
    slug: "max-open-trades-cooldown-ea",
    cluster: "Prop Firm Risk",
    pillarSlug: "prop-firm-ea-risk-checker",
    persona: "prop_trader",
    source: "resource_max_open_trades_cooldown_ea",
    title: "Max open trades and cooldown for EAs",
    metaTitle: "Max Open Trades and Cooldown EA | Workfusion",
    description: "Use max-trade and cooldown controls to prevent duplicate entries and runaway exposure in Expert Advisors.",
    searchIntent: "The trader wants exposure controls to keep an EA from stacking positions.",
    h1: "Limit open trades and add cooldown before optimizing entries.",
    intro:
      "If an EA can stack trades without a hard cap, a good-looking signal can still create account-level risk. Exposure controls belong before entry execution.",
    sections: [
      {
        title: "Separate symbol cap from portfolio cap",
        body: "A max trade rule can apply to one symbol or the full account. Be explicit so tests match live intent.",
        bullets: ["MaxOpenTradesPerSymbol", "MaxPortfolioTrades", "Magic number ownership"],
      },
      {
        title: "Use cooldown after entries",
        body: "Cooldown reduces duplicate trades caused by persistent signals or repeated ticks.",
        bullets: ["Cooldown minutes", "Cooldown bars", "Last entry timestamp"],
      },
      {
        title: "Block loudly",
        body: "A blocked duplicate should be logged once with the reason, not repeated on every tick.",
        bullets: ["Block reason", "Current count", "Next allowed time"],
      },
    ],
    checklist: ["Count positions correctly", "Use magic number filters", "Apply cooldown", "Log block reasons", "Reject duplicate signal entries"],
    cta: "Run Workfusion Risk Checker to find missing max trade and cooldown gates.",
    related: ["debug-ea-opens-too-many-trades", "daily-drawdown-guard-ea", "fixed-risk-lot-sizing-mql5-ea"],
  },
  "fixed-risk-lot-sizing-mql5-ea": {
    slug: "fixed-risk-lot-sizing-mql5-ea",
    cluster: "Prop Firm Risk",
    pillarSlug: "prop-firm-ea-risk-checker",
    persona: "prop_trader",
    source: "resource_fixed_risk_lot_sizing_mql5_ea",
    title: "Fixed-risk lot sizing for an MQL5 EA",
    metaTitle: "Fixed Risk Lot Sizing MQL5 EA | Workfusion",
    description: "Calculate EA position size from risk percent and stop distance instead of hard-coded lots.",
    searchIntent: "The developer wants safer lot sizing logic for MQL5 Expert Advisors.",
    h1: "Size EA trades from risk percent and stop distance.",
    intro:
      "Hard-coded lots can make a backtest look simple, but they often hide inconsistent account risk. A fixed-risk function starts with account equity, risk percent, tick value, and stop distance.",
    sections: [
      {
        title: "Start with validated stop distance",
        body: "Lot sizing depends on the stop. If the stop is invalid or missing, the EA should not calculate a trade volume.",
        bullets: ["Stop distance in points", "Symbol tick value", "Tick size"],
      },
      {
        title: "Normalize volume",
        body: "Brokers enforce min lot, max lot, and lot step. The EA should normalize and reject impossible sizes.",
        bullets: ["SYMBOL_VOLUME_MIN", "SYMBOL_VOLUME_MAX", "SYMBOL_VOLUME_STEP"],
      },
      {
        title: "Cap final risk",
        body: "Even after normalization, confirm the final volume does not exceed the intended risk too aggressively.",
        bullets: ["RiskPerTradePct", "Maximum volume cap", "Reject if normalized volume becomes too large"],
      },
    ],
    checklist: ["Validate stop distance", "Read tick value", "Read lot step", "Normalize volume", "Reject unsafe sizes"],
    cta: "Generate or review your sizing function in Workfusion before running a full backtest.",
    related: ["fix-invalid-stops-mt5-ea", "daily-drawdown-guard-ea", "ea-input-parameters-checklist"],
  },
  "prop-firm-ea-readiness-checklist": {
    slug: "prop-firm-ea-readiness-checklist",
    cluster: "Prop Firm Risk",
    pillarSlug: "prop-firm-ea-risk-checker",
    persona: "prop_trader",
    source: "resource_prop_firm_ea_readiness_checklist",
    title: "Prop firm EA readiness checklist",
    metaTitle: "Prop Firm EA Readiness Checklist | Workfusion",
    description: "A practical readiness checklist before using an EA around prop-firm style rules and drawdown limits.",
    searchIntent: "The trader wants to know whether an EA draft is ready for prop challenge style testing.",
    h1: "Use a readiness checklist before trusting an EA around prop rules.",
    intro:
      "A prop-aware EA should be judged by controls, observability, and repeatable testing. A single profitable backtest is not enough.",
    sections: [
      {
        title: "Software readiness",
        body: "The EA should compile cleanly, expose inputs, and log why it trades or blocks.",
        bullets: ["Clean compile", "No placeholders", "Observable block reasons"],
      },
      {
        title: "Risk readiness",
        body: "Daily loss, max drawdown, spread, exposure, cooldown, and lot sizing should be explicit.",
        bullets: ["Daily loss guard", "Max open trades", "Risk-based sizing"],
      },
      {
        title: "Evidence readiness",
        body: "Testing should include more than one short favorable period. Keep reports and set files together.",
        bullets: ["Trade count sample", "Walk-forward windows", "Saved set files"],
      },
    ],
    checklist: ["Compile clean", "Risk gates present", "Trade count non-trivial", "Drawdown reviewed", "No guaranteed-profit claims"],
    cta: "Run Workfusion Risk Checker and save the project before moving to Strategy Tester.",
    related: ["daily-drawdown-guard-ea", "prop-firm-spread-filter-ea", "prepare-ea-for-strategy-tester"],
  },
  "expert-advisor-audit-trail": {
    slug: "expert-advisor-audit-trail",
    cluster: "Code Review",
    pillarSlug: "mql5-code-review",
    persona: "mq5_developer",
    source: "resource_expert_advisor_audit_trail",
    title: "Expert Advisor audit trail checklist",
    metaTitle: "Expert Advisor Audit Trail Checklist | Workfusion",
    description: "What to log in an Expert Advisor so trade decisions, blocked entries, and risk controls are reviewable later.",
    searchIntent: "The developer wants better EA logs and auditability.",
    h1: "Make EA decisions auditable before optimization.",
    intro:
      "An audit trail lets you reconstruct why an EA traded, skipped, blocked, or failed. Without it, every loss becomes a guess.",
    sections: [
      {
        title: "Log decision state",
        body: "A useful log captures the current symbol, timeframe, strategy state, and main signal values at decision points.",
        bullets: ["Signal direction", "Current spread", "Session status", "Risk gate result"],
      },
      {
        title: "Log execution result",
        body: "Every order request should produce an explainable result in the journal.",
        bullets: ["Request volume", "SL and TP", "Retcode", "Broker comment"],
      },
      {
        title: "Log blocked reasons",
        body: "Blocked trades are as important as executed trades when debugging low frequency or zero-trade systems.",
        bullets: ["Spread block", "Session block", "Exposure block", "Daily loss block"],
      },
    ],
    checklist: ["Decision logs", "Execution logs", "Blocked reason logs", "Unique magic number", "Report and set file archived"],
    cta: "Use Workfusion Code Review to find missing audit logs in your EA draft.",
    related: ["mql5-logging-diagnostics-ea", "backtest-failure-triage-mt5-ea", "expert-advisor-handoff-checklist"],
  },
  "expert-advisor-state-machine-design": {
    slug: "expert-advisor-state-machine-design",
    cluster: "Code Review",
    pillarSlug: "mql5-code-review",
    persona: "mq5_developer",
    source: "resource_expert_advisor_state_machine_design",
    title: "Expert Advisor state machine design",
    metaTitle: "Expert Advisor State Machine Design | Workfusion",
    description: "Design EA state around waiting, signal, risk-approved, order-sent, position-open, and cooldown phases.",
    searchIntent: "The developer needs cleaner EA lifecycle control.",
    h1: "Use a simple state machine to make EA behavior understandable.",
    intro:
      "A state machine prevents the EA from mixing setup detection, order execution, position management, and cooldown into one unreadable tick loop.",
    sections: [
      {
        title: "Define lifecycle states",
        body: "Keep the states simple and tied to actions the EA can explain.",
        bullets: ["Waiting", "SignalDetected", "RiskApproved", "OrderSent", "PositionOpen", "Cooldown"],
      },
      {
        title: "Control transitions",
        body: "Every transition should have a reason and a log entry. That makes stuck states easy to diagnose.",
        bullets: ["Signal true", "Risk gate passed", "Order accepted", "Position closed"],
      },
      {
        title: "Avoid hidden side effects",
        body: "A state function should not secretly bypass risk checks or send orders without updating state.",
        bullets: ["One execution path", "Explicit block paths", "Consistent timestamps"],
      },
    ],
    checklist: ["List states", "List transitions", "Log state changes", "Keep risk gates outside signals", "Test stuck-state recovery"],
    cta: "Review your EA structure in Workfusion before adding more strategy branches.",
    related: ["mql5-oninit-ontick-ea-skeleton", "mql5-code-review-before-backtesting", "debug-ea-opens-too-many-trades"],
  },
  "mql5-logging-diagnostics-ea": {
    slug: "mql5-logging-diagnostics-ea",
    cluster: "Code Review",
    pillarSlug: "mql5-code-review",
    persona: "mq5_developer",
    source: "resource_mql5_logging_diagnostics_ea",
    title: "MQL5 logging and diagnostics for EAs",
    metaTitle: "MQL5 Logging Diagnostics EA | Workfusion",
    description: "Add useful MQL5 logs that explain EA decisions without flooding the MetaTrader journal.",
    searchIntent: "The developer wants better diagnostic logs in an MT5 EA.",
    h1: "Add EA logs that explain decisions, not noise.",
    intro:
      "The best EA logs are sparse, structured, and tied to decisions. They help you identify permission, filter, signal, risk, and execution problems quickly.",
    sections: [
      {
        title: "Log once per decision",
        body: "Avoid printing the same block reason on every tick. Log state changes and meaningful decisions.",
        bullets: ["New signal", "New block reason", "Order result", "Risk halt"],
      },
      {
        title: "Use consistent fields",
        body: "Consistent log fields make it easier to search and compare test runs.",
        bullets: ["symbol", "timeframe", "spread", "reason", "risk_state"],
      },
      {
        title: "Keep debug mode switchable",
        body: "Verbose logging helps during development but can hide real errors during longer runs.",
        bullets: ["EnableDebugLogs input", "Compact default logs", "Detailed logs on failures"],
      },
    ],
    checklist: ["Decision logs are structured", "Block logs are not repeated every tick", "Execution retcodes are logged", "Debug mode is configurable", "Logs include symbol and magic number"],
    cta: "Use Workfusion to add diagnostics around your EA's risk and execution path.",
    related: ["expert-advisor-audit-trail", "ea-compiles-but-does-not-trade-mt5", "backtest-failure-triage-mt5-ea"],
  },
  "backtest-failure-triage-mt5-ea": {
    slug: "backtest-failure-triage-mt5-ea",
    cluster: "Code Review",
    pillarSlug: "mql5-code-review",
    persona: "mq5_developer",
    source: "resource_backtest_failure_triage_mt5_ea",
    title: "MT5 EA backtest failure triage",
    metaTitle: "MT5 EA Backtest Failure Triage | Workfusion",
    description: "Classify MT5 backtest failures by compile, data, permission, frequency, execution, risk, or strategy issues.",
    searchIntent: "The user has a poor or broken MT5 backtest and wants a triage workflow.",
    h1: "Triage a failed MT5 backtest before changing the strategy.",
    intro:
      "A failed backtest does not automatically mean the strategy idea is bad. First classify the failure type: software, data, execution, risk gate, frequency, or edge.",
    sections: [
      {
        title: "Check if the EA traded enough",
        body: "A two-trade backtest is usually not evidence. It may show over-filtering, data mismatch, or session/spread collapse.",
        bullets: ["Trade count", "Trades per day", "Blocked reason counts"],
      },
      {
        title: "Separate risk from edge",
        body: "An EA can lose because sizing or stops are wrong even when entries have some signal value.",
        bullets: ["Max drawdown", "Average loss", "Stop distance", "Lot calculation"],
      },
      {
        title: "Archive context",
        body: "Always keep the report, set file, data range, symbol, and model together. Otherwise the result is hard to reproduce.",
        bullets: ["Report HTML", "Set file", "EA version", "Date range"],
      },
    ],
    checklist: ["Classify failure type", "Check trade count", "Check spread/session filters", "Check risk sizing", "Save report context"],
    cta: "Use Workfusion to review the EA and create the next debug or optimization step.",
    related: ["prepare-ea-for-strategy-tester", "ea-compiles-but-does-not-trade-mt5", "prop-firm-spread-filter-ea"],
  },
  "expert-advisor-handoff-checklist": {
    slug: "expert-advisor-handoff-checklist",
    cluster: "Code Review",
    pillarSlug: "mql5-code-review",
    persona: "mq5_developer",
    source: "resource_expert_advisor_handoff_checklist",
    title: "Expert Advisor project handoff checklist",
    metaTitle: "Expert Advisor Project Handoff Checklist | Workfusion",
    description: "Package EA code, set files, reports, assumptions, and risk notes so another developer can review or continue the project.",
    searchIntent: "The user wants to organize an EA project for review, sale, client handoff, or collaboration.",
    h1: "Package your EA project so another developer can understand it.",
    intro:
      "A good EA handoff includes code, settings, test reports, assumptions, warnings, and next actions. Without that, the next developer wastes hours reconstructing context.",
    sections: [
      {
        title: "Include build artifacts",
        body: "The reviewer should see the source code, compiled artifact when available, set files, and report outputs.",
        bullets: ["MQ4 or MQ5", "EX4 or EX5 when compiled", "Set files", "Backtest reports"],
      },
      {
        title: "Include risk assumptions",
        body: "Document the intended account size, risk per trade, drawdown cap, spread cap, symbol, and timeframe.",
        bullets: ["Account baseline", "Risk settings", "Symbol assumptions", "Broker limitations"],
      },
      {
        title: "Include known issues",
        body: "A serious handoff explains what is not proven yet. This builds trust and speeds the next review.",
        bullets: ["Known compiler warnings", "Weak test windows", "Open questions", "Next validation step"],
      },
    ],
    checklist: ["Source code", "Set file", "Reports", "Risk assumptions", "Known issues", "Next steps"],
    cta: "Save your Workfusion project and download the EA output with clear risk and readiness notes.",
    related: ["expert-advisor-audit-trail", "prepare-ea-for-strategy-tester", "mql5-code-review-before-backtesting"],
  },
  "mql5-code-review-before-backtesting": {
    slug: "mql5-code-review-before-backtesting",
    cluster: "Code Review",
    pillarSlug: "mql5-code-review",
    persona: "mq5_developer",
    source: "resource_mql5_code_review_before_backtesting",
    title: "MQL5 code review before backtesting",
    metaTitle: "MQL5 Code Review Before Backtesting | Workfusion",
    description: "Review lifecycle, execution, risk, inputs, and logs before spending time on MT5 Strategy Tester runs.",
    searchIntent: "The developer wants a pre-backtest code review checklist for MQL5 EAs.",
    h1: "Review the MQL5 EA before launching Strategy Tester.",
    intro:
      "Backtesting a weak draft gives weak evidence. A pre-backtest review makes sure the EA has lifecycle functions, execution paths, risk gates, and useful diagnostics.",
    sections: [
      {
        title: "Review lifecycle structure",
        body: "Confirm OnInit, OnDeinit when needed, and OnTick are present and separated into readable helper functions.",
        bullets: ["Input validation", "Indicator handle setup", "Clean tick workflow"],
      },
      {
        title: "Review execution path",
        body: "A generated draft must contain a real order path when the goal is a tradable EA prototype.",
        bullets: ["CTrade or trade request", "Valid volume", "Valid SL and TP", "Result logging"],
      },
      {
        title: "Review risk gates",
        body: "Risk gates should be obvious. If they are not visible, they are hard to trust.",
        bullets: ["Spread guard", "Max open trades", "Daily loss guard", "Cooldown"],
      },
    ],
    checklist: ["Lifecycle functions present", "Trade path present", "Risk gates visible", "Inputs conservative", "Logs explain blocked trades"],
    cta: "Run Workfusion MQL5 Code Review and fix structural gaps before the next backtest.",
    related: ["mql5-oninit-ontick-ea-skeleton", "prepare-ea-for-strategy-tester", "expert-advisor-audit-trail"],
  },
};

export const resourceGuideSlugs = Object.keys(resourceGuides);

export function resourceGuidesByCluster() {
  return resourceGuideSlugs.reduce<Record<ResourceGuide["cluster"], ResourceGuide[]>>(
    (acc, slug) => {
      const guide = resourceGuides[slug];
      acc[guide.cluster].push(guide);
      return acc;
    },
    {
      "Compiler Fixes": [],
      "EA Generation": [],
      "MT4 Debugging": [],
      "Prop Firm Risk": [],
      "Code Review": [],
    },
  );
}
