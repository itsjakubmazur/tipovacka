"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { triggerBroadcastPush } from "@/app/admin/actions";

export function BroadcastPushForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await triggerBroadcastPush(title, body, url);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage("Odesláno — za chvíli dorazí všem, co mají upozornění zapnutá.");
      setTitle("");
      setBody("");
      setUrl("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
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
        className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent p-2 text-sm"
      />
      <Input
        placeholder="Odkaz po kliknutí (volitelné, např. /events)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button type="submit" variant="accent" disabled={pending} className="self-start">
        {pending ? "Odesílám…" : "Poslat upozornění všem"}
      </Button>
      {message && <p className="text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
    </form>
  );
}
