import { NucleoDashboard } from "@/components/nucleo/NucleoDashboard";
import { getNucleoDashboardInitialData } from "@/lib/nucleo/dashboard";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const initial = await getNucleoDashboardInitialData();
  return <NucleoDashboard mode="command" initialData={initial.data} initialError={initial.error} />;
}
