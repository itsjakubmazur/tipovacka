"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  nickname: string;
};

const MAX_LENGTH = 500;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

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
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`event-comments-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_comments", filter: `event_id=eq.${eventId}` },
        async () => {
          const { data } = await supabase
            .from("event_comments")
            .select("id, user_id, body, created_at, profiles(nickname)")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false })
            .limit(100);
          if (data) {
            setComments(
              (data as unknown as (Omit<Comment, "nickname"> & { profiles: { nickname: string } | null })[]).map(
                (c) => ({ ...c, nickname: c.profiles?.nickname ?? "Bez přezdívky" })
              )
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId]);

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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="text-sm font-semibold">💬 Kecárna</p>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Napiš něco ostatním…"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        />
        <Button type="submit" variant="accent" size="sm" disabled={sending || !body.trim()}>
          {sending ? "…" : "Odeslat"}
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        {comments.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Zatím ticho. Hoď první hlášku!
          </p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="flex items-start justify-between gap-2 text-sm">
            <p className="min-w-0">
              <span className="font-semibold">{comment.nickname}</span>{" "}
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {formatTime(comment.created_at)}
              </span>
              <br />
              <span className="break-words text-neutral-700 dark:text-neutral-300">{comment.body}</span>
            </p>
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
        ))}
      </div>
    </div>
  );
}
