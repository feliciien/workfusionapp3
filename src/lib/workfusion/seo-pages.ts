export type SeoLanding = {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  h1: string;
  audience: string;
  problem: string;
  outcome: string;
  source: string;
  persona: string;
  bullets: string[];
  workflow: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export const seoLandings: Record<string, SeoLanding> = {
  "mql5-compiler-fixer": {
    slug: "mql5-compiler-fixer",
    title: "MQL5 Compiler Fixer",
    metaTitle: "MQL5 Compiler Fixer | Fix MT5 EA Errors",
    description: "Fix common MQL5 and MetaEditor errors, generate a complete corrected EA draft, and run a compile-aware readiness check.",
    eyebrow: "MQL5 compiler fixer",
    h1: "Fix MQL5 compiler errors before they slow down your EA build.",
    audience: "For MT5 EA builders who paste MetaEditor errors and need a complete corrected draft.",
    problem: "Compiler errors like undeclared identifier, invalid stops, missing trade object, and incomplete lifecycle functions break momentum.",
    outcome: "Workfusion turns the error context into a complete fixed EA draft with risk guards, then routes it through the compiler worker when available.",
    source: "seo_mql5_compiler_fixer",
    persona: "mq5_developer",
    bullets: ["Paste MQL5 code and compiler output", "Get a full fixed draft, not a tiny snippet", "Run static checks and MetaEditor compilation", "Keep risk guards visible before download"],
    workflow: ["Paste code and errors", "Generate a fixed EA draft", "Compile check with MetaEditor", "Download and continue manual testing"],
    faqs: [
      { question: "Does this replace MetaEditor?", answer: "No. It prepares and fixes code, then uses MetaEditor when the compiler worker is online." },
      { question: "Can it guarantee a profitable EA?", answer: "No. It is a coding and readiness workflow, not a trading performance promise." },
    ],
  },
  "mt5-ea-generator": {
    slug: "mt5-ea-generator",
    title: "MT5 EA Generator",
    metaTitle: "MT5 EA Generator | Build MQL5 Expert Advisor Drafts",
    description: "Generate MT5 Expert Advisor drafts from strategy ideas with MQL5 structure, risk gates, and download-ready code output.",
    eyebrow: "MT5 EA generator",
    h1: "Turn an MT5 strategy idea into a complete EA draft.",
    audience: "For traders and builders who need a structured MQL5 starting point instead of a blank editor.",
    problem: "Most strategy ideas die between the notebook and MetaEditor because code structure, sizing, and risk gates are missing.",
    outcome: "Workfusion converts the brief into a compile-aware EA draft with OnInit, OnTick, sizing logic, and prop-style risk controls.",
    source: "seo_mt5_ea_generator",
    persona: "mq5_developer",
    bullets: ["Generate MQL5 EA scaffolds from plain English", "Include risk, spread, and session controls", "Save projects and download outputs", "Move faster without hiding testing requirements"],
    workflow: ["Describe market and entry logic", "Choose MT5 and risk profile", "Generate the EA draft", "Compile, backtest, and iterate"],
    faqs: [
      { question: "Is this a signal system?", answer: "No. It is a development assistant for EA code, debugging, and review." },
      { question: "Can it create a final production EA?", answer: "It can create a serious draft, but you still need manual review, Strategy Tester validation, and demo forward testing." },
    ],
  },
  "mt4-ea-debugger": {
    slug: "mt4-ea-debugger",
    title: "MT4 EA Debugger",
    metaTitle: "MT4 EA Debugger | Fix MQL4 Expert Advisor Drafts",
    description: "Debug MQL4 Expert Advisor code, identify missing functions and risky patterns, and generate a cleaner MT4-ready draft.",
    eyebrow: "MT4 EA debugger",
    h1: "Clean up MT4 EA code before the next compile pass.",
    audience: "For MT4 developers fixing legacy EAs, partial snippets, or broken MQL4 logic.",
    problem: "MQL4 projects often mix old patterns, missing guards, and unclear order handling that make debugging slow.",
    outcome: "Workfusion reviews the code, explains likely failures, and returns a safer draft with clearer structure and checks.",
    source: "seo_mt4_ea_debugger",
    persona: "mt4_developer",
    bullets: ["Paste MQL4 code and errors", "Get issue and fix lists", "Flag martingale/grid risk language", "Prepare cleaner code for manual MetaEditor testing"],
    workflow: ["Paste the broken EA", "Add compiler errors", "Generate a fixed draft", "Review and test in MT4"],
    faqs: [
      { question: "Does real compile support MT4?", answer: "The production compiler worker is currently optimized for MT5 .mq5 compilation. MT4 code still gets debug and static review." },
      { question: "Will it rewrite unsafe sizing?", answer: "It flags dangerous patterns and pushes the draft toward explicit risk controls." },
    ],
  },
  "prop-firm-ea-risk-checker": {
    slug: "prop-firm-ea-risk-checker",
    title: "Prop Firm EA Risk Checker",
    metaTitle: "Prop Firm EA Risk Checker | Drawdown and Readiness Review",
    description: "Review Expert Advisor drafts for drawdown, spread, sizing, trade frequency, and prop-firm style risk readiness.",
    eyebrow: "Prop firm EA risk checker",
    h1: "Risk-check your EA draft before using it around prop-firm rules.",
    audience: "For prop challenge traders who need disciplined EA development and owner-reviewed risk controls.",
    problem: "A draft can compile and still violate daily loss, spread, sizing, or overtrading discipline.",
    outcome: "Workfusion scores readiness, flags missing controls, and keeps the workflow focused on software quality rather than profit promises.",
    source: "seo_prop_firm_ea_risk_checker",
    persona: "prop_trader",
    bullets: ["Check max daily loss and spread guard language", "Score funding readiness", "Review dangerous sizing patterns", "Keep testing and promotion gates explicit"],
    workflow: ["Paste or generate EA code", "Run risk/readiness scoring", "Review warnings", "Backtest and demo forward test manually"],
    faqs: [
      { question: "Does this help pass prop challenges automatically?", answer: "No. It helps review software and risk controls. Results still depend on strategy, execution, broker conditions, and testing." },
      { question: "Does it trade live?", answer: "No. Workfusion does not execute trades or manage accounts." },
    ],
  },
  "mql5-code-review": {
    slug: "mql5-code-review",
    title: "MQL5 Code Review",
    metaTitle: "MQL5 Code Review | Expert Advisor Readiness Check",
    description: "Review MQL5 Expert Advisor code for lifecycle structure, trade calls, risk gates, and readiness before backtesting.",
    eyebrow: "MQL5 code review",
    h1: "Review MQL5 EA code for structure, risk, and readiness.",
    audience: "For developers who want a second pass before spending time in Strategy Tester.",
    problem: "Small missing pieces in lifecycle, sizing, spread filters, or trade limits can waste hours of test time.",
    outcome: "Workfusion checks the EA draft, explains weak spots, and helps organize the next build/test iteration.",
    source: "seo_mql5_code_review",
    persona: "mq5_developer",
    bullets: ["Review OnInit and OnTick structure", "Detect missing execution and sizing functions", "Flag incomplete templates", "Prepare clean next actions for testing"],
    workflow: ["Paste the EA draft", "Run debug or compile check", "Review diagnostics", "Save the project and iterate"],
    faqs: [
      { question: "Can it review code I already wrote?", answer: "Yes. Paste your MQL5 code into the debugger or compiler check and review the diagnostics." },
      { question: "Does it store my broker credentials?", answer: "No. The workflow does not require broker credentials or trading account access." },
    ],
  },
};

export const seoSlugs = Object.keys(seoLandings);
