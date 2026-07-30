/** GET /api/nucleo/cockpit — agregados leves e live do cockpit. */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function startOfDayUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_cockpit" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const today = startOfDayUtc();
  const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const [squads, agents, publishedAgents, runs, costs, actions, simulations, leads] = await Promise.all([
    supabase.from("nucleo_squads").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("nucleo_squad_agents").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("ai_agents").select("id", { count: "exact", head: true }).eq("organization_id", orgId).not("published_version_id", "is", null),
    supabase.from("ai_agent_runs").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", today),
    supabase.from("llm_calls").select("cost_cents, created_at, provider, model").eq("organization_id", orgId).gte("created_at", since),
    supabase.from("nucleo_run_actions").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "pending"),
    supabase.from("nucleo_simulations").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "open"),
    supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "open"),
  ]);

  const firstError = [squads.error, agents.error, publishedAgents.error, runs.error, costs.error, actions.error, simulations.error, leads.error].find(Boolean);
  if (firstError) return fail("internal_error", "Não foi possível carregar a telemetria do Núcleo.", 500, { requestId });

  const days = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - (6 - offset));
    return { key: isoDay(day), day: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }), cost: 0 };
  });
  const costByDay = new Map(days.map((row) => [row.key, row]));
  for (const call of costs.data ?? []) {
    const row = costByDay.get(String(call.created_at).slice(0, 10));
    if (row) row.cost += Number(call.cost_cents ?? 0);
  }
  const costCents = (costs.data ?? [])
    .filter((row) => new Date(String(row.created_at)) >= new Date(today))
    .reduce((sum, row) => sum + Number(row.cost_cents ?? 0), 0);
  return ok(
    {
      squads: squads.count ?? 0,
      agents: agents.count ?? 0,
      published_agents: publishedAgents.count ?? 0,
      runs_today: runs.count ?? 0,
      cost_cents_today: costCents,
      pending_actions: actions.count ?? 0,
      open_simulations: simulations.count ?? 0,
      open_leads: leads.count ?? 0,
      cost_series: days,
    },
    { requestId },
  );
}
