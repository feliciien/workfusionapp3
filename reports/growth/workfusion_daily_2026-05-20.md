# Workfusion Growth Routine - 2026-05-20

## Owner Console

- `/growth` opened locally at `http://localhost:3010/growth`.
- Page health checked: `/growth` returned HTTP 200.
- Admin data still requires owner session or `WORKFUSION_ADMIN_TOKEN`.

## Rule For Today

Workfusionapp only. No BoltIQ partner materials, trading telemetry, broker details, hedge-fund plans, or internal reports.

No scraping. No bought lists. No mass DMs. Only public, relevant, helpful replies and opt-in follow-up.

## Opportunity 1 - No Link Reply

Channel: MQL5 Forum  
Source tag: `mql5_codebase_forum`  
Thread: `EA stop trading because of Invalid stops,Why?`  
Fit: user has a direct MT5 EA stop-loss / invalid stops problem on XAUUSD.

Draft reply:

```text
This is probably not the EA "blocking" the stop by itself. It is usually the trade server rejecting the stop distance at the exact moment the EA sends/modifies the order.

For XAUUSD, check more than just Stop Level:

1. Compare the stop against Bid/Ask, not only the chart price.
2. Include the current spread. A 10-point stop can end up inside the spread.
3. Check SYMBOL_TRADE_STOPS_LEVEL and SYMBOL_TRADE_FREEZE_LEVEL.
4. Normalize the price with the symbol digits before sending the modify request.
5. Print the exact Bid, Ask, spread, SL, stop distance in points, and retcode for every failed modify.

For buy positions, the SL must be below Bid by enough points. For sell positions, the SL must be above Ask by enough points. If the spread is wider than the stop distance, manual tests can appear to work sometimes while the EA fails during volatility.
```

Status: drafted, not posted by automation.

## Opportunity 2 - No Link Reply

Channel: Forex Factory Platform Tech  
Source tag: `forexfactory_platform_tech`  
Thread: `evaluation EAs by magic number - MT5`  
Fit: user asks for a tool/script to evaluate different EAs by magic number from MT5 history.

Draft reply:

```text
Yes, this can be done from MT5 history if each EA uses a unique Magic Number.

The clean approach is:

1. Run HistorySelect(from, to).
2. Loop through HistoryDealsTotal().
3. Read each deal with HistoryDealGetTicket(i).
4. Group by DEAL_MAGIC.
5. Sum DEAL_PROFIT + DEAL_SWAP + DEAL_COMMISSION by magic number.
6. Count entries/exits and optionally calculate win rate, gross profit, gross loss, profit factor, and average trade.

Important: use deals, not only orders, because closed PnL is on deal history. Also filter by DEAL_ENTRY so you do not double-count entries/exits incorrectly.

For a quick first version, export the MT5 account history as CSV and group by Magic Number in Python/Excel. For a native version, an MT5 script can print one summary row per magic number.
```

Status: drafted, not posted by automation.

## Opportunity 3 - Link Allowed If Context Fits

Channel: MQL5 Forum  
Source tag: `mql5_codebase_forum`  
Thread: `Persistent MQL5 Compilation Errors: HistoryDeals.mqh Not Found / Ambiguous Calls / Undeclared Identifiers`  
Fit: user has compiler errors, missing include, undeclared identifiers, and ambiguous calls. Workfusion MQL5 compiler fixer is directly relevant after the technical answer.

Draft reply:

```text
The first thing I would isolate is whether the root problem is the include or the code.

In MT5, many history/deal functions are available through the standard MQL5 API, so manually adding random HistoryDeals.mqh files can create conflicts and ambiguous calls. I would test this in order:

1. Remove manually downloaded or duplicated include files.
2. Compile a minimal EA using only the built-in history functions you need.
3. Confirm you are editing inside the correct MT5 Data Folder, not a different terminal install.
4. Avoid mixing MT4-style account/history functions with MQL5 deal-history functions.
5. Fix the first compiler error only, then recompile. Many later "undeclared identifier" errors are just cascade errors.

For OnTradeTransaction, start with a minimal handler that prints transaction type, deal ticket, symbol, magic, and profit before adding grid or pending-order logic.

I also keep a compiler-fix workflow/checklist here if useful:
https://www.workfusionapp.com/mql5-compiler-fixer

It is a development/debugging workflow only, not a signal service or profit promise.
```

Status: drafted, not posted by automation.

## LinkedIn Post Draft

```text
I am building Workfusionapp for MT4/MT5 EA builders.

Today’s pattern from public EA questions is very clear:

- invalid stops on XAUUSD,
- MT5 history/deal functions causing compile errors,
- people wanting to evaluate multiple EAs by magic number.

Most of these are not strategy problems at first. They are development workflow problems:

1. generate a complete EA draft,
2. compile it,
3. fix the first compiler error,
4. log why trades are blocked,
5. risk-check the draft,
6. only then backtest manually.

Workfusionapp is built for that workflow: AI EA generation, MQL debugging, risk/readiness scoring, project organization, and downloadable MQL outputs.

It is not a signal service and does not promise trading performance.

Looking for serious MQL4/MQL5 builders who want to test it and send direct feedback.
```

Status: drafted, not posted by automation.

## Tracker Updates

- 3 high-intent public opportunities found.
- 2 no-link replies drafted.
- 1 link-allowed reply drafted.
- 1 LinkedIn post drafted.
- No private messages sent.
- No emails scraped.
- No forum/LinkedIn posts made by automation.

