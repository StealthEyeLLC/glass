# Glass — vision

## At a glance

- **What:** Bounded **investigation surface** over normalized runtime events — **scene → change → evidence → receipt** without inventing topology or full history.
- **Why it matters:** Operators need **exact** claims from **bounded** windows, not narrative filler.
- **Flagship:** Tier B pack `canonical_v15_append_heavy` — depth on one path ([`docs/VERTICAL_SLICE_V0.md`](docs/VERTICAL_SLICE_V0.md)).
- **Current public surface:** replay-first bounded showcase; optional **`?live=1`** is local-only and secondary.
- **Honest boundary:** **Freeze-candidate** only for that **showcase path** in-repo. **F-IPC**, durable production ingest, and Phase-6 **full topology runtime** are **not** proven here.
- **First-run UX (v26–v30):** The default **bounded showcase** path leads with **what to open** (easy entry + optional dev **Load flagship demo**); **v27** added **simple** vs **technical** copy layers; **v28** **reduces visible words** on first paint; **v30** separates **Overview** vs **Technical** into two surfaces ( **`?surface=technical`** ) — same bounded truth, different chrome. **Local** bridge scope and transport notes are concentrated in **Technical**; **F-IPC** remains **provisional**.

**Product hook (exact):** Glass turns bounded runtime activity into an inspectable claim chain: scene, change, evidence, receipt.

## Current shipped truth vs long horizon

- **Use these as the public truth for the shipped bounded showcase:** `README.md`, `VISION.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/TEST_STRATEGY.md`, `docs/REPO_BOUNDARIES.md`.
- **Use this as milestone history, not the front-door contract:** `docs/VERTICAL_SLICE_V0.md`.
- **Use these as long-horizon architecture references, not the current product contract:** `GLASS_FULL_ENGINEERING_SPEC_v10.md`, `GLASS_V0_BUILD_PLAN.md`.

## Strategic framing (cold)

Glass is **not** trying to win the collection war. Glass is a **bounded investigation surface** above runtime telemetry. **Standalone first**, **ingest-agnostic by design**, and later able to sit above existing telemetry/eBPF stacks as a **premium bounded investigation and claim layer** — without pretending the UI knows more than the bounded frames support.

## What Glass is

- A **v0 monorepo** with real session/pack plumbing, a **Tier B static replay** viewer (default), and an optional **`?live=1`** live-session shell (loopback bridge + bounded HTTP/WebSocket contracts as implemented).
- The **claim chain** above: bounded **scene**, **compare** (change), **evidence** drilldown, **receipt** — viewer-derived, not collector certificates.
- **Bounded** semantics: capped tails, honest wire-mode slots, **weak** / **unavailable** where continuity is not supportable.

## What Glass is not

- **Not** maximum syscall coverage or deepest eBPF as the success metric for this repo.
- **Not** a fake process graph, full-history timeline, or AI summary of intent.
- **Not** finished **F-IPC** transport, production ingest scale, or Phase-6 **full topology runtime** — **not** what v0 proves.

## Why standalone first

The investigation surface must work **without** a live collector: load `.glass_pack`, compile to **Scene System v0**, run compare/evidence/claims/receipts on **committed fixtures**. That portability is the core proof.

## Why ingest-agnostic later

Compilers and trust panels consume **normalized** events and **bounded** wire facts. Additional ingest paths attach **without** changing the rule that claims stay honest to the current bounded window.

## Bounded truth / bounded investigation

- **session_delta** and **compare** are only as honest as prefix/tail and baseline rules allow — the UI reflects that.
- **Receipts** restate what compare + evidence + episodes support; **weak** / **unavailable** are first-class.
- **No** merged “one true history” from WebSocket + HTTP — distinct inputs in the live shell.

## What the bounded showcase path proves

- **Flagship pack** `canonical_v15_append_heavy`: one append-heavy Tier B path — compare, evidence, episodes, claims, receipts, temporal lens — **one** coherent depth narrative.
- **Canonical scenario suite** (`tests/fixtures/canonical_scenarios_v15/`): breadth — **`npm run verify:canonical-scenarios-v15`** from `viewer/`.
- **CI + viewer tests**: bounded contracts stay green — **not** collector authority, **not** bridge at scale.

## What remains intentionally out of scope (v0 breakout)

- **F-IPC** transport freeze (provisional dev TCP); **not** finalized here.
- **Durable push ingest** as a shipped product path.
- **Phase-6** full Glass topology/runtime scene (distinct from Scene System v0 compilers).
- **New collector lanes** or protocol changes **without** spec/plan revision — outside this document.

## Public release posture

In-repo **freeze-candidate** applies to the **bounded showcase path only** (Tier B replay + optional live shell + canonical suite). **Public open-source** use is for **evaluation and extension** within that honesty envelope — **not** a blanket claim of production completeness.

See also: `README.md`, `docs/VERTICAL_SLICE_V0.md`, `docs/IMPLEMENTATION_STATUS.md`.
