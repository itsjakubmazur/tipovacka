// <input type="datetime-local"> has no timezone of its own - the value
// the admin types ("2026-06-20T18:00") is always meant as Czech local
// time. Supabase/Postgres need an explicit UTC instant, so this converts
// using the real Europe/Prague offset for that date (handles CEST/CET
// automatically, unlike a hardcoded +1/+2).
function tzOffsetMillis(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - date.getTime();
}

export function pragueLocalToUtcIso(localDateTime: string): string {
  const naiveUtc = new Date(`${localDateTime}:00Z`);
  const offset = tzOffsetMillis(naiveUtc, "Europe/Prague");
  return new Date(naiveUtc.getTime() - offset).toISOString();
}

// When a draft gala's card opens for tipping: 9:00 Prague time,
// PUBLISH_DAYS_BEFORE (3) calendar days before it starts. Mirrors the
// scraper's _publish_at so the teaser countdown lands on the exact
// moment the card flips to "upcoming". Date math is done in Prague's
// calendar (not raw -72h) so it stays on the right day across DST.
const PUBLISH_DAYS_BEFORE = 3;
const PUBLISH_HOUR_PRAGUE = 9;

export function cardOpensAtIso(eventDateIso: string): string {
  const eventDate = new Date(eventDateIso);
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(eventDate)) {
    map[part.type] = part.value;
  }
  // shift the calendar date back PUBLISH_DAYS_BEFORE days in plain UTC
  // (date-only, so no hour drift), then pin it to 09:00 Prague wall time
  const d = new Date(Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day)));
  d.setUTCDate(d.getUTCDate() - PUBLISH_DAYS_BEFORE);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(PUBLISH_HOUR_PRAGUE).padStart(2, "0");
  return pragueLocalToUtcIso(`${y}-${m}-${day}T${hh}:00`);
}

// Inverse of the above, for pre-filling <input type="datetime-local">
// with an existing UTC timestamp shown in Czech local time.
export function utcIsoToPragueLocalInput(isoString: string): string {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  let hour = map.hour;
  if (hour === "24") hour = "00";

  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}
