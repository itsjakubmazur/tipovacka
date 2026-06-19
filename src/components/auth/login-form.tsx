"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError("Nesprávný e-mail nebo heslo.");
        return;
      }
      router.push("/events");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname: nickname || email.split("@")[0] } },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        router.push("/events");
        router.refresh();
      } else {
        setInfo("Účet vytvořen. Zkontroluj e-mail a potvrď registraci, pak se přihlas.");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex rounded-md border border-neutral-300 dark:border-neutral-700 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-md py-1.5 font-medium ${
            mode === "login" ? "bg-black text-white" : "text-neutral-600 dark:text-neutral-400"
          }`}
        >
          Přihlášení
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-md py-1.5 font-medium ${
            mode === "register" ? "bg-black text-white" : "text-neutral-600 dark:text-neutral-400"
          }`}
        >
          Registrace
        </button>
      </div>

      {mode === "register" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nickname">Přezdívka</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Jak tě uvidí ostatní v žebříčku"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Heslo</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-neutral-700 dark:text-neutral-300">{info}</p>}

      <Button type="submit" variant="accent" disabled={loading}>
        {loading ? "Pracuji…" : mode === "login" ? "Přihlásit se" : "Vytvořit účet"}
      </Button>
    </form>
  );
}
