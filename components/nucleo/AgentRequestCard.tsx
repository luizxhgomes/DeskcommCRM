"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RagSource } from "@/lib/nucleo/types";
import { CircleNotch, PaperPlaneTilt } from "@/lib/ui/icons";

interface AgentRequestCardProps {
  readonly response: string;
  readonly ragSources: readonly RagSource[];
  readonly lastRunId: string | null;
  readonly message: string;
  readonly busy: boolean;
  readonly chiefAvailable: boolean;
  readonly onMessageChange: (value: string) => void;
  readonly onInvoke: () => void;
}

export function AgentRequestCard({
  response,
  ragSources,
  lastRunId,
  message,
  busy,
  chiefAvailable,
  onMessageChange,
  onInvoke,
}: AgentRequestCardProps) {
  return (
    <Card className="nucleo-enter nucleo-enter-2">
      <CardHeader>
        <CardTitle>2. Solicitação ao agente</CardTitle>
        <CardDescription>Resposta OpenRouter em dry-run, registrada no histórico.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          aria-label="Resposta do agente"
          aria-live="polite"
          className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm"
          data-testid="nucleo-agent-response"
          key={lastRunId ?? "placeholder"}
          role="region"
        >
          {busy ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <CircleNotch aria-hidden className="size-4 animate-spin" />
              Consultando o agente via OpenRouter…
            </span>
          ) : (
            response
          )}
        </div>
        {lastRunId && !busy && (
          <div className="nucleo-flash rounded-md border border-border p-3 text-sm">
            <p className="font-medium">Fontes RAG</p>
            {ragSources.length > 0 ? (
              <ul className="mt-2 space-y-2 text-muted-foreground">
                {ragSources.map((source) => (
                  <li key={`${source.knowledge_source_id ?? "kb"}:${source.excerpt}`}>
                    <Badge variant="info">
                      {source.similarity === null
                        ? "Base ativa"
                        : `${Math.round(source.similarity * 100)}% de similaridade`}
                    </Badge>
                    <p className="mt-1 text-xs">{source.excerpt}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted-foreground">
                A execução não recuperou trechos da KB ativa.
              </p>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            aria-label="Solicitação para o agente"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onInvoke();
              }
            }}
            className="flex-1"
            placeholder="Descreva a decisão que precisa tomar…"
          />
          <Button disabled={busy || !chiefAvailable || !message.trim()} onClick={onInvoke}>
            {busy ? (
              <>
                <CircleNotch aria-hidden className="mr-2 size-4 animate-spin" />
                Processando…
              </>
            ) : (
              <>
                <PaperPlaneTilt aria-hidden className="mr-2 size-4" />
                Enviar
              </>
            )}
          </Button>
        </div>
        {!chiefAvailable && (
          <p className="text-xs text-destructive">Este squad ainda não possui chief publicado.</p>
        )}
      </CardContent>
    </Card>
  );
}
