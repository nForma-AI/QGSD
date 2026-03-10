---
phase: quick-267
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/requirement-map.cjs
  - .planning/formal/check-results.ndjson
  - .planning/formal/traceability-matrix.json
  - .planning/formal/gates/gate-a-grounding.json
  - .planning/formal/gates/per-model-gates.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix 41 Gate A grounding failures caused by empty requirement_ids in check-results.ndjson.

Root cause: 41 formal models pass their Alloy/TLA+ checks (check results exist with result=pass),
but the check_id->requirement_ids mapping is missing from bin/requirement-map.cjs. The traceability
matrix builder uses this mapping to link check results to requirements. Without it, latest_result
stays null and Gate A reports "no passing traces."

Fix: Add 41 entries to bin/requirement-map.cjs, then re-run the formal verification pipeline
to regenerate check-results.ndjson with populated requirement_ids, rebuild the traceability matrix,
and refresh gate scores.
</objective>

<tasks>
<task type="auto">
  <name>Add 41 missing check_id entries to requirement-map.cjs</name>
  <files>bin/requirement-map.cjs</files>
  <action>
Add the following 41 entries to the CHECK_ID_TO_REQUIREMENTS map in bin/requirement-map.cjs,
grouped under a new comment section "── Generated model checks ──":

Alloy checks (38):
- alloy:baseline-merge-idempotent -> [INST-12]
- alloy:baseline-requirements-filter -> [INIT-01]
- alloy:bin-path-resolution -> [INST-11]
- alloy:code-quality-guardrails -> [GUARD-01]
- alloy:config-audit -> [CONF-13]
- alloy:config-zero-providers -> [CONF-10]
- alloy:debate-trace-persistence -> [DISP-07]
- alloy:dispatch-formal-context -> [DISP-06]
- alloy:doc-claims-backing -> [DOC-01]
- alloy:doc-presentation -> [DOC-02, DOC-03]
- alloy:formal-test-trace -> [TRACE-06]
- alloy:gate-scoring-traces -> [GATE-05, TRACE-10]
- alloy:headless-execution -> [VERIFY-03]
- alloy:health-diagnostic-routing -> [OBS-16]
- alloy:hook-module-existence -> [SOLVE-19, SOLVE-20, SOLVE-21, SOLVE-22, SOLVE-23]
- alloy:hook-portability-guard -> [GUARD-02, PORT-04]
- alloy:jvm-heap-sequential -> [VERIFY-04]
- alloy:observability-handler-arch -> [OBS-13, OBS-14, OBS-15]
- alloy:platform-install-compat -> [PLAT-01]
- alloy:polyrepo-config -> [CONF-11, CONF-12]
- alloy:prism-delegation -> [FVTOOL-02]
- alloy:project-identity -> [PROJECT-01, PROJECT-02]
- alloy:proximity-index -> [TRACE-09]
- alloy:requirements-aggregation -> [SOLVE-18]
- alloy:session-counter-tracking -> [SPEC-07]
- alloy:settings-hub -> [WIZ-11]
- alloy:solve-automation-features -> [SOLVE-09]
- alloy:solve-decomposition -> [SOLVE-14, SOLVE-15]
- alloy:solve-diagnostics-tui -> [SOLVE-24, SOLVE-25]
- alloy:solve-ft-recipe -> [SOLVE-7]
- alloy:solve-legacy-merge -> [SOLVE-8]
- alloy:solve-result-schema -> [SOLVE-11, SOLVE-12]
- alloy:solve-tc-coverage -> [SOLVE-10]
- alloy:solve-tui-features -> [SOLVE-16, SOLVE-17]
- alloy:spec-quality-guardrails -> [SPEC-06]
- alloy:terminal-emulation-purity -> [NAV-03]
- alloy:trace-event-normalization -> [TRACE-08]
- alloy:wiring-awareness -> [VERIFY-05]

TLA+ checks (3):
- tla:QGSDCheckpointGate -> [QUORUM-06]
- tla:QGSDTUIModules -> [NAV-01]
- tla:QGSDTUISessions -> [NAV-02]
  </action>
  <verify>node bin/requirement-map.test.cjs (if exists) OR node -e "const {getRequirementIds}=require('./bin/requirement-map.cjs'); console.log(getRequirementIds('alloy:config-zero-providers'));" should return ["CONF-10"]</verify>
  <done>All 41 check_ids return their correct requirement_ids from getRequirementIds()</done>
</task>

<task type="auto">
  <name>Re-run formal verification to regenerate check-results and traceability data</name>
  <files>.planning/formal/check-results.ndjson, .planning/formal/traceability-matrix.json, .planning/formal/gates/gate-a-grounding.json, .planning/formal/gates/per-model-gates.json</files>
  <action>
1. Run: node bin/run-formal-verify.cjs --project-root=$(pwd) (or nf-bin fallback)
   This regenerates check-results.ndjson with requirement_ids populated
2. Run: node bin/build-traceability-matrix.cjs (or equivalent) to rebuild the matrix
3. Run: node bin/gate-a-grounding.cjs (or equivalent) to refresh gate scores
4. Verify gate_a residual has decreased
  </action>
  <verify>Check that gate-a-grounding.json grounding_score has improved from 0.772 toward 1.0</verify>
  <done>check-results.ndjson entries for the 41 models now have populated requirement_ids, traceability matrix shows latest_result for previously-null entries, and gate-a-grounding.json score improved</done>
</task>
</tasks>
</content>
</invoke>