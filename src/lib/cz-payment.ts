/** Czech domestic account number -> IBAN, and the "QR Platba" SPD
 * string a banking app scans to prefill a transfer. Both are pure,
 * well-defined algorithms (no external API needed).
 *
 * Domestic format accepted: "[prefix-]number/bankCode", e.g.
 * "19-2000145399/0800" or "2000145399/0800".
 */

const IBAN_COUNTRY = "CZ";

function mod97(input: string): number {
  let remainder = input;
  let result = "";
  // process in chunks small enough to stay within safe integer math
  while (remainder.length > 2) {
    const chunk = remainder.slice(0, 9);
    const rest = remainder.slice(chunk.length);
    result = String(Number(chunk) % 97);
    remainder = result + rest;
  }
  return Number(remainder) % 97;
}

function letterToDigits(s: string): string {
  return s
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      // A-Z -> 10-35
      return code >= 65 && code <= 90 ? String(code - 55) : ch;
    })
    .join("");
}

export function parseCzechAccount(
  raw: string
): { prefix: string; number: string; bankCode: string } | null {
  const cleaned = raw.trim().replace(/\s+/g, "");
  const match = cleaned.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!match) return null;
  return {
    prefix: (match[1] ?? "").padStart(6, "0"),
    number: match[2].padStart(10, "0"),
    bankCode: match[3],
  };
}

/** Converts a Czech domestic account number to its IBAN, per the
 * standard (ISO 7064 mod-97-10 check digits on BBAN = bank code +
 * zero-padded prefix + zero-padded account number). Returns null if
 * the input isn't a recognizable Czech account number. */
export function czAccountToIban(raw: string): string | null {
  const parsed = parseCzechAccount(raw);
  if (!parsed) return null;

  const bban = parsed.bankCode + parsed.prefix + parsed.number;
  // move country code + "00" placeholder check digits to the end, then
  // convert letters to digits and take mod 97 to get the real check digits
  const rearranged = bban + IBAN_COUNTRY + "00";
  const numeric = letterToDigits(rearranged);
  const checkDigits = String(98 - mod97(numeric)).padStart(2, "0");

  return `${IBAN_COUNTRY}${checkDigits}${bban}`;
}

/** Builds the SPD (Short Payment Descriptor) string for a Czech "QR
 * Platba" - scanning it in any CZ banking app prefills account,
 * amount, and message. */
export function buildSpdString(iban: string, amountCzk: number, message: string): string {
  const parts = [
    "SPD*1.0",
    `ACC:${iban}`,
    `AM:${amountCzk.toFixed(2)}`,
    "CC:CZK",
    `MSG:${message.slice(0, 60).replace(/\*/g, "")}`,
  ];
  return parts.join("*");
}
