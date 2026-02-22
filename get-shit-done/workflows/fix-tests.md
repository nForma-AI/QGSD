# fix-tests Workflow

## Overview

Discover → Batch → Execute → Categorize → Dispatch → Iterate loop with circuit breaker lifecycle and
three-condition termination. Phase 21 delivers real AI classification (5-category) and actionable dispatch.

---

## Step 1: Load Existing State (Resume Check)

Run:
```bash
STATE_JSON=$(node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests load-state 2>/dev/null)
```

- If STATE_JSON is `null` or empty: this is a FRESH START — proceed to Step 2.
- If STATE_JSON is a JSON object: this is a RESUME — extract `batches_complete` and `manifest_path`
  from the state, then skip Steps 3-4 (discovery and batching), jump directly to Step 6 starting
  at batch index `batches_complete`.

## Step 2: Disable Circuit Breaker

Run:
```bash
npx qgsd --disable-breaker
```

This writes `{ "disabled": true, "active": false }` to `.claude/circuit-breaker-state.json`.
The breaker MUST be re-enabled on every exit path (normal completion AND error). If the workflow
aborts mid-run, print the re-enable command so the user can run it manually:
`npx qgsd --enable-breaker`

## Step 3: Discover Tests (fresh start only)

Set discovering activity:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  '{"activity":"maintain_tests","sub_activity":"discovering_tests","state_file":".planning/maintain-tests-state.json"}'
```

Run discovery:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests discover \
  --output-file .planning/maintain-tests-discover.json
```

Print: `QGSD fix-tests: Discovery complete — {N} tests found`

## Step 4: Batch Tests (fresh start only)

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests batch \
  --input-file .planning/maintain-tests-discover.json \
  --manifest-file .planning/maintain-tests-manifest.json
```

Parse the manifest to extract `total_batches` and `total_files`.
Print: `QGSD fix-tests: Batching complete — {total_files} tests in {total_batches} batches`

## Step 5: Initialize State (fresh start only)

Build initial state JSON and save:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests save-state \
  --state-json '{"schema_version":1,"session_id":"<ISO timestamp>","manifest_path":".planning/maintain-tests-manifest.json","total_tests":<total_files>,"batches_complete":0,"batch_status":{},"processed_files":[],"results_by_category":{"valid_skip":[],"adapt":[],"isolate":[],"real_bug":[],"fixture":[]},"flaky_tests":[],"iteration_count":0,"last_unresolved_count":<total_files>,"consecutive_no_progress":0,"deferred_tests":[],"categorization_verdicts":[],"dispatched_tasks":[],"deferred_report":{"real_bug":[],"low_context":[]}}'
```

Read `ITERATION_CAP` from `.claude/qgsd.json` path `maintain_tests.iteration_cap` — default 5 if not set.

## Step 6: Batch Loop

For each batch index B starting from `batches_complete` up to `total_batches - 1` (zero-based):

### 6a. Set activity: running_batch

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  '{"activity":"maintain_tests","sub_activity":"running_batch","batch":<B+1>,"batch_total":<total_batches>,"state_file":".planning/maintain-tests-state.json"}'
```

### 6b. Execute batch

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests run-batch \
  --batch-file .planning/maintain-tests-manifest.json \
  --batch-index <B> \
  --output-file .planning/maintain-tests-batch-result.json
```

Read `.planning/maintain-tests-batch-result.json` to get batch results.

If `batch_timed_out: true`: update `batch_status[B+1] = "timed_out"` in state, save state, continue to next batch (do NOT advance `batches_complete`).

### 6c. Set activity: categorizing_batch

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  '{"activity":"maintain_tests","sub_activity":"categorizing_batch","batch":<B+1>,"batch_total":<total_batches>,"state_file":".planning/maintain-tests-state.json"}'
```

### 6d. Categorize confirmed failures (Phase 21 — AI classification)

**Phase 20 stub detection:** Before processing, check if `state.categorization_verdicts` is empty AND any `state.results_by_category` array is non-empty. If true: this is Phase 20 stub state. Clear all category arrays and re-classify:
```bash
# Clear stub: reset results_by_category, categorization_verdicts, deferred_report in state
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests save-state \
  --state-json '<current state with results_by_category all empty arrays, categorization_verdicts=[], dispatched_tasks=[], deferred_report={"real_bug":[],"low_context":[]}>'
```
Print: `QGSD fix-tests: Clearing Phase 20 stub state — re-classifying all failures`

**Sort batch results:**
- `passed_or_skipped` = results where status == "passed" OR status == "skipped"
- `flaky` = results where status == "flaky"
- `confirmed_failures` = results where status == "failed" AND flaky == false

Append `passed_or_skipped` files to `state.processed_files`.
Append `flaky` files to `state.flaky_tests`.

**Skip already-classified failures (resume safety):**
Before classifying a failure, check if `result.file` already appears in any `results_by_category` array OR in `categorization_verdicts[].file`. If found: skip classification, reuse existing verdict for dispatch grouping.

**Context assembly for each confirmed failure:**
For each failure in `confirmed_failures` in groups of 20 (to avoid context overflow):

  1. Read the test file:
     ```
     Read(result.file)  — truncate mentally at 4000 chars if very large
     ```

  2. Extract source file paths from `result.error_summary`:
     - Lines matching pattern: `at .* \((src|lib|app)/` or `File "(src|lib|app)/`
     - Take first 2 unique paths that are NOT node_modules and NOT the test file itself
     - Read each: `Read(stack_path_1)`, `Read(stack_path_2)` — skip if file does not exist

  3. Compute `context_score`:
     - +1 if test file source is non-empty
     - +1 if at least 1 stack trace source file was read successfully
     - +1 if `result.error_summary` is non-null and non-empty
     - Range: 0–3

  4. If `context_score < 2`: add to `state.deferred_tests` AND `state.deferred_report.low_context`. Do NOT classify. Continue to next failure.

**5-category classification (inline Claude reasoning for context_score >= 2):**

For the current group of up to 20 failures with their assembled context, produce a JSON verdict array. Use the following decision rules:

| Category | Classify when |
|----------|--------------|
| `valid-skip` | Test was already skipped/pending in test file source; tests a removed/deprecated feature; checks `process.env.CI` to skip itself |
| `adapt` | Failure caused by a real code change that mutated asserted behavior; error_summary shows assertion mismatch ("expected X got Y") clearly traceable to a code change; no environment dependency |
| `isolate` | Fails only due to environment/ordering dependency with no real code change; error shows missing env var, port conflict, race condition, or depends on another test's side effects |
| `real-bug` | Failure reveals a genuine defect requiring developer judgment; stack trace shows panic/crash/wrong logic not explainable by environment or code change |
| `fixture` | Fails because a fixture file, test data, snapshot, or generated mock is stale/missing/mismatched |

If uncertain: classify as `real-bug` (conservative — better to defer than to auto-action incorrectly).

Produce for each classified failure:
```json
{
  "file": "path/to/test.test.js",
  "category": "<one of the 5>",
  "confidence": "high|medium|low",
  "context_score": "<0-3>",
  "reason": "<one sentence explaining classification>",
  "error_type": "<assertion_mismatch|import_error|snapshot_mismatch|fixture_missing|env_missing|port_conflict|timeout|unknown>",
  "pickaxe_context": null
}
```

Append each verdict to `state.categorization_verdicts`.
Append each file to the matching `state.results_by_category.<category>` array.

**Git pickaxe enrichment for adapt failures (CATG-02):**
After producing verdicts for a group, for each verdict where `category == "adapt"`:

  1. Extract the primary identifier from the test source:
     - Try regex: `describe\(['"](\w[\w\s]+)['"]` → first match
     - Fallback: primary import name from `import .* from ['"](.+)['"]` → last path segment
     - Keep identifier <= 60 chars; strip quotes

  2. Run pickaxe (scoped search first):
     ```bash
     PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
     git -C "$PROJECT_ROOT" log -S"<identifier>" --oneline --diff-filter=M -- src/ lib/ app/ 2>/dev/null | head -10
     ```

  3. If empty, run broader fallback:
     ```bash
     git -C "$PROJECT_ROOT" log -S"<identifier>" --oneline -10 2>/dev/null
     ```

  4. Set `pickaxe_context`:
     ```json
     {
       "identifier": "<identifier>",
       "commits": ["<hash> <message>", "..."],
       "command_run": "git log -S\"<identifier>\" --oneline -10"
     }
     ```
     If git is unavailable or project is not a git repo: set `pickaxe_context = null` — still categorize as adapt.
     If no commits returned: set `commits = []` — still dispatch as adapt (pickaxe is enhancement, not gating).

  5. Update the verdict in `state.categorization_verdicts` with the `pickaxe_context` value.

**Update state after each group of 20:**
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests save-state \
  --state-json '<state with updated results_by_category, categorization_verdicts, deferred_tests, deferred_report>'
```

**Note on dispatch:** Adapt/fixture/isolate dispatch happens in Step 6h (added by Plan 02). This step (6d) only produces verdicts and updates state.

### 6e. Print progress banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► FIX-TESTS: Batch {B+1} / {total_batches} complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Passed: {passed_count}  |  Failed: {failed_count}  |  Flaky: {flaky_count}  |  Skipped: {skipped_count}
 Total classified: {sum(all category arrays)} / {total_tests}
 Iteration: {iteration_count + 1} / {ITERATION_CAP}
```

### 6f. Update state

Increment `batches_complete` by 1.
Update `batch_status[B+1] = "complete"`.
Calculate:
- `classified = len(valid_skip) + len(adapt) + len(isolate) + len(real_bug) + len(fixture)`
- `flaky_count = len(flaky_tests)`
- `unresolved = total_tests - classified - flaky_count`

If `unresolved == last_unresolved_count`:
  increment `consecutive_no_progress` by 1
Else:
  set `consecutive_no_progress = 0`

Set `last_unresolved_count = unresolved`.

If `batches_complete == total_batches`:
  increment `iteration_count` by 1

Save state:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests save-state \
  --state-json '<updated state JSON>'
```

### 6g. Check termination conditions (in this order)

**Condition 1 — All tests classified:**
```
IF unresolved == 0:
  TERMINAL: "all tests classified"
  → break loop, go to Step 7
```

**Condition 2 — No progress in 5 consecutive batches:**
```
IF consecutive_no_progress >= 5:
  TERMINAL: "no progress in last 5 batches"
  → break loop, go to Step 7
```

**Condition 3 — Iteration cap reached (check at end of last batch in iteration):**
```
IF iteration_count >= ITERATION_CAP AND B == total_batches - 1:
  TERMINAL: "iteration cap reached ({ITERATION_CAP} iterations)"
  → break loop, go to Step 7
```

If no terminal condition: continue to next batch (or loop back to batch 0 if `B == total_batches - 1`).
When looping back: increment `iteration_count` by 1 before resetting B to 0.

## Step 7: Re-enable Circuit Breaker

```bash
npx qgsd --enable-breaker
```

This writes `{ "disabled": false, "active": false }` to `.claude/circuit-breaker-state.json`.

## Step 8: Clear Activity State

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  '{"activity":"maintain_tests","sub_activity":"complete","state_file":".planning/maintain-tests-state.json"}'
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-clear
```

## Step 9: Print Terminal Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► FIX-TESTS: Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Terminal condition: {condition}
 Batches run: {batches_complete} / {total_batches}
 Iterations: {iteration_count} / {ITERATION_CAP}

 Results by category:
   valid-skip:  {len(valid_skip)}
   adapt:       {len(adapt)}
   isolate:     {len(isolate)}
   real-bug:    {len(real_bug)}   ← deferred (see report below)
   fixture:     {len(fixture)}
   flaky:       {len(flaky_tests)}
   deferred:    {len(deferred_tests)}   ← context_score < 2
   Passed/skipped: {len(processed_files)}
   Dispatched tasks: {len(dispatched_tasks)}

 State saved to:  .planning/maintain-tests-state.json
 Dispatched:      {len(dispatched_tasks)} quick tasks
```

---

## Error Handling

If any Bash step fails (non-zero exit code):
1. Print: `QGSD fix-tests: ERROR at <step name> — <error output>`
2. Run: `npx qgsd --enable-breaker` (always — do not skip)
3. Run: `node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-clear`
4. Surface the original error to the user

---

## Resume Logic Detail

On a RESUME (STATE_JSON is not null):

1. Skip Steps 3-4 (discover and batch — manifest already exists at `state.manifest_path`)
2. Read `total_batches` from the manifest at `state.manifest_path`
3. Read `ITERATION_CAP` as normal
4. Start batch loop at index `state.batches_complete` (the first un-completed batch)
5. Use state's existing `results_by_category`, `flaky_tests`, `processed_files` as the running totals
6. Do NOT reset `consecutive_no_progress` or `iteration_count` — resume from exact interrupted point

---

## INTG-03 Compliance Note

This workflow MUST NOT call any quorum worker (mcp__gemini-cli__, mcp__codex-cli__, etc.).
It is execution-only. Adding fix-tests to quorum_commands violates R2.1 and will cause the
Stop hook to block every response waiting for quorum that was never dispatched.
