import Image from "next/image";
import { cn } from "@/lib/utils";

/** The season's posters, tiled and tilted, as the backdrop of every Wrapped
 * scene.
 *
 * Only the galas this tipper actually played - that's what makes it theirs
 * rather than a stock pattern. The tiles are repeated until the grid is full,
 * so a three-gala season still covers the screen. */
export function PosterMosaic({
  posters,
  className,
}: {
  posters: string[];
  className?: string;
}) {
  if (posters.length === 0) return null;

  const tiles = Array.from({ length: 15 }, (_, i) => ({
    src: posters[i % posters.length],
    key: i,
  }));

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="wrapped-drift absolute -inset-[25%] grid -rotate-[8deg] grid-cols-3 gap-2 sm:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.key} className="relative aspect-[3/4] overflow-hidden rounded-lg">
            <Image src={tile.src} alt="" fill sizes="220px" className="object-cover" />
          </div>
        ))}
      </div>
      {/* Just enough to read white type over, and no more. Blurring the
          posters into a smooth field made the backdrop generic - the whole
          point is that these are the galas this tipper sat through, and you
          have to be able to recognise them. Legibility is bought back with a
          text shadow on the type instead of by drowning the artwork. */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px] backdrop-saturate-150" />
    </div>
  );
}
