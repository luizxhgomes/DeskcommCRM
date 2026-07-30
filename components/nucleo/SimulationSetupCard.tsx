"use client";

import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CircleNotch } from "@/lib/ui/icons";

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
    <Card className="nucleo-enter nucleo-enter-1">
      <CardHeader>
        <CardTitle>1. Criar conversa simulada</CardTitle>
        <CardDescription>
          O contato e a conversa ficam no CRM local para validação completa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="nucleo-sim-title">Título da simulação</Label>
            <Input
              id="nucleo-sim-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nucleo-sim-contact">Nome do contato</Label>
            <Input
              id="nucleo-sim-contact"
              value={contactName}
              onChange={(event) => onContactNameChange(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nucleo-sim-message">Mensagem inicial</Label>
            <Textarea
              id="nucleo-sim-message"
              className="min-h-24"
              value={initialMessage}
              onChange={(event) => onInitialMessageChange(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy && <CircleNotch aria-hidden className="mr-2 size-4 animate-spin" />}
            Criar conversa de teste
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
