# Quick Task 301: Summary

## What changed
- `bin/run-tlc.cjs` line 374: changed TLC metadir from shared `states/current` to per-config `states/${configName}`

## Why
When `run-formal-verify.cjs` runs 50 TLC checks sequentially, all sharing `states/current` as the metadir, ~22-31 checks failed despite passing individually. The shared directory caused JVM file handle contention — each check does `rmSync + mkdirSync` before the previous JVM fully releases handles. Per-config isolation eliminates this interference.

## Result
- Before: 198 checks, 22-31 TLA+ failures (pass individually, fail in pipeline)
- After: 198 pass, 0 fail, 1 inconclusive (UPPAAL)
- Pipeline wall-clock: 142s

## Commit
- `fc0141ff` — fix(run-tlc): isolate metadir per-config
