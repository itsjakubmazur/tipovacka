"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="cs">
      <body className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#161616] px-6 py-16 text-center text-[#ededed]">
        <title>Něco se rozsypalo</title>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#ffd400]">Něco se rozsypalo</p>
        <h1 className="text-2xl font-bold">Appka spadla</h1>
        <p className="max-w-sm text-sm text-white/60">
          Obnov stránku. Když to nepůjde, zkus to znovu za chvíli.
        </p>
        <button
          type="button"
          onClick={unstable_retry}
          className="rounded-md bg-[#ffd400] px-4 py-2 text-sm font-semibold text-black"
        >
          Zkusit znovu
        </button>
      </body>
    </html>
  );
}
