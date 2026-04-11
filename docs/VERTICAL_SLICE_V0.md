# Glass Vertical Slice v0 / v1 / v2 / v3 / v4 / v5 / v6 / v7 / v8 / v9 / v10 / v11 / v12 / v13 / v14 / v15 / v16 / v17 / v18 / v19 / v20 / v21 / v22 / v23 / v24 / v25 / v26 / v27 / v28 / v29 / v30 / v31

**Id:** `glass.vertical_slice.v0` (documentation and viewer copy only — not a wire identifier).

## Vertical Slice v31 (Overview default-surface reduction)

**Goal:** **Overview** (default) feels like **premium product chrome** — very little text, one obvious flagship path (**Load flagship demo** + **Open file**), one calm helper line, optional **Live session** link — **no** verbose empty trust panels before a session loads. **Technical** remains the **full instrument** (About this view, flagship pack detail, How to read, manifest/sanitized/meta, receipt ids/schema/keys, compare-baseline supplement, event debug, timeline entity chips, selection JSON) with **unchanged** bounded truth. **`data-overview-phase="idle|loaded"`** + **`glass-overview-loaded-only`** panels: idle Overview hides Scene → Evidence → Claim → Time → Episodes and playback controls until a pack is ready.

**What v31 removes from Overview (moved to Technical-only DOM or Technical surface):** Hero long subtitle; **Try the flagship** title/lead; drop zone; duplicate **Open file** row; **About this view**, flagship **full detail**, **How to read**; manifest / sanitized blocks; timeline **seq/kind/event_id** strip; **Selection details** + **Current event (debug)**; compare-baseline **empty-receipt supplement** copy (still in **Technical**); trust-panel **technical** phrasing on evidence/claims/episodes (Overview uses short leads + empty lines: **No evidence to show yet.**, **Glass cannot make a strong claim yet.**, **Nothing notable yet.**).

**What remains on Overview after load:** **Scene** (one short line), **Evidence**, **Claim**, **Time** (temporal lens controls), **Episodes** (cards or empty line) — then playback. Section order: Scene → Evidence → Claim → Time → Episodes → controls/scrub/short **Step * of *** position (full event line in Technical).

**Does not claim:** New engine features, wire changes, or weaker receipts — **same** compilers and models; **still** the bounded showcase path.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v30 (Overview vs Technical — hard surface split)

**Goal:** Two **real** product surfaces — not one page with technical noise scattered everywhere. **Overview** (default) is calm, short, adult; **Technical** is one deliberate control away and carries the full instrument (paths, scan order, receipt ids, operator JSON, transport honesty, debug event tail). **Same bounded truth** underneath: same compilers, same trust panels, same data — different chrome and language tier only.

**What v30 adds (viewer layout + URL only):** **`?surface=technical`** (omit or `surface` absent = Overview). **`glassSurface.ts`** — `parseGlassSurface`, `mountGlassSurfaceControls` (segmented **Overview** / **Technical**), `buildLiveSessionHref` / `buildReplayHrefFromLive` / `buildFlagshipDevHref` so links preserve the flag. **Replay** — **`replay-technical-chrome`** section holds **About this view**, flagship callout, **How to read**; hero stays short; **Scene** shows an Overview line + full line + compiler details only in Technical; manifest / sanitized / current-event debug / pack meta panels are Technical-only; receipt **schema/ref/support** blocks remain Technical (primary + limitation still visible in Overview). **Live** — **`live-technical-chrome`** holds **About live mode**, local-only intro, transport **F-04 / provisional F-IPC** honesty; **`live-operator-instrumentation`** wraps JSON/presentation/event-tail operator panels; visual surface gets an Overview intro line + full line + Technical details. **CSS** — **`glassSurface.css`** (imported from replay + live shell CSS). **Tests:** **`glassSurface.test.ts`**, **`surfaceSeparationV30.test.ts`**, **`verticalSliceV28FirstScreen.test.ts`** updated for technical chrome ordering.

**Does not claim:** New engine features, wire changes, or a second authority — **F-IPC** still **provisional**; still **bounded showcase** only.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

**Vertical Slice v1** added a richer bounded scene; **v2** adds **bounded actor/sample clusters** from real event kinds only; **v3** adds **bounded regions** (membership + compositional drawable layers); **v4** adds **bounded scene emphasis** and **pulse/flash overlays** driven only by real basis changes between compiles; **v5** adds **bounded scene selection** and **inspector coupling** (same ids + hit map for replay and live); **v6** adds **bounded focus mode** — selection reshapes **dim/emphasis** and overlay/provenance copy from **grouping-only** scene facts; **v7** adds **bounded focus reflow** — the same selection **re-allocates vertical space** and (when applicable) **lane width fractions** for the primary band, state rail, and actor cluster strip; **v8** adds **bounded compare mode** — honest **current vs immediately prior** bounded frame; **v9** adds **bounded evidence drilldown** — a small, inspectable list of **real** tail/prefix rows and facts behind the current selection and compare; **v10** adds **bounded cross-linking** — the same **`glass.sel.v0:*`** selection drives scene, inspector, compare line, and evidence rows when honestly mappable; **v11** adds a **bounded temporal lens** — a small **viewer-held** ring of recent bounded paints plus (replay) **step chips** near the scrub cursor so compare baseline can be the **immediate prior paint** or an **older paint still in the ring** — still **no** wire contract changes; **v12** adds **bounded episodes** — rule-based, **evidence-backed** cards (≤4) from **`computeBoundedSceneCompare`** hints + scene facts + **immediate prior paint** (replay cursor delta) + optional **WS tail mutation** (live) — **not** AI, **not** causal topology, **not** full history; **v13** adds **bounded claims** — explicit **claim chips** + a **receipt** view (**`computeBoundedSceneClaims`**, **`buildBoundedClaimReceipt`**) derived only from the same **compare + evidence drilldown + episode** stack (status: **observed** / **inferred_from_bounded_change** / **weak** / **unavailable**) — **not** generic analysis, **not** legal-grade provenance, **not** numeric confidence; **v14** hardens **bounded receipts** (**`glass.receipt.v0`**) — deterministic **`receiptId`**, mechanical **claim↔fact/row ref keys** (`fact:n`, `row:n:…`), **support bullets** ordered from compare + facts + evidence rows, **focus** line from current selection + selected episode title, **primary claim** may follow **cluster selection** when selection/cluster claims exist, evidence cards highlight **claim-supporting** row indices — still **no** invented causality, **no** AI summaries; **v15** adds a **canonical bounded scenario suite** — small committed **Tier B `.glass_pack`** set under **`tests/fixtures/canonical_scenarios_v15/`** (replace-heavy, append-heavy, calm/steady compare, file-heavy directory-poll snapshots) plus **live wire harness** tests for **resync / warning** (no extra pack — those facts are live-session), **integration tests** (`viewer/src/replay/canonicalScenariosV15.integration.test.ts`), and **`npm run verify:canonical-scenarios-v15`** — **not** a second demo app, **not** fake scenarios; **v16** elevates **presentation** of the same bounded claims, **`glass.receipt.v0`** receipts, and evidence drilldown — shared CSS (`boundedTrustSurfaces.css`), calmer hierarchy and scanability, **`data-trust-tier`** + section markers on the receipt, evidence **trust** wrapper + human row-label captions — **not** new model authority, **not** wire changes, **not** export/report theater; **v17** hardens **renderer and interaction parity** — hybrid WebGPU + Canvas text overlay now passes the same **compare baseline** into selection-outline drawing as full Canvas and hit-testing; **`paintLiveVisualSurface`** and **`buildBoundedSelectionHitTargetsForScene`** use a single **`computeBoundedSceneCompare`** instance wired into **`liveVisualSpecFromScene`**; live **provenance strip** spec matches the painted frame’s compare — **not** new geometry, **not** wire changes; **v18** names one **flagship bounded demo path** — **`canonical_v15_append_heavy.glass_pack`** (session `canonical_v15_append_heavy`, 14 events) as the primary product experience for depth (append semantics, compare growth, evidence tail, episodes, receipts, temporal lens); **`vertical_slice_v0` Tier B** (3 events) stays the **minimal CI / verify** path; **`?fixture=flagship`** in dev loads the flagship pack; suite packs remain **breadth proof** — **not** a second compiler, **not** collector truth; **v19** hardens **launch-readiness** on that flagship path — **compare baseline** changes from the temporal lens **reset** bounded episode + claim selection, evidence **crosslink** notes, and **primary-claim chip auto-highlight** until the next cursor/tail-driven paint so trust surfaces do not look “stuck”; **claim chip** status uses compact labels (**`formatBoundedClaimChipStatusShort`**); live **visual intro / fallback** copy states hybrid fallback is a **supported** mode aligned with bounded trust panels — **not** wire changes, **not** new semantics; **v20** applies an **external-style audit** to the same path — **reading-order** copy (replay section + live hero line) so first contact is not a **mystery meat** internal tool; **empty receipt** default copy is explicit; when the **temporal baseline** handoff leaves **no primary highlight**, a **second** empty-state line (**`RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE`**) explains the honest pause — **not** a workflow engine, **not** wire changes; **v21** adds **freeze-candidate flagship framing** (**`GLASS_FLAGSHIP_CHAIN_ONE_LINER`**, **`GLASS_FLAGSHIP_CHAIN_DOC`**) in reading order + flagship callout and **integration** coverage for the temporal-baseline empty-receipt **supplement** — **not** wire changes, **not** new semantics; **v22** is a **verdict pass**: **live** hero gains **`live-flagship-framing`** with the same **`GLASS_FLAGSHIP_CHAIN_DOC`** as **`replay-flagship-framing`** (replay/live parity on the long framing line), plus an explicit **freeze-candidate verdict** in docs — **not** wire changes, **not** transport freeze; **v23** is **bounded public-release prep**: root **`VISION.md`**, README **doc order** + tightened public copy, **`docs/media/README.md`** screenshot placeholders, **`.github/ISSUE_TEMPLATE/bounded_showcase.md`** — **not** wire changes, **not** new subsystems; **v24** is a **public GitHub landing audit**: README leads with **hook + standout chain**, clearer **flagship vs breadth**, **`docs/media`** ordered filenames + capture checklist — **not** wire changes, **not** fake media; **v25** **commits** four **`docs/media/`** PNGs (**`01`–`04`**) matching that order (flagship overview, claim chain + receipt, temporal lens, live shell) and wires a **Screenshots** section in the root README — **not** wire changes, **not** a required GIF; **v26** **front-loads** easy-first **bounded showcase** entry — **Start here** + optional dev **Load flagship demo**, flagship **easy summary** line, **`<details>`** for fixture paths / dev auto-load / **`?live=1`** mechanics; **live** shell — honest **local** intro, collapsible **F-04 / provisional F-IPC** note, **collapsed** connection form and **non-IP** bridge placeholder — **not** wire changes, **not** cloud claims.

## Vertical Slice v28 (default surface word reduction — easy-first)

**Goal:** First paint shows **very few words**: one short hero line, then **Try the flagship** (Open file / drop / dev Load) **before** the flagship explainer block. Long scenario copy, flagship body/framing/easy/paths, and **How to read** (micro + v27 simple + technical) sit in **collapsed `<details>`**. Live: one short hero line; **About live mode** holds prior hero paragraphs + reading order; **Local-only (not cloud)** wraps the old intro.

**What v28 adds (viewer copy + DOM order only):** **`VERTICAL_SLICE_V28_*`** micro strings (`replayHeroSubtitle`, `liveHeroSubtitle`, reading-order micro, evidence/receipt leads). **Replay `root` order:** hero → **easy entry** → drop zone → file row → live nav → flagship (**title + single `replay-flagship-bundle` details**) → reading-order section (**one outer details** `replay-reading-order`). **Tests:** **`verticalSliceV28FirstScreen.test.ts`**.

**Does not claim:** Wire/protocol/engine changes; **F-IPC** still **provisional**; still **bounded showcase** only.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v27 (ELI15 flagship UI — simple + technical layers)

**Goal:** Default **bounded showcase** copy reads like **great product UX** for a smart first-time reader — **plain language first**, **exact technical depth on demand** — without hiding honesty, receipts, compare, or wire facts.

**What v27 adds (viewer copy + DOM layering only):** **`verticalSliceV0.ts`** — **v27** hero/scenario/flagship/reading-order **simple** strings + **technical** strings (legacy **`VERTICAL_SLICE_V20_READING_ORDER_*`** aliases point at **technical** replay/live lines for stable tests). **Replay** — badge **Saved session replay (default)**; flagship callout **simple** title/body/framing + easy line; **`<details>` Exact flagship path** = **`GLASS_FLAGSHIP_CHAIN_DOC`** + **`VERTICAL_SLICE_FLAGSHIP_V18_BODY`**; **How to read** = **simple** paragraph + **`<details>` Exact scan order & limits** (index-ordered prefix, temporal lens, one-liner chain); section headings **Scene**, **Evidence**, **Story cards**, **Claims**, **Time context**; scene note **simple** + **Scene compiler details** details; easy entry / drop-zone **Tier B** demoted to technical **`<details>`**. **Live** — **live-flagship-framing** = **`VERTICAL_SLICE_V27_FLAGSHIP_FRAMING_SIMPLE`**; **`live-flagship-framing-technical`** = **`GLASS_FLAGSHIP_CHAIN_DOC`**; reading-order **wrapper** **`live-reading-order`** with **simple** + **technical** details; visual intro **simple** + **Live visual surface (exact)** details; same section title parity as replay. **Trust panels** — **`boundedClaimsPanel`**, **`boundedEvidencePanel`**, **`boundedEpisodesPanel`**, **`boundedTemporalLensPanel`**: lead line **simple**, full honesty lines in **`<details>`** (`.glass-trust-technical`). **CSS** — **`.glass-trust-technical`** / **`.glass-trust-technical-summary`** + lead classes in **`boundedTrustSurfaces.css`**.

**Tests:** **`verticalSliceV27TrustLayers.test.ts`** (replay/live simple vs technical presence); **`verticalSliceV0.test.ts`**, **`staticReplay.test.ts`**, **`liveSessionShell.test.ts`** updated; **`boundedTemporalLens.test.ts`** asserts **`lineSimple`**.

**Does not claim:** New engine features, wire/protocol changes, or full production topology — **still** the **bounded showcase path** only.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v26 (easy-first first-run UX)

**Goal:** Remove **local-dev smell** from the default **bounded showcase** path (localhost **IPs**, query flags, and bridge jargon in primary copy) while keeping **honest** local/provisional boundaries and full technical depth in secondary surfaces.

**What v26 adds (viewer copy + layout only):** **Replay** — **`glass-easy-entry`** block (primary **Start here**; dev-only **Load flagship demo**); flagship callout **easy** line + **`<details>`** for committed paths + **`?fixture=flagship`**; **live** nav link label **Advanced: bounded live session (local bridge)** + **`<details>`** for **`?live=1`**; drop zone **short lead** + pack format in **`<details>`**. **Live shell** — badge **Bounded live session (local)**; intro paragraph; **`<details>`** for transport honesty; **Connection settings** **`<details>`** wraps URL/token/session controls; calmer field placeholders/labels; **Back to bounded replay** (no query flag in the link text).

**Easy vs advanced:** Default UX explains **what to do** (open pack / optional one-click demo in dev). **Advanced** = live session link, pack wire-format detail, bridge URL/token/session, F-04/F-IPC notes — still available, not front-and-center.

**Does not claim:** Hosted/cloud operation; **F-IPC** finality; production ingest. **session_delta** / bridge semantics unchanged.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v25 (bounded showcase media)

**Goal:** Ship **real** screenshots for the ordered **`docs/media/`** filenames so the public README can show the flagship + claim chain without guessing.

**What v25 adds (assets + docs only):** Committed PNGs **`01-replay-flagship-overview.png`** through **`04-live-shell-overview.png`** (see **`docs/media/README.md`**). Root **README** — **Screenshots (bounded showcase)** table with captions that reinforce **scene → change → evidence → receipt** and **`?live=1`** parity. **`docs/media/README.md`** — committed-assets table + optional GIF note for **`05`**.

**Does not claim:** New viewer features, wire/protocol changes, or that **`05`** GIF exists.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v24 (public repo audit & release assets)

**Audit (first-impression gaps):** Hook sat **below** the subtitle; **flagship vs breadth** was easy to skim past; **`docs/media`** needed **ordered filenames** and **flagship-first** capture rules.

**Fixed in v24:** **README** — hook first line, **Standout interaction** table, **Try the flagship** before long layout, **Flagship depth vs scenario breadth** table, shorter doc map. **VISION.md** — **At a glance** block (what / why / flagship / boundary). **`docs/media/README.md`** — `01`–`05` names, checklist, safety rules.

**Does not claim:** Production topology or **F-IPC** freeze. (Committed **`01`–`04`** PNGs land in **v25**; v24 established filenames + checklists only.)

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v23 (bounded public release prep)

**Goal:** Make the **public-facing** surface (README, vision, hierarchy) match the **coherence** of the bounded showcase implementation — without changing protocols or adding product subsystems.

**What v23 adds (docs + repo hygiene only):** **`VISION.md`** — what Glass is/is not, standalone-first and ingest-agnostic framing, strategic cold positioning, showcase vs out-of-scope. **README** — single entry path: doc table, one-paragraph product, flagship path, claim-chain table, fastest first run, showcase vs future table, media placeholder pointer. **`docs/media/README.md`** — optional screenshot/GIF filenames. **Issue template** `.github/ISSUE_TEMPLATE/bounded_showcase.md` — scope reminder for bounded showcase / viewer issues.

**What v23 does *not* claim:** Public launch of **F-IPC**, production ingest, or Phase-6 topology. **Freeze-candidate** remains **for the bounded showcase path only**.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v22 (freeze-candidate verdict)

**Brutal audit (highest-value blocker):** **Replay** showed the long flagship framing (**`GLASS_FLAGSHIP_CHAIN_DOC`**) in **`replay-flagship-framing`**; **`?live=1`** did not — **live first-run** could read as a **weaker** product story than replay even though reading-order strings already matched.

**Fixed in v22:** **`mountLiveSessionShell`** adds **`live-flagship-framing`** (**`data-testid="live-flagship-framing"`**, **`GLASS_FLAGSHIP_CHAIN_DOC`**, **`.glass-flagship-live-framing`** in **`liveSessionShell.css`**). **`liveSessionShell.test.ts`** asserts **text parity** with **`GLASS_FLAGSHIP_CHAIN_DOC`**.

**Not fixed here (honest out-of-scope):** **F-IPC** remains **provisional**; **durable push ingest** / **live-era** HTTP extensions are **future** work; **Phase-6** full topology/runtime is **not** this repo slice; **F-05** path policy is not final; **formal** “public launch” positioning is **human-owned**.

**Freeze-candidate verdict:** **Freeze-candidate for the bounded Vertical Slice v0 showcase path only** — Tier B static replay (default) + optional **`?live=1`** shell sharing the same Scene v0 / trust surfaces / canonical scenario breadth, with CI green. **Not** a verdict on production-scale collector ingest, bridge operations, or **F-IPC** finality. **Public light** for the **bounded demo** is **reasonable** only with honest bounds in messaging; **human-owned**: formal freeze, security/comms, transport policy.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v21 (freeze-candidate flagship hardening)

**What v21 hardens (viewer + docs):** **`GLASS_FLAGSHIP_CHAIN_ONE_LINER`** and **`GLASS_FLAGSHIP_CHAIN_DOC`** in `viewer/src/app/verticalSliceV0.ts` — the one-liner leads **reading-order** replay/live strings; the longer doc appears once in the **flagship callout** (CSS: **`.glass-flagship-callout-framing`**, test id **`replay-flagship-framing`**) so the standout story is **scene → change → evidence → receipt** without slogan spam. **`verticalSliceV19AuditHardening.integration.test.ts`** asserts **`replay-bounded-claim-receipt-empty-supplement`** text equals **`RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE`** after a non-current temporal paint chip sets a new compare baseline — guarding against silent copy drift.

**What v21 does *not* claim:** Public launch freeze, **F-IPC transport** finality (still **provisional**), or Phase-6 full topology/runtime. Breadth suite and frozen bounded-era HTTP remain unchanged.

**Freeze-candidate posture:** The flagship path reads more coherently as **inspectable bounded claims**; judgment for **public light** remains **human-owned** (product, positioning, formal freeze).

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v20 (external-style audit & gap closure)

**External-style audit (what looked weak):** First-run **scan order** was implicit (scene vs evidence vs claims vs receipts read as a pile). **Empty receipt** after a **temporal compare-baseline** change could look like a bug or missing implementation. **Trust copy** did not always state that receipts are **viewer-derived** bounded summaries — not **collector certificates**.

**What v20 fixes (viewer-only):** **`VERTICAL_SLICE_V20_READING_ORDER_REPLAY`** / **`VERTICAL_SLICE_V20_READING_ORDER_LIVE`** — replay gets a **`replay-reading-order`** block; live gets **`live-reading-order`** in the hero. **`renderBoundedClaimReceiptInto`** accepts **`emptySupplementLine`** for the temporal-baseline handoff; default empty copy is **“No active bounded receipt…”**. Canonical scenario **README** ties breadth packs to the same honesty story as the flagship.

**What v20 does *not* claim:** Public launch readiness, completeness vs production topology, or **F-IPC** finality — **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v19 (launch-readiness audit hardening)

**What v19 hardens (viewer-only):** Prototype seams around the **temporal compare baseline** (replay + live): changing baseline via **Recent paints** or **Reset compare baseline** now **clears** bounded **episode** + **claim** UI selection, evidence **crosslink** honesty lines, and **suppresses automatic primary-claim chip highlighting** until the next **cursor-driven replay paint** or **live tail paint** — so claims/receipts/episodes do not read as unchanged after the compare window moved. **Claim chips** use short operator-facing status labels (**`formatBoundedClaimChipStatusShort`**). **Live** visual intro and canvas-missing fallback copy align with replay: same **trust band** (selection → evidence → episodes → claims → temporal lens); fallback is a **supported** path, not a broken panel. **`vitest.setup.ts`** extends the Canvas 2D stub with **`save` / `restore` / `setLineDash`** so selection-highlight paths are testable under jsdom.

**Prototype seams addressed:** Stale-looking **primary claim** selection after baseline change; raw **enum underscore** chip labels; **live** fallback copy that implied only “textual panels” mattered; ambiguous **trust surface** state after **compare** anchor changes.

**What stays intentionally provisional:** **F-IPC transport**; bounded **HTTP** F-04 frozen surface; **not** Phase-6 full topology/runtime. **v19** does **not** add topology, causality, or new collector lanes.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v18 (flagship bounded demo path)

**Flagship scenario (explicit):** **`tests/fixtures/canonical_scenarios_v15/canonical_v15_append_heavy.glass_pack`** — **append-heavy** Tier B replay: **14×** `process_poll_sample`, **append** wire mode at the scrub end, replay prefix fraction → 1, rich bounded tail for compare lines, evidence drilldown rows, episode/claim surfaces, and temporal lens paints.

**Why this flagship (product, not convenience):** One path must show **growth + compare + trust surfaces** together. Replace-heavy stresses a different wire transition; calm/steady is the “unchanged compare” check; file-heavy stresses **file-lane** kinds. Append-heavy best matches the **default mental model** of a growing bounded tail with **honest** step/compare/receipt coupling — without claiming live retention or causality beyond the prefix.

**What it proves:** Same **Scene System v0** + **Drawable Primitives** + bounded selection/inspector/compare/evidence/claims/temporal lens as every Tier B pack, with **more** index-ordered depth for operator scanning.

**What it does *not* prove:** Live collector semantics, bridge/F-IPC correctness, syscall-level file I/O, or unbounded history. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Breadth proof (unchanged):** **`canonical_v15_replace_heavy`**, **`canonical_v15_calm_steady`**, **`canonical_v15_file_heavy`**, live resync/warning harness, and **`vertical_slice_v0`** minimal pack — **`npm run verify:canonical-scenarios-v15`** and **`npm run verify:vertical-slice-fixture`**.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v17 (renderer parity & interaction stability)

**What it adds (viewer-only):**

- **`liveVisualCanvas.ts`:** hybrid **`renderLiveVisualTextOverlayOnCanvas`** / **`renderLiveVisualTextOverlayIntoContext`** accept optional **`previousScene`** for **`drawBoundedSelectionHighlightIntoContext`** so selection outlines match **`buildBoundedSelectionHitTargetsForScene`** (pointer picking) and WebGPU geometry (**`sceneToDrawablePrimitives`**).
- **`liveVisualRenderer.ts`:** **`paintLiveVisualSurface`** builds **`LiveVisualSpec`** with explicit **`compare: computeBoundedSceneCompare(...)`** shared with the primitive path; passes **`previousScene`** into the text overlay path when drawing selection.
- **`liveSessionShell.ts`:** **`buildCurrentLiveVisualSpec`** (provenance) uses the same explicit compare instance as the painted scene.
- **`boundedSceneSelection.ts`:** **`buildBoundedSelectionHitTargetsForScene`** uses **`liveVisualSpecFromScene(..., { compare })`** aligned with **`sceneToDrawablePrimitives`** overlay text positions.

**What stays intentionally different:** WebGPU still draws **no** GPU text (labels remain on the Canvas overlay or full Canvas fallback). Color management is bootstrap-level (not display-calibrated). **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v16 (bounded receipt & evidence presentation)

**What it adds (viewer-only):**

- **`viewer/src/scene/boundedTrustSurfaces.css`** — one stylesheet family for bounded **claims strip**, **`glass.receipt.v0`** receipt (identity header, primary block, meta `dl`, `data-section` for focus / scope / compare / support / refs / limits, limitation + footer copy), and **evidence** (`glass-bounded-evidence-trust` root, authority/context alignment, card head with raw label + calm caption). Replay and live shells **`@import`** it (top of file, after any file comment) so trust surfaces stay consistent — **no** new semantics.
- **`boundedClaimsPanel.ts` / `boundedEvidencePanel.ts`** — DOM structure tuned for readability; empty receipt copy remains explicit (**no** silent blank); weak/unavailable chips and receipt **`data-trust-tier`** stay aligned with honest status labels.

**What stays bounded:** Same **`BoundedClaimReceiptV0`** fields and ordering rules as v14; same drilldown row caps and labels; same cross-link and compare honesty — **v16 is presentation**, not a second truth layer.

**What receipts still do *not* imply:** Causal explanation, topology, full history, calibrated confidence, completeness, or content beyond the v13–v14 inputs. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v15 (canonical scenario suite)

**What it adds (repo + viewer-only):**

- **`tests/fixtures/canonical_scenarios_v15/`** — four **synthetic** `.glass_pack` files (see **`README.md`** in that folder): **replace-heavy** (`process_poll_sample` × 8), **append-heavy** (× 14), **calm/steady** (× 6, for **bounded compare** “unchanged” self-test), **file-heavy** (`file_poll_snapshot` × 7 — **directory-poll** semantics only).
- **`viewer/scripts/writeCanonicalScenariosV15.mjs`** / **`verifyCanonicalScenariosV15.mjs`** — regenerate and **`glass-pack validate --strict-kinds`** all scenario packs.
- **`viewer/src/replay/canonicalScenariosV15.integration.test.ts`** — loads each pack, asserts **replay** wire mode / clusters / compare; **live** `session_warning` + `session_resync_required` → **`compileLiveToGlassSceneV0`**; **regression** load of the original **`vertical_slice_v0`** flagship pack.
- **`integration_tests`:** **`canonical_scenarios_v15_packs_present`** — committed bytes exist.

**What each scenario proves / does *not* prove:** see **`tests/fixtures/canonical_scenarios_v15/README.md`**. Summary: **breadth** of bounded replay + one **live** resync/warning path — **not** collector truth, **not** bridge proof, **not** syscall file semantics for `file_poll_snapshot`.

**F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v14 (bounded receipt evidence hardening)

**What it adds (viewer-only):**

- **`boundedClaims.ts`:** **`BOUNDED_RECEIPT_SCHEMA_VERSION`** = **`glass.receipt.v0`**; each **`BoundedClaimV0`** carries **`supportingEvidenceRowIndices`**, **`supportingFactIndices`**, **`evidenceRefKeys`** (deterministic tokens from the current drilldown only); **`buildBoundedClaimReceipt`** produces **`BoundedClaimReceiptV0`** with **`receiptId`**, **`claimId` / `claimKind`**, **`supportBullets`**, **`evidenceRefKeys`**, **`compareAnchorLine`**, **`focusContextLine`**, **`weaknessOrUnavailableNote`** when honest; **`serializeBoundedEvidenceRowKeyForReceipt`** for stable row-key strings; **`resolvePrimaryClaimId`** may prefer **`selection_linked_change` / `cluster_lanes_change`** when a **cluster** is selected (after episode match); claim ids use **`claim-v14:…`**.
- **`boundedClaimsPanel.ts`:** receipt shows schema + id, claim kind, evidence ref line, compare anchor when present, focus line when present; copy includes the same bounded fields — **not** a report/export subsystem.
- **`boundedEvidencePanel.ts`:** optional **`supportingEvidenceRowIndices`** — rows that support the active claim get **`glass-bounded-evidence-card--claim-support`** (distinct from cross-link selection).
- **Replay / live shells:** pass **compare + episodes + selection** into **`buildBoundedClaimReceipt`**; evidence panel receives **`supportingEvidenceRowIndices`** from the receipt.

**What bounded receipts are based on:** only the **current** bounded claim, **`computeBoundedEvidenceDrilldown`** facts/rows, **`computeBoundedSceneCompare`** (when available), **`computeBoundedSceneEpisodes`** context for focus text, **`GlassSceneV0.honesty`**, and selection/episode ids already in UI state — **no** second authority.

**What they do *not* imply:** causal explanation, topology, full history, calibrated confidence, or content not already present in those inputs. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v13 (bounded claims + receipt)

**What it adds (viewer-only):**

- **`boundedClaims.ts`:** **`computeBoundedSceneClaims`** → **`BoundedSceneClaimsV0`** (`glass.claims.v0`) — pure, deterministic; maps each **episode card** to a **claim** with **`BoundedClaimStatusV0`**, **`doesNotImply`** text per claim kind, and merged **evidence ref** strings from compare + drilldown + sample scope; **`resolvePrimaryClaimId`** prefers the claim linked to the **selected episode** when set; **`buildBoundedClaimReceipt`** — receipt-shaped struct (title, statement, status label, bullets, scope, scene honesty line, does-not-imply); **`boundedClaimEvidenceUiLines`** — two lines for the evidence block.
- **`boundedClaimsPanel.ts`:** **`renderBoundedClaimsInto`** (chips + honesty) and **`renderBoundedClaimReceiptInto`** (receipt or empty state); optional **Copy claim receipt (text)** — bounded plaintext only, **not** a document/export subsystem.
- **`boundedEvidencePanel.ts`:** **`claimContextLine`** / **`claimDoesNotImplyLine`** after episode lines when a claim receipt is active.
- **Replay / live shells:** **Bounded claims (Vertical Slice v13)** between **episodes** and **temporal lens**; explicit **`selectedBoundedClaimId`** (toggle chips; **suggested** selection id when honestly present); highlight = selection **or** primary claim from episode focus.

**What it does *not* imply:** AI summaries, causal attribution, complete history, topology, or calibrated statistical confidence. Claims restate **only** what bounded compare + drilldown + episodes already support. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v12 (bounded episodes)

**What it adds (viewer-only):**

- **`boundedEpisodes.ts`:** **`computeBoundedSceneEpisodes`** → **`BoundedSceneEpisodesV0`** (`glass.episodes.v0`) — pure, deterministic; kinds include **resync / warning / reconcile / wire / tail replace·append·shift**, **replay cursor step** (immediate prior vs current **only**), **replay prefix fraction**, **selection / cluster / focus**, **settle**, and **insufficient_history** when compare has no baseline. **`boundedEpisodeEvidenceUiLines`** — evidence panel copy for a selected episode. **`boundedEpisodeSelectionStillValid`** — stale episode id cleared on recompute.
- **`boundedEpisodesPanel.ts`:** **`renderBoundedEpisodesInto`** — compact **card strip** (`data-testid` `*-bounded-episodes-root` / `*-bounded-episode-card`); primary card highlighted; click toggles selection; **suggested** `glass.sel.v0:*` ids applied when honestly present on the episode.
- **`boundedEvidencePanel.ts`:** optional **`episodeContextLine`** / **`episodeHonestyNote`** when an episode is selected (bounded wording; calm when no extra selection target).
- **Replay / live shells:** **Bounded episodes (Vertical Slice v12)** block **above** the temporal lens; **compare baseline** flag **`compareBaselineIsImmediatePrior`** separates compare **vs** immediate-paint **replay cursor** episode honesty; live passes **`lastAppliedWire.eventTailMutation`** only as **bounded** append/replace/none hints for tail-shrink honesty strings.

**What it does *not* imply:** narrative theater, **causal** chains, agent intent, **full** session history, or topology. Episodes are **subordinate** to the scene and **bounded** to what compare + scene fields + prior paint already expose. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v11 (bounded temporal lens)

**What it adds (viewer-only):**

- **`boundedTemporalLens.ts`:** **`pushBoundedTemporalRing`**, **`resolveCompareBaselineFromRing`**, **`clampTemporalBaselineIndex`**, **`computeReplayStepNeighborhood`**, **`formatBoundedSceneTemporalFingerprint`**, **`buildReplayTemporalLensView`**, **`buildLiveTemporalLensView`** — pure, deterministic; ring size capped (**5**) to scenes the viewer **actually painted**; **not** server log replay, **not** full pack history.
- **`boundedTemporalLensPanel.ts`:** **`renderBoundedTemporalLensInto`** — honesty line, optional **step** row (replay), **Recent paints** chips with fingerprints, **Reset compare baseline** when a non-default baseline is selected.
- **Replay (`replayOnlyShell`):** section **`replay-temporal-lens`** — step chips dispatch **`seek_index`**; paint chips set **compare baseline** (`previousScene` for compare + canvas + inspector + evidence); clearing pack / idle / error clears the ring.
- **Live (`liveSessionShell`):** **`live-temporal-lens-root`** — paint ring only; baseline selection matches replay semantics; **Disconnect** clears the ring; **`buildCurrentLiveVisualSpec`** uses the effective compare baseline for provenance/spec consistency.
- **Honesty:** evidence **`previousBoundedSampleCount`** for “changed” rows still uses the **immediate prior paint** (`previousReplayScene` / `previousPaintedLiveScene`), not the selected compare baseline — honest append-style growth semantics.

**What it does *not* imply:** durable session history, causal timelines, full-pack scrubbing from the lens, or continuity guarantees beyond bounded viewer state. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v10 (bounded cross-linking)

**What it adds (viewer-only):**

- **`boundedSceneCrosslink.ts`:** pure **`resolveEvidenceRowKeyToSelection`**, **`resolveCompareEvidenceCrosslink`**, **`honestBoundedClusterIdFromEvent`**, optional **`resolveSystemIntegrityRegionSelection`** / **`resolveBoundedEvidenceRegionSelection`** — deterministic mapping from **evidence row keys** (live tail index or replay `seq`+`event_id`) to **cluster** selection ids (`cl_process` / `cl_file`) only when the event kind bucket and scene clusters support it; **compare** paragraph maps to the same **overlay** ids as Canvas hit-testing (`compare_selection` → `compare_summary` → `compare_unavailable`). **No** graph edges, **no** invented causality, **no** hidden selection authority.
- **`boundedEvidenceDrilldown.ts`:** each **`BoundedEvidenceRowV0`** carries a **`rowKey`** (`live_tail_event` | `replay_prefix_event` | `none`) for stable cross-link resolution; evidence **compare** line can **append** selection-scoped compare text from **`BoundedSceneCompareV0.selectionCompareLine`** when honestly present.
- **`boundedEvidencePanel.ts`:** optional **`RenderBoundedEvidenceOptions`** — interactive evidence **cards** and **Compare:** line (when linked) call back into shells to **replace** selection (toggle off when the same target is activated again); unmappable rows set a calm **cross-link note** (`data-testid` `replay-bounded-evidence-crosslink-note` / `live-bounded-evidence-crosslink-note`).
- **`boundedSceneSelection.ts`:** **`boundedSelectionIdOverlay`** helper; **fix:** region role for system rail hit-testing uses **`system_integrity_rail`** (matches **`SceneBoundedRegionRole`**).
- **Shells:** **`replayOnlyShell`** / **`liveSessionShell`** — **Bounded evidence (Vertical Slice v10)** heading; wired cross-link handlers + note element.

**What it does *not* imply:** multi-hop navigation, trace graphs, causal chains, topology between events, or a “full” evidence history. Cross-linking is **bounded to kind buckets and layout ids the compilers already exposed**. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v9 (bounded evidence drilldown)

**What it adds (viewer-only):**

- **`boundedEvidenceDrilldown.ts`:** **`computeBoundedEvidenceDrilldown({ scene, spec, compare, selectedSelectionId, previousBoundedSampleCount, liveEventTail, replay })`** → **`BoundedEvidenceDrilldownV0`** (`glass.evidence.v0`) — pure, deterministic; **live** uses the bounded WS **`eventTail`** (oldest→newest); **replay** uses the **index-ordered pack prefix** through the scrub cursor. Rows carry labels such as **`live_tail`**, **`replay_prefix`**, **`current_step`**, **`changed`** (when compare + append-style growth are honestly known), **`sampled`** (cluster kind filter). **No** causality chain, **no** graph edges, **no** hidden authority beyond Scene v0 + the same tail/prefix the compilers already use.
- **`boundedEvidencePanel.ts`:** **`renderBoundedEvidenceInto`** — product-style cards + facts list (not a JSON wall); debug JSON for the current replay event remains separate.
- **Shells:** **`replayOnlyShell`** / **`liveSessionShell`** — **Bounded evidence (Vertical Slice v9)** block under the bounded inspector; **`data-testid`:** `replay-bounded-evidence` / `live-bounded-evidence`.

**What it does *not* imply:** complete traces, full history, syscall-complete coverage, or topology between events. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime topology scene.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v8 (bounded compare)

**What it adds (viewer-only):**

- **`boundedSceneCompare.ts`:** **`computeBoundedSceneCompare(prev, next, { selectedId })`** → **`BoundedSceneCompareV0`** (`glass.compare.v0`) — pure, deterministic; compares only fields present on **`GlassSceneV0`** (wire mode, tail/sample mass, reconcile/resync/warning/replay-prefix strings, cluster lane facts, emphasis steps/region weights, focus captions for the current selection). **No** invented timeline; **no** graph diff.
- **`LiveVisualSpec`:** **`boundedCompareSummaryLine`**, **`boundedCompareDetailLines`**, **`boundedCompareUnavailableReason`**, **`boundedCompareSelectionLine`** — populated from **`liveVisualSpecFromScene(…, { previousScene })`**. First frame on a path shows a calm **unavailable** reason; later frames compare against the **last painted** bounded scene.
- **`applyBoundedCompareOverlaysToPrimitives`** — small **`compare_overlay_*`** fill quads (amber) on wire/density/HTTP chip/state rail/cluster/region/focus hints; **Canvas text** adds **`compare: …`** and optional **`selection compare: …`** lines; **WebGPU** consumes the **same** primitive list (compare cues are geometry-only; full sentences stay on Canvas overlay).
- **Shells:** **`replayOnlyShell`** / **`liveSessionShell`** capture **`previousReplayScene`** / **`previousPaintedLiveScene`** before each compile and pass **`previousScene`** into **`renderLiveVisualOnCanvas`** / **`paintLiveVisualSurface`**; hit-testing uses the same **`previousScene`** so overlay line stacks stay aligned.
- **Inspector:** **`buildBoundedInspectorLines`** includes compare summary + up to eight detail lines; empty selection shows compare when available.

**What it does *not* imply:** multi-step history, graph evolution, syscall-complete diffs, or any “before” state beyond the **single** prior bounded frame the viewer actually held. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime topology scene.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`. Compare stays **one-step** honest.

## Vertical Slice v7 (bounded focus reflow)

**What it adds (viewer-only):**

- **`boundedSceneFocusReflow.ts`:** **`BoundedStripLayoutV0`** (`glass.strip_layout.v0`) + **`computeBoundedStripLayoutFromFocus(scene, focus, selectionId)`** — pure, deterministic; adjusts **primary band height**, **state rail height**, **cluster strip height**, optional **live** three-lane rail fractions (snapshot / resync / warning) when the selection id targets a rail lane, and optional **cluster lane width fractions** when a cluster is focused and **more than one** lane exists. **Not** graph layout; **not** inferred relationships.
- **Drawable Primitives v0** consumes **`stripLayout`** in **`buildBoundedVisualGeometryPrimitives`**, **`appendVerticalSliceStateRail`**, **`appendBoundedActorClusterStrip`**, **`applyBoundedSceneComposition`**, **`applyBoundedEmphasisOverlays`**, and **`applyBoundedSceneFocusToPrimitives`** (focus frames use reflowed geometry). Canvas **text overlay** uses **`stripPrimaryY`**, **`stripContentBottomY`**, and a **`reflow: …`** line from **`boundedStripReflowLine`** on **`LiveVisualSpec`**. WebGPU draws the **same** reflowed primitive stream as Canvas (still **no** GPU text — captions remain on the overlay).
- **Inspector** adds **`Strip reflow (spatial): …`** when reflow copy is present; **live provenance** can merge focus + reflow fragments into the bounded focus summary line.

**What it does *not* imply:** drill-down pages, a second “detail” scene, process tree expansion, or edges you do not already have in Scene v0. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`. Reflow stays bounded to the **current** compile.

## Vertical Slice v6 (bounded focus mode)

**What it adds (viewer-only):**

- **`boundedSceneFocus.ts`:** **`computeBoundedSceneFocus(scene, selectionId)`** → **`BoundedSceneFocusV0`** (`glass.focus.v0`) — pure, deterministic; **only** existing regions, clusters, and selection-id patterns (no graph traversal, no inferred edges). **`dimHexColor`** + **`applyBoundedSceneFocusToPrimitives`** adjust **fill** tints and optional **selection frame** strokes on related bands; non-focused vertical bands are **dimmed**, not removed.
- **`LiveVisualSpec.boundedFocusCaptionLine`** and provenance **`boundedFocusSummary`** — same focus vocabulary on Canvas overlay (`focus: …` line) and **`formatLiveVisualProvenanceStripText`** (` · focus=…` when active).
- **`sceneToDrawablePrimitives(…, { focusedSelectionId })`** and **`liveVisualSpecFromScene(…, focusedSelectionId?)`** — replay and live **share** the path; WebGPU consumes the same primitive list (honest fallback: if a future effect cannot be expressed in WebGPU, keep Canvas overlay as the source of caption text — **no** fake GPU-only topology).
- **Shells:** **`replayOnlyShell`** / **`liveSessionShell`** already drive selection; v6 **refreshes** inspector and scene paint with **focus-aware** spec + primitives.

**What it does *not* imply:** drill-down graph, hidden navigation, edges between processes, or “related” structures beyond **explicit** region membership and **known** cluster/rail/wire roles in Scene v0. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

## Vertical Slice v5 (bounded selection + inspector)

**What it adds (viewer-only):**

- **Stable selection ids:** `glass.sel.v0:…` strings derived only from **Scene v0** structures and **Drawable Primitives v0** / Canvas overlay layout — **not** a graph node id space, **not** topology navigation.
- **Pure helpers:** `viewer/src/scene/boundedSceneSelection.ts` — **`buildBoundedSelectionHitTargetsForScene`** (geometry from `sceneToDrawablePrimitives` + overlay line rects aligned with `drawLiveVisualTextLabelsIntoContext`), **`hitTestBoundedSelection`** (last-painted / topmost wins), **`buildBoundedInspectorLines`** (bounded facts + honesty line).
- **Shells:** **`replayOnlyShell`** and **`liveSessionShell`** — pointer hit-testing on the scene surface; **toggle** same target to clear; **replace** on a new target; **bounded inspector** `<pre>` (`data-testid="replay-bounded-inspector"` / `live-bounded-inspector`) plus optional dashed **selection outline** on Canvas (full Canvas or hybrid **text overlay**).
- **Replay default unchanged:** Tier B replay remains the default surface; event JSON inspector remains **debug** (not merged into selection authority).

**Selectable targets (non-exhaustive):** bounded **regions** (`composition_*` panels), **wire** band / ticks / HTTP chip, **state rail** lanes, **cluster** segments, **overlay** lines (mode/tail/snapshot/replay/wire/HTTP), **`bounded_scene_frame`**. **Not** included: fake graph nodes/edges, full-history drill-down, or any structure not already in Scene v0.

**What it does *not* imply:** causal graph, process tree navigation, syscall-complete file graph, or continuity beyond existing bounded replay/live contracts. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

## Vertical Slice v4 (bounded emphasis / transitions)

**What it adds (viewer-only):**

- **`GlassSceneV0.emphasis`:** **`BoundedSceneEmphasisV0`** — pulse steps (`wirePulseStep`, `samplePulseStep`, `resyncFlashStep`, `systemFlashStep`, `replayCursorPulseStep`) that **decay** once per compile when the shell passes **`previousEmphasis`**, and **bump** only when the **emphasis basis** (wire mode, tail length, resync/warning/reconcile strings, replay cursor / phase) **actually changes**. **Not** idle animation; **not** a timeline.
- **`GlassSceneV0.replayCursorIndex` / `replayEventTotal` / `replayPhase`:** replay presentation facts for emphasis (live uses **`replayPhase: "none"`** and null cursor/total).
- **Pure core:** `computeBoundedSceneEmphasis` in `viewer/src/scene/boundedSceneEmphasis.ts` — deterministic, DOM-free, renderer-free.
- **Drawable Primitives v0:** **`applyBoundedEmphasisOverlays`** inserts **`emphasis_*_overlay`** fills **before** the outer composition frame; region panel tints follow **`regionWeight*`** from emphasis. Canvas and WebGPU share the same primitive list; overlay text **`emphasis: …`** comes from **`LiveVisualSpec.boundedEmphasisSummaryLine`** (Canvas overlay only).
- **Shells:** **`replayOnlyShell`** and **`liveSessionShell`** pass **`previousEmphasis`** between paints so replay scrub / live updates can show bounded pulses.

**What it does *not* imply:** historical replay of wire events, causal graph, or decorative motion when nothing changed. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

## Vertical Slice v3 (bounded relationships / composition)

**What it adds (viewer-only):**

- **`GlassSceneV0.regions`:** three **`SceneBoundedRegion`** entries with **`memberZoneIds`** only (wire + density + markers vs snapshot/reconcile/state rail vs actor clusters — live; replay uses **`z_primary` / `z_density` / `z_playback`** vs **`z_snapshot` / `z_state_rail`** vs **`z_actor`**). **Roles:** `primary_wire_sample`, `system_integrity_rail`, `bounded_sample_evidence`. This is **grouping**, not edges and not a process tree.
- **Builders:** `buildLiveBoundedRegions` / `buildReplayBoundedRegions` in `viewer/src/scene/boundedSceneRegions.ts` — deterministic labels and zone lists from existing zone ids only.
- **Drawable Primitives v0:** **`applyBoundedSceneComposition`** runs after the state rail + cluster strip: underlay **panels** + **left accent bars** aligned to the fixed band / rail / cluster layout, a **1px separator** between system rail and evidence strip, and an **outer bounded-scene frame** stroke. New **`composition_*`** semantic tags (including **`composition_bounded_scene_frame`** + WebGPU edge expansion). Same primitive stream for Canvas and WebGPU.
- **`LiveVisualSpec.boundedCompositionCaption`:** short **`Wire · System · Evidence`** line (from `formatBoundedCompositionCaption`) on the Canvas text overlay — **not** a second semantic authority.

**What it does *not* imply:** causal links between regions, full topology, or history outside the bounded sample. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

## Vertical Slice v2 (bounded actor clusters)

**What it adds (viewer-only):**

- **`GlassSceneV0.clusters`:** a **small** (≤4) ordered list of **`SceneActorCluster`** entries: **system** (warning / resync / HTTP reconcile when present), **process** / **file** sample counts from **`kind`** in the bounded live tail or replay prefix only, **snapshot origin** (live, when known), **replay index prefix** (replay, when pack loaded). **Empty tail** / **idle replay** uses an honest **`empty_sample`** lane — not a fake graph.
- **Derivation:** `deriveLiveBoundedActorClusters` / `deriveReplayBoundedActorClusters` in `viewer/src/scene/boundedActorClusters.ts` — counts `process_*`, `command_exec`, `env_access` vs `file_*`; **no** parent/child tree, **no** edges, **no** history outside the current sample.
- **Drawable Primitives v0:** **`actor_cluster_strip_*`**, per-lane **`actor_cluster_segment_*`**, shared **`actor_cluster_emphasis_bar`**, and **`LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT`** (strip under the v1 state rail). **WebGPU** draws the same fills + stroke expansion as Canvas; **cluster text summary** (`clusters: …`) is Canvas overlay only.
- **Default canvas height** for the strip is **200px** CSS (state rail + actor strip + text).

**What it does *not* imply:** process tree, syscall-complete file graph, or full execution history — only **bounded kind tallies** and **current** system/snapshot/replay facts.

## Vertical Slice v1 (scene richness)

**What it adds (viewer-only):**

- **Scene System v0:** clearer **zone** grouping (wire mode, bounded tail density, R/A/Rz slots, snapshot origin, reconcile/resync, **state rail**). **Fact cards** surface only **current** strings (`snapshot_origin`, `resync_reason`, `warning_code`, replay-specific snapshot disclaimer) — **no** graph edges, **no** process tree, **no** invented history.
- **`GlassSceneV0`:** `snapshotOriginLabel` (live: WS `session_snapshot_replaced` or optional last **HTTP** `bounded_snapshot.snapshot_origin` when passed into `compileLiveToGlassSceneV0`); `replayPrefixFraction` (replay only: prefix length / pack size, or `null` when no split yet). **`stripSource`** on `LiveVisualSpec` drives Drawable state-rail geometry (**live** = three lanes: snapshot / resync / warning emphasis; **replay** = honest **prefix vs remainder** lanes or a single remainder fill when unloaded).
- **Drawable Primitives v0:** **`state_rail_*`** and **`replay_*`** semantic tags plus **`LIVE_VISUAL_STATE_RAIL_LAYOUT`**; Canvas 2D and WebGPU still share **`sceneToDrawablePrimitives`**. **WebGPU** does not render text; labels remain on the Canvas overlay (mode, snapshot origin or replay prefix %, wire, HTTP reconcile, honesty).
- **Default canvas height** was raised for v2; see **Vertical Slice v2** (currently **200px** CSS for rail + cluster strip + text).

**What it does *not* imply:** full Glass topology, durable history, or continuity beyond existing bounded contracts. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

## What it is

A single **bounded** demo path through the real Glass v0 substrate: **Tier B static replay** (default) and **`?live=1`** live session use the **same** Scene System v0 strip and Drawable Primitives semantics. The slice is optimized for one coherent story: **honest operator visibility** (replace / append / resync wire roles, HTTP reconcile chip, bounded tail density, **snapshot origin and system-state rail**) — **not** a process graph, **not** full history, **not** invented topology.

## Scenario label

**“Agent expectations vs honest bounds”** is a **demo nickname** only: it stands in for the common failure mode where operators expect more continuity than bounded telemetry can support. It does **not** add a new collector lane, narrative events, or graph edges.

## What is real

- **Replay:** index-ordered prefix vs pack from `.glass_pack`; `compileReplayToGlassSceneV0`; Canvas 2D via `renderLiveVisualOnCanvas`.
- **Live:** bounded WebSocket tail + optional **F-04** HTTP snapshot; `compileLiveToGlassSceneV0`; same primitives path; hybrid WebGPU + Canvas text overlay when available.
- **Frozen contracts unchanged:** opaque `snapshot_cursor`, `bounded_snapshot.snapshot_origin`, `RESYNC_HINT_REASON_*`, F-03 queue/backpressure, `session_delta` only when honestly supportable.

## What remains bounded / not claimed

- No durable global history in the viewer; WS + HTTP are **replacement-style** samples per existing contracts.
- F-IPC transport remains **provisional** (not frozen here).
- Phase-6 topology/runtime scene is **out of scope** for this slice.

## Known-good fixture path (replay)

**One** committed pack is the canonical Vertical Slice v0 demo input:

| Path | Description |
|------|-------------|
| `tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack` | Tier B **`glass.pack.v0.scaffold`**, 3 synthetic `process_poll_sample` events, session id **`glass_vertical_slice_v0`**. |

- **Synthetic:** labeled in event `attrs` / adapter — not collector truth; used for deterministic load + Scene v0 honesty checks.
- **Proves:** `loadGlassPack(…, strict_kinds)` succeeds; `compileReplayToGlassSceneV0` reports index-prefix sample, “not live tail” / “not process topology”, bounded counts — see `viewer/src/replay/verticalSliceFixture.integration.test.ts`.
- **Does not prove:** bridge, WS, HTTP snapshot, F-IPC, retained loops, or any live path.

**Run in the viewer (manual):** `cd viewer && npm run dev` → **Open file** → select `tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack` from your checkout. Scrub/step — Scene v0 canvas shows prefix depth and R/A/Rz semantics.

**Dev-only instant load (`npm run dev` only):** open e.g. `http://localhost:5173/?fixture=vertical_slice_v0` (Vite default port). The dev server serves the committed pack at `GET /__glass__/dev/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack` (middleware in `viewer/vite.config.ts`); the replay shell fetches it once, then removes `fixture=` from the URL via `history.replaceState`. **Not available** in `vite build` / static `dist/` (`import.meta.env.DEV === false` — no auto-fetch). **`vite preview`** does not register this middleware — use `npm run dev` for the shortcut. **Vitest** sets `process.env.VITEST` — the replay shell does not auto-fetch fixtures in tests so `import.meta.env.DEV` in the test bundle does not imply a second code path.

**Regenerate bytes** (if the fixture shape changes intentionally): `cd viewer && npm run fixture:vertical-slice`

**Verify with Rust validator:** `cd viewer && npm run verify:vertical-slice-fixture` (or `cargo run -p glass-pack -- validate …` from repo root — see `tests/fixtures/vertical_slice_v0/README.md`).

## How to run the demo (general)

1. **Replay (default):** same as above; the fixture is optional but is the **documented** known-good pack.
2. **Live:** append **`?live=1`**; connect to a loopback bridge with token + session id as documented in `README.md` and `docs/IMPLEMENTATION_STATUS.md`.

## Next major step (unchanged)

Durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md` “Next engineering steps”. Selection, inspector, and **v6 focus** stay bounded to the current compile; they do **not** replace the need for durable ingest or a future honest topology surface when data exists.
