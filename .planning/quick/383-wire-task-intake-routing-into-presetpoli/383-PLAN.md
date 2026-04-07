---
phase: quick-383
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/routing-policy.cjs
  - bin/routing-policy.test.cjs
  - commands/nf/quick.md
  - core/workflows/help.md
autonomous: true
formal_artifacts: none
requirements: []

must_haves:
  truths:
    - "PresetPolicy accepts an optional routingHint and prefers the hinted slot when it is eligible (subprocess + has_file_access)"
    - "PresetPolicy falls back to first-eligible-subprocess when routingHint is invalid or ineligible"
    - "quick.md argument-hint includes --delegate and --force-quorum flags"
    - "help.md documents --delegate, --full, and --force-quorum flags for /nf:quick"
  artifacts:
    - path: "bin/routing-policy.cjs"
      provides: "PresetPolicy.recommend with optional routingHint parameter"
      contains: "routingHint"
    - path: "bin/routing-policy.test.cjs"
      provides: "Tests for routingHint preference and fallback"
      contains: "routingHint"
    - path: "commands/nf/quick.md"
      provides: "Updated argument-hint with --delegate"
      contains: "--delegate"
    - path: "core/workflows/help.md"
      provides: "Delegation docs in /nf:quick section"
      contains: "--delegate"
  key_links:
    - from: "bin/routing-policy.cjs"
      to: "agents/skills/task-intake/SKILL.md"
      via: "routingHint parameter matches task-intake routing.executor output"
      pattern: "routingHint"
---

<objective>
Wire task-intake routing recommendations into PresetPolicy, update nf:quick command metadata with --delegate flag, and add delegation usage docs to help output.

Purpose: Close three gaps — PresetPolicy ignores task-intake routing hints, quick.md metadata is outdated, and help.md lacks delegation docs.
Output: Updated routing-policy.cjs with routingHint support, updated quick.md frontmatter, updated help.md with delegation docs.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/routing-policy.cjs
@bin/routing-policy.test.cjs
@commands/nf/quick.md
@core/workflows/help.md
@agents/skills/task-intake/SKILL.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add routingHint parameter to PresetPolicy and tests</name>
  <files>bin/routing-policy.cjs, bin/routing-policy.test.cjs</files>
  <action>
Modify `PresetPolicy.recommend()` to accept an optional third parameter `routingHint` (object or string).

In `bin/routing-policy.cjs`:

1. Change the `recommend` method signature to `recommend(taskType, providers, routingHint)`.

2. After the existing `if (!Array.isArray(providers))` guard, add hint-preference logic BEFORE the existing `providers.find()` fallback:
   - If `routingHint` is truthy (either a string slot name or an object with `.executor` property like task-intake outputs), extract the hint name:
     - If string: use directly
     - If object with `.executor`: use `routingHint.executor`
   - Find a provider matching: `p.name` contains the hint name (case-insensitive substring match) AND `p.type === 'subprocess'` AND `p.has_file_access === true`
   - If found, return `makePolicyResult({ recommendation: candidate.name, confidence: 1.0, evidenceCount: 0, recentStability: 1.0, reason: 'preset:routing-hint-match' })`
   - If NOT found, fall through to the existing first-eligible logic (no error, just ignore the invalid hint)

3. The existing first-eligible-subprocess logic remains unchanged as the fallback path.

4. Also update `selectSlotWithPolicy` to accept `opts.routingHint` and pass it through to preset policy (index 0). Change line ~334 to pass routingHint: `return p.recommend(taskType, providers, opts.routingHint)` for the preset policy call. Since RiverPolicy does not use routingHint, it will simply ignore the extra argument.

In `bin/routing-policy.test.cjs`:

Add 4 new tests after the existing PresetPolicy tests (after line ~108):

a. `PresetPolicy.recommend prefers routingHint string when eligible` — pass `routingHint='gemini-1'` with PROVIDERS array, assert recommendation is `gemini-1` (not `codex-1` which would be first-eligible).

b. `PresetPolicy.recommend prefers routingHint object with executor field` — pass `routingHint={ executor: 'gemini-1', reason: 'test' }` with PROVIDERS, assert recommendation is `gemini-1`.

c. `PresetPolicy.recommend falls back when routingHint is ineligible` — pass `routingHint='claude-1'` (which is type=http, not subprocess) with PROVIDERS, assert recommendation is `codex-1` (first-eligible fallback).

d. `PresetPolicy.recommend falls back when routingHint names unknown slot` — pass `routingHint='nonexistent-slot'` with PROVIDERS, assert recommendation is `codex-1`.

e. `selectSlotWithPolicy passes routingHint to preset` — call `selectSlotWithPolicy('implement', PROVIDERS, { routingHint: 'gemini-1', policies: [new PresetPolicy()] })`, assert slot is `gemini-1`.
  </action>
  <verify>
Run `node --test bin/routing-policy.test.cjs` — all existing tests still pass plus 5 new tests pass. Specifically verify:
- Existing `PresetPolicy.recommend returns first subprocess+file_access provider` still passes (no regression)
- New hint tests pass showing preference and fallback behavior
  </verify>
  <done>
PresetPolicy accepts routingHint, prefers hinted eligible slot, falls back to first-eligible when hint is invalid. selectSlotWithPolicy passes routingHint through. All tests green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update quick.md metadata and help.md delegation docs</name>
  <files>commands/nf/quick.md, core/workflows/help.md</files>
  <action>
In `commands/nf/quick.md`:

1. Change line 4 from `argument-hint: "[--full]"` to `argument-hint: "[--full] [--delegate {slot}] [--force-quorum]"`

2. In the `<objective>` section, after the `--full` flag description block (after line 33), add a new paragraph:

```
**`--delegate {slot}` flag:** Delegates the entire task to a specific quorum slot (e.g., `codex-1`, `gemini-1`). The slot name is passed as a routing hint to PresetPolicy, which will prefer that slot if it is eligible (subprocess with file access). If the slot is ineligible, falls back to default routing.

**`--force-quorum` flag:** Forces quorum review even in non-full mode.
```

In `core/workflows/help.md`:

1. Replace lines 114-127 (the Quick Mode section) with an expanded version that includes flag documentation:

```markdown
### Quick Mode

**`/nf:quick`**
Execute small, ad-hoc tasks with nForma guarantees but skip optional agents.

Quick mode uses the same system with a shorter path:
- Spawns planner + executor (skips researcher, checker, verifier)
- Quick tasks live in `.planning/quick/` separate from planned phases
- Updates STATE.md tracking (not ROADMAP.md)

**Flags:**

| Flag | Effect |
|------|--------|
| `--full` | Enables plan-checking, verification, formal scope scan, and quorum review |
| `--delegate {slot}` | Delegates task to a specific slot (e.g., `codex-1`, `gemini-1`). Slot must be subprocess with file access |
| `--force-quorum` | Forces quorum review even without `--full` |

**Examples:**
- `/nf:quick` — default quick mode, minimal ceremony
- `/nf:quick --full` — with verification and formal checks
- `/nf:quick --delegate codex-1` — delegate to Codex
- `/nf:quick --full --delegate gemini-1` — full mode delegated to Gemini

Result: Creates `.planning/quick/NNN-slug/PLAN.md`, `.planning/quick/NNN-slug/SUMMARY.md`
```
  </action>
  <verify>
1. `grep 'delegate' commands/nf/quick.md` returns matches showing --delegate in argument-hint and objective
2. `grep 'delegate' core/workflows/help.md` returns matches showing --delegate in flags table and examples
3. `grep 'force-quorum' commands/nf/quick.md` returns a match
4. `grep 'force-quorum' core/workflows/help.md` returns a match
  </verify>
  <done>
quick.md argument-hint includes --delegate and --force-quorum. help.md /nf:quick section documents all three flags with a table and usage examples.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/routing-policy.test.cjs` — all tests pass (existing + 5 new)
2. `grep -n 'routingHint' bin/routing-policy.cjs` — shows hint logic in PresetPolicy.recommend and passthrough in selectSlotWithPolicy
3. `grep 'argument-hint' commands/nf/quick.md` — shows all three flags
4. `grep -c 'delegate' core/workflows/help.md` — multiple matches confirming docs added
</verification>

<success_criteria>
- PresetPolicy.recommend(taskType, providers, routingHint) prefers hinted slot when eligible, falls back when not
- selectSlotWithPolicy passes routingHint through to preset policy
- All existing tests pass (no regression), 5 new tests pass
- quick.md argument-hint: "[--full] [--delegate {slot}] [--force-quorum]"
- help.md /nf:quick section has flags table with --full, --delegate, --force-quorum plus examples
</success_criteria>

<output>
After completion, create `.planning/quick/383-wire-task-intake-routing-into-presetpoli/383-SUMMARY.md`
</output>
