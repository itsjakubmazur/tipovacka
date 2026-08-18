import { describe, expect, it } from "vitest";
import { buildSpdString, czAccountToIban, parseCzechAccount } from "./cz-payment";

describe("parseCzechAccount", () => {
  it("accepts prefix-number/bank", () => {
    expect(parseCzechAccount("19-2000145399/0800")).toEqual({
      prefix: "000019",
      number: "2000145399",
      bankCode: "0800",
    });
  });

  it("accepts number/bank without prefix", () => {
    expect(parseCzechAccount("2000145399/0800")).toEqual({
      prefix: "000000",
      number: "2000145399",
      bankCode: "0800",
    });
  });

  it("rejects junk", () => {
    expect(parseCzechAccount("not-an-account")).toBeNull();
  });
});

describe("czAccountToIban", () => {
  it("produces a CZ IBAN of the right length", () => {
    const iban = czAccountToIban("19-2000145399/0800");
    expect(iban).toMatch(/^CZ\d{22}$/);
  });
});

describe("buildSpdString", () => {
  it("builds a QR Platba payload", () => {
    const spd = buildSpdString("CZ6508000000192000145399", 50, "OKTAGON 99");
    expect(spd).toBe("SPD*1.0*ACC:CZ6508000000192000145399*AM:50.00*CC:CZK*MSG:OKTAGON 99");
  });
});
