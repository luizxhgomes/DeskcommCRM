import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";
import { createLeadHandler, moveLeadHandler, updateLeadHandler } from "@/app/api/v1/leads/_handler";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import type { HandlerCtx } from "@/lib/api/handlers/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const uuid = z.string().uuid();

export const actionDraftSchema = z.discriminatedUnion("action_kind", [
  z.object({
    action_kind: z.literal("create_lead"),
    payload: z.object({
      pipeline_id: uuid,
      stage_id: uuid,
      title: z.string().trim().min(2).max(200),
      description: z.string().trim().max(2000).optional(),
      value_cents: z.number().int().nonnegative().optional(),
      contact_id: uuid.optional(),
    }),
  }),
  z.object({
    action_kind: z.literal("update_lead"),
    payload: z.object({ lead_id: uuid, title: z.string().trim().min(2).max(200).optional(), description: z.string().trim().max(2000).nullable().optional() }).refine((value) => value.title !== undefined || value.description !== undefined, "Informe um campo para atualizar."),
  }),
  z.object({
    action_kind: z.literal("move_lead_stage"),
    payload: z.object({ lead_id: uuid, stage_id: uuid, reason: z.string().trim().max(500).optional() }),
  }),
  z.object({
    action_kind: z.literal("create_activity"),
    payload: z.object({ lead_id: uuid, note: z.string().trim().min(1).max(2000) }),
  }),
  z.object({
    action_kind: z.literal("create_note"),
    payload: z.object({ lead_id: uuid, note: z.string().trim().min(1).max(2000) }),
  }),
]);

export type ActionDraft = z.infer<typeof actionDraftSchema>;

export function actionIdempotencyKey(runId: string, draft: ActionDraft): string {
  return createHash("sha256").update(`${runId}:${JSON.stringify(draft)}`).digest("hex");
}

export function parseActionDrafts(text: string): ActionDraft[] {
  const match = /```nucleo-actions\s*([\s\S]*?)```/i.exec(text);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1] ?? "");
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.flatMap((row) => {
      const result = actionDraftSchema.safeParse(row);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

/** Remove apenas o bloco estrutural, mantendo a resposta legível no histórico. */
export function stripActionDrafts(text: string): string {
  return text.replace(/\n?```nucleo-actions\s*[\s\S]*?```\s*$/i, "").trim();
}

export async function applyAction(
  supabase: SupabaseClient,
  context: HandlerCtx,
  draft: ActionDraft,
): Promise<Record<string, unknown>> {
  switch (draft.action_kind) {
    case "create_lead":
      return createLeadHandler(supabase, context, {
        ...draft.payload,
        contact_id: draft.payload.contact_id ?? null,
        currency: "BRL",
        source: "nucleo_simulation",
        tags: ["nucleo"],
      });
    case "update_lead": {
      const { lead_id, ...input } = draft.payload;
      return updateLeadHandler(supabase, context, lead_id, input);
    }
    case "move_lead_stage":
      return moveLeadHandler(supabase, context, draft.payload.lead_id, {
        to_stage_id: draft.payload.stage_id,
        reason: draft.payload.reason ?? "Aprovado na Sala de Comando do Núcleo",
      });
    case "create_activity":
    case "create_note": {
      const outcome = await emitLeadActivity(supabase, {
        organizationId: context.organization_id,
        leadId: draft.payload.lead_id,
        contactId: null,
        type: "note",
        sourceModule: "nucleo",
        sourceId: randomUUID(),
        actor: context.actor,
        reason: draft.payload.note,
        payload: { approved_from: "nucleo_command" },
      });
      if (!outcome.ok) throw new Error(outcome.error);
      return { recorded: true, kind: draft.action_kind };
    }
  }
}
