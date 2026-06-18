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
