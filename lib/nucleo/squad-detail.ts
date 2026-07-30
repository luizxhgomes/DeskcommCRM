/**
 * Detalhe operacional de um squad — query compartilhada entre a rota API e o
 * primeiro render server-side de /app/nucleo/squads/[slug].
 *
 * Mesmo contrato nunca-lança de `dashboard.ts`: a página não pode ficar presa
 * em carregamento infinito nem derrubar o segmento por falha de tenant.
 */
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import type { SquadAgent, SquadDetailData } from "@/lib/nucleo/types";

export const SQUAD_SLUG_PATTERN = /^[a-z0-9-]{2,80}$/;

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type SquadDetailQueryError = "not_found" | "internal";

/** Query pura por organização — auth é responsabilidade de quem chama. */
export async function querySquadDetail(
  supabase: ServerSupabase,
  orgId: string,
  slug: string,
): Promise<{ data: SquadDetailData; error: null } | { data: null; error: SquadDetailQueryError }> {
  const { data: squad, error: squadError } = await supabase
    .from("nucleo_squads")
    .select("id, slug, name, manifest, source_hash, created_at, updated_at")
    .eq("organization_id", orgId)
    .eq("slug", slug)
    .maybeSingle();
  if (squadError) return { data: null, error: "internal" };
  if (!squad) return { data: null, error: "not_found" };

  const { data: memberships, error: membershipError } = await supabase
    .from("nucleo_squad_agents")
    .select("agent_id, role, tier, source_path, ai_agents:agent_id(id, name, description, published_version_id)")
    .eq("organization_id", orgId)
    .eq("squad_id", squad.id)
    .order("tier")
    .order("role");
  if (membershipError) return { data: null, error: "internal" };

  const members: SquadAgent[] = (memberships ?? []).map((member) => {
    const agent = member.ai_agents as unknown as {
      id: string;
      name: string;
      description: string | null;
      published_version_id: string | null;
    } | null;
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
    .eq("organization_id", orgId)
    .like("name", `${slug}/%`);
  if (skillError) return { data: null, error: "internal" };

  return {
    data: { ...squad, chief, agents: members, skills: skills ?? 0 } as SquadDetailData,
    error: null,
  };
}

/** Primeiro render server-side da página de detalhe, com erro amigável. */
export async function getNucleoSquadDetailInitialData(
  slug: string,
): Promise<
  | { data: SquadDetailData; error: null; notFound: false }
  | { data: null; error: string; notFound: false }
  | { data: null; error: null; notFound: true }
> {
  if (!SQUAD_SLUG_PATTERN.test(slug)) return { data: null, error: null, notFound: true };
  const authz = await requireRole("manager", { resource: "nucleo_squads" });
  if (!authz.ok) {
    return {
      data: null,
      error: "Você não tem permissão para visualizar os squads do Núcleo.",
      notFound: false,
    };
  }
  const supabase = await createClient();
  const result = await querySquadDetail(supabase, authz.org.orgId, slug);
  if (result.error === "not_found") return { data: null, error: null, notFound: true };
  if (result.error) {
    return {
      data: null,
      error: "Não foi possível carregar o squad. Atualize a página para tentar novamente.",
      notFound: false,
    };
  }
  return { data: result.data, error: null, notFound: false };
}
