/**
 * Initial data for the Núcleo operational pages.
 *
 * This is deliberately server-side: the Cockpit must be useful on its first
 * render and cannot depend on client-side API calls before showing its data.
 * The API routes keep serving refreshes and mutations from the interactive UI.
 */
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export type NucleoSquadSummary = {
  id: string;
  slug: string;
  name: string;
  agents: number;
  chief_agent_id: string | null;
  focus: string;
};

type CostPoint = { day: string; cost: number };

export type NucleoCockpitSummary = {
  squads: number;
  agents: number;
  published_agents: number;
  runs_today: number;
  cost_cents_today: number;
  pending_actions: number;
  open_simulations: number;
  open_leads: number;
  cost_series: CostPoint[];
};

export type NucleoDashboardInitialData = {
  squads: NucleoSquadSummary[];
  cockpit: NucleoCockpitSummary;
};

type SquadRow = {
  id: string;
  slug: string;
  name: string;
  manifest: { description?: string } | null;
};

function startOfDayUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Reads the first paint of the Cockpit with the authenticated server client.
 * Returns a user-safe error so the page never remains in an infinite loading
 * state if the tenant is unavailable.
 */
export async function getNucleoDashboardInitialData(): Promise<
  { data: NucleoDashboardInitialData; error: null } | { data: null; error: string }
> {
  const authz = await requireRole("manager", { resource: "nucleo_dashboard" });
  if (!authz.ok) {
    return {
      data: null,
      error: "Você não tem permissão para visualizar os dados operacionais do Núcleo.",
    };
  }

  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const today = startOfDayUtc();
  const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const [
    squadRowsResult,
    membershipsResult,
    agents,
    publishedAgents,
    runs,
    costs,
    actions,
    simulations,
    leads,
  ] = await Promise.all([
    supabase
      .from("nucleo_squads")
      .select("id, slug, name, manifest")
      .eq("organization_id", orgId)
      .order("slug"),
    supabase
      .from("nucleo_squad_agents")
      .select("squad_id, agent_id, role")
      .eq("organization_id", orgId),
    supabase
      .from("nucleo_squad_agents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("ai_agents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("published_version_id", "is", null),
    supabase
      .from("ai_agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", today),
    supabase
      .from("llm_calls")
      .select("cost_cents, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", since),
    supabase
      .from("nucleo_run_actions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending"),
    supabase
      .from("nucleo_simulations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "open"),
    supabase
      .from("crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "open"),
  ]);

  const firstError = [
    squadRowsResult.error,
    membershipsResult.error,
    agents.error,
    publishedAgents.error,
    runs.error,
    costs.error,
    actions.error,
    simulations.error,
    leads.error,
  ].find(Boolean);
  if (firstError) {
    console.error("[nucleo] initial dashboard query failed", firstError);
    return {
      data: null,
      error:
        "Não foi possível carregar a telemetria do Núcleo. Atualize a página para tentar novamente.",
    };
  }

  const agentsBySquad = new Map<string, number>();
  const chiefBySquad = new Map<string, string>();
  for (const membership of membershipsResult.data ?? []) {
    agentsBySquad.set(membership.squad_id, (agentsBySquad.get(membership.squad_id) ?? 0) + 1);
    if (membership.role === "chief") chiefBySquad.set(membership.squad_id, membership.agent_id);
  }
  const squads = ((squadRowsResult.data ?? []) as SquadRow[]).map((squad) => ({
    id: squad.id,
    slug: squad.slug,
    name: squad.name,
    agents: agentsBySquad.get(squad.id) ?? 0,
    chief_agent_id: chiefBySquad.get(squad.id) ?? null,
    focus: squad.manifest?.description ?? "Especialistas operacionais",
  }));

  const days = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - (6 - offset));
    return {
      key: isoDay(day),
      day: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
      cost: 0,
    };
  });
  const costByDay = new Map(days.map((row) => [row.key, row]));
  for (const call of costs.data ?? []) {
    const row = costByDay.get(String(call.created_at).slice(0, 10));
    if (row) row.cost += Number(call.cost_cents ?? 0);
  }
  const costCents = (costs.data ?? [])
    .filter((row) => new Date(String(row.created_at)) >= new Date(today))
    .reduce((sum, row) => sum + Number(row.cost_cents ?? 0), 0);

  return {
    data: {
      squads,
      cockpit: {
        squads: squads.length,
        agents: agents.count ?? 0,
        published_agents: publishedAgents.count ?? 0,
        runs_today: runs.count ?? 0,
        cost_cents_today: costCents,
        pending_actions: actions.count ?? 0,
        open_simulations: simulations.count ?? 0,
        open_leads: leads.count ?? 0,
        cost_series: days,
      },
    },
    error: null,
  };
}
