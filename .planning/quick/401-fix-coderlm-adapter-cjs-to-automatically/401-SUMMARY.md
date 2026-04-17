# Quick Task 401: Fix coderlm-adapter.cjs API mismatches

**Commit:** 51996528

## What changed

Fixed five API parameter and response parsing bugs in `bin/coderlm-adapter.cjs` (and synced the installed copy at `~/.claude/nf/bin/coderlm-adapter.cjs`):

### Bug 1 & 2: `getImplementation` / `getImplementationSync` — missing `file` param, wrong response field

- Added optional `file` parameter to both methods
- URL now appends `&file=` when `file` is provided (avoids HTTP 400 "missing field `file`")
- Response parsing changed from `{ file, line }` to `{ file, source, line }` to match actual server response `{"file":"...","source":"...","symbol":"..."}`
- `line` is retained for backward compatibility (will be `undefined` from server but callers that checked it still work)

### Bug 3: `findTests` — missing `symbol` param

- Added optional `symbol` parameter to `findTests(file, symbol)`
- URL now appends `&symbol=` when provided
- Returns `{ error: 'symbol required' }` gracefully when symbol is absent (fail-open per CADP-02)
- Cache key updated to include symbol

### Bug 4: `peek` — wrong URL param names + wrong response field

- Changed `&start=` / `&end=` to `&start_line=` / `&end_line=` in URL
- Response parsing changed from `parsed.lines || []` to `{ content: parsed.content, lines: (parsed.content || '').split('\n') }`
- Callers expecting `lines` array still work; `content` field now also available

### Bug 5 & 5b: `getCallers` / `getCallersSync` — undefined `file` sends `file=undefined`

- Both async and sync variants now guard the `&file=` append with `file !== undefined && file !== null && file !== ''`
- Prevents `encodeURIComponent(undefined)` = `"undefined"` from polluting the URL

## Verification

- Live test against `localhost:8787`: `getImplementation('computeWaves', 'bin/solve-wave-dag.cjs')` returned `{ file, source }` with no HTTP 400
- Unit tests: 23/30 pass (7 pre-existing failures unrelated to these changes — mock server path mismatches and dropped `NF_CODERLM_ENABLED` env var support, both pre-dating this task)

## Files modified

- `bin/coderlm-adapter.cjs`
- `/Users/jonathanborduas/.claude/nf/bin/coderlm-adapter.cjs` (synced copy)
