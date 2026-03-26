---
task: 352
title: Add TLC process timeout and model size guards to formal verification spawning
type: fix
risk: low
formal_artifacts: none
files_modified:
  - bin/run-tlc.cjs
  - bin/run-alloy.cjs
  - bin/run-prism.cjs
must_haves:
  - run-tlc.cjs spawnSync has a timeout parameter (default 30min via NF_TLC_TIMEOUT_MS env, fallback 1800000)
  - run-alloy.cjs spawnSync has a timeout parameter (default 10min via NF_ALLOY_TIMEOUT_MS env, fallback 600000)
  - run-prism.cjs spawnSync has a timeout parameter (default 10min via NF_PRISM_TIMEOUT_MS, fallback 600000)
  - When timeout fires, the check result is written as result:'error' with triage_tags including 'timeout-killed' (per write-check-result.cjs schema which only accepts pass|fail|error|warn|inconclusive)
  - run-tlc.cjs caps -workers to NF_TLC_WORKERS env (default '2', not 'auto') to prevent all-core saturation in solve contexts
  - Existing NF_JAVA_HEAP_MAX env var respected (already exists, default 512m)
  - All 3 runner test files still pass after changes
---

# Plan

## Context

`/nf:solve` spawns formal verification via `run-formal-verify.cjs` → `run-tlc.cjs` → `spawnSync(java, ...)`. The `spawnSync` call has NO timeout, so TLC runs indefinitely. When the parent Claude session ends, Java child processes become orphaned. Last night, 6 TLC instances ran for 25+ hours consuming ~1100% CPU total.

## Tasks

### Task 1: Add timeout to run-tlc.cjs

**File:** `bin/run-tlc.cjs`

1. Add at top (after line 17):
   ```js
   const TLC_TIMEOUT_MS = parseInt(process.env.NF_TLC_TIMEOUT_MS || '1800000', 10); // 30min default
   const TLC_WORKERS = process.env.NF_TLC_WORKERS || '2'; // prevent all-core saturation
   ```

2. Change workers assignment (line 369):
   ```js
   // Before:
   const workers = configName === 'MCliveness' ? '1' : 'auto';
   // After:
   const workers = configName === 'MCliveness' ? '1' : TLC_WORKERS;
   ```

3. Add `timeout` to spawnSync (line 382-389):
   ```js
   const tlcResult = spawnSync(javaExe, [...], {
     encoding: 'utf8',
     stdio: 'inherit',
     timeout: TLC_TIMEOUT_MS,
   });
   ```

4. After the spawnSync, detect timeout (signal === 'SIGTERM' when timeout fires):
   ```js
   if (tlcResult.signal === 'SIGTERM') {
     process.stderr.write('[run-tlc] TLC killed after ' + TLC_TIMEOUT_MS + 'ms timeout\n');
     writeCheckResult({
       tool: 'run-tlc', formalism: 'tla', result: 'error',
       check_id, surface, property,
       runtime_ms: _runtimeMs,
       summary: 'timeout: TLC killed after ' + (TLC_TIMEOUT_MS/1000) + 's',
       requirement_ids: getRequirementIds(check_id),
       triage_tags: ['timeout-killed'],
       metadata: { config: configName, timeout_ms: TLC_TIMEOUT_MS }
     });
     process.exit(1);
   }
   ```

### Task 2: Add timeout to run-alloy.cjs

**File:** `bin/run-alloy.cjs`

Same pattern — add `NF_ALLOY_TIMEOUT_MS` (default 600000 = 10min) to the Java spawnSync call. Add timeout detection with result:'error' and 'timeout-killed' triage tag.

### Task 3: Add timeout to run-prism.cjs

**File:** `bin/run-prism.cjs`

Same pattern — add `NF_PRISM_TIMEOUT_MS` (default 600000 = 10min) to the PRISM spawnSync call (line 386). Add timeout detection.

## Verification

- `node --test bin/run-tlc.test.cjs` passes
- `node --test bin/run-alloy.test.cjs` passes
- `node --test bin/run-prism.test.cjs` passes
- Grep for `timeout:` in all 3 files confirms the parameter is present
- Grep for `timeout-killed` confirms triage tag exists in all 3 files
