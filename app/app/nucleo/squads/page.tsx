import { SquadsView } from "@/components/nucleo/SquadsView";
import { getNucleoDashboardInitialData } from "@/lib/nucleo/dashboard";

export const dynamic = "force-dynamic";

export default async function SquadsPage() {
  const initial = await getNucleoDashboardInitialData();
  return <SquadsView initialData={initial.data} initialError={initial.error} />;
}
