/**
 * GET /api/nucleo/squads
 *
 * Catálogo da organização ativa para o painel do Núcleo. A leitura usa o
 * cliente com sessão do usuário: RLS continua sendo a última barreira de
 * isolamento, além do filtro explícito por organização.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SquadRow = {
  id: string;
  slug: string;
  name: string;
  manifest: { description?: string } | null;
};

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_squads" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const [{ data: squadRows, error: squadsError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase
      .from("nucleo_squads")
      .select("id, slug, name, manifest")
      .eq("organization_id", authz.org.orgId)
      .order("slug"),
    supabase
      .from("nucleo_squad_agents")
      .select("squad_id, agent_id, role")
      .eq("organization_id", authz.org.orgId),
  ]);

  if (squadsError || membershipsError) {
    return fail("internal_error", "Não foi possível carregar os squads do Núcleo.", 500, { requestId });
  }

  const agentsBySquad = new Map<string, number>();
  const chiefBySquad = new Map<string, string>();
  for (const membership of memberships ?? []) {
    agentsBySquad.set(membership.squad_id, (agentsBySquad.get(membership.squad_id) ?? 0) + 1);
    if (membership.role === "chief") chiefBySquad.set(membership.squad_id, membership.agent_id);
  }

  const squads = ((squadRows ?? []) as SquadRow[]).map((squad) => ({
    id: squad.id,
    slug: squad.slug,
    name: squad.name,
    agents: agentsBySquad.get(squad.id) ?? 0,
    chief_agent_id: chiefBySquad.get(squad.id) ?? null,
    focus: squad.manifest?.description ?? "Especialistas operacionais",
    status: "Pronto" as const,
  }));

  return ok(squads, { requestId, meta: { total: squads.length } });
}
