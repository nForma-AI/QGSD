# Architecture: Dual-Cycle Formal Reasoning (v0.39)

**Domain:** Model-driven bug diagnosis and fix validation
**Researched:** 2026-03-18
**Confidence:** HIGH

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         BUG REPORTED                            │
│                  (e.g., timeout in quorum slot)                 │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────┐
        │     CYCLE 1: BUG VALIDATES MODEL       │
        │     (Model must capture failure)       │
        └────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  refinement-loop.cjs (inverted verification)      │
    │  • Run TLC with bug context                       │
    │  • Model should FAIL (violate safety invariant)   │
    │  • If passes: model is incomplete                 │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  TLC Execution                                     │
    │  • java -jar tla2tools.jar -dumpTrace json ...   │
    │  • Output: trace.itf.json (state sequence)        │
    │  • Output: violated_invariant name                │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  parse-tlc-counterexample.cjs (NEW)               │
    │  • JSON.parse(trace.itf.json)                     │
    │  • Extract states[], violated_invariant           │
    │  • Handle lasso traces (cycles)                   │
    │  • Output: { states, violated_prop, loop_point }  │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  diagnostic-diff-generator.cjs (NEW)              │
    │  • json-diff-ts: compare state objects            │
    │  • Field-level divergence detection               │
    │  • Output: ["varX: expected 5, got 3", ...]       │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  DIAGNOSTIC OUTPUT                                │
    │  "Model assumes slot_retry_count > 0              │
    │   but bug shows slot_retry_count = 0"             │
    │                                                    │
    │  This guides quorum fix proposals (not blind)     │
    └────────────────────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────┐
        │   CYCLE 2: MODEL VALIDATES FIX        │
        │   (Fix must satisfy convergence gates) │
        └────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  Quorum proposes fix based on diagnostics        │
    │  Examples:                                        │
    │  • "Add constraint: slot_retry_count > 0"        │
    │  • "Change operator: retryLogic AND timeout"     │
    │  • "Modify predicate: x <= MAX not x == MAX"     │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  normalize-fix-intent.cjs (NEW)                   │
    │  • Parse natural language proposal                │
    │  • Route: TLA+ operator vs Alloy constraint       │
    │  • Output: { type, target, new_body }            │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  mutation-engine.cjs (NEW)                        │
    │  • Text-based operator rewriting (regex-safe)     │
    │  • TLA+: definition line substitution             │
    │  • Alloy: constraint insertion                    │
    │  • Output: mutated spec content                   │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  consequence-model-generator.cjs (NEW)            │
    │  • Copy original model                            │
    │  • Apply mutations (isolated session)             │
    │  • Write to .tmp/consequence-{sessionId}.tla      │
    │  • Validate syntax (sanity check)                 │
    │  • Output: path to consequence model              │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  run-tlc.cjs / run-alloy.cjs (EXISTING)          │
    │  • Execute checker on consequence model           │
    │  • Record: pass/fail, runtime, diagnostics        │
    │  • Output: check-results.ndjson                   │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  convergence-gate.cjs (NEW)                       │
    │                                                    │
    │  Gate 1: Original Invariants Pass?                │
    │    • Re-run TLC with ALL original invariants      │
    │    • Output: PASS | FAIL (regression detected)    │
    │                                                    │
    │  Gate 2: Bug No Longer Reproduced?                │
    │    • Re-run inverted verification (bug context)   │
    │    • Model should NOT violate safety invariant    │
    │    • Output: PASS (bug gone) | FAIL (fix didn't) │
    │                                                    │
    │  Gate 3: Neighbor Regressions?                    │
    │    • Find 2-hop related models (proximity graph)  │
    │    • Run TLC on neighbors with consequence inv.   │
    │    • Output: PASS (no regression) | FAIL (broken) │
    │                                                    │
    │  Final Output:                                    │
    │    • CONVERGED (3/3 gates pass)                   │
    │    • PARTIAL (2/3 gates pass)                     │
    │    • DIVERGED (0-1 gates pass)                    │
    └────────────────────────────────────────────────────┘
                             ↓
    ┌────────────────────────────────────────────────────┐
    │  CONVERGENCE VERDICT                              │
    │                                                    │
    │  If CONVERGED:                                    │
    │    → "Fix validated. Ready to code."              │
    │                                                    │
    │  If PARTIAL:                                      │
    │    → "Fix partially works. Manual review needed." │
    │                                                    │
    │  If DIVERGED:                                     │
    │    → "Fix doesn't work. Iterate? (max 3x)"       │
    │       Retry Cycle 2 with alternative mutation     │
    │                                                    │
    │  After 3 failed iterations:                       │
    │    → Escalate; suggest model refinement approach  │
    └────────────────────────────────────────────────────┘
```

## Component Boundaries

### Cycle 1: Diagnostics Layer

| Component | Responsibility | Communicates With | Status |
|-----------|----------------|-------------------|--------|
| **refinement-loop.cjs** | Inverted verification (model captures bug) | run-tlc/run-alloy | EXISTING (v0.38) |
| **parse-tlc-counterexample.cjs** | Extract trace states from TLC JSON output | trace.itf.json files | NEW (v0.39) |
| **diagnostic-diff-generator.cjs** | Compare model trace vs actual trace, generate diffs | parse-tlc-counterexample | NEW (v0.39) |

**Data Flow:**
```
TLC output (-dumpTrace json)
    → parse-tlc-counterexample → states[], violated_invariant
    → diagnostic-diff-generator → diffs (JSON)
    → quorum context injection
```

**Isolation:** Each phase is independent; diagnostics don't require consequence models.

### Cycle 2: Mutation & Validation Layer

| Component | Responsibility | Communicates With | Status |
|-----------|----------------|-------------------|--------|
| **normalize-fix-intent.cjs** | Parse quorum proposal into structured mutation intent | Quorum dispatch | NEW (v0.39) |
| **mutation-engine.cjs** | Apply text-based mutations (TLA+/Alloy) | Spec files (in memory) | NEW (v0.39) |
| **consequence-model-generator.cjs** | Write consequence model to .tmp/, manage session isolation | mutation-engine, file system | NEW (v0.39) |
| **run-tlc.cjs / run-alloy.cjs** | Execute checker on consequence model | consequence model file | EXISTING (reuse) |
| **convergence-gate.cjs** | Three-point validation (original, inverted, neighbors) | run-tlc/alloy, proximity graph | NEW (v0.39) |

**Data Flow:**
```
Quorum fix proposal (text)
    → normalize-fix-intent → { type, target, body }
    → mutation-engine → mutated spec content
    → consequence-model-generator → .tmp/consequence-{id}.tla
    → run-tlc/alloy → check results
    → convergence-gate → CONVERGED | PARTIAL | DIVERGED
```

**Isolation:** Mutations happen in memory; consequence models written to .tmp/ with session IDs; original models never modified.

## Data Structures

### ITF Trace Format (Read from TLC)

```javascript
// .itf.json file structure
{
  "#meta": { /* optional metadata */ },
  "params": ["N", "Quorum"],          // MC config parameters
  "vars": ["pc", "votes", "decided"], // State variables
  "states": [
    { "pc": "init", "votes": {}, "decided": false },
    { "pc": "voting", "votes": { "A": 1 }, "decided": false },
    { "pc": "committed", "votes": { "A": 1, "B": 1 }, "decided": true }
  ],
  "loop": 2  // Optional: lasso trace cycle point
}
```

### Diagnostic Diff Output

```javascript
{
  "violated_invariant": "TypeInvariant",
  "trace_length": 5,
  "divergences": [
    {
      "step": 3,
      "variable": "votes",
      "expected": { "A": 1, "B": 1 },  // Model's expected
      "actual": { "A": 1 },             // Bug's actual
      "difference": "Missing vote from B"
    },
    {
      "step": 4,
      "variable": "decided",
      "expected": true,
      "actual": false,
      "difference": "Decided earlier than in bug"
    }
  ]
}
```

### Fix Intent (Normalized from Quorum)

```javascript
{
  "type": "tla_operator_mutation",     // or "alloy_constraint"
  "target_operator": "VoteOperator",
  "target_location": "next_state",     // predicate body
  "mutation_kind": "constraint_add",   // or "constraint_replace", "operator_rewrite"
  "new_constraint": "votes' = votes \\cup {voter}", // TLA+ syntax
  "rationale": "quorum proposed to add constraint to prevent vote loss"
}
```

### Convergence Gate Output

```javascript
{
  "session_id": "abc123def456",
  "consequence_model": ".planning/formal/.tmp/consequence-abc123def456.tla",
  "gates": {
    "original_invariants": {
      "pass": true,
      "invariants_checked": ["TypeInvariant", "SafetyInvariant"],
      "failed": [],
      "runtime_ms": 1200
    },
    "inverted_verification": {
      "pass": true,
      "meaning": "Bug no longer reproduced",
      "runtime_ms": 2100
    },
    "neighbor_regression": {
      "pass": true,
      "neighbors_checked": ["NFQuorum.tla", "NFVote.tla"],
      "failed_neighbors": [],
      "runtime_ms": 3500
    }
  },
  "verdict": "CONVERGED",  // or "PARTIAL" (2/3) or "DIVERGED"
  "status": "SAFE_TO_COMMIT",
  "cleanup_at": "2026-03-19T00:00:00Z"  // When to delete .tmp files
}
```

## Integration Points with Existing nForma

### Point 1: Inverted Verification (Cycle 1)

**Existing:** `refinement-loop.cjs` MRF-02 (v0.38)
**New Usage:** Cycle 1 checks model captures bug; Cycle 2 checks bug is gone

```javascript
// Cycle 1 (existing inverted semantics)
const result1 = await refinementLoop({
  bug_context: userBugDescription,
  model: tfaModel,
  max_attempts: 1
});
// Expected: VIOLATION (model captures bug)

// Cycle 2 (after mutation)
const result2 = await refinementLoop({
  bug_context: userBugDescription,
  model: consequenceModel,
  max_attempts: 1
});
// Expected: NO VIOLATION (bug is fixed)
```

### Point 2: Operator Extraction (Cycle 2 Mutation)

**Existing:** `model-constrained-fix.cjs` extractTlaConstraints() (v0.38)
**New Usage:** Adapt regex patterns for mutation target identification

```javascript
// Existing: Extract for documentation
const constraints = extractTlaConstraints(spec);
// { name: "TypeInvariant", definition: "..." }

// New: Find mutation target
const target = findOperatorDefinition(spec, "VoteOperator");
// Returns: { line_start, line_end, body, definition_line }

// Mutate
const mutated = spec.replace(
  target.definition_line,
  target.definition_line.replace(target.body, newBody)
);
```

### Point 3: Model Discovery (Cycle 2 Neighbor Regression)

**Existing:** `formal-scope-scan.cjs` (v0.38), `resolve-proximity-neighbors.cjs` (v0.38)
**New Usage:** Find 2-hop neighbors for convergence gate

```javascript
// Existing: Find models by file
const models = formalScopeScan({ file: 'quorum-slot-worker.cjs' });
// [{ model: 'NFQuorum.tla', relevance: 0.9 }, ...]

// New: Find neighbors of consequence model
const neighbors = resolveProximityNeighbors({
  model: 'NFQuorum.tla',
  hops: 2,
  includeOriginal: false
});
// [{ model: 'NFVote.tla', hops: 1, shared_requirements: [...] }, ...]

// Re-run TLC on neighbors
for (const neighbor of neighbors) {
  const result = await runTlc({ spec: neighbor.model });
  if (result.status === 'FAIL') {
    convergenceGate.neighbor_regression.failed_neighbors.push(neighbor);
  }
}
```

### Point 4: Quorum Dispatch (Cycle 2 Fix Proposals)

**Existing:** `call-quorum-slot.cjs`, `quorum-slot-dispatch.cjs` (v0.28+)
**New Usage:** Inject diagnostic context; collect fix proposals

```javascript
// Before (no context):
const proposals = await quorumDispatch({
  task: 'propose_fix',
  bug_description: userBugText
});

// After (with diagnostics):
const diagnostics = await parseDiagnostics(trace);
const proposals = await quorumDispatch({
  task: 'propose_fix',
  bug_description: userBugText,
  diagnostic_context: {
    divergences: diagnostics.divergences,
    violated_invariant: diagnostics.violated_invariant,
    trace: diagnostics.states
  }
});
// Quorum proposes based on formal evidence, not just description
```

## Process Flow: Iteration Loop

### Success Path (Converged)

```
Bug reported
  ↓ (Cycle 1)
Parse trace + diagnostic diff
  ↓
Quorum sees diagnostic context
  ↓
Quorum proposes fix (informed)
  ↓ (Cycle 2)
Normalize fix intent
  ↓
Mutate model
  ↓
Run convergence gates
  ↓
All 3 gates PASS → CONVERGED
  ↓
Output: "Fix validated. Ready to code."
```

### Iteration Path (Partial → Converged)

```
Cycle 2 fails: Gate 1 or 2 fails
  ↓
System: "Let's try a different mutation"
  ↓
Quorum proposes alternative (based on gate failure reason)
  ↓
Cycle 2 again (mutation → gates)
  ↓
After 2nd attempt: Gates 1 & 2 pass, Gate 3 fails
  ↓
System: "Neighbor NFVote.tla broke. Try scoped constraint instead."
  ↓
Cycle 2 again (3rd attempt)
  ↓
All 3 gates PASS → CONVERGED (after 3 attempts)
```

### Escalation Path (Diverged)

```
Cycle 2 fails on all 3 attempts
  ↓
System: "Fix doesn't converge. Likely a fundamental issue."
  ↓
Escalate to manual review:
  "Gate 1 (Original Inv): ✓ PASS
   Gate 2 (Bug Gone): ✗ FAIL (bug still reproducible)
   Gate 3 (Neighbors): ✓ PASS

   Diagnosis: Fix doesn't actually address the bug.
   Recommendation: Revisit bug context or create new model."
```

## Error Handling & Fault Recovery

### Parse Trace Failures

| Error | Cause | Recovery |
|-------|-------|----------|
| Invalid JSON | TLC output corrupted or non-JSON | Fallback to text trace parser (regex-based extraction) |
| Missing states[] | Trace format not ITF | Auto-detect format; handle TLC native output |
| Missing violated_invariant | Trace is satisfying instance (not counterexample) | Detect and report: "Model passed (no invariant violated)" |

### Mutation Failures

| Error | Cause | Recovery |
|-------|-------|----------|
| Regex no match (operator not found) | Operator name/location wrong | Log detailed context; ask quorum to refine proposal |
| TLC parse error on consequence model | Mutation created invalid syntax | Validate syntax before running TLC; report mutation error |
| Consequence model timeout (>30s) | Model too complex for mutation | Escalate; suggest breaking into smaller models |

### Convergence Gate Failures

| Error | Cause | Recovery |
|-------|-------|----------|
| Gate 1 fails (original inv regression) | Fix broke unrelated invariant | Suggest narrower constraint scope |
| Gate 2 fails (bug still reproducible) | Fix doesn't address root cause | Escalate; model may need refinement |
| Gate 3 fails (neighbor regression) | Fix cascades to related models | Suggest considering neighbor invariants in fix |

## Performance Characteristics

| Component | Latency | Bottleneck | Mitigation |
|-----------|---------|-----------|-----------|
| **parse-tlc-counterexample** | 50–200ms | Trace size (50–500 states) | Stream parsing, lazy evaluation |
| **diagnostic-diff-generator** | 100–500ms | Deep diff on large state objects | Cache partial diffs; batch comparisons |
| **mutation-engine** | 10–50ms | Regex compilation | Compile patterns once; reuse |
| **consequence-model-generator** | 100–200ms | File I/O + syntax check | Write to /tmp (faster); pre-validate |
| **run-tlc (consequence model)** | 2–10s | Model complexity | Timeout at 10s; report timeout as divergence |
| **convergence-gate** | 2–15s | Neighbor re-runs (serial) | Parallelize neighbor checks (future optimization) |
| **Total (Cycle 1 only)** | ~1s | Diagnostic diff (json-diff-ts) | Acceptable for interactive use |
| **Total (Cycle 2 full)** | ~20–60s per iteration | TLC execution | Expected; matches v0.38 execution time |

**Target SLA:** Convergence gate verdict <60s (all 3 gates in parallel future version).

## Session Isolation & Cleanup

### Session Model

Each Cycle 2 run has a **session ID** (crypto.randomBytes(8).hex):

```
session: abc123def456
  ├─ .planning/formal/.tmp/consequence-abc123def456.tla (consequence model)
  ├─ .planning/formal/.tmp/consequence-abc123def456.cfg (TLC config)
  ├─ .planning/formal/.tmp/convergence-abc123def456.json (gate results)
  └─ Expiry: 24h from creation; cleanup via cron or next run

session: 789ghi012jkl
  ├─ [same structure]
```

### Cleanup Strategy

1. **On convergence:** Delete .tmp/ files immediately (fix is final)
2. **On divergence:** Retain for 24h (human review), then delete
3. **On error:** Retain indefinitely (debugging); manual cleanup via `/nf:debug --cleanup`

## Testing Architecture

### Layer 1: Unit Tests (Isolated Components)

```
parse-tlc-counterexample.test.cjs
  ✓ Parse valid ITF JSON
  ✓ Handle lasso traces (loop point)
  ✓ Extract violated invariant

diagnostic-diff-generator.test.cjs
  ✓ Compare identical states (no diff)
  ✓ Detect variable divergence
  ✓ Report field-level differences

mutation-engine.test.cjs
  ✓ Operator definition regex match
  ✓ Safe substitution (no variable mutations)
  ✓ Idempotence check

convergence-gate.test.cjs
  ✓ Original invariant pass/fail
  ✓ Inverted verification logic
  ✓ Neighbor discovery + re-run
```

### Layer 2: Integration Tests (Cycle Workflows)

```
cycle1-e2e.test.cjs
  ✓ Bug → TLC trace → diagnostics (5 scenarios)

cycle2-e2e.test.cjs
  ✓ Fix → mutation → consequence → gates (10 scenarios)

iteration-loop.test.cjs
  ✓ Multi-attempt convergence (3–5 iterations, 5 scenarios)

quorum-integration.test.cjs
  ✓ Diagnostic context injection (3 scenarios)
  ✓ Fix proposal parsing (5 scenarios)
```

### Layer 3: E2E Tests (Full System)

```
dual-cycle-e2e.test.cjs (manual execution, 15 scenarios)
  ✓ Real TLC runs on real models
  ✓ Real quorum dispatch
  ✓ End-to-end convergence
```

---

**Architecture Complete**
**Status:** Ready for Phase Planning
**Total Components:** 6 new (parse, diff, intent, mutation, consequence, gate)
**Integration Points:** 5 existing components (refinement-loop, model-constrained-fix, formal-scope-scan, resolve-proximity-neighbors, call-quorum-slot)
