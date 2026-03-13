---
phase: quick-272
plan: 272
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/audit-agent-payloads.cjs
  - bin/audit-agent-payloads.test.cjs
  - commands/nf/health.md
  - core/workflows/health.md
autonomous: true
requirements: [OBS-11]
formal_artifacts: none

must_haves:
  truths:
    - "Running `node bin/audit-agent-payloads.cjs` scans all skill .md files for `node bin/*.cjs` invocations and reports their --json output size"
    - "Scripts producing output over 128KB are flagged with WARNING status"
    - "The audit runs as part of /nf:health diagnostic output"
    - "Script exits 0 even when warnings exist (advisory, not blocking)"
  artifacts:
    - path: "bin/audit-agent-payloads.cjs"
      provides: "Standalone payload size audit script"
      min_lines: 80
    - path: "bin/audit-agent-payloads.test.cjs"
      provides: "Unit tests for audit script"
      min_lines: 30
    - path: "commands/nf/health.md"
      provides: "Health command with audit-agent-payloads entry"
      contains: "audit-agent-payloads"
    - path: "core/workflows/health.md"
      provides: "Health workflow with audit step"
      contains: "audit-agent-payloads"
  key_links:
    - from: "core/workflows/health.md"
      to: "bin/audit-agent-payloads.cjs"
      via: "node bin/audit-agent-payloads.cjs invocation in health workflow step"
      pattern: "audit-agent-payloads"
    - from: "commands/nf/health.md"
      to: "bin/audit-agent-payloads.cjs"
      via: "diagnostics section entry"
      pattern: "audit-agent-payloads"
---

<objective>
Implement OBS-11: agent payload size audit script that detects bin/ scripts whose --json
output exceeds the 128KB GUARD-01 threshold. Wire it into /nf:health so it runs
automatically during health checks.

Purpose: Automated detection prevents oversized payloads from silently degrading agent
context quality. Known offenders like git-heatmap.cjs (2.9MB) should be caught before
they waste context tokens.

Output: bin/audit-agent-payloads.cjs (standalone + health-integrated), tests, updated health workflow.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/health.md
@core/workflows/health.md
@bin/check-mcp-health.cjs (pattern reference for bin/ script structure)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/audit-agent-payloads.cjs with tests</name>
  <files>bin/audit-agent-payloads.cjs, bin/audit-agent-payloads.test.cjs</files>
  <action>
Create `bin/audit-agent-payloads.cjs` — a Node.js script following the same pattern as
other bin/ scripts (shebang, 'use strict', CJS require).

**Behavior:**

1. Scan all `.md` files in `commands/nf/` and `core/workflows/` for patterns matching
   `node bin/*.cjs` or `node ~/.claude/nf-bin/*.cjs` invocations that include `--json`.
   Use regex: `/node\s+(?:~\/\.claude\/nf-bin\/|(?:\$[A-Z_]+\/)?bin\/)([a-z0-9_-]+\.cjs).*--json/g`

2. Deduplicate by script basename (e.g., `issue-classifier.cjs` appears once even if
   referenced in multiple .md files).

3. For each unique script, attempt to run it with `--json` flag using `execSync` with:
   - 15-second timeout
   - `maxBuffer: 10 * 1024 * 1024` (10MB to capture oversized output)
   - Capture stdout only (stderr ignored)
   - If the script requires arguments beyond `--json`, skip it with status "skipped"
     (detect by non-zero exit code)
   - Wrap in try/catch — timeout or crash = "error" status, not a failure

4. Measure `Buffer.byteLength(stdout, 'utf8')` for each script's output.

5. Classify:
   - `< 128 * 1024` bytes → "ok"
   - `>= 128 * 1024` bytes → "warning"
   - Script not found on disk → "missing"
   - Script crashed/timed out → "error" (with reason)
   - Script exited non-zero → "skipped"

6. Output format:
   - Default (no flags): Human-readable table with columns: Script, Size, Status
     Show size in human-readable format (e.g., "2.9 MB", "57 B", "128.0 KB")
     Print summary line: "N scripts audited, M warnings, K errors"
   - `--json` flag: JSON object `{ threshold_kb: 128, scripts: [{name, size_bytes, size_human, status, source_files}], summary: {total, ok, warning, error, skipped, missing} }`

7. Exit code: Always 0 (warnings are advisory per GUARD-01 design). Only exit non-zero
   if the script itself fails to run (e.g., can't read commands/ directory).

8. Support `--threshold-kb N` flag to override the default 128KB threshold.

**Important implementation notes:**
- Use `process.cwd()` as base for resolving `bin/` paths and scanning `commands/nf/` and `core/workflows/`
- Some scripts need `--project-root=$(pwd)` or `--cwd $(pwd)` — the audit script should
  try running with just `--json` first; if that fails (non-zero exit), try with
  `--json --project-root=$(pwd)` as a second attempt before marking as "skipped"
- Do NOT actually run scripts that are test files (*.test.cjs)

**Tests (bin/audit-agent-payloads.test.cjs):**

Create tests using Node.js built-in `assert` and `child_process` (match project test patterns):

1. Test that running `node bin/audit-agent-payloads.cjs` exits 0 and produces table output
2. Test that `--json` flag produces valid JSON with expected schema fields
3. Test that `--threshold-kb 0` causes all scripts with any output to show as "warning"
4. Test that the script finds at least 3 scripts to audit (we know issue-classifier, git-heatmap, nf-solve exist in skill files)
  </action>
  <verify>
```bash
node bin/audit-agent-payloads.cjs
node bin/audit-agent-payloads.cjs --json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('Scripts:', d.summary.total, 'Warnings:', d.summary.warning); process.exit(d.summary.total >= 3 ? 0 : 1)"
node bin/audit-agent-payloads.test.cjs
```
  </verify>
  <done>
Script runs standalone, discovers scripts from skill .md files, reports sizes, flags 128KB+ as warning.
JSON output has correct schema. Tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire audit-agent-payloads into /nf:health</name>
  <files>commands/nf/health.md, core/workflows/health.md</files>
  <action>
**Update `commands/nf/health.md`:**

Add a new entry to the `<diagnostics>` section (after the Telemetry Collection entry):

```markdown
### Agent Payload Size Audit
\`\`\`bash
node bin/audit-agent-payloads.cjs
\`\`\`
Scans skill .md files for `node bin/*.cjs --json` invocations and measures each script's
output size against the 128KB GUARD-01 threshold. Flags scripts whose payloads risk
exceeding agent context budget. Run standalone or as part of /nf:health.
```

**Update `core/workflows/health.md`:**

Add a new step `run_payload_audit` after the `run_harness_diagnostic` step and before
`offer_repair`. The step should:

```markdown
<step name="run_payload_audit">
**Run agent payload size audit:**

\`\`\`bash
node bin/audit-agent-payloads.cjs 2>/dev/null || true
\`\`\`

Display the output inline in the health report, after the harness diagnostic section.
If the script is not found, skip silently (fail-open).
</step>
```

This follows the existing pattern used by other diagnostic steps in health.md (fail-open,
inline display, sequential step ordering).
  </action>
  <verify>
```bash
grep -q "audit-agent-payloads" commands/nf/health.md && echo "health.md: OK" || echo "health.md: MISSING"
grep -q "audit-agent-payloads" core/workflows/health.md && echo "workflow: OK" || echo "workflow: MISSING"
grep -q "run_payload_audit" core/workflows/health.md && echo "step name: OK" || echo "step name: MISSING"
```
  </verify>
  <done>
Both commands/nf/health.md and core/workflows/health.md reference audit-agent-payloads.cjs.
The health workflow includes a run_payload_audit step that runs the audit with fail-open semantics.
  </done>
</task>

</tasks>

<verification>
1. `node bin/audit-agent-payloads.cjs` runs and prints a table of script sizes
2. `node bin/audit-agent-payloads.cjs --json` produces valid JSON with threshold_kb, scripts array, summary
3. `node bin/audit-agent-payloads.test.cjs` passes all tests
4. `grep 'audit-agent-payloads' commands/nf/health.md core/workflows/health.md` shows entries in both files
5. Scripts over 128KB show "warning" status (git-heatmap.cjs if present)
</verification>

<success_criteria>
- bin/audit-agent-payloads.cjs exists and runs standalone
- Discovers at least 3 scripts by scanning skill .md files
- 128KB threshold produces warnings (not errors)
- Wired into /nf:health workflow as a diagnostic step
- Tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/272-implement-obs-11-agent-payload-size-audi/272-SUMMARY.md`
</output>
