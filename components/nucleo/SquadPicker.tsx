"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NucleoSquadSummary } from "@/lib/nucleo/types";

interface SquadPickerProps {
  readonly squads: readonly NucleoSquadSummary[];
  readonly selectedSlug: string | null;
  readonly onSelect: (squad: NucleoSquadSummary) => void;
}

export function SquadPicker({ squads, selectedSlug, onSelect }: SquadPickerProps) {
  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>Especialistas</CardTitle>
        <CardDescription>Chiefs publicados do catálogo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {squads.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum squad disponível. Rode o seed local do Núcleo.
          </p>
        )}
        {squads.map((squad) => {
          const selected = selectedSlug === squad.slug;
          return (
            <button
              type="button"
              aria-label={`Selecionar squad ${squad.name}`}
              aria-pressed={selected}
              key={squad.slug}
              onClick={() => onSelect(squad)}
              className={cn(
                "w-full rounded-md border p-3 text-left text-sm",
                "transition-[background-color,border-color,box-shadow] duration-fast ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                selected
                  ? "border-primary bg-accent-soft"
                  : "border-border hover:border-border-strong hover:bg-surface-elevated",
              )}
            >
              <strong>{squad.name}</strong>
              <span className="block text-xs text-muted-foreground">{squad.focus}</span>
              {!squad.chief_agent_id && (
                <span className="block pt-1 text-xs text-destructive">Chief indisponível</span>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
