---
phase: quick-170
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/quorum-slot-dispatch.cjs
  - bin/quorum-slot-dispatch.test.cjs
autonomous: true
requirements: [QUICK-170]
formal_artifacts: none

must_haves:
  truths:
    - "Quorum slot prompts include relevant requirements when a question or artifact path maps to known categories"
    - "Requirements matching is keyword-based on question text and artifact path, selecting by category_raw and category group"
    - "When no requirements match, prompts are unchanged (no empty section injected)"
    - "Requirements injection is capped to prevent prompt bloat (max ~20 requirements)"
    - "Fail-open: if requirements.json is missing or malformed, prompt construction proceeds without requirements"
  artifacts:
    - path: "bin/quorum-slot-dispatch.cjs"
      provides: "Requirements-aware prompt construction"
      contains: "loadRelevantRequirements"
    - path: "bin/quorum-slot-dispatch.test.cjs"
      provides: "Tests for requirements matching and injection"
      contains: "loadRelevantRequirements"
  key_links:
    - from: "bin/quorum-slot-dispatch.cjs"
      to: ".formal/requirements.json"
      via: "fs.readFileSync at prompt build time"
      pattern: "requirements\\.json"
    - from: "bin/quorum-slot-dispatch.cjs buildModeAPrompt"
      to: "loadRelevantRequirements"
      via: "injects requirements section into prompt"
      pattern: "APPLICABLE REQUIREMENTS"
---

<objective>
Inject a relevant subset of `.formal/requirements.json` into quorum dispatch prompts so external agents can make better-informed judgments grounded in project requirements.

Purpose: Currently, quorum agents receive the question and are told to read CLAUDE.md and STATE.md, but have no knowledge of the 237 formal requirements. This means agents cannot check whether a proposed change satisfies or violates specific requirements. By injecting a matched subset (based on keywords from the question and artifact path), agents gain concrete acceptance criteria to evaluate against.

Output: Modified `bin/quorum-slot-dispatch.cjs` with requirements-matching logic and prompt injection, plus tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/quorum-slot-dispatch.cjs
@bin/quorum-slot-dispatch.test.cjs
@.formal/requirements.json
@.formal/category-groups.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add requirements matching and loading logic to quorum-slot-dispatch.cjs</name>
  <files>bin/quorum-slot-dispatch.cjs</files>
  <action>
Add three new exported pure functions to bin/quorum-slot-dispatch.cjs:

1. `loadRequirements(projectRoot)` — reads `.formal/requirements.json` from projectRoot, returns the `requirements` array. Fail-open: returns `[]` if file missing, malformed, or any error. Cache in a module-level variable keyed by projectRoot so repeated calls in the same process don't re-read disk.

2. `matchRequirementsByKeywords(requirements, question, artifactPath)` — takes the full requirements array, the question string, and an optional artifact path. Returns a filtered array of matching requirements (max 20). Matching algorithm:
   - Build a keyword set from the question and artifact path by extracting meaningful tokens (split on spaces, slashes, hyphens, dots; lowercase; filter out stopwords like "the", "a", "is", "it", "to", "of", "and", "or", "in", "for", "this", "that", "with", "from", "be", "are", "was", "has", "have", "do", "does", "not", "but", "an", "on", "at", "by", "we", "should", "would", "could", "will", "can", "what", "how", "why", "when", "which", etc.)
   - For each requirement, check if its `id` prefix (e.g. "DISP" from "DISP-01"), `category_raw`, `category` (group), or `text` contains any keyword. Score by number of keyword hits.
   - Sort by score descending, return top 20.
   - Also match on artifact path segments: if path contains "hook" match "Hooks & Enforcement", "quorum"/"dispatch" match "Quorum & Dispatch", "install" match "Installer & CLI", "mcp"/"agent"/"slot" match "MCP & Agents", "formal"/"alloy"/"tla"/"prism" match "Formal Verification", "config" match "Configuration", "plan"/"state" match "Planning & Tracking", "test" match "Testing & Quality", "observe"/"telemetry"/"scoreboard" match "Observability & Diagnostics".
   - Category group matches give +3 score boost (stronger signal than individual word hits).

3. `formatRequirementsSection(requirements)` — takes an array of requirement objects, returns a formatted string block:
   ```
   === APPLICABLE REQUIREMENTS ===
   The following project requirements are relevant to this review.
   Consider whether the proposed change satisfies or violates these:

   - [DISP-01] Dispatch uses slot names from providers.json (Quorum & Dispatch)
   - [DISP-02] Fan-out count is proportional to risk_level (Quorum & Dispatch)
   ...
   ================================
   ```
   If the array is empty, return `null` (not an empty section).

Then modify `buildModeAPrompt` and `buildModeBPrompt` to accept an optional `requirements` parameter (array of requirement objects). After the "Repository:" and "Question:" lines, if requirements is non-empty, call `formatRequirementsSection` and inject the result. This keeps requirements near the top of the prompt where they have the most influence on agent reasoning.

Modify the `main()` function: after building `repoDir` (line ~523), call `loadRequirements(repoDir)` then `matchRequirementsByKeywords(allReqs, question, artifactPath)` and pass the result as `requirements` to the prompt builder.

Export all three new functions via module.exports for testing.

IMPORTANT: This must be fail-open. If loadRequirements throws or returns [], the prompt should be constructed exactly as before (no requirements section). Never let requirements injection crash the dispatch.
  </action>
  <verify>
Run: `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); console.log(typeof m.loadRequirements, typeof m.matchRequirementsByKeywords, typeof m.formatRequirementsSection)"` — should print "function function function".

Run: `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const reqs = m.loadRequirements('$(pwd)'); console.log('loaded:', reqs.length, 'requirements')"` — should print "loaded: 237 requirements".

Run: `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const reqs = m.loadRequirements('$(pwd)'); const matched = m.matchRequirementsByKeywords(reqs, 'quorum dispatch slot timeout', null); console.log('matched:', matched.length, matched.map(r=>r.id).join(', '))"` — should show relevant DISP/COMP/etc requirements.
  </verify>
  <done>
buildModeAPrompt and buildModeBPrompt include a requirements section when relevant requirements match. Prompts without matches are unchanged. All functions exported and fail-open.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for requirements matching and prompt injection</name>
  <files>bin/quorum-slot-dispatch.test.cjs</files>
  <action>
Add tests to the existing bin/quorum-slot-dispatch.test.cjs file (append after existing tests):

1. **loadRequirements smoke test**: Call `loadRequirements(process.cwd())`. Assert result is an array with length > 200. Assert each element has `id`, `text`, `category` fields.

2. **loadRequirements fail-open**: Call `loadRequirements('/nonexistent/path')`. Assert returns empty array (no throw).

3. **matchRequirementsByKeywords — quorum keywords**: Call with question "quorum dispatch timeout slot". Assert result length > 0 and <= 20. Assert at least one result has id starting with "DISP" or category containing "Quorum".

4. **matchRequirementsByKeywords — hook keywords**: Call with question "stop hook enforcement oscillation". Assert at least one result has category containing "Hooks" or "Enforcement".

5. **matchRequirementsByKeywords — artifact path matching**: Call with question "review this" and artifactPath "hooks/qgsd-stop.js". Assert results include hook/enforcement-related requirements.

6. **matchRequirementsByKeywords — no matches for gibberish**: Call with question "xyzzy flurble 12345". Assert returns empty array.

7. **matchRequirementsByKeywords — cap at 20**: Call with a very broad question like "quorum hook install config test formal plan observe". Assert result length <= 20.

8. **formatRequirementsSection — formats correctly**: Create 2 mock requirements `[{id:'TEST-01', text:'test text', category:'Testing'}]`. Call formatRequirementsSection. Assert output contains "APPLICABLE REQUIREMENTS", contains "[TEST-01]", contains "test text".

9. **formatRequirementsSection — empty array returns null**: Call with `[]`. Assert returns `null`.

10. **buildModeAPrompt includes requirements when provided**: Call buildModeAPrompt with `requirements: [{id:'R-01', text:'must validate', category:'Testing'}]`. Assert output contains "APPLICABLE REQUIREMENTS" and "[R-01]".

11. **buildModeAPrompt omits section when requirements empty**: Call buildModeAPrompt with `requirements: []`. Assert output does NOT contain "APPLICABLE REQUIREMENTS".

12. **buildModeBPrompt includes requirements when provided**: Same pattern as test 10 but for Mode B.

Run all tests with `node --test bin/quorum-slot-dispatch.test.cjs`.
  </action>
  <verify>
Run `node --test bin/quorum-slot-dispatch.test.cjs` — all tests pass (existing + new).
  </verify>
  <done>
12 new tests covering requirements loading, matching, formatting, and prompt injection. All pass alongside existing tests.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/quorum-slot-dispatch.test.cjs` — all tests pass
2. `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const p = m.buildModeAPrompt({round:1, repoDir:'.', question:'quorum dispatch review', requirements: m.matchRequirementsByKeywords(m.loadRequirements('.'), 'quorum dispatch review', null)}); console.log(p.includes('APPLICABLE REQUIREMENTS'))"` — prints true
3. `node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const p = m.buildModeAPrompt({round:1, repoDir:'.', question:'random unrelated stuff'}); console.log(p.includes('APPLICABLE REQUIREMENTS'))"` — prints false (no injection when no match)
</verification>

<success_criteria>
- Quorum dispatch prompts include relevant requirements subset based on question/artifact keyword matching
- Requirements section is injected between the question and the instruction block, giving agents concrete acceptance criteria
- Matching is capped at 20 requirements to prevent prompt bloat
- Fail-open: missing/malformed requirements.json does not break dispatch
- All existing tests continue to pass; 12 new tests cover the feature
</success_criteria>

<output>
After completion, create `.planning/quick/170-inject-relevant-requirements-subset-into/170-SUMMARY.md`
</output>
