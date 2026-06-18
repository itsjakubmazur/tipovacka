"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function PromoteUserButton({
  targetUserId,
  isAdmin,
}: {
  targetUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc("admin_set_user_admin", {
      target_user_id: targetUserId,
      new_is_admin: !isAdmin,
    });
    setSaving(false);
    if (error) {
      setError("Změna se nepodařila.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant={isAdmin ? "outline" : "accent"} disabled={saving} onClick={toggle}>
        {saving ? "Ukládám…" : isAdmin ? "Odebrat admina" : "Udělat adminem"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
