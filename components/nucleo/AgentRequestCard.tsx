"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RagSource } from "@/lib/nucleo/types";

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
    <Card>
      <CardHeader>
        <CardTitle>2. Solicitação ao agente</CardTitle>
        <CardDescription>Resposta OpenRouter em dry-run, registrada no histórico.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">{response}</div>
        {lastRunId && (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Fontes RAG</p>
            {ragSources.length > 0 ? (
              <ul className="mt-2 space-y-2 text-muted-foreground">
                {ragSources.map((source) => (
                  <li key={`${source.knowledge_source_id ?? "kb"}:${source.excerpt}`}>
                    <p>
                      {source.similarity === null
                        ? "Base ativa"
                        : `${Math.round(source.similarity * 100)}% de similaridade`}
                    </p>
                    <p className="text-xs">{source.excerpt}</p>
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
          <input
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onInvoke();
            }}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Descreva a decisão que precisa tomar…"
          />
          <Button disabled={busy || !chiefAvailable || !message.trim()} onClick={onInvoke}>
            {busy ? "Processando…" : "Enviar"}
          </Button>
        </div>
        {!chiefAvailable && (
          <p className="text-xs text-destructive">Este squad ainda não possui chief publicado.</p>
        )}
      </CardContent>
    </Card>
  );
}
