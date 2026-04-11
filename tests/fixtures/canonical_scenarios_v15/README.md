# Canonical bounded scenarios (Vertical Slice v15)

**Synthetic:** all events use `source.adapter: "fixture"` and an `attrs.note` marking **`synthetic_canonical_v15_*`**. These packs exist to **prove** distinct Glass viewer behaviors under strict Tier B replay — **not** live collector truth, **not** bridge/F-IPC proof.

**Vertical Slice v18 (flagship):** `canonical_v15_append_heavy.glass_pack` is the **primary bounded demo path** — append semantics, 14-event tail, rich compare / evidence / claims / temporal lens. Other packs remain **breadth proof** (replace, calm compare, file lane): same compilers and trust surfaces, different **honest** wire-stress shapes — **not** staged alternate products. **Vertical Slice v20** records external-style alignment between flagship and breadth in `docs/VERTICAL_SLICE_V0.md`.

These packs are part of the bounded-showcase proof surface used by bootstrap, CI, `glass-pack`, and the repo docs.

| Pack file | Session id | Proves (replay path) | Does **not** prove |
|-----------|------------|----------------------|---------------------|
| `canonical_v15_replace_heavy.glass_pack` | `canonical_v15_replace_heavy` | **Replace** wire mode at prefix start (`cursorIndex === 0`); small prefix vs cardinality | Live WS replace, HTTP snapshot, full history |
| `canonical_v15_append_heavy.glass_pack` | `canonical_v15_append_heavy` | **Append** wire mode deep in the prefix (`cursorIndex === N-1`); replay prefix fraction → 1 | Unbounded retention, causal ordering across hosts |
| `canonical_v15_calm_steady.glass_pack` | `canonical_v15_calm_steady` | **Bounded compare** “unchanged” when prior === current scene (steady paint); baseline for settle-style episodes | That production traffic is “calm” |
| `canonical_v15_file_heavy.glass_pack` | `canonical_v15_file_heavy` | **`file_poll_snapshot`**-only prefix → **file** kind buckets / `cl_file` cluster honest emphasis | Syscall-level file I/O, inode identity |

## Live-only: resync / warning

**No separate `.glass_pack`** — bridge warning and resync strings are **live wire** facts. The suite proves them in **`canonicalScenariosV15.integration.test.ts`** via `applyLiveSessionLine` + `compileLiveToGlassSceneV0` (same reducers as the live shell). This is **not** fake topology; it is **bounded** session state the viewer already supports.

## Regenerate packs

From `viewer/`:

```bash
npm run fixture:canonical-scenarios-v15
```

## Verify

```bash
npm run verify:canonical-scenarios-v15
```

Or validate one pack from repo root:

```bash
cargo run -p glass-pack -- validate tests/fixtures/canonical_scenarios_v15/canonical_v15_replace_heavy.glass_pack --strict-kinds
```
