import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect("/events");
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-12">
      <h1 className="text-xl font-bold">Přihlášení do Tipovačky</h1>
      <LoginForm />
    </div>
  );
}
