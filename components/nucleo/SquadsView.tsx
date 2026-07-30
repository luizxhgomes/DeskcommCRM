"use client";

import type { NucleoDashboardInitialData } from "@/lib/nucleo/types";

import { NucleoPageHeader } from "./NucleoPageHeader";
import { OperationalError } from "./OperationalError";
import { SquadsGrid } from "./SquadsGrid";

interface SquadsViewProps {
  readonly initialData: NucleoDashboardInitialData | null;
  readonly initialError: string | null;
}

export function SquadsView({ initialData, initialError }: SquadsViewProps) {
  const squads = initialData?.squads ?? [];
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <NucleoPageHeader
        title="Squads"
        subtitle="Catálogo live de especialistas, skills e publicação."
        cta={{ href: "/app/nucleo/command", label: "Abrir Sala de Comando" }}
      />
      <OperationalError message={initialError} />
      <SquadsGrid squads={squads} />
      {!initialError && squads.length === 0 && (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          Nenhum squad foi carregado. Rode o seed local do Núcleo antes de utilizar o painel.
        </p>
      )}
    </main>
  );
}
