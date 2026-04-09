# Glass — Full Engineering Specification
## Local-First Execution Visibility Engine

**Document type:** full non-summary engineering specification  
**Project:** Glass  
**Former concept name:** Aether  
**Relationship to other work:** separate public execution-visibility repo under the broader StealthEye body of work; complements StealthClaw but is not the StealthClaw product shell  
**Primary goal:** build the most technically impressive, visually stunning, genuinely useful open-source execution-visibility system possible without turning it into a fake dashboard, enterprise SaaS clone, or AI-generated-looking toy  
**Primary audience:** developers, systems engineers, security-minded engineers, AI-agent users, open-source reviewers, technical testers, future contributors  
**Status target:** build-ready specification  
**Scope:** Glass v0 breakout build, with explicit vNext ceiling and deferred lanes  
**Revision status:** v8 final launch-surface and adoption-friction hardening pass incorporating zero-install static replay viewing, optional disciplined sonification, lightweight known-agent signature hints, X-Ray causality focus mode, and final README/demo/share-surface polish on top of inode-first identity, stale-viewer resync, headless exit-code passthrough, ephemeral-zone modeling, privilege separation, edge bundling, session-relative time translation, and network-aware sanitization

---

# 0. Executive framing

Glass is a **local-first execution-visibility engine** that turns hidden machine behavior into a live, inspectable, replayable spatial system in the browser.

In plain English:

- a process starts on the host
- Glass watches what it actually does
- file touches, process spawns, IPC calls, network attempts, and boundary crossings become visible
- the user can inspect, replay, and understand execution behavior as a living graph instead of trusting logs, vibes, or agent output

Glass is **not** a dashboard-first product.
Glass is **not** a generic observability suite.
Glass is **not** a log aggregator with prettier shaders.
Glass is **not** a security product pretending to be a visualizer.

Glass exists to make hidden machine behavior **physically legible**.

That is the core product truth.

---

# 1. Product doctrine

## 1.1 One-line product definition

Glass lets you literally watch what your code, agents, and processes actually do — turning hidden machine behavior into a live, replayable, inspectable spatial graph in the browser.

## 1.2 Emotional hook

The user should feel:

**“I finally see what this thing is really doing.”**

Not:

- “I am looking at another admin dashboard”
- “I am reading a prettier SIEM”
- “this is a shader demo with fake data”

## 1.3 Public positioning

Preferred positioning:

- execution visibility engine
- machine behavior visibility engine
- local execution atlas
- watch what your agents and processes actually do
- hidden execution made legible

Avoid positioning as:

- SIEM
- observability platform
- cloud monitoring suite
- compliance tooling
- policy framework
- agent framework
- “AI copilot for runtime”

## 1.4 Core thesis

Modern developer systems increasingly rely on hidden execution:

- AI coding agents
- local model runtimes
- background scripts
- build systems
- CLIs
- browser automation
- wrappers over wrappers
- local/cloud blended tools

Most users only see:

- terminal output
- logs
- maybe metrics
- maybe traces
- maybe a dashboard

The actual truth of execution remains abstracted away.

Glass fixes that by making execution directly visible.

---

# 2. Product laws

These laws are mandatory. They define what Glass is allowed to become.

## Law 1 — Reality First

Glass may present only:

- real collected telemetry
- deterministic replay of recorded telemetry
- explicitly labeled synthetic showcase data

No fake substrate may be passed off as product truth.

## Law 2 — Legibility Wins

Glass exists to make hidden execution understandable faster than logs, not to maximize widget count, chart count, or enterprise-product appearance.

## Law 3 — Beauty Must Mean Something

Every visual treatment must encode real behavior, real structure, or real emphasis.
No effect exists only to look futuristic.

## Law 4 — Local First

The core Glass experience must work on one machine with no cloud dependency.
Remote or fleet ideas are deferred until the single-machine truth surface is excellent.

## Law 5 — Honest Boundaries

Glass must say exactly what it sees, what it does not see, and what fidelity tier is active.
Fallback mode, synthetic mode, and reduced-visibility conditions must be obvious and inspectable.

## Law 6 — Useful Before Comprehensive

Glass does not need complete telemetry coverage in v0.
It does need to be genuinely useful for the situations it claims to cover.

## Law 7 — Hard Problems Visible

The finished product must visibly demonstrate difficult engineering:

- real collection
- normalized event modeling
- identity persistence
- timeline replay
- performant graph rendering
- accurate picking and inspection
- causal navigation

If the difficulty is invisible, the repo will not earn respect.

---

# 3. Design goals

## 3.1 Primary goals

Glass must:

1. Make hidden execution visually legible in real time.
2. Allow replay of recent execution history.
3. Make suspicious or structurally important behavior obvious.
4. Be immediately demoable from GitHub.
5. Look so good that people repost it.
6. Contain enough real systems engineering to earn serious respect.
7. Feel difficult to build because it actually is difficult to build.

## 3.2 Secondary goals

Glass should:

- become useful for AI-agent oversight
- become useful for build/debug workflows
- become useful for security-adjacent anomaly inspection
- create a strong funnel to website, GitHub profile, Reddit, and itch presence
- function as a public proof of deep systems craftsmanship

## 3.3 Non-goals for v0

Glass v0 does **not** need to be:

- a full runtime security platform
- a complete cloud observability replacement
- a compliance/reporting suite
- a Kubernetes fleet manager
- a policy engine
- a multi-tenant team product
- a database analytics system
- a SaaS control plane
- a full forensic platform

---

# 4. Release strategy and version boundary

## 4.1 Glass v0 — breakout build

This is the mandatory first shipping target.

Promise:

- watch one local execution chain in real time
- see process, file, and network behavior as a live spatial graph
- replay recent execution history
- visually surface suspicious or important transitions
- inspect causality faster than reading raw logs

Mandatory v0 components:

- one real local collector substrate
- one normalized event schema
- one append-only session model
- one graph/replay engine
- one WebGPU viewer
- one local API/bridge
- one polished operator shell
- three to five unforgettable demo packs

## 4.2 Glass vNext — research ceiling

Deferred to later phases:

- deeper eBPF expansion
- extended protocol awareness
- multi-session history warehouse
- advanced analytics substrate
- large-scale distributed topology mapping
- Arrow-native delivery pipelines
- deeper profiling lanes
- high-density historical aggregation systems
- optional cloud relay or remote session views

## 4.3 Hard rule

The existence of an ambitious vNext must **not** contaminate the v0 build with architecture that kills launch momentum.

---

# 5. Platform target and scope

## 5.1 Platform priority

### v0 real support target

**Linux first**

Reason:

- strongest telemetry substrate options
- best path to real process/file/network visibility
- eBPF path available for high-credibility collection
- strongest “this is real” technical story

### v0 demo compatibility target

- browser viewer should run wherever WebGPU is available
- recorded sessions should be viewable even on machines that cannot run the collector
- static replay demo packs should be distributable separately from the real collector path

## 5.2 Explicit support tiers

### Tier A — real collector + viewer
- Linux host with supported kernel/toolchain
- local collector running
- browser viewer connected locally

### Tier B — replay-only viewer
- any WebGPU-capable browser environment able to load a recorded session pack
- no live collector required

### Tier C — unsupported or deferred
- full Windows real collector
- full macOS real collector
- enterprise remote collection
- team collaboration
- cloud-native fleet aggregation

---

# 6. User stories

## 6.1 AI coding agent oversight

A developer launches an agent against a project directory.
Glass shows:

- process root
- spawned helpers
- file reads/writes
- expansion into unexpected directories
- network attempts
- blast-radius growth

The user can answer:

- what is it touching?
- where did it drift?
- what caused the drift?
- how far did it spread?

## 6.2 Suspicious local tool behavior

A local tool attempts outbound access unexpectedly.
Glass shows:

- originating process
- timing of the attempt
- local context leading to the attempt
- direction and result of the connection

## 6.3 Build corruption path

A build or automation script modifies many files.
Glass allows the user to inspect:

- order of writes
- touched regions
- upstream process chain
- affected zones
- recent timeline of contamination

## 6.4 Process fanout explosion

A script unexpectedly spawns multiple subprocesses.
Glass makes visible:

- branching tree
- descendant counts
- spatial spread
- hotspots and abnormal fanout

## 6.5 Terminal-vs-Glass side-by-side

Same execution:

- left: logs or terminal output
- right: Glass live scene

The user immediately understands why Glass exists.

---

# 7. System overview

Glass is split into six major runtime layers.

1. **Collector**  
   Captures raw host/runtime events.

2. **Normalizer**  
   Converts raw observations into a strict internal event schema.

3. **Session Engine**  
   Appends normalized events, maintains entity identity, stores a replayable session timeline.

4. **Graph Engine**  
   Maps entities and relationships into nodes, edges, clusters, histories, and emphasis states.

5. **Risk / Emphasis Engine**  
   Flags meaningful transitions: first network attempt, boundary crossing, excessive fanout, high write concentration, etc.

6. **Viewer Shell**  
   Local browser app providing live mode, replay mode, inspection, filtering, and capture playback.

---

# 8. Repository architecture

Recommended monorepo layout:

```text
glass/
├── collector/                    # Rust collector daemon, eBPF + OS event intake
├── schema/                       # Shared event schema, versioning, generated bindings
├── session_engine/               # Session append log, indexing, replay, retention
├── graph_engine/                 # Entity graph, clustering, edge model, emphasis rules
├── viewer/                       # WebGPU app (TypeScript), shell, inspectors, timeline
├── bridge/                       # Local API/transport surface between daemon and browser
├── demos/                        # Curated live and replay scenarios
├── docs/                         # Architecture, event model, limitations, walkthroughs
├── scripts/                      # Build, dev, packaging, demo generation, replay tooling
├── tests/                        # Cross-layer tests, replay tests, fixtures, golden scenes
├── assets/                       # Fonts, icons, neutral branding assets, screenshots
├── tools/                        # Profilers, scene validators, visual comparison tooling
├── README.md
├── LICENSE
└── GLASS_FULL_ENGINEERING_SPEC.md
```

## 8.1 Language choices

### Collector / bridge / performance-critical session code
- Rust

Why:
- strong systems credibility
- memory safety
- high-performance event processing
- clear binary packaging story
- fit for Linux-first telemetry collection

### Viewer / operator shell
- TypeScript
- WebGPU / WGSL
- minimal external UI dependency footprint

Why:
- browser-first delivery
- clean WebGPU integration
- strong control over rendering and interaction
- easier open-source onboarding for front-end contributors

### Shared schema generation
- schema source in one canonical format
- Rust and TypeScript bindings generated from that source

---


# 8A. Detailed repository shape

```text
glass/
├── collector/
│   ├── src/
│   │   ├── main.rs
│   │   ├── adapters/
│   │   │   ├── linux_ebpf/
│   │   │   ├── procfs/
│   │   │   ├── fswatch/
│   │   │   └── netwatch/
│   │   ├── normalize/
│   │   ├── session/
│   │   ├── bridge/
│   │   └── config/
│   └── tests/
├── schema/
│   ├── glass_event_schema.json
│   ├── bindings/
│   └── migrations/
├── session_engine/
│   ├── src/
│   └── tests/
├── graph_engine/
│   ├── src/
│   └── tests/
├── viewer/
│   ├── src/
│   │   ├── app/
│   │   ├── scene/
│   │   ├── render/
│   │   ├── wgsl/
│   │   ├── timeline/
│   │   ├── inspector/
│   │   ├── replay/
│   │   ├── filters/
│   │   └── styles/
│   ├── public/
│   └── tests/
├── bridge/
│   ├── contracts/
│   └── docs/
├── demos/
│   ├── agent-goes-rogue/
│   ├── spawn_bloom/
│   ├── network_surprise/
│   ├── corruption_path/
│   └── logs_vs_glass/
├── docs/
├── scripts/
├── tests/
└── tools/
```

## 8A.1 Repository law

Every top-level folder must have one clear role.
Do not overload the viewer with collector truth logic.
Do not overload the collector with presentation logic.
Do not bury schema changes in random feature PRs.

# 9. Runtime topology

## 9.1 Live flow

```text
Host process/runtime activity
    ↓
Collector sensor(s)
    ↓
Raw event adapters
    ↓
Normalizer
    ↓
Append-only session log
    ↓
Entity / graph state updates
    ↓
Local bridge (snapshot + live delta stream)
    ↓
WebGPU viewer
```

## 9.2 Replay flow

```text
Recorded session pack
    ↓
Replay loader
    ↓
Session reconstruction
    ↓
Graph reconstruction / cached state timeline
    ↓
WebGPU viewer
```

## 9.3 Hard topology rules

- collector must not depend on browser runtime
- privileged collection and browser-facing bridge/viewer serving must be split into separate processes
- viewer must not own truth about telemetry
- session log is authoritative for replayable facts
- graph engine derives from session facts, not vice versa
- emphasis/risk overlays are derived, never fabricated
- demo packs must be either recorded real sessions or explicitly synthetic fixtures

---

# 10. Collector subsystem

## 10.1 Collector role

The collector is responsible for capturing raw execution-relevant signals from the host and turning them into timestamped raw observations.

It does **not** decide product semantics.
It does **not** apply final risk labels.
It does **not** own the viewer model.

## 10.2 v0 collection target

Glass v0 should capture a bounded, high-value event set:

1. process start
2. process end
3. process spawn
4. file read
5. file write
6. file create
7. file delete or rename marker
8. network connect attempt
9. network connect result
10. local IPC connect (Unix domain sockets, named pipes, equivalent local endpoints where supported)
11. local IPC transfer marker where supported
12. directory boundary crossing
13. optional command execution marker
14. optional environment access marker

## 10.3 v0 collector strategy

### Real path
- Linux-first collector daemon
- eBPF-backed where appropriate for credibility and fidelity
- eBPF paths are used where they provide honest, high-fidelity visibility without requiring unsafe or misleading privilege assumptions
- bounded instrumentation surface
- minimal privilege story documented explicitly
- privileged collection must feed an unprivileged bridge process over a secured local IPC channel
- Unix domain socket / named-pipe visibility where the chosen adapter can support it honestly
- graceful degradation when high-fidelity eBPF attach fails due to kernel, privilege, or container limits

### Fallback mode
If the preferred eBPF-backed path cannot be established honestly, the collector must fall back to a lower-fidelity but broadly available substrate such as procfs observation combined with inotify/fanotify or equivalent documented adapters.

Fallback rules:

- fallback activation must be automatic unless the operator explicitly disables fallback
- the viewer status bar must show a visible fidelity state such as `Fallback Mode — Reduced Fidelity`
- the session manifest must record the active collector adapter, fidelity tier, and reason the higher-fidelity path was unavailable
- missing event classes in fallback mode must be declared explicitly rather than silently implied
- fallback mode must declare that attribution may be incomplete for micro-lived processes or namespace-limited workloads
- fallback mode is allowed to be less complete; it is not allowed to pretend to be equivalent

### Demo support path
- recorded session player
- synthetic event generator for stress/performance scenes
- fixture ingestion tool for deterministic test runs

## 10.3A Self-silencing protocol

The observer must not observe itself.

Glass must identify and suppress events emitted by its own collector process, local bridge process, viewer process, and any explicitly declared helper subprocesses before those events reach the normalizer.

Self-silencing rules:

- the collector must know its own PID lineage and the bridge/viewer PID lineage for the active run
- writes to Glass session artifacts, caches, logs, and bridge traffic surfaces must be dropped from product telemetry by default
- self-silencing must happen before aggregation so observer noise never distorts burst counts
- the manifest must record that self-silencing was active
- a diagnostics mode may expose suppressed counts for debugging, but not re-inject those events into the user-facing scene

## 10.3B Process privilege separation

Glass may not serve browser-facing HTTP or WebSocket surfaces from the same privileged process that performs eBPF attachment or other high-privilege collection.

Required architecture:

- the high-fidelity collector may run with elevated privileges only for the minimum scope required to attach and read telemetry
- the local bridge/viewer-serving process must run unprivileged
- privileged collector output must cross into the bridge exclusively through an authenticated local IPC channel such as a Unix domain socket or equivalent authenticated local transport
- the bridge may not inherit collector capabilities
- IPC failure must fail closed for the high-fidelity path and surface a manifest-backed warning rather than silently downgrading without explanation
- the browser must never talk directly to the privileged collector
- if privilege separation cannot be established honestly for a given environment, including restricted containers or namespace-constrained launches, Glass must fail closed for that mode or fall back to an explicitly lower-fidelity unprivileged adapter with a visible warning

## 10.4 Collector boundaries

The collector should **not** attempt in v0 to become:

- full packet inspection
- deep protocol analyzer
- full kernel security system
- universal profiler
- fleet collector mesh
- multi-machine orchestrator

## 10.5 Zone pre-flight hydration

When a live session targets a project root, workspace, or bounded directory tree, the collector should perform a fast pre-flight hydration pass before steady-state capture begins.

Hydration requirements:

- shallow-index the target root before normal live streaming begins
- record whether an observed file/path was already present at attach time versus discovered later during capture
- establish enough baseline structure for the graph engine to distinguish “existing artifact touched” from “new artifact appeared”
- bound hydration cost so attach latency remains acceptable for v0
- fail open with an explicit manifest flag if hydration is skipped, incomplete, or unsupported for the chosen adapter

Hydration is not a full file-content snapshot system.
It is a structural baseline pass.

## 10.6 Adapter capability and privilege declaration

Every collector adapter must declare, in machine-readable form where practical:

- which event kinds it can emit directly
- whether IPC visibility is supported
- whether zone hydration is supported
- whether resource heartbeat is supported
- required privileges/capabilities
- known blindspots

The product may not pretend unsupported event classes exist.
Viewer chrome, docs, and manifests must reflect adapter truth.

## 10.7 Collector outputs

Raw collector output must be transformed into a strict intermediary record before normalization.

Required raw fields:

- raw timestamp
- event source adapter id
- host process id where applicable
- parent process id where applicable
- path/socket details where applicable
- operation outcome where applicable
- source confidence / quality marker
- collector sequence number

## 10.8 Collector overhead ceiling and self-protection

Glass cannot materially degrade the machine it is trying to explain.

Required v0 daemon overhead posture:

- target collector overhead should remain within a strict bounded budget on developer hardware
- a default self-protection ceiling should exist, for example on the order of 5% CPU or 250 MB RAM over a sustained short window, and the exact values must be frozen before release
- if the ceiling is exceeded, the collector must first widen aggregation windows or reduce non-essential work
- if the collector still exceeds budget, it must emit a visible `collector_warning` and may gracefully detach or pause capture rather than silently harming the host
- self-protection actions must be recorded in the session manifest and inspector-accessible diagnostics

---

# 11. Normalization subsystem

## 11.1 Purpose

Normalization converts raw substrate-specific events into a stable internal schema.

This is a weight-bearing layer.
It is one of the hardest and most important parts of the project.

## 11.2 Why normalization matters

Without normalization, Glass becomes:

- renderer coupled to telemetry source
- brittle to platform differences
- impossible to replay cleanly
- visually inconsistent
- semantically fuzzy

With normalization, Glass gets:

- stable replay
- deterministic test fixtures
- source-agnostic graph construction
- clearer contracts
- better contributor understanding

## 11.3 Normalization rules

- every normalized event must have a strict event kind
- every normalized event must include canonical timestamp semantics
- every normalized event must reference stable entity ids wherever resolvable
- events that cannot be attributed cleanly in fallback mode must carry explicit actor-resolution quality rather than guessed lineage
- path semantics must be canonicalized before graph use
- network events must distinguish attempt vs result
- incomplete knowledge is allowed, but must be encoded as incomplete rather than guessed

## 11.4 Unknown handling

If a substrate cannot provide a field reliably, Glass must encode unknown explicitly.

No silent inference where correctness matters.

## 11.5 High-frequency aggregation buffer

Normalization must include a bounded aggregation layer for high-frequency repeated actions.

Purpose:

- prevent runaway event floods from overwhelming the session engine, bridge, or renderer
- preserve visual truth without preserving every single redundant micro-event
- keep the canonical scene responsive under pathological workloads

Required behavior:

- if the same actor performs the same action against the same subject repeatedly inside a short aggregation window, the normalizer may emit one aggregated event instead of thousands of duplicates
- aggregation windows must be explicit, bounded, and deterministic
- aggregation may only collapse semantically identical actions inside the same session window
- aggregated events must expose their true weight, count, byte totals, and duration
- replay must preserve the fact that repeated activity occurred, even if represented compactly

Suggested examples:

- 10,000 file writes from process A to file B in one second -> one `file_write_burst` style normalized record with `count=10000`
- repeated failed connects from process A to endpoint X -> one aggregated connect-failure burst with explicit count

Aggregation rules:

- aggregated records must still map to canonical actor/subject identities
- aggregated records must never hide first-occurrence semantics that matter for emphasis rules
- first boundary crossing, first outbound connect, and first destructive touch must remain individually visible
- the inspector must expose that the rendered edge/node intensity came from aggregation rather than a single event

## 11.6 Ghost PID / orphan-event handling

Fallback mode must handle micro-lived processes and attribution gaps honestly.

Required behavior:

- if a file, IPC, or network event arrives with a PID that can no longer be resolved against the fallback process table, the normalizer must not invent lineage
- such events must be attached to an explicit orphan-actor identity or equivalent transient actor placeholder
- the inspector must disclose that attribution is incomplete because the actor expired before full resolution
- orphan actors are valid scene elements in fallback mode and must render as transient, disconnected, or dashed-line actors rather than being dropped silently
- when later evidence can reconcile an orphan actor to a real process identity deterministically, the merge must be recorded and replay-stable

## 11.7 Known-agent signature hints

Glass may attach lightweight, non-authoritative framework or agent signature hints to process entities when a narrow shipped matcher can do so honestly.

Purpose:

- make screenshots and replay scenes more instantly legible for AI-agent users
- help operators recognize that a process likely belongs to a known framework or tool without pretending that Glass performed deep semantic attribution

Rules:

- signatures are heuristic labels, not security verdicts
- the shipped matcher must remain compact, reviewable, and hardcoded or file-backed in a narrow ruleset
- likely first targets include popular agent/dev tools such as aider, cline, langchain, autogen, or equivalent clearly-declared signatures
- signatures may use executable path, argv shape, cwd hints, import/module hints, or other declared process metadata only where available honestly
- operators must be able to disable signature hints globally or per session
- unknown or ambiguous matches must remain unlabeled rather than guessed
- signature hints must render as subtle glyphs or labels, not giant branding badges

---

# 12. Canonical event schema

## 12.1 Schema requirements

The schema must be:

- versioned
- language-neutral
- deterministic
- append-only compatible
- serializable for replay packs
- easy to bind in Rust and TypeScript
- narrow enough for v0 clarity

## 12.2 Core entity types

- `process`
- `file`
- `directory`
- `network_endpoint`
- `ipc_endpoint`
- `orphan_actor`
- `session_root`
- `host_boundary`
- `zone`

## 12.3 Core relationship types

- `spawned`
- `read`
- `wrote`
- `created`
- `deleted`
- `renamed`
- `attempted_connect`
- `connected`
- `failed_connect`
- `ipc_connect`
- `ipc_transfer`
- `crossed_boundary`
- `contained_in`
- `touched`
- `caused`

## 12.4 Canonical normalized event envelope

```json
{
  "schema_version": "glass.event.v0",
  "event_id": "evt_000000000123",
  "session_id": "ses_demo_01",
  "ts_ns": 1712672000123456789,
  "seq": 123,
  "kind": "file_write",
  "actor": {
    "entity_type": "process",
    "entity_id": "proc_4482",
    "resolution_quality": "direct"
  },
  "subject": {
    "entity_type": "file",
    "entity_id": "file_abcd1234"
  },
  "parent": {
    "entity_type": "directory",
    "entity_id": "dir_proj_src"
  },
  "attrs": {
    "path": "/workspace/project/src/main.ts",
    "bytes": 812,
    "result": "success",
    "zone_id": "zone_project",
    "boundary_crossing": false
  },
  "source": {
    "adapter": "linux_ebpf_v0",
    "quality": "direct",
    "time_domain": "session_monotonic",
    "raw_time_domain": "linux_monotonic"
  }
}
```

Canonical timestamp rule:

- canonical `ts_ns` in normalized events is session-relative monotonic time, not raw browser wall-clock time
- raw adapter time may be retained separately for diagnostics, but viewer behavior must run on the normalized session timebase
- the browser may never interpret kernel monotonic timestamps as JavaScript epoch time directly

## 12.5 Required event kinds in v0

- `process_start`
- `process_end`
- `process_spawn`
- `file_read`
- `file_write`
- `file_create`
- `file_delete`
- `file_rename`
- `network_connect_attempt`
- `network_connect_result`
- `ipc_connect`
- `ipc_transfer`
- `boundary_cross`
- `resource_heartbeat` (optional but strongly recommended in v0)
- `file_write_burst` / equivalent aggregated write event (allowed when emitted by the aggregation buffer)
- `network_burst` / equivalent aggregated connect event (allowed when emitted by the aggregation buffer)
- `ipc_burst` / equivalent aggregated local IPC event (allowed when emitted by the aggregation buffer)
- `command_exec` (optional in first slice)
- `env_access` (optional in first slice)

## 12.6 Event versioning rule

Schema changes must be explicit and versioned.
Replays recorded under an earlier schema must either:

- remain supported, or
- be upgradable via a declared migration tool

No silent schema drift.

---

# 13. Identity model

## 13.1 Entity identity is mandatory

Glass only becomes useful if entities persist coherently through time.

The system must maintain stable identities for:

- processes
- files
- directories
- network endpoints
- zones

## 13.2 Process identity

Process identity should be based on a stable runtime identity derived from:

- pid
- start time / birth time when available
- parent lineage
- executable path

This prevents accidental collapse when pids are reused.

Process entities may also carry optional, explicitly heuristic `framework_signature` metadata for known agent/tool labels when produced by the normalization matcher. That metadata is advisory only and must never override executable truth.

## 13.3 File identity

File identity must not rely only on path strings.
Where possible, use canonical path plus file identity metadata available from the platform.

On the Linux collector path, file identity should be inode-first wherever honest inode/device metadata is available.
This is required to avoid graph fragmentation across symlinks, hardlinks, relative traversal variants, or alternate path aliases that still resolve to the same underlying file object.

Rules:

- inode/device identity is the primary key for Linux file identity when available
- canonical path is a presentation and lookup surface, not the sole truth surface
- symlink and hardlink aliases must merge into one file node when they resolve to the same underlying file honestly
- when inode/device metadata is unavailable in a declared adapter, Glass must fall back to path-plus-metadata identity and record the lower certainty in the manifest

At minimum, the v0 model must distinguish:

- same path, same tracked file across time
- renamed file continuity where observed
- new file at same path after deletion/recreate when detectable
- same underlying inode touched through multiple path spellings or links

## 13.4 Directory and zone identity

Directories are both literal containers and visual neighborhoods.
Zones are policy-free spatial groupings used to communicate meaning:

Examples:
- project root
- outside project root
- hidden/system area
- temp/build area
- ephemeral / memory-backed area such as tmpfs, /dev/shm, or memfd-backed exchange where detected honestly
- network space
- container namespace / cgroup box where detected honestly

Zones must be deterministic and inspectable.

---

# 14. Session engine

## 14.1 Purpose

The session engine is the authoritative runtime store for a single monitored execution session.

Responsibilities:

- append normalized events
- assign sequence ordering
- maintain entity tables
- maintain incremental indexes
- support snapshot and replay reconstruction
- publish live deltas to the bridge

## 14.2 Session model

A session begins when:

- the collector starts with a target root, or
- the user attaches to a process/runtime target

A session ends when:

- the root process tree has ended or detached, or
- the user stops capture, or
- the daemon terminates the session gracefully

## 14.3 v0 persistence format

Recommended v0 persistence approach:

- append-only binary event segments
- lightweight side indexes for entity and time lookup
- session metadata manifest
- optional JSON export for debugging/tests

Suggested on-disk structure:

```text
sessions/
  <session_id>/
    manifest.json
    events.seg
    entities.json
    baseline_index.bin
    time_index.bin
    replay_cache.bin
    thumbnails/
    exports/
```

The session manifest must record:

- capture mode (`live`, `replay`, `headless`)
- target root / attach target
- active storage ceiling
- active event ceiling
- aggregation settings
- whether zone hydration was performed
- whether resource heartbeat was enabled
- export sanitization profile (`none`, `sanitize_default`, or declared custom profile`)
- whether user path components were masked or hashed
- whether command-line argument values were stripped on export
- whether private/internal network endpoints were masked or hashed on export
- whether local domain suffixes or socket names were masked on export
- whether the pack manifest reports `sanitized: true`
- short human-readable redaction summary for share-safe exports
- whether the export is recommended for public sharing (`share_safe_recommended`)

## 14.4 Session engine rules

- appends are ordered
- ordering is stable within a session
- replay must not require the collector to still be running
- event storage and visual state must be separable
- corrupted segments must fail loudly with repair tooling, not silently distort replay
- every live session must operate under explicit capture ceilings for both storage and event volume
- when a ceiling is reached, the daemon must either pause capture with a visible warning or prune according to the declared rolling-window policy
- ceiling behavior must be deterministic, documented, and inspectable in the session manifest

## 14.5 Local retention policy

Glass must prevent silent accumulation of abandoned local history.

Retention rules:

- unpinned local sessions older than the declared default retention window should be eligible for pruning
- a global local-storage budget should exist for the session store, for example on the order of 5 GB unless the operator overrides it
- a startup GC pass may prune expired unpinned sessions before new capture begins
- pinned sessions, exported packs, and explicitly preserved artifacts must never be deleted silently
- pin/unpin must be available via CLI and, where feasible, viewer/session UI
- any automatic pruning activity must be logged locally and summarized in diagnostics

---

# 15. Graph engine

## 15.1 Role

The graph engine translates session facts into a living spatial model.

This is where Glass becomes visually and cognitively powerful.

## 15.2 Responsibilities

- create nodes for tracked entities
- create edges for causal/interaction relationships
- maintain active vs historical state
- cluster directories and zones into neighborhoods
- maintain short-term and replayable temporal state
- integrate resource heartbeat overlays into node state where enabled
- maintain dynamic level-of-detail (LOD) state for large scenes
- emit render-ready buffers or data blocks for viewer consumption

## 15.3 Node classes

### Process nodes
Bright, high-salience active cores.
Represent actors.

### File nodes
Dimmer artifact nodes.
Represent touched artifacts.

### Directory / zone nodes
Neighborhood or cluster anchors.
Represent containment and context, including explicit container or namespace boxes where detected honestly and volatile memory-backed zones where touches should not be mistaken for persistent disk writes.

### Orphan actor nodes
Transient process-like placeholders used when fallback attribution cannot be resolved cleanly.
Represent incomplete but still real causality.

### Network nodes
Endpoint / external-link anchors.
Represent outbound or inbound external behavior.

### IPC nodes
Local endpoint anchors for Unix domain sockets, named pipes, and equivalent host-local channels.
Represent local process-to-process communication that does not cross a normal network boundary.

## 15.4 Edge classes

### Spawn edge
Process to child process.

### Read/write edge
Process to file.

### Containment edge
File/process to directory or zone.

### Network edge
Process to endpoint.

### IPC edge
Process to local IPC endpoint or local transfer path.

### Boundary edge
Process or file touch crossing between zones.

### Bundled super-edge
A render-level aggregated edge representing many same-destination edges between collapsed clusters or zones.

## 15.5 Temporal states

Every graph element should support:

- unseen
- entering
- active
- cooling
- historical
- highlighted
- selected
- suppressed by filter

## 15.6 Spatial strategy

The layout must communicate meaning, not just reduce overlap.

Recommended layout rules:

- process lineage radiates outward from root causal centers
- directories/zones act as neighborhoods or sectors
- outbound network space occupies a clearly separate region
- container/namespace boundaries should render as explicit structural boxes or panes when detected honestly
- “outside allowed root” space must be visibly distinct
- recent activity moves with visual energy; historical paths dim and recede

## 15.7 Cluster policy

The graph engine should support:

- semantic clustering by directory/zone
- process subtree clustering
- density-aware cluster contraction at zoomed-out scales
- expansion on focus
- separate clustering treatment for local IPC neighborhoods versus true network endpoints

## 15.8 Dynamic level-of-detail (LOD) system

The viewer may not attempt to render every entity at full geometric fidelity under all scene sizes.
A dynamic LOD system is mandatory.

LOD requirements:

- when zoomed out, dense subtrees or dense file neighborhoods may collapse into an explicit density-cluster surrogate
- the surrogate must preserve total activity mass, recent activity state, and anomaly emphasis
- as the camera approaches or the user focuses a region, the cluster must unpack deterministically into smaller clusters or individual entities
- selection, replay, and inspector identity may not become incoherent when crossing LOD boundaries
- when clusters collapse, edges targeting the same destination cluster or zone must bundle into truthful super-edges rather than exploding into unreadable hairballs
- bundled edges must preserve aggregate count/mass and destination truth in the inspector
- LOD collapse is a visual/state optimization, not a truth rewrite
- cluster surrogates must disclose that they are aggregated scene representations, not canonical entities

---

# 16. Risk and emphasis engine

## 16.1 Philosophy

Glass is not a policy engine first.
But it does need a derived emphasis layer so the scene highlights what matters.

This is a **meaning overlay**, not a legal verdict system.

## 16.2 v0 emphasis conditions

Must support at least:

- first outbound network attempt
- failed outbound network attempt
- process fanout spike
- high write concentration in short window
- first access outside watched root
- hidden/system directory access
- suspicious rename/delete cluster
- unusually broad file touch spread
- root process termination after large blast radius
- high-value-target credential or secret file touch

## 16.2A High-value-target (HVT) file touch policy

Glass must maintain a compact, reviewable high-value-target path ruleset for the most important local secret and credential surfaces.

Examples include:

- `.env`
- `~/.aws/credentials`
- `~/.ssh/id_rsa`
- `~/.ssh/config`
- `.npmrc`
- other explicitly declared credential-like surfaces frozen in the shipped ruleset

HVT rules:

- HVT emphasis is distinct from a generic boundary-crossing warning
- a read of an HVT path may be more severe than a write outside the watched root
- the inspector must explain **why** the touched path was considered high value
- path matching must be bounded and explainable, not heuristic magic
- the shipped HVT list must remain compact, explicit, and reviewable
- the shipped ruleset is frozen at v0 in a compact file such as `collector/config/hvt_rules.toml` or equivalent
- operators may opt out of default HVT emphasis or provide narrowly-scoped custom overrides without changing the shipped default list
- the v0 ruleset should remain narrow, on the order of twenty patterns or fewer, and must never become a general secret-detection engine
- README and inspector copy must state clearly that HVT emphasis is heuristic and may produce false positives; it is not a secret scanner

## 16.3 Emphasis outputs

The engine may emit:

- severity band
- explanation label
- affected entity ids
- start/end time window
- visual style cue ids

## 16.4 Hard rule

Every emphasis must be explainable in the inspector.

Example:

> highlighted because process `proc_4482` wrote 37 files outside `zone_project` within 2.4 seconds after spawning 5 child processes

If a highlight cannot be explained, it is not allowed.

---

# 17. Replay engine

## 17.1 Replay is mandatory

Replay is not a nice-to-have.
It is one of the defining product features.

Without replay, Glass is only a live monitor.
With replay, it becomes a truth surface.

## 17.2 Replay requirements

- pause
- play
- scrub
- step forward/backward
- jump to highlight
- jump to first anomaly
- jump to selected entity lifecycle
- change playback speed
- recent history windowing
- toggle between chronological playback and causal stepping

## 17.2A Replay stepping modes

Glass replay must support two operator-readable stepping modes:

### Chronological playback
Events are rendered according to recorded time spacing, optionally scaled by playback speed.

Use this when the operator wants to feel real pacing, dead time, and burst onset.

### Causal stepping
Replay advances event-by-event or burst-by-burst, collapsing inert dead time between meaningful transitions.

Use this when the operator needs to cognitively walk through a violent burst sequence without hundreds of milliseconds or seconds of inactivity wasting attention.

Rules:

- the active stepping mode must be visibly indicated in the replay shell
- causal stepping may compress dead time, but it may not reorder events
- causal stepping must preserve exact event ordering and declared burst grouping
- aggregated bursts must remain explainable as bursts, not expanded into invented micro-events
- switching modes must not invalidate selected entities, inspector state, or anomaly jump targets

## 17.3 Replay determinism

Given the same recorded session and same schema version, replay must reconstruct the same event order and materially equivalent scene behavior.

## 17.4 Replay caches

To preserve performance, Glass may maintain:

- periodic graph snapshots
- keyframe indexes
- precomputed layout states
- event-window caches

But these are derived artifacts.
The session event log remains the authority.

---

# 18. Bridge / local API

## 18.1 Purpose

The bridge is the unprivileged local communication surface between collector/session engine and browser viewer.

## 18.2 Responsibilities

- serve local viewer assets or coordinate with local dev server
- provide session list and metadata
- provide current snapshot
- stream deltas to viewer
- translate session-monotonic event time into a viewer-relative live timebase without rewriting causal order
- provide replay pack loading endpoints
- expose bounded inspector queries

## 18.3 Recommended transport shape

- local HTTP for control and asset serving
- WebSocket or equivalent streaming channel for live deltas
- authenticated local IPC between privileged collector and unprivileged bridge
- binary payload support for performance-critical scene data

## 18.4 Hard rules

- no cloud required for v0
- no remote internet dependency for local use
- no hidden exfiltration
- all bound ports and permissions documented
- unsupported browsers fail clearly
- the bridge must bind to loopback only by default
- the browser-facing bridge must run unprivileged and must never inherit eBPF/root privileges for convenience
- privileged collector IPC must not be directly browser-reachable
- all non-static endpoints must require an ephemeral launch/session token unless the operator explicitly starts an insecure dev mode
- CORS must reject all origins except the exact local viewer origin(s) declared for the current run
- requests without the expected origin and token must fail closed
- the bridge must not accept wildcard cross-origin access for convenience

---


# 18A. Local API contract

## 18A.1 Control endpoints

Suggested v0 local control surface:

Authentication rule:

- all non-asset API calls require `Authorization: Bearer <launch_token>` or equivalent secured handshake credential
- WebSocket upgrades must validate the same credential
- launch tokens must be ephemeral and generated per daemon/viewer launch

Suggested v0 local control surface:

- `GET /api/health` — bridge and viewer health
- `GET /api/capabilities` — browser/runtime capability summary
- `GET /api/sessions` — session list
- `GET /api/sessions/{session_id}` — session manifest
- `POST /api/sessions/start` — begin live capture for declared target
- `POST /api/sessions/{session_id}/stop` — end capture
- `GET /api/sessions/{session_id}/snapshot` — current graph/session snapshot
- `GET /api/sessions/{session_id}/events` — bounded event fetch by time/seq window
- `GET /api/sessions/{session_id}/entities/{entity_id}` — inspector details
- `GET /api/sessions/{session_id}/timeline` — timeline density + anomaly markers
- `POST /api/replay/load` — load replay pack

## 18A.2 Streaming channel

Suggested v0 stream event classes:

- `session_started`
- `event_batch`
- `entity_patch`
- `graph_patch`
- `emphasis_patch`
- `timeline_patch`
- `clock_sync`
- `resync_hint`
- `session_stopped`
- `collector_warning`
- `bridge_warning`

## 18A.3 API rules

- all snapshot APIs must be bounded
- no endpoint should dump an unbounded session accidentally
- stream payloads should support compact binary-friendly transport where practical
- API and stream messages should have explicit versions
- replay mode must not require the live streaming channel to function
- live viewers must receive enough timebase metadata to animate decay/cooling correctly without treating browser wall clock as authoritative session time
- if a viewer falls behind beyond a declared threshold due to tab throttling, event-loop blockage, or network stall, it may discard queued deltas, enter a visible `Resyncing…` state, fetch a fresh bounded snapshot, and resume from a new stream cursor rather than replaying an unbounded backlog
- bridges must support that stale-state resync path without requiring session restart
- failed auth, invalid origin, rejected handshake attempts, and unrecoverable IPC drop events should be logged locally for diagnostics

# 19. Viewer shell

## 19.1 Viewer mission

The viewer must deliver the entire emotional and practical value of Glass.

It must feel:

- exact
- fast
- expensive in the best sense
- sober
- beautiful
- useful under pressure

The status bar must always show the active fidelity tier, such as `Full eBPF` or `Fallback Mode — Reduced Visibility`.
That indicator should be visually obvious, ideally color-coded, without becoming alarm spam.
Clicking or opening that fidelity indicator must reveal the manifest-backed explanation of adapter choice, missing event classes, and current visibility limits.
All live motion, decay, and cooling must use the session-relative timebase so scenes remain temporally accurate even under heavy load or browser throttling.

## 19.2 Mandatory viewer modes

### Live mode
Real-time execution scene.

### Replay mode
Timeline control over recorded session, including chronological playback and causal stepping.

### Risk mode
Prioritized emphasis / anomaly reading mode.

### Inspect mode
Detailed entity and causality inspection.

## 19.3 Viewer shell layout

Recommended layout:

- central spatial scene
- left or right compact inspector panel
- bottom timeline / replay strip
- top minimal status/control bar
- optional contextual overlays

The scene must dominate.
The product is not a panel zoo.

## 19.4 Mandatory viewer capabilities

- orbit/pan/zoom camera
- click/select entities and edges
- hover previews
- filter by event/entity type
- focus selected entity lineage
- isolate selected process subtree
- show zone boundaries
- show network links
- search entity/path/process name
- jump to event timestamp
- export screenshot/video-friendly views
- recenter / frame-all action that reliably returns the operator to the active graph
- quick access to manifest-backed fidelity and sanitization status for the active session
- documented keyboard shortcuts for replay and orientation actions
- hold-to-isolate X-Ray causality focus mode for the selected entity lineage and blast radius
- stale-state detection and bounded resync to fresh snapshot after background-tab throttling or severe live backlog
- optional disciplined sonification layer for replay/live scenes, muted by default and never required for comprehension

## 19.5 Orientation aids and lost-operator recovery

The viewer must provide at least one reliable orientation aid so the operator cannot become lost in empty space while navigating a dense Glass scene.

Accepted implementations:

- a structural minimap showing a simplified 2D density proxy and current camera footprint
- a persistent `Frame All` / `Recenter` command with a documented keybind, default `F`
- both, which is preferred

Rules:

- orientation aids are navigation tools, not alternate truth sources
- minimap views may simplify density but must not fabricate hidden entities
- recenter must frame the active graph or current anomaly focus, not merely reset camera coordinates

## 19.6 X-Ray causality focus mode

Glass should support a high-narrative focus mode for dense scenes.

Recommended default interaction:

- hold `Space` (configurable) to enter X-Ray focus for the selected entity

Behavior rules:

- all unrelated nodes and edges may dim to very low opacity, around five percent, while direct upstream lineage and downstream blast radius remain legible
- X-Ray mode is a temporary focus aid, not a mutation of the underlying graph
- inspector truth, counts, and causality must remain identical with or without X-Ray active
- X-Ray should be fast enough to use while recording GIFs or investigating a violent scene without visible stutter

## 19.7 Optional audio sonification

Glass may include a highly disciplined Web Audio layer as an optional augmentation for replay and live scenes.

Rules:

- audio is optional, muted by default, and must require normal browser-allowed user activation where needed
- sound may never be the only channel carrying important meaning; Glass must remain fully usable muted
- generic UI click spam is forbidden
- process spawns may map to low restrained thuds, bursty file activity to subtle texture/static, and HVT or boundary-crossing moments to sharper, clearly rarer cues
- sonification must stay sparse, structural, and tasteful; if it becomes cheesy, it should ship disabled or not ship at all
- reduced-motion and quiet-mode preferences should have a compatible no-audio path

---

# 20. WebGPU renderer

## 20.1 Renderer decision

Glass is **WebGPU-first**.

There is one flagship rendering path.
The repo should not dilute its best effort across compromised renderer implementations in v0.

## 20.2 Why WebGPU

WebGPU is the right choice because Glass needs:

- massive instancing
- high-throughput buffer updates
- layered multi-pass rendering
- precise picking
- future compute-based layout, LOD, or emphasis support
- visual ceiling high enough to make the repo unforgettable

## 20.3 Renderer architecture

### Render stages

1. scene data upload / staging
2. layout state update
3. opaque geometry pass
4. edge and trail pass
5. highlight / halo pass
6. label / overlay pass
7. post-processing pass (minimal and disciplined)

## 20.4 WebGPU design rules

- scene graph and render graph are separate concepts
- render pipeline state must be explicit
- entity ids for picking must be stable
- LOD transitions must preserve stable selection and inspection identity
- GPU buffers should be pooled and reused where possible
- text/labels should be sparse and readable, never dominant
- post-processing must support the information model, not bury it

## 20.5 Instancing strategy

Use GPU instancing for high-count classes:

- file nodes
- event particles/trails where used
- repeated markers
- clustered edge glyphs

## 20.6 Picking strategy

Accurate picking is required.
Recommended approach:

- dedicated ID buffer pass or equivalent stable picking strategy
- entity id round-trip back to inspector
- exact selected object identity preserved during replay

## 20.7 Motion system

Motion is part of meaning.

Allowed motion semantics:

- event pulses
- edge travel direction
- cooling/decay over time
- focus transitions
- replay movement
- anomaly flare onset

Disallowed motion semantics:

- decorative floating particles with no meaning
- fake hologram clutter
- arbitrary interface wiggle
- “AI ambience” nonsense

## 20.8 Post-processing rules

Use post-processing carefully.
Allowed:

- restrained bloom for active importance
- depth cueing
- temporal trails where semantically meaningful
- subtle fog or spatial depth separation
- restrained refraction / frosted-glass treatment for zone and cluster boundary surfaces only

Disallowed:

- overblown blur
- washed-out neon fog everywhere
- unreadable lens effects
- cheesy sci-fi overlays

---

# 21. Visual language system

## 21.1 Aesthetic doctrine

Glass must not look like a generic AI website, generic cyberpunk toy, or templated startup control panel.

The visual language should feel like:

- a dark architectural instrument
- a flight recorder
- a machine atlas
- a high-end forensic operator surface
- glass used as structure, not decoration

## 21.2 Color system

Use a restrained palette.
Suggested logic:

- near-black / charcoal background for field and void
- cool white / steel for neutral infrastructure
- cyan or cold electric tone for active healthy activity
- amber/gold for warning transitions
- red/crimson for severe risk or abnormality
- muted secondary tones for historical remnants

No rainbow dashboards.
No constant purple-blue gradient sludge.

## 21.3 Typography

Typography must feel engineered.

Requirements:

- clean sans or technical grotesk family
- no overly trendy futuristic font
- no “AI startup hero font” look
- compact numerical readability
- strong tabular alignment for inspector/timeline text

## 21.4 Shape language

- structural geometry
- sharp or controlled radius, not cartoon pill UI everywhere
- node shapes determined by semantic class
- overlays must feel anchored to data
- zone and neighborhood boundaries may use restrained frosted-glass planes or light refraction so long as the effect improves spatial legibility
- glass-like materials are allowed only where they encode containment, separation, or density

## 21.5 Information density

Glass should be dense but breathable.
The scene carries the magic; the chrome stays disciplined.

---

# 22. Scene grammar

## 22.1 Spatial semantics

The spatial system must be understandable.

Recommended high-level arrangement:

- center / local root space: tracked process root and immediate work neighborhood
- project sectors: watched directories and important project regions
- peripheral outer rings: outside-root or non-project paths
- outbound corridor / boundary zone: network attempts and external destinations
- historical wake: trailing temporal residue for recent causality

## 22.2 Entity appearance rules

### Process
- brightest and most actor-like object
- stable core signature
- visibly “alive” while active

### File
- artifact object with lower salience
- touched files animate when active, recede when historical

### Directory/zone
- larger structural region, frame, or field anchor
- may be rendered as a dim transparent or frosted-glass pane with restrained distortion
- ephemeral or memory-backed zones should read as more volatile and less permanent than project-space zones, using only subtle pulsing or softer-edge cues rather than decorative noise
- not visually mistaken for files

### Network endpoint
- clearly separate spatial class
- outward vector significance

### IPC endpoint
- visibly local, not external
- clustered within the host boundary and near related process neighborhoods unless focus requires separation

## 22.3 Temporal trace rules

Recent activity may leave:

- short trails
- directional impulses
- fading edge intensity
- cooling halos

These traces must reflect actual event timing.

---

# 23. Inspector model

## 23.1 Inspector importance

The inspector is where “impressive visual” becomes “actually useful software.”

## 23.2 Inspector required panels

For a selected entity, show at minimum:

- identity
- type
- current state
- first seen / last seen
- parent/zone context
- recent actions
- upstream causes
- downstream impacts
- reason for current highlight if any

## 23.3 Inspector examples

### Process inspector
- pid / runtime identity
- executable or command label
- lineage path
- child count
- file touch counts
- network attempts
- zone crossings

### File inspector
- canonical path
- zone
- read/write/create events
- originating processes
- recent event timeline

### Orphan actor inspector
- transient actor label
- observed event count
- reason attribution is incomplete, such as expired PID in fallback mode
- best-known zone and time window

### Network inspector
- endpoint label
- attempt/result count
- originating process set
- first/last contact

## 23.4 Explanation standard

Any highlighted object must answer:

- what happened?
- who caused it?
- when did it happen?
- why is this emphasized?
- what changed next?

---

# 24. Timeline model

## 24.1 Timeline role

The timeline must be more than a playback slider.
It is the operator’s temporal control surface.

## 24.2 Timeline requirements

- scrub through event sequence
- view anomaly markers
- view dense activity spans
- jump to first/next/prev anomaly
- jump to selected entity’s lifecycle moments
- zoom timeline density
- play at variable speed

## 24.3 Timeline visual rules

- compact and precise
- anomaly markers clearly distinct
- density view should show “where things happened” without requiring full playback
- text should stay minimal

---

# 25. Demo pack system

## 25.1 Why demo packs matter

Glass’s breakout potential depends heavily on unforgettable demos.

## 25.2 Mandatory v0 demo packs

### Demo 1 — Agent Goes Rogue
An agent starts inside a project root and expands into forbidden or unexpected areas.

### Demo 2 — Spawn bloom
A script unexpectedly fans out subprocesses.

### Demo 3 — Network surprise
A local tool attempts outbound access.

### Demo 4 — File corruption path
A build or script modifies many files across a visible spread.

### Demo 5 — Logs vs Glass
Side-by-side truth surface demonstration.

## 25.3 Demo pack requirements

Each pack should include:

- session capture or deterministic fixture
- walkthrough notes
- exact expected scene behavior
- screenshot/video capture guidance
- known “wow” moments
- a concise checklist of the exact 3–4 moments that should make the viewer say “holy shit”
- a one-command launcher where feasible

## 25.4 Demo authenticity

If a demo is synthetic, it must be labeled as synthetic.
If recorded from real local execution, it should say so.

---

# 26. Performance budgets

## 26.1 Why budgets matter

Glass’s credibility depends on smoothness.
Jank kills both usefulness and awe.

## 26.2 v0 target budgets

These are directional targets for engineering decisions.

A subset of these should later be promoted into public README promises once verified on named hardware.

### Live UI frame target
- 60 FPS on reasonable modern hardware for typical demo sessions
- graceful degradation under heavier scenes
- graceful handling of bursty 10k+ events/sec workloads via aggregation and LOD without dropping below 30 FPS on mid-range development hardware
- LOD plus aggregation should keep pathological bursts such as 50k+ file touches cognitively navigable and visually responsive rather than collapsing into tab death

### Interaction latency
- selection/hover response should feel immediate
- camera interactions must remain smooth

### Collector self-overhead target
- default profiles should keep collector overhead within a clearly documented developer-safe budget
- self-protection should prefer widening aggregation or reducing non-essential work before forced detach
- if Glass must detach for host safety, the operator must get a visible warning and a manifest record rather than a silent stop

### Startup and attach
- initial attach should be fast enough to feel direct, not like opening enterprise software

### Replay response
- scrub and jump operations should avoid long visible stalls for v0-sized sessions

### Collector overhead
- the daemon should remain within declared self-protection budgets on typical developer hardware
- when those budgets cannot be maintained, the daemon must visibly degrade or detach rather than silently harming the host

## 26.3 Performance rules

- no main-thread heavy parsing loops when avoidable
- binary or structured efficient transfer preferred over giant JSON churn
- scene data must be incrementally updated, not fully rebuilt every frame
- layout work must be bounded and profiled
- LOD must reduce scene complexity before browser instability occurs
- aggregation and LOD exist to preserve comprehension and frame stability, not to hide real execution violence
- inspector queries must be bounded and cached appropriately

---

# 27. Layout engine strategy

## 27.1 Layout philosophy

The layout must communicate causality and territory, not merely remove overlaps.

## 27.2 v0 layout approach

Use a deterministic or semi-deterministic layout system combining:

- process tree hierarchy cues
- zone-based sector placement
- local force/spacing refinement
- density-aware collapse at higher zoom levels

## 27.3 Hard layout requirements

- process children should not teleport randomly
- zones should remain spatially meaningful
- selected entities should remain followable through replay
- network region must stay legible and separate
- layout drift must be bounded

## 27.4 Deferred layout ambitions

Reserved for later if warranted:

- GPU compute-assisted layout evolution
- very large graph Barnes-Hut strategies
- more sophisticated dynamic clustering

Those are valid later but not required to ship v0.

---

# 28. Packaging and local operations

## 28.1 Local-first packaging target

Glass should be runnable locally with minimal friction.

Recommended packaging lanes:

- collector daemon binary or packaged executable
- local startup command launching collector + bridge
- browser viewer served locally
- replay pack viewer mode with minimal setup
- headless capture mode for CI, scripts, and unattended runs
- optional clearly labeled synthetic showcase mode for instant viewer evaluation

## 28.2 Quickstart rule

The first public experience must be close to:

1. clone
2. install
3. run one command
4. see a terrifyingly good demo

A replay-pack-only “just show me the scene” path should exist beside the real collector path.

## 28.3 Replay-only packaging

Provide a replay-only mode for users who want the visual experience without collector setup.
This broadens reach while preserving the real local substrate for serious reviewers.
Sanitized share packs should be supported so users can share causality without leaking obvious local secrets or obvious internal network topology.
Replay-only public packs should default toward the share-safe/sanitized lane unless the operator explicitly exports a private pack.

The zero-install static replay viewer is the breakout distribution path and should be treated as such.
It exists to remove adoption friction for screenshots, social links, GitHub visitors, and replay-pack sharing while keeping live capture local-first.

Glass should also ship a zero-install static replay viewer path for breakout distribution:

- a fully static, serverless viewer deployable to GitHub Pages or equivalent
- drag-and-drop `.glass_pack` loading in the browser with no CLI install required
- clear labeling that the static viewer is replay-only and does not perform live host capture
- no automatic upload of dropped packs to remote services
- replay-only drag-and-drop should be fast enough that a first-time visitor can reach a meaningful scene in seconds

Optional launch bonus:

- tiny sanitized micro-pack share links may exist for very small packs or encoded payloads, but only as a bounded convenience path
- encoded-link sharing must never be the primary pack format, must stay clearly size-limited, and must not weaken sanitization defaults

## 28.4 Headless capture mode

Glass must support a headless capture path such as:

- `glass capture --headless --target <cmd or pid> --out <pack.glass_pack>`
- `glass capture --headless --target <cmd or pid> --out <pack.glass_pack> --sanitize`

Headless mode requirements:

- no browser required
- no local bridge required unless explicitly requested
- session capture runs, completes, and emits a replayable `.glass_pack` artifact
- the resulting pack can be opened later in the local viewer or static replay viewer where supported
- `--sanitize` / `--redact` export paths must be available for shareable packs
- sanitized packs must record `sanitized: true` and include a short human-readable summary of what was redacted
- default share-safe sanitization should support user-path masking, command-argument stripping, and masking/hashing of private IP blocks, internal hostnames, local domain suffixes, and sensitive socket names where practical
- sanitized packs should be the recommended path for Reddit, GitHub, or public sharing
- warnings, ceilings, redactions, and incomplete capture conditions must be recorded inside the pack manifest
- when Glass wraps a target command, the wrapped process exit code must be passed through to the host shell after pack finalization; failed builds must still emit the pack and then exit with the original non-zero code
- when wrapping a build or test command, Glass should preserve CI behavior exactly: success stays success, failure stays failure, and the replay pack is a forensic byproduct rather than a semantics change

Primary use cases:

- CI build corruption capture
- overnight local repro jobs
- scripted benchmark runs
- shareable repro bundles

## 28.5 Synthetic showcase mode

A tiny synthetic showcase mode is allowed only under these conditions:

- it is explicitly labeled synthetic everywhere
- it exists to let people test the renderer instantly
- it is never the sole proof of product claims
- real local capture remains the primary product proof

---

# 29. Logging, debugging, and receipts

## 29.1 Internal logging

Glass needs strong developer logs, but user-facing value must not depend on reading them.

## 29.2 Session debug exports

Allow export of:

- session manifest
- normalized event subset
- emphasis events
- selected entity history
- screenshot/video capture metadata

## 29.3 Developer diagnostics

Internal tools should help answer:

- which collector adapter emitted this event?
- why did normalization map it this way?
- why is this entity missing or duplicated?
- why is this highlight active?
- why did layout move this cluster?

---

# 30. Security, privacy, and truth boundaries

## 30.1 Truth boundary

Glass observes and visualizes.
It does not claim complete security coverage in v0.

## 30.2 Privacy rules

- local-first by default
- no hidden telemetry upload
- no cloud dependency required for core use
- any export is explicit
- session packs should be clearly shareable or non-shareable by user choice
- sanitized export must preserve causality while masking obvious local secrets
- default sanitization should at minimum support user-directory masking/hashing and command-line argument value stripping
- default share-safe sanitization should also support masking or hashing private/internal IP blocks, internal hostnames, local domain suffixes, and obvious local socket names where practical
- share-safe exports should include a concise summary of what was redacted so public sharing remains understandable without exposing secrets

## 30.2A Local bridge security hardening

The local bridge is part of the attack surface and must be treated as such.

Required baseline:

- bind to loopback only
- ephemeral per-launch auth token
- exact-origin CORS allowlist
- no wildcard localhost trust
- browser-facing bridge unprivileged by default, with privileged collection isolated behind authenticated local IPC
- bounded unauthenticated static asset surface only
- secure failure behavior on invalid token/origin combinations
- diagnostics for rejected local requests

## 30.3 Safety and scope honesty

The repo must clearly state:

- which hosts/platforms are supported
- which event classes are collected
- which event classes are not collected
- what the system cannot infer
- that emphasis is heuristic/derived, not legal proof of maliciousness

---


# 30A. Known open obligations

These are not failures. They are explicit engineering obligations that must be discharged before or during implementation.

## 30A.1 Core engineering obligations

1. **Linux collection method finalization**  
   The exact split between eBPF, procfs, fanotify/inotify-style watchers, and auxiliary adapters must be finalized early.

2. **Session binary format finalization**  
   The on-disk event segment format needs a frozen v0 choice.

3. **Zone model precision**  
   The exact rules for project root, outside-root, hidden/system, temp/build, network zones, and container namespace zones must be written formally.

4. **Picking/render identity contract**  
   Render-time entity ids and inspector-time ids must be guaranteed identical.

5. **Replay cache strategy**  
   Keyframe cadence and invalidation rules require explicit implementation notes.

6. **Visual regression methodology**  
   Golden-scene capture and tolerance policy must be defined before the final polish phase.

7. **Aggregation threshold tuning**  
   The exact normalization windowing and burst-collapsing thresholds must be frozen and tested against pathological workloads.

8. **Capture ceiling policy**  
   The default rolling-buffer and pause-vs-prune policy must be finalized before public release.

9. **LOD disclosure policy**  
   Density-cluster surrogates, collapse thresholds, and focus-unpack rules must be frozen before public launch so zoomed-out scenes never misrepresent reality.

10. **Sanitization default policy**  
   The default redaction profile must be tested against realistic developer workspaces before share-pack virality is encouraged.

11. **Fallback fidelity contract**  
   The exact user-facing wording and per-adapter behavior for high-fidelity versus reduced-fidelity collection must be frozen before launch so operators never confuse fallback capture for full visibility.

12. **High-value-target ruleset scope**  
   The shipped HVT list must be narrow, reviewable, and jurisdictionally sane; it cannot turn into an unbounded secret-detection heuristic blob.

13. **Replay stepping semantics**  
   Chronological-versus-causal mode transitions, burst stepping granularity, and idle-time compression rules must be finalized before public release.

14. **Self-silencing completeness**  
   The exact process-lineage rules for suppressing collector, bridge, viewer, and helper-process noise must be frozen before launch so the observer cannot recursively amplify itself.

15. **Collector self-protection budget**  
   CPU/RAM overhead ceilings, response thresholds, and degrade-versus-detach rules must be frozen before public release.

16. **Local retention defaults**  
   The default retention window, default global storage budget, and pinning semantics must be finalized before automatic GC is enabled by default.

17. **Privilege separation contract**  
   The exact IPC handshake, credentialing, and failure behavior between privileged collector and unprivileged bridge must be frozen before public launch.

18. **Fallback orphan-actor policy**  
   Ghost PID / orphan-event attribution semantics must be finalized so fallback mode never invents lineage and never drops real but unattributed events silently.

19. **Edge bundling disclosure policy**  
   Super-edge aggregation thresholds, inspector disclosure, and visual encoding rules must be frozen so zoomed-out scenes remain legible without distorting destination truth.

20. **Timebase translation contract**  
   Session-relative monotonic timing, live viewer sync metadata, and decay/cooling behavior must be finalized so live scenes never stutter from cross-domain clock misuse.

## 30A.2 Polish and launch obligations

21. **README top-of-page conversion path**  
   The hero clip, Try the Demo block, and one-click replay path must be tested together on a clean machine before launch.

22. **Share-safe pack UX**  
   Sanitized exports must show understandable redaction summaries so operators feel safe posting them publicly.

23. **Public sanitization verification**  
   At least one realistic shareable pack must be checked for obvious path, argument, IP, hostname, and socket leaks before launch-day virality is encouraged.

24. **Demo naming consistency**  
   Public and repo-visible demo names such as Agent Goes Rogue, Spawn Bloom, and Logs vs Glass must be consistent across README, folders, and release assets.

# 31. Testing strategy

## 31.1 Testing philosophy

Glass must feel difficult because it is difficult.
That means tests are mandatory.

## 31.2 Test categories

### Schema tests
- event version validity
- serialization/deserialization
- backward compatibility fixtures

### Normalization tests
- raw event to normalized event mapping
- unknown handling
- path canonicalization
- network event attempt/result distinction
- burst aggregation correctness
- no-loss first-occurrence preservation under aggregation
- fallback-substrate normalization parity where equivalent events are available
- ghost PID / orphan-event handling in fallback mode
- self-silencing suppression correctness
- self-silencing completeness and evasion resistance under helper and namespace scenarios
- known-agent signature matcher correctness, disable path, and ambiguity refusal behavior

### Identity tests
- pid reuse resistance
- orphan-actor merge behavior when later evidence resolves identity
- rename continuity
- zone assignment correctness
- entity dedupe behavior
- inode-first dedupe across symlink/hardlink aliases when adapter metadata supports it

### Session engine tests
- append ordering
- corruption detection
- replay reconstruction
- index consistency
- storage ceiling enforcement
- pause/prune behavior under runaway capture
- manifest fidelity-tier recording
- local retention GC respects pinned sessions and declared budgets
- headless wrapped-command exit code is preserved after pack finalization
- sanitization round-trip preserves causality while masking sensitive paths
- share-safe export masks private IPs, internal hostnames, and sensitive socket names where policy requires

### Graph engine tests
- node/edge construction
- cluster rules
- active/historical state transitions
- selected entity stability through replay
- IPC endpoint clustering correctness
- dynamic LOD collapse/expand determinism
- edge bundling correctness under collapsed clusters
- container-boundary zone rendering semantics
- ephemeral / memory-backed zone separation semantics

### Replay tests
- chronological playback preserves recorded spacing semantics
- causal stepping preserves event ordering while compressing dead time
- burst-by-burst stepping behaves deterministically
- anomaly jumps land on equivalent frames in both stepping modes
- live-mode timebase translation preserves ordering and smooth decay semantics
- golden scenes must pass in both chronological and causal replay modes

### Emphasis tests
- first network attempt detection
- boundary crossing detection
- fanout spike detection
- HVT file-touch detection
- HVT ruleset file remains within declared narrow scope
- HVT opt-out/custom override behavior
- explanation string/data correctness

### Viewer tests
- mode switching
- basic interaction
- picking correctness
- timeline behavior
- inspector display correctness
- resource overlay rendering correctness
- LOD surrogate disclosure correctness
- recenter / frame-all correctness
- minimap density proxy stays truthful if minimap is enabled
- fidelity indicator opens manifest-backed explanation correctly
- stale-tab resync drops backlog and re-baselines cleanly
- X-Ray causality focus isolates lineage/blast radius without corrupting inspector truth
- optional sonification remains sparse, off-by-default, and semantically mapped when enabled
- zone glass-surface rendering remains legible and non-gimmicky

### Visual regression tests
- golden-scene snapshots for demo packs
- major scene composition consistency
- color/state mapping regression detection

### Performance tests
- replay throughput
- scene update scaling
- selection latency under load
- render FPS under demo packs and stress fixtures
- collector overhead stays within declared profile or emits self-protection warnings/detach behavior
- privilege-separation IPC survives load or fails closed with explicit warning
- static replay viewer opens sanitized packs without network upload or runaway memory behavior

## 31.3 Golden scene testing

Glass should maintain golden scene fixtures for at least the main demo packs.
This is important because visual regressions in a repo like this are product regressions, not just cosmetic regressions.

---


# 31A. Acceptance tests for launch demos

Each primary demo pack must have a formal acceptance checklist.

## Demo acceptance template

- collector starts successfully on target environment
- session capture begins from documented command
- expected root process is visible
- expected highlight moment occurs
- timeline marker appears at correct window
- inspector explanation matches expected causal chain
- replay from saved pack reproduces the key moment
- screenshot/video capture path works without UI corruption

## Mandatory demo assertions

### Agent Goes Rogue
- first out-of-zone read/write is visible
- blast radius expands in a visually obvious way
- inspector names the zone crossing reason
- the first side-by-side clip frame communicates “the agent left its lane” without narration

### Spawn bloom
- child process branch count is correct
- subtree isolation mode works
- fanout emphasis triggers at expected threshold
- aggregated bursts do not erase the visual violence of the bloom

### Network surprise
- first outbound attempt is visible as a distinct event
- result state is correctly represented
- originating process is unambiguous

### Corruption path
- write order can be followed
- touched region count is visible
- replay jump to first destructive cluster works

### Logs vs Glass
- side-by-side recording clearly demonstrates superior legibility
- same execution window is shown in both views
- Glass explanation requires materially less interpretation effort

# 32. Engineering quality gates

## 32.1 v0 merge gate

A major feature should not be considered complete unless:

- schema impact is documented
- replay impact is tested
- inspector behavior is implemented or updated
- demo impact is understood
- performance impact is measured if relevant
- current limitations are documented

## 32.2 release gate for public launch

Public launch requires:

- real local collector working on declared target
- viewer stable in live mode
- viewer stable in replay mode
- three to five polished demo packs
- at least one one-click demo or replay pack path
- one-command quickstart
- headless capture path working for at least one documented workflow, including exit-code passthrough on target failure
- at least one publicly shareable sanitized pack path verified end-to-end with no obvious path, argv, private-network, or socket leaks
- privilege separation between collector and browser-facing bridge verified on the declared high-fidelity target
- README with powerful video/GIF proof
- limitations section
- architecture section
- screenshots that do not look fake
- acceptable performance on target hardware
- zero-install static replay path verified if publicly advertised
- hero clip and one-click demo path tested together on a clean machine

---

# 33. README and public artifact requirements

## 33.1 README order

The public README is a launch weapon, not a compliance artifact.

Required order:

1. one 8–12 second terrifying GIF/video of **Agent Goes Rogue**
   - required caption under the hero: `Watch the agent leave its lane in real time.`
2. one-line tagline
3. three hard-hitting bullets
4. **Try the Demo** block
5. one-command quickstart
6. one-click demo pack / replay pack path
7. “Why this exists” paragraph
8. “What Glass is NOT” section
9. demo scenarios
10. technical credibility section
11. architecture sketch
12. known limitations table
13. contributor guide links

Required default tagline candidate:

**Watch what your code and agents actually do.**

Required default bullets:

- See every file read, process spawn, and network attempt live
- Replay any execution like a security camera
- Instantly understand blast radius and suspicious behavior

Required Try the Demo content:

- one-command quickstart such as `glass demo` or `glass replay --pack agent-goes-rogue.glass_pack`
- one-click replay-pack download path hosted in-repo, in releases, or equivalent obvious location
- **Zero-install static replay viewer** — just drag and drop a `.glass_pack` (no install required)
- if the static viewer exists, the first public pack should stay small enough for frictionless download and offline playback

## 33.2 README language rules

Avoid:

- abstract AI buzzwords
- “revolutionary platform” fluff
- fake enterprise claims
- vague security promises
- startup copywriting sludge

Use:

- specific visible claims
- exact scope
- strong demo explanation
- clean technical honesty
- slightly sharp emotional language where it helps explain why the product exists

## 33.3 Public laws

The README should expose a condensed five-law version of the doctrine:

1. Reality First — if it is not real telemetry, it is not product truth.
2. Legibility Wins — the product exists to make execution understandable fast.
3. Beauty Must Mean Something — every visual effect must encode real behavior.
4. Local First — the core experience works on one machine with no cloud dependency.
5. Honest Boundaries — support and limitations are stated plainly.

## 33.4 Video rule

The first launch clip is a first-class engineering requirement.
The repo should be built with that clip in mind.

Mandatory launch clips:

- Agent Goes Rogue
- Logs vs Glass side-by-side
- Spawn bloom or corruption path

## 33.5 Technical credibility section

The README must have a compact section that explicitly calls out the hard engineering:

- normalized event schema
- stable identity model
- deterministic replay
- aggregation buffer for pathological event storms
- local bridge security posture
- WebGPU rendering architecture
- bounded session ceilings
- local IPC capture where supported
- inode-first file identity on Linux (merges symlinks/hardlinks correctly when metadata is available)
- headless capture with exit-code passthrough for CI and scripted runs
- automatic stale-state resync so background-tab throttling does not destroy the live scene
- X-Ray causality focus mode for instant blast-radius and lineage isolation during investigation

This is for engineers deciding whether the repo is real or cosplay.

## 33.6 Known limitations table

The README must include a brutally honest limitations table covering at least:

- currently supported OS/runtime targets
- unsupported browsers
- incomplete event classes
- current scaling boundaries
- synthetic vs real demo distinctions
- installation/runtime prerequisites such as Linux kernel, browser WebGPU support, and privilege expectations for high-fidelity mode
- explicit note that high-fidelity mode benefits from elevated privileges, while fallback mode is always available with reduced attribution detail

## 33.7 Contributor growth surface

Early public docs must include links to:

- collector adapter guide
- event schema guide
- replay pack format guide
- visual regression / golden-scene workflow

---

# 34. What Glass must not become

Glass must not drift into:

- generic panel-heavy admin UI
- shallow shader art project
- fake security theater
- replacement for full eBPF security tools such as Falco; Glass visualizes and explains, it does not enforce
- totalizing cloud observability architecture before launch
- generic “AI control center” aesthetics
- copycat cyberpunk interface noise
- bloatware scope from day one

If a proposal moves the product toward any of those, it should be rejected.

---

# 35. Open-source breakout strategy constraints

These are not marketing fluff; they affect engineering decisions.

## 35.1 Immediate legibility constraint

A new visitor must understand the value within seconds.

## 35.2 Visible difficulty constraint

The repo must expose difficult engineering in code and product behavior.

## 35.3 Utility constraint

The tool must genuinely help a developer understand execution better than logs alone in at least a few important scenarios.

## 35.4 Screenshot/video superiority constraint
The first screenshots and clips must look obviously custom-built, not AI-template-generated or SaaS-generic.


The software must be unusually screenshotable and clip-worthy without becoming ridiculous.

## 35.5 Code respect constraint

A serious engineer opening the repo should see:

- strong architecture
- narrow honesty
- difficult systems work
- tasteful rendering discipline
- not just a flashy front-end

---

# 36. Glass v0 exact deliverable definition

Glass v0 is complete when all of the following are true:

1. A Linux-first real collector can attach to a bounded local target and capture the declared event set.
2. Raw collector output is normalized into the canonical event schema.
3. A replayable session log is produced and can be re-opened later.
4. The browser viewer renders the session as a spatial graph using WebGPU.
5. The viewer supports live mode, replay mode, inspect mode, and risk mode.
6. The inspector can explain highlighted behavior in plain technical language.
7. Three to five demo packs exist and are polished enough for launch clips.
8. The README and quickstart are strong enough that someone can actually run it.
9. The result feels visually stunning, technically serious, and genuinely useful.

If any of these are missing, v0 is not done.

---


# 36A. Implementation phases

## Phase 1 — schema and session spine

Deliver:

- canonical event schema
- raw-to-normalized mapping contracts
- append-only session storage
- basic replay reconstruction
- fixture and migration tooling

## Phase 2 — collector slice

Deliver:

- Linux-first collector daemon
- bounded event capture for the declared v0 event set
- target attach/start/stop flow
- raw substrate diagnostics

## Phase 3 — graph and emphasis core

Deliver:

- entity identity model
- graph construction
- zone model
- first emphasis rules
- inspector data contracts

## Phase 4 — WebGPU viewer core

Deliver:

- scene shell
- camera and picking
- live mode
- replay mode
- inspector integration
- timeline surface

## Phase 5 — demo pack hardening

Deliver:

- three to five launch-grade demos
- golden scenes
- video/screenshot capture workflow
- README assets

## Phase 6 — launch hardening

Deliver:

- performance pass
- install/packaging pass
- limitations docs
- issue templates
- contribution guide

# 37. vNext ceiling

After v0 lands successfully, Glass may grow into:

- deeper kernel telemetry lanes
- richer source adapters
- larger session history systems
- stronger replay analytics
- more advanced GPU-side layout work
- Arrow-style transport optimizations
- multi-session comparative mode
- distributed topology lanes
- richer profiling overlays

But those belong **after** the breakout build proves itself.

---

# 38. Final engineering judgment

Glass should be built as:

- the visually strongest execution-visibility repo on GitHub
- a real local telemetry system, not fake shaders
- a sober, beautiful machine-behavior atlas
- a product whose usefulness is obvious in real developer pain points
- a codebase strong enough that experienced engineers immediately understand it was hard to build

The correct way to make it explode is not to make it louder.
The correct way is to make it:

- real
- narrow
- stunning
- useful
- exact
- difficult in visible ways

That is the standard.

