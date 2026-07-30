import { NucleoDashboard } from "@/components/nucleo/NucleoDashboard";
import { getNucleoDashboardInitialData } from "@/lib/nucleo/dashboard";

export const dynamic = "force-dynamic";

export default async function SquadsPage() {
  const initial = await getNucleoDashboardInitialData();
  return <NucleoDashboard mode="squads" initialData={initial.data} initialError={initial.error} />;
}
