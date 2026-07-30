/** GET /api/nucleo/squads/:slug — detalhe operacional de um squad. */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { querySquadDetail, SQUAD_SLUG_PATTERN } from "@/lib/nucleo/squad-detail";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_squads" });
  if (!authz.ok) return authz.response;
  const { slug } = await context.params;
  if (!SQUAD_SLUG_PATTERN.test(slug)) return fail("invalid_request", "Slug do squad inválido.", 400, { requestId });

  const supabase = await createClient();
  const result = await querySquadDetail(supabase, authz.org.orgId, slug);
  if (result.error === "not_found") return fail("not_found", "Squad não encontrado.", 404, { requestId });
  if (result.error) return fail("internal_error", "Não foi possível carregar o squad.", 500, { requestId });
  return ok(result.data, { requestId });
}
