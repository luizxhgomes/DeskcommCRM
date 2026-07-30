/**
 * Funções puras de apresentação do Núcleo.
 *
 * Vivem fora dos componentes para serem testadas diretamente pelo vitest
 * (entram no `gov:verify`) e para manter o vocabulário pt-BR num único lugar.
 */
import type { CommandActionStatus, StageOption } from "./types";

export function reais(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export type ActionStatusVariant = "warning" | "info" | "success" | "neutral" | "error";

export const ACTION_STATUS: Record<
  CommandActionStatus,
  { label: string; variant: ActionStatusVariant }
> = {
  pending: { label: "Pendente", variant: "warning" },
  approved: { label: "Aprovada", variant: "info" },
  applied: { label: "Aplicada", variant: "success" },
  rejected: { label: "Rejeitada", variant: "neutral" },
  failed: { label: "Falhou", variant: "error" },
};

const ACTION_KIND_LABEL: Record<string, string> = {
  create_lead: "Criar lead",
  update_lead: "Atualizar lead",
  move_lead_stage: "Mover lead de etapa",
  create_activity: "Registrar atividade",
  create_note: "Registrar nota",
};

export function actionKindLabel(kind: string): string {
  return ACTION_KIND_LABEL[kind] ?? kind;
}

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  created: "Lead criado",
  stage_changed: "Etapa alterada",
  note: "Nota registrada",
  updated: "Lead atualizado",
};

export function activityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABEL[type] ?? type;
}

export function formatDateTimePtBr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stageLabel(stageId: unknown, stages: readonly StageOption[]): string {
  const stage = stages.find((candidate) => candidate.id === stageId);
  return stage ? `${stage.pipelineName} · ${stage.name}` : "etapa não identificada";
}

/**
 * Converte o payload técnico de uma proposta numa frase legível — é o que o
 * operador lê antes de autorizar a alteração no CRM (o JSON completo continua
 * disponível como detalhe técnico).
 */
export function summarizeActionPayload(
  kind: string,
  payload: Record<string, unknown>,
  stages: readonly StageOption[],
): string {
  switch (kind) {
    case "create_lead": {
      const title = typeof payload.title === "string" ? payload.title : "sem título";
      return `Criar o lead «${title}» em ${stageLabel(payload.stage_id, stages)}.`;
    }
    case "update_lead": {
      const fields = [
        payload.title !== undefined ? "título" : null,
        payload.description !== undefined ? "descrição" : null,
      ].filter(Boolean);
      return `Atualizar ${fields.length > 0 ? fields.join(" e ") : "dados"} do lead.`;
    }
    case "move_lead_stage": {
      const reason = typeof payload.reason === "string" && payload.reason.trim().length > 0
        ? ` Motivo: ${payload.reason}`
        : "";
      return `Mover o lead para ${stageLabel(payload.stage_id, stages)}.${reason}`;
    }
    case "create_activity":
    case "create_note": {
      const note = typeof payload.note === "string" ? payload.note : "";
      return `Registrar nota no lead: «${note}».`;
    }
    default:
      return `Executar ${actionKindLabel(kind)}.`;
  }
}
