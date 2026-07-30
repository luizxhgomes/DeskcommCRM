"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SimulationDetail, StageOption } from "@/lib/nucleo/types";

interface ConversationCardProps {
  readonly simulation: SimulationDetail;
  readonly stages: readonly StageOption[];
}

export function ConversationCard({ simulation, stages }: ConversationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversa: {simulation.title}</CardTitle>
        <CardDescription>
          {simulation.lead_id
            ? "Lead vinculado ao CRM."
            : "Sem lead vinculado até uma proposta ser aprovada."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {simulation.messages.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg p-3 text-sm ${item.direction === "outbound" ? "bg-primary/10 ml-8" : "mr-8 bg-muted"}`}
          >
            <p className="mb-1 text-xs text-muted-foreground">
              {item.direction === "outbound" ? "Agente" : "Contato"}
            </p>
            {item.body}
          </div>
        ))}
        {simulation.messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ainda não há mensagens registradas.</p>
        )}
        {simulation.crm_leads && (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">CRM: {simulation.crm_leads.title}</p>
            <p className="text-muted-foreground">
              Lead {simulation.crm_leads.status} · etapa{" "}
              {stages.find((stage) => stage.id === simulation.crm_leads?.stage_id)?.name ??
                "não identificada"}
            </p>
          </div>
        )}
        {simulation.lead_id && (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Timeline oficial do lead</p>
            {simulation.activities.length > 0 ? (
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {simulation.activities.map((activity) => (
                  <li key={activity.id}>
                    {activity.type}
                    {activity.reason ? ` · ${activity.reason}` : ""}
                  </li>
                ))}
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
