import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "@/lib/ui/icons";
import type { NucleoSquadSummary } from "@/lib/nucleo/types";

export function SquadCard({ squad }: { squad: NucleoSquadSummary }) {
  const operational = Boolean(squad.chief_agent_id);
  return (
    <Card className="group transition-shadow duration-fast ease-out hover:shadow-md">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{squad.name}</CardTitle>
          <Badge variant={operational ? "success" : "warning"}>
            {operational ? "Operacional" : "Sem chief"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{squad.focus}</p>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="tabular-nums text-muted-foreground">{squad.agents} agentes</span>
          <Link
            className="inline-flex items-center gap-1 font-medium text-primary transition-colors duration-fast ease-out hover:text-accent-hover"
            href={`/app/nucleo/squads/${squad.slug}`}
          >
            Detalhar
            <ArrowRight
              aria-hidden
              className="size-3.5 transition-transform duration-fast ease-out group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
