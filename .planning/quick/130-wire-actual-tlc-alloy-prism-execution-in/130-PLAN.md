---
phase: quick-130
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/run-formal-check.cjs
  - qgsd-core/workflows/quick.md
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "bin/run-formal-check.cjs exists and exits 0 on success, 1 on counterexample, 0 with warning on tool-not-found"
    - "Step 6.3 exists in qgsd-core/workflows/quick.md between Step 6 and Step 6.5, fires only when FORMAL_SPEC_CONTEXT is non-empty"
    - "Step 6.3 passes TLC/Alloy/PRISM result as a structured signal to the verifier at Step 6.5"
    - "Fail-open: if java or prism binary missing, run-formal-check.cjs logs a warning and exits 0 (does not block workflow)"
    - "Installed copy at ~/.claude/qgsd/workflows/quick.md matches qgsd-core/workflows/quick.md"
  artifacts:
    - path: "bin/run-formal-check.cjs"
      provides: "Per-module TLC/Alloy/PRISM runner invoked from Step 6.3"
      min_lines: 100
    - path: "qgsd-core/workflows/quick.md"
      provides: "Updated workflow with Step 6.3 post-execution formal check"
      contains: "Step 6.3"
  key_links:
    - from: "qgsd-core/workflows/quick.md Step 6.3"
      to: "bin/run-formal-check.cjs"
      via: "node bin/run-formal-check.cjs --modules=<module-list>"
      pattern: "run-formal-check"
    - from: "bin/run-formal-check.cjs"
      to: "formal/tla/tla2tools.jar"
      via: "java -jar formal/tla/tla2tools.jar tlc2.TLC"
      pattern: "tla2tools"
    - from: "Step 6.3 result"
      to: "Step 6.5 verifier"
      via: "FORMAL_CHECK_RESULT env var or log line parsed by verifier"
      pattern: "FORMAL_CHECK_RESULT"
---

<objective>
Wire actual TLC, Alloy, and PRISM execution into the quick --full workflow.

Purpose: The current --full workflow injects invariants into the planner and verifier for static
analysis, but never executes the model checkers. This task makes model checking real: after the
executor completes (Step 6), a new Step 6.3 runs the applicable formal tools and surfaces
counterexample or pass signals to the verifier at Step 6.5.

Output:
- bin/run-formal-check.cjs — lightweight per-module runner (not the full suite runner)
- qgsd-core/workflows/quick.md — Step 6.3 added + installed copy synced
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@qgsd-core/workflows/quick.md
@formal/spec/quorum/invariants.md
@bin/run-tlc.cjs
@bin/run-alloy.cjs
@bin/run-prism.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/run-formal-check.cjs</name>
  <files>bin/run-formal-check.cjs</files>
  <action>
Create a new Node.js CJS script at bin/run-formal-check.cjs. This is a LIGHTWEIGHT per-module
runner — NOT a replacement for bin/run-formal-verify.cjs (the full suite runner). It accepts a
list of module names matching formal/spec/ subdirectory names and runs only the checks relevant
to those modules.

CLI interface:
  node bin/run-formal-check.cjs --modules=quorum,tui-nav

The module-to-check mapping (hardcoded — do not auto-discover from file system):

  quorum:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCliveness.cfg formal/tla/QGSDQuorum.tla -workers 1
    - Alloy: java -jar formal/alloy/org.alloytools.alloy.dist.jar exec --output - --type text --quiet formal/alloy/quorum-votes.als
    - PRISM: $PRISM_BIN formal/prism/quorum.pm formal/prism/quorum.props (if PRISM_BIN set)

  tui-nav:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCTUINavigation.cfg formal/tla/TUINavigation.tla -workers 1

  breaker:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCbreaker.cfg formal/tla/QGSDCircuitBreaker.tla -workers 1

  deliberation:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCdeliberation.cfg formal/tla/QGSDDeliberation.tla -workers 1

  oscillation:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCoscillation.cfg formal/tla/QGSDOscillation.tla -workers 1

  convergence:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCconvergence.cfg formal/tla/QGSDConvergence.tla -workers 1

  prefilter:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCprefilter.cfg formal/tla/QGSDPreFilter.tla -workers 1

  recruiting:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCrecruiting-safety.cfg formal/tla/QGSDRecruiting.tla -workers 1

  account-manager:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCaccount-manager.cfg formal/tla/QGSDAccountManager.tla -workers 1

  mcp-calls:
    - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC -config formal/tla/MCMCPEnv.cfg formal/tla/QGSDMCPEnv.tla -workers 1

Execution logic for each check:
1. Detect Java: spawnSync('java', ['--version']). If not found or error → log "[run-formal-check] WARNING: java not found — skipping {module} TLC/Alloy check" and mark as skipped (not failed).
2. Run the tool via spawnSync with stdio: 'inherit', timeout: 180000 (3 min cap per check).
3. For TLC: exit code 0 = pass. Non-zero = counterexample or error. Also scan stderr for "Error:" prefix lines.
4. For Alloy: exit code 0 AND no "Counterexample" substring in stdout = pass. Counterexample found = fail.
5. For PRISM: only run if process.env.PRISM_BIN set and binary exists. If not set → log warning, skip (not fail). Exit 0 = pass.
6. Collect results per module: { module, tool, status: 'pass'|'fail'|'skipped', detail }

Output after all checks (always to stdout):
  [run-formal-check] Results: N checks, M passed, K failed, J skipped

Then emit a machine-readable result line (parseable by Step 6.5 verifier):
  FORMAL_CHECK_RESULT={"passed":M,"failed":K,"skipped":J,"counterexamples":["module:tool",...]}

Exit code:
  0 if no failed checks (passed + skipped only)
  1 if any check returned fail (counterexample found or TLC error)

Fail-open guarantee: If java binary missing entirely → all checks are skipped → exit 0 with warning.
PRISM not configured → PRISM checks are skipped → does not affect exit code.

Use spawnSync from 'child_process', fs from 'fs', path from 'path'. No external npm dependencies.
Use __dirname-relative paths for jar files: path.join(__dirname, '..', 'formal', ...).

Pattern: mirror the style of bin/run-tlc.cjs (same Java detection approach, same spawnSync usage,
same [tag] prefix on log lines). Do NOT import from run-tlc.cjs — keep this file self-contained.
  </action>
  <verify>
node /Users/jonathanborduas/code/QGSD/bin/run-formal-check.cjs --modules=quorum 2>&1 | tail -5
# Should print FORMAL_CHECK_RESULT= line and exit (0 if checks pass/skip, 1 if counterexample)
# Also verify fail-open:
node /Users/jonathanborduas/code/QGSD/bin/run-formal-check.cjs --modules=nonexistent-module 2>&1
# Should print warning and exit 0 (unknown module = skipped, not failed)
  </verify>
  <done>
bin/run-formal-check.cjs exists, runs without crashing, emits FORMAL_CHECK_RESULT= line on stdout,
exits 0 on pass/skip-only, exits 1 on counterexample. Unknown modules treated as skipped (exit 0).
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Step 6.3 to quick.md and sync installed copy</name>
  <files>
    qgsd-core/workflows/quick.md
  </files>
  <action>
Edit qgsd-core/workflows/quick.md to insert Step 6.3 between the end of Step 6 (executor) and
Step 6.5 (verifier). The new step must be guarded by FORMAL_SPEC_CONTEXT non-empty.

EXACT INSERTION POINT: After the "Known Claude Code bug" note block and before the line:
  **Step 6.5: Verification (only when `$FULL_MODE`)**

Insert the following section (use the exact text below, preserving markdown formatting):

---

**Step 6.3: Post-execution formal check (only when `$FULL_MODE` AND `$FORMAL_SPEC_CONTEXT` non-empty)**

Skip this step entirely if NOT `$FULL_MODE` or `$FORMAL_SPEC_CONTEXT` is empty.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► FORMAL CHECK (post-execution)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Running TLC/Alloy/PRISM for modules: ${FORMAL_SPEC_CONTEXT.map(f => f.module).join(', ')}
```

Build the module list:
```bash
MODULES=$(FORMAL_SPEC_CONTEXT.map(f => f.module).join(','))
```

Run the formal check script:
```bash
FORMAL_CHECK_OUTPUT=$(node bin/run-formal-check.cjs --modules=${MODULES} 2>&1)
FORMAL_CHECK_EXIT=$?
```

Parse the result line from output:
```bash
FORMAL_CHECK_RESULT=$(echo "$FORMAL_CHECK_OUTPUT" | grep '^FORMAL_CHECK_RESULT=' | cut -d= -f2-)
```

Display the output to the user (stream FORMAL_CHECK_OUTPUT to console).

Store `$FORMAL_CHECK_RESULT` and `$FORMAL_CHECK_EXIT` for use in Step 6.5.

**Route on exit code:**

| Exit code | Meaning | Action |
|-----------|---------|--------|
| 0 | All checks passed or skipped (no counterexample) | Display: `◆ Formal check: PASSED`. Continue to Step 6.5. |
| 1 | Counterexample found | Display: `◆ Formal check: COUNTEREXAMPLE FOUND — see output above`. Store result. Continue to Step 6.5 (do NOT abort — verifier receives this as hard failure signal). |

**Fail-open clause:** If `node bin/run-formal-check.cjs` itself fails to launch (e.g., Node.js error, script not found), log:
```
◆ Formal check: WARNING — run-formal-check.cjs not found or errored. Skipping.
```
Set `$FORMAL_CHECK_RESULT = null`. Continue to Step 6.5 without blocking.

---

After inserting Step 6.3, also update the Step 6.5 verifier prompt to include the formal check
result. Find the verifier Task() call in Step 6.5. In its `files_to_read` block, the formal
context is already injected. ADD the following line to the verifier prompt's `<formal_context>`
section, AFTER the existing formal_context content and before the closing tag:

```
Formal check result from Step 6.3: ${FORMAL_CHECK_RESULT !== null ? JSON.stringify(FORMAL_CHECK_RESULT) : 'skipped (tool unavailable)'}
If failed > 0 in formal check result: treat as a HARD FAILURE in your verification — must_haves cannot pass if a counterexample was found.
```

Also update the success_criteria checklist at the bottom of the file. Find the line:
  - [ ] (--full) Verifier checks invariant compliance and formal artifact syntax

Add AFTER it:
  - [ ] (--full) Step 6.3 formal check ran when FORMAL_SPEC_CONTEXT non-empty; FORMAL_CHECK_RESULT passed to verifier

After editing qgsd-core/workflows/quick.md, sync to the installed copy:
```bash
cp /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/quick.md \
   /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
```
  </action>
  <verify>
# Check Step 6.3 header exists in source
grep -n "Step 6.3" /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/quick.md

# Check FORMAL_CHECK_RESULT reference in verifier prompt
grep -n "FORMAL_CHECK_RESULT" /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/quick.md

# Check success criteria updated
grep -n "Step 6.3" /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/quick.md | wc -l
# Should be at least 3 occurrences (header, skip guard, success criteria)

# Confirm installed copy is in sync
diff /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/quick.md \
     /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
# Should produce no diff
  </verify>
  <done>
qgsd-core/workflows/quick.md contains Step 6.3 (with banner, module list, node invocation, exit
code routing, fail-open clause). FORMAL_CHECK_RESULT is passed to Step 6.5 verifier prompt.
Success criteria checklist updated. Installed copy at ~/.claude/qgsd/workflows/quick.md is
identical to source (diff exits 0).
  </done>
</task>

</tasks>

<verification>
1. bin/run-formal-check.cjs is executable and self-contained (no external npm deps beyond Node stdlib + child_process/fs/path)
2. node bin/run-formal-check.cjs --modules=quorum produces FORMAL_CHECK_RESULT= output line and exits cleanly
3. node bin/run-formal-check.cjs --modules=unknown-module exits 0 with a warning (fail-open)
4. grep "Step 6.3" qgsd-core/workflows/quick.md shows step header, skip guard, and success criteria (3+ lines)
5. diff between source and installed quick.md produces no output
6. The EventualConsensus invariant (from formal/spec/quorum/invariants.md) is not violated: Step 6.3 is fail-open (tool missing = continue, not block), so quorum eventually reaches DECIDED even when formal tools unavailable
</verification>

<success_criteria>
- bin/run-formal-check.cjs exists with TLC/Alloy/PRISM execution for mapped modules
- Script exits 0 on pass/skip, exits 1 on counterexample
- Script is fail-open: missing java or prism binary = warning + skip, not failure
- qgsd-core/workflows/quick.md has Step 6.3 between Step 6 and Step 6.5
- Step 6.3 is guarded by FULL_MODE AND FORMAL_SPEC_CONTEXT non-empty
- FORMAL_CHECK_RESULT variable passed to Step 6.5 verifier prompt
- Installed copy ~/.claude/qgsd/workflows/quick.md matches source (diff clean)
</success_criteria>

<output>
After completion, create .planning/quick/130-wire-actual-tlc-alloy-prism-execution-in/130-SUMMARY.md
</output>
