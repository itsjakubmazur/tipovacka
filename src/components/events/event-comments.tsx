"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageCircle, SmilePlus, Trash2, X } from "lucide-react";
import { EmojiGlyph } from "@/components/events/emoji-glyph";
import { EmojiPickerSheet } from "@/components/events/emoji-picker-sheet";

type Reaction = { id: string; user_id: string; emoji: string };

type Comment = {
  id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  nickname: string;
  isSystem: boolean;
  reactions: Reaction[];
};

const MAX_LENGTH = 500;
const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

/** Kecárna as a floating chat bubble (bottom-left, opposite the
 * jump-to-untipped button) opening a slide-up panel - a live per-event
 * chat for gala night instead of a block buried under 14 fight cards.
 * The bubble shows an unread count based on a per-event last-seen
 * timestamp in localStorage; realtime keeps the list fresh. */
export function EventComments({
  eventId,
  userId,
  isAdmin,
  initialComments,
}: {
  eventId: string;
  userId: string;
  isAdmin: boolean;
  initialComments: Comment[];
}) {
  // createClient returns a memoized singleton, so calling it in render
  // is stable - same pattern as the other client components here.
  const supabase = createClient();
  const [comments, setComments] = useState(initialComments);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const seenKey = `kecarna-seen-${eventId}`;

  useEffect(() => {
    // deferred so the initial read doesn't trigger a cascading render
    const timer = setTimeout(() => {
      setLastSeen(localStorage.getItem(seenKey) ?? new Date(0).toISOString());
    }, 0);
    return () => clearTimeout(timer);
  }, [seenKey]);

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(seenKey, now);
    setLastSeen(now);
  }, [seenKey]);

  useEffect(() => {
    async function refetch() {
      const { data } = await supabase
        .from("event_comments")
        .select(
          "id, user_id, body, created_at, is_system, profiles(nickname), event_comment_reactions(id, user_id, emoji)"
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) {
        setComments(
          (
            data as unknown as {
              id: string;
              user_id: string | null;
              body: string;
              created_at: string;
              is_system: boolean;
              profiles: { nickname: string } | null;
              event_comment_reactions: Reaction[];
            }[]
          ).map((c) => ({
            id: c.id,
            user_id: c.user_id,
            body: c.body,
            created_at: c.created_at,
            isSystem: c.is_system,
            nickname: c.profiles?.nickname ?? "Bez přezdívky",
            reactions: c.event_comment_reactions,
          }))
        );
      }
    }

    const channel = supabase
      .channel(`event-comments-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_comments", filter: `event_id=eq.${eventId}` },
        refetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_comment_reactions", filter: `event_id=eq.${eventId}` },
        refetch
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId]);

  // while the panel is open, everything that arrives counts as read
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(markSeen, 0);
    return () => clearTimeout(timer);
  }, [comments, open, markSeen]);

  const unread = lastSeen
    ? comments.filter((c) => c.created_at > lastSeen && c.user_id !== userId).length
    : 0;
  // system rows have no author to compare against - they're never "yours"

  function openPanel() {
    setOpen(true);
    markSeen();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const { error } = await supabase
      .from("event_comments")
      .insert({ event_id: eventId, user_id: userId, body: trimmed });
    setSending(false);
    if (error) {
      setError("Odeslání se nepodařilo.");
      return;
    }
    setBody("");
  }

  async function remove(id: string) {
    await supabase.from("event_comments").delete().eq("id", id);
  }

  async function toggleReaction(comment: Comment, emoji: string) {
    setReactingTo(null);
    const existing = comment.reactions.find((r) => r.user_id === userId && r.emoji === emoji);
    if (existing) {
      await supabase.from("event_comment_reactions").delete().eq("id", existing.id);
    } else {
      await supabase
        .from("event_comment_reactions")
        .insert({ comment_id: comment.id, event_id: eventId, user_id: userId, emoji });
    }
  }

  return (
    <>
      {/* floating bubble */}
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Otevřít kecárnu"
          className="fixed bottom-24 left-4 z-30 flex items-center gap-2 rounded-full border border-white/60 bg-white/90 px-4 py-2.5 text-sm font-semibold text-neutral-800 shadow-lg shadow-black/25 backdrop-blur-lg transition-colors hover:border-neutral-400 dark:border-neutral-600/60 dark:bg-neutral-800/95 dark:text-neutral-100 md:bottom-6"
        >
          <MessageCircle className="size-4" />
          Kecárna
          {unread > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-[#FFD400] text-[11px] font-bold text-black">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {/* slide-up panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[75vh] flex-col rounded-t-2xl border-t border-white/45 bg-white shadow-2xl dark:border-neutral-700/45 dark:bg-neutral-900"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <MessageCircle className="size-4" />
                Kecárna
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zavřít"
                className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col-reverse gap-3 overflow-y-auto px-4 py-3 [-webkit-overflow-scrolling:touch]">
              {comments.length === 0 && (
                <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Zatím ticho. Hoď první hlášku!
                </p>
              )}
              {comments.map((comment) =>
                comment.isSystem ? (
                  <div
                    key={comment.id}
                    className="mx-auto max-w-[85%] rounded-full bg-[#FFD400]/15 px-3 py-1.5 text-center text-xs font-medium text-yellow-800 dark:text-[#FFD400]"
                  >
                    {comment.body}
                  </div>
                ) : (
                  <div key={comment.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p>
                        <span className={cn("font-semibold", comment.user_id === userId && "text-yellow-600 dark:text-[#FFD400]")}>
                          {comment.nickname}
                        </span>{" "}
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
                          {formatTime(comment.created_at)}
                        </span>
                        <br />
                        <span className="break-words text-neutral-700 dark:text-neutral-300">{comment.body}</span>
                      </p>

                      <div className="relative mt-1 flex flex-wrap items-center gap-1">
                        {Object.entries(
                          comment.reactions.reduce<Record<string, Reaction[]>>((groups, r) => {
                            (groups[r.emoji] ??= []).push(r);
                            return groups;
                          }, {})
                        ).map(([emoji, reactions]) => {
                          const mine = reactions.some((r) => r.user_id === userId);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => toggleReaction(comment, emoji)}
                              className={cn(
                                "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none",
                                mine
                                  ? "border-[#FFD400] bg-[#FFD400]/15 text-yellow-800 dark:text-[#FFD400]"
                                  : "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300"
                              )}
                            >
                              <EmojiGlyph native={emoji} size={14} />
                              <span>{reactions.length}</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setReactingTo(reactingTo === comment.id ? null : comment.id)}
                          aria-label="Přidat reakci"
                          className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                        >
                          <SmilePlus className="size-3.5" />
                        </button>
                        {reactingTo === comment.id && (
                          <div className="absolute bottom-full left-0 z-10 mb-1 flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                            {REACTION_EMOJI.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => toggleReaction(comment, emoji)}
                                className="transition-transform hover:scale-125"
                              >
                                <EmojiGlyph native={emoji} size={20} />
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setReactingTo(null);
                                setPickerFor(comment.id);
                              }}
                              aria-label="Víc emoji"
                              className="rounded-full p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                            >
                              <SmilePlus className="size-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {(comment.user_id === userId || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => remove(comment.id)}
                        className="shrink-0 text-neutral-400 hover:text-red-600"
                        aria-label="Smazat komentář"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                )
              )}
            </div>

            <form
              onSubmit={submit}
              className="flex gap-2 border-t border-neutral-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-neutral-800"
            >
              <input
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
                placeholder="Napiš něco ostatním…"
                className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              />
              <Button type="submit" variant="accent" size="sm" disabled={sending || !body.trim()}>
                {sending ? "…" : "Odeslat"}
              </Button>
            </form>
            {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}

      {pickerFor && (
        <EmojiPickerSheet
          onSelect={(native) => {
            const comment = comments.find((c) => c.id === pickerFor);
            if (comment) toggleReaction(comment, native);
            setPickerFor(null);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </>
  );
}
