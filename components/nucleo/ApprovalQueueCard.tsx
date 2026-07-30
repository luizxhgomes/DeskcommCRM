"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTION_STATUS,
  actionKindLabel,
  summarizeActionPayload,
} from "@/lib/nucleo/presentation";
import type { CommandAction, StageOption } from "@/lib/nucleo/types";
import { CircleNotch } from "@/lib/ui/icons";

interface ApprovalQueueCardProps {
  readonly actions: readonly CommandAction[];
  readonly stages: readonly StageOption[];
  /** Id da ação com operação em andamento (apply/reject) ou null. */
  readonly pendingActionId: string | null;
  /** Bloqueia novas operações enquanto qualquer mutação está em voo. */
  readonly disabled: boolean;
  readonly onApply: (action: CommandAction) => void;
  readonly onReject: (action: CommandAction) => void;
}

export function ApprovalQueueCard({
  actions,
  stages,
  pendingActionId,
  disabled,
  onApply,
  onReject,
}: ApprovalQueueCardProps) {
  return (
    <Card className="nucleo-enter">
      <CardHeader>
        <CardTitle>4. Aprovação humana</CardTitle>
        <CardDescription>Aplicação idempotente pelos fluxos oficiais do CRM.</CardDescription>
      </CardHeader>
      <CardContent aria-live="polite" className="space-y-3">
        {actions.map((action) => {
          const status = ACTION_STATUS[action.status];
          const summary = summarizeActionPayload(action.action_kind, action.payload, stages);
          const working = pendingActionId === action.id;
          return (
            <div
              className="nucleo-flash flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-start sm:justify-between"
              data-status={action.status}
              key={`${action.id}:${action.status}`}
            >
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{actionKindLabel(action.action_kind)}</p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{summary}</p>
                {action.error_code && (
                  <p className="mt-1 text-xs text-destructive">
                    A aplicação falhou ({action.error_code}). Revise o CRM e tente novamente com
                    uma nova proposta.
                  </p>
                )}
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none transition-colors duration-fast ease-out hover:text-foreground">
                    Ver payload técnico
                  </summary>
                  <pre className="mt-1 max-w-xl overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2">
                    {JSON.stringify(action.payload, null, 2)}
                  </pre>
                </details>
              </div>
              {action.status === "pending" && (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    aria-label={`Rejeitar ${action.action_kind} ${action.id}`}
                    disabled={disabled}
                    onClick={() => onReject(action)}
                    variant="outline"
                  >
                    {working && (
                      <CircleNotch aria-hidden className="mr-2 size-4 animate-spin" />
                    )}
                    Rejeitar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        aria-label={`Aprovar ${action.action_kind} ${action.id}`}
                        disabled={disabled}
                      >
                        {working && (
                          <CircleNotch aria-hidden className="mr-2 size-4 animate-spin" />
                        )}
                        Aprovar e aplicar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Aplicar alteração no CRM?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {summary} Esta ação altera dados reais da organização e ficará
                          registrada na timeline do lead.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onApply(action)}>
                          Aprovar e aplicar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          );
        })}
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
