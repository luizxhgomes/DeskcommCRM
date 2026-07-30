import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "@/lib/ui/icons";
import type { NucleoSquadSummary } from "@/lib/nucleo/types";

export function SquadCard({ squad }: { squad: NucleoSquadSummary }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <CardDescription>{squad.status}</CardDescription>
        <CardTitle>{squad.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="min-h-10 text-sm text-muted-foreground">{squad.focus}</p>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span>{squad.agents} agentes</span>
          <Link
            className="inline-flex items-center gap-1 text-primary"
            href={`/app/nucleo/squads/${squad.slug}`}
          >
            Detalhar <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
