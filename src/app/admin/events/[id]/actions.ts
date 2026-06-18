"use server";

const REPO = "itsjakubmazur/tipovacka";

export async function triggerSherdogImport(eventId: string, mode: "card" | "results") {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return { error: "GITHUB_DISPATCH_TOKEN není nastavený ve Vercel env proměnných." };
  }

  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/sherdog-scraper.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { mode, event_id: eventId },
      }),
    }
  );

  if (!resp.ok) {
    return { error: `GitHub Actions vrátil chybu (${resp.status}).` };
  }
  return { ok: true as const };
}
