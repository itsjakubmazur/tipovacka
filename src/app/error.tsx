"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-yellow-600 dark:text-accent">
        Něco se rozsypalo
      </p>
      <h1 className="text-2xl font-bold">Tuhle stránku teď nejde načíst</h1>
      <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-400">
        Zkus to znovu. Když to bude padat pořád, napiš do kecárny — chyba už by měla být v admin logu.
      </p>
      <Button type="button" variant="accent" onClick={unstable_retry}>
        Zkusit znovu
      </Button>
    </div>
  );
}
