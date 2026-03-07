---
phase: quick-218
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/git-history-evidence.cjs
  - bin/git-history-evidence.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-218]

must_haves:
  truths:
    - "Running git-history-evidence.cjs produces .planning/formal/evidence/git-history-evidence.json with classified commits"
    - "Each commit is classified into exactly one category: feat, fix, refactor, docs, test, chore, or build"
    - "Commits touching files covered by TLA+ specs have a tla_cross_refs array listing matched spec paths"
    - "The evidence file includes per-file breakdown showing which commit types dominate each file"
    - "Running with --json flag outputs the full JSON to stdout"
    - "The tool handles repos with no TLA+ specs gracefully (empty cross-refs, no crash)"
  artifacts:
    - path: "bin/git-history-evidence.cjs"
      provides: "Git history evidence extractor with commit classification and TLA+ cross-referencing"
      min_lines: 250
    - path: "bin/git-history-evidence.test.cjs"
      provides: "Tests for commit classification, TLA+ cross-ref, and evidence generation"
      min_lines: 120
    - path: ".planning/formal/evidence/git-history-evidence.json"
      provides: "Generated evidence file consumed by nf-solve"
      contains: "schema_version"
  key_links:
    - from: "bin/git-history-evidence.cjs"
      to: ".planning/formal/evidence/git-history-evidence.json"
      via: "fs.writeFileSync output"
      pattern: "git-history-evidence\\.json"
    - from: "bin/git-history-evidence.cjs"
      to: ".planning/formal/model-registry.json"
      via: "fs.readFileSync for TLA+ model lookup"
      pattern: "model-registry\\.json"
    - from: "bin/git-history-evidence.cjs"
      to: ".planning/formal/tla/"
      via: "fs.readFileSync to extract file references from TLA+ specs"
      pattern: "\\.tla"
    - from: "bin/nf-solve.cjs"
      to: "bin/git-history-evidence.cjs"
      via: "spawnTool() call in new sweepGitHistoryEvidence function"
      pattern: "git-history-evidence"
---

<objective>
Build a git history evidence extractor that classifies every commit by type (feat/fix/refactor/docs/test/chore/build) and cross-references changed files against TLA+ specifications from the model registry.

Purpose: The existing git-heatmap.cjs provides churn and bugfix signals but does not classify commits by type or link them to formal specs. This tool adds commit-type distribution per file (e.g., "hooks/nf-prompt.js: 60% feat, 30% fix, 10% refactor") and identifies which commits affect files covered by TLA+ models -- enabling nf-solve to detect when code evolves faster than its formal spec.

Output: bin/git-history-evidence.cjs (extractor), bin/git-history-evidence.test.cjs (tests), and generated .planning/formal/evidence/git-history-evidence.json.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/git-heatmap.cjs
@bin/nf-solve.cjs
@.planning/formal/model-registry.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build git-history-evidence.cjs extractor and tests</name>
  <files>bin/git-history-evidence.cjs, bin/git-history-evidence.test.cjs</files>
  <action>
Create bin/git-history-evidence.cjs following the same patterns as bin/git-heatmap.cjs (CommonJS, 'use strict', execFileSync with argument arrays for security, fail-open, exports for testing, if require.main === module guard).

**Commit classification engine:**
- Parse git log with `--all --oneline --no-merges` (and optional `--since=`)
- Classify each commit message into exactly one category using prefix-first matching:
  - `feat(` or `feat:` or message starts with "add " -> feat
  - `fix(` or `fix:` or `bugfix` or `hotfix` or `patch` -> fix
  - `refactor(` or `refactor:` -> refactor
  - `docs(` or `docs:` -> docs
  - `test(` or `test:` or `tests(` -> test
  - `build(` or `ci(` or `chore(` -> build
  - fallback: chore
- For each classified commit, get touched files via `git diff-tree --no-commit-id -r --name-only`

**TLA+ cross-referencing:**
- Read model-registry.json to get all TLA+ model paths (filter for .tla extension)
- For each TLA+ file, extract source file references by scanning content for patterns like `hooks/xxx.js`, `bin/xxx.cjs`, etc. (reuse the same regex pattern from git-heatmap.cjs `buildCoverageMap`)
- Build a reverse map: source_file -> [tla_spec_paths]
- For each commit, if any touched file appears in the reverse map, tag the commit with its tla_cross_refs

**Per-file breakdown:**
- Aggregate commits per file, counting how many of each type (feat/fix/refactor/docs/test/build/chore)
- Compute percentage distribution per file
- Mark each file as `has_tla_coverage: true/false`

**Evidence output structure:**
```json
{
  "schema_version": "1",
  "generated": "ISO timestamp",
  "summary": {
    "total_commits": N,
    "by_type": { "feat": N, "fix": N, ... },
    "tla_covered_commits": N,
    "files_analyzed": N
  },
  "file_breakdown": [
    {
      "file": "hooks/nf-prompt.js",
      "total_commits": N,
      "by_type": { "feat": N, "fix": N, ... },
      "dominant_type": "feat",
      "has_tla_coverage": true,
      "tla_specs": [".planning/formal/tla/QGSDPromptHook.tla"]
    }
  ],
  "tla_drift_candidates": [
    {
      "file": "hooks/nf-prompt.js",
      "recent_commits": N,
      "recent_feat_or_fix": N,
      "tla_spec": ".planning/formal/tla/QGSDPromptHook.tla",
      "tla_last_updated": "ISO timestamp"
    }
  ]
}
```

- `tla_drift_candidates`: files where code has feat/fix commits more recent than the TLA+ spec's `last_updated` from model-registry.json. Sort by `recent_feat_or_fix` descending.

**CLI:**
- `node bin/git-history-evidence.cjs` -- print human-readable summary
- `node bin/git-history-evidence.cjs --json` -- print full JSON
- `node bin/git-history-evidence.cjs --since=2024-01-01` -- limit history depth
- `node bin/git-history-evidence.cjs --project-root=/path` -- specify root
- Reuse the same `parseArgs`, `validateSince`, `gitExec` patterns from git-heatmap.cjs

**Human-readable output:**
- Top 10 files by commit count with type distribution
- Top 10 TLA+ drift candidates (code changed but spec stale)
- Summary line with totals

**Tests (bin/git-history-evidence.test.cjs):**
- Unit test `classifyCommit()` with known messages (conventional commit prefixes, fallback)
- Unit test `buildTlaCoverageReverseMap()` with mock registry data
- Unit test `computeFileBreakdown()` with mock commit data
- Test fail-open: empty/missing git output does not crash
- Test `--since` validation rejects injection attempts
  </action>
  <verify>
Run `node bin/git-history-evidence.test.cjs` (or `npx vitest run bin/git-history-evidence.test.cjs`) -- all tests pass.
Run `node bin/git-history-evidence.cjs` -- prints summary without error.
Run `node bin/git-history-evidence.cjs --json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.schema_version, Object.keys(d.summary.by_type).length >= 5)"` -- outputs "1 true".
Verify `.planning/formal/evidence/git-history-evidence.json` exists and contains `schema_version`.
  </verify>
  <done>
git-history-evidence.cjs classifies commits, cross-references TLA+ specs, identifies drift candidates, and writes evidence JSON. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire git-history-evidence into nf-solve.cjs sweep pipeline</name>
  <files>bin/nf-solve.cjs</files>
  <action>
Add a new `sweepGitHistoryEvidence()` function to nf-solve.cjs, following the exact same pattern as `sweepGitHeatmap()` (lines ~2118-2149):

1. Define `sweepGitHistoryEvidence()`:
   - Evidence path: `.planning/formal/evidence/git-history-evidence.json`
   - Refresh via `spawnTool('bin/git-history-evidence.cjs', [])` (skip in fastMode/reportOnly)
   - Read the evidence file, return `{ residual: tla_drift_candidates.length, detail: { ... } }`
   - Detail includes: `tla_drift_count`, `total_commits`, top 5 drift candidates, `generated` timestamp

2. Call `sweepGitHistoryEvidence()` in the main sweep orchestration (near line ~2291 where `sweepGitHeatmap()` is called):
   - `const git_history = sweepGitHistoryEvidence();`
   - Add `git_history` to the residual totals object alongside git_heatmap
   - Add `git_history` key to the `known_issues` array in solve-state.json output

3. Add `git_history` to the sweep key list (near line ~2929 where all sweep keys are enumerated).

4. In the report output section (near line ~2850 where git_heatmap residuals are reported), add a similar block for git_history:
   - If residual > 0, log the drift candidate count and top files

5. Export `sweepGitHistoryEvidence` for testing.

Do NOT modify any existing sweep functions. Only ADD the new sweep alongside the existing ones.
  </action>
  <verify>
Run `grep 'git-history-evidence' bin/nf-solve.cjs` -- returns matches for sweepGitHistoryEvidence, spawnTool call, and evidence path.
Run `grep 'git_history' bin/nf-solve.cjs` -- returns matches for the sweep key in the residual object and known_issues list.
Run `npm test -- --reporter=verbose bin/nf-solve.test.cjs 2>&1 | tail -5` -- existing nf-solve tests still pass (no regressions).
  </verify>
  <done>
nf-solve.cjs calls git-history-evidence.cjs during sweep, reports TLA+ drift candidates as residuals, and includes git_history in solve-state.json output. No regressions in existing tests.
  </done>
</task>

</tasks>

<verification>
- `node bin/git-history-evidence.cjs` runs without error and prints summary
- `node bin/git-history-evidence.cjs --json` outputs valid JSON with schema_version "1"
- `.planning/formal/evidence/git-history-evidence.json` is generated with file_breakdown and tla_drift_candidates
- `npx vitest run bin/git-history-evidence.test.cjs` -- all tests pass
- `grep 'sweepGitHistoryEvidence' bin/nf-solve.cjs` -- confirms wiring
- `npm test` -- no regressions (known pre-existing: 11 in secrets.test.cjs)
</verification>

<success_criteria>
- Commit classification correctly categorizes conventional-commit-style messages into 7 types
- TLA+ cross-referencing links source files to their formal specs via model-registry.json
- Drift candidates identify files where code changed after the TLA+ spec was last updated
- nf-solve includes git_history sweep in its residual reporting
- Evidence file follows the same schema pattern as git-heatmap.json
</success_criteria>

<output>
After completion, create `.planning/quick/218-build-git-history-evidence-extractor-wit/218-SUMMARY.md`
</output>
