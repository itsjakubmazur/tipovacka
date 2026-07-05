/** Branded full-page loading state - the OKTAGON GARÁŽ wordmark with a
 * yellow shimmer sweeping across it (see .brand-loader in globals.css).
 * Used by the route loading.tsx files instead of skeleton boxes. */
export function BrandLoader() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 px-4">
      <span className="brand-loader whitespace-nowrap text-3xl font-bold tracking-tight">
        OKTAGON GARÁŽ
      </span>
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400 dark:text-neutral-500">
        Tipovačka
      </span>
    </div>
  );
}
