---
phase: quick-297
plan: 297
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/reasoning/failure-mode-catalog.json
  - .planning/formal/test-recipes/test-recipes.json
  - .planning/formal/model-registry.json
  - .planning/formal/gates/per-model-gates.json
  - .planning/formal/gates/gate-a-grounding.json
  - .planning/formal/gates/gate-b-abstraction.json
  - .planning/formal/gates/gate-c-validation.json
autonomous: true
requirements: [AGT-01, QUORUM-06, NAV-01, NAV-02, NAV-04, TUI-01, TUI-02, TUI-03, TUI-04, TUI-05, TUI-06, QUORUM-01, QUORUM-02, QUORUM-03]
formal_artifacts: none
---

<objective>
Close 9 Gate C failures by:
1. Adding 11 failure modes to failure-mode-catalog.json for requirements AGT-01, QUORUM-06, NAV-01, NAV-02, NAV-04, TUI-01-06
2. Adding 11 matching test recipes to test-recipes.json
3. Adding requirement mappings (QUORUM-01/02/03) to 3 unmapped quorum models (quorum.pm, NFQuorum.tla, NFQuorum_xstate.tla)
4. Re-running compute-per-model-gates to verify Gate C score reaches 1.0
</objective>
