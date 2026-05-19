# Workfusion Community Post Templates

Use these as starting points. Rewrite each one for the exact context before posting.

## LinkedIn Build Note

I am building Workfusion, an AI EA Generator + Debugger for MT4/MT5 traders.

The current workflow:

- describe an EA idea,
- generate a complete MQL draft,
- paste MetaEditor compiler errors,
- get a corrected draft,
- run risk/readiness checks,
- compile through MetaEditor when the worker is online,
- download the MQL output.

It is not a signal service and does not promise trading performance. The goal is to reduce the time between idea, compile, review, and backtest.

Looking for serious MQL4/MQL5 builders who want to test the workflow and give direct feedback.

## Forum Answer Pattern

Short answer: this looks like a `[specific issue]` problem, not a strategy problem.

I would check:

1. `[first concrete fix]`
2. `[second concrete fix]`
3. `[third concrete fix]`

The key is to fix the first compiler/runtime error before chasing the later cascade.

I wrote a practical checklist here if useful: `[specific Workfusion guide URL]`.

## Reddit Educational Post

Title: A simple checklist before backtesting a new MT5 EA draft

Before running Strategy Tester on a new EA, I check:

- clean compile,
- no template placeholders,
- OnInit and OnTick present,
- clear entry and exit path,
- spread guard,
- max open trades,
- risk-based sizing,
- logging for blocked trades,
- short smoke test before long backtest.

This saves time because many failed backtests are not strategy failures. They are code, filter, permission, or setup failures.

I am building Workfusion to automate parts of that workflow for MT4/MT5 EA builders.

## Opt-In Email 1

Subject: Workfusion EA builder workflow is live

Hi,

Thanks for joining the Workfusion EA builder list.

The current workflow lets you generate MT4/MT5 EA drafts, debug compiler errors, run risk/readiness checks, save projects, and download MQL outputs.

Best first test:

1. Paste one strategy idea or broken EA snippet.
2. Generate or debug the draft.
3. Run compile/readiness checks.
4. Reply with the error or limitation you hit.

This is a development tool, not a signal service and not a profit promise.

Felicien

## Opt-In Email 2

Subject: What broke when you tested your EA draft?

Hi,

Quick question: where does your EA workflow usually fail?

- converting the idea into MQL,
- MetaEditor compiler errors,
- invalid stops or order errors,
- no trades in Strategy Tester,
- too many trades,
- risk/drawdown controls,
- project organization.

Reply with the issue and I will use it to improve the next Workfusion update.

Felicien

