/** POST /api/nucleo/runs/:runId/actions/:actionId/reject — descarta uma proposta pendente. */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const paramsSchema = z.object({ runId: z.string().uuid(), actionId: z.string().uuid() });

export async function POST(_: NextRequest, context: { params: Promise<{ runId: string; actionId: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_command" });
  if (!authz.ok) return authz.response;
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return fail("invalid_request", "Ação inválida.", 400, { requestId });

  const supabase = await createClient();
  const { data: action, error } = await supabase
    .from("nucleo_run_actions")
    .select("id, run_id, action_kind, status")
    .eq("id", params.data.actionId)
    .eq("run_id", params.data.runId)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível carregar a ação.", 500, { requestId });
  if (!action) return fail("not_found", "Ação não encontrada.", 404, { requestId });
  if (action.status === "rejected") return ok({ id: action.id, status: "rejected", idempotent: true }, { requestId });
  if (action.status !== "pending") return fail("action_not_pending", "Esta ação não pode mais ser rejeitada.", 409, { requestId });

  // Claim otimista idêntico ao do apply: só uma sessão vence a corrida no pending.
  const { data: claimed } = await supabase
    .from("nucleo_run_actions")
    .update({ status: "rejected", reviewed_by: authz.user.id, reviewed_at: new Date().toISOString() })
    .eq("id", action.id)
    .eq("organization_id", authz.org.orgId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) return fail("action_changed", "Ação alterada por outra sessão. Recarregue.", 409, { requestId });

  return ok({ id: action.id, status: "rejected" }, { requestId });
}
