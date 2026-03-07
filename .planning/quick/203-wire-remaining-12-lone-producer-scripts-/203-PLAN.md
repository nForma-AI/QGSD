---
phase: quick-203
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/health.md
  - commands/nf/solve.md
  - commands/nf/observe.md
  - commands/nf/plan-phase.md
  - commands/nf/map-requirements.md
autonomous: true
requirements: [INTG-05]
formal_artifacts: none

must_haves:
  truths:
    - "health.md references probe-quorum-slots, verify-quorum-health, check-mcp-health, review-mcp-logs, and telemetry-collector"
    - "solve.md references issue-classifier and git-heatmap as diagnostic inputs"
    - "observe.md references observed-fsm, sensitivity-sweep-feedback, and security-sweep as analysis tools"
    - "plan-phase.md references design-impact for pre-planning impact analysis"
    - "map-requirements.md references validate-requirements-haiku for semantic validation"
  artifacts:
    - path: "commands/nf/health.md"
      provides: "Quorum health probing, MCP health checks, MCP log review, telemetry collection, XState calibration verification"
      contains: "probe-quorum-slots"
    - path: "commands/nf/solve.md"
      provides: "Issue classification and git heatmap churn analysis as solve inputs"
      contains: "issue-classifier"
    - path: "commands/nf/observe.md"
      provides: "Observed FSM derivation, sensitivity sweep feedback, security scanning"
      contains: "observed-fsm"
    - path: "commands/nf/plan-phase.md"
      provides: "Design impact analysis before planning"
      contains: "design-impact"
    - path: "commands/nf/map-requirements.md"
      provides: "Semantic requirements validation via Haiku"
      contains: "validate-requirements-haiku"
  key_links:
    - from: "commands/nf/health.md"
      to: "bin/probe-quorum-slots.cjs"
      via: "node bin/ invocation in process step"
      pattern: "probe-quorum-slots"
    - from: "commands/nf/solve.md"
      to: "bin/issue-classifier.cjs"
      via: "diagnostic input step"
      pattern: "issue-classifier"
    - from: "commands/nf/solve.md"
      to: "bin/git-heatmap.cjs"
      via: "diagnostic input step"
      pattern: "git-heatmap"
    - from: "commands/nf/observe.md"
      to: "bin/observed-fsm.cjs"
      via: "analysis tool reference"
      pattern: "observed-fsm"
    - from: "commands/nf/plan-phase.md"
      to: "bin/design-impact.cjs"
      via: "pre-planning impact step"
      pattern: "design-impact"
    - from: "commands/nf/map-requirements.md"
      to: "bin/validate-requirements-haiku.cjs"
      via: "validation step"
      pattern: "validate-requirements-haiku"
---

<objective>
Wire 12 remaining lone producer scripts into their target skill command files so they are discoverable and invoked as part of established workflows.

Purpose: Quick-201 survey identified these scripts as "producer without consumer" -- they exist and work but are not referenced by any skill command. Wiring them completes the integration so users running `/nf:health`, `/nf:solve`, `/nf:observe`, `/nf:plan-phase`, and `/nf:map-requirements` get the full benefit of these tools.

Output: 5 updated command .md files with new sections/steps referencing the 12 scripts.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/health.md
@commands/nf/solve.md
@commands/nf/observe.md
@commands/nf/plan-phase.md
@commands/nf/map-requirements.md
</context>

<pre-flight>
## Pre-flight: Verify all 12 scripts exist

Before any wiring work, verify all 12 target scripts exist at their expected bin/ paths. Run:

```bash
for script in probe-quorum-slots.cjs verify-quorum-health.cjs check-mcp-health.cjs review-mcp-logs.cjs telemetry-collector.cjs issue-classifier.cjs git-heatmap.cjs observed-fsm.cjs sensitivity-sweep-feedback.cjs security-sweep.cjs design-impact.cjs validate-requirements-haiku.cjs; do
  if [ ! -f "bin/$script" ]; then
    echo "MISSING: bin/$script"
  fi
done
```

If any script is reported MISSING, stop and report the gap before proceeding. A missing script silently skipped via fail-open could mask a real integration problem. All 12 must be present before wiring begins.
</pre-flight>

<tasks>

<task type="auto">
  <name>Task 1: Wire Groups A+B into health.md and solve.md</name>
  <files>commands/nf/health.md, commands/nf/solve.md</files>
  <action>
**Pre-flight: Run the script existence check above. If any of the 12 scripts are missing, stop and report.**

**health.md — Add diagnostic tools section**

health.md currently delegates entirely to the health workflow. Add a `<diagnostics>` section AFTER the `<process>` block that lists the 5 health-related scripts as available diagnostic tools the health workflow can invoke. Follow this pattern:

```xml
<diagnostics>
## Available Diagnostic Scripts

These scripts provide detailed health diagnostics. The health workflow invokes them as needed, but they can also be run standalone.

### Quorum Slot Reachability
```bash
node bin/probe-quorum-slots.cjs
```
Parallel reachability probe for all configured quorum slots. Reports which MCP provider endpoints are responsive and their latency. Use when quorum dispatches are failing or timing out.

### XState Calibration Verification
```bash
node bin/verify-quorum-health.cjs
```
Verifies that the XState machine's maxDeliberation timeout is calibrated for actual empirical provider reliability. Flags miscalibration if empirical failure rates exceed the configured tolerance.

### MCP Server Health Check
```bash
node bin/check-mcp-health.cjs
```
Pre-flight health check for all MCP server instances. Tests connectivity and response time. Run before quorum dispatch to avoid wasting cycles on unreachable providers.

### MCP Log Analysis
```bash
node bin/review-mcp-logs.cjs
```
Scans MCP debug logs for timing anomalies, failures, and hangs. Produces a health report summarizing error patterns and latency outliers.

### Telemetry Collection
```bash
node bin/telemetry-collector.cjs
```
Pure disk I/O telemetry collector. Gathers operational metrics from local telemetry files for analysis by other diagnostic tools (e.g., issue-classifier.cjs).
</diagnostics>
```

All scripts use fail-open: if a script is not found, the health workflow skips it silently.

**solve.md — Wire git-heatmap and issue-classifier**

IMPORTANT: git-heatmap.cjs is NOT currently wired in solve.md (confirmed: grep returns 0 matches). It must be explicitly ADDED as a new diagnostic step. Do NOT assume it is already present.

Add git-heatmap.cjs as a new sub-step. Locate the content anchor "Diagnostic Sweep" (the first major step heading) and add git-heatmap as a sub-step within it, alongside the existing nf-solve.cjs call:

```
### Git Churn Heatmap

Run git heatmap analysis to identify files with high recent churn:

\`\`\`bash
node bin/git-heatmap.cjs --json 2>/dev/null || true
\`\`\`

Produces a ranked list of files by commit frequency and recency-weighted churn. Files at the top of the heatmap are likely candidates for the current issue. Feed heatmap results into the diagnostic context for targeted investigation.
```

For issue-classifier.cjs: Locate the content anchor for the diagnostic display sub-step (after diagnostic results are shown, before transition-specific remediation begins). Add as the next sub-step:

```
### Issue Classification (operational priority ranking)

Run the issue classifier to rank operational issues by severity from telemetry data:

\`\`\`bash
node bin/issue-classifier.cjs --json 2>/dev/null || true
\`\`\`

Parse the JSON output. If issues are found, log: `"Issue classifier: {count} operational issues ranked — {critical} critical, {warning} warnings"`

The classifier reads from telemetry data (produced by telemetry-collector.cjs) and surfaces issues that may affect solve cycle reliability. Critical issues should be flagged in the diagnostic output but do NOT block remediation (fail-open).
```

Use fail-open pattern: `2>/dev/null || true` suffix on the node invocation.
  </action>
  <verify>
1. `grep "probe-quorum-slots" commands/nf/health.md` returns a match
2. `grep "verify-quorum-health" commands/nf/health.md` returns a match
3. `grep "check-mcp-health" commands/nf/health.md` returns a match
4. `grep "review-mcp-logs" commands/nf/health.md` returns a match
5. `grep "telemetry-collector" commands/nf/health.md` returns a match
6. `grep "issue-classifier" commands/nf/solve.md` returns a match
7. `grep "git-heatmap" commands/nf/solve.md` returns a match — MUST be present as a `node bin/git-heatmap.cjs` invocation, not just objective text
8. `grep "fail-open" commands/nf/health.md` returns a match (or equivalent skip-silently language)
9. YAML frontmatter in health.md is still valid (first line is `---`)
10. YAML frontmatter in solve.md is still valid (first line is `---`)
  </verify>
  <done>
health.md contains a diagnostics section referencing all 5 health scripts (probe-quorum-slots, verify-quorum-health, check-mcp-health, review-mcp-logs, telemetry-collector) with brief descriptions and node bin/ invocations. solve.md contains BOTH git-heatmap.cjs (as a new `node bin/git-heatmap.cjs` invocation in the diagnostic sweep) AND issue-classifier.cjs (as a diagnostic input step) with fail-open handling.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire Groups C+D into observe.md and plan-phase.md</name>
  <files>commands/nf/observe.md, commands/nf/plan-phase.md</files>
  <action>
**observe.md — Wire observed-fsm, sensitivity-sweep-feedback, and security-sweep**

observe.md has a structured multi-step process. Use content anchors to find insertion points — do NOT rely on hard-coded step numbers, as numbering may have shifted since planning.

Locate the content anchor "Collect and render" (the step heading containing those words). Insert a new step AFTER that step and BEFORE the next step whose heading contains "Write to debt ledger". This new step runs analysis tools on the collected observation data:

```
## Step 5b: Run analysis tools

After rendering the observe output, run supplementary analysis tools to enrich the observation context. Each tool is optional — if not found, skip silently (fail-open).

**Observed-behavior FSM derivation:**
\`\`\`bash
node bin/observed-fsm.cjs --json 2>/dev/null || true
\`\`\`
Derives an observed-behavior FSM from trace data. Useful for detecting state-transition anomalies that may correlate with observed issues. If JSON output is valid, log: `"Observed FSM: {state_count} states, {transition_count} transitions derived from traces"`

**Sensitivity sweep feedback:**
\`\`\`bash
node bin/sensitivity-sweep-feedback.cjs 2>/dev/null || true
\`\`\`
Compares empirical true-positive rate with sensitivity sweep predictions. If a deviation is detected, logs a warning that threshold calibration may need updating. This feeds back into the observe loop by surfacing issues with the observation pipeline itself.

**Security sweep:**
\`\`\`bash
node bin/security-sweep.cjs --json 2>/dev/null || true
\`\`\`
Runs a standalone security scan across the codebase. If findings are returned, inject them as additional issues with `source_type: 'internal'` and `severity: 'warning'` into the results array before the "Write to debt ledger" step processes them.
```

**plan-phase.md — Wire design-impact**

plan-phase.md currently delegates entirely to the plan-phase workflow. Add a `<pre-planning>` section AFTER the `<context>` block and BEFORE the `<process>` block:

```xml
<pre-planning>
## Pre-Planning Impact Analysis

Before spawning the planner, run design-impact analysis on recent changes to understand which formal verification layers are affected:

\`\`\`bash
node bin/design-impact.cjs --json 2>/dev/null || true
\`\`\`

This three-layer git diff impact analysis traces recent changes through L1 (instrumentation), L2 (state transitions), and L3 (hazards). The output helps the planner understand which subsystems have active churn and may need more careful planning.

If the script is not found or fails, skip silently and proceed to the planning workflow (fail-open).
</pre-planning>
```
  </action>
  <verify>
1. `grep "observed-fsm" commands/nf/observe.md` returns a match
2. `grep "sensitivity-sweep-feedback" commands/nf/observe.md` returns a match
3. `grep "security-sweep" commands/nf/observe.md` returns a match
4. `grep "design-impact" commands/nf/plan-phase.md` returns a match
5. `grep "fail-open" commands/nf/observe.md` returns a match (or equivalent skip-silently language)
6. `grep "fail-open" commands/nf/plan-phase.md` returns a match (or equivalent skip-silently language)
7. YAML frontmatter in observe.md is still valid (first line is `---`)
8. YAML frontmatter in plan-phase.md is still valid (first line is `---`)
  </verify>
  <done>
observe.md contains a new step (inserted after the "Collect and render" step and before the "Write to debt ledger" step) referencing observed-fsm.cjs, sensitivity-sweep-feedback.cjs, and security-sweep.cjs with fail-open handling and node bin/ invocations. plan-phase.md contains a pre-planning section referencing design-impact.cjs for three-layer git diff impact analysis with fail-open handling.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire Group E into map-requirements.md</name>
  <files>commands/nf/map-requirements.md</files>
  <action>
**map-requirements.md — Wire validate-requirements-haiku**

map-requirements.md currently delegates to the map-requirements workflow with --dry-run and --skip-archive flags. Add a `<validation>` section AFTER the `<process>` block:

```xml
<validation>
## Post-Mapping Semantic Validation

After the mapping pipeline completes (unless `--skip-validate` is passed), run semantic validation on the resulting requirements.json:

\`\`\`bash
node bin/validate-requirements-haiku.cjs --json 2>/dev/null || true
\`\`\`

This uses Claude Haiku to semantically validate requirement entries — checking for duplicates, ambiguous language, missing acceptance criteria, and inconsistent categorization. The validator reads from `.planning/formal/requirements.json` (the output of the mapping pipeline).

If findings are returned, display a summary:
\`\`\`
Semantic validation: {total} requirements checked, {issues} issues found
  - {duplicates} potential duplicates
  - {ambiguous} ambiguous requirements
  - {missing_ac} missing acceptance criteria
\`\`\`

If the script is not found or fails, skip silently (fail-open). The `--skip-validate` flag in the command arguments should bypass this step entirely.
</validation>
```

**Verify --skip-validate flag in frontmatter:** Before adding the validation section, check that `--skip-validate` appears in the `argument-hint` line of the YAML frontmatter. As of planning time, it IS present (`argument-hint: [--dry-run] [--skip-archive] [--skip-validate]`). If at execution time it is NOT present, add `[--skip-validate]` to the argument-hint list before proceeding. This ensures the flag is documented and discoverable.
  </action>
  <verify>
1. `grep "validate-requirements-haiku" commands/nf/map-requirements.md` returns a match
2. `grep "skip-validate" commands/nf/map-requirements.md` returns >= 2 matches (argument-hint + validation section)
3. `grep "fail-open" commands/nf/map-requirements.md` returns a match (or equivalent skip-silently language)
4. YAML frontmatter in map-requirements.md is still valid (first line is `---`)
  </verify>
  <done>
map-requirements.md contains a validation section referencing validate-requirements-haiku.cjs for semantic validation with fail-open handling. The --skip-validate flag is present in both the argument-hint frontmatter AND the validation section text.
  </done>
</task>

</tasks>

<verification>
- Pre-flight: all 12 scripts confirmed to exist at bin/ paths before any wiring
- All 5 command files have valid YAML frontmatter (first line `---`)
- All 12 scripts are referenced by name in at least one command file
- All references use `node bin/` invocation pattern
- All references include fail-open handling (2>/dev/null || true, or skip-silently language)
- No existing content in any file was removed or rewritten — only additions
- grep counts: health.md has 5 script refs, solve.md has issue-classifier + git-heatmap (both as node bin/ invocations), observe.md has 3 script refs, plan-phase.md has design-impact, map-requirements.md has validate-requirements-haiku
- git-heatmap.cjs is wired as a NEW `node bin/git-heatmap.cjs` invocation (not just mentioned in objective text)
</verification>

<success_criteria>
- Running `grep -c 'probe-quorum-slots\|verify-quorum-health\|check-mcp-health\|review-mcp-logs\|telemetry-collector' commands/nf/health.md` returns 5
- Running `grep -c 'issue-classifier' commands/nf/solve.md` returns >= 1
- Running `grep 'node bin/git-heatmap.cjs' commands/nf/solve.md` returns a match (explicit invocation, not just objective text)
- Running `grep -c 'observed-fsm\|sensitivity-sweep-feedback\|security-sweep' commands/nf/observe.md` returns 3
- Running `grep -c 'design-impact' commands/nf/plan-phase.md` returns >= 1
- Running `grep -c 'validate-requirements-haiku' commands/nf/map-requirements.md` returns >= 1
- Total: all 12 scripts wired into their target command files
</success_criteria>

<output>
After completion, create `.planning/quick/203-wire-remaining-12-lone-producer-scripts-/203-SUMMARY.md`
</output>
