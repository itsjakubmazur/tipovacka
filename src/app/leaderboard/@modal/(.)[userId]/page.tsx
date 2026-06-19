import { Modal } from "@/components/modal";
import { TipperDetail } from "@/components/leaderboard/tipper-detail";

export default async function TipperDetailModal({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ eventId?: string; season?: string }>;
}) {
  const { userId } = await params;
  const { eventId, season } = await searchParams;

  return (
    <Modal>
      <TipperDetail userId={userId} eventId={eventId} season={season} />
    </Modal>
  );
}
