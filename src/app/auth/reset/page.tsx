import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Obnova hesla" };

// The form spins up a Supabase browser client on render; keep this page out
// of static prerendering so build doesn't need the runtime env vars.
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col items-center gap-6 px-4 py-12">
      <h1 className="text-xl font-bold">Nastavit nové heslo</h1>
      <ResetPasswordForm />
    </div>
  );
}
