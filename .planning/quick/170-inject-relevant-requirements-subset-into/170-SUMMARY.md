---
phase: quick-170
plan: 01
type: execute
completed_date: 2026-03-04
status: Completed
commit: 12fe407e
tasks_completed: 2/2
---

# Quick Task 170: Inject Relevant Requirements Subset Into Quorum Dispatch Prompts

## Summary

Successfully implemented requirements-aware prompt construction in quorum dispatch. External agents reviewing qgsd plans now receive a matched subset of the 237 formal requirements (from `.formal/requirements.json`), enabling them to evaluate whether proposed changes satisfy or violate specific requirements.

## Key Implementation

### Task 1: Requirements Matching and Loading Logic

Added three exported pure functions to `bin/quorum-slot-dispatch.cjs`:

1. **loadRequirements(projectRoot)** — Reads `.formal/requirements.json` from the project root
   - Returns the full requirements array (237 requirements)
   - Caches results by projectRoot to avoid repeated disk reads
   - Fail-open: returns empty array if file missing or malformed

2. **matchRequirementsByKeywords(requirements, question, artifactPath)** — Filters requirements based on keywords
   - Extracts meaningful tokens from question text (stopword-filtered, split on spaces/slashes/hyphens/dots)
   - Maps artifact path segments to category groups (e.g., "hook" → "Hooks & Enforcement", "quorum" → "Quorum & Dispatch")
   - Scores requirements by keyword hits and category matches (+3 boost for artifact path category matches)
   - Returns top 20 sorted by relevance score (capped to prevent prompt bloat)

3. **formatRequirementsSection(requirements)** — Formats matched requirements as text block
   - Returns null for empty arrays (no empty section injected)
   - Formats as "=== APPLICABLE REQUIREMENTS ===" block
   - Lists each requirement with ID, text, and category

### Task 2: Prompt Integration and Testing

- Modified **buildModeAPrompt** and **buildModeBPrompt** to accept optional `requirements` parameter
- Requirements section injected between question/artifact and review context (high visibility position)
- Updated **main()** to load and match requirements automatically before building prompts

#### Test Coverage

Added 12 comprehensive tests (all passing):

1. loadRequirements smoke test — loads 237+ requirements
2. loadRequirements fail-open — handles nonexistent paths gracefully
3. matchRequirementsByKeywords quorum keywords — returns DISP/QUORUM requirements
4. matchRequirementsByKeywords hook keywords — returns Hooks & Enforcement requirements
5. matchRequirementsByKeywords artifact path — maps artifact paths to categories
6. matchRequirementsByKeywords gibberish — returns empty for nonsense queries
7. matchRequirementsByKeywords broad query cap — enforces max 20 limit
8. formatRequirementsSection formatting — correctly formats mock requirements
9. formatRequirementsSection empty array — returns null for empty input
10. buildModeAPrompt with requirements — includes section and requirement IDs
11. buildModeAPrompt without requirements — omits section when empty
12. buildModeBPrompt with requirements — includes section correctly

**All 39 tests pass** (27 existing + 12 new).

## Verification

All verification checks from plan completed:

✅ `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); console.log(typeof m.loadRequirements, typeof m.matchRequirementsByKeywords, typeof m.formatRequirementsSection)"` — outputs "function function function"

✅ `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const reqs = m.loadRequirements('.'); console.log('loaded:', reqs.length, 'requirements')"` — outputs "loaded: 237 requirements"

✅ `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const reqs = m.loadRequirements('.'); const matched = m.matchRequirementsByKeywords(reqs, 'quorum dispatch slot timeout', null); console.log('matched:', matched.length, matched.map(r=>r.id).join(', '))"` — shows relevant DISP/QUORUM requirements

✅ `node --test bin/quorum-slot-dispatch.test.cjs` — all 39 tests pass (0 failures)

✅ `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const p = m.buildModeAPrompt({round:1, repoDir:'.', question:'quorum dispatch review', requirements: m.matchRequirementsByKeywords(m.loadRequirements('.'), 'quorum dispatch review', null)}); console.log(p.includes('APPLICABLE REQUIREMENTS'))"` — prints true

✅ `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const p = m.buildModeAPrompt({round:1, repoDir:'.', question:'random unrelated stuff'}); console.log(p.includes('APPLICABLE REQUIREMENTS'))"` — prints false (no injection when no match)

## Files Modified

- **bin/quorum-slot-dispatch.cjs** — Added 3 exported functions (loadRequirements, matchRequirementsByKeywords, formatRequirementsSection); modified buildModeAPrompt/buildModeBPrompt to accept and inject requirements; updated main() to load and match requirements
- **bin/quorum-slot-dispatch.test.cjs** — Added 12 comprehensive tests for requirements functionality

## Architecture

The implementation follows the fail-open pattern:
- Missing or malformed `.formal/requirements.json` does not break dispatch
- Prompts are constructed exactly as before when no requirements match
- Requirements injection is purely additive — no existing prompt structure changed
- Stopword filtering ensures keyword matching is focused on meaningful terms
- Artifact path category mapping provides strong contextual signals (e.g., hooks/qgsd-stop.js automatically scores hook/enforcement requirements higher)

## Success Criteria Met

✅ Quorum dispatch prompts include relevant requirements subset based on question/artifact keyword matching
✅ Requirements section injected between question and instruction block, giving agents concrete acceptance criteria
✅ Matching is capped at 20 requirements to prevent prompt bloat
✅ Fail-open: missing/malformed requirements.json does not break dispatch
✅ All existing tests continue to pass; 12 new tests cover the feature

## No Deviations

The plan was executed exactly as specified. No auto-fixes or deviations were required.

---

**Commit:** 12fe407e
**Date:** 2026-03-04
**Duration:** ~10 minutes
**Tests Passing:** 39/39
