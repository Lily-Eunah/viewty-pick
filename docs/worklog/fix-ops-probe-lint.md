# fix/ops-probe-lint

- Date: 2026-07-18
- Branch: `fix/ops-probe-lint`

## Problem

`npm run lint` scanned local underscore-prefixed probe scripts even though the
same files are excluded from Git by `scripts/**/_*`. Local probes containing
deliberately loose types could therefore fail the repository-wide lint gate.

## Change

- Added `scripts/**/_*` to ESLint global ignores.
- Kept the ESLint scope aligned with the existing Git ignore boundary.
- Did not add or modify any local probe script.

## Verification

- Added a temporary ignored probe containing an explicit `any`; full lint
  completed with 0 errors, proving the file was excluded. The fixture was then
  removed.
- `npm run lint` — passed with 15 existing warnings and 0 errors.
- `npm run typecheck` — passed.
- `npm run test:all` — passed.
- `npm run build` — passed; Next.js reported the existing middleware
  deprecation warning.

## Risk

- Any future underscore-prefixed file under `scripts/` will be excluded from
  ESLint, matching the repository's existing decision not to track those files.
