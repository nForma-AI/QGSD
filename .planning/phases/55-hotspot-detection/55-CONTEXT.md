# Phase 55: Hotspot Detection - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Git-log-only churn scoring combined with heuristic complexity to produce per-file hotspot risk scores. Uses streaming `git log` parsing via `spawnSync` (matching `git-history-evidence.cjs` pattern) to handle repos with 10K+ commits. Outputs structured data that feeds into context-packer's `<hotspot>` section and automatically escalates quorum fan-out in `nf-prompt.js` for high-risk files.

HOT-02 (AST-based cyclomatic complexity via tree-sitter) is deferred to Phase 57. This phase uses a quick heuristic: file line count as a proxy for complexity, combined with churn frequency.
</domain>

<decisions>
## Implementation Decisions

### Churn scoring (HOT-01)
- Use `git log --all --no-merges --numstat --diff-filter=AMD` to stream commit history
- Parse `--numstat` output (additions/deletions per file per commit) for churn counting
- Use `spawnSync` with large `maxBuffer` (50MB, matching `git-history-evidence.cjs`) — not truly streaming, but handles 10K+ repos without OOM
- Per-file churn score = number of commits touching that file (simple commit count, not line churn)

### Heuristic complexity (HOT-03 partial)
- Phase 55 uses line-count heuristic: complexity = number of non-blank, non-comment lines
- This is a rough proxy — Phase 57 upgrades to AST-based cyclomatic complexity
- Complexity normalized to [0,1] via min-max scaling across all files in the analysis

### Hotspot risk score (HOT-03)
- `hotspot_score = normalized_churn * normalized_complexity` (geometric intersection)
- Both churn and complexity are min-max normalized to [0,1] before multiplication
- Result is in [0,1] — files with high churn AND high complexity score highest

### Noise filtering (HOT-04)
- Default exclude patterns: `node_modules/`, `vendor/`, `dist/`, `*.min.js`, `*.min.css`, `package-lock.json`, `*.generated.*`, `.planning/`
- Mass-refactor commits: commits touching 50+ files have their file contributions weighted by `1 / (fileCount / 50)` (inverse weighting)
- Configurable via `--exclude` and `--mass-refactor-threshold` flags

### nf-prompt escalation (HOT-05)
- Create `bin/repowise/resolve-hotspot-risk.cjs` — reads hotspot data and returns a `risk_level` string
- This module is called from `nf-prompt.js` during context injection
- If ANY file in the current diff matches a high-risk hotspot (score > 0.7), set `risk_level=high`
- If ANY file matches medium-risk (0.4-0.7), set `risk_level=medium`
- Otherwise `risk_level=routine`
- The existing `mapRiskLevelToCount` in nf-prompt.js already handles the fan-out scaling

### Context-packer integration
- `bin/repowise/hotspot.cjs` exports `computeHotspots(projectRoot, options)` returning `{ files: [{path, churn, complexity, hotspot_score}], summary }`
- `context-packer.cjs` calls `computeHotspots()` when `--hotspot` flag is provided or signals.hotspot is passed
- Output feeds into `<hotspot available="true">` section

### Directory structure
- `bin/repowise/hotspot.cjs` — core churn + complexity + hotspot computation
- `bin/repowise/hotspot.test.cjs` — tests
- `bin/repowise/resolve-hotspot-risk.cjs` — nf-prompt integration module
- `bin/repowise/resolve-hotspot-risk.test.cjs` — tests

### Zero new dependencies
- Only `child_process.spawnSync` and `fs` for git operations and file reading
- Matches existing `git-history-evidence.cjs` patterns
</decisions>

<specifics>
## Specific Ideas

- Churn counting uses commit frequency (how many commits touch a file), not line churn (additions+deletions)
- The `--numstat` format gives per-file additions/deletions per commit, which enables future line-churn analysis
- Line-count heuristic: count non-blank, non-comment lines in a file. Comments detected by language-specific patterns (//, #, /*, --)
- Mass-refactor weighting: `weight = 1 / max(1, fileCount / threshold)` — a commit touching 100 files with threshold=50 contributes 0.5x per file instead of 1x
- Hotspot data is cached in `.planning/repowise/hotspot-cache.json` to avoid recomputation on every prompt
- Cache TTL: 1 hour (configurable) — invalidated by new commits

</specifics>

<deferred>
## Deferred Ideas

- AST-based cyclomatic complexity (HOT-02) — Phase 57
- Per-function hotspot scoring — Repowise v2
- Sliding window churn (last N commits) — Repowise v2
- Line-churn (additions + deletions) scoring — future enhancement
</deferred>

---

*Phase: 55-hotspot-detection*
*Context gathered: 2026-04-11*
