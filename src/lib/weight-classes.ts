// Standard MMA weight class limits (kg), used just for display.
const WEIGHT_LIMITS_KG: Record<string, number> = {
  Strawweight: 52.2,
  Flyweight: 56.7,
  Bantamweight: 61.2,
  Featherweight: 65.8,
  Lightweight: 70.3,
  Welterweight: 77.1,
  Middleweight: 83.9,
  "Light Heavyweight": 93.0,
  Heavyweight: 120.2,
};

// The API isn't consistent about casing ("Light heavyweight" vs "Light
// Heavyweight"), and an exact-key lookup silently dropped the kg limit for
// whichever spelling didn't match.
const LIMIT_BY_NORMALIZED = new Map(
  Object.entries(WEIGHT_LIMITS_KG).map(([name, kg]) => [name.toLowerCase(), kg])
);

export function weightClassLabel(weightClass: string | null) {
  if (!weightClass) return null;
  const limit = LIMIT_BY_NORMALIZED.get(weightClass.trim().toLowerCase());
  // Just the number in brackets - the header row is one line and "do ... kg"
  // spent three words saying what a weight in brackets already says.
  return limit ? `${weightClass} (${limit.toString().replace(".", ",")} kg)` : weightClass;
}
