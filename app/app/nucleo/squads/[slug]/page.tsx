import { SquadDetail } from "@/components/nucleo/SquadDetail";

export default async function SquadDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SquadDetail slug={slug} />;
}
