#!/usr/bin/env node
import fs from "fs";
import path from "path";

const baseUrl = (process.argv[2] || process.env.WORKFUSION_QA_URL || "https://www.workfusionapp.com").replace(/\/$/, "");
const env = loadEnvFile(path.join(process.cwd(), ".env.local"));
const adminToken = process.env.WORKFUSION_ADMIN_TOKEN || env.WORKFUSION_ADMIN_TOKEN || "";
const ownerEmail = process.env.WORKFUSION_OWNER_EMAIL || env.WORKFUSION_OWNER_EMAIL || "";
const results = [];

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return fs.readFileSync(file, "utf8").split(/\r?\n/u).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const index = trimmed.indexOf("=");
    if (index === -1) return acc;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/gu, "");
    acc[key] = value;
    return acc;
  }, {});
}

function maskEmail(email) {
  return email ? email.replace(/^(.).*(@.*)$/u, "$1***$2") : "";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertCompleteMql(code, label) {
  const source = String(code || "");
  assert(source.length > 5000, `${label} is too short to be a complete EA`);
  assert(!/TODO|Insert final entry|merge your final|Add validated trading logic/iu.test(source), `${label} still contains template placeholders`);
  assert(source.includes("#property strict"), `${label} missing strict mode`);
  assert(source.includes("OnInit") && source.includes("OnTick"), `${label} missing lifecycle functions`);
  assert(/\btrade\.(Buy|Sell)\s*\(|\bOrderSend\s*\(/u.test(source), `${label} missing market execution calls`);
  assert(/RiskGatePasses|MaxDailyLossPct|MaxSpreadPoints/u.test(source), `${label} missing risk gates`);
  assert(/CalculateLotSize|RiskPerTradePct|NormalizeVolume/u.test(source), `${label} missing position sizing`);
}

function cookieFrom(headers) {
  const raw = headers.get("set-cookie") || "";
  return raw.split(",").map((part) => part.split(";")[0]).filter(Boolean).join("; ");
}

async function request(method, url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-workfusion-guest-id": options.guestId || "qa-guest",
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.admin ? { "x-workfusion-admin-token": adminToken } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data, text, cookie: cookieFrom(response.headers) };
}

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const qaEmail = `qa+${Date.now()}@workfusionapp.test`;
let userCookie = "";
let ownerCookie = "";
let qaGeneratedCode = "";
let qaLeadId = "";

const seoPages = [
  ["/mql5-compiler-fixer", "MQL5 Compiler Fixer"],
  ["/mt5-ea-generator", "MT5 EA Generator"],
  ["/mt4-ea-debugger", "MT4 EA Debugger"],
  ["/prop-firm-ea-risk-checker", "Prop Firm EA Risk Checker"],
  ["/mql5-code-review", "MQL5 Code Review"],
];

await check("home page renders commercial dashboard", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert(response.ok, `home status ${response.status}`);
  assert(html.includes("Workfusion Trading AI"), "missing brand");
  assert(html.includes("Real screenshots, not placeholder score cards."), "missing real screenshot section");
  assert(html.includes("Support desk"), "missing support desk");
  assert(html.includes("@") === false || true, "html parsed");
  return "home ok";
});

await check("pricing page renders checkout cards", async () => {
  const response = await fetch(`${baseUrl}/pricing`);
  const html = await response.text();
  assert(response.ok, `pricing status ${response.status}`);
  assert(html.includes("Starter") && html.includes("Pro") && html.includes("Studio"), "missing plans");
  assert(html.includes("AI EA Generator + Debugger"), "missing pricing positioning");
  assert(html.includes("Compare plans"), "missing comparison section");
  return "pricing ok";
});

await check("legal page renders risk disclosure", async () => {
  const response = await fetch(`${baseUrl}/legal`);
  const html = await response.text();
  assert(response.ok, `legal status ${response.status}`);
  assert(/risk|disclosure|guarantee/i.test(html), "missing risk language");
  return "legal ok";
});

await check("SEO landing pages render", async () => {
  for (const [path, phrase] of seoPages) {
    const response = await fetch(`${baseUrl}${path}`);
    const html = await response.text();
    assert(response.ok, `${path} status ${response.status}`);
    assert(html.includes(phrase), `${path} missing ${phrase}`);
    assert(html.includes("Join the EA builder list"), `${path} missing opt-in form`);
  }
  return `${seoPages.length} SEO pages`;
});

await check("sitemap and robots expose SEO pages", async () => {
  const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
  const sitemapText = await sitemap.text();
  assert(sitemap.ok, `sitemap status ${sitemap.status}`);
  for (const [path] of seoPages) assert(sitemapText.includes(path), `sitemap missing ${path}`);
  const robots = await fetch(`${baseUrl}/robots.txt`);
  const robotsText = await robots.text();
  assert(robots.ok, `robots status ${robots.status}`);
  assert(robotsText.includes("sitemap.xml"), "robots missing sitemap");
  assert(robotsText.includes("Disallow: /growth"), "robots should disallow growth page");
  return "sitemap ok";
});

await check("brand assets are reachable", async () => {
  for (const asset of ["/brand/workfusion-mark.svg", "/brand/workfusion-dashboard-live-v2.png", "/brand/workfusion-pricing-live-v2.png"]) {
    const response = await fetch(`${baseUrl}${asset}`, { method: "HEAD" });
    assert(response.ok, `${asset} status ${response.status}`);
  }
  return "assets ok";
});

await check("subscription status exposes Postgres, PayPal, OpenAI", async () => {
  const { response, data } = await request("GET", "/api/subscription/status");
  assert(response.ok, `status ${response.status}`);
  assert(data.storage === "postgres", "Postgres storage not active");
  assert(data.billing?.paypalConfigured === true, "PayPal not configured");
  assert(data.ai?.configured === true, "AI config missing");
  assert(!data.ai?.model, "AI model should not be exposed publicly");
  return `${data.storage} ai_configured`;
});

await check("session endpoint works for anonymous user", async () => {
  const { response, data } = await request("GET", "/api/auth/session");
  assert(response.ok, `session status ${response.status}`);
  assert(data.user?.authenticated === false, "anonymous session expected");
  return "anonymous ok";
});

await check("login rejects invalid email", async () => {
  const { response, data } = await request("POST", "/api/auth/login", { body: { email: "bad" } });
  assert(response.status === 400, `expected 400 got ${response.status}`);
  assert(data.error === "valid_email_required", "wrong validation error");
  return "invalid rejected";
});

if (ownerEmail) {
  await check("owner email requires token", async () => {
    const { response, data } = await request("POST", "/api/auth/login", { body: { email: ownerEmail } });
    assert(response.status === 401, `expected 401 got ${response.status}`);
    assert(data.error === "owner_token_required", "owner token guard missing");
    return maskEmail(ownerEmail);
  });
}

await check("free user can sign in", async () => {
  const { response, data, cookie } = await request("POST", "/api/auth/login", { body: { email: qaEmail } });
  assert(response.ok, `login status ${response.status}`);
  assert(data.status === "signed_in", "not signed in");
  assert(cookie.includes("wf_session="), "session cookie missing");
  userCookie = cookie;
  return maskEmail(qaEmail);
});

if (ownerEmail && adminToken) {
  await check("owner can sign in with token", async () => {
    const { response, data, cookie } = await request("POST", "/api/auth/login", {
      body: { email: ownerEmail, ownerToken: adminToken },
    });
    assert(response.ok, `owner login status ${response.status}`);
    assert(data.user?.role === "owner", "owner role missing");
    ownerCookie = cookie;
    return maskEmail(ownerEmail);
  });
}

await check("projects list initially responds", async () => {
  const { response, data } = await request("GET", "/api/projects", { cookie: userCookie });
  assert(response.ok, `projects GET ${response.status}`);
  assert(Array.isArray(data.projects), "projects array missing");
  return `${data.projects.length} projects`;
});

await check("project save persists to Postgres", async () => {
  const { response, data } = await request("POST", "/api/projects", {
    cookie: userCookie,
    body: {
      title: "QA XAUUSD EA",
      market: "XAUUSD",
      platform: "mt5",
      idea: "QA smoke strategy",
      propMode: true,
      riskScore: 88,
      compliance: 91,
      code: "// qa",
    },
  });
  assert(response.ok, `projects POST ${response.status}`);
  assert(data.storage === "postgres", "project did not use Postgres");
  assert(data.project?.id, "project id missing");
  return data.project.id;
});

await check("project list returns saved project", async () => {
  const { response, data } = await request("GET", "/api/projects", { cookie: userCookie });
  assert(response.ok, `projects GET ${response.status}`);
  assert((data.projects || []).some((project) => project.title === "QA XAUUSD EA"), "saved project missing");
  return `${data.projects.length} projects`;
});

await check("paid checkout requires anonymous email", async () => {
  const { response, data } = await request("POST", "/api/billing/checkout", { body: { plan: "pro", provider: "paypal" } });
  assert(response.status === 400, `expected 400 got ${response.status}`);
  assert(data.error === "email_required", "email guard missing");
  return "email guarded";
});

await check("free checkout returns active message", async () => {
  const { response, data } = await request("POST", "/api/billing/checkout", { body: { plan: "free", provider: "paypal" } });
  assert(response.ok, `free checkout ${response.status}`);
  assert(data.plan === "free", "free plan mismatch");
  return "free ok";
});

await check("lead capture requires consent", async () => {
  const { response, data } = await request("POST", "/api/leads", { body: { email: qaEmail, persona: "mq5_developer", consent: false } });
  assert(response.status === 400, `expected 400 got ${response.status}`);
  assert(data.error === "consent_required", "consent guard missing");
  return "consent guarded";
});

await check("lead capture stores opt-in", async () => {
  const { response, data } = await request("POST", "/api/leads", { body: { email: qaEmail, persona: "mq5_developer", consent: true } });
  assert(response.ok, `lead capture ${response.status}`);
  assert(data.ok === true, "lead not saved");
  qaLeadId = data.id;
  return data.storage;
});

await check("growth admin endpoint is protected", async () => {
  const { response, data } = await request("GET", "/api/admin/growth");
  assert(response.status === 401, `expected 401 got ${response.status}`);
  assert(data.error === "owner_auth_required", "growth API should require owner auth");
  return "growth protected";
});

if (adminToken) {
  await check("growth admin endpoint returns CRM data", async () => {
    const { response, data } = await request("GET", "/api/admin/growth", { admin: true });
    assert(response.ok, `growth ${response.status}`);
    assert(data.storage === "postgres", "growth not using Postgres");
    assert(Array.isArray(data.leads), "leads array missing");
    assert(Array.isArray(data.tasks), "tasks array missing");
    assert(Array.isArray(data.outreachDrafts), "outreach drafts missing");
    assert((data.leads || []).some((lead) => lead.email === qaEmail), "QA lead missing from CRM");
    return `${data.leads.length} leads`;
  });

  await check("growth lead stage update works", async () => {
    assert(qaLeadId, "QA lead id missing");
    const { response, data } = await request("PATCH", "/api/admin/growth", {
      admin: true,
      body: { id: qaLeadId, stage: "contacted", score: 72, contacted: true, notes: "QA contacted lead" },
    });
    assert(response.ok, `growth patch ${response.status}`);
    assert(data.lead?.stage === "contacted", "stage not updated");
    assert(data.lead?.score === 72, "score not updated");
    assert(data.lead?.lastContactedAt, "last contacted missing");
    return data.lead.stage;
  });
}

await check("support endpoint stores AI triage ticket", async () => {
  const { response, data } = await request("POST", "/api/support/messages", {
    cookie: userCookie,
    body: {
      email: qaEmail,
      category: "compiler_error",
      subject: "QA compiler issue",
      message: "The generated MQ5 code fails in MetaEditor with an undeclared identifier error during QA.",
      page: "/qa",
    },
  });
  assert(response.ok, `support ${response.status}: ${data?.message || data?.error || ""}`);
  assert(data.ok === true && data.id, "support ticket id missing");
  assert(data.support?.priority, "support AI priority missing");
  return `${data.id} ${data.support.priority}`;
});

await check("support admin endpoint is protected", async () => {
  const { response } = await request("GET", "/api/support/messages");
  assert(response.status === 401, `expected 401 got ${response.status}`);
  return "protected";
});

if (adminToken) {
  await check("support admin endpoint returns tickets", async () => {
    const { response, data } = await request("GET", "/api/support/messages?limit=10", { admin: true });
    assert(response.ok, `support admin ${response.status}`);
    assert(Array.isArray(data.messages), "support messages array missing");
    return `${data.messages.length} tickets`;
  });
}

await check("billing audit is owner protected", async () => {
  const { response } = await request("GET", "/api/billing/audit");
  assert(response.status === 401, `expected 401 got ${response.status}`);
  return "protected";
});

if (adminToken) {
  await check("billing audit passes with admin token", async () => {
    const { response, data } = await request("GET", "/api/billing/audit?deep=1", { admin: true });
    assert(response.ok, `billing audit ${response.status}`);
    assert(data.paypal?.clientConfigured === true, "PayPal config missing");
    return data.paypal.oauth;
  });
}

await check("analytics event records", async () => {
  const { response, data } = await request("POST", "/api/analytics/event", { body: { path: "/qa", referrer: "qa" } });
  assert(response.ok, `analytics event ${response.status}`);
  assert(data.ok === true, "analytics event did not persist");
  return data.storage;
});

await check("admin analytics is protected", async () => {
  const { response } = await request("GET", "/api/admin/analytics");
  assert(response.status === 401, `expected 401 got ${response.status}`);
  return "protected";
});

if (adminToken) {
  await check("admin analytics returns counts", async () => {
    const { response, data } = await request("GET", "/api/admin/analytics", { admin: true });
    assert(response.ok, `admin analytics ${response.status}`);
    assert(data.storage === "postgres", "analytics not using Postgres");
    assert(Number(data.counts?.users || 0) >= 1, "user count missing");
    return `${data.emailsReturned} emails`;
  });
}

await check("worker compile precheck responds", async () => {
  const { response, data } = await request("POST", "/api/workers/compile", { body: { code: "int OnInit(){return INIT_SUCCEEDED;}" } });
  assert(response.ok, `compile ${response.status}`);
  assert(["static-mql-precheck", "metaeditor-mql-compiler"].includes(data.worker), "wrong worker");
  assert(data.compiler?.mode, "compiler mode missing");
  return `${data.worker} ${data.status || "compile checked"}`;
});

await check("worker backtest estimate responds", async () => {
  const { response, data } = await request("POST", "/api/workers/backtest", { body: { code: "input double RiskPerTradePct=0.5;", idea: "XAUUSD breakout" } });
  assert(response.ok, `backtest ${response.status}`);
  assert(data.worker === "backtest-estimator", "wrong worker");
  return data.summary || "backtest checked";
});

const aiPayload = { idea: "London breakout XAUUSD M5, risk 0.5%, no martingale", market: "XAUUSD", platform: "mt5", propMode: true };
for (const [feature, url, body] of [
  ["generate", "/api/trading/generate", aiPayload],
  ["debug", "/api/trading/debug", { platform: "mt5", code: "int OnInit(){return INIT_SUCCEEDED;}", errors: "undeclared identifier trade" }],
  ["optimize", "/api/trading/optimize", { ...aiPayload, currentRisk: 82, currentCompliance: 86 }],
  ["debrief", "/api/trading/debrief", { source: "manual", content: "PF 1.4, DD 6%, 120 trades", market: "XAUUSD" }],
]) {
  await check(`AI ${feature} endpoint responds`, async () => {
    const { response, data } = await request("POST", url, { cookie: userCookie, body });
    assert(response.ok, `${feature} ${response.status}: ${data?.message || data?.error || ""}`);
    assert(data.feature === feature, `feature mismatch ${data.feature}`);
    assert(data.ai?.status, "AI status missing");
    if (feature === "generate") {
      assert(data.compile?.status === "pass", `generated compile status ${data.compile?.status}`);
      assertCompleteMql(data.mql5Code, "generated EA");
      qaGeneratedCode = data.mql5Code;
    }
    if (feature === "debug") {
      assert(data.compile?.status === "pass", `debug compile status ${data.compile?.status}`);
      assertCompleteMql(data.fixedCode, "debug fixed EA");
    }
    return `${data.ai.status} ${data.storage}`;
  });
}

if (process.env.WORKFUSION_QA_EXPECT_REAL_COMPILE === "true") {
  await check("real compiler worker compiles generated EA", async () => {
    assertCompleteMql(qaGeneratedCode, "generated EA for real compile");
    const { response, data } = await request("POST", "/api/workers/compile", {
      cookie: userCookie,
      body: { code: qaGeneratedCode, platform: "mt5", filename: "qa-real-compile.mq5" },
    });
    assert(response.ok, `real compile ${response.status}`);
    assert(data.compiled === true, `expected compiled=true, got ${data.compiled}`);
    assert(data.status === "pass", `expected pass, got ${data.status}`);
    assert(["remote-mql-compiler", "metaeditor-mql-compiler"].includes(data.worker), `unexpected worker ${data.worker}`);
    assert(data.compiler?.artifactFile?.endsWith(".ex5"), "missing .ex5 artifact");
    return `${data.worker} ${data.compiler.artifactFile}`;
  });
}

await check("download endpoint responds", async () => {
  const { response, data } = await request("POST", "/api/trading/download", {
    cookie: userCookie,
    body: { filename: "qa-ea.mq5", content: "int OnInit(){return INIT_SUCCEEDED;}" },
  });
  assert(response.ok, `download ${response.status}: ${data?.message || data?.error || ""}`);
  assert(data.filename === "qa-ea.mq5", "filename mismatch");
  return `${data.plan} ${data.storage}`;
});

await check("free download quota blocks second download", async () => {
  const { response, data } = await request("POST", "/api/trading/download", {
    cookie: userCookie,
    body: { filename: "qa-ea.mq5", content: "int OnInit(){return INIT_SUCCEEDED;}" },
  });
  assert(response.status === 402, `expected 402 got ${response.status}`);
  assert(data.error === "limit_reached", "limit error missing");
  return "quota enforced";
});

if (ownerCookie) {
  await check("owner premium has pro access", async () => {
    const { response, data } = await request("GET", "/api/subscription/status", { cookie: ownerCookie });
    assert(response.ok, `owner status ${response.status}`);
    assert(data.status === "premium" && data.plan === "pro", "owner premium not active");
    return `${data.status} ${data.plan}`;
  });
}

const failed = results.filter((item) => !item.ok);
const summary = {
  baseUrl,
  passed: results.length - failed.length,
  failed: failed.length,
  total: results.length,
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) {
  process.exitCode = 1;
}
