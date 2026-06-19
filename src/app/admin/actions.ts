"use server";

const REPO = "itsjakubmazur/tipovacka";

export async function triggerBroadcastPush(title: string, body: string, url: string) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return { error: "GITHUB_DISPATCH_TOKEN není nastavený ve Vercel env proměnných." };
  }
  if (!title.trim() || !body.trim()) {
    return { error: "Vyplň název i text upozornění." };
  }

  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/broadcast-push.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { title, body, url: url.trim() || "/" },
      }),
    }
  );

  if (!resp.ok) {
    return { error: `GitHub Actions vrátil chybu (${resp.status}).` };
  }
  return { ok: true as const };
}
