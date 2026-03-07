---
phase: quick-204
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/alloy/install-scope.als
  - .planning/formal/alloy/scoreboard-recompute.als
  - .planning/formal/tla/QGSDSessionPersistence.tla
  - .planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md
autonomous: true
formal_artifacts: update
requirements: []

must_haves:
  truths:
    - "Every assertion in every Alloy model verifies a non-trivial property (no tautologies)"
    - "Every TLA+ variable used in TypeOK has a bounded domain for TLC model checking"
    - "Alloy check commands use per-sig scopes that adequately cover the signature hierarchy"
    - "All findings are documented in a formal-model-audit.md report with severity and fix status"
  artifacts:
    - path: ".planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md"
      provides: "Comprehensive audit report of all formal models"
      min_lines: 80
    - path: ".planning/formal/alloy/install-scope.als"
      provides: "Fixed InstallIdempotent assertion and scope commands"
      contains: "InstallIdempotent"
    - path: ".planning/formal/alloy/scoreboard-recompute.als"
      provides: "Fixed RecomputeIdempotent and deduplicated NoVoteLoss/NoDoubleCounting"
      contains: "RecomputeIdempotent"
    - path: ".planning/formal/tla/QGSDSessionPersistence.tla"
      provides: "Bounded idCounter and persistedCounter in TypeOK"
      contains: "MaxCounter"
  key_links:
    - from: ".planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md"
      to: ".planning/formal/alloy/install-scope.als"
      via: "Documents findings and fixes applied"
      pattern: "install-scope"
    - from: ".planning/formal/tla/QGSDSessionPersistence.tla"
      to: ".planning/formal/tla/MCSessionPersistence.cfg"
      via: "TLA+ spec references MaxCounter constant that cfg must define"
      pattern: "MaxCounter"
---

<objective>
Audit all TLA+ and Alloy formal models for state space explosion risks, trivially true assertions, and missing inductive property patterns. Fix all issues found and document findings in a comprehensive report.

Purpose: The mcinstaller fix (QGSDInstallerIdempotency.tla with bounded MaxInstalls) demonstrated how unbounded variables and tautological assertions can hide real bugs. This audit applies those lessons across all 15+ TLA+ specs and 50+ Alloy models.

Output: Fixed model files + formal-model-audit.md report documenting all findings.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/formal/tla/QGSDInstallerIdempotency.tla
@.planning/formal/tla/MCinstaller.cfg
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit all formal models and produce findings report</name>
  <files>
    .planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md
  </files>
  <action>
Systematically audit every TLA+ spec (.planning/formal/tla/*.tla, excluding *_TTrace_* files) and every Alloy model (.planning/formal/alloy/*.als) for the following categories of defects:

**Category A: Trivially True Assertions (tautologies)**
Check every `assert` block in Alloy and every named invariant/property in TLA+ for logical tautologies where the conclusion is identical to or implied by the premise. Known findings to document:

1. `install-scope.als` line 62-65: `InstallIdempotent` asserts `SameState[s1,s2] => SameState[s1,s2]` -- pure tautology (P => P). The assertion name claims to verify idempotency but verifies nothing. Compare with the correct pattern in QGSDInstallerIdempotency.tla where IdempotentHooks checks `installCount > 0 => hooksInstalled = TRUE`.

2. `scoreboard-recompute.als` line 53-56: `RecomputeIdempotent` asserts `computeScore[m,rounds] = computeScore[m,rounds]` -- identity comparison (x = x). Claims to verify deterministic recomputation but is trivially true for any function.

3. `scoreboard-recompute.als` lines 59-65 vs 68-73: `NoVoteLoss` and `NoDoubleCounting` have identical assertion bodies (`computeScore[m,rounds] = (sum r: rounds | scoreDelta[r.votes[m]])`). One assertion is redundant -- they should verify distinct properties.

**Category B: State Space Explosion Risks**
Check every TLA+ TypeOK for unbounded domains (`\in Nat`, `\in Int`, sequences without length bounds). Known findings:

1. `QGSDSessionPersistence.tla` line 44: `idCounter \in Nat` is unbounded. CreateSession increments idCounter without bound. Although the cfg constants (MaxSessions=3, MaxRestarts=2) limit reachable states, TLC must enumerate Nat values for TypeOK verification, creating potential state space explosion. Should be bounded to `0..MaxCounter` where MaxCounter = MaxSessions * (MaxRestarts + 1) + 1.

2. `QGSDSessionPersistence.tla` line 46: `persistedCounter \in Nat` -- same issue.

3. `QGSDStopHook.tla`: MaxTurnLines=500 is declared as a CONSTANT but never referenced in any variable domain or guard -- dead constant, misleading but not a state space issue. Document as a code quality finding.

**Category C: Alloy Scope Issues**
Check every `check ... for N` command for scope adequacy. Known findings:

1. `install-scope.als` lines 73-78: `check ... for 5` uses overall scope. With Runtime(3) + Scope(3) + FileToken + InstallSnapshot sigs, the `for 5` means at most 5 atoms total shared across ALL sigs, which may not explore enough InstallState or InstallSnapshot combinations. Should use per-sig scopes like `for 5 InstallState, 3 Runtime, 3 Scope, 3 FileToken, 3 InstallSnapshot`.

2. `install-scope.als` line 116-119: `RollbackSoundCheck` asserts that for any pre with files, there exists a post with no files. This is trivially satisfiable if the scope allows at least one empty InstallSnapshot atom -- it does not actually verify that uninstall produces the empty state, only that an empty state exists somewhere in the universe.

3. `install-scope.als` line 123-125: `ConfigSyncCompleteCheck` asserts ALL pairs of InstallSnapshot have equal files. This is either vacuously true (1 snapshot in scope) or trivially false (any 2 distinct snapshots). The assertion is broken -- it should check a pre/post pair related by an operation.

**Category D: Missing Inductive Patterns**
Scan for models where bounded induction could simplify or strengthen verification. The installer model's pattern (check for N=3, inductive for all N) should be documented as the reference pattern.

**Category E: Integer Overflow Risks (Alloy)**
Check Alloy models using Int for potential overflow. `scoreboard-recompute.als` uses `7 Int` (range -64..63) with max possible score of 5*7=35, which fits but is fragile.

For EACH finding, document:
- File path and line number(s)
- Category (A/B/C/D/E)
- Severity (critical/moderate/low)
- Description of the defect
- Fix applied or recommended
- Whether the fix was applied in Task 2

Scan ALL .als and .tla files systematically -- do not stop at the known findings above. There may be additional tautologies or scope issues in the other ~50 Alloy models.

Write the report to `.planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md` with sections for each category, a summary table of all findings, and a statistics section showing total models audited vs findings count.
  </action>
  <verify>
    The report file exists and contains:
    - `grep -c 'Category' formal-model-audit.md` shows at least 5 category references
    - `grep -c 'Severity' formal-model-audit.md` shows findings with severity ratings
    - Every known finding listed above appears in the report
    - Summary statistics section exists
  </verify>
  <done>
    formal-model-audit.md contains a complete audit of all TLA+ and Alloy models with categorized findings, severity ratings, and fix recommendations. All findings reference specific file paths and line numbers.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix critical and moderate defects in formal models</name>
  <files>
    .planning/formal/alloy/install-scope.als
    .planning/formal/alloy/scoreboard-recompute.als
    .planning/formal/tla/QGSDSessionPersistence.tla
    .planning/formal/tla/MCSessionPersistence.cfg
  </files>
  <action>
Apply fixes to the three models with critical/moderate defects. Each fix must preserve existing requirement annotations (@requirement tags) and file header comments.

**Fix 1: install-scope.als -- InstallIdempotent tautology (CRITICAL)**

Replace the tautological `InstallIdempotent` assertion (line 62-65) with a meaningful idempotency check. The correct pattern models idempotency as: applying the same install operation to two states that started identically produces identical results. Since InstallState has no temporal dimension, model idempotency structurally:

```
-- InstallIdempotent: if two states assign the same scope via an install operation,
-- the resulting assignments are identical (install is a pure function of the input).
-- Modeled as: for any runtime and target scope, all InstallStates that map that
-- runtime to that scope agree on all other runtime assignments.
assert InstallIdempotent {
    all s1, s2: InstallState |
        (all r: Runtime | r.(s1.assigned) != Uninstalled) and
        (all r: Runtime | r.(s2.assigned) != Uninstalled) and
        (all r: Runtime | r.(s1.assigned) = r.(s2.assigned))
        implies SameState[s1, s2]
}
```

This checks that two post-install states with identical per-runtime assignments are recognized as SameState -- verifying the SameState predicate correctly captures state equality when all runtimes are installed.

Also fix the GAP-7 extension assertions:

For `RollbackSoundCheck`: Replace the existential check with a universal check that any snapshot with GSD files can transition to an empty snapshot (strengthen the assertion to verify the operation, not just existence).

For `ConfigSyncCompleteCheck`: Scope it to pre/post pairs related by the ConfigSyncComplete predicate rather than asserting it for ALL snapshot pairs.

Update `check` commands to use per-sig scopes:
```
check NoConflict         for 5 InstallState, 3 Runtime, 3 Scope
check AllEquivalence     for 5 InstallState, 3 Runtime, 3 Scope
check InstallIdempotent  for 5 InstallState, 3 Runtime, 3 Scope
check RollbackSoundCheck      for 3 InstallSnapshot, 3 FileToken
check ConfigSyncCompleteCheck for 3 InstallSnapshot, 3 FileToken
```

**Fix 2: scoreboard-recompute.als -- RecomputeIdempotent tautology + duplicate assertion (CRITICAL)**

Replace the tautological `RecomputeIdempotent` (line 53-56) with a meaningful idempotency assertion. The scoreboard recompute function is pure (deterministic over the same input), so model idempotency as: computing the score from a set of rounds, then "recomputing" by applying the same function again, yields the same result. Since computeScore is already a pure function in Alloy, the real test is that the score equals the expected sum:

```
-- RecomputeIdempotent: the score for a model is exactly the sum of individual
-- round deltas — recomputing from scratch always yields the same total.
-- This is NOT a tautology because it verifies that computeScore's sum reduction
-- matches a per-round delta accumulation (the two formulations could diverge
-- if the Alloy integer semantics introduced overflow or rounding).
assert RecomputeIdempotent {
    all m: Model, rs: set Round |
        computeScore[m, rs] = (sum r: rs | scoreDelta[r.votes[m]])
}
```

Wait -- this IS the same as NoVoteLoss/NoDoubleCounting. The real issue is that all three assertions check the same property. Fix by:

1. Keep `RecomputeIdempotent` but make it test actual idempotency: computing twice on the same data yields the same result. Since `computeScore` is a pure function in Alloy, `computeScore[m,rs] = computeScore[m,rs]` is trivially true by Alloy semantics. Instead, verify the structural property that the computation is order-independent:
```
assert RecomputeIdempotent {
    all m: Model, r1, r2: set Round |
        r1 = r2 implies computeScore[m, r1] = computeScore[m, r2]
}
```
This is STILL trivially true (= on sets is reflexive). The fundamental issue is that Alloy functions are always pure -- idempotency is definitional, not verifiable.

The honest fix: rename or remove `RecomputeIdempotent` as a documented non-assertion (Alloy pure functions are trivially idempotent), and differentiate `NoVoteLoss` from `NoDoubleCounting`:

- `NoVoteLoss`: Every round with a vote for model m contributes its delta to the total (already correct).
- `NoDoubleCounting`: Removing a round from the set reduces the score by exactly that round's delta: `computeScore[m, rs] = plus[computeScore[m, rs - r], scoreDelta[r.votes[m]]]` for every `r in rs` that has a vote for m. This verifies additivity/linearity of the sum.
- `RecomputeIdempotent`: Document as "trivially true by Alloy pure-function semantics" with a comment explaining WHY, and keep it as a documentation assertion rather than removing it. Add a comment block explaining the tautology and that the TLA+ model (QGSDInstallerIdempotency.tla) is the correct place for temporal idempotency verification.

**Fix 3: QGSDSessionPersistence.tla -- unbounded idCounter (MODERATE)**

Add a `MaxCounter` constant and bound both counters:

1. Add `MaxCounter` to CONSTANTS: `MaxCounter == MaxSessions * (MaxRestarts + 1) + 1`

Actually, MaxCounter should be derived, not a CONSTANT. Use a LET or define it as an operator:

```
MaxCounter == MaxSessions * (MaxRestarts + 1) + 1
```

2. Update TypeOK to bound both counters:
```
/\ idCounter \in 0..MaxCounter
/\ persistedCounter \in 0..MaxCounter
```

3. Update MCSessionPersistence.cfg: No change needed since MaxCounter is derived from existing constants.

4. Verify that the bound is sufficient: MaxSessions=3, MaxRestarts=2 gives MaxCounter = 3*3+1 = 10. Each restart cycle can create up to MaxSessions new sessions, and there are MaxRestarts+1 total cycles (initial + restarts). The +1 accounts for the counter starting at 1 rather than 0.
  </action>
  <verify>
    Run these checks:
    1. `grep 'SameState\[s1, s2\] => SameState\[s1, s2\]' .planning/formal/alloy/install-scope.als` returns NO matches (tautology removed)
    2. `grep 'computeScore\[m, rounds\] = computeScore\[m, rounds\]' .planning/formal/alloy/scoreboard-recompute.als` returns NO matches (tautology removed)
    3. `grep 'MaxCounter' .planning/formal/tla/QGSDSessionPersistence.tla` returns at least 2 matches (definition + usage in TypeOK)
    4. `grep 'idCounter \\in Nat' .planning/formal/tla/QGSDSessionPersistence.tla` returns NO matches (unbounded removed)
    5. All @requirement annotations are preserved in modified files
  </verify>
  <done>
    Three model files are fixed: install-scope.als has a non-tautological InstallIdempotent assertion with per-sig scopes, scoreboard-recompute.als has differentiated NoVoteLoss/NoDoubleCounting assertions with documented RecomputeIdempotent, and QGSDSessionPersistence.tla has bounded counters. All requirement annotations preserved.
  </done>
</task>

</tasks>

<verification>
1. formal-model-audit.md exists with categorized findings for all audited models
2. No tautological assertions remain in install-scope.als or scoreboard-recompute.als
3. QGSDSessionPersistence.tla TypeOK uses bounded domains only
4. All @requirement annotations in modified files are preserved
5. All check commands in install-scope.als use per-sig scopes
</verification>

<success_criteria>
- Audit report covers all TLA+ specs (excluding TTrace files) and all Alloy models
- All critical findings (tautologies, unbounded state spaces) have fixes applied
- Modified model files preserve existing requirement annotations
- Report documents which fixes were applied vs which are recommendations only
</success_criteria>

<output>
After completion, create `.planning/quick/204-audit-formal-models-for-state-space-expl/204-SUMMARY.md`
</output>
