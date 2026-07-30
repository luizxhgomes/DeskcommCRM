/**
 * POST /api/nucleo/agents/:id/invoke
 *
 * Executa somente a versão já publicada do agente em modo de simulação. Não
 * cria mensagem, conversa ou despacho para canal externo; a Sala de Comando
 * permanece um espaço seguro de decisão até a fase de publicação operacional.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { actionIdempotencyKey, parseActionDrafts, stripActionDrafts } from "@/lib/nucleo/actions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invokeSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  simulation_id: z.string().uuid().optional(),
}).strict();
type Ctx = { params: Promise<{ id: string }> };

type RagSource = {
  knowledge_source_id: string | null;
  similarity: number | null;
  excerpt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Extrai apenas referências renderizáveis da tool nativa, sem criar índice paralelo. */
function extractRagSources(trace: unknown): RagSource[] {
  if (!Array.isArray(trace)) return [];
  const sources = new Map<string, RagSource>();
  for (const step of trace) {
    if (!isRecord(step) || !Array.isArray(step.tool_calls)) continue;
    for (const call of step.tool_calls) {
      if (!isRecord(call) || call.tool_name !== "search_knowledge" || !isRecord(call.result) || !Array.isArray(call.result.results)) continue;
      for (const row of call.result.results) {
        if (!isRecord(row) || typeof row.content !== "string") continue;
        const sourceId = typeof row.knowledge_source_id === "string" ? row.knowledge_source_id : null;
        const similarity = typeof row.similarity === "number" && Number.isFinite(row.similarity) ? row.similarity : null;
        const key = `${sourceId ?? "active-kb"}:${row.content.slice(0, 120)}`;
        if (!sources.has(key)) {
          sources.set(key, { knowledge_source_id: sourceId, similarity, excerpt: row.content.slice(0, 320) });
        }
      }
    }
  }
  return [...sources.values()].sort((left, right) => (right.similarity ?? 0) - (left.similarity ?? 0)).slice(0, 5);
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  if (!UUID_RX.test(id)) return fail("invalid_request", "Identificador do agente inválido.", 400, { requestId });

  // Uma invocação pode consumir saldo da organização; viewers não podem dispará-la.
  const authz = await requireRole("manager", { requestId, resource: "nucleo_command" });
  if (!authz.ok) return authz.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = invokeSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Mensagem inválida.", 422, { requestId });

  const admin = createAdminClient();
  const [{ data: membership, error: membershipError }, { data: version, error }] = await Promise.all([
    admin
      .from("nucleo_squad_agents")
      .select("agent_id")
      .eq("organization_id", authz.org.orgId)
      .eq("agent_id", id)
      .maybeSingle(),
    admin
    .from("ai_agent_versions")
    .select("id, channel_session_id")
    .eq("organization_id", authz.org.orgId)
    .eq("agent_id", id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle(),
  ]);
  if (membershipError) return fail("internal_error", "Não foi possível validar o agente do Núcleo.", 500, { requestId });
  if (!membership) return fail("not_found", "Agente não pertence ao catálogo do Núcleo.", 404, { requestId });
  if (error) return fail("internal_error", "Não foi possível localizar a versão do agente.", 500, { requestId });
  if (!version) {
    return fail("nucleo_agent_not_ready", "Este agente ainda não possui uma versão publicada para a Sala de Comando.", 409, { requestId });
  }

  type SimulationLink = { id: string; contact_id: string | null; conversation_id: string | null };
  let simulation: SimulationLink | null = null;
  let sampleContact: { name?: string; phone?: string } | undefined;
  if (parsed.data.simulation_id) {
    const { data: found, error: simulationError } = await admin
      .from("nucleo_simulations")
      .select("id, contact_id, conversation_id, contacts:contact_id(name, phone_number)")
      .eq("id", parsed.data.simulation_id)
      .eq("organization_id", authz.org.orgId)
      .maybeSingle();
    if (simulationError) return fail("internal_error", "Não foi possível localizar a simulação.", 500, { requestId });
    if (!found) return fail("not_found", "Simulação não encontrada.", 404, { requestId });
    const simulationRow = found as unknown as SimulationLink & {
      contacts: Array<{ name: string | null; phone_number: string | null }> | { name: string | null; phone_number: string | null } | null;
    };
    simulation = {
      id: simulationRow.id,
      contact_id: simulationRow.contact_id,
      conversation_id: simulationRow.conversation_id,
    };
    const contact = Array.isArray(simulationRow.contacts) ? simulationRow.contacts[0] : simulationRow.contacts;
    sampleContact = { name: contact?.name ?? undefined, phone: contact?.phone_number ?? undefined };
  }

  const { data: run, error: runError } = await admin
    .from("ai_agent_runs")
    .insert({
      organization_id: authz.org.orgId,
      agent_id: id,
      agent_version_id: version.id,
      channel_session_id: version.channel_session_id,
      conversation_id: simulation?.conversation_id ?? null,
      contact_id: simulation?.contact_id ?? null,
      status: "running",
      is_dry_run: true,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runError || !run) return fail("internal_error", "Não foi possível iniciar a simulação.", 500, { requestId });

  try {
    const { runAgent } = await import("@/lib/ai/runtime/agent");
    const { data: pipeline } = await admin
      .from("crm_pipelines")
      .select("id, name, crm_stages(id, name)")
      .eq("organization_id", authz.org.orgId)
      .eq("is_archived", false)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const stages = (pipeline as unknown as { crm_stages: Array<{ id: string; name: string }> | null } | null)?.crm_stages ?? [];
    const initialStage = stages[0];
    const actionContract = [
      "", "Você está em uma simulação interna, sem envio externo.",
      "Se e somente se uma alteração no CRM for útil, termine com um bloco JSON `nucleo-actions`.",
      "Use apenas create_lead, update_lead, move_lead_stage, create_activity ou create_note.",
      "Cada mudança continuará pendente e só será aplicada após aprovação humana explícita.",
      pipeline && initialStage
        ? `Para create_lead use pipeline_id ${pipeline.id} e stage_id ${initialStage.id}; associe contact_id ${simulation?.contact_id ?? "somente se houver simulação"}.`
        : "Não proponha create_lead se não houver pipeline informado.",
    ].join("\n");
    const result = await runAgent({
      runId: run.id,
      override: { sampleMessage: `${parsed.data.message}${actionContract}`, sampleContact },
    });
    const rawText = result.final_text ?? "";
    const drafts = parseActionDrafts(rawText);
    const actionRows = await Promise.all(drafts.map(async (unboundDraft) => {
      const draft = unboundDraft.action_kind === "create_lead" && !unboundDraft.payload.contact_id && simulation?.contact_id
        ? { ...unboundDraft, payload: { ...unboundDraft.payload, contact_id: simulation.contact_id } }
        : unboundDraft;
      const { data, error: actionError } = await admin
        .from("nucleo_run_actions")
        .upsert({
          organization_id: authz.org.orgId,
          simulation_id: simulation?.id ?? null,
          run_id: run.id,
          action_kind: draft.action_kind,
          payload: draft.payload,
          idempotency_key: actionIdempotencyKey(run.id, draft),
          requested_by: authz.user.id,
        }, { onConflict: "organization_id,idempotency_key", ignoreDuplicates: true })
        .select("id, action_kind, payload, status, created_at")
        .maybeSingle();
      if (actionError) throw actionError;
      return data;
    }));
    if (simulation?.conversation_id && result.status === "completed" && rawText) {
      const outbound = stripActionDrafts(rawText);
      if (outbound) {
        const now = new Date().toISOString();
        await admin.from("messages").insert({
          organization_id: authz.org.orgId,
          conversation_id: simulation.conversation_id,
          channel_session_id: version.channel_session_id,
          contact_id: simulation.contact_id,
          type: "text",
          direction: "outbound",
          status: "sent",
          body: outbound,
          sent_via: "ai",
          metadata: { nucleo_simulation: true, run_id: run.id },
        });
        await admin.from("conversations").update({
          last_outbound_at: now,
          last_message_at: now,
          last_message_preview: outbound.slice(0, 280),
        }).eq("id", simulation.conversation_id).eq("organization_id", authz.org.orgId);
      }
    }
    return ok({
      ...result,
      final_text: stripActionDrafts(rawText),
      actions: actionRows.filter(Boolean),
      rag_sources: extractRagSources(result.tool_calls),
      dry_run: true,
    }, { requestId });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "A execução do agente falhou.";
    return fail("internal_error", message, 500, { requestId });
  }
}
