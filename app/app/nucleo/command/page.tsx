import { CommandRoom } from "@/components/nucleo/CommandRoom";
import { getNucleoDashboardInitialData } from "@/lib/nucleo/dashboard";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const initial = await getNucleoDashboardInitialData();
  return <CommandRoom squads={initial.data?.squads ?? []} initialError={initial.error} />;
}
