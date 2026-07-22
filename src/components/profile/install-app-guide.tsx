"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { isIos, isStandalone } from "@/lib/push";

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

export function InstallAppGuide() {
  const [platform] = useState<"ios" | "android" | "other" | null>(() =>
    isStandalone() ? null : isIos() ? "ios" : isAndroid() ? "android" : "other"
  );

  if (!platform) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-accent/50 bg-accent/10 p-4 shadow-lg shadow-black/20 backdrop-blur-lg dark:shadow-black/60">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Smartphone className="size-4 text-yellow-600 dark:text-accent" />
        Přidej si tipovačku na plochu
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {platform === "ios"
          ? "Na iPhonu/iPadu bez toho nepůjdou zapnout upozornění na uzávěrky."
          : "Aplikace se pak otevírá rychleji a líp ti budou chodit upozornění na uzávěrky."}
      </p>
      {platform === "ios" && (
        <ol className="list-decimal pl-5 text-sm text-neutral-700 dark:text-neutral-300">
          <li>V Safari klikni dole na ikonu Sdílet (čtverec se šipkou nahoru).</li>
          <li>Vyber „Přidat na plochu“.</li>
          <li>Otevři tipovačku z ikony na ploše a zapni si upozornění tady na profilu.</li>
        </ol>
      )}
      {platform === "android" && (
        <ol className="list-decimal pl-5 text-sm text-neutral-700 dark:text-neutral-300">
          <li>V Chromu klikni vpravo nahoře na tři tečky.</li>
          <li>Vyber „Přidat na plochu“ nebo „Instalovat aplikaci“.</li>
          <li>Otevři tipovačku z ikony na ploše a zapni si upozornění tady na profilu.</li>
        </ol>
      )}
      {platform === "other" && (
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          Otevři tuhle stránku v mobilním prohlížeči (Safari na iPhonu, Chrome na Androidu) a tam se ti zobrazí návod.
        </p>
      )}
    </div>
  );
}
