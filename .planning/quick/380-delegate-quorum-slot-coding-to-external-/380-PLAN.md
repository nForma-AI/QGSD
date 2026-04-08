---
phase: quick-380
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/quorum-slot-dispatch.cjs
  - bin/quorum-slot-dispatch.test.cjs
  - bin/coding-task-router.cjs
  - bin/coding-task-router.test.cjs
autonomous: true
requirements: [INTENT-01]
formal_artifacts: none

must_haves:
  truths:
    - "quorum-slot-dispatch.cjs accepts --mode C and builds a coding delegation prompt"
    - "coding-task-router.cjs routes a task description to a named provider slot and returns structured output"
    - "Mock agent CLI (echo-based) can receive a coding task via stdin and return structured result"
    - "Existing Mode A and Mode B dispatch paths are unaffected by the changes"
  artifacts:
    - path: "bin/quorum-slot-dispatch.cjs"
      provides: "Mode C prompt builder and dispatch path"
      contains: "buildModeCPrompt"
    - path: "bin/coding-task-router.cjs"
      provides: "Coding task router with pluggable slot selection"
      exports: ["routeCodingTask", "buildCodingPrompt", "parseCodingResult"]
    - path: "bin/coding-task-router.test.cjs"
      provides: "Tests for coding task router including mock CLI delegation"
      min_lines: 80
  key_links:
    - from: "bin/coding-task-router.cjs"
      to: "bin/call-quorum-slot.cjs"
      via: "child_process.spawn for CLI delegation"
      pattern: "call-quorum-slot\\.cjs"
    - from: "bin/quorum-slot-dispatch.cjs"
      to: "bin/coding-task-router.cjs"
      via: "require and mode C branch"
      pattern: "coding-task-router"
  consumers:
    - artifact: "bin/coding-task-router.cjs"
      consumed_by: "bin/quorum-slot-dispatch.cjs"
      integration: "Mode C branch in main() delegates to router"
      verify_pattern: "coding-task-router"
---

<objective>
Add coding task delegation to the quorum slot dispatch system, enabling external agent CLIs
(codex, gemini, opencode, copilot) to receive and execute coding tasks -- not just review tasks.

Purpose: This is the foundational layer for Issue #60. Currently quorum slots only handle
review/voting (Mode A: questions, Mode B: execution review). This adds Mode C: coding delegation,
where a task description is sent to an external CLI agent to perform actual coding work, with
structured result collection.

Output: New coding-task-router.cjs module, Mode C support in quorum-slot-dispatch.cjs, and tests.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/quorum-slot-dispatch.cjs
@bin/call-quorum-slot.cjs
@bin/providers.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create coding-task-router.cjs with prompt builder, result parser, and routing logic</name>
  <files>bin/coding-task-router.cjs, bin/coding-task-router.test.cjs</files>
  <action>
Create `bin/coding-task-router.cjs` -- a new module that handles coding task delegation to external agent CLIs.

The module must export these pure functions (testable without subprocess):

1. `buildCodingPrompt({ task, repoDir, files, constraints, context })` -- constructs a coding task prompt:
   - `task` (string): description of what to implement/fix/refactor
   - `repoDir` (string): absolute path to the repository
   - `files` (string[]): files the agent should focus on
   - `constraints` (string[]): optional constraints (e.g., "do not modify tests", "use CommonJS")
   - `context` (string): optional additional context (e.g., error output, prior attempt)
   - Returns a structured prompt string with clear sections: TASK, REPOSITORY, FILES, CONSTRAINTS, CONTEXT
   - Include instruction block telling the agent to output a structured result with: status (SUCCESS|PARTIAL|FAILED), files_modified (list), summary (what was done), diff_preview (optional abbreviated diff)

2. `parseCodingResult(rawOutput)` -- extracts structured result from CLI output:
   - Looks for `status:`, `files_modified:`, `summary:`, `diff_preview:` fields in output
   - Returns `{ status, filesModified, summary, diffPreview, rawOutput }` or null on parse failure
   - Fail-open: if parsing fails, returns `{ status: 'UNKNOWN', filesModified: [], summary: rawOutput.slice(0, 500), diffPreview: null, rawOutput }`

3. `routeCodingTask({ task, slot, repoDir, files, constraints, context, timeout })` -- orchestrates delegation:
   - Builds the coding prompt via buildCodingPrompt()
   - Spawns `call-quorum-slot.cjs --slot <slot> --timeout <timeout> --cwd <repoDir>` with prompt on stdin
   - Parses the raw output via parseCodingResult()
   - Returns `{ slot, status, filesModified, summary, diffPreview, latencyMs, rawOutput }`
   - On subprocess failure: returns `{ slot, status: 'UNAVAIL', error_type: classifyDispatchError(output), ... }`

4. `selectSlot(taskType, providers)` -- simple slot selection (pluggable policy placeholder):
   - For now: returns the first subprocess-type provider with `has_file_access: true`
   - This is the hook point for future Q-learning routing (out of scope for this task)
   - `taskType` is a string like "implement", "fix", "refactor", "test"
   - Returns provider name string or null

Follow existing coding patterns:
- CommonJS (`'use strict'`, `require`, `module.exports`)
- Fail-open error handling (try/catch with stderr logging, never crash)
- Use `classifyDispatchError` from quorum-slot-dispatch.cjs for error classification
- Use `path.join(__dirname, 'call-quorum-slot.cjs')` for subprocess path resolution
- CLI entry point guarded by `if (require.main === module)` with arg parsing:
  `node coding-task-router.cjs --slot <name> --task <text> [--files <comma-separated>] [--timeout <ms>] [--cwd <dir>]`

Also create `bin/coding-task-router.test.cjs` with tests using `node:test` and `node:assert`:
- buildCodingPrompt produces prompt containing all sections (TASK, REPOSITORY, FILES, CONSTRAINTS)
- buildCodingPrompt with no optional fields still produces valid prompt
- parseCodingResult extracts status/files_modified/summary from well-formed output
- parseCodingResult handles malformed output gracefully (fail-open)
- selectSlot returns first file-access subprocess provider
- selectSlot returns null when no suitable providers exist
- Module exports all expected functions
  </action>
  <verify>
Run `node --test bin/coding-task-router.test.cjs` -- all tests pass.
Run `node -e "const m = require('./bin/coding-task-router.cjs'); console.log(Object.keys(m))"` -- exports buildCodingPrompt, parseCodingResult, routeCodingTask, selectSlot.
  </verify>
  <done>
coding-task-router.cjs exports 4 functions, all tests pass, prompt builder produces structured coding prompts,
result parser handles both well-formed and malformed output, selectSlot picks first file-access subprocess provider.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Mode C coding delegation path to quorum-slot-dispatch.cjs</name>
  <files>bin/quorum-slot-dispatch.cjs, bin/quorum-slot-dispatch.test.cjs</files>
  <action>
Extend `bin/quorum-slot-dispatch.cjs` to support `--mode C` for coding task delegation.

1. Add `buildModeCPrompt` function (exported for testability):
   - Signature: `buildModeCPrompt({ repoDir, task, files, constraints, context })`
   - Delegates to `require('./coding-task-router.cjs').buildCodingPrompt()` internally
   - This keeps the prompt-building pattern consistent with buildModeAPrompt/buildModeBPrompt
   - Returns the constructed prompt string

2. Add Mode C branch in the `buildPromptForProvider` closure (around line 1519):
   - When `mode === 'C'`, call `buildModeCPrompt({ repoDir, task: question, files: filesArg, constraints: constraintsArg, context: reviewContext })`
   - Add new CLI args: `--files <comma-separated>`, `--constraints <comma-separated>`
   - Parse these in the arg parsing section at top of main()

3. Add Mode C result parsing in the post-dispatch section (around line 1785):
   - When mode is C and not UNAVAIL, use `require('./coding-task-router.cjs').parseCodingResult(output)` 
   - Emit result block with coding-specific fields: add `coding_result` to emitResultBlock when mode is C
   - The verdict for Mode C should be derived from parseCodingResult status: SUCCESS -> APPROVE, PARTIAL -> FLAG, FAILED -> REJECT, UNKNOWN -> FLAG

4. Export `buildModeCPrompt` from module.exports (add to the existing exports object at line ~1881)

5. Add tests to `bin/quorum-slot-dispatch.test.cjs`:
   - `buildModeCPrompt` is exported as a function
   - `buildModeCPrompt` produces prompt containing TASK, REPOSITORY sections
   - `buildModeCPrompt` with files array includes FILES section
   - Existing Mode A and Mode B tests continue to pass (regression check)

IMPORTANT: Do NOT modify the existing buildModeAPrompt, buildModeBPrompt, parseVerdict, or any other existing function behavior. Mode C is purely additive -- new code path, no changes to existing paths. The `buildPromptForProvider` closure's existing `if (mode === 'B')` and default (Mode A) branches must remain untouched.

Guard against re-inlining: buildModeCPrompt MUST delegate to coding-task-router.cjs's buildCodingPrompt, not re-implement the prompt construction inline.
  </action>
  <verify>
Run `node --test bin/quorum-slot-dispatch.test.cjs` -- all existing + new tests pass.
Run `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); console.log(typeof m.buildModeCPrompt)"` -- prints "function".
Run `grep 'coding-task-router' bin/quorum-slot-dispatch.cjs` -- confirms import exists (no re-inlining).
Run `grep 'buildModeCPrompt' bin/quorum-slot-dispatch.cjs` -- confirms export exists.
  </verify>
  <done>
quorum-slot-dispatch.cjs accepts --mode C, delegates prompt building to coding-task-router.cjs,
parses coding results, maps status to verdict, exports buildModeCPrompt. All existing Mode A/B
tests pass unchanged. New Mode C tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add mock CLI integration test for end-to-end coding delegation</name>
  <files>bin/coding-task-router.test.cjs</files>
  <action>
Add an integration-level test to `bin/coding-task-router.test.cjs` that validates the full
coding delegation pipeline using a mock agent CLI.

1. Create an inline mock agent script (written to a temp file during test setup):
   - The mock reads stdin, extracts the TASK section from the prompt
   - Outputs a well-formed coding result:
     ```
     status: SUCCESS
     files_modified: [src/example.js]
     summary: Implemented the requested feature
     diff_preview: |
       +function newFeature() { return true; }
     ```
   - The mock script is a simple Node.js script that reads stdin and writes to stdout

2. Test `routeCodingTask` by:
   - Using `child_process.spawnSync` to run `coding-task-router.cjs --slot mock --task "add a function" --cwd /tmp`
   - BUT since routeCodingTask calls call-quorum-slot.cjs which needs providers.json, instead:
   - Test the pure function pipeline: buildCodingPrompt -> (mock output) -> parseCodingResult
   - Verify the full round-trip: prompt contains task, parsed result has correct status/summary

3. Test error handling path:
   - parseCodingResult with empty string returns fail-open result
   - parseCodingResult with output containing only "status: FAILED\nsummary: compilation error" returns FAILED status

4. Clean up temp files in test teardown.

Note: Full subprocess integration test (actually spawning call-quorum-slot.cjs) is deferred
since it requires a live provider. The pure-function round-trip test validates the contract.
  </action>
  <verify>
Run `node --test bin/coding-task-router.test.cjs` -- all tests pass including integration tests.
Verify test count: `node --test bin/coding-task-router.test.cjs 2>&1 | grep -c 'ok'` shows >= 8 passing tests.
  </verify>
  <done>
Integration tests validate the full prompt-build -> parse round-trip with mock data.
Error handling paths tested. All tests pass. The coding delegation contract is verified
end-to-end at the function level.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/coding-task-router.test.cjs` -- all tests pass
2. `node --test bin/quorum-slot-dispatch.test.cjs` -- all tests pass (existing + new)
3. `grep 'buildModeCPrompt' bin/quorum-slot-dispatch.cjs` -- export exists
4. `grep 'coding-task-router' bin/quorum-slot-dispatch.cjs` -- import exists (no re-inlining)
5. `node -e "const m = require('./bin/coding-task-router.cjs'); console.log(typeof m.routeCodingTask, typeof m.buildCodingPrompt, typeof m.parseCodingResult, typeof m.selectSlot)"` -- all "function"
6. `npm run test:ci` -- full test suite passes (no regressions)
</verification>

<success_criteria>
- coding-task-router.cjs exists with 4 exported functions (buildCodingPrompt, parseCodingResult, routeCodingTask, selectSlot)
- quorum-slot-dispatch.cjs supports --mode C and exports buildModeCPrompt
- Mode C prompt contains structured TASK/REPOSITORY/FILES/CONSTRAINTS sections
- Mode C result parsing maps SUCCESS->APPROVE, PARTIAL->FLAG, FAILED->REJECT
- All existing Mode A/B tests pass unchanged (zero regressions)
- New tests cover prompt construction, result parsing, slot selection, and round-trip integration
</success_criteria>

<output>
After completion, create `.planning/quick/380-delegate-quorum-slot-coding-to-external-/380-SUMMARY.md`
</output>
