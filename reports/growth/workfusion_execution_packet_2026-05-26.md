# Workfusion Execution Packet - 2026-05-26

## Open These Links

Production:

- Owner growth dashboard: https://www.workfusionapp.com/growth
- Support API: https://www.workfusionapp.com/api/support/messages?limit=50
- Growth/lead API: https://www.workfusionapp.com/api/admin/growth
- Support form: https://www.workfusionapp.com/#support
- MQL5 compiler fixer: https://www.workfusionapp.com/mql5-compiler-fixer
- Unsupported filling guide: https://www.workfusionapp.com/resources/fix-mql5-unsupported-filling-mode
- Payout tracker: https://www.workfusionapp.com/prop-firm-payout-tracker
- Resources hub: https://www.workfusionapp.com/resources

Local app started by Codex:

- Local product: http://127.0.0.1:3010
- Local growth dashboard UI: http://127.0.0.1:3010/growth
- Local compiler fixer page: http://127.0.0.1:3010/mql5-compiler-fixer
- Local payout tracker page: http://127.0.0.1:3010/prop-firm-payout-tracker

Local note: this checkout has no `.env`, so local `/growth` will not show live CRM data unless `DATABASE_URL` and `WORKFUSION_ADMIN_TOKEN` are exported before starting the app.

## Admin Setup

Do not paste tokens into chat. Export the owner token only in your terminal:

```bash
export WF_BASE="https://www.workfusionapp.com"
export WF_ADMIN_TOKEN="replace-with-owner-token"
```

Fetch live support tickets:

```bash
curl -sS "$WF_BASE/api/support/messages?limit=50" \
  -H "x-workfusion-admin-token: $WF_ADMIN_TOKEN" \
  > /tmp/workfusion_support.json
```

List open compiler-error tickets:

```bash
jq '.messages[]
  | select(.status == "open")
  | select(.category == "compiler_error" or .ai.category == "compiler_error")
  | {
      id,
      email,
      createdAt,
      page,
      subject,
      summary: .ai.summary,
      suggestedAction: .ai.suggestedAction,
      message
    }' /tmp/workfusion_support.json
```

Fetch growth leads:

```bash
curl -sS "$WF_BASE/api/admin/growth" \
  -H "x-workfusion-admin-token: $WF_ADMIN_TOKEN" \
  > /tmp/workfusion_growth.json
```

List new opt-in leads:

```bash
jq '.leads[]
  | select(.stage == "new" or .stage == "researching")
  | {
      id,
      email,
      persona,
      source,
      stage,
      score,
      notes,
      createdAt
    }' /tmp/workfusion_growth.json
```

## Today: Close Or Reproduce 6 Compiler Tickets

For each ticket, capture:

- ticket id
- email
- original `.mq4` or `.mq5` if available
- first MetaEditor compiler error block
- full generated output version
- user prompt/config
- platform: MT4 or MT5
- market/symbol
- whether remote compile passes or fails
- final status: `replied`, `blocked`, or `closed`

Use these support statuses only:

- `open`
- `replied`
- `blocked`
- `closed`

If the ticket lacks the original file/log, mark it blocked and ask for the missing evidence:

```bash
curl -sS -X PATCH "$WF_BASE/api/support/messages" \
  -H "content-type: application/json" \
  -H "x-workfusion-admin-token: $WF_ADMIN_TOKEN" \
  --data '{
    "id": "support_replace_me",
    "status": "blocked",
    "blocker": "missing_original_mq5_or_compile_log",
    "ownerNotes": "Asked user for original MQ4/MQ5, first MetaEditor error block, platform, symbol, and generated output version.",
    "replyDraft": "Hi, I can reproduce this properly if you send the original .mq4/.mq5 file plus the first MetaEditor error block. Please include the platform, symbol, and the prompt/config used to generate the file. I will focus on the first compiler error before chasing the cascade. No broker access or trading credentials needed."
  }'
```

If you reproduced and fixed it, mark replied:

```bash
curl -sS -X PATCH "$WF_BASE/api/support/messages" \
  -H "content-type: application/json" \
  -H "x-workfusion-admin-token: $WF_ADMIN_TOKEN" \
  --data '{
    "id": "support_replace_me",
    "status": "replied",
    "blocker": "compiler_error_reproduced",
    "ownerNotes": "Reproduced, identified first compiler blocker, sent exact fix and next compile step.",
    "replyDraft": "Hi, I reproduced the compile issue. The first blocker is [short root cause]. Fix [exact line/object/include/signature]. After that, recompile before changing strategy logic because later errors may be cascade errors. Send the next first error if MetaEditor still fails."
  }'
```

If the latest generated file compiles and no original evidence exists, do not overclaim. Reply like this:

```text
Hi,

I ran a fresh reproduction against the same workflow and the current MT5 compile path passed. I cannot confirm the original failure without the exact generated file and the first MetaEditor error block from your machine.

Please send:
1. the original .mq5 file,
2. the first MetaEditor error block,
3. the symbol/timeframe,
4. whether this was generated, debugged, or manually edited after download.

I will review the first compiler blocker directly. No broker credentials or trading account access needed.
```

## Next: Reply To 7 Opt-In Leads

Use one human-reviewed email per lead. Do not pitch.

```text
Subject: Quick review of your Workfusion EA workflow

Hi [Name],

Thanks for opting in. I am reviewing a few real MT4/MT5 EA workflows manually this week.

If you are blocked, send the EA goal plus either:
1. the first MetaEditor compiler error block,
2. the generated .mq4/.mq5 file, or
3. the tester/runtime issue you are seeing.

I will reply with the exact next debugging step. No broker access, no trading credentials, and no performance promises. This is only a software workflow review.

Felicien
```

After sending, mark the lead contacted:

```bash
curl -sS -X PATCH "$WF_BASE/api/admin/growth" \
  -H "content-type: application/json" \
  -H "x-workfusion-admin-token: $WF_ADMIN_TOKEN" \
  --data '{
    "id": "lead_replace_me",
    "stage": "contacted",
    "contacted": true,
    "score": 70,
    "notes": "Sent manual workflow review offer on 2026-05-26. Asked for EA goal plus first compiler/tester blocker."
  }'
```

## Then: Manual MQL5 Answers

Link policy:

- Answer the technical issue first.
- No link on the first two replies.
- Add one Workfusion link only when it directly helps the next debugging step.
- Never promise profitable EAs, prop-firm passing, or compile success for arbitrary code.

Start here:

- MQL5 forum: https://www.mql5.com/en/forum
- Recent invalid stops/CTrade thread: https://www.mql5.com/en/forum/509749
- Recent CopyBuffer thread: https://www.mql5.com/en/forum/510006
- Strategy Tester ends fast thread: https://www.mql5.com/en/forum/503765
- CTrade undeclared identifier examples: https://www.mql5.com/en/forum/464145 and https://www.mql5.com/en/forum/452078

Invalid stops reply:

```text
I would debug this from the trade-server rules first, not the strategy condition.

Before sending or modifying the order, print:
- Bid and Ask,
- SYMBOL_TRADE_STOPS_LEVEL,
- SYMBOL_TRADE_FREEZE_LEVEL,
- _Point and SYMBOL_TRADE_TICK_SIZE,
- the normalized SL/TP you are about to send,
- trade.ResultRetcode() and trade.ResultRetcodeDescription().

For a buy, SL must be below the current bid/entry side by at least the stop distance. For a sell, SL must be above the ask/entry side by at least the stop distance. Also check that the freeze level is not blocking modification after entry.

Do this before changing the strategy logic because otherwise you can hide a broker-specification error inside random stop-distance changes.
```

CopyBuffer reply:

```text
The first thing to check is whether the buffer index matches the indicator handle.

For built-in iMA, there is only one data buffer, so CopyBuffer(handle, 0, ...) is the normal call. Buffer indexes 1 or 2 are usually for indicators that actually expose multiple buffers, often through iCustom or multi-buffer custom indicators.

Also check:
- handle != INVALID_HANDLE in OnInit,
- BarsCalculated(handle) is enough before copying,
- CopyBuffer return value is the copied count, so treat <= 0 as failure,
- arrays are sized/series-aligned consistently.

If the first CopyBuffer succeeds and later ones fail, inspect the exact handle and buffer index for each call before changing the calculation logic.
```

CTrade/undeclared identifier reply:

```text
This looks like an object declaration/name issue before it is a trading issue.

Check that the EA has:

#include <Trade/Trade.mqh>
CTrade trade;

Then call the same object name consistently:

trade.Buy(...);
trade.Sell(...);
trade.PositionModify(...);

If your code declares `CTrade trade;` but calls `Trade.Buy(...)`, MetaEditor will correctly report `Trade` as undeclared because MQL5 identifiers are case-sensitive. Fix the first compiler error, then recompile before chasing the later cascade errors.
```

No-trades/tester reply:

```text
I would separate "EA did not signal" from "tester environment blocked execution."

Check the Journal first for:
- not enough money,
- invalid volume,
- market closed,
- invalid stops,
- unsupported filling mode,
- no history/ticks,
- symbol suffix mismatch,
- spread filter blocking every entry.

Then add one PrintFormat at the final entry gate showing each condition value. If the tester only generates a small number of bars/ticks, fix history/symbol/test range before changing strategy logic.
```

Optional link only when directly useful:

```text
If useful, this Workfusion page is built around this exact workflow: paste the first MetaEditor/runtime error, keep the EA context, then generate a corrected draft before the next compile pass:
https://www.workfusionapp.com/mql5-compiler-fixer
```

## After Support Is Stable: Expand Payout Tracker

Use the converting page first:

- https://www.workfusionapp.com/prop-firm-payout-tracker

Expansion angle:

- add a short worked example for account size, equity, daily PnL, min trading days, and open exposure
- add one CTA: "Track govern interest"
- keep it separate from trading execution
- no payout guarantees
- no account access request

Draft CTA:

```text
Check the account state before changing risk: target remaining, daily loss buffer, total drawdown buffer, minimum trading days, open exposure, and payout review status.
```

## End-Of-Day Scorecard

Record:

- support tickets closed
- support tickets blocked for missing MQ/log evidence
- support tickets reproduced with compile evidence
- opt-in leads contacted
- replies received
- forum answers posted
- links used
- page/lead movement for compiler fixer and payout tracker
