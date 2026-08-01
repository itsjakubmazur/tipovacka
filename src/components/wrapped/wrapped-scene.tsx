"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Share2, Swords, Ghost, MessageCircle, Award, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedCardImage } from "@/components/leaderboard/generated-card-image";
import type { Scene } from "@/lib/wrapped-scenes";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/** One full-screen scene. Everything inside `.stagger-in` arrives in
 * sequence; the player remounts this on every step, so the choreography
 * replays each time instead of only on first load. */
export function WrappedScene({ scene }: { scene: Scene }) {
  switch (scene.kind) {
    case "intro":
      return (
        <Frame>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
            OKTAGON GARÁŽ Tipovačka
          </p>
          <h2 className="wrapped-display text-6xl leading-[0.9] tracking-tight sm:text-8xl">
            Sezóna
            <br />
            <span className="text-accent">{scene.season}</span>
          </h2>
          <p className="max-w-sm text-lg text-white/80">
            {scene.nickname}, tohle byl tvůj rok. {scene.galas}{" "}
            {scene.galas === 1 ? "galavečer" : scene.galas <= 4 ? "galavečery" : "galavečerů"}, které
            jsi odtipoval.
          </p>
          <p className="pt-2 text-sm text-white/50">Ťukni pro další →</p>
        </Frame>
      );

    case "stat":
      return (
        <Frame>
          <Eyebrow>{scene.eyebrow}</Eyebrow>
          <p className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
            <CountUpNumber value={scene.value} />
            {scene.unit && (
              <span className="text-2xl font-bold text-white/70 sm:text-3xl">{scene.unit}</span>
            )}
          </p>
          <p className="max-w-sm text-xl font-semibold">{scene.label}</p>
          {scene.sub && <p className="max-w-sm text-base text-white/60">{scene.sub}</p>}
        </Frame>
      );

    case "ring":
      return (
        <Frame>
          <Eyebrow>{scene.eyebrow}</Eyebrow>
          <AccuracyRing percent={scene.percent} />
          <p className="max-w-sm text-xl font-semibold">{scene.label}</p>
          {scene.sub && <p className="max-w-sm text-base text-white/60">{scene.sub}</p>}
        </Frame>
      );

    case "night":
      return (
        <Frame>
          <Eyebrow>{scene.eyebrow}</Eyebrow>
          {scene.poster && (
            <div className="relative aspect-[16/9] w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 shadow-2xl shadow-black/60">
              <Image src={scene.poster} alt="" fill sizes="384px" className="object-cover" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <p className="wrapped-display text-3xl">{scene.title}</p>
            {scene.subtitle && <p className="text-sm text-white/60">{scene.subtitle}</p>}
          </div>
          <p className="flex items-baseline justify-center gap-2">
            <span
              className={cn(
                "wrapped-display text-7xl tabular-nums sm:text-8xl",
                scene.tone === "best" ? "text-accent" : "text-white/70"
              )}
            >
              {scene.points}
            </span>
            <span className="text-xl font-bold text-white/60">b.</span>
          </p>
          {scene.rank && (
            <p className="text-lg font-semibold text-white/80">
              {scene.rank}. místo z {scene.participants}
            </p>
          )}
        </Frame>
      );

    case "bars":
      return (
        <Frame>
          <Eyebrow>{scene.eyebrow}</Eyebrow>
          <h2 className="wrapped-display max-w-sm text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            {scene.title}
          </h2>
          <div className="flex w-full max-w-sm flex-col gap-3 pt-2">
            {scene.rows.map((row, index) => {
              const max = Math.max(...scene.rows.map((r) => r.value), 1);
              return (
                <div key={row.label} className="flex flex-col gap-1 text-left">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{row.label}</span>
                    <span className="tabular-nums text-white/60">{row.caption}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="wrapped-bar h-full rounded-full bg-accent"
                      style={
                        {
                          "--bar-width": `${Math.round((row.value / max) * 100)}%`,
                          animationDelay: `${200 + index * 120}ms`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {scene.sub && <p className="max-w-sm pt-1 text-sm text-white/60">{scene.sub}</p>}
        </Frame>
      );

    case "archetype":
      return (
        <Frame>
          <Eyebrow>Tvůj tipérský typ</Eyebrow>
          <p className="text-sm font-bold tracking-[0.4em] text-accent">{scene.archetype.code}</p>
          <h2 className="wrapped-display text-6xl leading-[0.95] tracking-tight sm:text-7xl">
            {scene.archetype.name}
          </h2>
          <p className="max-w-sm text-lg text-white/80">{scene.archetype.tagline}</p>
          <div className="flex w-full max-w-sm flex-col gap-2.5 pt-2">
            {scene.archetype.axes.map((axis, index) => (
              <div key={axis.key} className="flex flex-col gap-1 text-left">
                <div className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide">
                  <span className={axis.value < 0.5 ? "text-accent" : "text-white/40"}>
                    {axis.low.label}
                  </span>
                  <span className="text-[10px] font-normal normal-case tracking-normal text-white/50">
                    {axis.evidence}
                  </span>
                  <span className={axis.value >= 0.5 ? "text-accent" : "text-white/40"}>
                    {axis.high.label}
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-white/15">
                  <div
                    className="wrapped-dot absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-lg shadow-accent/40"
                    style={
                      {
                        "--dot-left": `${Math.round(axis.value * 100)}%`,
                        animationDelay: `${250 + index * 100}ms`,
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          {scene.archetype.provisional && (
            <p className="max-w-sm text-xs text-white/40">
              Zatím z menšího vzorku - čím víc gal odtipuješ, tím přesnější to bude.
            </p>
          )}
        </Frame>
      );

    case "solo":
      return (
        <Frame>
          <Eyebrow>Sám proti všem</Eyebrow>
          <Ghost className="size-12 text-accent" />
          <h2 className="wrapped-display max-w-sm text-5xl leading-[1.05] tracking-tight">
            {scene.fighterName}
          </h2>
          <p className="max-w-sm text-lg text-white/80">
            Na {scene.eventLabel} jsi na něj vsadil jako{" "}
            {scene.share <= 0.2 ? "skoro jediný" : "jeden z mála"} - a vyšlo to.
          </p>
          <p className="text-sm text-white/50">
            Tipoval ho {Math.round(scene.share * 100)} % tipérů
          </p>
        </Frame>
      );

    case "nemesis":
      return (
        <Frame>
          <Eyebrow>Tvůj rival</Eyebrow>
          <Swords className="size-12 text-accent" />
          <h2 className="wrapped-display text-5xl tracking-tight">{scene.nickname}</h2>
          <p className="wrapped-display flex items-center gap-4 text-7xl tabular-nums">
            <span className={scene.wins >= scene.losses ? "text-accent" : "text-white/50"}>
              {scene.wins}
            </span>
            <span className="text-2xl text-white/30">:</span>
            <span className={scene.losses > scene.wins ? "text-accent" : "text-white/50"}>
              {scene.losses}
            </span>
          </p>
          <p className="max-w-sm text-base text-white/70">
            {scene.wins > scene.losses
              ? "Sezónu jsi vyhrál ty. Zatím."
              : scene.wins < scene.losses
                ? "Tenhle rok měl navrch. Příště."
                : "Naprostá remíza. To se musí rozseknout."}
          </p>
        </Frame>
      );

    case "chat":
      return (
        <Frame>
          <Eyebrow>Kecárna</Eyebrow>
          <MessageCircle className="size-12 text-accent" />
          <p className="flex items-baseline justify-center gap-3">
            <CountUpNumber value={String(scene.count)} />
            <span className="text-2xl font-bold text-white/70">
              {scene.count === 1 ? "zpráva" : scene.count <= 4 ? "zprávy" : "zpráv"}
            </span>
          </p>
          {scene.gifs > 0 && (
            <p className="text-base text-white/60">z toho {scene.gifs}× GIF</p>
          )}
          {scene.topEmoji && (
            <p className="text-base text-white/70">
              Nejvíc ti sypali <span className="text-2xl align-middle">{scene.topEmoji}</span>
            </p>
          )}
          {scene.topReacted && (
            <blockquote className="max-w-sm rounded-2xl border border-white/15 bg-white/5 p-4 text-left text-base italic">
              &bdquo;{scene.topReacted.body}&ldquo;
              <span className="mt-2 block text-xs not-italic text-white/50">
                {scene.topReacted.count}× reakce - tvoje nejúspěšnější hláška
              </span>
            </blockquote>
          )}
        </Frame>
      );

    case "badges":
      return (
        <Frame>
          <Eyebrow>Co sis vysloužil</Eyebrow>
          <Award className="size-12 text-accent" />
          <div className="flex max-w-sm flex-wrap justify-center gap-2 pt-1">
            {scene.badges.map((badge, index) => (
              <span
                key={badge.key}
                className="wrapped-pop rounded-full border border-accent/50 bg-accent/15 px-3.5 py-1.5 text-sm font-semibold"
                style={{ animationDelay: `${150 + index * 90}ms` }}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </Frame>
      );

    case "finale":
      return <Finale scene={scene} />;
  }
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrapped-shadow stagger-in flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">{children}</p>
  );
}

/** Big numbers land better when they arrive than when they're just there.
 * Pure CSS would need the value as a number; this walks whatever numeric
 * prefix the string has and leaves the rest alone (so "7/9" still works). */
function CountUpNumber({ value }: { value: string }) {
  const target = Number(value);
  const reduce = usePrefersReducedMotion();
  const [shown, setShown] = useState(() => (Number.isFinite(target) ? 0 : null));

  useEffect(() => {
    if (!Number.isFinite(target) || reduce) return;
    const duration = 900;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic, same feel as the app's other entrances
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, reduce]);

  const display = shown == null ? value : reduce ? target : shown;
  return (
    <span className="wrapped-display text-8xl leading-none tabular-nums text-accent sm:text-9xl">
      {display}
    </span>
  );
}

function AccuracyRing({ percent }: { percent: number }) {
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const reduce = usePrefersReducedMotion();
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    // in a timer, not straight away: the ring has to start empty for the
    // stroke transition to have anything to animate
    const id = setTimeout(() => setDrawn(percent), 60);
    return () => clearTimeout(id);
  }, [percent]);

  const shown = reduce ? percent : drawn;

  return (
    <div className="relative size-44">
      <svg viewBox="0 0 160 160" className="size-full -rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#ffd400"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          className="transition-[stroke-dashoffset] duration-[1200ms] ease-out motion-reduce:transition-none"
        />
      </svg>
      <span className="wrapped-display absolute inset-0 flex items-center justify-center text-6xl tabular-nums">
        {percent}
        <span className="text-2xl">%</span>
      </span>
    </div>
  );
}

function Finale({ scene }: { scene: Extract<Scene, { kind: "finale" }> }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function share() {
    if (navigator.share) {
      try {
        const blob = await fetch(scene.shareUrl).then((r) => (r.ok ? r.blob() : Promise.reject()));
        const file = new File([blob], `tipovacka-sezona-${scene.season}.png`, {
          type: "image/png",
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: scene.shareText });
          return;
        }
      } catch {
        // fall through to a plain text share
      }
      try {
        await navigator.share({ title: "OKTAGON GARÁŽ Tipovačka", text: scene.shareText });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(scene.shareText);
    setFeedback("Zkopírováno!");
    setTimeout(() => setFeedback(null), 2000);
  }

  return (
    <div className="wrapped-shadow stagger-in flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
      <Eyebrow>Sezóna {scene.season}</Eyebrow>
      <div className="w-full max-w-[280px]">
        <GeneratedCardImage
          src={scene.shareUrl}
          alt={`Sezóna ${scene.season}: ${scene.nickname}, ${scene.points} b.`}
          aspect="aspect-[1080/1920]"
        />
      </div>
      <Button type="button" variant="accent" onClick={share}>
        <Share2 className="size-4" />
        {feedback ?? "Sdílet"}
      </Button>
      <p className="flex items-center gap-1.5 text-sm text-white/50">
        <Flame className="size-4" />
        Ať to ostatní vidí
      </p>
    </div>
  );
}
