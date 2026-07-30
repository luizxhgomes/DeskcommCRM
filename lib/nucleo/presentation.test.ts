import { describe, expect, it } from "vitest";

import {
  ACTION_STATUS,
  actionKindLabel,
  activityTypeLabel,
  formatDateTimePtBr,
  reais,
  summarizeActionPayload,
} from "@/lib/nucleo/presentation";
import type { StageOption } from "@/lib/nucleo/types";

const stages: StageOption[] = [
  { id: "s1", name: "Qualificação", position: 1, pipelineId: "p1", pipelineName: "Vendas" },
  { id: "s2", name: "Proposta", position: 2, pipelineId: "p1", pipelineName: "Vendas" },
];

describe("presentation do Núcleo", () => {
  it("formata centavos em BRL pt-BR", () => {
    expect(reais(8)).toContain("0,08");
    expect(reais(123456)).toContain("1.234,56");
  });

  it("cobre os cinco estados de proposta com rótulo pt-BR", () => {
    expect(Object.keys(ACTION_STATUS)).toEqual([
      "pending",
      "approved",
      "applied",
      "rejected",
      "failed",
    ]);
    expect(ACTION_STATUS.pending.label).toBe("Pendente");
    expect(ACTION_STATUS.applied.variant).toBe("success");
    expect(ACTION_STATUS.failed.variant).toBe("error");
  });

  it("resume create_lead com título e etapa resolvida", () => {
    const summary = summarizeActionPayload(
      "create_lead",
      { title: "Oportunidade X", stage_id: "s2", pipeline_id: "p1" },
      stages,
    );
    expect(summary).toBe("Criar o lead «Oportunidade X» em Vendas · Proposta.");
  });

  it("resume move_lead_stage com motivo e degrada etapa desconhecida", () => {
    const summary = summarizeActionPayload(
      "move_lead_stage",
      { lead_id: "l1", stage_id: "desconhecida", reason: "Aprovado em revisão" },
      stages,
    );
    expect(summary).toContain("etapa não identificada");
    expect(summary).toContain("Motivo: Aprovado em revisão");
  });

  it("mantém fallback cru para tipos não mapeados", () => {
    expect(actionKindLabel("algo_novo")).toBe("algo_novo");
    expect(activityTypeLabel("stage_changed")).toBe("Etapa alterada");
    expect(activityTypeLabel("tipo_legado")).toBe("tipo_legado");
  });

  it("formata datas ISO em pt-BR e degrada entrada inválida", () => {
    expect(formatDateTimePtBr("2026-07-30T12:34:00.000Z")).toMatch(/\d{2}\/\d{2}/);
    expect(formatDateTimePtBr("não-é-data")).toBe("—");
  });
});
