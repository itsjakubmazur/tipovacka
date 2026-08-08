---
name: OKTAGON GARÁŽ Tipovačka
description: Tipovačka na Oktagon MMA galavečery pro uzavřenou partu kamarádů
colors:
  background: "#f1f1f2"
  background-dark: "#161616"
  foreground: "#0a0a0a"
  foreground-dark: "#ededed"
  accent: "#ffd400"
  accent-deep: "#e8be00"
  danger: "#ef4444"
  success: "#22c55e"
  info-blue: "#2563eb"
typography:
  display:
    fontFamily: "var(--font-wrapped), Geist, sans-serif"
    fontWeight: 400
    letterSpacing: "0.005em"
  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
  mono:
    fontFamily: "Geist Mono, monospace"
rounded:
  md: "0.375rem"
  xl: "0.75rem"
  full: "9999px"
components:
  button-default:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.md}"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "#000000"
    rounded: "{rounded.md}"
  card:
    rounded: "{rounded.xl}"
  badge-accent:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.full}"
---

# Design System: OKTAGON GARÁŽ Tipovačka

## Overview

**Creative North Star: "Fight-night glass"**

The app reads as a piece of arena signage lit from below, not a business tool:
a warm yellow glow bleeds up from the bottom of every screen, and nearly
every surface — buttons, cards, pills, the nav bar, the bottom bar — is built
from the same layered-glass material (`.glass-*` classes in `globals.css`):
a vertical brightness gradient, a bright specular line along the top inside
edge, a hairline rim, and a drop shadow. Structural surfaces (cards, chips,
the bottom bar) keep the *look* of glass without paying for blur; only
elements that actually float over content (the header, modals, the install
prompt) carry a real `backdrop-filter`. The system is dark-mode-first, high
contrast, and unapologetically loud about its one accent color — yellow —
while staying flat and calm everywhere that color isn't the point.

Motion is a first-class part of the identity, not a garnish: pages fade and
lift in, lists stagger row by row, a saved tip pulses an accent ring, a
graded fight's result wipes in left-to-right, and the leaderboard podium
rises like blocks growing out of the floor. Every animation is deliberate,
short, and wrapped in `prefers-reduced-motion` / `prefers-reduced-transparency`
fallbacks — motion earns its place by marking a real event (a tip landed, a
fight got graded), never as decoration for its own sake.

**Key Characteristics:**
- One accent color (`#ffd400`), used sparingly and always "as glass" (lit,
  not flat) so its rare appearances read as *chosen* or *important*.
- Everything is a layered-glass surface with a consistent light-from-above
  construction; nothing is a flat, borderless rectangle.
- Dark mode is the primary experience; light mode exists but the glow, the
  chrome header, and event-poster imagery are tuned for dark first.
- Motion marks state changes (saved, graded, arrived) — it is never ambient
  or looping without a reason, and always respects reduced-motion/transparency.

## Colors

Small, high-contrast palette: one warm accent against a near-black/near-white
neutral pair, with three status colors (green/blue/red) built as the same
glass material rather than flat swatches.

### Primary
- **Oktagon Yellow** (`#ffd400`): the single accent — CTAs, selected state
  (chosen fight-card pick, active nav pill), highlights, glow. Rendered as
  `.glass-accent` (lit gradient + rim) rather than a flat fill wherever it
  appears as a surface.

### Neutral
- **Arena Fog** (`#f1f1f2`, light bg) / **Ringside Black** (`#161616`, dark
  bg): page background, set under a fixed radial yellow glow (`body::before`).
- **Ink** (`#0a0a0a`, light fg) / **Bone** (`#ededed`, dark fg): primary text.

### Status glass
- **Glass Green** (`rgba(34,168,83,.98)→rgba(21,128,61,.96)`): won/graded-correct state.
- **Glass Blue** (`rgba(80,150,255,.98)→rgba(37,99,235,.96)`): informational tag.
- **Glass Danger** (`rgba(239,68,68,.16)`, translucent both themes): voided
  fights, failed rows, destructive intent.
- **Glass Success** (`rgba(34,197,94,.16)`, translucent both themes): soft
  positive confirmation distinct from the solid Glass Green.

### Named Rules
**The Lit-Not-Flat Rule.** The accent never appears as a flat `#ffd400`
fill on an interactive surface — it is always built from the `.glass-accent`
gradient + specular + rim, so the one color the app spends is never spent
cheaply.

## Typography

**Body Font:** Geist (with Arial, Helvetica, sans-serif fallback)
**Mono Font:** Geist Mono
**Display Font (Wrapped only):** a condensed local face loaded as
`--font-wrapped`, layered over Geist as fallback.

**Character:** Geist is the everyday face — a plain, legible UI grotesk that
gets out of the way of the data (odds, scores, countdowns). The Wrapped
display face is condensed and single-weight, reserved for the yearly recap
so that surface alone gets to feel like a fight poster instead of a tool.

### Hierarchy
- **Display** (Wrapped only, condensed, `letter-spacing: 0.005em`): season-recap
  numbers and headlines; never used for body copy.
- **Body** (Geist, default weight): all standard UI text.
- **Label** (Geist, `font-medium`/`font-semibold`, small size): buttons,
  badges, section headings.

### Named Rules
**The One Display Rule.** The condensed Wrapped face is scoped to `/wrapped`
only and never touches body copy anywhere, including on `/wrapped` itself —
it's reserved for type that "carries a scene" (headlines, big numbers).

## Layout

Mobile-first single-column layout, `max-w-3xl` by default widening to
`max-w-5xl`/`max-w-6xl` on larger breakpoints (`lg:`/`xl:`) for the app
shell (header, content). Fixed header (`glass-floating glass-chrome`) and
fixed bottom bar (`glass-bar`) pad themselves off `env(safe-area-inset-*)`
for notches/home-indicators (`viewport-fit: cover`). Page content transitions
in with a short fade+lift (`.animate-page-in`) and lists commonly use
`.stagger-in` to bring children in row by row, capped at 8 staggered steps
so long lists don't trail into a slow drip.

## Elevation & Depth

Hybrid: true `backdrop-filter` blur is reserved for surfaces that actually
float over content the user needs to see through (header, modals/sheets,
the install prompt); everything else — cards, badges, pills, the bottom bar
— keeps the same visual glass language (gradient, specular, rim, shadow)
without the blur cost, because on Oktagon's card-heavy pages (dozens of
cards/pills per screen) a real blur on every one of them would visibly
stutter on mobile.

### Shadow Vocabulary
- **glass-floating** (inset specular top/bottom + rim + drop shadow, `backdrop-filter: blur(24px) saturate(200%)`): header, floating chips.
- **glass-panel** (`backdrop-filter: blur(28px) saturate(180%)`): modals, sheets — heavier blur, near-opaque fill so paragraph text stays legible.
- **glass-surface** (no blur): default card material.
- **glass-bar** (`backdrop-filter: blur(24px) saturate(180%)`): bottom nav bar.

### Named Rules
**The Blur-Where-It's-Earned Rule.** A component only pays for
`backdrop-filter` if there is real content behind it worth bending; repeated
cards and pills use the flat glass gradient instead.

## Shapes

Rounded throughout: `rounded-md` (buttons, inputs, badges' host controls),
`rounded-xl` (cards), `rounded-full` (pills, badges, the segmented-control
thumb). Borders are hairline and translucent (`rgba(255,255,255,.1–.6)` in
dark, similar low-alpha values in light) rather than solid, consistent with
the glass material. No sharp corners anywhere in the shipped UI.

## Components

### Buttons
- **Shape:** `rounded-md` (0.375rem), heights `h-8`/`h-10`/`h-12` for sm/default/lg.
- **Default:** `.glass-chrome` (dark glass regardless of theme) with a white/10 border and white text.
- **Accent:** `.glass-accent`, semibold, black text (survives at any brightness).
- **Outline:** `.glass-field` (pressed-in glass, inverted specular).
- **Ghost:** transparent, `hover:bg-black/[.05]` (light) / `hover:bg-white/10` (dark).
- **Destructive:** flat `bg-red-600` (the one deliberately non-glass, non-ambiguous color for a destructive action).
- **Focus:** `ring-2 ring-black/60` (light) / `ring-white/60` (dark), offset 2px.

### Badges / Pills
- **Style:** `rounded-full`, `.glass-chrome` (default) or `.glass-accent` (accent) or the shared `GLASS_PILL` token (outline/secondary).
- **State:** selected pick / active nav segment renders as `.glass-accent`; everything else stays neutral glass.

### Cards / Containers
- **Corner Style:** `rounded-xl`.
- **Background:** `.glass-surface` — vertical white-alpha gradient, no blur.
- **Shadow Strategy:** inset top specular + soft drop shadow (see Elevation & Depth); `.glass-surface-interactive:hover` brightens the border and deepens the shadow.
- **Border:** hairline, `rgba(255,255,255,.5)` light / `rgba(255,255,255,.1)` dark.
- **Internal Padding:** `p-4` header/content, `pt-0` between header and content.

### Inputs / Fields
- **Style:** `.glass-field` — inverted specular (pressed-in look), `rounded-md`, `h-10`.
- **Focus:** `ring-2 ring-black` (light) / `ring-white` (dark), no offset.
- **Placeholder:** `text-neutral-400`.

### Navigation
- Header: `.glass-floating.glass-chrome`, sticky, always-dark glass with white type regardless of theme (so it never needs a separate dark-mode variant).
- Bottom bar: `.glass-bar`, full-width, heavier fill than the floating capsules so type stays legible over busy content underneath (e.g. the events list).
- Segmented control: `.glass-floating` capsule with a `.glass-thumb`/`.glass-thumb-chrome` riding pill for the active segment.

## Do's and Don'ts

### Do:
- **Do** build every new interactive/status surface from the existing `.glass-*` vocabulary (`glass-surface`, `glass-pill`, `glass-accent`, `glass-field`, `glass-panel`, `glass-bar`, `glass-chrome`) rather than a flat Tailwind background.
- **Do** wrap any new looping or entrance animation in a `prefers-reduced-motion: reduce` fallback, and any new translucent surface in a `prefers-reduced-transparency: reduce` fallback, matching the existing pattern.
- **Do** reserve `backdrop-filter` for elements that truly float over visible content; use the no-blur glass classes for repeated/list surfaces.
- **Do** keep motion tied to a real event (tip saved, fight graded, page/route change, list mount) rather than continuous decoration, except the already-established slow ambient loops (`wrapped-drift`, `clock-urgent`).

### Don't:
- **Don't** introduce a generic SaaS dashboard look: no purple→blue gradients, no Inter, no cards-inside-cards, no icon-in-a-rounded-square-above-a-heading pattern.
- **Don't** render the accent color as a flat, unlit fill on an interactive surface — always through `.glass-accent`/`.glass-accent-soft`.
- **Don't** use the Wrapped display font (`--font-wrapped`) outside `/wrapped`, or on body copy anywhere.
- **Don't** add a heavy animation library; motion is hand-written CSS keyframes only.
