---
description: Isolate TLC metadir per-config to fix 31 in-pipeline F→C failures
formal_artifacts: none
must_haves:
  truths:
    - "run-tlc.cjs uses per-config metadir (states/${configName}) instead of shared states/current"
    - "TLC checks that previously failed in-pipeline now pass"
    - "installed copy at ~/.claude/nf-bin/ is synced if applicable"
  artifacts:
    - bin/run-tlc.cjs
  key_links:
    - bin/run-tlc.cjs:374 (metadir path)
---

# Quick Task 301: Isolate TLC metadir per-config

## Context

When `run-formal-verify.cjs` runs 50 TLC checks sequentially, ~22-31 checks fail despite passing individually. Root cause: all checks share `states/current` as TLC's metadir. Each check does `rmSync + mkdirSync` on this directory. When the JVM from the previous check hasn't fully released file handles, the next check's state files get corrupted, causing rapid failures (257-420ms — faster than JVM cold start).

## Task 1: Per-config metadir isolation

**files:** bin/run-tlc.cjs
**action:** Change line 374 from:
```javascript
const metaDir = path.join(ROOT, '.planning', 'formal', 'tla', 'states', 'current');
```
to:
```javascript
const metaDir = path.join(ROOT, '.planning', 'formal', 'tla', 'states', configName);
```
This gives each TLC config its own isolated state directory, preventing cross-check interference.

**verify:** Run `node bin/run-formal-verify.cjs` and confirm 0 TLA+ failures in check-results.ndjson
**done:** metaDir uses configName, not 'current'
