# Glass viewer (Tier B scaffold)

Static **replay-only** shell: drag/drop surface for `.glass_pack`; **no** ZIP decode wired yet; **no** WebGPU.

```bash
npm ci
npm run dev    # local static server
npm run build
npm test
npm run lint
```

Live capture UI is intentionally out of scope for this package until `bridge` serves an API.
