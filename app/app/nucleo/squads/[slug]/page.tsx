import Link from "next/link";
import { notFound } from "next/navigation";

import { SquadDetailView } from "@/components/nucleo/SquadDetailView";
import { getNucleoSquadDetailInitialData } from "@/lib/nucleo/squad-detail";

export const dynamic = "force-dynamic";

export default async function SquadDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initial = await getNucleoSquadDetailInitialData(slug);
  if (initial.notFound) notFound();
  if (initial.error !== null || initial.data === null) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Link className="text-sm text-primary" href="/app/nucleo/squads">
          ← Voltar aos squads
        </Link>
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 rounded-md border p-3 text-sm text-destructive"
        >
          {initial.error ?? "Não foi possível carregar o squad."}
        </p>
        <p className="text-sm text-muted-foreground">
          <Link className="text-primary underline-offset-4 hover:underline" href={`/app/nucleo/squads/${slug}`}>
            Tentar novamente
          </Link>
        </p>
      </main>
    );
  }
  return <SquadDetailView detail={initial.data} />;
}
