import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/wordmark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect("/events");
  }

  const { mode } = await searchParams;
  const initialMode = mode === "register" ? "register" : "login";

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-4 py-12">
      <Wordmark className="text-2xl" />
      <div className="glass-surface w-full max-w-sm rounded-2xl border p-6 shadow-black/10 dark:shadow-black/40">
        <LoginForm initialMode={initialMode} />
      </div>
    </div>
  );
}
