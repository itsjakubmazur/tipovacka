"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildSpdString, czAccountToIban } from "@/lib/cz-payment";

/** Czech "QR Platba" code for the startovné settlement - scan with any
 * CZ banking app to prefill account, amount, and message. Renders
 * nothing if the account doesn't parse (caller should already have
 * checked, this is just a last-resort guard). */
export function QrPayment({
  account,
  amountCzk,
  message,
}: {
  account: string;
  amountCzk: number;
  message: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const iban = czAccountToIban(account);
    if (!iban) {
      // deferred so clearing a stale code never sets state synchronously
      // within the effect body itself
      const timer = setTimeout(() => {
        if (!cancelled) setDataUrl(null);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    QRCode.toDataURL(buildSpdString(iban, amountCzk, message), { margin: 1, width: 200 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [account, amountCzk, message]);

  if (!dataUrl) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="QR platba"
      width={140}
      height={140}
      className="rounded-xl border border-black/10 bg-white p-1.5 dark:border-white/10"
    />
  );
}
