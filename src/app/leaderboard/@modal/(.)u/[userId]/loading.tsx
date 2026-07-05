import { Modal } from "@/components/modal";

// Instant feedback while the tipper-detail modal's data loads - the
// backdrop + shimmering wordmark appear immediately on tap, so the app
// never looks unresponsive.
export default function Loading() {
  return (
    <Modal>
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
        <span className="brand-loader whitespace-nowrap text-2xl font-bold tracking-tight">
          OKTAGON GARÁŽ
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400 dark:text-neutral-500">
          Tipovačka
        </span>
      </div>
    </Modal>
  );
}
