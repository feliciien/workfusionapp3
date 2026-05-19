#!/usr/bin/env node
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const repoDir = process.env.WORKFUSION_VERCEL_PROJECT_DIR || process.cwd();
const home = os.homedir();
const stateDir = path.join(home, ".workfusion");
const envFile = process.env.WORKFUSION_COMPILER_GATEWAY_ENV || path.join(stateDir, "compiler-worker.env");
const statusFile = path.join(stateDir, "compiler-gateway-status.json");
const logPrefix = "[workfusion-compiler-gateway]";
let worker;
let tunnel;
let stopping = false;
let lastPublishedUrl = "";

fs.mkdirSync(stateDir, { recursive: true });
ensureEnvFile();
const env = { ...loadEnv(envFile), ...process.env };
const port = Number(env.WORKFUSION_COMPILER_WORKER_PORT || 8797);
const token = env.WORKFUSION_COMPILER_WORKER_TOKEN || "";
const updateVercel = env.WORKFUSION_COMPILER_GATEWAY_UPDATE_VERCEL !== "false";
const deployVercel = env.WORKFUSION_COMPILER_GATEWAY_DEPLOY !== "false";

if (!token) {
  throw new Error(`Missing WORKFUSION_COMPILER_WORKER_TOKEN in ${envFile}`);
}

startWorker();
setTimeout(startTunnel, 1500);

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

function ensureEnvFile() {
  if (fs.existsSync(envFile)) return;
  const tokenValue = crypto.randomBytes(32).toString("hex");
  const metaeditorRoot = path.join(home, "EA", "mt5-isolated", "MetaTrader 5");
  fs.writeFileSync(envFile, [
    `WORKFUSION_COMPILER_WORKER_TOKEN=${tokenValue}`,
    `WORKFUSION_METAEDITOR_ROOT=${metaeditorRoot}`,
    "WORKFUSION_COMPILER_WORKER_HOST=127.0.0.1",
    "WORKFUSION_COMPILER_WORKER_PORT=8797",
    "WORKFUSION_WINE_BIN=/opt/homebrew/bin/wine",
    `WORKFUSION_VERCEL_PROJECT_DIR=${repoDir}`,
    "WORKFUSION_COMPILER_GATEWAY_UPDATE_VERCEL=true",
    "WORKFUSION_COMPILER_GATEWAY_DEPLOY=true",
    "",
  ].join("\n"), { mode: 0o600 });
}

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

function startWorker() {
  if (stopping) return;
  worker = spawn(process.execPath, ["scripts/workfusion_compiler_worker.mjs"], {
    cwd: repoDir,
    env: {
      ...env,
      WORKFUSION_COMPILER_WORKER_HOST: "127.0.0.1",
      WORKFUSION_COMPILER_WORKER_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOutput(worker, "worker");
  worker.on("exit", (code, signal) => {
    writeStatus({ workerExit: { code, signal, at: new Date().toISOString() } });
    if (!stopping) setTimeout(startWorker, 5000);
  });
}

function startTunnel() {
  if (stopping) return;
  tunnel = spawn("cloudflared", ["tunnel", "--url", `http://127.0.0.1:${port}`, "--no-autoupdate"], {
    cwd: repoDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOutput(tunnel, "tunnel");
  tunnel.on("exit", (code, signal) => {
    writeStatus({ tunnelExit: { code, signal, at: new Date().toISOString() } });
    if (!stopping) setTimeout(startTunnel, 8000);
  });
}

function pipeOutput(child, label) {
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`${logPrefix} ${label}: ${text}`);
      const url = findTunnelUrl(text);
      if (url) publishTunnelUrl(url).catch((error) => {
        console.error(`${logPrefix} publish failed:`, error.message);
      });
    });
  }
}

function findTunnelUrl(text) {
  const match = text.match(/https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com/u);
  return match?.[0] || "";
}

async function publishTunnelUrl(url) {
  if (!url || url === lastPublishedUrl) return;
  lastPublishedUrl = url;
  writeStatus({ tunnelUrl: url, updatedAt: new Date().toISOString(), port });
  console.log(`${logPrefix} tunnel ready: ${url}`);
  if (!updateVercel) return;

  await setVercelEnv("WORKFUSION_COMPILER_WORKER_URL", url);
  await setVercelEnv("WORKFUSION_COMPILER_WORKER_TOKEN", token);
  if (deployVercel) {
    await run("vercel", ["--prod", "--yes"]);
  }
}

async function setVercelEnv(name, value) {
  await run("vercel", ["env", "rm", name, "production", "--yes"], { allowFailure: true });
  await run("vercel", ["env", "add", name, "production", "--value", value, "--yes"]);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoDir, env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      process.stdout.write(`${logPrefix} ${command}: ${chunk}`);
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
      process.stderr.write(`${logPrefix} ${command}: ${chunk}`);
    });
    child.on("exit", (code) => {
      if (code === 0 || options.allowFailure) resolve(output);
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function writeStatus(update) {
  let status = {};
  try {
    status = JSON.parse(fs.readFileSync(statusFile, "utf8"));
  } catch {
    status = {};
  }
  fs.writeFileSync(statusFile, JSON.stringify({ ...status, ...update }, null, 2));
}

function stop() {
  stopping = true;
  worker?.kill("SIGTERM");
  tunnel?.kill("SIGTERM");
  process.exit(0);
}
