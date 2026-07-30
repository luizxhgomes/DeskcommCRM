"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NucleoSquadSummary } from "@/lib/nucleo/types";

interface SquadPickerProps {
  readonly squads: readonly NucleoSquadSummary[];
  readonly selectedSlug: string | null;
  readonly onSelect: (squad: NucleoSquadSummary) => void;
}

export function SquadPicker({ squads, selectedSlug, onSelect }: SquadPickerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Especialistas</CardTitle>
        <CardDescription>Chiefs publicados do catálogo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {squads.map((squad) => (
          <button
            type="button"
            aria-label={`Selecionar squad ${squad.name}`}
            aria-pressed={selectedSlug === squad.slug}
            key={squad.slug}
            onClick={() => onSelect(squad)}
            className={`w-full rounded-md border p-3 text-left text-sm hover:bg-accent ${selectedSlug === squad.slug ? "border-primary bg-accent" : ""}`}
          >
            <strong>{squad.name}</strong>
            <span className="block text-xs text-muted-foreground">{squad.focus}</span>
            {!squad.chief_agent_id && (
              <span className="block pt-1 text-xs text-destructive">Chief indisponível</span>
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
