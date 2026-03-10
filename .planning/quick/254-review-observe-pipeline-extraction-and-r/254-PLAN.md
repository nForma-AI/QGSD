---
phase: quick-254
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/observe-pipeline.cjs
  - bin/observe-pipeline.test.cjs
  - commands/nf/solve-diagnose.md
  - commands/nf/observe.md
  - README.md
autonomous: true
requirements: [QUICK-254]
must_haves:
  truths:
    - "observe-pipeline.cjs exports refreshDebtLedger and registerAllHandlers functions"
    - "Handlers are registered with correct names matching observe-handlers.cjs exports"
    - "solve-diagnose.md and observe.md both call registerAllHandlers() from observe-pipeline.cjs"
    - "solve-diagnose.md Step 0d calls refreshDebtLedger() to refresh debt ledger"
    - "observe.md Step 3 calls registerAllHandlers() to register all handlers before dispatch"
    - "README Per-Model Gates section accurately describes gate system and flow"
    - "All edge cases in observe-pipeline.cjs are handled (missing config, empty sources, handler registration)"
    - "Test coverage includes handler registration, config loading, and debt write scenarios"
  artifacts:
    - path: "bin/observe-pipeline.cjs"
      provides: "Shared observe data-gathering pipeline for both /nf:observe and /nf:solve-diagnose"
      exports: ["refreshDebtLedger", "registerAllHandlers", "_nfBin"]
    - path: "bin/observe-pipeline.test.cjs"
      provides: "Test coverage for pipeline exports, handler registration, and debt write"
      min_lines: 70
    - path: "commands/nf/solve-diagnose.md"
      provides: "Diagnostic phase sub-skill with updated Step 0d"
      contains: "refreshDebtLedger"
    - path: "commands/nf/observe.md"
      provides: "Observe skill with handler registration in Step 3"
      contains: "registerAllHandlers"
    - path: "README.md"
      provides: "Public documentation of per-model gates system"
      contains: "Per-Model Gates — Spec-Driven Observability"
  key_links:
    - from: "commands/nf/solve-diagnose.md"
      to: "bin/observe-pipeline.cjs"
      via: "Step 0d calls refreshDebtLedger()"
      pattern: "refreshDebtLedger"
    - from: "commands/nf/observe.md"
      to: "bin/observe-pipeline.cjs"
      via: "Step 3 calls registerAllHandlers()"
      pattern: "registerAllHandlers"
    - from: "bin/observe-pipeline.cjs"
      to: "bin/observe-handlers.cjs"
      via: "Handler registration by name"
      pattern: "handlers\\.handle"
    - from: "bin/observe-pipeline.cjs"
      to: "bin/observe-registry.cjs"
      via: "Registry import and clearHandlers/registerHandler/dispatchAll calls"
      pattern: "registry\\.(clearHandlers|registerHandler|dispatchAll)"
---

<objective>
Code review of the observe-pipeline extraction and related command updates to ensure:
1. Handler registration correctness (names match between observe-pipeline.cjs and observe-handlers.cjs exports)
2. Edge case handling in observe-pipeline.cjs (missing config, empty sources, repeated calls)
3. Test coverage completeness (all paths tested, handler registration verified)
4. Command integration (solve-diagnose.md and observe.md both reference observe-pipeline.cjs correctly)
5. README accuracy (Per-Model Gates section describes system correctly)

Purpose: Verify that the extraction is complete, correct, and ready for production use by both /nf:observe and /nf:solve-diagnose.

Output: Code review report with any fixes needed before shipping.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify observe-pipeline.cjs handler registration and edge case handling</name>
  <files>bin/observe-pipeline.cjs</files>
  <action>
Review the observe-pipeline.cjs file for:

1. **Handler Registration Correctness:**
   - Line 36-62: registerAllHandlers() function should register exactly these handlers: github, sentry, sentry-feedback, bash, internal, upstream, deps, and optional prometheus, grafana, logstash
   - CRITICAL: Handler names MUST match exports from observe-handlers.cjs (check names at lines 376-377 match what's registered at 43-49)
   - Verify: sentry-feedback handler is named 'sentry-feedback' (hyphen, not underscore) — this is the BREAKING POINT if wrong
   - Verify: optional production drift handlers (prometheus/grafana/logstash) use typeof check to avoid "handler not found" errors

2. **Edge Case Handling in refreshDebtLedger():**
   - Line 82-89: Config loading with error path → returns zero-state with configError field (correct)
   - Line 91-110: Source filtering and internal source injection logic:
     * Verify: Internal source injected ONLY if not already present AND not filtered out by sourceFilter
     * Verify: If no sources remain after filter, return zero-state (lines 105-110) — correct behavior
     * Edge case check: What if sourceFilter='internal' but no internal source exists? Should still be injected (line 100-101 handles this correctly)
   - Line 113-118: Handler registration and dispatch:
     * registerAllHandlers() returns registry object
     * dispatchAll() receives sources and options — verify options structure matches registry's dispatchAll signature
   - Line 121-123: Observation filtering by status='ok' — only includes successful results (correct)
   - Line 126-129: Conditional debt write based on skipDebtWrite flag (correct)

3. **Safety for Repeated Calls:**
   - Line 41: clearHandlers() is called before registerHandler() — prevents "already registered" errors on repeated calls to registerAllHandlers() (correct pattern for Step 3 of observe.md)

4. **Return Value Contract:**
   - Lines 131-136: Returns object with { written, updated, errors, merged, linked, observations, results, sourceCount }
   - Verify: This matches the contract expected by solve-diagnose.md Step 0d (line 133 reads { written, updated, sourceCount })
  </action>
  <verify>
Produce a review checklist with pass/fail for each point:
- [ ] Handler names match observe-handlers.cjs exports (sentry-feedback uses hyphen)
- [ ] Optional handlers use typeof check
- [ ] clearHandlers() called before registerHandler()
- [ ] Config error path returns zero-state
- [ ] Internal source injected correctly (no duplicates, respects filter)
- [ ] Empty sources returns zero-state
- [ ] Debt write is conditional on skipDebtWrite flag
- [ ] Return object includes all expected fields

Output the checklist to stdout. If ANY check fails, note the line number and issue.
  </verify>
  <done>Handler registration is correct, sentry-feedback is hyphenated (not underscore), edge cases handled, safe for repeated calls, return contract matches expectations</done>
</task>

<task type="auto">
  <name>Task 2: Verify test coverage and observer-pipeline.test.cjs completeness</name>
  <files>bin/observe-pipeline.test.cjs</files>
  <action>
Review the test file for coverage:

1. **Export Tests (lines 10-24):**
   - Verify: Tests for refreshDebtLedger, registerAllHandlers, _nfBin as functions (correct)

2. **Handler Registration Tests (lines 27-45):**
   - Line 30: registerAllHandlers() called — but handlers.cjs must be available for this to work
   - Issue check: Do the handlers exist at that path? The test depends on bin/observe-handlers.cjs being present
   - Line 31-35: listHandlers() is called on registry — verify that observe-registry.cjs exports this method
   - Potential issue: Test calls registry.listHandlers() but we don't verify registerAllHandlers() returned the right object
   - Line 38-44: Tests repeated calls without throwing — uses clearHandlers() implicitly (good)

3. **refreshDebtLedger() Tests (lines 47-70):**
   - Line 48-58: Tests zero-state with nonexistent source filter (good edge case)
   - Line 60-69: Tests internal source injection with filter='internal' (good edge case)
   - MISSING TEST: No test for config error path (when loadObserveConfig returns error)
   - MISSING TEST: No test for empty sources after filtering (when sourceFilter blocks all sources)
   - MISSING TEST: No test for successful debt write (happy path)
   - MISSING TEST: No test for sourceCount accuracy

4. **Required Dependencies for Tests to Run:**
   - Lines 10-69: Tests require bin/observe-registry.cjs, bin/observe-handlers.cjs, bin/observe-config.cjs, bin/observe-debt-writer.cjs to be present
   - No mock setup — tests are integration-style (acceptable for a pipeline test)

Action:
- Verify existing tests pass by checking what they depend on
- List any missing test cases
- If test file is incomplete, note what should be added for coverage
  </action>
  <verify>
Run the tests:
```bash
cd /Users/jonathanborduas/code/QGSD && npm test -- bin/observe-pipeline.test.cjs 2>&1
```

Capture output and report:
- [ ] All existing tests pass
- [ ] Handler registration test finds at least 5 core handlers (github, sentry, internal, upstream, deps)
- [ ] registeredAllHandlers() can be called twice without error
- [ ] refreshDebtLedger() returns correct shape
- [ ] Missing test cases identified (if any)

If any test fails, paste the error and note root cause.
  </verify>
  <done>Tests pass with coverage of exports, handler registration (including idempotency), and basic refreshDebtLedger scenarios. Missing cases identified if any.</done>
</task>

<task type="auto">
  <name>Task 3: Verify solve-diagnose.md and observe.md command integration</name>
  <files>commands/nf/solve-diagnose.md, commands/nf/observe.md</files>
  <action>
Verify both commands correctly reference and use the observe-pipeline.cjs module:

**solve-diagnose.md Step 0d (lines 119-154):**
- Line 125: References "shared observe pipeline (bin/observe-pipeline.cjs)" — correct
- Line 132: Calls refreshDebtLedger() with destructuring of { written, updated, sourceCount } (correct)
- Line 133: Expected signature matches return value of observe-pipeline.cjs lines 131-136 (correct)
- Line 136: Logs using these values — matches what refreshDebtLedger returns (correct)
- Line 152: If targets provided, filters openDebt to matching targets (good)
- Edge case: What if refreshDebtLedger errors? Line 83-88 handles configError gracefully (correct)

**observe.md Step 3 (lines 83-98):**
- Line 85: "Use the shared pipeline to register ALL handlers"
- Line 88: Calls registerAllHandlers() from observe-pipeline.cjs (correct)
- Line 89: Expects registry object back with dispatchAll() method (correct)
- Step 4 (line 101): Calls dispatchAll(config.sources, ...) (correct usage of registry)
- Risk check: Step 3 comment says "register ALL handlers" but if observe.md Step 3 runs BEFORE Step 4b (MCP bridge), then handler registration is done. Verify that handler names match what Step 4b expects.

**Integration Consistency:**
- Both solve-diagnose.md and observe.md should use the SAME registerAllHandlers() and SAME pipeline
- solve-diagnose.md Step 0d runs refreshDebtLedger() which calls registerAllHandlers() internally (lines 113)
- observe.md Step 3 calls registerAllHandlers() directly
- This is correct: refreshDebtLedger() is the full pipeline (register + dispatch + write), while observe.md splits registration from dispatch to add the MCP bridge in Step 4b
  </action>
  <verify>
Compare the three sources:
1. bin/observe-pipeline.cjs lines 36-62: Handler registration (core names only)
2. solve-diagnose.md Step 0d line 132: Uses refreshDebtLedger() call
3. observe.md Step 3 line 88: Uses registerAllHandlers() call

Verify:
- [ ] solve-diagnose.md correctly calls refreshDebtLedger() with no parameters
- [ ] observe.md correctly calls registerAllHandlers() and gets back registry object
- [ ] Both commands use the SAME _nfBin() helper for portable paths
- [ ] Handler names in observe-pipeline.cjs lines 43-49 match what's expected by observe.md
- [ ] No naming inconsistencies (sentry-feedback must be hyphenated everywhere)
- [ ] observe.md Step 4 doesn't re-register handlers (they're already registered from Step 3)

Output a brief integration verification checklist.
  </verify>
  <done>solve-diagnose.md and observe.md both correctly integrate with observe-pipeline.cjs, handler names are consistent (sentry-feedback hyphenated), and no duplicate registration issues</done>
</task>

<task type="auto">
  <name>Task 4: Verify README Per-Model Gates section accuracy</name>
  <files>README.md</files>
  <action>
Review the "Per-Model Gates — Spec-Driven Observability" section (lines 478-557) for accuracy and clarity:

1. **Conceptual Accuracy:**
   - Line 480: Claims per-model gate system bridges specs with observability (correct concept)
   - Lines 484-491: Three gates described:
     * Gate A (Grounding): emission points exist for events model needs (correct)
     * Gate B (Abstraction): model traces back to requirement (correct)
     * Gate C (Validation): test recipes exist for failure modes (correct)
   - Line 492: Gate A = observability gate (correct, aligns with formal/evidence/instrumentation-map.json)
   - Line 496: "Models earn enforcement authority through evidence, not time" (correct principle)

2. **The Self-Improvement Loop (lines 498-535):**
   - Step 1: Models start ADVISORY (correct per /nf:close-formal-gaps)
   - Step 2: Three tools mentioned: instrumentation-map.cjs, state-candidates.cjs, analyze-assumptions.cjs
     * Verify: These produce actionable gaps ("Add gauge", "4 vocabulary actions have no emission point")
     * Do these scripts exist? Check if they're referenced in formal verification pipeline
   - Step 3: "YOU WIRE THE INSTRUMENTATION" — correct, user adds emission points
   - Step 4: compute-per-model-gates.cjs scores gates, ADVISORY → SOFT_GATE → HARD_GATE (correct promotion path)
   - Step 5: Enforcement model (SOFT_GATE = warnings, HARD_GATE = blocks) (correct)
   - Step 6: solve loop feeds back into gate improvement (correct)

3. **Pipeline Output (lines 537-546):**
   - Files listed: instrumentation-map.json, state-candidates.json, proposed-metrics.json, per-model-gates.json, gate-a-grounding.json, model-complexity-profile.json
   - Verify: These are the ACTUAL output files from the evidence pipeline (check .planning/formal/ directory structure)
   - Line 551: refresh-evidence.cjs is the command to run full pipeline (verify this exists and is accurate)

4. **Integration with observe and solve (line 554):**
   - Claim: "/nf:observe surfaces unimplemented metrics as drifts"
   - Claim: "/nf:solve runs observe data-gathering pipeline inline during Step 0d, refreshing debt ledger before remediation"
   - Both claims now verified by the extract: solve-diagnose.md Step 0d does call refreshDebtLedger() (correct)

5. **Key Insight (lines 556):**
   - States that formal specs declare what to observe, not bottom-up (correct philosophy)
   - "The gap is mechanical wiring" — accurate after extraction

Action:
- Check if the three analysis scripts (instrumentation-map.cjs, state-candidates.cjs, analyze-assumptions.cjs) exist in bin/
- Check if refresh-evidence.cjs exists and is the right entry point
- Verify output files actually exist in .planning/formal/
- Confirm step descriptions match actual code behavior
  </action>
  <verify>
Run checks:
```bash
ls -1 /Users/jonathanborduas/code/QGSD/bin/ | grep -E 'instrumentation-map|state-candidates|analyze-assumptions|refresh-evidence|compute-per-model-gates'
```

Check evidence output directory:
```bash
ls -1 /Users/jonathanborduas/code/QGSD/.planning/formal/ | grep -E 'gates|evidence'
```

Produce a verification checklist:
- [ ] instrumentation-map.cjs exists
- [ ] state-candidates.cjs exists
- [ ] analyze-assumptions.cjs exists
- [ ] compute-per-model-gates.cjs exists
- [ ] refresh-evidence.cjs exists
- [ ] .planning/formal/gates/ directory exists
- [ ] .planning/formal/evidence/ directory exists
- [ ] README description matches actual pipeline behavior

If any file is missing, note it as a potential documentation error (spec describes it but code doesn't exist yet).
  </verify>
  <done>README Per-Model Gates section accurately describes gate system, loop, and integration; all referenced scripts and output files exist or are correctly noted as future work</done>
</task>

</tasks>

<verification>
After all tasks complete:
1. Confirm no handler naming mismatches (sentry-feedback everywhere, not sentry_feedback)
2. Confirm test coverage includes edge cases
3. Confirm solve-diagnose.md and observe.md both integrate cleanly with observe-pipeline.cjs
4. Confirm README accurately describes the per-model gates system and pipeline
5. List any issues found and note severity (blocker vs. clarification)
</verification>

<success_criteria>
- All handler names match between observe-pipeline.cjs and observe-handlers.cjs (sentry-feedback uses hyphen)
- observe-pipeline.cjs handles edge cases correctly (missing config, empty sources, repeated calls)
- Tests cover core paths and pass without mocking
- solve-diagnose.md Step 0d correctly calls refreshDebtLedger()
- observe.md Step 3 correctly calls registerAllHandlers()
- README Per-Model Gates section accurately documents the system
- No breaking inconsistencies found
- Any issues identified are logged with line numbers and severity
</success_criteria>

<output>
After completion, document findings in `.planning/quick/254-review-observe-pipeline-extraction-and-r/254-SUMMARY.md` with sections:
- **Review Status**: PASS / PASS_WITH_NOTES / FAIL
- **Handler Naming**: Verify sentry-feedback hyphenation everywhere
- **Edge Case Coverage**: Summarize what was tested and what gaps remain
- **Integration Verification**: Confirm solve-diagnose.md and observe.md align
- **Documentation Accuracy**: README section validated or needs clarification
- **Issues Found**: List with severity and line numbers
- **Recommendations**: Any suggested improvements or follow-ups
</output>
