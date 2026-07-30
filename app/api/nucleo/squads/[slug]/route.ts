/** GET /api/nucleo/squads/:slug — detalhe operacional de um squad. */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_squads" });
  if (!authz.ok) return authz.response;
  const { slug } = await context.params;
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return fail("invalid_request", "Slug do squad inválido.", 400, { requestId });

  const supabase = await createClient();
  const { data: squad, error: squadError } = await supabase
    .from("nucleo_squads")
    .select("id, slug, name, manifest, source_hash, created_at, updated_at")
    .eq("organization_id", authz.org.orgId)
    .eq("slug", slug)
    .maybeSingle();
  if (squadError) return fail("internal_error", "Não foi possível carregar o squad.", 500, { requestId });
  if (!squad) return fail("not_found", "Squad não encontrado.", 404, { requestId });

  const { data: memberships, error: membershipError } = await supabase
    .from("nucleo_squad_agents")
    .select("agent_id, role, tier, source_path, ai_agents:agent_id(id, name, description, published_version_id)")
    .eq("organization_id", authz.org.orgId)
    .eq("squad_id", squad.id)
    .order("tier")
    .order("role");
  if (membershipError) return fail("internal_error", "Não foi possível carregar os agentes do squad.", 500, { requestId });
  const members = (memberships ?? []).map((member) => {
    const agent = member.ai_agents as unknown as { id: string; name: string; description: string | null; published_version_id: string | null } | null;
    return {
      id: member.agent_id,
      role: member.role,
      tier: member.tier,
      source_path: member.source_path,
      name: agent?.name ?? "Agente indisponível",
      description: agent?.description ?? null,
      published: Boolean(agent?.published_version_id),
    };
  });
  const chief = members.find((member) => member.role === "chief") ?? null;
  const { count: skills, error: skillError } = await supabase
    .from("skill_pointers")
    .select("name", { count: "exact", head: true })
    .eq("organization_id", authz.org.orgId)
    .like("name", `${slug}/%`);
  if (skillError) return fail("internal_error", "Não foi possível carregar as skills do squad.", 500, { requestId });

  return ok({ ...squad, chief, agents: members, skills: skills ?? 0 }, { requestId });
}
