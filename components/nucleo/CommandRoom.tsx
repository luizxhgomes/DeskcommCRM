"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { request } from "@/lib/nucleo/client";
import { actionKindLabel } from "@/lib/nucleo/presentation";
import type {
  CommandAction,
  CrmContext,
  NucleoSquadSummary,
  RagSource,
  Simulation,
  SimulationDetail,
  StageOption,
} from "@/lib/nucleo/types";

import { AgentRequestCard } from "./AgentRequestCard";
import { ApprovalQueueCard } from "./ApprovalQueueCard";
import { ConversationCard } from "./ConversationCard";
import { NucleoPageHeader } from "./NucleoPageHeader";
import { OperationalError } from "./OperationalError";
import { ProposalComposerCard } from "./ProposalComposerCard";
import { SimulationSetupCard } from "./SimulationSetupCard";
import { SquadPicker } from "./SquadPicker";

interface CommandRoomProps {
  readonly squads: readonly NucleoSquadSummary[];
  readonly initialError?: string | null;
}

/** Operação em andamento — granular para nunca travar a tela inteira. */
type PendingOp =
  | "create"
  | "invoke"
  | "propose-lead"
  | "propose-move"
  | `apply:${string}`
  | `reject:${string}`
  | null;

export function CommandRoom({ squads, initialError = null }: CommandRoomProps) {
  const [selected, setSelected] = useState<NucleoSquadSummary | null>(null);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [simulation, setSimulation] = useState<SimulationDetail | null>(null);
  const [crm, setCrm] = useState<CrmContext>({ pipelines: [], leads: [] });
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("Teste de qualificação comercial");
  const [contactName, setContactName] = useState("Contato de teste");
  const [initialMessage, setInitialMessage] = useState(
    "Quero entender como vocês podem me ajudar a organizar o processo comercial.",
  );
  const [leadTitle, setLeadTitle] = useState("Oportunidade criada pelo Núcleo");
  const [stageId, setStageId] = useState("");
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [response, setResponse] = useState(
    "Crie uma conversa simulada, escolha um chief publicado e envie uma solicitação.",
  );
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState<PendingOp>(null);

  useEffect(() => {
    void Promise.all([
      request<Simulation[]>("/api/nucleo/simulations"),
      request<CrmContext>("/api/nucleo/crm-context"),
    ])
      .then(([nextSimulations, nextCrm]) => {
        setSimulations(nextSimulations);
        setCrm(nextCrm);
        const firstStage = nextCrm.pipelines[0]?.crm_stages?.[0];
        if (firstStage) setStageId(firstStage.id);
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Não foi possível preparar a Sala de Comando.",
        ),
      );
  }, []);

  const selectedSquad = selected ?? squads[0] ?? null;
  const stages = useMemo<StageOption[]>(
    () =>
      crm.pipelines.flatMap((pipeline) =>
        [...(pipeline.crm_stages ?? [])]
          // Defesa local: o seletor precisa listar o funil em ordem mesmo que a
          // API retorne as etapas fora de posição.
          .sort((a, b) => a.position - b.position)
          .map((stage) => ({
            ...stage,
            pipelineId: pipeline.id,
            pipelineName: pipeline.name,
          })),
      ),
    [crm],
  );
  const anyPending = pending !== null;
  const pendingActionId =
    typeof pending === "string" && (pending.startsWith("apply:") || pending.startsWith("reject:"))
      ? pending.slice(pending.indexOf(":") + 1)
      : null;

  async function loadSimulation(id: string): Promise<void> {
    const next = await request<SimulationDetail>(`/api/nucleo/simulations/${id}`);
    setSimulation(next);
    setSimulations((current) =>
      current.map((row) => (row.id === id ? { ...row, lead_id: next.lead_id } : row)),
    );
  }

  async function createSimulation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending("create");
    setError(null);
    try {
      const created = await request<Simulation & { message: string }>("/api/nucleo/simulations", {
        method: "POST",
        body: JSON.stringify({ title, contact_name: contactName, message: initialMessage }),
      });
      setSimulations((current) => [created, ...current]);
      await loadSimulation(created.id);
      setMessage(created.message);
      setResponse("Conversa criada. Agora envie a solicitação ao chief publicado.");
      toast.success("Conversa simulada criada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar a simulação.");
    } finally {
      setPending(null);
    }
  }

  async function invoke(): Promise<void> {
    if (!selectedSquad?.chief_agent_id || !message.trim()) return;
    setPending("invoke");
    setError(null);
    try {
      const output = await request<{
        run_id: string;
        final_text?: string;
        actions?: CommandAction[];
        rag_sources?: RagSource[];
      }>(
        `/api/nucleo/agents/${selectedSquad.chief_agent_id}/invoke`,
        {
          method: "POST",
          body: JSON.stringify({ message, simulation_id: simulation?.id }),
        },
        // Execução completa do agente (RAG + OpenRouter + propostas): a janela
        // curta padrão abortava a chamada no meio do run.
        { timeoutMs: 120_000 },
      );
      setLastRunId(output.run_id);
      setResponse(output.final_text ?? "O agente concluiu a execução sem texto final.");
      setRagSources(output.rag_sources ?? []);
      setMessage("");
      if (simulation) await loadSimulation(simulation.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível executar o agente.");
    } finally {
      setPending(null);
    }
  }

  async function proposeLead(): Promise<void> {
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (!lastRunId || !stage) {
      setError("Execute o agente e selecione uma etapa antes de propor o lead.");
      return;
    }
    setPending("propose-lead");
    setError(null);
    try {
      await request<CommandAction>(`/api/nucleo/runs/${lastRunId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          simulation_id: simulation?.id,
          action_kind: "create_lead",
          payload: {
            pipeline_id: stage.pipelineId,
            stage_id: stage.id,
            title: leadTitle,
            contact_id: simulation?.contact_id ?? undefined,
          },
        }),
      });
      if (simulation) await loadSimulation(simulation.id);
      setResponse("Proposta criada. Revise e aprove para aplicá-la no CRM.");
      toast.success("Proposta de lead registrada para revisão.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar a proposta.");
    } finally {
      setPending(null);
    }
  }

  async function proposeMove(): Promise<void> {
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (!lastRunId || !stage || !simulation?.lead_id) {
      setError("Crie e aplique um lead antes de propor sua movimentação.");
      return;
    }
    setPending("propose-move");
    setError(null);
    try {
      await request<CommandAction>(`/api/nucleo/runs/${lastRunId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          simulation_id: simulation.id,
          action_kind: "move_lead_stage",
          payload: {
            lead_id: simulation.lead_id,
            stage_id: stage.id,
            reason: "Aprovado na Sala de Comando do Núcleo",
          },
        }),
      });
      await loadSimulation(simulation.id);
      setResponse("Movimentação proposta. Revise e aprove antes de alterar o pipeline.");
      toast.success("Proposta de movimentação registrada para revisão.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível registrar a movimentação.",
      );
    } finally {
      setPending(null);
    }
  }

  async function apply(action: CommandAction): Promise<void> {
    setPending(`apply:${action.id}`);
    setError(null);
    try {
      await request<{ status: string }>(
        `/api/nucleo/runs/${action.run_id}/actions/${action.id}/apply`,
        { method: "POST", body: "{}" },
      );
      if (simulation) await loadSimulation(simulation.id);
      setResponse("Ação aprovada e aplicada no CRM. O histórico foi atualizado.");
      toast.success(`${actionKindLabel(action.action_kind)}: aplicada no CRM.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível aplicar a ação.");
      if (simulation) await loadSimulation(simulation.id).catch(() => undefined);
    } finally {
      setPending(null);
    }
  }

  async function reject(action: CommandAction): Promise<void> {
    setPending(`reject:${action.id}`);
    setError(null);
    try {
      await request<{ status: string }>(
        `/api/nucleo/runs/${action.run_id}/actions/${action.id}/reject`,
        { method: "POST", body: "{}" },
      );
      if (simulation) await loadSimulation(simulation.id);
      toast.success(`${actionKindLabel(action.action_kind)}: proposta rejeitada.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível rejeitar a ação.");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <NucleoPageHeader
        title="Sala de Comando"
        subtitle="Simulação interna: nenhuma mensagem é enviada ao WhatsApp."
      >
        {selectedSquad && (
          <Badge className="tabular-nums">
            Squad {selectedSquad.name}
          </Badge>
        )}
      </NucleoPageHeader>
      <OperationalError message={error} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <SquadPicker
          squads={squads}
          selectedSlug={selectedSquad?.slug ?? null}
          onSelect={setSelected}
        />
        <div className="space-y-6">
          {!simulation ? (
            <SimulationSetupCard
              title={title}
              contactName={contactName}
              initialMessage={initialMessage}
              busy={pending === "create"}
              onTitleChange={setTitle}
              onContactNameChange={setContactName}
              onInitialMessageChange={setInitialMessage}
              onSubmit={(event) => void createSimulation(event)}
            />
          ) : (
            <ConversationCard simulation={simulation} stages={stages} />
          )}
          <AgentRequestCard
            response={response}
            ragSources={ragSources}
            lastRunId={lastRunId}
            message={message}
            busy={pending === "invoke"}
            chiefAvailable={Boolean(selectedSquad?.chief_agent_id)}
            onMessageChange={setMessage}
            onInvoke={() => void invoke()}
          />
          {lastRunId && (
            <ProposalComposerCard
              leadTitle={leadTitle}
              stageId={stageId}
              stages={stages}
              busyLead={pending === "propose-lead"}
              busyMove={pending === "propose-move"}
              disabled={anyPending}
              canProposeMove={Boolean(simulation?.lead_id)}
              onLeadTitleChange={setLeadTitle}
              onStageIdChange={setStageId}
              onProposeLead={() => void proposeLead()}
              onProposeMove={() => void proposeMove()}
            />
          )}
          {simulation && (
            <ApprovalQueueCard
              actions={simulation.actions}
              stages={stages}
              pendingActionId={pendingActionId}
              disabled={anyPending}
              onApply={(action) => void apply(action)}
              onReject={(action) => void reject(action)}
            />
          )}
          {simulations.length > 0 && (
            <Card className="nucleo-enter">
              <CardHeader>
                <CardTitle>Outras simulações</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {simulations.map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    disabled={anyPending}
                    onClick={() => void loadSimulation(item.id)}
                  >
                    {item.title}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
