#!/usr/bin/env node
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import http from "http";
import path from "path";

const env = { ...loadEnv(".env.local"), ...process.env };
const host = env.WORKFUSION_COMPILER_WORKER_HOST || "127.0.0.1";
const port = Number(env.WORKFUSION_COMPILER_WORKER_PORT || 8787);
const token = env.WORKFUSION_COMPILER_WORKER_TOKEN || "";
const metaeditorRoot = env.WORKFUSION_METAEDITOR_ROOT || path.join(process.env.HOME || "", "EA", "mt5-isolated", "MetaTrader 5");
const metaeditorPath = env.WORKFUSION_METAEDITOR_PATH || path.join(metaeditorRoot, "MetaEditor64.exe");
const wineBin = env.WORKFUSION_WINE_BIN || "wine";
const timeoutMs = Math.max(10_000, Number(env.WORKFUSION_METAEDITOR_TIMEOUT_MS || 180_000));

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  return fs.readFileSync(file, "utf8").split(/\r?\n/u).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const index = trimmed.indexOf("=");
    if (index === -1) return acc;
    acc[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^['"]|['"]$/gu, "");
    return acc;
  }, {});
}

function json(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function authorized(req) {
  if (!token) return false;
  return req.headers["x-workfusion-compiler-token"] === token || req.headers.authorization === `Bearer ${token}`;
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("request_too_large");
  }
  return body ? JSON.parse(body) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, {
        ok: true,
        worker: "workfusion-compiler-worker",
        metaeditorConfigured: fs.existsSync(metaeditorPath),
        root: path.basename(metaeditorRoot),
      });
    }

    if (req.method !== "POST" || req.url !== "/compile") {
      return json(res, 404, { error: "not_found" });
    }

    if (!authorized(req)) {
      return json(res, 401, { error: "compiler_worker_token_required" });
    }

    const input = await readBody(req);
    const result = await compileMql({
      code: String(input.code || ""),
      filename: String(input.filename || "workfusion-ea.mq5"),
      platform: String(input.platform || "mt5"),
    });
    return json(res, 200, result);
  } catch (error) {
    return json(res, 500, {
      worker: "metaeditor-mql-compiler",
      compiled: false,
      status: "fail",
      score: 1,
      diagnostics: [error instanceof Error ? error.message : "compiler worker error"],
      compiler: {
        mode: "metaeditor",
        available: fs.existsSync(metaeditorPath),
        message: "Compiler worker failed before MetaEditor returned a result.",
      },
    });
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    ok: true,
    worker: "workfusion-compiler-worker",
    url: `http://${host}:${port}`,
    tokenRequired: Boolean(token),
    metaeditorConfigured: fs.existsSync(metaeditorPath),
    metaeditorRoot,
  }, null, 2));
});

async function compileMql(input) {
  const staticCheck = compileCheck(input.code);
  const platform = String(input.platform || inferPlatform(input.filename, input.code)).toLowerCase();
  if (platform.includes("mt4") || String(input.filename || "").toLowerCase().endsWith(".mq4")) {
    return staticOnly(staticCheck, "Real MetaEditor compilation is currently configured for MT5 .mq5 files only.");
  }
  if (!fs.existsSync(metaeditorPath)) {
    return staticOnly(staticCheck, "MetaEditor64.exe is missing on this compiler worker.");
  }
  if (staticCheck.status === "fail") {
    return {
      ...staticCheck,
      worker: "static-mql-precheck",
      compiled: false,
      compiler: {
        mode: "static_precheck",
        available: true,
        message: "Static pre-check failed, so MetaEditor compilation was skipped.",
      },
    };
  }
  return runMetaEditorCompile(input, staticCheck);
}

async function runMetaEditorCompile(input, staticCheck) {
  const jobId = randomUUID().replace(/-/gu, "").slice(0, 16);
  const baseName = safeBaseName(input.filename || `workfusion_${jobId}.mq5`);
  const fileName = baseName.endsWith(".mq5") ? baseName : `${baseName}.mq5`;
  const relDir = path.join("MQL5", "Experts", "WorkfusionCompilerJobs");
  const sourceRel = path.join(relDir, `${jobId}_${fileName}`);
  const artifactRel = sourceRel.replace(/\.mq5$/iu, ".ex5");
  const logRel = path.join("logs", `workfusion_worker_compile_${jobId}.log`);
  const sourcePath = path.join(metaeditorRoot, sourceRel);
  const artifactPath = path.join(metaeditorRoot, artifactRel);
  const logPath = path.join(metaeditorRoot, logRel);

  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(sourcePath, input.code, "utf8");

  const args = [
    metaeditorPath,
    "/portable",
    `/compile:${sourceRel.replace(/\//gu, "\\")}`,
    `/log:${wineZPath(logPath)}`,
  ];
  const proc = await execFileSafe(wineBin, args, {
    cwd: metaeditorRoot,
    env: workerEnv(),
    timeout: timeoutMs,
  });
  const logText = readLog(logPath);
  const logTail = logText.split(/\r?\n/u).filter(Boolean).slice(-12);
  const artifactExists = fs.existsSync(artifactPath);
  const explicitErrors = /Result:\s*[1-9]\d*\s+errors?/iu.test(logText) || /\berror\b/iu.test(logText);
  const ok = artifactExists && !explicitErrors;

  if (!ok) {
    return {
      status: "fail",
      score: Math.min(staticCheck.score, 55),
      diagnostics: [
        ...staticCheck.diagnostics,
        artifactExists ? "MetaEditor produced an artifact but reported compiler errors." : "MetaEditor did not produce an .ex5 artifact.",
      ],
      worker: "metaeditor-mql-compiler",
      compiled: false,
      compiler: {
        mode: "metaeditor",
        available: true,
        message: "Real MetaEditor compilation failed.",
        returnCode: proc.code,
        sourceFile: path.basename(sourcePath),
        artifactFile: path.basename(artifactPath),
        logFile: path.basename(logPath),
        logTail,
      },
    };
  }

  return {
    status: "pass",
    score: staticCheck.score,
    diagnostics: ["MetaEditor compiled the EA and produced an .ex5 artifact.", ...staticCheck.diagnostics],
    worker: "metaeditor-mql-compiler",
    compiled: true,
    compiler: {
      mode: "metaeditor",
      available: true,
      message: "Real MetaEditor compilation passed.",
      returnCode: proc.code,
      sourceFile: path.basename(sourcePath),
      artifactFile: path.basename(artifactPath),
      logFile: path.basename(logPath),
      logTail,
    },
  };
}

function compileCheck(code) {
  const diagnostics = [];
  const source = String(code || "");
  let score = 100;
  let forcedStatus = null;
  if (source.trim().length < 5000) {
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
  if (/TODO|Insert final entry|merge your final entry|Add validated trading logic/iu.test(source)) {
    diagnostics.push("Template/TODO placeholder detected. Generate complete entry and execution logic before download.");
    score -= 30;
  }
  if (/martingale|grid/iu.test(source) && !/no martingale/iu.test(source)) {
    diagnostics.push("Martingale/grid language detected. Require explicit tail-risk controls.");
    score -= 24;
  }
  if (!/Risk|StopLoss|MaxDailyLoss|MaxSpread/iu.test(source)) {
    diagnostics.push("No explicit risk/spread guard found.");
    score -= 16;
  }
  if (!/\btrade\.(Buy|Sell)\s*\(|\bOrderSend\s*\(/u.test(source)) {
    diagnostics.push("No concrete market execution call found (trade.Buy/trade.Sell or OrderSend).");
    score -= 22;
  }
  if (!/CalculateLotSize|RiskPerTradePct|NormalizeVolume/iu.test(source)) {
    diagnostics.push("No explicit position-sizing function found.");
    score -= 14;
  }
  if (!/MaxTradesPerDay|tradesToday/iu.test(source)) {
    diagnostics.push("No max-trades-per-day guard found.");
    score -= 10;
  }

  const usesCTrade = /\bCTrade\b/u.test(source) || /\btrade\.(Buy|Sell|PositionModify|PositionClose|BuyLimit|SellLimit)\s*\(/u.test(source);
  const missingTradeInclude = usesCTrade && !/#include\s*[<"]Trade[\\/]+Trade\.mqh[>"]/iu.test(source);
  const missingTradeObject = /\btrade\.(Buy|Sell|PositionModify|PositionClose|BuyLimit|SellLimit)\s*\(/u.test(source) && !/\bCTrade\s+trade\s*;/u.test(source);
  const mt4ApiInMq5 = /\b(OP_BUY|OP_SELL|OP_BUYLIMIT|OP_SELLLIMIT|MarketInfo\s*\(|RefreshRates\s*\(|OrderSelect\s*\(|OrdersTotal\s*\()/u.test(source);
  const mql4StyleIndicator = /\bi(MA|RSI|Stochastic|MACD|Bands)\s*\([^;\n]*(?:,[^;\n]*){6,}\)/u.test(source);
  const brokenHistoryApi = /HistoryDeals\.mqh|MqlDeal\b|\bDealGet(Integer|Double|String)\b|HistoryDealGetStruct/u.test(source);

  if (missingTradeInclude || missingTradeObject) {
    diagnostics.push("Compile-critical CTrade setup issue detected. Add #include <Trade/Trade.mqh> and declare CTrade trade; before calling trade.Buy/trade.Sell.");
    score -= 38;
    forcedStatus = "fail";
  }
  if (mt4ApiInMq5) {
    diagnostics.push("Compile-critical MT4-style API detected in an MQ5 compile path. Replace OP_BUY/OP_SELL/MarketInfo/old order loops with MQL5 CTrade or MqlTradeRequest APIs.");
    score -= 38;
    forcedStatus = "fail";
  }
  if (mql4StyleIndicator) {
    diagnostics.push("Compile-critical MQL4-style indicator call detected. In MQL5, create indicator handles and read values with CopyBuffer.");
    score -= 30;
    forcedStatus = "fail";
  }
  if (brokenHistoryApi) {
    diagnostics.push("Compile-critical non-standard deal-history API detected. Use HistorySelect, HistoryDealGetTicket, and HistoryDealGetInteger/Double/String.");
    score -= 30;
    forcedStatus = "fail";
  }

  if (diagnostics.length === 0) diagnostics.push("Static compile pre-check passed. Run MetaEditor before live use.");
  return {
    status: forcedStatus || (score >= 82 ? "pass" : score >= 60 ? "warning" : "fail"),
    score: Math.max(1, score),
    diagnostics,
  };
}

function staticOnly(staticCheck, message) {
  return {
    ...staticCheck,
    worker: "static-mql-precheck",
    compiled: false,
    compiler: {
      mode: "static_precheck",
      available: false,
      message,
    },
  };
}

function inferPlatform(filename, code) {
  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".mq4")) return "mt4";
  if (/\bOrderSend\s*\(/u.test(String(code || "")) && !/\bCTrade\b/u.test(String(code || ""))) return "mt4";
  return "mt5";
}

function safeBaseName(value) {
  const base = path.basename(String(value || "")).replace(/[^a-zA-Z0-9_.-]/gu, "_").slice(0, 80);
  return base || "workfusion.mq5";
}

function workerEnv() {
  const next = { ...process.env, WINEDEBUG: process.env.WINEDEBUG || "-all" };
  const prefix = winePrefixForRoot(metaeditorRoot);
  if (prefix) next.WINEPREFIX = prefix;
  return next;
}

function winePrefixForRoot(root) {
  const parts = path.resolve(root).split(path.sep);
  const index = parts.findIndex((part) => part.startsWith(".wine-mt5"));
  if (index === -1) return "";
  return parts.slice(0, index + 1).join(path.sep) || path.sep;
}

function wineZPath(value) {
  return `Z:${path.resolve(value).replace(/\//gu, "\\")}`;
}

function execFileSafe(command, args, options) {
  return new Promise((resolve) => {
    execFile(command, args, { ...options, windowsHide: true }, (error, stdout, stderr) => {
      const code = typeof error?.code === "number" ? Number(error.code) : error ? 1 : 0;
      resolve({ code, stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

function readLog(logPath) {
  try {
    const buffer = fs.readFileSync(logPath);
    return buffer.includes(0) ? buffer.toString("utf16le") : buffer.toString("utf8");
  } catch {
    return "";
  }
}
