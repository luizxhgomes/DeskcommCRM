import { SquadDetail } from "@/components/nucleo/NucleoDashboard";

export default async function SquadDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SquadDetail slug={slug} />;
}
