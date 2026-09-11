import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { compileCheck } from "./worker";
import type { WorkerCheck } from "./types";

export type MqlCompileResult = WorkerCheck & {
  worker: "remote-mql-compiler" | "metaeditor-mql-compiler" | "static-mql-precheck";
  compiled: boolean;
  compiler: {
    mode: "remote_worker" | "metaeditor" | "static_precheck";
    available: boolean;
    message: string;
    returnCode?: number | null;
    sourceFile?: string;
    artifactFile?: string;
    logFile?: string;
    logTail?: string[];
  };
};

type CompileInput = {
  code: string;
  filename?: string;
  platform?: string;
};

type CompilerConfig = {
  root: string;
  metaeditor: string;
  wineBin: string;
  timeoutMs: number;
};

export async function compileMql(input: CompileInput): Promise<MqlCompileResult> {
  const code = String(input.code || "");
  const staticCheck = compileCheck(code);
  const platform = String(input.platform || inferPlatform(input.filename, code)).toLowerCase();

  if (platform.includes("mt4") || String(input.filename || "").toLowerCase().endsWith(".mq4")) {
    return staticOnly(staticCheck, "Real MetaEditor compilation is currently configured for MT5 .mq5 files only.");
  }

  const remote = await remoteWorkerCompile(input, staticCheck);
  if (remote) return remote;

  const config = compilerConfig();
  if (!config) {
    return staticOnly(staticCheck, "No compiler is configured on this server. Set WORKFUSION_COMPILER_WORKER_URL for a Mac/VPS worker or WORKFUSION_METAEDITOR_ROOT for local MetaEditor compilation.");
  }

  if (!existsSync(config.metaeditor)) {
    return staticOnly(staticCheck, `MetaEditor was configured but not found: ${path.basename(config.metaeditor)}.`);
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

  return runMetaEditorCompile({ code, filename: input.filename, staticCheck, config });
}

async function remoteWorkerCompile(input: CompileInput, staticCheck: WorkerCheck): Promise<MqlCompileResult | null> {
  const workerUrl = (process.env.WORKFUSION_COMPILER_WORKER_URL || "").trim().replace(/\/$/u, "");
  if (!workerUrl) return null;
  if (staticCheck.status === "fail") {
    return {
      ...staticCheck,
      worker: "static-mql-precheck",
      compiled: false,
      compiler: {
        mode: "static_precheck",
        available: true,
        message: "Static pre-check failed, so remote compiler execution was skipped.",
      },
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.WORKFUSION_COMPILER_WORKER_TIMEOUT_MS || 180_000));
    try {
      const response = await fetch(`${workerUrl}/compile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.WORKFUSION_COMPILER_WORKER_TOKEN
            ? { "x-workfusion-compiler-token": process.env.WORKFUSION_COMPILER_WORKER_TOKEN }
            : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null) as Partial<MqlCompileResult> | null;
      if (!response.ok || !data) {
        return {
          ...staticCheck,
          status: "fail",
          score: Math.min(staticCheck.score, 55),
          diagnostics: [...staticCheck.diagnostics, `Remote compiler failed with HTTP ${response.status}.`],
          worker: "remote-mql-compiler",
          compiled: false,
          compiler: {
            mode: "remote_worker",
            available: true,
            message: "Remote compiler worker rejected the compile request.",
          },
        };
      }
      return normalizeRemoteResult(data, staticCheck);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      ...staticCheck,
      status: "fail",
      score: Math.min(staticCheck.score, 55),
      diagnostics: [
        ...staticCheck.diagnostics,
        error instanceof Error ? `Remote compiler unavailable: ${error.message}` : "Remote compiler unavailable.",
      ],
      worker: "remote-mql-compiler",
      compiled: false,
      compiler: {
        mode: "remote_worker",
        available: false,
        message: "Remote compiler worker is not reachable.",
      },
    };
  }
}

function normalizeRemoteResult(data: Partial<MqlCompileResult>, staticCheck: WorkerCheck): MqlCompileResult {
  const status = data.status === "pass" || data.status === "warning" || data.status === "fail" ? data.status : "fail";
  return {
    status,
    score: typeof data.score === "number" ? data.score : staticCheck.score,
    diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics.map(String) : staticCheck.diagnostics,
    worker: "remote-mql-compiler",
    compiled: Boolean(data.compiled),
    compiler: {
      mode: "remote_worker",
      available: data.compiler?.available !== false,
      message: data.compiler?.message || "Remote compiler worker responded.",
      returnCode: data.compiler?.returnCode,
      sourceFile: data.compiler?.sourceFile,
      artifactFile: data.compiler?.artifactFile,
      logFile: data.compiler?.logFile,
      logTail: data.compiler?.logTail,
    },
  };
}

function compilerConfig(): CompilerConfig | null {
  const root = process.env.WORKFUSION_METAEDITOR_ROOT;
  const metaeditor = process.env.WORKFUSION_METAEDITOR_PATH || (root ? path.join(root, "MetaEditor64.exe") : "");
  if (!root && !metaeditor) return null;

  return {
    root: root || path.dirname(metaeditor),
    metaeditor,
    wineBin: process.env.WORKFUSION_WINE_BIN || "wine",
    timeoutMs: Math.max(10_000, Number(process.env.WORKFUSION_METAEDITOR_TIMEOUT_MS || 180_000)),
  };
}

async function runMetaEditorCompile(input: {
  code: string;
  filename?: string;
  staticCheck: WorkerCheck;
  config: CompilerConfig;
}): Promise<MqlCompileResult> {
  const jobId = randomUUID().replace(/-/g, "").slice(0, 16);
  const baseName = safeBaseName(input.filename || `workfusion_${jobId}.mq5`);
  const fileName = baseName.endsWith(".mq5") ? baseName : `${baseName}.mq5`;
  const relDir = path.join("MQL5", "Experts", "WorkfusionCompilerJobs");
  const sourceRel = path.join(relDir, `${jobId}_${fileName}`);
  const artifactRel = sourceRel.replace(/\.mq5$/iu, ".ex5");
  const logRel = path.join("logs", `workfusion_compile_${jobId}.log`);
  const sourcePath = path.join(input.config.root, sourceRel);
  const artifactPath = path.join(input.config.root, artifactRel);
  const logPath = path.join(input.config.root, logRel);

  await mkdir(path.dirname(sourcePath), { recursive: true });
  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(sourcePath, input.code, "utf8");

  const args = [
    input.config.metaeditor,
    "/portable",
    `/compile:${sourceRel.replace(/\//gu, "\\")}`,
    `/log:${wineZPath(logPath)}`,
  ];
  const env: NodeJS.ProcessEnv = { ...process.env, WINEDEBUG: process.env.WINEDEBUG || "-all" };
  const prefix = winePrefixForRoot(input.config.root);
  if (prefix) env.WINEPREFIX = prefix;

  const proc = await execFileSafe(input.config.wineBin, args, {
    cwd: input.config.root,
    env,
    timeout: input.config.timeoutMs,
  });
  const logText = await readLog(logPath);
  const logTail = logText.split(/\r?\n/u).filter(Boolean).slice(-12);
  const artifactExists = existsSync(artifactPath);
  const explicitErrors = /Result:\s*[1-9]\d*\s+errors?/iu.test(logText) || /\berror\b/iu.test(logText);
  const ok = artifactExists && !explicitErrors;

  if (!ok) {
    return {
      status: "fail",
      score: Math.min(input.staticCheck.score, 55),
      diagnostics: [
        ...input.staticCheck.diagnostics,
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
    score: input.staticCheck.score,
    diagnostics: ["MetaEditor compiled the EA and produced an .ex5 artifact.", ...input.staticCheck.diagnostics],
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

function staticOnly(staticCheck: WorkerCheck, message: string): MqlCompileResult {
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

function inferPlatform(filename: unknown, code: string) {
  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".mq4")) return "mt4";
  if (/\bOrderSend\s*\(/u.test(code) && !/\bCTrade\b/u.test(code)) return "mt4";
  return "mt5";
}

function safeBaseName(value: string) {
  const base = path.basename(value).replace(/[^a-zA-Z0-9_.-]/gu, "_").slice(0, 80);
  return base || "workfusion.mq5";
}

function winePrefixForRoot(root: string) {
  const parts = path.resolve(root).split(path.sep);
  const index = parts.findIndex((part) => part.startsWith(".wine-mt5"));
  if (index === -1) return "";
  return parts.slice(0, index + 1).join(path.sep) || path.sep;
}

function wineZPath(value: string) {
  return `Z:${path.resolve(value).replace(/\//gu, "\\")}`;
}

function execFileSafe(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number },
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(command, args, { ...options, windowsHide: true }, (error, stdout, stderr) => {
      const code = typeof (error as NodeJS.ErrnoException | null)?.code === "number"
        ? Number((error as NodeJS.ErrnoException).code)
        : error
          ? 1
          : 0;
      resolve({ code, stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

async function readLog(logPath: string) {
  try {
    const buffer = await readFile(logPath);
    const hasUtf16Nulls = buffer.includes(0);
    return hasUtf16Nulls ? buffer.toString("utf16le") : buffer.toString("utf8");
  } catch {
    return "";
  }
}

export function defaultLocalCompilerHint() {
  return path.join(os.homedir(), "EA", "mt5-isolated", "MetaTrader 5");
}
