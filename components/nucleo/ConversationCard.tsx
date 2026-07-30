"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { activityTypeLabel, formatDateTimePtBr } from "@/lib/nucleo/presentation";
import type { SimulationDetail, StageOption } from "@/lib/nucleo/types";
import { cn } from "@/lib/utils";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { Clock, FlowArrow, Note, Plus } from "@/lib/ui/icons";

const ACTIVITY_ICON: Record<string, PhosphorIcon> = {
  created: Plus,
  stage_changed: FlowArrow,
  note: Note,
};

interface ConversationCardProps {
  readonly simulation: SimulationDetail;
  readonly stages: readonly StageOption[];
}

export function ConversationCard({ simulation, stages }: ConversationCardProps) {
  return (
    <Card className="nucleo-enter nucleo-enter-1">
      <CardHeader>
        <CardTitle>Conversa: {simulation.title}</CardTitle>
        <CardDescription>
          {simulation.lead_id
            ? "Lead vinculado ao CRM."
            : "Sem lead vinculado até uma proposta ser aprovada."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div aria-label="Histórico da conversa simulada" className="space-y-3" role="log">
          {simulation.messages.map((item) => (
            <div
              key={item.id}
              className={cn(
                "nucleo-enter rounded-lg p-3 text-sm",
                item.direction === "outbound" ? "ml-8 bg-accent-soft" : "mr-8 bg-muted",
              )}
            >
              <p className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{item.direction === "outbound" ? "Agente" : "Contato"}</span>
                <time className="tabular-nums" dateTime={item.sent_at}>
                  {formatDateTimePtBr(item.sent_at)}
                </time>
              </p>
              <p className="whitespace-pre-wrap">{item.body}</p>
            </div>
          ))}
          {simulation.messages.length === 0 && (
            <p className="text-sm text-muted-foreground">Ainda não há mensagens registradas.</p>
          )}
        </div>
        {simulation.crm_leads && (
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium">CRM: {simulation.crm_leads.title}</p>
            <p className="text-muted-foreground">
              Lead {simulation.crm_leads.status} · etapa{" "}
              {stages.find((stage) => stage.id === simulation.crm_leads?.stage_id)?.name ??
                "não identificada"}
            </p>
          </div>
        )}
        {simulation.lead_id && (
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium">Timeline oficial do lead</p>
            {simulation.activities.length > 0 ? (
              <ul aria-live="polite" className="mt-2 space-y-2">
                {simulation.activities.map((activity) => {
                  const Icon = ACTIVITY_ICON[activity.type] ?? Clock;
                  return (
                    <li
                      className="flex items-start gap-2 text-muted-foreground"
                      data-activity-type={activity.type}
                      key={activity.id}
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <Icon aria-hidden className="size-3" />
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium text-foreground">
                          {activityTypeLabel(activity.type)}
                        </span>
                        {activity.reason ? ` · ${activity.reason}` : ""}
                        <time
                          className="block text-xs tabular-nums"
                          dateTime={activity.created_at}
                        >
                          {formatDateTimePtBr(activity.created_at)}
                        </time>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-muted-foreground">As atividades aprovadas aparecerão aqui.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
