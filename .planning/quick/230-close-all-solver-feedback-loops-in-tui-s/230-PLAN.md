---
phase: quick-230
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/solve-tui.cjs
  - bin/nForma.cjs
  - bin/nf-solve.cjs
  - bin/requirements-core.cjs
autonomous: true
requirements: [QUICK-230]
formal_artifacts: none

must_haves:
  truths:
    - "C->R, T->R, and D->R items in TUI Solve show a 'Create Requirement' action that writes to requirements.json"
    - "D->C items in TUI Solve show a 'Create TODO' action that writes to .planning/todos.json"
    - "D->C items matching known rebrand patterns (qgsd-core->core, qgsd->nf) are auto-suppressed in sweepDtoC"
    - "Existing Acknowledge and Regex Suppression actions still work unchanged"
  artifacts:
    - path: "bin/requirements-core.cjs"
      provides: "addRequirement() function for appending to requirements.json"
      exports: ["addRequirement"]
    - path: "bin/solve-tui.cjs"
      provides: "createRequirementFromItem() and createTodoFromItem() helpers"
      exports: ["createRequirementFromItem", "createTodoFromItem"]
    - path: "bin/nForma.cjs"
      provides: "Category-aware action menus in showItemDetail()"
    - path: "bin/nf-solve.cjs"
      provides: "Rebrand pattern auto-suppression in sweepDtoC()"
  key_links:
    - from: "bin/nForma.cjs showItemDetail()"
      to: "bin/solve-tui.cjs createRequirementFromItem()"
      via: "solveTui.createRequirementFromItem(item, catKey)"
      pattern: "createRequirementFromItem"
    - from: "bin/solve-tui.cjs createRequirementFromItem()"
      to: "bin/requirements-core.cjs addRequirement()"
      via: "requirementsCore.addRequirement(reqObj)"
      pattern: "addRequirement"
    - from: "bin/nForma.cjs showItemDetail()"
      to: "bin/solve-tui.cjs createTodoFromItem()"
      via: "solveTui.createTodoFromItem(item)"
      pattern: "createTodoFromItem"
---

<objective>
Close all solver feedback loops in the TUI Solve module by adding category-aware actions: "Create Requirement" for C->R, T->R, D->R items (human judges whether code/test/doc behavior deserves a requirement) and "Create TODO" for D->C items (human tracks remaining broken claims). Additionally, auto-suppress D->C items matching known rebrand patterns to reduce noise.

Purpose: Currently the TUI can only acknowledge items as false positives or add regex suppressions. This leaves no path to actually resolve items by creating requirements or tracking work. These feedback loops complete the solver's human-gated workflow.

Output: Updated bin/nForma.cjs, bin/solve-tui.cjs, bin/requirements-core.cjs, bin/nf-solve.cjs
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/nForma.cjs
@bin/solve-tui.cjs
@bin/requirements-core.cjs
@bin/nf-solve.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add requirement creation and TODO helpers to solve-tui and requirements-core</name>
  <files>bin/requirements-core.cjs, bin/solve-tui.cjs</files>
  <action>
**In bin/requirements-core.cjs:**

Add an `addRequirement(reqObj, basePath)` function that:
1. Reads requirements.json from `basePath || process.cwd()`
2. Validates reqObj has `id`, `text`, `category`, `status` fields
3. Checks for duplicate ID (returns `{ ok: false, reason: 'duplicate' }` if exists)
4. Appends the new requirement to the `requirements` array
5. Updates `aggregated_at` timestamp, recomputes `content_hash` (use same pattern as existing hash — take first 16 hex chars of a hash of JSON.stringify(requirements))
6. Removes the `frozen_at` field since the envelope is no longer frozen (frozen_at indicates a snapshot — adding a req unfreezes it)
7. Writes back atomically (write to .tmp then rename)
8. Returns `{ ok: true, id: reqObj.id }`
9. Export `addRequirement` in module.exports

Also add a `nextRequirementId(prefix, basePath)` helper that:
1. Reads requirements.json
2. Finds all IDs starting with `prefix + '-'` (e.g., `SOLVE-`)
3. Returns `prefix + '-' + (maxNumber + 1)` zero-padded to 2 digits
4. Export in module.exports

**In bin/solve-tui.cjs:**

Add `createRequirementFromItem(item, catKey)` helper that:
1. Requires `requirements-core.cjs`
2. Maps catKey to a description prefix: ctor -> "Code module", ttor -> "Test file", dtor -> "Doc claim"
3. Generates an ID using `nextRequirementId('SOLVE')`
4. Builds requirement object: `{ id, text: prefix + ': ' + (item.file || item.claim_text || item.value), category: 'Solver-Discovered', status: 'Proposed', provenance: { source_file: item.file || item.doc_file, milestone: 'solver-tui' } }`
5. Calls `addRequirement(reqObj)` and returns the result

Add `createTodoFromItem(item)` helper that:
1. Reads `.planning/todos.json` (create if missing, schema: `{ created_at, items: [] }`)
2. Appends `{ id: 'TODO-' + timestamp, source: 'solver-dtoc', file: item.doc_file, value: item.value, reason: item.reason, line: item.line, created_at: ISO timestamp }`
3. Writes back atomically
4. Returns `{ ok: true, id }`

Export both new functions in the `module.exports` block (inside the `else` branch at line ~934).
  </action>
  <verify>
Run: `node -e "const rc = require('./bin/requirements-core.cjs'); console.log(typeof rc.addRequirement, typeof rc.nextRequirementId)"` — should print "function function".
Run: `node -e "const st = require('./bin/solve-tui.cjs'); console.log(typeof st.createRequirementFromItem, typeof st.createTodoFromItem)"` — should print "function function".
Run existing test suite: `node bin/requirements-core.test.cjs 2>/dev/null; echo $?` (if test file exists).
  </verify>
  <done>
requirements-core.cjs exports addRequirement() and nextRequirementId(). solve-tui.cjs exports createRequirementFromItem() and createTodoFromItem(). Both callable without errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire category-aware actions into TUI showItemDetail and add D->C auto-suppression</name>
  <files>bin/nForma.cjs, bin/nf-solve.cjs</files>
  <action>
**In bin/nForma.cjs → showItemDetail() (around line 3049-3058):**

Replace the static action menu with category-aware menus:

For catKey `ctor`, `ttor`, `dtor`:
```
const actionChoice = await promptList({ title: 'Item Actions', items: [
  { label: 'Create Requirement', value: 'create-req' },
  { label: 'Acknowledge as FP', value: 'ack' },
  { label: 'Add Regex Suppression', value: 'regex' },
  { label: 'Back', value: 'back' },
] });
```

For catKey `dtoc`:
```
const actionChoice = await promptList({ title: 'Item Actions', items: [
  { label: 'Create TODO', value: 'create-todo' },
  { label: 'Acknowledge as FP', value: 'ack' },
  { label: 'Add Regex Suppression', value: 'regex' },
  { label: 'Back', value: 'back' },
] });
```

Add handler for `create-req`:
```javascript
if (actionChoice.value === 'create-req') {
  const result = solveTui.createRequirementFromItem(item, catKey);
  if (result.ok) {
    toast(`Requirement ${result.id} created in requirements.json`);
  } else {
    toast(`Error: ${result.reason}`, true);
  }
}
```

Add handler for `create-todo`:
```javascript
if (actionChoice.value === 'create-todo') {
  const result = solveTui.createTodoFromItem(item);
  if (result.ok) {
    toast(`TODO ${result.id} added to .planning/todos.json`);
  } else {
    toast(`Error creating TODO`, true);
  }
}
```

Also update the hint line (line ~3049) to show the correct actions for the category:
- For ctor/ttor/dtor: `'Actions: Create Requirement | Acknowledge as FP | Add Regex Suppression | Back'`
- For dtoc: `'Actions: Create TODO | Acknowledge as FP | Add Regex Suppression | Back'`

**In bin/nf-solve.cjs → sweepDtoC() (around line 1405-1423):**

After the existing acknowledged FP check and before the pattern-based suppression check, add rebrand auto-suppression:

```javascript
// Auto-suppress known rebrand patterns (qgsd->nf renames from quick-186)
const REBRAND_PATTERNS = [
  /qgsd-core\//,          // old qgsd-core/ directory references
  /qgsd[_-](?!.*\.md$)/,  // qgsd- or qgsd_ prefixes (not in .md filenames which are historical)
  /\/qgsd\//,             // /qgsd/ path segments
];
if (claim.type === 'file_path') {
  const isRebrandArtifact = REBRAND_PATTERNS.some(rx => rx.test(claim.value));
  if (isRebrandArtifact) {
    suppressedFpCount++;
    continue;
  }
}
```

Place this AFTER the acknowledged FP check (line ~1410) but BEFORE the pattern-based suppression (line ~1414). This keeps the logic cleanly separated: manual FP acks first, then auto rebrand suppression, then user-defined regex patterns.
  </action>
  <verify>
Run: `node -e "const nfs = require('./bin/nf-solve.cjs'); const r = nfs.sweepDtoC(); console.log('dtoc residual:', r.residual, 'broken:', r.detail?.broken_claims?.length || 0)"` — residual should be lower than before due to rebrand suppression.
Run: `grep -c 'create-req\|create-todo\|createRequirementFromItem\|createTodoFromItem' bin/nForma.cjs` — should return 4+ matches.
Run: `grep -c 'REBRAND_PATTERNS' bin/nf-solve.cjs` — should return 1+ match.
Load test: `node -e "require('./bin/nForma.cjs')"` should not throw (module loads cleanly).
  </verify>
  <done>
TUI Solve detail view shows "Create Requirement" for ctor/ttor/dtor categories and "Create TODO" for dtoc category. D->C sweep auto-suppresses rebrand path patterns. All existing actions (Acknowledge, Regex Suppression) still present and functional.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const rc = require('./bin/requirements-core.cjs'); console.log(Object.keys(rc))"` includes addRequirement, nextRequirementId
2. `node -e "const st = require('./bin/solve-tui.cjs'); console.log(Object.keys(st))"` includes createRequirementFromItem, createTodoFromItem
3. `grep 'create-req' bin/nForma.cjs` returns matches in showItemDetail
4. `grep 'create-todo' bin/nForma.cjs` returns matches in showItemDetail
5. `grep 'REBRAND_PATTERNS' bin/nf-solve.cjs` returns match in sweepDtoC
6. `node -e "require('./bin/nForma.cjs')"` loads without error
7. `node -e "require('./bin/nf-solve.cjs')"` loads without error
</verification>

<success_criteria>
- All four solver feedback loops are closed: ctor->req, ttor->req, dtor->req (via Create Requirement), dtoc->todo (via Create TODO)
- D->C items matching rebrand patterns (qgsd-core/, qgsd- prefixes) are automatically suppressed
- Existing acknowledge-as-FP and regex-suppression actions remain functional
- All modified files load without errors
- TUI navigation invariant (EscapeProgress) is preserved: no new depth levels added, all new actions are leaf operations within existing showItemDetail depth
</success_criteria>

<output>
After completion, create `.planning/quick/230-close-all-solver-feedback-loops-in-tui-s/230-SUMMARY.md`
</output>
