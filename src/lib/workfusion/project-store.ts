import fs from "fs";
import path from "path";
import { databaseConfigured, query } from "./database";
import type { WorkfusionProject } from "./types";

const dataDir = process.env.WORKFUSION_DATA_DIR || path.join(process.env.VERCEL ? "/tmp" : process.cwd(), ".data");
const dataFile = path.join(dataDir, "workfusion-projects.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ projects: [] }, null, 2));
}

function readStore(): { projects: WorkfusionProject[] } {
  try {
    ensureStore();
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return { projects: [] };
  }
}

function writeStore(store: { projects: WorkfusionProject[] }) {
  try {
    ensureStore();
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
  } catch {
    // Serverless filesystems may be ephemeral or read-only outside /tmp.
    // The API should degrade cleanly instead of breaking the commercial dashboard.
  }
}

export function listProjects(ownerId: string) {
  const store = readStore();
  return store.projects
    .filter((project) => project.ownerId === ownerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveProject(project: Omit<WorkfusionProject, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const store = readStore();
  const now = new Date().toISOString();
  const existingIndex = project.id
    ? store.projects.findIndex((item) => item.id === project.id && item.ownerId === project.ownerId)
    : -1;

  if (existingIndex >= 0) {
    const existing = store.projects[existingIndex];
    const updated = { ...existing, ...project, updatedAt: now };
    store.projects[existingIndex] = updated;
    writeStore(store);
    return updated;
  }

  const created: WorkfusionProject = {
    ...project,
    id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  store.projects.push(created);
  writeStore(store);
  return created;
}

function mapProject(row: {
  id: string;
  owner_id: string;
  title: string;
  market: string;
  platform: "mt4" | "mt5";
  idea: string;
  prop_mode: boolean;
  risk_score: number;
  compliance: number;
  code: string;
  created_at: Date;
  updated_at: Date;
}): WorkfusionProject {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    market: row.market,
    platform: row.platform === "mt4" ? "mt4" : "mt5",
    idea: row.idea,
    propMode: row.prop_mode,
    riskScore: row.risk_score,
    compliance: row.compliance,
    code: row.code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listProjectsPersistent(ownerId: string) {
  if (databaseConfigured()) {
    try {
      const result = await query<Parameters<typeof mapProject>[0]>(
        `
        select id, owner_id, title, market, platform, idea, prop_mode, risk_score, compliance, code, created_at, updated_at
        from wf_projects
        where owner_id = $1
        order by updated_at desc
        limit 100
        `,
        [ownerId],
      );
      if (result) return { storage: "postgres" as const, projects: result.rows.map(mapProject) };
    } catch {
      // Fall back to local project store below.
    }
  }
  return { storage: "local-json" as const, projects: listProjects(ownerId) };
}

export async function saveProjectPersistent(project: Omit<WorkfusionProject, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  if (databaseConfigured()) {
    try {
      const id = project.id || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const result = await query<Parameters<typeof mapProject>[0]>(
        `
        insert into wf_projects (id, owner_id, title, market, platform, idea, prop_mode, risk_score, compliance, code, created_at, updated_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
        on conflict (id) do update set
          title = excluded.title,
          market = excluded.market,
          platform = excluded.platform,
          idea = excluded.idea,
          prop_mode = excluded.prop_mode,
          risk_score = excluded.risk_score,
          compliance = excluded.compliance,
          code = excluded.code,
          updated_at = now()
        returning id, owner_id, title, market, platform, idea, prop_mode, risk_score, compliance, code, created_at, updated_at
        `,
        [
          id,
          project.ownerId,
          project.title,
          project.market,
          project.platform,
          project.idea,
          project.propMode,
          project.riskScore,
          project.compliance,
          project.code,
        ],
      );
      const row = result?.rows[0];
      if (row) return { storage: "postgres" as const, project: mapProject(row) };
    } catch {
      // Fall back to local project store below.
    }
  }
  return { storage: "local-json" as const, project: saveProject(project) };
}
