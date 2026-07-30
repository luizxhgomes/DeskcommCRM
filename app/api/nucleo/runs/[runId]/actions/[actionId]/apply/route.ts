import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { actionDraftSchema, applyAction } from "@/lib/nucleo/actions";
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
    .select("id, run_id, simulation_id, action_kind, payload, status, result")
    .eq("id", params.data.actionId)
    .eq("run_id", params.data.runId)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível carregar a ação.", 500, { requestId });
  if (!action) return fail("not_found", "Ação não encontrada.", 404, { requestId });
  if (action.status === "applied") return ok({ ...action, idempotent: true }, { requestId });
  if (action.status !== "pending") return fail("action_not_pending", "Esta ação não pode mais ser aplicada.", 409, { requestId });

  const { data: claimed } = await supabase
    .from("nucleo_run_actions")
    .update({ status: "approved", reviewed_by: authz.user.id, reviewed_at: new Date().toISOString() })
    .eq("id", action.id)
    .eq("organization_id", authz.org.orgId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) return fail("action_changed", "Ação alterada por outra sessão. Recarregue.", 409, { requestId });

  const draft = actionDraftSchema.safeParse({ action_kind: action.action_kind, payload: action.payload });
  if (!draft.success) {
    await supabase.from("nucleo_run_actions").update({ status: "failed", error_code: "payload_invalid" }).eq("id", action.id);
    return fail("validation_failed", "Ação armazenada inválida.", 422, { requestId });
  }
  try {
    const result = await applyAction(supabase, {
      organization_id: authz.org.orgId,
      actor: { type: "user", id: authz.user.id },
      requestId,
    }, draft.data);
    if (action.simulation_id && draft.data.action_kind === "create_lead" && typeof result.id === "string") {
      await supabase
        .from("nucleo_simulations")
        .update({ lead_id: result.id, updated_at: new Date().toISOString() })
        .eq("id", action.simulation_id)
        .eq("organization_id", authz.org.orgId);
    }
    await supabase.from("nucleo_run_actions").update({ status: "applied", result, applied_at: new Date().toISOString() }).eq("id", action.id);
    return ok({ id: action.id, status: "applied", result }, { requestId });
  } catch (caught) {
    await supabase.from("nucleo_run_actions").update({ status: "failed", error_code: "apply_failed" }).eq("id", action.id);
    return fail("action_apply_failed", caught instanceof Error ? caught.message : "Não foi possível aplicar a ação.", 422, { requestId });
  }
}
