"use client";

import { EmptyState } from "@/components/empty";
import type { NucleoDashboardInitialData } from "@/lib/nucleo/types";
import { Sparkle } from "@/lib/ui/icons";

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
      <div className="nucleo-enter nucleo-enter-1">
        <SquadsGrid squads={squads} />
        {!initialError && squads.length === 0 && (
          <EmptyState
            icon={Sparkle}
            headline="Nenhum squad carregado"
            subcopy="Rode o seed local do Núcleo (make seed) para materializar os squads desta organização."
            primary={{ label: "Voltar ao Cockpit", href: "/app/nucleo" }}
          />
        )}
      </div>
    </main>
  );
}
