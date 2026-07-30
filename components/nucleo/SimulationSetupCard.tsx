"use client";

import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SimulationSetupCardProps {
  readonly title: string;
  readonly contactName: string;
  readonly initialMessage: string;
  readonly busy: boolean;
  readonly onTitleChange: (value: string) => void;
  readonly onContactNameChange: (value: string) => void;
  readonly onInitialMessageChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function SimulationSetupCard({
  title,
  contactName,
  initialMessage,
  busy,
  onTitleChange,
  onContactNameChange,
  onInitialMessageChange,
  onSubmit,
}: SimulationSetupCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Criar conversa simulada</CardTitle>
        <CardDescription>
          O contato e a conversa ficam no CRM local para validação completa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            aria-label="Título da simulação"
            required
          />
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={contactName}
            onChange={(event) => onContactNameChange(event.target.value)}
            aria-label="Nome do contato"
            required
          />
          <textarea
            className="min-h-24 rounded-md border bg-background px-3 py-2"
            value={initialMessage}
            onChange={(event) => onInitialMessageChange(event.target.value)}
            aria-label="Mensagem inicial"
            required
          />
          <Button type="submit" disabled={busy}>
            Criar conversa de teste
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
