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

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_cockpit" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const today = startOfDayUtc();
  const [squads, agents, runs, costs] = await Promise.all([
    supabase.from("nucleo_squads").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("nucleo_squad_agents").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("ai_agent_runs").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", today),
    supabase.from("llm_calls").select("cost_cents, created_at").eq("organization_id", orgId).gte("created_at", today),
  ]);

  const firstError = [squads.error, agents.error, runs.error, costs.error].find(Boolean);
  if (firstError) return fail("internal_error", "Não foi possível carregar a telemetria do Núcleo.", 500, { requestId });

  const costCents = (costs.data ?? []).reduce((sum, row) => sum + Number(row.cost_cents ?? 0), 0);
  return ok(
    {
      squads: squads.count ?? 0,
      agents: agents.count ?? 0,
      runs_today: runs.count ?? 0,
      cost_cents_today: costCents,
      cost_series: [],
    },
    { requestId },
  );
}
