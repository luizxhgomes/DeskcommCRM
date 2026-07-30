import type { NucleoSquadSummary } from "@/lib/nucleo/types";

import { SquadCard } from "./SquadCard";

export function SquadsGrid({ squads }: { squads: readonly NucleoSquadSummary[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {squads.map((squad) => (
        <SquadCard key={squad.slug} squad={squad} />
      ))}
    </section>
  );
}
