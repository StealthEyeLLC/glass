# Glass — vision

## Product hook (exact)

Glass turns bounded runtime activity into an inspectable claim chain: scene, change, evidence, receipt.

## Strategic framing (cold)

Glass is **not** trying to win the collection war. Glass is a **bounded investigation surface** above runtime telemetry. **Standalone first**, **ingest-agnostic by design**, and later able to sit above existing telemetry/eBPF stacks as a **premium bounded investigation and claim layer** — without pretending the UI knows more than the bounded frames support.

## What Glass is

- A **v0 monorepo** with real session/pack plumbing, a **Tier B static replay** viewer (default), and an optional **`?live=1`** live-session shell (loopback bridge + bounded HTTP/WebSocket contracts as implemented).
- An **inspectable claim chain**: move from bounded **scene** state, to **what changed** (compare), to **evidence** (drilldown rows and facts), to the **receipt** (explicit bounded claim text — viewer-derived, not a collector certificate).
- **Bounded** semantics end-to-end: capped tails, honest wire-mode slots, weak/unavailable labels where continuity is not supportable.

## What Glass is not

- **Not** a race to maximum syscall coverage or deepest eBPF in this repo slice.
- **Not** a fake process graph, full-history timeline, or AI summary of intent.
- **Not** a statement that **F-IPC** transport, production ingest scale, or Phase-6 **full topology runtime** are finished — they are **not** what v0 proves.

## Why standalone first

The investigation surface must work **without** a live collector: load `.glass_pack`, compile to **Scene System v0**, run compare/evidence/claims/receipts on **committed fixtures**. That portability is the core product proof.

## Why ingest-agnostic later

Compilers and trust panels consume **normalized** events and **bounded** wire facts. Additional ingest paths can attach **without** changing the rule that claims must stay honest to the current bounded window.

## Bounded truth / bounded investigation

- **session_delta** and **compare** are only as honest as the prefix/tail and baseline rules allow — the UI says so.
- **Receipts** restate what compare + evidence + episodes support; **weak** / **unavailable** are first-class.
- **No** merged “one true history” from WebSocket + HTTP — distinct inputs, documented in the live shell.

## What the bounded showcase path proves

- **Flagship pack** `canonical_v15_append_heavy` (see `docs/VERTICAL_SLICE_V0.md`): depth on one append-heavy Tier B path — compare growth, evidence rows, episodes, claims, receipts, temporal lens — **one** coherent flagship narrative.
- **Canonical scenario suite** (`tests/fixtures/canonical_scenarios_v15/`): breadth (replace, calm, file-heavy, append-heavy) — **`npm run verify:canonical-scenarios-v15`** from `viewer/`.
- **CI + viewer tests**: the same bounded contracts stay green; **not** collector truth, **not** bridge scale proof.

## What remains intentionally out of scope (v0 breakout)

- **F-IPC** transport freeze (provisional dev TCP); **not** finalized here.
- **Durable push ingest** as a shipped product path.
- **Phase-6** full Glass topology/runtime scene (distinct from Scene System v0 compilers).
- **New collector lanes** or protocol changes **without** a spec/plan revision — outside this document.

## Public release posture

In-repo **freeze-candidate** applies to the **bounded showcase path only** (Tier B replay + optional live shell + canonical suite). **Public open-source** use is intended for **evaluation and extension** within that honesty envelope — not as a blanket claim of production completeness.

See also: `README.md`, `docs/VERTICAL_SLICE_V0.md`, `docs/IMPLEMENTATION_STATUS.md`.
