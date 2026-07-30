/** Messages typed while the phone had no signal.
 *
 * Gala night happens in a hall where mobile data is a rumour. Before this, a
 * message sent on a dead connection just showed "Odeslání se nepodařilo" and
 * the text was gone. Now it goes into localStorage, shows in the thread as
 * pending, and flushes as soon as the browser reports it's back online.
 *
 * localStorage rather than IndexedDB on purpose: a handful of short strings,
 * and it survives the tab being closed on the way home. */

export type QueuedComment = {
  /** local id - also the React key while the message is pending */
  id: string;
  eventId: string;
  body: string;
  gifUrl: string | null;
  queuedAt: string;
};

const KEY = "kecarna-queue";
// A phone that's been offline all night shouldn't dump fifty messages at once.
const MAX_QUEUED = 30;

function readAll(): QueuedComment[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedComment[]) : [];
  } catch {
    // corrupt or unparseable - better to drop the queue than to wedge the chat
    return [];
  }
}

function writeAll(items: QueuedComment[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_QUEUED)));
  } catch {
    // storage full or blocked (private mode) - nothing useful to do
  }
}

export function queuedFor(eventId: string): QueuedComment[] {
  return readAll().filter((c) => c.eventId === eventId);
}

export function enqueue(item: Omit<QueuedComment, "id" | "queuedAt">): QueuedComment {
  const queued: QueuedComment = {
    ...item,
    id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  };
  writeAll([...readAll(), queued]);
  return queued;
}

export function dequeue(id: string) {
  writeAll(readAll().filter((c) => c.id !== id));
}
