# 387-AUDIT.md — Baseline Sync + Formal Model Audit

## Sync Result

- **Before:** 465 requirements
- **Added:** 0 new requirements
- **Skipped:** 13 (already present by text match: SEC-01/02/03/04, REL-01/02, OBS-01, CI-01/02/03, UX-01/02/03)
- **After:** 465 requirements
- **Verdict:** IDEMPOTENT — requirements.json is already up-to-date

---

## Formal Model Audit

### TLA+ Models

#### 1. NFDistTag.tla
- **Path:** `.planning/formal/tla/NFDistTag.tla`
- **Verdict:** SOUND
- **Reasoning:**
  - Has `MODULE NFDistTag` header and `EXTENDS Naturals, TLC`
  - Has `TypeOK` invariant with full type definitions for all variables
  - Has `Init`, `Next`, `Spec` definitions
  - Has `@requirement DIST-01` annotations on TypeOK, PublishStable, AlignNext, Complete, and safety invariants
  - DIST-01 exists in requirements.json (dist-tag ordering invariant)
  - Actions have real definitions: `PublishStable`, `AlignNext`, `Complete`, `Reset`, `Done`
  - Safety invariants are non-trivial: `NextNeverBehindLatest`, `AlignedAfterStablePublish`, `VersionsMonotone`
  - Not hollow scaffolding

#### 2. NFRiverPolicy.tla
- **Path:** `.planning/formal/tla/NFRiverPolicy.tla`
- **Verdict:** SOUND
- **Reasoning:**
  - Has `MODULE NFRiverPolicy` header and `EXTENDS Naturals, TLC`
  - Has `TypeOK` invariant covering all 9 variables
  - Has `Init`, `Next`, `Spec` definitions with weak fairness
  - Has `@requirement ROUTE-05`, `ROUTE-06`, `ROUTE-07` annotations throughout
  - ROUTE-05/06/07 exist in requirements.json (River ML routing tiers)
  - Actions model complete Q-learning loop: `PresetSelect`, `ActivateRiver`, `RiverExplore`, `RiverExploit`, `RecordReward`, `BellmanUpdate`, `MakeShadowRecommendation`, `DecayEpsilon`
  - Safety invariants: `SlotValid`, `PolicyTierValid`, `QTableBounded`, `EpsilonDecays`, `ShadowSlotValid`, `UpdateRequiresReward`
  - Not hollow scaffolding

#### 3. NFSolveResidual.tla
- **Path:** `.planning/formal/tla/NFSolveResidual.tla`
- **Verdict:** SOUND
- **Reasoning:**
  - Has `MODULE NFSolveResidual` header and `EXTENDS Naturals, TLC`
  - Has `TypeOK` invariant covering all 5 variables
  - Has `Init`, `Next`, `Spec` definitions with weak fairness on `Converge`
  - Has `@requirement DEBT-14` and `@requirement DEBT-15` annotations
  - DEBT-14 and DEBT-15 exist in requirements.json (net residual computation, layer-transition sweeps)
  - Actions: `DetectFP`, `AdvanceLayer`, `Converge`, `Done` — all have real definitions
  - Safety invariants: `NetResidualNonNegative`, `NetResidualBounded`, `NetResidualAccurate`, `LayerBounded`, `ConvergenceRequiresAllLayers`
  - Not hollow scaffolding

### Alloy Models

#### 4. code-standards-debt-audit.als
- **Path:** `.planning/formal/alloy/code-standards-debt-audit.als`
- **Verdict:** SOUND
- **Reasoning:**
  - Has `module code_standards_debt_audit` declaration
  - Has 4 major sections with facts, assertions, and `check` commands
  - `@requirement DEBT-09`, `DEBT-10`, `DEBT-11`, `DEBT-16` annotations present
  - All DEBT-09/10/11/16 exist in requirements.json
  - Sigs have non-trivial relations: `JsonOperation { pattern, script }`, `ModuleImport { strategy, module }`, `CatchBlock { pattern, location }`, `DebtMarker { status, hasRequirementId, hasTraceability }`
  - Facts are non-trivial: `AllJsonOperationsStandard`, `AllImportsUseNfBin`, `NoCatchBlocksSilent`, `DebtMarkersAreDocumented`, `TrackedDebtHasTraceability`
  - Assertions checked: `NoAdHocJsonSerialization`, `NoHardcodedPaths`, `ErrorsNeverSilent`, `DocumentedDebtIsTraceable`
  - Has satisfiability run command
  - Not hollow scaffolding

#### 5. debug-invariants-instrumentation.als
- **Path:** `.planning/formal/alloy/debug-invariants-instrumentation.als`
- **Verdict:** SOUND
- **Reasoning:**
  - Has `module debug_invariants_instrumentation` declaration
  - Has facts and assertions for both DEBT-07 and DEBT-08 sections
  - `@requirement DEBT-07`, `DEBT-08` annotations present
  - DEBT-07/08 exist in requirements.json
  - Sigs with non-trivial relations: `DebugInvariant { kind, sourceFile, extracted }`, `InstrumentationEntry { source, enabled, targetFile }`, `FormalizationCandidate { instrumentationSources }`
  - Facts: `InvariantsAreExtracted`, `InvariantsHaveSource`, `PerFileTraceRegistered` — all have real constraint definitions
  - Assertions checked: `AllInvariantsExtracted`, `PerFileTraceAlwaysAvailable`
  - Has satisfiability run command
  - Not hollow scaffolding

#### 6. shell-prompt-quorum-dedup.als
- **Path:** `.planning/formal/alloy/shell-prompt-quorum-dedup.als`
- **Verdict:** SOUND
- **Reasoning:**
  - Has `module shell_prompt_quorum_dedup` declaration
  - Has facts, assertions, and check commands for both DEBT-12 and DEBT-13 sections
  - `@requirement DEBT-12`, `DEBT-13` annotations present
  - DEBT-12/13 exist in requirements.json
  - Sigs with non-trivial relations: `Prompt { deliveryMethod, content }`, `QuorumSlot { provider }`, `Quorum { slots }`
  - Facts: `PromptDeliveredViaPipe`, `QuorumSlotDiversity`, `MinimumQuorumSize` — all have real constraints
  - Assertions: `StdinPipeEliminatesEscaping`, `AllSlotsUnique` — checked against meaningful bounds
  - Has satisfiability run command
  - Not hollow scaffolding

---

## Summary

All 6 formal models are SOUND. No models require deletion.

### Notes on Test Stubs

The 16 hollow test stubs in `.planning/formal/generated-stubs/` use hardcoded absolute paths
(`/Users/jonathanborduas/code/QGSD/...`). These are fixed in Task 2:
- All paths replaced with ROOT-relative equivalents using `path.resolve(__dirname, '..', '..', '..')`
- CONF-01 and VERIFY-03 are purely hollow (only `fs.existsSync` + `content.length > 0` checks)
  and receive additional `assert.match()` semantic checks based on their requirement text
