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
  intensity = "heavy",
  className,
}: {
  posters: string[];
  /** heavy = ambient backdrop behind text, light = the mosaic *is* the scene */
  intensity?: "heavy" | "light";
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
      <div
        className={cn(
          "absolute inset-0",
          intensity === "heavy"
            ? "bg-black/75 backdrop-blur-2xl backdrop-saturate-150"
            : "bg-black/45 backdrop-blur-[3px] backdrop-saturate-150"
        )}
      />
    </div>
  );
}
