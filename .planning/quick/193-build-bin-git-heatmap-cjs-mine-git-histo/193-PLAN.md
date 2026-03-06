---
phase: quick-193
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/git-heatmap.cjs
  - bin/git-heatmap.test.cjs
  - .planning/formal/evidence/git-heatmap.json
autonomous: true
formal_artifacts: none
requirements: [QUICK-193]

must_haves:
  truths:
    - "Running node bin/git-heatmap.cjs produces .planning/formal/evidence/git-heatmap.json"
    - "JSON output contains numerical_adjustments, bugfix_hotspots, and churn_ranking arrays"
    - "uncovered_hot_zones cross-references model-registry.json to flag files without formal coverage"
    - "Priority scoring uses multiplicative formula: max(churn, 1) * (1 + fixes) * (1 + adjustments)"
    - "Tests pass validating all three signal extraction functions and the cross-reference logic"
  artifacts:
    - path: "bin/git-heatmap.cjs"
      provides: "Git history mining script"
      min_lines: 150
    - path: "bin/git-heatmap.test.cjs"
      provides: "Unit tests for git-heatmap"
      min_lines: 80
    - path: ".planning/formal/evidence/git-heatmap.json"
      provides: "Generated evidence file"
      contains: "schema_version"
  key_links:
    - from: "bin/git-heatmap.cjs"
      to: ".planning/formal/model-registry.json"
      via: "JSON read for has_formal_coverage cross-reference"
      pattern: "model-registry\\.json"
    - from: "bin/git-heatmap.cjs"
      to: ".planning/formal/evidence/git-heatmap.json"
      via: "fs.writeFileSync output"
      pattern: "git-heatmap\\.json"
---

<objective>
Build bin/git-heatmap.cjs to mine git history for three signal types (numerical adjustments, bugfix hotspots, churn ranking) and produce .planning/formal/evidence/git-heatmap.json as structured evidence for nf:solve consumption.

Purpose: Provide empirical signal data that identifies which files have the most numerical tuning, bugfixes, and churn — and whether those hot zones have formal model coverage.
Output: Working script + tests + generated evidence JSON
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/formal/model-registry.json
@.planning/formal/evidence/trace-corpus-stats.json
@.planning/formal/evidence/state-candidates.json
@bin/risk-heatmap.cjs
@bin/nf-solve.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement bin/git-heatmap.cjs with three signal extractors and cross-reference logic</name>
  <files>bin/git-heatmap.cjs</files>
  <action>
Create bin/git-heatmap.cjs as a CommonJS script. Follow the CLI pattern from bin/nf-solve.cjs (shebang, 'use strict', argv parsing, --project-root flag).

CLI flags:
- `--project-root=<path>` (default: process.cwd())
- `--json` (machine-readable full JSON to stdout)
- `--since=<date>` (limit git history depth, passed to git log --since)

Three signal extraction functions, each using child_process.execSync:

1. `extractNumericalAdjustments(root, since)`:
   - **Two-pass approach** to avoid OOM on large histories (git log -p --all can exceed maxBuffer):
     - Pass 1: Run `git log --all --numstat` (with optional --since) to identify candidate files — files where numeric-heavy churn is likely (heuristic: files with repeated small changes, config files, files matching patterns like `*.json`, `*.cjs`, `*.config.*`)
     - Pass 2: For each candidate file (limit to top 50 by churn), run targeted `git log -p --all -- <file>` (with optional --since) to extract actual numeric diffs
   - Parse unified diff output to find lines where numeric constants changed
   - Regex pattern for diffs: match pairs of removed/added lines where a numeric value changed. **Hunk-adjacent constraint**: removed/added line pairs must be within the same diff hunk and within 3 lines of each other — do NOT match across hunk boundaries (this prevents false positive pairings). Catch patterns like `const TIMEOUT = 5000` -> `const TIMEOUT = 10000`, object properties `timeout: 5000` -> `timeout: 10000`, and similar numeric literal assignments
   - For each match, record: `{ file, constant_name, old_value, new_value, commit, date }`
   - Group by file+constant_name, compute: `touch_count`, `values` array (chronological), `drift_direction` ("increasing"|"decreasing"|"oscillating")
   - Cross-ref each file against model-registry.json for `has_formal_coverage`. **Important**: registry keys are formal model paths (e.g., `.planning/formal/alloy/foo.als`), NOT source file paths. To determine coverage for a source file, build a reverse map at startup: for each model entry, read its `requirements` array, then for each requirement ID look up in requirements.json to find associated source files. Alternatively, use a simpler heuristic: read each model file's content and check if the source file path appears anywhere in it. Cache this reverse map for reuse across all three extractors. Set `has_formal_coverage: true` if the source file is referenced by any model entry.

2. `extractBugfixHotspots(root, since)`:
   - Run `git log --all --oneline` (with optional --since)
   - Filter commits matching /\b(fix|bug|patch|hotfix|resolve[ds]?)\b/i in message
   - For each matching commit, run `git diff-tree --no-commit-id -r --name-only <sha>` to get touched files
   - Count fixes per file, sort descending
   - Output array: `{ file, fix_count, has_formal_coverage }`
   - Cross-ref against model-registry.json using the same reverse-map approach as above

3. `extractChurnRanking(root, since)`:
   - Run `git log --numstat --all --no-merges` (with optional --since) — --no-merges prevents merge commits from double-counting changes and inflating churn numbers
   - Parse numstat output to accumulate per-file: `commits` count, `lines_added`, `lines_removed`
   - Compute `total_churn = lines_added + lines_removed`
   - Sort by total_churn descending
   - Output array: `{ file, commits, lines_added, lines_removed, total_churn }`

Cross-reference and priority scoring:
- Build `uncovered_hot_zones` array by finding files that appear in ANY signal but have `has_formal_coverage: false`
- For each such file, compute: `priority = max(churn, 1) * (1 + fixes) * (1 + adjustments)` where churn = total_churn from churn ranking (default 0), fixes = fix_count from bugfix hotspots (default 0), adjustments = total touch_count of numerical adjustments in that file (default 0). The `max(churn, 1)` floor ensures config files with many bugfixes/adjustments but zero numstat churn (edited via amend/rebase) are not invisible in the ranking
- Sort uncovered_hot_zones by priority descending
- Each entry: `{ file, priority, churn, fixes, adjustments, signals: ["churn"|"bugfix"|"numerical"] }`

Output: Write JSON to `.planning/formal/evidence/git-heatmap.json` matching schema:
```json
{
  "schema_version": "1",
  "generated": "<ISO>",
  "signals": {
    "numerical_adjustments": [...],
    "bugfix_hotspots": [...],
    "churn_ranking": [...]
  },
  "uncovered_hot_zones": [...]
}
```

If `--json` flag, also print the full JSON to stdout. Otherwise print a human-readable summary showing top 10 in each category and top 10 uncovered hot zones.

Error handling: If git commands fail (not a git repo, etc.), print error to stderr and exit(1). If model-registry.json missing, proceed with all `has_formal_coverage: false`.

Use `execFileSync` with argument arrays (NOT execSync with string concatenation) to prevent command injection via --since or other argv values. Additionally, validate the --since value matches `/^[\d\-\.TZ:]+$/` date pattern before use; reject with a clear error message if invalid. Set `maxBuffer: 50 * 1024 * 1024` on exec calls to handle large repos.

Export helper functions via module.exports for testing. Guard main() execution behind `if (require.main === module)`.
  </action>
  <verify>node bin/git-heatmap.cjs --json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('schema:', d.schema_version, 'adj:', d.signals.numerical_adjustments.length, 'fixes:', d.signals.bugfix_hotspots.length, 'churn:', d.signals.churn_ranking.length, 'uncovered:', d.uncovered_hot_zones.length)"</verify>
  <done>Script runs against the QGSD repo, produces valid JSON with all three signal arrays populated, uncovered_hot_zones computed with multiplicative priority scores, and evidence file written to disk</done>
</task>

<task type="auto">
  <name>Task 2: Write bin/git-heatmap.test.cjs with unit tests for all extraction and scoring logic</name>
  <files>bin/git-heatmap.test.cjs</files>
  <action>
Create bin/git-heatmap.test.cjs following the test pattern from existing test files (e.g., bin/risk-heatmap.test.cjs). Use Node's built-in assert module and a simple test runner pattern (no external deps per v0.29 decision).

Tests to include:

1. **Numerical adjustment regex**: Test the regex/parser against sample diff lines:
   - `"-const TIMEOUT = 5000"` / `"+const TIMEOUT = 10000"` -> detects constant change
   - `"-  retries: 3"` / `"+  retries: 5"` -> detects object property change
   - Non-numeric changes should NOT match (e.g., string value changes)

2. **Drift direction computation**:
   - Values [5, 10, 15] -> "increasing"
   - Values [15, 10, 5] -> "decreasing"
   - Values [5, 15, 5] -> "oscillating"

3. **Bugfix commit message filter**:
   - "fix: resolve timeout issue" -> matches
   - "bugfix in parser" -> matches
   - "feat: add new feature" -> does NOT match
   - "hotfix for prod crash" -> matches

4. **Priority scoring formula** (uses max(churn, 1) floor):
   - churn=100, fixes=0, adjustments=0 -> priority=100
   - churn=100, fixes=2, adjustments=0 -> priority=300
   - churn=100, fixes=2, adjustments=3 -> priority=1200
   - churn=0, fixes=5, adjustments=0 -> priority=6 (floor: max(0,1)=1 * (1+5) * (1+0) = 6, NOT zero)
   - churn=0, fixes=0, adjustments=3 -> priority=4 (floor: 1 * 1 * 4 = 4)

5. **Model-registry cross-reference** (reverse-map from model files to source files):
   - Source file referenced by a model entry's requirements/content -> has_formal_coverage=true
   - Source file NOT referenced by any model -> has_formal_coverage=false

6. **Hunk-adjacent constraint**:
   - Removed/added numeric pair within same hunk, adjacent lines -> match
   - Removed/added numeric pair across different hunks -> NO match (false positive rejected)

7. **--since flag sanitization**:
   - Valid date "2024-01-01" -> accepted
   - Valid ISO "2024-01-01T00:00:00Z" -> accepted
   - Malicious input "2024; rm -rf /" -> rejected with error

8. **Output schema validation**:
   - Run the actual script with --json against the real repo
   - Validate schema_version, generated timestamp, all three signal arrays exist
   - Validate uncovered_hot_zones entries have required fields (file, priority, churn, fixes, adjustments, signals)
  </action>
  <verify>node bin/git-heatmap.test.cjs</verify>
  <done>All tests pass, covering regex parsing, drift detection, commit filtering, priority scoring, cross-reference logic, and end-to-end schema validation</done>
</task>

</tasks>

<verification>
1. `node bin/git-heatmap.cjs` prints human-readable summary to stdout
2. `node bin/git-heatmap.cjs --json` prints valid JSON to stdout
3. `.planning/formal/evidence/git-heatmap.json` exists with schema_version "1"
4. `node bin/git-heatmap.test.cjs` passes all tests
5. uncovered_hot_zones correctly identifies files with high signals but no formal model coverage
</verification>

<success_criteria>
- bin/git-heatmap.cjs produces evidence JSON with all three signal types populated from real git history
- Priority scoring is multiplicative: max(churn, 1) * (1 + fixes) * (1 + adjustments)
- Cross-reference against model-registry.json correctly flags formal coverage
- All unit tests pass
- Output file follows evidence schema conventions (schema_version, generated timestamp)
</success_criteria>

<output>
After completion, create `.planning/quick/193-build-bin-git-heatmap-cjs-mine-git-histo/193-SUMMARY.md`
</output>
