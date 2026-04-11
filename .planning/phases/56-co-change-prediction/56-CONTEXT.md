# Phase 56: Co-Change Prediction - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Git-log-only co-change prediction: mine file co-occurrence pairs from git history, compute temporal coupling scores with configurable thresholds, and filter mass-refactoring commits. Outputs structured data that feeds into context-packer's `<cochange>` section and injects co-change partners into debug context bundles.
</domain>

<decisions>
## Implementation Decisions

### Co-occurrence mining (COCH-01)
- Parse `git log --all --no-merges --numstat --diff-filter=AMD` (reusing hotspot.cjs `parseGitNumstat`)
- For each commit, generate all file pairs from the commit's file list
- Count co-occurrence: for each pair (A, B), increment count for both (A→B) and (B→A)
- Store in a Map: `Map<`${fileA}::${fileB}`, count>`

### Temporal coupling (COCH-02)
- Coupling degree = shared_commits / min(commits_A, commits_B) — Jaccard-like
- This normalizes for files that appear in many commits (high churn files don't dominate)
- Configurable thresholds: `min_shared_commits` (default: 3), `min_coupling_degree` (default: 0.3)
- Only pairs meeting both thresholds are included in output

### Mass-refactor filtering (COCH-03)
- Same inverse weighting as hotspot: commits touching 50+ files contribute `1/(fileCount/threshold)` weight per pair
- This means a mass refactor touching 100 files contributes negligible coupling signal
- Pairs from focused commits (1-3 files) carry the most signal

### Debug context injection (COCH-04)
- When `/nf:debug` runs on a file, co-change partners are injected into the debug bundle
- Create `bin/repowise/inject-cochange-debug.cjs` that reads co-change data for a given file
- Hook into `nf-prompt.js` debug path (the existing `DEBUG_FIX_REGEX` path)
- When debug is detected AND the file has co-change partners, inject them as context

### Context-packer integration
- `context-packer.cjs --cochange` flag triggers co-change computation
- Output: `<cochange available="true"><pair file1="a.js" file2="b.ts" shared_commits="5" coupling="0.45"/></cochange>`

### Directory structure
- `bin/repowise/cochange.cjs` — core co-occurrence mining + coupling computation
- `bin/repowise/cochange.test.cjs` — tests
- `bin/repowise/inject-cochange-debug.cjs` — debug context injection
- `bin/repowise/inject-cochange-debug.test.cjs` — tests

### Zero new dependencies
- Reuses `parseGitNumstat` from hotspot.cjs
- Only `child_process.spawnSync` and `fs` for git and file operations
</decisions>

<specifics>
## Specific Ideas

- Reusing `parseGitNumstat` from hotspot.cjs avoids duplicating git parsing logic
- Pair generation uses a sorted key (`${sortedA}::${sortedB}`) to avoid double-counting
- Coupling degree formula: `shared / min(total_A, total_B)` — asymmetric denominator captures one-directional coupling
- Cache co-change data in `.planning/repowise/cochange-cache.json` (1-hour TTL)
- Debug injection is fail-open: if co-change data is unavailable, debug proceeds normally

</specifics>

<deferred>
## Deferred Ideas

- Sliding window co-change (last N commits) — Repowise v2
- Per-function co-change — Repowise v2
- Cross-repo co-change — Repowise v2
</deferred>

---

*Phase: 56-co-change-prediction*
*Context gathered: 2026-04-11*
