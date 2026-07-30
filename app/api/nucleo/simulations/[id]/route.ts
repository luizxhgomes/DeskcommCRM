/** GET /api/nucleo/simulations/:id — conversa, lead e ações de uma simulação. */
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_simulations" });
  if (!authz.ok) return authz.response;
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return fail("invalid_request", "Simulação inválida.", 400, { requestId });
  const supabase = await createClient();
  const { data: simulation, error: simulationError } = await supabase
    .from("nucleo_simulations")
    .select("id, title, status, contact_id, conversation_id, lead_id, created_at, updated_at, contacts:contact_id(id, name, phone_number), crm_leads:lead_id(id, title, stage_id, status)")
    .eq("id", params.data.id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (simulationError) return fail("internal_error", "Não foi possível carregar a simulação.", 500, { requestId });
  if (!simulation) return fail("not_found", "Simulação não encontrada.", 404, { requestId });
  const [messages, actions, activities] = await Promise.all([
    simulation.conversation_id
      ? supabase.from("messages").select("id, body, direction, status, sent_via, sent_at, metadata").eq("organization_id", authz.org.orgId).eq("conversation_id", simulation.conversation_id).order("sent_at")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("nucleo_run_actions").select("id, run_id, action_kind, payload, status, result, error_code, created_at, reviewed_at, applied_at").eq("organization_id", authz.org.orgId).eq("simulation_id", simulation.id).order("created_at"),
    simulation.lead_id
      ? supabase.from("crm_lead_activities").select("id, type, reason, created_at").eq("organization_id", authz.org.orgId).eq("lead_id", simulation.lead_id).order("created_at", { ascending: false }).limit(12)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (messages.error || actions.error || activities.error) return fail("internal_error", "Não foi possível carregar o histórico da simulação.", 500, { requestId });
  return ok({ ...simulation, messages: messages.data ?? [], actions: actions.data ?? [], activities: activities.data ?? [] }, { requestId });
}
