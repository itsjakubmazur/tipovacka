/** Shown while PersonalizedEventData fetches the viewer's own predictions,
 * rank and admin flags. Sized off the already-resolved (cached) fight count
 * so it doesn't jump between placeholder-count and real-count. */
export function EventDetailSkeleton({ fightsCount }: { fightsCount: number }) {
  const cards = Math.max(fightsCount, 1);
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-6">
      <aside className="contents lg:col-start-2 lg:row-start-1 lg:block">
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <div className="glass-surface h-40 animate-pulse rounded-xl border" />
          <div className="glass-surface h-24 animate-pulse rounded-xl border" />
        </div>
      </aside>
      <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1 lg:min-w-0 xl:grid xl:grid-cols-2 xl:items-start">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="glass-surface h-48 animate-pulse rounded-xl border" />
        ))}
      </div>
    </div>
  );
}
