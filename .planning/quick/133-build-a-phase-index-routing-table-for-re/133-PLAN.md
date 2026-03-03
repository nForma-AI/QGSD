---
phase: quick-133
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/build-phase-index.cjs
  - bin/build-phase-index.test.cjs
  - .formal/phase-index.json
autonomous: true
requirements: [QUICK-133]
formal_artifacts: none

must_haves:
  truths:
    - "Running `node bin/build-phase-index.cjs` scans all .planning/phases/*/VERIFICATION.md files and writes .formal/phase-index.json"
    - "Newer phases (v0.19+) with structured frontmatter produce entries with extracted requirement IDs from the traceability table or frontmatter"
    - "Older phases (v0.8-v0.18) without REQ IDs produce entries with keyword tags inferred from directory name, phase goal text, and Observable Truths column text including domain-specific pattern words (NDJSON, TLA, Alloy, etc.)"
    - "Malformed VERIFICATION.md files (missing frontmatter, invalid YAML) are skipped with a stderr warning — never silently dropped"
    - ".formal/phase-index.json is a compact JSON array with ~2-3 lines per entry, staying under ~150 lines for the current ~45 phases"
    - "node --test bin/build-phase-index.test.cjs passes with tests covering both format generations and edge cases"
  artifacts:
    - path: "bin/build-phase-index.cjs"
      provides: "One-time phase index extractor"
      exports: ["buildPhaseIndex", "extractKeywords", "parseVerificationFrontmatter"]
    - path: "bin/build-phase-index.test.cjs"
      provides: "Unit tests for phase index builder"
      min_lines: 80
    - path: ".formal/phase-index.json"
      provides: "Compact lookup table of all phases with VERIFICATION files"
      contains: "v0.19-01"
  key_links:
    - from: "bin/build-phase-index.cjs"
      to: ".planning/phases/*/VERIFICATION.md"
      via: "glob scan with fs.readdirSync"
      pattern: "VERIFICATION\\.md"
    - from: "bin/build-phase-index.cjs"
      to: ".formal/phase-index.json"
      via: "fs.writeFileSync"
      pattern: "phase-index\\.json"
---

<objective>
Build a phase-index routing table so the planner agent can quickly find historically relevant VERIFICATION files by keyword match, without loading all 45+ verification reports into context.

Purpose: Enable retroactive requirement extraction and give the planner cheap (~50 token) historical context lookups during plan-phase Step 4.5.
Output: bin/build-phase-index.cjs (extractor), bin/build-phase-index.test.cjs (tests), .formal/phase-index.json (index artifact).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/build-phase-index.cjs extractor and tests</name>
  <files>bin/build-phase-index.cjs, bin/build-phase-index.test.cjs</files>
  <action>
Create `bin/build-phase-index.cjs` that scans `.planning/phases/` and builds a compact JSON index.

**Algorithm:**
1. Read all directories under `.planning/phases/`.
2. For each directory, find `*-VERIFICATION.md` files (some phases have multiple, e.g., `v0.14-02` has both `v0.14-02-VERIFICATION.md` and `v0.14-02-03-VERIFICATION.md` -- use the primary one without extra plan number suffix, falling back to the first found).
3. For each VERIFICATION.md found:
   a. Parse YAML frontmatter (between `---` markers) to extract: `phase`, `status`, `score`.
      **Error handling for malformed files:** If the file has no frontmatter delimiters (`---`), or if the YAML between delimiters fails to parse (invalid syntax, missing required fields), emit a warning to stderr: `"WARN: Skipping {filepath}: {reason}"` and skip the file entirely. Do NOT silently ignore — operators need to know which files were excluded from the index. Count skipped files and include in the CLI summary line: `"Phase index: {N} phases indexed ({S} skipped — see warnings above), written to .formal/phase-index.json"`.
   b. Extract phase name from the H1 heading: `# Phase vX.YY-NN: {Name}` pattern.
   c. Detect format generation:
      - **Newer (v0.19+):** Look for requirement IDs in the file (patterns like `REQ-ID`, `UNIF-01`, `CALIB-02`, `ENV-01`, `FAIL-01`, `ENF-01`, `WFI-01` etc. -- any `[A-Z]+-\d+` pattern). Extract unique IDs into `requirement_ids` array.
      - **Older (v0.8-v0.18):** No REQ IDs present. Infer `keywords` array from: (a) the directory name split on hyphens (excluding version prefix), e.g., `v0.12-09-verification-quick-fixes` yields `["verification", "quick", "fixes"]`, (b) key nouns from the phase goal line (extract top 5-8 distinctive words, filtering stopwords like "the", "and", "is", "a", "for", "to", "in", "of", "with", "that", "on", "from", "all"), and **(c) Observable Truths column text** — scan the markdown table rows under the "Observable Truth" or "Truth" column header and extract domain-specific terms. Include a hardcoded set of domain-specific pattern words to boost: `["NDJSON", "TLA", "TLA+", "Alloy", "PRISM", "UPPAAL", "xstate", "frontmatter", "quorum", "circuit-breaker", "hook", "MCP", "scoreboard", "liveness", "fairness", "CTL", "LTL"]`. When any of these appear (case-insensitive) in the Observable Truths text, add the lowercase form to the keywords array. Deduplicate and cap final keywords at 12 max per entry.
   d. Build entry: `{ phase_id, phase_name, status, requirement_ids, keywords, verification_path }`.

4. Write `.formal/phase-index.json` as a JSON object with `version`, `generated_at` (ISO timestamp), and `phases` array. Use compact formatting: 1 line per entry (use `JSON.stringify` per entry, wrap in array manually) to keep total file size under 150 lines.

**Exports for testability:** Export `buildPhaseIndex` (main function), `extractKeywords` (keyword extraction from text), `parseVerificationFrontmatter` (YAML frontmatter parser). Export via `module.exports` and also via `module.exports._pure` for test access (same pattern as other bin/*.cjs files).

**CLI mode:** When run directly (`require.main === module`), execute `buildPhaseIndex()` and print summary: `"Phase index: {N} phases indexed ({S} skipped), written to .formal/phase-index.json"` (omit the skipped clause when S=0).

**Entry format example (newer):**
```json
{"phase_id":"v0.19-01","phase_name":"Unified Verdict Format","status":"passed","requirement_ids":["UNIF-01","UNIF-02","UNIF-03"],"keywords":["unified","verdict","format","ndjson","check-result"],"verification_path":".planning/phases/v0.19-01-unified-verdict-format/v0.19-01-VERIFICATION.md"}
```

**Entry format example (older):**
```json
{"phase_id":"v0.9-01","phase_name":"Context Window Monitor","status":"passed","requirement_ids":[],"keywords":["context","window","monitor","hook","threshold","warning"],"verification_path":".planning/phases/v0.9-01-context-window-monitor/v0.9-01-VERIFICATION.md"}
```

Create `bin/build-phase-index.test.cjs` using `node:test` and `node:assert` (project convention -- NOT jest). Tests:
1. `parseVerificationFrontmatter` correctly parses YAML frontmatter from a sample VERIFICATION.md string (newer format with `phase:`, `status:`, `score:` fields).
2. `parseVerificationFrontmatter` returns empty object for content with no frontmatter delimiters.
2b. `parseVerificationFrontmatter` returns empty object for content with malformed YAML between `---` markers (e.g., `---\n: invalid: yaml:\n---`) and does not throw.
3. `extractKeywords` from directory name: `"v0.12-09-verification-quick-fixes"` yields keywords including `["verification", "quick", "fixes"]`.
4. `extractKeywords` from phase goal text: extracts nouns, filters stopwords, returns distinctive words.
5. `extractKeywords` from Observable Truths text: given a sample VERIFICATION.md body containing an Observable Truth table with domain terms (e.g., "NDJSON output validated", "TLA+ model checks pass"), the extracted keywords include `["ndjson", "tla+"]` from the domain-specific pattern word set.
6. `extractKeywords` deduplication and cap: given input producing 15+ raw keywords, verify output is capped at 12 max and contains no duplicates.
7. REQ ID extraction: detects `UNIF-01`, `CALIB-02`, `ENV-01` etc. from sample verification content.
8. REQ ID extraction: returns empty array when no REQ IDs present (older format).
9. `buildPhaseIndex` integration test: create a temp directory with 3 mock VERIFICATION.md files (one newer with REQ IDs, one older without, one malformed with invalid YAML frontmatter), run buildPhaseIndex against it, verify output structure has 2 entries (the malformed file was skipped) and correct fields. Capture stderr and verify it contains a WARN line mentioning the malformed file path.

Use `describe`/`it` blocks via `node:test`. Use `fs.mkdtempSync` + `fs.rmSync` for temp directories in integration test.
  </action>
  <verify>
Run: `node --test bin/build-phase-index.test.cjs` -- all tests pass.
Run: `node bin/build-phase-index.cjs` -- produces `.formal/phase-index.json` with entries for all ~45 phases that have VERIFICATION.md files.
Check: `wc -l .formal/phase-index.json` -- under 150 lines.
Check: `node -e "const idx = require('./.formal/phase-index.json'); console.log(idx.phases.length + ' phases'); console.log(idx.phases.filter(p => p.requirement_ids.length > 0).length + ' with REQ IDs')"` -- shows ~45 phases, ~15+ with REQ IDs.
  </verify>
  <done>
bin/build-phase-index.cjs exists, exports _pure functions, produces .formal/phase-index.json with one entry per VERIFICATION.md file. All tests pass. Index file is under 150 lines. Both older (keyword-only) and newer (REQ ID) phases are correctly indexed. .formal/phase-index.json has been generated and committed to git before workflow integration tasks begin.
  </done>
</task>

<task type="auto">
  <name>Task 1b: Verify and commit initial phase-index.json artifact</name>
  <files>.formal/phase-index.json</files>
  <action>
After Task 1 completes and all tests pass, verify that `.formal/phase-index.json` exists on disk with valid content before proceeding to workflow integration tasks.

**Steps:**
1. Run `node bin/build-phase-index.cjs` to generate the initial `.formal/phase-index.json` from existing VERIFICATION.md files.
2. Validate the generated file: `node -e "const idx = require('./.formal/phase-index.json'); if (!idx.phases || idx.phases.length === 0) { process.exit(1); } console.log('Valid: ' + idx.phases.length + ' phases indexed')"` -- must exit 0 with non-zero phase count.
3. Commit `.formal/phase-index.json` to git so it exists as a tracked artifact before Tasks 2 and 3 wire workflow dependencies against it.

This gate ensures that if `bin/build-phase-index.cjs` has a bug that prevents index generation, the failure surfaces here rather than causing silent runtime failures when plan-phase.md or execute-phase.md attempt to read a missing or malformed `.formal/phase-index.json`.
  </action>
  <verify>
Run: `test -f .formal/phase-index.json && echo "EXISTS" || echo "MISSING"` -- prints EXISTS.
Run: `node -e "const idx = require('./.formal/phase-index.json'); console.log(idx.phases.length + ' phases, version: ' + idx.version)"` -- prints valid count and version.
Run: `git log --oneline -1 -- .formal/phase-index.json` -- shows a commit including this file.
  </verify>
  <done>
.formal/phase-index.json exists on disk, contains valid indexed phase entries, and is committed to git. This guarantees downstream workflow integrations (Tasks 2 and 3) can safely depend on the artifact's existence.
  </done>
</task>

<task type="auto">
  <name>Task 2: Expand plan-phase Step 4.5 with phase-index keyword routing and wire post-verification append</name>
  <files>~/.claude/qgsd/workflows/plan-phase.md, bin/build-phase-index.cjs</files>
  <action>
**Deliverable A -- Expand Step 4.5 in plan-phase.md:**

After the existing `.formal/spec/` scan block (line ~99, after `fi` closing the formal spec loop), add a NEW subsection for phase-index routing. Insert BEFORE the display line at ~104. The new block:

```
## Phase-Index Historical Context Scan

if [ -f ".formal/phase-index.json" ]; then
  PHASE_INDEX_MATCHES=[]
  # Read phase description keywords
  for KEYWORD in $(echo "$PHASE_DESC_LOWER" | tr ' -/' '\n' | grep -v '^$' | grep -v -E '^(the|and|is|a|for|to|in|of|with|that|on|from|all)$'); do
    # Search phase-index.json keywords array for matches
    MATCHED_PATHS=$(node -e "
      const idx = require('./.formal/phase-index.json');
      const kw = '${KEYWORD}'.toLowerCase();
      idx.phases
        .filter(p => p.keywords.some(k => k === kw))
        .forEach(p => console.log(p.verification_path));
    " 2>/dev/null)
    for P in $MATCHED_PATHS; do
      # Deduplicate
      if ! echo "${PHASE_INDEX_MATCHES[@]}" | grep -qF "$P"; then
        PHASE_INDEX_MATCHES+=("$P")
      fi
    done
  done
fi
```

Add matched VERIFICATION file paths to `files_to_read` in the planner prompt (Step 8). After the existing `${FORMAL_SPEC_CONTEXT...}` line in the `<files_to_read>` block (~line 288), add:
```
${PHASE_INDEX_MATCHES.length > 0 ? PHASE_INDEX_MATCHES.map(p => `- ${p} (Historical verification — keyword match from phase-index)`).join('\n') : ''}
```

Update the display line (~104) to also show phase-index matches:
```
Phase-index scan: found ${#PHASE_INDEX_MATCHES[@]} relevant historical phase(s)${...}
```

**Deliverable B -- Wire post-verification append:**

Add a function `appendPhaseEntry(phaseDir, verificationPath)` to `bin/build-phase-index.cjs` that:
1. Reads `.formal/phase-index.json` (or creates `{ version: "1.0", generated_at: ..., phases: [] }` if absent).
2. Parses the given VERIFICATION.md file using the same extraction logic.
3. Removes any existing entry with the same `phase_id` (idempotent upsert).
4. Appends the new entry to `phases` array.
5. Writes the updated JSON back.

Export `appendPhaseEntry` via both `module.exports` and `_pure`.

Then document (as a code comment at the top of the function) that this should be called from execute-phase.md's `update_roadmap` step, right after the `phase complete` call and before the final commit. The actual workflow wiring into execute-phase.md is a separate task -- for now the function exists and is callable via:
```bash
node -e "require('./bin/build-phase-index.cjs').appendPhaseEntry('${PHASE_DIR}', '${PHASE_DIR}/${PHASE_NUM}-VERIFICATION.md')"
```

Add a test for `appendPhaseEntry`: create temp phase-index.json, call append with a mock VERIFICATION.md, verify entry added. Call again with same phase, verify no duplicates (upsert behavior).
  </action>
  <verify>
Run: `node --test bin/build-phase-index.test.cjs` -- all tests pass (including new appendPhaseEntry tests).
Check: `grep -c "phase-index" ~/.claude/qgsd/workflows/plan-phase.md` -- returns 3+ (the scan block, display line, and files_to_read injection).
Check: `grep "appendPhaseEntry" bin/build-phase-index.cjs` -- function exists and is exported.
Smoke test the workflow addition: `node -e "const m = require('./bin/build-phase-index.cjs'); console.log(typeof m.appendPhaseEntry)"` -- prints "function".
  </verify>
  <done>
plan-phase.md Step 4.5 expanded with phase-index keyword scan that injects matched VERIFICATION file paths into the planner's files_to_read. appendPhaseEntry function exists in build-phase-index.cjs for post-verification use, with idempotent upsert behavior. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire appendPhaseEntry into execute-phase.md post-verification step</name>
  <files>~/.claude/qgsd/workflows/execute-phase.md</files>
  <action>
In execute-phase.md, find the `update_roadmap` step (around line 625). After the `phase complete` call (line 629) and BEFORE the final git commit (line 648), insert:

```bash
# Update phase-index with completed phase entry
if [ -f "bin/build-phase-index.cjs" ]; then
  VERIFICATION_FILE=$(ls "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | grep -v -E '\-[0-9]+-VERIFICATION' | head -1)
  if [ -n "$VERIFICATION_FILE" ]; then
    node -e "require('./bin/build-phase-index.cjs').appendPhaseEntry('${PHASE_DIR}', '${VERIFICATION_FILE}')" 2>/dev/null || true
  fi
fi
```

The `grep -v -E '\-[0-9]+-VERIFICATION'` filter ensures we pick the primary VERIFICATION.md (e.g., `v0.14-02-VERIFICATION.md`) and not plan-level ones (e.g., `v0.14-02-03-VERIFICATION.md`). The `[0-9]+` quantifier handles any digit count in plan suffixes (e.g., single-digit `v0.5-9-VERIFICATION.md` or triple-digit `v0.24-001-VERIFICATION.md`).

The `|| true` ensures fail-open: if the index script errors, phase completion is not blocked.

Also add `.formal/phase-index.json` to the git commit files list on line 648, so it gets committed alongside the other phase completion artifacts. Change from:
```
--files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
To:
```
--files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md .formal/phase-index.json
```
  </action>
  <verify>
Check: `grep -c "phase-index" ~/.claude/qgsd/workflows/execute-phase.md` -- returns 2+ (the append call and the commit files list).
Check: `grep "appendPhaseEntry" ~/.claude/qgsd/workflows/execute-phase.md` -- exists in the update_roadmap step.
Check: `grep ".formal/phase-index.json" ~/.claude/qgsd/workflows/execute-phase.md` -- appears in the commit files list.
  </verify>
  <done>
execute-phase.md update_roadmap step calls appendPhaseEntry after verification passes, with fail-open guard. .formal/phase-index.json is included in the phase completion commit. New phases auto-append to the index on completion.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/build-phase-index.test.cjs` -- all tests pass
2. `node bin/build-phase-index.cjs` -- generates .formal/phase-index.json from existing phases
3. `wc -l .formal/phase-index.json` -- under 150 lines
4. `node -e "const idx=require('./.formal/phase-index.json'); console.log(idx.phases.length)"` -- ~45 entries
5. `grep "phase-index" ~/.claude/qgsd/workflows/plan-phase.md | wc -l` -- 3+ occurrences
6. `grep "appendPhaseEntry" ~/.claude/qgsd/workflows/execute-phase.md` -- present
</verification>

<success_criteria>
- .formal/phase-index.json exists with entries for all ~45 VERIFICATION.md files
- Both older (keyword-only) and newer (REQ ID) format generations handled correctly
- plan-phase.md Step 4.5 routes matched VERIFICATION paths into planner context
- execute-phase.md auto-appends new entries on phase completion (fail-open)
- Index stays compact: under 150 lines for current phase count
- All unit and integration tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/133-build-a-phase-index-routing-table-for-re/133-SUMMARY.md`
</output>
