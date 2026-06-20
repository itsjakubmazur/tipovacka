"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { X } from "lucide-react";

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const onDismiss = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onDismiss]);

  return (
    <div
      className="animate-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10 backdrop-blur-sm sm:items-center [-webkit-overflow-scrolling:touch]"
      onClick={onDismiss}
    >
      <div
        className="animate-modal-panel relative flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-2xl [-webkit-overflow-scrolling:touch]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Zavřít"
          className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <X className="size-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
