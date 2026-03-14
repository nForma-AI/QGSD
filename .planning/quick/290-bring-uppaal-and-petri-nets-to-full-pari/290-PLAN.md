---
phase: quick-290
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/initialize-model-registry.cjs
  - bin/initialize-model-registry.test.cjs
  - bin/model-complexity-profile.cjs
  - bin/model-complexity-profile.test.cjs
autonomous: true
requirements: [UPPAAL-01, UPPAAL-02, UPPAAL-03]
formal_artifacts: none

must_haves:
  truths:
    - "UPPAAL .xml models appear in model-registry.json after initialization"
    - "Petri .dot models appear in model-registry.json after initialization"
    - "Complexity profiler resolves uppaal: and petri: check_ids to their model directories"
    - "Formalism detection in profiler correctly identifies uppaal and petri paths"
  artifacts:
    - path: "bin/initialize-model-registry.cjs"
      provides: "UPPAAL and Petri directory scanning"
      contains: "uppaal"
    - path: "bin/model-complexity-profile.cjs"
      provides: "UPPAAL and Petri formalism directory mapping"
      contains: "uppaal"
  key_links:
    - from: "bin/initialize-model-registry.cjs"
      to: ".planning/formal/uppaal/"
      via: "SCAN_DIRS entry for .xml files"
      pattern: "uppaal.*\\.xml"
    - from: "bin/initialize-model-registry.cjs"
      to: ".planning/formal/petri/"
      via: "SCAN_DIRS entry for .dot files"
      pattern: "petri.*\\.dot"
    - from: "bin/model-complexity-profile.cjs"
      to: ".planning/formal/uppaal/"
      via: "FORMALISM_DIR_MAP entry"
      pattern: "uppaal.*formal/uppaal"
    - from: "bin/model-complexity-profile.cjs"
      to: ".planning/formal/petri/"
      via: "FORMALISM_DIR_MAP entry"
      pattern: "petri.*formal/petri"
---

<objective>
Bring UPPAAL and Petri net formalisms to full parity with TLA+/Alloy/PRISM in the model registry and complexity profiler.

Purpose: UPPAAL (.xml) and Petri (.dot) models exist on disk and are already discovered by run-formal-verify.cjs, but initialize-model-registry.cjs only scans tla/alloy/prism directories, and model-complexity-profile.cjs FORMALISM_DIR_MAP only maps those three formalisms. This means UPPAAL/Petri models are invisible to the registry (no requirement traceability) and the profiler (no state-space matching or formalism detection).

Output: Both tools extended to handle all five formalisms; existing tests updated to cover new paths.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/289-wire-uppaal-and-petri-net-support-into-c/289-SUMMARY.md
@bin/initialize-model-registry.cjs
@bin/initialize-model-registry.test.cjs
@bin/model-complexity-profile.cjs
@bin/model-complexity-profile.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add UPPAAL and Petri scanning to initialize-model-registry.cjs</name>
  <files>bin/initialize-model-registry.cjs, bin/initialize-model-registry.test.cjs</files>
  <action>
1. In `bin/initialize-model-registry.cjs`, extend the `SCAN_DIRS` array (currently at line ~27-31) to include two new entries:
   - `{ dir: path.join(ROOT, '.planning', 'formal', 'uppaal'), exts: ['.xml'] }`
   - `{ dir: path.join(ROOT, '.planning', 'formal', 'petri'),  exts: ['.dot'] }`

   The existing loop at line ~40 already handles arbitrary dirs/exts, so no other code changes needed in the main script.

2. In `bin/initialize-model-registry.test.cjs`, add two tests:
   - "scans uppaal directory for .xml files": Create a temp formal dir with `uppaal/` containing `test-model.xml` (content: `<nta></nta>`). Run the tool. Assert the registry JSON contains a key matching `uppaal/test-model.xml` with `update_source: 'manual'`.
   - "scans petri directory for .dot files": Create a temp formal dir with `petri/` containing `test-net.dot` (content: `digraph { a -> b }`). Run the tool. Assert the registry JSON contains a key matching `petri/test-net.dot` with `update_source: 'manual'`.

   Follow the existing test pattern using `createTempFormalDir()` and `runInitializeTool()`.

3. Run: `node --test bin/initialize-model-registry.test.cjs` — all tests must pass.
  </action>
  <verify>
    node --test bin/initialize-model-registry.test.cjs 2>&1 | tail -5
    grep -c 'uppaal' bin/initialize-model-registry.cjs
  </verify>
  <done>
    initialize-model-registry.cjs SCAN_DIRS includes uppaal (.xml) and petri (.dot) entries. All tests pass including new coverage for both formalisms.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add UPPAAL and Petri to model-complexity-profile.cjs formalism mapping</name>
  <files>bin/model-complexity-profile.cjs, bin/model-complexity-profile.test.cjs</files>
  <action>
1. In `bin/model-complexity-profile.cjs`, extend `FORMALISM_DIR_MAP` (line ~62-66) to add:
   ```
   uppaal: '.planning/formal/uppaal/',
   petri:  '.planning/formal/petri/',
   ```

2. In the same file, fix the formalism detection logic in the "Process state-space models" section (line ~231). The current ternary chain only checks `/tla/`, `/alloy/`, `/prism/` in path strings. Add `uppaal` and `petri` detection:
   - Change the ternary to include: `modelPath.includes('/uppaal/') ? 'uppaal' : modelPath.includes('/petri/') ? 'petri' : 'unknown'`
   - The full chain should be: `tla ? 'tla' : alloy ? 'alloy' : prism ? 'prism' : uppaal ? 'uppaal' : petri ? 'petri' : 'unknown'`

3. In `bin/model-complexity-profile.test.cjs`, add tests:
   - "findStateSpaceMatch: uppaal:quorum-races matches quorum-races.xml": Test that `findStateSpaceMatch('uppaal:quorum-races', { '.planning/formal/uppaal/quorum-races.xml': { estimated_states: 100 } })` returns the model data (not null).
   - "findStateSpaceMatch: petri:account-manager matches account-manager-petri-net.dot": Test that `findStateSpaceMatch('petri:account-manager', { '.planning/formal/petri/account-manager-petri-net.dot': { estimated_states: 50 } })` returns the model data.

4. Run: `node --test bin/model-complexity-profile.test.cjs` — all tests must pass.
  </action>
  <verify>
    node --test bin/model-complexity-profile.test.cjs 2>&1 | tail -5
    grep -c 'uppaal\|petri' bin/model-complexity-profile.cjs
  </verify>
  <done>
    FORMALISM_DIR_MAP has 5 entries (tla, alloy, prism, uppaal, petri). Formalism detection in static model processing handles all 5. findStateSpaceMatch resolves uppaal: and petri: check_ids. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Regenerate model-registry.json and complexity profile with new formalisms</name>
  <files>.planning/formal/model-registry.json, .planning/formal/model-complexity-profile.json</files>
  <action>
1. Delete the existing model-registry.json so initialize-model-registry.cjs runs a fresh scan (it's idempotent-guarded — exits 0 if file exists):
   ```
   rm .planning/formal/model-registry.json
   node bin/initialize-model-registry.cjs
   ```

2. Verify the regenerated registry contains UPPAAL and Petri entries:
   ```
   grep -c 'uppaal\|petri' .planning/formal/model-registry.json
   ```
   Expected: at least 3 entries (1 uppaal .xml + 2 petri .dot files)

3. Regenerate complexity profile:
   ```
   node bin/model-complexity-profile.cjs
   ```

4. Verify profile contains uppaal/petri entries:
   ```
   grep -c 'uppaal\|petri' .planning/formal/model-complexity-profile.json
   ```

Note: The registry regeneration will lose existing metadata (descriptions, requirements, source_layer, gate_maturity) for TLA+/Alloy/PRISM models since initialize-model-registry only populates basic fields. This is acceptable because observe-registry.cjs and close-formal-gaps workflow re-populate metadata during normal operations. The key gain is getting UPPAAL/Petri models INTO the registry so they participate in the metadata lifecycle.
  </action>
  <verify>
    grep '"\.planning/formal/uppaal/' .planning/formal/model-registry.json | head -3
    grep '"\.planning/formal/petri/' .planning/formal/model-registry.json | head -3
    grep 'uppaal\|petri' .planning/formal/model-complexity-profile.json | head -5
  </verify>
  <done>
    model-registry.json contains entries for .planning/formal/uppaal/quorum-races.xml and .planning/formal/petri/*.dot files. model-complexity-profile.json includes uppaal and petri formalism entries.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/initialize-model-registry.test.cjs` — all pass
2. `node --test bin/model-complexity-profile.test.cjs` — all pass
3. `grep -c 'uppaal' bin/initialize-model-registry.cjs` >= 1
4. `grep -c 'uppaal' bin/model-complexity-profile.cjs` >= 2
5. `grep '"\.planning/formal/uppaal/' .planning/formal/model-registry.json` shows quorum-races.xml entry
6. `grep '"\.planning/formal/petri/' .planning/formal/model-registry.json` shows .dot entries
</verification>

<success_criteria>
- UPPAAL and Petri models are registered in model-registry.json alongside TLA+/Alloy/PRISM
- Complexity profiler can resolve uppaal: and petri: check_ids to state-space data
- Formalism detection correctly identifies uppaal and petri model paths
- All existing + new tests pass for both modified scripts
- Regenerated artifacts on disk reflect the new formalisms
</success_criteria>

<output>
After completion, create `.planning/quick/290-bring-uppaal-and-petri-nets-to-full-pari/290-SUMMARY.md`
</output>
