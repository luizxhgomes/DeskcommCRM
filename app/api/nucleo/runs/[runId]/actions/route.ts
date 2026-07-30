import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { actionDraftSchema, actionIdempotencyKey } from "@/lib/nucleo/actions";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ runId: z.string().uuid() });
const simulationSchema = z.object({ simulation_id: z.string().uuid().optional() }).passthrough();

export async function GET(_: NextRequest, context: { params: Promise<{ runId: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_command" });
  if (!authz.ok) return authz.response;
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) return fail("invalid_request", "Execução inválida.", 400, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nucleo_run_actions")
    .select("id, action_kind, payload, status, result, error_code, created_at, reviewed_at, applied_at")
    .eq("organization_id", authz.org.orgId)
    .eq("run_id", parsedParams.data.runId)
    .order("created_at");
  if (error) return fail("internal_error", "Não foi possível carregar as ações propostas.", 500, { requestId });
  return ok(data ?? [], { requestId });
}

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "nucleo_command" });
  if (!authz.ok) return authz.response;
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) return fail("invalid_request", "Execução inválida.", 400, { requestId });

  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("invalid_request", "Body JSON inválido.", 400, { requestId }); }
  const simulation = simulationSchema.safeParse(raw);
  if (!simulation.success) return fail("validation_failed", "Simulação inválida.", 422, { requestId, details: simulation.error.flatten() });
  const draft = actionDraftSchema.safeParse(raw);
  if (!draft.success) return fail("validation_failed", "Ação proposta inválida.", 422, { requestId, details: draft.error.flatten() });

  const supabase = await createClient();
  const { data: run } = await supabase
    .from("ai_agent_runs")
    .select("id")
    .eq("id", parsedParams.data.runId)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!run) return fail("not_found", "Execução não encontrada.", 404, { requestId });

  if (simulation.data.simulation_id) {
    const { data: linkedSimulation, error: simulationError } = await supabase
      .from("nucleo_simulations")
      .select("id")
      .eq("id", simulation.data.simulation_id)
      .eq("organization_id", authz.org.orgId)
      .maybeSingle();
    if (simulationError) return fail("internal_error", "Não foi possível validar a simulação.", 500, { requestId });
    if (!linkedSimulation) return fail("not_found", "Simulação não encontrada.", 404, { requestId });
  }

  const key = actionIdempotencyKey(parsedParams.data.runId, draft.data);
  const { data, error } = await supabase
    .from("nucleo_run_actions")
    .upsert({
      organization_id: authz.org.orgId,
      run_id: parsedParams.data.runId,
      simulation_id: simulation.data.simulation_id ?? null,
      action_kind: draft.data.action_kind,
      payload: draft.data.payload,
      idempotency_key: key,
      requested_by: authz.user.id,
    }, { onConflict: "organization_id,idempotency_key", ignoreDuplicates: true })
    .select("id, action_kind, payload, status, created_at")
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível registrar a ação proposta.", 500, { requestId });
  if (data) return ok(data, { requestId, status: 201 });

  const { data: existing } = await supabase
    .from("nucleo_run_actions")
    .select("id, action_kind, payload, status, created_at")
    .eq("organization_id", authz.org.orgId)
    .eq("idempotency_key", key)
    .maybeSingle();
  return existing ? ok(existing, { requestId }) : fail("internal_error", "Ação não pôde ser confirmada.", 500, { requestId });
}
