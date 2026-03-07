---
phase: quick-216
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve.md
  - bin/solve-debt-bridge.cjs
  - bin/solve-debt-bridge.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-216]

must_haves:
  truths:
    - "Solve automatically runs observe inline at start to get fresh data before diagnosing"
    - "Solve reads debt.json open/acknowledged entries as remediation input alongside residual vector"
    - "Solve transitions debt entries open->resolving when dispatching remediation and resolving->resolved when residual drops to zero for that entry"
    - "Solve loops until all targeted debt entries are resolved or max iterations reached"
    - "Debt status transitions are persisted to disk after each iteration"
  artifacts:
    - path: "bin/solve-debt-bridge.cjs"
      provides: "Debt ledger status transition logic for solve loop"
      exports: ["transitionDebtEntries", "matchDebtToResidual", "readOpenDebt"]
    - path: "bin/solve-debt-bridge.test.cjs"
      provides: "Tests for debt bridge functions"
      min_lines: 60
    - path: "commands/nf/solve.md"
      provides: "Updated solve skill with debt-aware loop"
      contains: "solve-debt-bridge"
  key_links:
    - from: "commands/nf/solve.md"
      to: "bin/solve-debt-bridge.cjs"
      via: "require in Step 0d and Step 5"
      pattern: "solve-debt-bridge"
    - from: "bin/solve-debt-bridge.cjs"
      to: "bin/debt-ledger.cjs"
      via: "require for readDebtLedger/writeDebtLedger"
      pattern: "debt-ledger"
    - from: "commands/nf/solve.md"
      to: "commands/nf/observe.md"
      via: "inline Skill invocation at Step 0d"
      pattern: "nf:observe"
---

<objective>
Make solve a fully debt-aware loop: it fetches fresh observe data inline, reads debt.json as remediation input, transitions debt entry statuses as it works (open->resolving->resolved), and loops until all targeted entries resolve or max iterations hit.

Purpose: Solve currently operates only on the residual vector from nf-solve.cjs. Adding debt awareness means solve also addresses externally observed issues (GitHub issues, Sentry errors, internal drifts) in the same convergence loop, making it the single "fix everything" command.

Output: Updated solve.md skill with debt integration steps, new bin/solve-debt-bridge.cjs module with status transition logic, tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/solve.md
@commands/nf/observe.md
@bin/observe-solve-pipe.cjs
@bin/observe-debt-writer.cjs
@bin/debt-ledger.cjs
@.planning/quick/215-add-observe-solve-auto-pipe-route-select/215-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create solve-debt-bridge module with status transition logic and tests</name>
  <files>bin/solve-debt-bridge.cjs, bin/solve-debt-bridge.test.cjs</files>
  <action>
Create bin/solve-debt-bridge.cjs — a CJS module that bridges the debt ledger into the solve loop. Use 'use strict', CommonJS, fail-open patterns per coding rules.

Exports:

1. `readOpenDebt(ledgerPath)` — Reads debt.json via `require('./debt-ledger.cjs').readDebtLedger()`, returns entries with status 'open' or 'acknowledged'. Returns `{ entries: [], error: null }` on success, `{ entries: [], error: string }` on failure (fail-open).

2. `matchDebtToResidual(debtEntries, residualVector)` — Maps debt entries to residual vector layer transitions using heuristics:
   - Entries with `formal_ref` starting with a requirement ID pattern (e.g., "REQ-", "ACT-", "CONF-") -> r_to_f layer
   - Entries with `source_entries[].source_type === 'internal'` -> map to the layer matching their `_route` or title keywords (test/formal/doc)
   - Entries from 'github' or 'sentry' sources -> f_to_c layer (external bugs usually indicate code-formal divergence)
   - Returns `{ matched: [{entry, layer, reason}], unmatched: [entry] }`

3. `transitionDebtEntries(ledgerPath, fingerprints, fromStatus, toStatus)` — Reads ledger, finds entries matching fingerprints, transitions their status if current status matches `fromStatus`, writes ledger back. Valid transitions: open->resolving, acknowledged->resolving, resolving->resolved. Returns `{ transitioned: number, skipped: number }`. Uses `writeDebtLedger` for atomic writes.

4. `summarizeDebtProgress(ledgerPath)` — Returns `{ open, acknowledged, resolving, resolved, total }` counts.

Create bin/solve-debt-bridge.test.cjs with vitest tests covering:
- readOpenDebt with valid ledger, empty ledger, missing file (fail-open)
- matchDebtToResidual with mixed entry types (internal, github, sentry, formal_ref)
- transitionDebtEntries: valid transitions, invalid transitions (e.g., resolved->open rejected), missing fingerprints
- summarizeDebtProgress with mixed statuses
- All functions fail-open (no throws on bad input)

Mock debt-ledger.cjs in tests to avoid filesystem dependency.
  </action>
  <verify>cd /Users/jonathanborduas/code/QGSD && npx vitest run bin/solve-debt-bridge.test.cjs</verify>
  <done>All tests pass. Module exports 4 functions. Fail-open behavior confirmed for all error paths.</done>
</task>

<task type="auto">
  <name>Task 2: Add debt-aware observe-inline and status transitions to solve.md</name>
  <files>commands/nf/solve.md</files>
  <action>
Edit commands/nf/solve.md to add three new integration points. The solve skill already has Steps 0-6. Add:

**Step 0d: Inline Observe + Debt Load (after Step 0c, before Step 1)**

Add a new subsection "### Step 0d: Inline Observe Refresh + Debt Load"

Content:
- Run observe inline to get fresh data BEFORE the diagnostic sweep. This ensures debt.json reflects the latest state:
  ```
  Log: "Step 0d: Running inline observe to refresh debt ledger..."
  ```
- Execute observe's core data-gathering steps programmatically (NOT by invoking the full `/nf:observe` skill which prompts the user). Instead, run the observe pipeline directly:
  ```javascript
  const { loadObserveConfig } = require('./bin/observe-config.cjs');
  const { registerHandler, dispatchAll } = require('./bin/observe-registry.cjs');
  const { handleGitHub, handleSentry, handleSentryFeedback, handleBash, handleInternal, handleUpstream, handleDeps } = require('./bin/observe-handlers.cjs');
  const { writeObservationsToDebt } = require('./bin/observe-debt-writer.cjs');

  // Register all handlers
  registerHandler('github', handleGitHub);
  registerHandler('sentry', handleSentry);
  // ... (register all handlers from observe.md Step 3)

  const config = loadObserveConfig();
  // Inject internal source unconditionally
  if (!config.sources.find(s => s.type === 'internal')) {
    config.sources.push({ type: 'internal', label: 'Internal Work', issue_type: 'issue' });
  }

  const results = await dispatchAll(config.sources, {});
  // Handle pending_mcp results same as observe Step 4b

  const allObservations = results.filter(r => r.status === 'ok').flatMap(r => r.issues || []);
  const { written, updated } = writeObservationsToDebt(allObservations);
  ```
  Log: `"Step 0d: Observe refresh complete — {written} new, {updated} updated debt entries"`

- Then load open debt for the solve loop:
  ```javascript
  const { readOpenDebt, matchDebtToResidual } = require('./bin/solve-debt-bridge.cjs');
  const { entries: openDebt } = readOpenDebt('.planning/formal/debt.json');
  ```
  Log: `"Step 0d: {openDebt.length} open/acknowledged debt entries loaded"`
  Store `openDebt` in solve context for use in Steps 3 and 5.

- If `--targets=<path>` was provided in Step 0c AND targets loaded successfully, filter `openDebt` to only entries whose fingerprint matches a target's fingerprint. This scopes debt-driven remediation to the user's selection.

- This step is fail-open. If observe config is missing, handlers fail, or debt read fails, log the issue and proceed to Step 1 with an empty openDebt array.

**Modify Step 3 preamble: Debt-Driven Remediation Context**

After the existing "For each gap type with residual > 0, dispatch in this exact order:" paragraph, add:

"Additionally, after layer-based remediation dispatch, check if any openDebt entries were matched to this layer via `matchDebtToResidual()`. For matched entries, transition their status to 'resolving':
```javascript
const { transitionDebtEntries } = require('./bin/solve-debt-bridge.cjs');
const matched = matchDebtToResidual(openDebt, residualVector);
const resolvingFPs = matched.matched.map(m => m.entry.fingerprint);
transitionDebtEntries('.planning/formal/debt.json', resolvingFPs, 'open', 'resolving');
transitionDebtEntries('.planning/formal/debt.json', resolvingFPs, 'acknowledged', 'resolving');
```
Log: `"Debt: {resolvingFPs.length} entries transitioned to 'resolving'"`"

**Modify Step 5: Debt Resolution Check**

After the existing convergence check logic, add a debt resolution paragraph:

"After the convergence check, resolve debt entries whose associated layers now show zero residual:
```javascript
const { transitionDebtEntries, summarizeDebtProgress } = require('./bin/solve-debt-bridge.cjs');
const postMatched = matchDebtToResidual(openDebt, post_residual);
// Entries whose matched layer now has residual === 0 are resolved
const resolvedFPs = postMatched.matched
  .filter(m => post_residual[m.layer]?.residual === 0)
  .map(m => m.entry.fingerprint);
transitionDebtEntries('.planning/formal/debt.json', resolvedFPs, 'resolving', 'resolved');

const progress = summarizeDebtProgress('.planning/formal/debt.json');
```
Log: `"Debt: {resolvedFPs.length} entries resolved. Ledger: {progress.open} open, {progress.resolving} resolving, {progress.resolved} resolved"`"

Also modify the iteration loop condition in Step 5 to include debt: "Additionally, if openDebt was loaded and any entries remain in 'resolving' status (not yet 'resolved'), treat this as automatable work remaining — continue looping even if the residual vector is stable, up to max iterations."

**Update the argument-hint line** in the YAML frontmatter to add `[--skip-observe]`:
```
argument-hint: [--report-only] [--max-iterations=N] [--json] [--verbose] [--targets=<path>] [--skip-observe]
```

Add to Step 0d: "If `--skip-observe` flag was passed, skip the inline observe refresh and go directly to debt load. This is useful when observe was just run manually."

IMPORTANT: Do NOT remove or modify any existing Steps 0-0c, 1-6. Only ADD Step 0d and APPEND to Steps 3 and 5.
  </action>
  <verify>grep -c 'solve-debt-bridge' /Users/jonathanborduas/code/QGSD/commands/nf/solve.md && grep -c 'Step 0d' /Users/jonathanborduas/code/QGSD/commands/nf/solve.md && grep -c 'skip-observe' /Users/jonathanborduas/code/QGSD/commands/nf/solve.md</verify>
  <done>solve.md contains Step 0d with inline observe + debt load, Step 3 has debt status transitions to 'resolving', Step 5 has debt resolution check and loop condition update. --skip-observe flag documented. All existing steps preserved.</done>
</task>

</tasks>

<verification>
- `npx vitest run bin/solve-debt-bridge.test.cjs` — all tests pass
- `grep 'solve-debt-bridge' commands/nf/solve.md` — module referenced in Steps 0d, 3, and 5
- `grep 'Step 0d' commands/nf/solve.md` — new step exists
- `grep 'transitionDebtEntries' commands/nf/solve.md` — status transitions wired in Steps 3 and 5
- `grep 'skip-observe' commands/nf/solve.md` — flag documented
- `node -e "const m = require('./bin/solve-debt-bridge.cjs'); console.log(Object.keys(m))"` — exports readOpenDebt, matchDebtToResidual, transitionDebtEntries, summarizeDebtProgress
</verification>

<success_criteria>
- Solve skill automatically runs observe pipeline inline before diagnosing (unless --skip-observe)
- Solve reads debt.json open entries and uses them as additional remediation context
- Debt entries transition: open/acknowledged -> resolving (when remediation dispatched) -> resolved (when layer residual hits zero)
- Solve loop continues while resolving debt entries remain (in addition to residual-based convergence)
- All debt operations are fail-open — solve never crashes due to debt ledger issues
- New module has full test coverage via vitest
</success_criteria>

<output>
After completion, create `.planning/quick/216-integrate-solve-with-debt-ledger-auto-fe/216-SUMMARY.md`
</output>
