// Lightweight server-render timing. Logs how long a page's data
// fetching actually took to the server console, which on Vercel shows
// up in the function logs - the only way to see real production DB
// latency (a dev machine can't reach the prod database to measure it).
//
// Read it under Vercel -> your project -> Logs, filter for "[perf]".
// A high number here points at network latency (i.e. the Vercel <->
// Supabase region distance) rather than the query shape. Safe to
// remove once the region/latency question is settled.
export function perfStart(): number {
  return performance.now();
}

export function perfLog(label: string, start: number): void {
  console.log(`[perf] ${label}: ${Math.round(performance.now() - start)}ms`);
}

// Logs a labelled breakdown, e.g. "[perf] event/x: w1=90ms w2=180ms
// total=270ms" - so we can see which query wave (auth, the parallel
// batch, ...) actually dominates rather than just the grand total.
export function perfLogParts(label: string, parts: Record<string, number>): void {
  const body = Object.entries(parts)
    .map(([k, v]) => `${k}=${Math.round(v)}ms`)
    .join(" ");
  console.log(`[perf] ${label}: ${body}`);
}
