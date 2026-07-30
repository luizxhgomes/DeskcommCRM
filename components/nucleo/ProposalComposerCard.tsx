"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StageOption } from "@/lib/nucleo/types";

interface ProposalComposerCardProps {
  readonly leadTitle: string;
  readonly stageId: string;
  readonly stages: readonly StageOption[];
  readonly busy: boolean;
  readonly canProposeMove: boolean;
  readonly onLeadTitleChange: (value: string) => void;
  readonly onStageIdChange: (value: string) => void;
  readonly onProposeLead: () => void;
  readonly onProposeMove: () => void;
}

export function ProposalComposerCard({
  leadTitle,
  stageId,
  stages,
  busy,
  canProposeMove,
  onLeadTitleChange,
  onStageIdChange,
  onProposeLead,
  onProposeMove,
}: ProposalComposerCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Propostas de alteração</CardTitle>
        <CardDescription>Crie, mova, revise e só então aplique no CRM.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          className="rounded-md border bg-background px-3 py-2"
          value={leadTitle}
          onChange={(event) => onLeadTitleChange(event.target.value)}
          aria-label="Título do lead"
        />
        <select
          className="rounded-md border bg-background px-3 py-2"
          value={stageId}
          onChange={(event) => onStageIdChange(event.target.value)}
          aria-label="Etapa do lead"
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.pipelineName} · {stage.name}
            </option>
          ))}
        </select>
        <Button disabled={busy || !stageId} onClick={onProposeLead}>
          Propor lead
        </Button>
        {canProposeMove && (
          <Button variant="outline" disabled={busy || !stageId} onClick={onProposeMove}>
            Propor movimentação
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
