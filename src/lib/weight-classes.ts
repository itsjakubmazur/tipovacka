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

export function weightClassLabel(weightClass: string | null) {
  if (!weightClass) return null;
  const limit = WEIGHT_LIMITS_KG[weightClass];
  return limit ? `${weightClass} · do ${limit.toString().replace(".", ",")} kg` : weightClass;
}
