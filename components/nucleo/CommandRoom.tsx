"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { request } from "@/lib/nucleo/client";
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
import { OperationalError } from "./OperationalError";
import { ProposalComposerCard } from "./ProposalComposerCard";
import { SimulationSetupCard } from "./SimulationSetupCard";
import { SquadPicker } from "./SquadPicker";

interface CommandRoomProps {
  readonly squads: readonly NucleoSquadSummary[];
  readonly initialError?: string | null;
}

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
  const [busy, setBusy] = useState(false);

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
        (pipeline.crm_stages ?? []).map((stage) => ({
          ...stage,
          pipelineId: pipeline.id,
          pipelineName: pipeline.name,
        })),
      ),
    [crm],
  );

  async function loadSimulation(id: string): Promise<void> {
    const next = await request<SimulationDetail>(`/api/nucleo/simulations/${id}`);
    setSimulation(next);
    setSimulations((current) =>
      current.map((row) => (row.id === id ? { ...row, lead_id: next.lead_id } : row)),
    );
  }

  async function createSimulation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar a simulação.");
    } finally {
      setBusy(false);
    }
  }

  async function invoke(): Promise<void> {
    if (!selectedSquad?.chief_agent_id || !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const output = await request<{
        run_id: string;
        final_text?: string;
        actions?: CommandAction[];
        rag_sources?: RagSource[];
      }>(`/api/nucleo/agents/${selectedSquad.chief_agent_id}/invoke`, {
        method: "POST",
        body: JSON.stringify({ message, simulation_id: simulation?.id }),
      });
      setLastRunId(output.run_id);
      setResponse(output.final_text ?? "O agente concluiu a execução sem texto final.");
      setRagSources(output.rag_sources ?? []);
      setMessage("");
      if (simulation) await loadSimulation(simulation.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível executar o agente.");
    } finally {
      setBusy(false);
    }
  }

  async function proposeLead(): Promise<void> {
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (!lastRunId || !stage) {
      setError("Execute o agente e selecione uma etapa antes de propor o lead.");
      return;
    }
    setBusy(true);
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar a proposta.");
    } finally {
      setBusy(false);
    }
  }

  async function proposeMove(): Promise<void> {
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (!lastRunId || !stage || !simulation?.lead_id) {
      setError("Crie e aplique um lead antes de propor sua movimentação.");
      return;
    }
    setBusy(true);
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
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível registrar a movimentação.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function apply(action: CommandAction): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await request<{ status: string }>(
        `/api/nucleo/runs/${action.run_id}/actions/${action.id}/apply`,
        { method: "POST", body: "{}" },
      );
      if (simulation) await loadSimulation(simulation.id);
      setResponse("Ação aprovada e aplicada no CRM. O histórico foi atualizado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível aplicar a ação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
      <SquadPicker
        squads={squads}
        selectedSlug={selectedSquad?.slug ?? null}
        onSelect={setSelected}
      />
      <div className="space-y-6">
        <header>
          <p className="text-sm font-medium text-primary">Sala de Comando</p>
          <h1 className="text-3xl font-semibold">{selectedSquad?.name ?? "Selecione um squad"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Simulação interna: nenhuma mensagem é enviada ao WhatsApp.
          </p>
        </header>
        <OperationalError message={error} />
        {!simulation ? (
          <SimulationSetupCard
            title={title}
            contactName={contactName}
            initialMessage={initialMessage}
            busy={busy}
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
          busy={busy}
          chiefAvailable={Boolean(selectedSquad?.chief_agent_id)}
          onMessageChange={setMessage}
          onInvoke={() => void invoke()}
        />
        {lastRunId && (
          <ProposalComposerCard
            leadTitle={leadTitle}
            stageId={stageId}
            stages={stages}
            busy={busy}
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
            busy={busy}
            onApply={(action) => void apply(action)}
          />
        )}
        {simulations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Outras simulações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {simulations.map((item) => (
                <Button
                  key={item.id}
                  variant="outline"
                  disabled={busy}
                  onClick={() => void loadSimulation(item.id)}
                >
                  {item.title}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
