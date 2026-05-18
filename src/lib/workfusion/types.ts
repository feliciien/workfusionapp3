export type WorkfusionPlan = "free" | "starter" | "pro" | "studio";

export type WorkfusionProject = {
  id: string;
  ownerId: string;
  title: string;
  market: string;
  platform: "mt4" | "mt5";
  idea: string;
  propMode: boolean;
  riskScore: number;
  compliance: number;
  code: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkerCheck = {
  status: "pass" | "warning" | "fail";
  score: number;
  diagnostics: string[];
};
