# Post-launch loop (first 72 hours)

Treat the first 72 hours as part of launch quality. Optimize for trust and onboarding clarity, not feature expansion.

## Priority order

1. Broken first-use path: hosted replay, README commands, release links, Pages deploy, CI badge.
2. Trust mismatches: docs/screenshots/UI drift, overclaiming copy, live-mode confusion.
3. Security/reporting friction: unclear private reporting path, issue routing, leaked-sensitive-example risks.
4. Nice-to-have polish that improves first read without changing the product.

## Response cadence

### 0-6 hours

- Confirm the hosted flagship replay opens directly to a loaded session.
- Confirm the GitHub Release, repo homepage, social preview, and CI badge all point at live assets.
- Watch for broken commands, 404s, and browser-console errors on the hosted replay path.

### 6-24 hours

- Triage every issue/comment into: onboarding, trust wording, real bug, or out-of-scope request.
- Fix onboarding and trust-surface problems the same day if the patch is small.
- Defer feature requests unless they unblock first understanding of the shipped bounded showcase.

### 24-72 hours

- Fold repeated confusion into README/UI microcopy.
- Tighten screenshots or release text if readers consistently misread the scope.
- Keep follow-up patches small, exact, and easy to audit.

## Fast patch rules

- Prefer copy fixes, link fixes, and tiny UX clarifications over new features.
- Do not widen the public claim to satisfy launch feedback.
- If a report targets long-horizon or provisional work, label it honestly and keep the shipped surface separate.

## Launch watchlist

- Hosted replay URL loads the flagship pack with `?fixture=flagship`
- `README.md` matches the actual first-run path
- `docs/media/` still matches the shipped viewer
- `SECURITY.md` matches the GitHub security surface
- CI and Pages both stay green after the release tag
