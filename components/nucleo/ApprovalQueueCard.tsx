"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommandAction } from "@/lib/nucleo/types";

interface ApprovalQueueCardProps {
  readonly actions: readonly CommandAction[];
  readonly busy: boolean;
  readonly onApply: (action: CommandAction) => void;
}

export function ApprovalQueueCard({ actions, busy, onApply }: ApprovalQueueCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>4. Aprovação humana</CardTitle>
        <CardDescription>Aplicação idempotente pelos fluxos oficiais do CRM.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => (
          <div
            className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            key={action.id}
          >
            <div className="text-sm">
              <p className="font-medium">{action.action_kind}</p>
              <pre className="mt-1 max-w-xl overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {JSON.stringify(action.payload, null, 2)}
              </pre>
              <p className="mt-1 text-xs text-muted-foreground">
                Estado: {action.status}
                {action.error_code ? ` · ${action.error_code}` : ""}
              </p>
            </div>
            {action.status === "pending" && (
              <Button
                aria-label={`Aprovar ${action.action_kind} ${action.id}`}
                disabled={busy}
                onClick={() => onApply(action)}
              >
                Aprovar e aplicar
              </Button>
            )}
          </div>
        ))}
        {actions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma alteração pendente. Use “Propor lead” após a execução ou aguarde uma proposta
            estruturada do agente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
