import { NucleoDashboard } from "@/components/nucleo/NucleoDashboard";
import { getNucleoDashboardInitialData } from "@/lib/nucleo/dashboard";

export const dynamic = "force-dynamic";

export default async function NucleoPage() {
  const initial = await getNucleoDashboardInitialData();
  return <NucleoDashboard initialData={initial.data} initialError={initial.error} />;
}
