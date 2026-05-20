import fs from "fs";
import path from "path";

const root = process.cwd();
const today = process.env.WORKFUSION_GROWTH_DATE || new Date().toISOString().slice(0, 10);
const reportsDir = path.join(root, "reports", "growth");
const buildNotesFile = path.join(root, "src", "content", "workfusion", "build-notes.json");
const trackerFile = path.join(reportsDir, "workfusion_channel_tracker.csv");
const outboxFile = path.join(reportsDir, `workfusion_autopilot_outbox_${today}.json`);
const latestFile = path.join(reportsDir, "workfusion_autopilot_latest.md");
const websiteUrl = "https://www.workfusionapp.com";
const compilerFixerUrl = `${websiteUrl}/mql5-compiler-fixer`;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/u.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function appendTracker(row) {
  const current = fs.existsSync(trackerFile) ? fs.readFileSync(trackerFile, "utf8") : "";
  const key = [
    row.date,
    row.channel,
    row.sourceTag,
    row.targetPersona,
    row.assetOrThread,
    row.action,
  ].join(",");
  if (current.split(/\r?\n/).some((line) => line.startsWith(key))) return false;

  const line = [
    row.date,
    row.channel,
    row.sourceTag,
    row.targetPersona,
    row.assetOrThread,
    row.action,
    row.cta,
    row.owner,
    row.status,
    row.result,
    row.notes,
  ].map(csvEscape).join(",");

  fs.appendFileSync(trackerFile, current.endsWith("\n") || current.length === 0 ? `${line}\n` : `\n${line}\n`);
  return true;
}

function upsertBuildNote() {
  const notes = readJson(buildNotesFile, []);
  const id = `${today}-growth-autopilot-ea-debugging`;
  if (notes.some((note) => note.id === id)) return { id, inserted: false };

  const note = {
    id,
    date: today,
    title: "What Workfusion should help EA builders fix first",
    summary: "The highest-intent EA problems are compiler errors, invalid stops, no-trade backtests, and unclear risk controls.",
    tags: ["MT4", "MT5", "MQL debugging", "EA readiness"],
    body: [
      "Workfusion growth autopilot is publishing only to owned Workfusion channels by default. Third-party forums and social posts stay in a manual-review outbox unless official API posting is configured.",
      "The product focus remains narrow: generate EA drafts, debug MQL compiler errors, score readiness, organize projects, and download MQL outputs.",
      "The best first users are MQL developers, EA builders, prop-style traders who need risk checks, and educators who teach MetaTrader automation.",
      "Workfusion does not trade for users, does not request broker credentials, and does not promise profitable backtests."
    ],
    ctaLabel: "Open the EA builder resources",
    ctaHref: "/resources"
  };

  notes.unshift(note);
  writeJson(buildNotesFile, notes);
  return { id, inserted: true };
}

const buildNote = upsertBuildNote();

const outbox = {
  date: today,
  policy: {
    ownedChannelsAutopost: true,
    thirdPartyAutopost: false,
    reason: "External posting to LinkedIn/forums requires official API access, channel rules, rate limits, and human-quality checks. The autopilot prepares drafts but does not bot-post into third-party communities.",
  },
  publishedOwned: [
    {
      channel: "workfusion_updates",
      url: "/updates",
      buildNoteId: buildNote.id,
      status: buildNote.inserted ? "published_to_repo" : "already_present",
    },
  ],
  manualReviewQueue: [
    {
      channel: "LinkedIn",
      title: "Founder build note",
      url: "https://www.linkedin.com/feed/",
      shareUrl: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(websiteUrl)}`,
      websiteUrl,
      linkPolicy: "link_allowed",
      status: "manual_required",
      body: `I am building Workfusionapp for MT4/MT5 EA builders.\n\nThe current workflow:\n- describe an EA idea,\n- generate a complete MQL draft,\n- paste MetaEditor compiler errors,\n- get a corrected draft,\n- risk-check before manual backtesting,\n- download the MQL output.\n\nIt is not a signal service and does not promise trading performance.\n\nLooking for serious MQL4/MQL5 builders who want to test it and send direct feedback.\n\n${websiteUrl}`,
    },
    {
      channel: "MQL5 Forum",
      title: "Invalid stops reply",
      url: "https://www.mql5.com/en/forum/509214",
      websiteUrl,
      linkPolicy: "no_link_recommended",
      status: "manual_required",
      body: "This is probably not the EA blocking the stop by itself. It is usually the trade server rejecting the stop distance at the exact moment the EA sends or modifies the order. Check Bid/Ask, spread, stop level, freeze level, normalized prices, and print exact retcodes for every failed modify.",
    },
    {
      channel: "MQL5 Forum",
      title: "HistoryDeals compile-error reply",
      url: "https://www.mql5.com/en/forum/492730",
      websiteUrl: compilerFixerUrl,
      linkPolicy: "link_allowed_relevant",
      status: "manual_required",
      body: `The first thing I would isolate is whether the root problem is the include or the code.\n\nIn MT5, many history/deal functions are available through the standard MQL5 API, so manually adding random HistoryDeals.mqh files can create conflicts and ambiguous calls.\n\nI would test this in order:\n1. Remove manually downloaded duplicate include files.\n2. Compile a minimal EA with the built-in history functions.\n3. Confirm you are editing inside the correct MT5 Data Folder.\n4. Avoid mixing MT4-style account/history functions with MQL5 deal-history functions.\n5. Fix the first compiler error before chasing the later cascade errors.\n\nIf useful, this is the kind of MQL5 compiler workflow Workfusion is built to help with:\n${compilerFixerUrl}`,
    },
    {
      channel: "Forex Factory",
      title: "Magic-number evaluation reply",
      url: "https://www.forexfactory.com/forum/69-platform-tech",
      websiteUrl,
      linkPolicy: "no_link_recommended",
      status: "manual_required",
      body: "This can be done from MT5 history if each EA uses a unique Magic Number. Use HistorySelect, loop through deals, group by DEAL_MAGIC, and sum profit/swap/commission while filtering entry types so you do not double-count.",
    },
  ],
};

writeJson(outboxFile, outbox);

appendTracker({
  date: today,
  channel: "Workfusion owned site",
  sourceTag: "updates_build_notes",
  targetPersona: "mq5_developer",
  assetOrThread: "/updates",
  action: "Autopilot published owned-channel build note",
  cta: "Open resources",
  owner: "autopilot",
  status: "published_to_repo",
  result: buildNote.inserted ? "new_build_note" : "already_present",
  notes: "External LinkedIn/forum posts remain manual_required by policy",
});

fs.writeFileSync(latestFile, [
  `# Workfusion Growth Autopilot - ${today}`,
  "",
  "## Result",
  "",
  `- Owned-site post: ${buildNote.inserted ? "published to repo" : "already present"}`,
  "- Third-party posting: manual_required",
  "- Outbox generated for LinkedIn/forums",
  "",
  "## Published Owned Channel",
  "",
  "- `/updates`",
  "",
  "## Guardrail",
  "",
  "The autopilot does not bot-post into LinkedIn, MQL5, EarnForex, Forex Factory, Reddit, YouTube, or private inboxes. Use official APIs and explicit channel rules before enabling any external posting.",
  "",
].join("\n"));

console.log(JSON.stringify({
  ok: true,
  date: today,
  buildNote,
  outbox: path.relative(root, outboxFile),
  latest: path.relative(root, latestFile),
}, null, 2));
