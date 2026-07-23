"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBroadcastRecipientCount, triggerBroadcastPush } from "@/app/admin/actions";

function peopleWord(n: number): string {
  if (n === 1) return "člověka";
  if (n >= 2 && n <= 4) return "lidi";
  return "lidí";
}

function deviceWord(n: number): string {
  if (n === 1) return "zařízení";
  if (n >= 2 && n <= 4) return "zařízení";
  return "zařízení";
}

export function BroadcastPushForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reach, setReach] = useState<{ devices: number; people: number } | null>(null);

  useEffect(() => {
    getBroadcastRecipientCount().then((r) => {
      if ("error" in r) return;
      setReach(r);
    });
  }, []);

  function requestSend(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!title.trim() || !body.trim()) {
      setMessage("Vyplň název i text upozornění.");
      return;
    }
    setConfirming(true);
  }

  function send() {
    startTransition(async () => {
      const result = await triggerBroadcastPush(title, body, url);
      setConfirming(false);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage(
        reach
          ? `Odesláno — dorazí na ${reach.devices} ${deviceWord(reach.devices)} (${reach.people} ${peopleWord(reach.people)}), co mají upozornění zapnutá.`
          : "Odesláno — za chvíli dorazí všem, co mají upozornění zapnutá."
      );
      setTitle("");
      setBody("");
      setUrl("");
    });
  }

  return (
    <form
      onSubmit={requestSend}
      className="flex flex-col gap-2 rounded-xl border border-white/45 bg-white/35 p-4 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60"
    >
      <Input
        placeholder="Název upozornění"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
      />
      <textarea
        placeholder="Text upozornění"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={250}
        rows={3}
        className="rounded-md border border-neutral-300 bg-white p-2 text-sm outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-black dark:border-neutral-700 dark:bg-neutral-900 dark:focus-visible:ring-white"
      />
      <Input
        placeholder="Odkaz po kliknutí (volitelné, např. /events)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      {reach && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Dorazí na {reach.devices} {deviceWord(reach.devices)} ({reach.people} {peopleWord(reach.people)}{" "}
          s&nbsp;zapnutými upozorněními).
        </p>
      )}

      {!confirming ? (
        <Button type="submit" variant="accent" disabled={pending} className="self-start">
          Poslat upozornění všem
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-yellow-500/40 bg-accent/10 p-3">
          <p className="text-sm font-medium">
            Opravdu poslat všem{reach ? ` (${reach.people} ${peopleWord(reach.people)})` : ""}? Tohle se
            nedá vzít zpět.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="accent" disabled={pending} onClick={send}>
              {pending ? "Odesílám…" : "Ano, poslat"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
              Zrušit
            </Button>
          </div>
        </div>
      )}
      {message && <p className="text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
    </form>
  );
}
