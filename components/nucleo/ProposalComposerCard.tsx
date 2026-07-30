"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StageOption } from "@/lib/nucleo/types";
import { CircleNotch } from "@/lib/ui/icons";

interface ProposalComposerCardProps {
  readonly leadTitle: string;
  readonly stageId: string;
  readonly stages: readonly StageOption[];
  readonly busyLead: boolean;
  readonly busyMove: boolean;
  readonly disabled: boolean;
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
  busyLead,
  busyMove,
  disabled,
  canProposeMove,
  onLeadTitleChange,
  onStageIdChange,
  onProposeLead,
  onProposeMove,
}: ProposalComposerCardProps) {
  return (
    <Card className="nucleo-enter">
      <CardHeader>
        <CardTitle>3. Propostas de alteração</CardTitle>
        <CardDescription>Crie, mova, revise e só então aplique no CRM.</CardDescription>
      </CardHeader>
      <CardContent className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <div className="grid gap-1.5">
          <Label htmlFor="nucleo-lead-title">Título do lead</Label>
          <Input
            id="nucleo-lead-title"
            value={leadTitle}
            onChange={(event) => onLeadTitleChange(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label id="nucleo-stage-label">Etapa do lead</Label>
          <Select value={stageId || undefined} onValueChange={onStageIdChange}>
            <SelectTrigger aria-label="Etapa do lead" aria-labelledby="nucleo-stage-label">
              <SelectValue placeholder="Selecione a etapa" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.pipelineName} · {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={disabled || !stageId} onClick={onProposeLead}>
          {busyLead && <CircleNotch aria-hidden className="mr-2 size-4 animate-spin" />}
          Propor lead
        </Button>
        {canProposeMove && (
          <Button variant="outline" disabled={disabled || !stageId} onClick={onProposeMove}>
            {busyMove && <CircleNotch aria-hidden className="mr-2 size-4 animate-spin" />}
            Propor movimentação
          </Button>
        )}
        {stages.length === 0 && (
          <p className="text-xs text-muted-foreground sm:col-span-4">
            Nenhum pipeline com etapas foi encontrado no CRM da organização.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
