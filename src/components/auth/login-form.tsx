"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register" | "reset";

/** Supabase auth errors come back in English; surface the ones players are
 * likely to hit in Czech, and fall back to a generic line otherwise. */
function czechAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Na tento e-mail už účet existuje. Zkus se přihlásit.";
  }
  if (m.includes("password should be at least") || m.includes("password is too short")) {
    return "Heslo musí mít aspoň 6 znaků.";
  }
  if (m.includes("invalid email") || m.includes("unable to validate email")) {
    return "Zadej platný e-mail.";
  }
  if (m.includes("email rate limit") || m.includes("rate limit")) {
    return "Moc pokusů po sobě. Zkus to za chvíli znovu.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "Registrace je momentálně zavřená.";
  }
  return "Něco se nepovedlo. Zkus to prosím znovu.";
}

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      setLoading(false);
      if (error) {
        setError(czechAuthError(error.message));
        return;
      }
      setInfo("Pokud na tento e-mail existuje účet, poslali jsme odkaz na obnovu hesla.");
      return;
    }

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
      // friendly pre-check; the handle_new_user trigger enforces the
      // same code server-side even if this call is skipped
      const { data: codeOk } = await supabase.rpc("check_invite_code", {
        code: inviteCode.trim(),
      });
      if (!codeOk) {
        setLoading(false);
        setError("Zvací kód nesedí. Vyžádej si ho od někoho z party.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname: nickname || email.split("@")[0],
            invite_code: inviteCode.trim(),
          },
        },
      });
      setLoading(false);
      if (error) {
        setError(czechAuthError(error.message));
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

  if (mode === "reset") {
    return (
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Obnova hesla</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Zadej e-mail a pošleme ti odkaz na nastavení nového hesla.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email">E-mail</Label>
          <Input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-neutral-700 dark:text-neutral-300">{info}</p>}

        <Button type="submit" variant="accent" disabled={loading}>
          {loading ? "Odesílám…" : "Poslat odkaz"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setInfo(null);
          }}
          className="text-sm text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
        >
          Zpět na přihlášení
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex rounded-md border border-neutral-300 dark:border-neutral-700 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
            mode === "login"
              ? "bg-accent text-black"
              : "text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          Přihlášení
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
            mode === "register"
              ? "bg-accent text-black"
              : "text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          Registrace
        </button>
      </div>

      {mode === "register" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nickname">Přezdívka</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Jak tě uvidí ostatní v žebříčku"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-code">Zvací kód</Label>
            <Input
              id="invite-code"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Dostaneš od někoho z party"
            />
          </div>
        </>
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

      {mode === "login" && (
        <button
          type="button"
          onClick={() => {
            setMode("reset");
            setError(null);
            setInfo(null);
          }}
          className="-mt-2 self-start text-sm text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
        >
          Zapomněl jsi heslo?
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-neutral-700 dark:text-neutral-300">{info}</p>}

      <Button type="submit" variant="accent" disabled={loading}>
        {loading ? "Pracuji…" : mode === "login" ? "Přihlásit se" : "Vytvořit účet"}
      </Button>
    </form>
  );
}
