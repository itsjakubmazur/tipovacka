import type { Metadata } from "next";
import Link from "next/link";

type ShareParams = {
  event?: string;
  nick?: string;
  points?: string;
  rank?: string;
  total?: string;
  img?: string;
};

// Public landing page for shared results - the OG image carries the
// actual content, this page just gives the recipient a way in.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ShareParams>;
}): Promise<Metadata> {
  const { event, nick, points, rank, total, img } = await searchParams;
  const query = new URLSearchParams(
    Object.entries({ event, nick, points, rank, total, img }).filter(([, v]) => v != null) as [string, string][]
  );
  const title = `${nick ?? "Tipér"}: ${points ?? 0} b. na ${event ?? "OKTAGONU"}`;
  return {
    title,
    description: "OKTAGON GARÁŽ Tipovačka - tipni si taky!",
    openGraph: {
      title,
      description: "OKTAGON GARÁŽ Tipovačka - tipni si taky!",
      images: [{ url: `/share/card?${query.toString()}`, width: 1200, height: 630 }],
    },
  };
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<ShareParams>;
}) {
  const { event, nick, points, rank, total } = await searchParams;

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">
        {nick ?? "Tipér"} bral {points ?? 0} b. na {event ?? "OKTAGONU"}
        {rank ? ` — ${rank}. místo${total ? ` z ${total}` : ""}` : ""}
      </h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Kamarádská tipovačka na galavečery OKTAGON MMA. Tipuješ vítěze, způsob ukončení i kolo.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-[#FFD400] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e6bf00]"
      >
        Chci se přidat
      </Link>
    </div>
  );
}
