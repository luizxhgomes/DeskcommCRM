/**
 * Tipos compartilhados pelas telas client do Núcleo.
 *
 * `dashboard.ts` e `squad-detail.ts` importam supabase server; componentes
 * client só podem consumi-los via `import type` — os re-exports abaixo mantêm
 * essa fronteira num único lugar.
 */
export type {
  NucleoCockpitSummary,
  NucleoDashboardInitialData,
  NucleoSquadSummary,
} from "./dashboard";

export type Simulation = {
  id: string;
  title: string;
  status: string;
  contact_id: string | null;
  conversation_id: string | null;
  lead_id: string | null;
  created_at: string;
};

export type CommandActionStatus = "pending" | "approved" | "applied" | "rejected" | "failed";

export type CommandAction = {
  id: string;
  run_id: string;
  action_kind: string;
  payload: Record<string, unknown>;
  status: CommandActionStatus;
  result?: Record<string, unknown>;
  error_code?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
  applied_at?: string | null;
};

export type RagSource = {
  knowledge_source_id: string | null;
  similarity: number | null;
  excerpt: string;
};

export type SimulationDetail = Simulation & {
  updated_at?: string;
  messages: Array<{
    id: string;
    body: string | null;
    direction: "inbound" | "outbound";
    sent_at: string;
  }>;
  actions: CommandAction[];
  activities: Array<{ id: string; type: string; reason: string | null; created_at: string }>;
  contacts?: { id: string; name: string | null } | null;
  crm_leads?: { id: string; title: string; stage_id: string; status: string } | null;
};

export type Pipeline = {
  id: string;
  name: string;
  crm_stages: Array<{ id: string; name: string; position: number }> | null;
};

export type CrmContext = {
  pipelines: Pipeline[];
  leads: Array<{ id: string; title: string; stage_id: string }>;
};

/** Etapa achatada com o pipeline de origem, usada no seletor de propostas. */
export type StageOption = {
  id: string;
  name: string;
  position: number;
  pipelineId: string;
  pipelineName: string;
};

export type SquadAgent = {
  id: string;
  role: string;
  tier: number;
  source_path?: string | null;
  name: string;
  description: string | null;
  published: boolean;
};

export type SquadDetailData = {
  id: string;
  slug: string;
  name: string;
  manifest: { description?: string } | null;
  source_hash?: string;
  created_at?: string;
  updated_at?: string;
  skills: number;
  chief: SquadAgent | null;
  agents: SquadAgent[];
};
