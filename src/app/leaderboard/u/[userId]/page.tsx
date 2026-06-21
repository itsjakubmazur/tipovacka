import { TipperDetail } from "@/components/leaderboard/tipper-detail";

export default async function TipperDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ eventId?: string; season?: string }>;
}) {
  const { userId } = await params;
  const { eventId, season } = await searchParams;

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <TipperDetail userId={userId} eventId={eventId} season={season} />
    </div>
  );
}
