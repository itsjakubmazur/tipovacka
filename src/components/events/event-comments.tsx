"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { MessageCircle, SmilePlus, Trash2, X, Send } from "lucide-react";
import { EmojiGlyph } from "@/components/events/emoji-glyph";
import { EmojiPickerSheet } from "@/components/events/emoji-picker-sheet";
import { LiveFightPoll } from "@/components/events/live-fight-poll";

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

// muted, per-person avatar tints - distinct enough to tell people apart,
// desaturated enough not to fight the yellow accent
const AVATAR_COLORS = [
  "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  "bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300",
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString(
    "cs-CZ",
    sameDay
      ? { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }
      : { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }
  );
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
  livePoll,
}: {
  eventId: string;
  userId: string;
  isAdmin: boolean;
  initialComments: Comment[];
  livePoll?: {
    fightId: string;
    fighterAId: string;
    fighterAName: string;
    fighterBId: string;
    fighterBName: string;
  } | null;
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
            <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-black">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {/* slide-up chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-panel relative flex max-h-[82vh] flex-col overflow-hidden rounded-t-2xl border-t border-white/45 bg-white shadow-2xl shadow-black/40 dark:border-neutral-700/45 dark:bg-neutral-900"
          >
            {/* grab handle */}
            <div className="flex shrink-0 justify-center pt-2">
              <span className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>

            {/* header */}
            <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent/15 text-yellow-600 dark:text-accent">
                  <MessageCircle className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold leading-tight">Kecárna</p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Chat galavečera</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zavřít"
                className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="size-5" />
              </button>
            </div>

            {livePoll && (
              <div className="shrink-0">
                <LiveFightPoll eventId={eventId} userId={userId} fight={livePoll} />
              </div>
            )}

            {/* messages */}
            <div className="flex min-h-0 flex-1 flex-col-reverse gap-1 overflow-y-auto px-3 py-3 [-webkit-overflow-scrolling:touch]">
              {comments.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-accent/15 text-yellow-600 dark:text-accent">
                    <MessageCircle className="size-6" />
                  </span>
                  <p className="text-sm font-medium">Zatím ticho.</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Hoď první hlášku!</p>
                </div>
              )}
              {comments.map((comment, i) => {
                if (comment.isSystem) {
                  return (
                    <div key={comment.id} className="my-1.5 flex justify-center">
                      <span className="max-w-[85%] rounded-full bg-accent/15 px-3 py-1 text-center text-[11px] font-medium text-yellow-800 dark:text-accent">
                        {comment.body}
                      </span>
                    </div>
                  );
                }

                const older = comments[i + 1];
                const newer = comments[i - 1];
                const isOwn = comment.user_id === userId;
                const firstOfGroup = !older || older.isSystem || older.user_id !== comment.user_id;
                const lastOfGroup = !newer || newer.isSystem || newer.user_id !== comment.user_id;
                const canDelete = isOwn || isAdmin;

                const reactionChips = Object.entries(
                  comment.reactions.reduce<Record<string, Reaction[]>>((groups, r) => {
                    (groups[r.emoji] ??= []).push(r);
                    return groups;
                  }, {})
                );

                return (
                  <div
                    key={comment.id}
                    className={cn(
                      "flex items-end gap-2",
                      firstOfGroup && "mt-2",
                      isOwn ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* avatar (incoming only, once per group at the bottom) */}
                    {!isOwn &&
                      (lastOfGroup ? (
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            avatarColor(comment.nickname)
                          )}
                        >
                          {initials(comment.nickname)}
                        </span>
                      ) : (
                        <span className="w-7 shrink-0" />
                      ))}

                    <div className={cn("flex min-w-0 max-w-[80%] flex-col", isOwn ? "items-end" : "items-start")}>
                      {firstOfGroup && !isOwn && (
                        <span className="mb-0.5 px-1 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                          {comment.nickname}
                        </span>
                      )}

                      <div className={cn("group/msg relative flex items-end gap-1", isOwn && "flex-row-reverse")}>
                        <div
                          className={cn(
                            "whitespace-pre-wrap break-words px-3 py-1.5 text-sm shadow-sm",
                            isOwn
                              ? "rounded-2xl rounded-br-md bg-accent text-black"
                              : "rounded-2xl rounded-bl-md bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
                          )}
                        >
                          {comment.body}
                        </div>

                        {/* hover actions: react + delete */}
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100 max-md:opacity-60">
                          <button
                            type="button"
                            onClick={() => setReactingTo(reactingTo === comment.id ? null : comment.id)}
                            aria-label="Přidat reakci"
                            className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                          >
                            <SmilePlus className="size-4" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => remove(comment.id)}
                              aria-label="Smazat zprávu"
                              className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-600"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>

                        {/* quick-reaction popover */}
                        {reactingTo === comment.id && (
                          <div
                            className={cn(
                              "absolute bottom-full z-10 mb-1 flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900",
                              isOwn ? "right-0" : "left-0"
                            )}
                          >
                            {REACTION_EMOJI.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => toggleReaction(comment, emoji)}
                                className="transition-transform hover:scale-125"
                              >
                                <EmojiGlyph native={emoji} size={22} />
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
                              <SmilePlus className="size-5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* reaction chips */}
                      {reactionChips.length > 0 && (
                        <div className={cn("mt-1 flex flex-wrap gap-1", isOwn && "justify-end")}>
                          {reactionChips.map(([emoji, reactions]) => {
                            const mine = reactions.some((r) => r.user_id === userId);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => toggleReaction(comment, emoji)}
                                className={cn(
                                  "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors",
                                  mine
                                    ? "border-accent bg-accent/15 text-yellow-800 dark:text-accent"
                                    : "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300"
                                )}
                              >
                                <EmojiGlyph native={emoji} size={13} />
                                <span>{reactions.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* timestamp, once per group */}
                      {lastOfGroup && (
                        <span className="mt-0.5 px-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                          {formatTime(comment.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* composer */}
            <form
              onSubmit={submit}
              className="flex shrink-0 items-center gap-2 border-t border-neutral-200 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] dark:border-neutral-800"
            >
              <input
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
                placeholder="Napiš něco ostatním…"
                className="min-w-0 flex-1 rounded-full border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm outline-none transition-colors placeholder:text-neutral-400 focus-visible:border-accent focus-visible:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:focus-visible:bg-neutral-950"
              />
              <button
                type="submit"
                disabled={sending || !body.trim()}
                aria-label="Odeslat"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-black transition-transform hover:bg-[#e6bf00] active:scale-90 disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </form>
            {error && <p className="shrink-0 px-4 pb-2 text-sm text-red-600">{error}</p>}
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
