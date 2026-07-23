"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();

  // The reset link carries a recovery token; supabase-js exchanges it for a
  // session on load. Until that lands we don't yet have a session to update.
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setReady(true);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Hesla se neshodují.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError("Nové heslo se nepodařilo nastavit. Odkaz mohl vypršet — vyžádej si nový.");
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/events");
      router.refresh();
    }, 1200);
  }

  if (done) {
    return (
      <p className="max-w-sm text-center text-sm text-neutral-700 dark:text-neutral-300">
        Heslo změněno. Přesměrovávám tě…
      </p>
    );
  }

  if (!ready) {
    return (
      <p className="max-w-sm text-center text-sm text-neutral-600 dark:text-neutral-400">
        Ověřuji odkaz… Pokud se nic nestane, odkaz mohl vypršet. Vyžádej si nový na
        přihlašovací stránce.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">Nové heslo</Label>
        <Input
          id="new-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">Nové heslo znovu</Label>
        <Input
          id="confirm-password"
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" variant="accent" disabled={loading}>
        {loading ? "Ukládám…" : "Nastavit heslo"}
      </Button>
    </form>
  );
}
