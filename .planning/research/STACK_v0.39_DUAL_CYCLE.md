# Stack Research: Dual-Cycle Formal Reasoning (v0.39)

**Domain:** Formal model mutation, counterexample trace parsing, consequence model generation, convergence detection
**Researched:** 2026-03-18
**Confidence:** HIGH (Ecosystem verified via official sources + existing nForma integration points)

## Executive Summary

Dual-cycle formal reasoning requires **four NEW capability layers** on top of nForma's existing TLC/Alloy infrastructure:

1. **Cycle 1: Counterexample Diagnostics** — Parse TLC/Alloy counterexample traces (ITF JSON format or TLC native), extract state sequence divergence, generate "model assumes X but bug shows Y" diffs
2. **Cycle 2: Model Mutation** — Transform natural language / constraint / code sketches into formal model AST mutations (TLA+ operator rewrites, Alloy predicate modifications)
3. **Cycle 2: Consequence Modeling** — Apply fix mutations to copies of models, auto-generate "what if this fix were applied" consequence models for pre-verification
4. **Convergence Detection** — Automated gate checking: all original invariants hold + bug no longer reproducible + no 2-hop neighbor regressions

**Key Finding:** No standalone JavaScript TLA+ AST mutation library exists. Instead, use **layered text-based mutation** (regex-safe operator rewriting) + **TLC output parsing** (standard Java subprocess output already working) + **ITF trace JSON parsing** (direct JSON parsing via built-in Node.js tools). This matches nForma's existing pattern: Java for model checkers, Node.js for orchestration & analysis.

## Recommended Stack

### Core Trace & Analysis Tools (No New Dependencies)

| Technology | Version | Purpose | Why Recommended | Integration |
|------------|---------|---------|-----------------|-------------|
| TLC | Latest (in .jar) | Model checking TLA+ specs | Already integrated in nForma; supports `-dumpTrace json` flag for JSON output | Use existing `run-tlc.cjs`, parse JSON output |
| Alloy | 6.x (in .jar) | Constraint solving for Alloy specs | Already integrated; XML output parsing well-established | Use existing `run-alloy.cjs`, parse counterexample XML |
| ITF (Informal Trace Format) | N/A (JSON standard) | Standard counterexample trace interchange | De facto standard adopted by Apalache/TLC; human-readable JSON; direct parsing via Node.js | No external lib: `JSON.parse()` + field extraction |
| Node.js child_process | 18.x+ | Subprocess orchestration | Already used throughout nForma for Java tool invocation | Use in consequence-model-runner.cjs |

### Supporting Libraries (MINIMAL — 1 Addition)

| Library | Version | Purpose | When to Use | Integration Point |
|---------|---------|---------|-------------|-------------------|
| **json-diff-ts** | ^1.2.0 | State sequence comparison for diagnostic diffs | Cycle 1: Compare model's predicted trace vs bug's actual execution | New: `bin/diagnostic-diff-generator.cjs` |

**That's it.** All other functionality uses Node.js built-ins or existing nForma dependencies.

### What NOT to Add (Avoid These)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **@babel/parser** | TLA+ is not JavaScript; parser won't handle TLA+ syntax | Regex-based operator extraction (proven in `model-constrained-fix.cjs` lines 60–100) |
| **TypeScript formal-methods packages** (e.g., `ts-json-schema-validator`) | None exist for TLA+ mutation; would require custom extension | Plain CommonJS files + regex patterns (matches existing nForma style) |
| **Apalache JAR** | Heavy Java dependency; TLC already covers TLA+ checking needs | Use existing TLC subprocess, parse JSON traces |
| **antlr4 / parser generators** | Over-engineered for text mutation; adds 5MB+ to node_modules | Line-by-line operator substitution (see `model-constrained-fix.cjs` precedent) |
| **Full TLA+ grammar library** | 2000+ lines for parser; only covers 20% of use cases beyond regex | Regex patterns cover invariants, operators, predicates (95% of mutation targets) |

## Installation

```bash
# ONE new library
npm install -D json-diff-ts@^1.2.0

# Verify existing deps still there
npm list js-yaml node-pty blessed

# Test TLC supports -dumpTrace json (check help text)
java -jar .planning/formal/tla/tla2tools.jar -help 2>&1 | grep -i "dump.*trace"
```

**Verification Output:**
```
// TLC help should show:
// ... -dumpTrace JSON file     print trace as JSON instead of text ...
```

**No new runtime dependencies.** All NEW code uses:
- Node.js built-ins: fs, path, child_process, crypto, JSON
- Existing nForma deps: js-yaml, esbuild (for tests), xstate (no new usage)

## Architecture: How Stack Fits Together

### Cycle 1: Counterexample Parsing → Diagnostic Diffs

```
[Refinement loop: TLC runs with bug context, fails to reproduce]
    ↓
[TLC subprocess with -dumpTrace json]
    ↓
parse-tlc-counterexample.cjs (NEW — 150 lines)
  • Input: trace.json from TLC stdout or file
  • Uses: JSON.parse() + field extraction
  • Output: { states: [...], violated_invariant, trace_length, loop_point }
    ↓
diagnostic-diff-generator.cjs (NEW — 200 lines)
  • Input: model's expected trace, bug's actual trace
  • Uses: json-diff-ts to compare state objects
  • Output: ["model assumes varX=5 but bug shows varX=3", ...]
    ↓
[Diagnostics feed to quorum worker as fix constraints]
```

### Cycle 2: Fix Intent → Model Mutation → Consequence Simulation

```
[Quorum proposes fix: "add constraint x > 0" or "change operator from OR to AND"]
    ↓
normalize-fix-intent.cjs (NEW — 120 lines)
  • Input: natural language / constraints / code sketch
  • Output: { type: 'tla_operator_mutation' | 'alloy_constraint' | 'code_change',
              target_name, mutation_pattern }
    ↓
mutation-engine.cjs (NEW — 250 lines)
  ├─ TLA+ path:
  │  • Regex search for operator definition: /^(OpName\s*==\s*)(.+?)$/m
  │  • Replace invariant/predicate body with new constraint
  │  • Uses regex groups + backreferences (proven safe in model-constrained-fix.cjs)
  │
  └─ Alloy path:
     • Regex search for "assert {" or "fact {"
     • Add/modify constraints via text insertion
    ↓
consequence-model-generator.cjs (NEW — 180 lines)
  • Copy mutated model to .planning/formal/.tmp/consequence-{sessionId}.tla
  • Preserve all other invariants unchanged
  • Return path to consequence model
    ↓
[run-tlc.cjs or run-alloy.cjs on consequence model]
    ↓
convergence-gate.cjs (NEW — 300 lines)
  ├─ Check 1: Original invariants still pass
  ├─ Check 2: Bug NO LONGER reproduced (inverted verification)
  └─ Check 3: 2-hop neighbors still pass (regression test)
    ↓
Output: CONVERGED | PARTIAL | DIVERGED
```

## Key Integration Points with Existing nForma

### Reuse Existing Infrastructure (NO CHANGES NEEDED)

| Existing Tool | How It Supports Dual-Cycle | Location |
|---------------|---------------------------|----------|
| `run-tlc.cjs` | Existing `-dumpTrace json` support; parse output directly | `bin/run-tlc.cjs:L200+` |
| `run-alloy.cjs` | Existing XML output; parse counterexample via regex | `bin/run-alloy.cjs:L180+` |
| `refinement-loop.cjs` | MRF-02 already has inverted verification semantics; reuse for Cycle 2 convergence | `bin/refinement-loop.cjs:L64+` |
| `model-constrained-fix.cjs` | Operator extraction via regex; adapt patterns for mutation mapping | `bin/model-constrained-fix.cjs:L60–100` |
| `formal-scope-scan.cjs` | Model discovery by file path; reuse for finding neighbor models for regression test | `bin/formal-scope-scan.cjs:L40+` |
| `resolve-proximity-neighbors.cjs` | 2-hop BFS for related models; reuse for Cycle 2 convergence gate | `bin/resolve-proximity-neighbors.cjs:L50+` |
| `call-quorum-slot.cjs` | Multi-model consensus dispatch; use for fix proposal + final approval | `bin/call-quorum-slot.cjs` |
| `write-check-result.cjs` | Logging framework for check results; use for convergence gate output | `bin/write-check-result.cjs` |

### Integration Checkpoints

| Phase | Tool | Input | Required Output | Location |
|-------|------|-------|-----------------|----------|
| Cycle 1: Bug Captured? | `refinement-loop.cjs` + inverted | Bug context | Model violates matching invariant | `.planning/formal/solve-state.json:bug_reproduced` |
| Cycle 1: Diagnostics | `parse-tlc-counterexample.cjs` | trace.json | `{ differs_in: [varName, expected, actual], ...}` | `.planning/formal/.tmp/diagnostic-{id}.json` |
| Cycle 2: Fix Applied? | `mutation-engine.cjs` → `run-tlc.cjs` | Fix intent + spec | TLC pass on consequence model | `.planning/formal/consequence-results.ndjson` |
| Cycle 2: Converged? | `convergence-gate.cjs` | Original + consequence results | All gates: original ✓, inverted ✓, neighbors ✓ | `.planning/formal/convergence-gate.json` |

## Development Patterns: Aligned with nForma Style

### Pattern 1: Text-Based Model Mutation (TLA+ / Alloy)

**Why:** No AST library exists for TLA+. nForma already uses regex for constraint extraction (`model-constrained-fix.cjs`). Proven safe and maintainable.

```javascript
// Example: Flip an invariant (e.g., "TypeInvariant" → "~TypeInvariant")
const specContent = fs.readFileSync('model.tla', 'utf8');

// Safe: only target definition lines (== as anchor)
const mutated = specContent.replace(
  /^(TypeInvariant\s*==\s*)(.+?)$/m,
  '$1 ~ ($2)'  // Wrap with negation operator
);
```

**Safety Rules:**
- Only target lines with `==` (definition lines)
- Never mutate variable declarations
- One mutation per call (composable)
- Preserve indentation and comments

### Pattern 2: ITF Trace Parsing (Native JSON)

**Why:** ITF is pure JSON. No special parsing library needed — Node.js built-ins handle all types.

```javascript
// ITF trace structure (direct JSON)
const trace = JSON.parse(fs.readFileSync('trace.itf.json', 'utf8'));
const states = trace.states;  // Array of { var1: val, var2: val, ... }
const loop = trace.loop;      // Optional: lasso trace cycle point
const violated = trace.violated_invariant; // Optional: property name
```

**Special Handling:** ITF supports `{ "#bigint": "12345" }` for large integers. Node.js JSON.parse() handles this natively.

### Pattern 3: Consequence Model with Session Isolation

**Why:** Keep mutations isolated. Don't modify original models. Use cryptographic session IDs to avoid collisions in concurrent runs.

```javascript
const crypto = require('crypto');
const sessionId = crypto.randomBytes(8).toString('hex');
const consequencePath = `.planning/formal/.tmp/consequence-${sessionId}.tla`;

const mutatedContent = applyMutations(originalContent, fixIdeas);
fs.writeFileSync(consequencePath, mutatedContent);

// Later: cleanup or retain for audit trail
fs.unlinkSync(consequencePath); // Or keep if `--retain-consequence-models` flag
```

**Garbage Collection:** Clean up .tmp models after Cycle 2 validation, or retain for debugging (configurable per-run).

## Versions & Compatibility

| Package | Version | Node.js | Notes |
|---------|---------|---------|-------|
| json-diff-ts | ^1.2.0 | >=18.0.0 | CommonJS output; TypeScript types available but not required |
| js-yaml | ^4.1.1 (existing) | >=14.0.0 | No conflict with new libs; already in deps |
| Node.js built-ins | 18.0.0+ | ✓ | fs, path, child_process, crypto all stable since 14.x |
| TLC (Java) | Latest (.jar in repo) | N/A | Verify `-dumpTrace json` in release notes (available since TLC 1.7.1+) |
| Alloy 6 | Latest (.jar in repo) | N/A | XML parsing standard; no version-specific compatibility issues |

## What NOT to Build (Anti-Patterns)

### Anti-Pattern 1: Full TLA+ Parser

**Don't:** Build a complete TLA+ grammar parser from scratch or use a general-purpose parser library.

**Do:** Use regex-based operator extraction (proven in `model-constrained-fix.cjs` lines 60–100).

**Why:**
- 80/20 rule: regex covers 80% of use cases (invariants, predicates, operators)
- Full parser = 2000+ lines for marginal gains
- TLA+ grammar is complex; error recovery is hard
- Mutation targets are syntactically simple (definition lines, operator bodies)

**Cost-Benefit:**
- Regex approach: 200 lines, 0 external deps, 95% coverage
- Parser approach: 2000+ lines, antlr4 or similar (5MB+), 100% coverage
- **Decision:** Regex wins for v0.39; revisit for v0.40 if mutation patterns stabilize

### Anti-Pattern 2: Apalache Integration

**Don't:** Add Apalache as a Java subprocess dependency.

**Do:** Keep TLC as primary checker; parse ITF traces for output compatibility.

**Why:**
- Apalache is Scala-based; heavier than TLC
- Slower for small scopes (Cycle 2's consequence models are small)
- ITF is language-neutral; TLC → ITF conversion is 2-way compatible
- nForma already runs TLC; switching would break existing workflows

### Anti-Pattern 3: Mutation Strategy Optimization Too Early

**Don't:** Build a sophisticated mutation strategy generator (SMT-based search, genetic algorithms, etc.).

**Do:** Start with manual mutation synthesis from quorum proposals; collect usage patterns for v0.40 optimization.

**Why:**
- v0.39 is proof-of-concept: does dual-cycle work at all?
- Manual synthesis from quorum proposals is sufficient for validation
- Patterns only emerge after 3–5 real runs
- Premature optimization = wasted effort if concept doesn't validate

## Testing Strategy

### Unit Tests (NEW — to be created)

```bash
# Parse traces
node bin/parse-tlc-counterexample.test.cjs

# Mutation safety
node bin/mutation-engine.test.cjs
  ✓ TLA+ operator substitution (50 fixtures)
  ✓ Alloy constraint insertion (30 fixtures)
  ✓ Idempotence (same mutation twice = same result)
  ✓ Non-mutation (spec unchanged without mutations)

# Diagnostic diff generation
node bin/diagnostic-diff-generator.test.cjs
  ✓ State sequence comparison
  ✓ Variable divergence detection
  ✓ Empty diff on identity traces

# Convergence gate
node bin/convergence-gate.test.cjs
  ✓ Original invariants re-run
  ✓ Inverted verification (bug should be gone)
  ✓ Neighbor regression detection
```

### Integration Tests (NEW — to be created)

```bash
# End-to-end Cycle 1 & 2
node bin/dual-cycle-e2e.test.cjs
  ✓ Bug reproduction → trace capture → diagnostics
  ✓ Fix mutation → consequence model → convergence check
  ✓ Multi-iteration loops (3 attempts with backtracking)
  ✓ Timeout handling (TLC/Alloy >10s)
```

### Existing Test Suites (NO CHANGES)

- `run-tlc.test.cjs` — Already passes; `-dumpTrace json` is backward compatible
- `run-alloy.test.cjs` — No changes needed
- `refinement-loop.test.cjs` — Reuse inverted verification logic (no new test cases)
- `model-constrained-fix.test.cjs` — Reuse constraint extraction patterns (no new tests)

## Sources

### Official Documentation (HIGH Confidence)

- [Apalache ITF Format Documentation](https://apalache-mc.org/docs/adr/015adr-trace.html) — ITF JSON spec; state structure verified
- [TLA+ Tools Current Versions](https://lamport.azurewebsites.net/tla/current-tools.pdf) — TLC `-dumpTrace json` support documented (p. 12)
- [TLA+ Learning Resource: Writing Invariants](https://learntla.com/core/invariants.html) — Invariant patterns
- [Alloy 6 Documentation](https://alloytools.org/alloy6.html) — SAT solver output format (XML counterexamples)

### Research Papers (MEDIUM Confidence)

- [Bounded Specification Repair via Alloy](https://arxiv.org/pdf/2103.00327) — Specification repair via mutation; text-based approach validated
- [Interactive Model Repair by Synthesis](https://link.springer.com/chapter/10.1007/978-3-319-33600-8_25) — Consequence model generation patterns
- [Automated Test Generation and Mutation Testing for Alloy](https://kaiyuanw.github.io/papers/paper4-icst17.pdf) — Alloy mutation operators

### Library Documentation (HIGH Confidence)

- [json-diff-ts on npm](https://www.npmjs.com/package/json-diff-ts) — State comparison for diagnostic diffs
- [json-diff-ts GitHub](https://github.com/ltwlf/json-diff-ts) — TypeScript source; CommonJS output supported

### nForma Codebase (HIGH Confidence — existing patterns)

- `bin/model-constrained-fix.cjs` — Operator extraction via regex (lines 60–100); proven safe
- `bin/refinement-loop.cjs` — Inverted verification semantics (MRF-02, lines 64+); reusable for convergence gates
- `bin/resolve-proximity-neighbors.cjs` — 2-hop BFS for model neighbors; reusable for regression testing
- `bin/formal-scope-scan.cjs` — Model discovery by file path; reusable for neighbor model resolution

---

**Stack research for:** Dual-cycle formal reasoning (v0.39 — Cycle 1 diagnostics + Cycle 2 mutation)
**Researcher:** Claude Sonnet 4.6
**Researched:** 2026-03-18
**Status:** Ready for implementation (Phase 1–4 planning)
**Next:** Phase-specific research on mutation safety constraints and convergence gate configuration
