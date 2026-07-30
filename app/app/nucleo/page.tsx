import { CockpitView } from "@/components/nucleo/CockpitView";
import { getNucleoDashboardInitialData } from "@/lib/nucleo/dashboard";

export const dynamic = "force-dynamic";

export default async function NucleoPage() {
  const initial = await getNucleoDashboardInitialData();
  return <CockpitView initialData={initial.data} initialError={initial.error} />;
}
