# chore/eslint-ignore-open-next — worklog

`npm run lint` linted gitignored build output under `.open-next/` (opennextjs-cloudflare
output), emitting hundreds of errors in minified bundles. eslint-config-next ignores
`.next`/`out`/`build` by default but not `.open-next`, so a local `cf:build` left the
dir behind and dirtied lint. CI on a clean checkout (no `.open-next`) was unaffected.

## Change
- `eslint.config.mjs` — add `".open-next/**"` to the existing `globalIgnores` list
  (one line). All other ignores/rules unchanged.

## Tests / build
- `npm run lint` — exit 0 (0 errors; only the pre-existing unrelated warning in
  `scripts/ops/migrate-sheet-dropdowns-brand.ts`). `.open-next/` errors gone.
- `tsc --noEmit` — exit 0. Source lint behavior unchanged (no new errors/warnings).
- Config-only; no source/runtime change, no migration.
