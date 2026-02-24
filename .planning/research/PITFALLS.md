# Pitfalls Research

**Domain:** Adding formal verification tooling to an existing Node.js Claude Code plugin (QGSD v0.12)
**Researched:** 2026-02-24
**Confidence:** HIGH — based on direct inspection of hooks/qgsd-stop.js, hooks/qgsd-prompt.js, bin/update-scoreboard.cjs, bin/call-quorum-slot.cjs, agents/qgsd-quorum-orchestrator.md; MongoDB conformance-checking post-mortem (HIGH); learntla.com optimization guide (HIGH); Alloy facts pitfall documentation (HIGH); TLC model values/symmetry docs (HIGH); PRISM official docs (MEDIUM for empirical data pitfalls — WebSearch only); XState v5 module format (MEDIUM — docs use ESM syntax exclusively)

---

## Critical Pitfalls

### Pitfall 1: TLA+ State Explosion From UNAVAIL Permutations

**What goes wrong:**
The QGSD state machine has up to 10 agent slots, each of which can be AVAILABLE, UNAVAIL, or RESPONDED in any given round. Modeling all 10 slots as distinct named values without symmetry sets produces a state space that grows as `3^N × R!` where R is the number of rounds. With 10 slots and 3 possible states each, the reachable states before any round-transition logic are already 3^10 = 59,049 combinations. Add 3 rounds of deliberation, transition actions, and quorum-verdict outcomes (APPROVE/BLOCK/DELIBERATE/CONSENSUS) and TLC will explore tens of millions of states before finding a violation or completing — likely timing out on a developer laptop.

**Why it happens:**
Spec authors model QGSD slots as concrete named constants (slot1, slot2, … slot10) mirroring the real slot names. Each named slot is a distinct value; TLC explores all permutations. UNAVAIL is modeled as a boolean flag or an enum per slot, multiplying state combinations. The liveness property `no_infinite_deliberation` requires checking all interleavings, making this doubly expensive (liveness slows TLC by an additional factor and prevents symmetry set optimizations).

**How to avoid:**
Three techniques, all required together:

1. **Symmetry sets**: Replace named slot constants with symmetric model values. A set of N symmetric slot values reduces states by N! (10 slots → up to 3,628,800x reduction). Declare `Slots` as a symmetry set in the `.cfg` file. Warning: liveness properties cannot use symmetry sets — check safety and liveness in separate models.

2. **Separate safety from liveness**: Run two TLC model configurations: `qgsd_safety.cfg` (symmetry enabled, checks invariants `min_quorum_met` and `phase_monotonically_advances`) and `qgsd_liveness.cfg` (no symmetry, checks `no_infinite_deliberation` with small N=3 or N=4 slot count).

3. **Minimize model constants**: Start with N=3 slots (not 10) to validate spec structure before running with production slot count. The TLC profiler can identify which actions generate the most state branching — use `action statistics` to tune before scaling.

**Warning signs:**
- TLC reports more than 1 million states before completing with N=10 slots
- Model checking time exceeds 30 minutes on a developer machine with N=5 slots
- `no_infinite_deliberation` check takes 10x longer than `min_quorum_met` check

**Phase to address:**
TLA+ spec phase (first formal verification phase). Safety and liveness model configurations should be defined in the same phase as the spec, before any TLC run is attempted.

---

### Pitfall 2: Conformance Log Schema Drift Between Hooks and Validator

**What goes wrong:**
The conformance event logger emits JSON events from within QGSD hooks (Stop hook, UserPromptSubmit hook, potentially PreToolUse). The validator (`bin/validate-traces.cjs`) parses these events and checks them against the TLA+ spec's state transitions. When the hooks evolve (new slot statuses, new quorum verdict types, renamed fields), the validator's parser becomes stale. It either silently skips unrecognized events (false passes) or throws on unexpected fields (false failures). In both cases, the conformance check gives a wrong answer.

This is the dominant real-world failure mode: MongoDB spent months on conformance instrumentation precisely because "each time a node executes a state transition, it has to snapshot its state variables in order to log them" — state snapshots are fragile and drift constantly.

**Why it happens:**
Hook files and the validator are edited independently. The hook emits `{ phase, action, slots_available, vote_result, outcome }` but there is no shared schema definition. When a new quorum verdict type is added (e.g., `GAPS_FOUND` already exists in `VALID_VERDICTS` of `update-scoreboard.cjs` but the validator may not list it), the conformance check silently ignores events containing it. The scoreboard and validator evolve on different cycles.

**How to avoid:**
Mandate a single shared schema file consumed by both producers (hooks) and consumers (validator):

```javascript
// bin/conformance-schema.cjs — single source of truth
const CONFORMANCE_SCHEMA_VERSION = '1';
const VALID_ACTIONS  = ['QUORUM_STARTED', 'SLOT_CALLED', 'SLOT_RESPONDED', 'SLOT_UNAVAIL', 'QUORUM_VERDICT', 'PHASE_ADVANCE'];
const VALID_PHASES   = ['PROMPT', 'QUORUM', 'DECISION', 'STOP'];
const VALID_OUTCOMES = ['APPROVE', 'BLOCK', 'DELIBERATE', 'CONSENSUS', 'GAPS_FOUND'];

function validateEvent(event) {
  if (event.schema_version !== CONFORMANCE_SCHEMA_VERSION) throw new Error('schema_version mismatch');
  if (!VALID_ACTIONS.includes(event.action))  throw new Error('unknown action: ' + event.action);
  if (!VALID_PHASES.includes(event.phase))    throw new Error('unknown phase: ' + event.phase);
  // ...
}
module.exports = { CONFORMANCE_SCHEMA_VERSION, validateEvent };
```

Both hooks and the validator `require()` this file. Any new field must be added here first, and the validator throws — rather than silently skips — on unrecognized values.

**Warning signs:**
- `validate-traces.cjs` reports 0 violations on a trace that should have failed
- Adding a new verdict type to `VALID_VERDICTS` in `update-scoreboard.cjs` without updating the validator schema
- Hook emits an event but the validator's trace output shows a gap (missing event)
- Schema version field absent from emitted events

**Phase to address:**
Conformance event logger phase (Phase 1 of v0.12). Define the schema file before writing any hook instrumentation. The validator and hooks must share the same schema module from the first commit.

---

### Pitfall 3: Hook Side-Effect Contamination — Emitting Events From Stop Hook Blocks Sessions

**What goes wrong:**
The Stop hook (`hooks/qgsd-stop.js`) reads stdin JSON and writes to stdout to signal `decision: block` or passes via `process.exit(0)`. Adding conformance event emission (file I/O, JSON append) inside the Stop hook creates two risks:

1. **Timing**: The Stop hook runs synchronously. Any slow file I/O (writing to a log on a network-mounted drive, file contention with a concurrent validator run) adds latency to every Claude session termination.

2. **stdout pollution**: If conformance logging accidentally writes anything to stdout alongside or instead of the block JSON, Claude Code misinterprets the output. The Stop hook's entire stdout is the decision payload — any extra byte corrupts it. Currently `qgsd-stop.js` uses `process.stdout.write(JSON.stringify({decision:'block',...}))` exactly once; any logging library that uses `console.log` inside the same process will corrupt this.

**Why it happens:**
Developers add `console.log('event:', JSON.stringify(event))` while debugging the conformance logger inside a hook file, not realizing the Stop hook's stdout is the decision protocol. The hook works in isolation but corrupts Claude Code's session when combined.

**How to avoid:**
Conformance events must be emitted to `stderr` (for debugging) and written to a log file via `fs.appendFileSync` or a separate process. The log file path must be determined before any stdout write. The emission function must use `process.stderr.write()`, never `console.log()` or `process.stdout.write()`, inside any hook file.

Implement a dedicated `emitConformanceEvent(event)` helper that:
- Writes to `~/.claude/qgsd-conformance.jsonl` (append)
- Uses `process.stderr.write()` for any debug output
- Never touches `process.stdout`
- Is wrapped in a `try/catch` that silently swallows errors (fail-open matches existing hook philosophy)

**Warning signs:**
- Claude Code shows garbled decision blocks ("Invalid JSON in hook response") after conformance logging is added
- `validate-traces.cjs` receives partial JSON in its input because stdout was contaminated
- Stop hook decision blocks appear with extra bytes before the `{` character

**Phase to address:**
Conformance event logger phase. Write `emitConformanceEvent()` before adding any hook instrumentation. Run the Stop hook test suite after adding emission to confirm zero stdout contamination.

---

### Pitfall 4: XState v5 ESM-Only Format Breaks CJS Hook Files

**What goes wrong:**
XState v5 (`xstate@5.x`) uses ESM as its primary module format. All official documentation examples use `import { createMachine }` syntax. If the XState machine is implemented as a `.ts` or `.mts` file and imported into a CJS hook file with `require('xstate')`, it throws `ERR_REQUIRE_ESM` at hook startup — blocking every session.

QGSD hooks are `.js` files loaded by Claude Code via `require()` (confirmed: `hooks/qgsd-stop.js` starts with `'use strict'; const fs = require('fs');`). The QGSD package itself is CJS (`package.json` uses `"main"` with no `"type": "module"`). Adding XState as a production dependency of hook files requires either transpiling the machine to CJS at build time or keeping the machine in a separate `.mts` file that is never directly `require()`'d from hooks.

**Why it happens:**
Developers add `npm install xstate` and write `const { createMachine } = require('xstate')` in a hook file. The test passes in isolation (Node.js test runner may resolve the ESM export via a conditional), but Claude Code's hook runner uses a different module resolution path and throws.

**How to avoid:**
Two acceptable patterns:

Pattern A (recommended — separate machine file, never required from hooks):
The XState machine lives in `src/qgsd-machine.ts`. It is compiled by `tsc` to `dist/qgsd-machine.cjs` using `"module": "CommonJS"` in tsconfig. The hooks never import it directly — the machine is a standalone executable used for conformance validation, not embedded in hook runtime.

Pattern B (no XState in hooks at all):
Hooks emit conformance events. The validator (`bin/validate-traces.cjs`) runs the XState machine independently as a post-hoc trace checker. No `require('xstate')` ever appears in any hook file.

Either way: `xstate` must not appear in the `dependencies` field that hook files consume at runtime, and must be either a `devDependency` or a separately installed package consumed only by `bin/` scripts.

**Warning signs:**
- `require('xstate')` in any file under `hooks/`
- `xstate` listed in `package.json` dependencies consumed by hook CJS runtime
- `ERR_REQUIRE_ESM` in Claude Code logs after QGSD install
- `hooks/dist/` rebuild doesn't include XState machine module

**Phase to address:**
XState machine phase. Decide the architecture (Pattern A or B) before writing any machine code. Verify by running the installed hook file with `node hooks/dist/qgsd-stop.js < /dev/null` — should exit cleanly with no XState import errors.

---

### Pitfall 5: PRISM Model Built From Insufficient Scoreboard Data

**What goes wrong:**
The PRISM probabilistic model is intended to use empirical TP/TN/UNAVAIL rates from `.planning/quorum-scoreboard.json` to build transition probability matrices for a DTMC (discrete-time Markov chain). The scoreboard currently has at most a few hundred rounds across all slots (QGSD was at v0.7 as of 2026-02-24). With N=10 slots and sparse per-slot histories, many transition pairs will have 0 or 1 observations.

A PRISM model derived from sparse data produces transition probabilities that are statistically meaningless. Claiming `P≥0.95 [F consensus_reached]` when that probability was estimated from 3 observations of one slot is mathematically invalid — the confidence interval on a 3-sample estimate overlaps 0 and 1. PRISM will verify the property against the hardcoded probability, not against the true distribution, producing a verification result that says nothing useful.

**Why it happens:**
Spec authors see scoreboard fields `tp`, `tn`, `fp`, `fn`, `unavail` and compute `p_unavail = unavail / (tp + tn + fp + fn + unavail)`. With `unavail=2, total=8`, this gives 0.25. PRISM accepts this as a valid transition probability. The verification passes. But `n=8` is far too small for any statistical claim about a 0.05 tail probability.

**How to avoid:**
Two mitigations, both required:

1. **Minimum data threshold gate**: `validate-traces.cjs` (or the PRISM model generator) must check that each slot has at least 30 rounds before including it in the model. Slots with fewer than 30 rounds use a conservative prior (`p_unavail = 0.3`, `p_tp = 0.7`) instead of empirical data. Document this in the model header.

2. **Confidence interval annotation**: The PRISM `.pm` file header must include a comment block showing the sample sizes and 95% Wilson confidence intervals for each transition probability. If any CI width exceeds 0.2, the property is flagged as LOW confidence in the header, not verified.

The PRISM model's value for this project is not statistical proof — it is a demonstration of the modelling approach and a sanity check that the claimed probabilities are at least plausible. Document this scope honestly.

**Warning signs:**
- Per-slot round count in scoreboard is below 30
- PRISM model header shows no sample size annotations
- Model property claims `P>=0.95` without a confidence interval comment
- Transition probabilities differ by >0.3 between early and late halves of the scoreboard history (sign of non-stationarity)

**Phase to address:**
PRISM model phase. Add the minimum data threshold check before writing any `.pm` file content. If the scoreboard is too sparse at phase execution time, generate the model with conservative priors and document clearly.

---

### Pitfall 6: Spec-to-Implementation Divergence — TLA+ Spec Describes an Idealized System

**What goes wrong:**
The TLA+ spec models the QGSD state machine abstractly: a quorum round is a single atomic action in the spec, but in the actual implementation it involves multiple separate operations (hook fires, `call-quorum-slot.cjs` invocations, `update-scoreboard.cjs` writes, orchestrator synthesizer decisions). The spec's `PhaseAdvance` action assumes all slot results are collected atomically before the verdict is computed. The implementation executes sequentially, with each slot call potentially failing mid-round.

If the conformance checker compares a spec `PhaseAdvance` event against a real trace where the phase advance happened across 4 separate log entries (one per slot call), the checker will either fail to find a matching spec action (false positive violation) or match the wrong action (silent conformance failure).

This is exactly the MongoDB problem: "When an old leader votes for a new one, the implementation has the old leader step down and then the new leader step up, but the spec assumed these two actions happened at once — a deliberate simplification in the spec."

**Why it happens:**
TLA+ specs naturally model distributed systems at a coarser granularity than implementations use. The spec author writes `PhaseAdvance` as one action for clarity; the implementation has 10+ distinct log events for what the spec treats as one transition. The checker tries to map N implementation events to 1 spec action and fails.

**How to avoid:**
Define action granularity explicitly in a `CONFORMANCE_MAPPING.md` before writing any validator code:

```
Spec Action       | Implementation Events (sequence)
------------------|-------------------------------------------
QuorumRoundStart  | QUORUM_STARTED
SlotResult        | SLOT_CALLED → SLOT_RESPONDED | SLOT_UNAVAIL
VerdictComputed   | QUORUM_VERDICT
PhaseAdvance      | PHASE_ADVANCE
```

The validator must collapse implementation event sequences into single spec-action tokens before checking conformance. Never compare implementation events 1:1 against spec actions.

**Warning signs:**
- Conformance checker reports violations on correct traces
- `PHASE_ADVANCE` in spec matches 5 different positions in implementation trace depending on parser
- Adding a new slot call adds a false violation to the conformance output
- Validator is checking per-event instead of per-action-sequence

**Phase to address:**
Conformance event logger phase (before any validator code). Write `CONFORMANCE_MAPPING.md` as the first deliverable. All subsequent validator and spec work uses this mapping.

---

### Pitfall 7: Alloy Facts Overconstraining the Vote-Counting Predicate

**What goes wrong:**
The Alloy model for vote-counting predicates is designed to answer: "Given N agents, M UNAVAIL, is this quorum count valid for a transition?" If the predicate logic uses Alloy `fact` declarations to constrain the agent population (e.g., `fact { all a: Agent | a.status in (Available + Unavail)}`), the Alloy Analyzer cannot generate counterexamples involving illegal agent configurations — configurations the implementation must handle defensively.

Specifically: if a `fact` prevents zero-agent configurations, the Alloy model cannot find the counterexample where `slots_available = 0` causes `min_quorum_met = false` — a real edge case the implementation does handle (fail-open logic in `qgsd-stop.js` line 431: `const isAvailable = availablePrefixes === null || availablePrefixes.includes(agent.prefix)`).

**Why it happens:**
Alloy facts feel like preconditions — "assumptions that are always true." The spec author adds `fact { #Agent >= 1 }` to avoid degenerate zero-agent cases. This makes the model cleaner but silently removes a class of counterexamples that validate the implementation's fail-open behavior.

**How to avoid:**
Use `pred` instead of `fact` for all structural constraints. Facts are only appropriate for Alloy-internal scope restrictions (cardinality limits to keep analysis tractable). Every predicate that constrains agent count or vote count must be an explicit `pred` invoked in `run` and `check` commands, not embedded as a global fact.

Specifically: the zero-agent case (`#Agent = 0`), the all-UNAVAIL case, and the minimum-quorum-not-met case must each be explicitly runnable as `run` scenarios to verify the model captures them correctly. If any of these cannot be run, it indicates a fact is overconstriciting the model.

**Warning signs:**
- `run { some Agent | Agent.status = Available }` finds no instances (overly constrained)
- Alloy cannot find a counterexample for `not min_quorum_met` even with 10 agents
- `fact` declarations outnumber `pred` declarations by more than 2:1
- The zero-agent scenario cannot be instantiated without editing a fact

**Phase to address:**
Alloy model phase. Review every `fact` declaration before submitting the model for analysis. Each fact must have an explicit justification comment explaining why it is not a predicate.

---

### Pitfall 8: JVM Dependency Management — PRISM and Petri Net Tools Require Specific Java Versions

**What goes wrong:**
PRISM model checker requires JDK (Java Development Kit) and a C/C++ compiler, and must be compiled from source or downloaded as a platform-specific binary. Petri Net analysis tools (PnAT, PNML-based tools) are also JVM-based. On macOS with Apple Silicon:

1. **Architecture mismatch**: PRISM's native library (`libprism.dylib`) is compiled for the build-time JDK architecture. If the user has JDK 21 (ARM64) but PRISM was compiled against JDK 11 (x86_64 via Rosetta), the JNI bridge fails with `java.lang.UnsatisfiedLinkError`.

2. **Java version pinning**: PRISM's JNI bindings are sensitive to JDK API changes. PRISM 4.8.1 (current as of 2026) requires JDK 8+ but has known issues with JDK 21 in some configurations. PRISM manual documents: "If you are compiling on Mac OS X and get libtool errors, upgrade XCode."

3. **PATH pollution**: `bin/validate-traces.cjs` must invoke PRISM via `spawnSync('prism', [...])`. If `prism` is not on PATH (common after manual source build), the spawn silently fails with `ENOENT`. The validator must check for the binary before attempting to call it and emit a clear error.

4. **No JVM for CI**: QGSD's test suite runs in Node.js (confirmed: `package.json` test script). Adding PRISM or Petri Net tool invocations to the test suite requires a JVM in CI. If CI does not have Java installed, these tests will silently skip or fail with `ENOENT`.

**How to avoid:**
- PRISM and Petri Net tools must be optional external dependencies, not required for the test suite to pass. Tests that exercise PRISM invoke it only when the `PRISM_BIN` or `JAVA_HOME` env var is set; otherwise, they generate the `.pm` file and skip execution.
- The validator's PRISM invocation is wrapped in a pre-check: `fs.existsSync(prismBin)` before `spawnSync`.
- Document PRISM installation in a `VERIFICATION_TOOLS.md` with the exact JDK version tested (e.g., "Tested with JDK 21.0.5 ARM64 on macOS 15.3").
- For Petri Net visualization, consider a pure JavaScript library (`@viz-js/viz` for Graphviz-based DOT rendering, or `petri-net-js` on npm) instead of PNML/JVM-based tools. This eliminates the JVM dependency from the Petri Net phase entirely.

**Warning signs:**
- `spawnSync('prism', [])` returns `{ error: { code: 'ENOENT' } }` in the validator
- Node.js test suite has a test that always fails in CI with `PRISM not found`
- `java -version` shows a different architecture than the PRISM build target
- `validate-traces.cjs` runs silently and produces no output (PRISM binary missing, no error emitted)

**Phase to address:**
PRISM phase and Petri Net phase. Establish the optional-invocation pattern at the start of each phase. CI integration tests must work on a machine without Java installed.

---

### Pitfall 9: XState Machine Guard Incompleteness — Missing Wildcard Guard

**What goes wrong:**
The XState machine for the QGSD 4-phase workflow models phase transitions with guard conditions. A common incompleteness: when multiple guarded transitions exist for the same event (e.g., `QUORUM_VERDICT` with guards `isConsensus`, `isDeliberate`, `isBlock`), XState evaluates them in order and takes the first matching transition. If none match (e.g., a new verdict type `GAPS_FOUND` is added to the implementation but not to the machine), XState silently drops the event — the machine stays in the current state without error.

Unlike the Stop hook's explicit VALID_VERDICTS list, the XState machine has no schema validation at runtime. A missing guard case produces a machine that appears to work (no exception thrown) but misses state transitions, accumulating event silently.

**Why it happens:**
Developers model the "happy path" guards: APPROVE → advance, BLOCK → blocked state, DELIBERATE → round 2. The `GAPS_FOUND` verdict was added to `VALID_VERDICTS` in `update-scoreboard.cjs` but the spec author didn't add it to the machine's guard list. TypeScript compilation passes because the guard function signature is valid — just never matched.

**How to avoid:**
Every guarded transition list must include an explicit `else` (default) fallback transition that routes to an `UnknownVerdict` error state:

```typescript
on: {
  QUORUM_VERDICT: [
    { guard: 'isApprove',    target: 'approved'    },
    { guard: 'isBlock',      target: 'blocked'     },
    { guard: 'isDeliberate', target: 'deliberating'},
    { guard: 'isConsensus',  target: 'consensus'   },
    { guard: 'isGapsFound',  target: 'gapsFound'   },
    // Explicit fallback — catches any new verdict type not yet modelled
    { target: 'unknownVerdictError' },
  ],
},
```

The `unknownVerdictError` state emits a warning log and transitions back to a safe state. This converts a silent miss into an observable failure.

Additionally: the machine's `VALID_VERDICTS` set must be imported from the same `conformance-schema.cjs` module as the hooks. Any new verdict type added to the schema automatically requires a guard update (TypeScript union type exhaustiveness check enforces this if typed correctly).

**Warning signs:**
- Machine receives `QUORUM_VERDICT` with `outcome: 'GAPS_FOUND'` and stays in `deliberating` state
- No `unknownVerdictError` state in the machine definition
- Adding a new verdict to the implementation does not cause a TypeScript error in the machine

**Phase to address:**
XState machine phase. The exhaustive-guard pattern must be established in the first state transition modeled. TypeScript exhaustiveness checking for verdict union types must be in place before the machine is tested.

---

### Pitfall 10: Conformance Logger Alters Hook Timing and Creates New Failure Modes

**What goes wrong:**
Adding synchronous `fs.appendFileSync()` calls to conformance event emission inside QGSD hooks introduces two new failure modes that did not exist before:

1. **Filesystem errors**: If the `.jsonl` log file's directory does not exist or the disk is full, `appendFileSync` throws. Even with a `try/catch`, the exception handling path introduces a code path that never existed before. A bug in the catch block (re-throwing, calling `process.exit(1)`) can crash the hook.

2. **Performance regression**: QGSD's Stop hook reads the entire transcript JSONL file synchronously. Adding another synchronous file write extends the Stop hook's execution time. On large transcripts (300+ lines) with slow I/O, this can cause Claude Code to time out waiting for the hook to complete.

Both failures manifest only in production (real user sessions) and are invisible in the test suite (which uses small synthetic transcripts and a fast local filesystem).

**Why it happens:**
Conformance logging is added incrementally — "just append to a file, no big deal." The failure mode is only visible under production conditions (large transcript, many conformance events per session, user's disk nearly full).

**How to avoid:**
- Emit conformance events asynchronously using a fire-and-forget pattern: `fs.appendFile(..., () => {})` (no-await, callback silently ignores errors). This ensures the hook's synchronous critical path is unaffected.
- The log file path must be determined once at hook startup (not per-event). Cache it in a module-level variable.
- The conformance emitter must have a guard: if the log file has not been written to in this session (cold start), ensure the parent directory exists with `fs.mkdirSync(dir, { recursive: true })` before any append.
- Never add synchronous blocking I/O to the Stop hook's critical path.

**Warning signs:**
- Stop hook execution time increases by >50ms after adding conformance emission
- Claude Code logs show "hook timed out" after adding logging
- Any `fs.appendFileSync` in a hook file's synchronous execution path

**Phase to address:**
Conformance event logger phase. The async-append pattern must be established before any event emission is added to hooks. Benchmark Stop hook latency before and after adding emission.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| TLA+ spec with all 10 named slots (no symmetry) | Easier to read spec (slot names match real names) | State explosion — TLC times out; liveness never completes | Never for model checking; acceptable for documentation-only specs |
| Single TLC model for safety + liveness | One config file to maintain | Liveness is 10x+ slower and prevents symmetry; safety violations buried in long runs | Never — always separate models |
| Shared `conformance-schema.cjs` skipped (both sides define own schema) | Faster to implement independently | Schema drift within weeks; silent conformance failures | Never — shared schema is non-negotiable |
| `require('xstate')` directly in hook files | Simpler dependency graph | `ERR_REQUIRE_ESM` in production; breaks every session | Never — XState must stay out of hook runtime |
| PRISM model using raw per-slot rates with n<30 | Model exists immediately | Statistically meaningless probabilities; verification result is noise | Acceptable only if documented as illustrative (not verified) |
| Alloy `fact` instead of `pred` for vote constraints | Simpler model syntax | Cannot find counterexamples for edge cases the implementation handles | Never for vote count constraints — use `pred` |
| PRISM binary required (not optional) in test suite | Simpler test setup | CI breaks on any machine without Java; test suite non-portable | Never — JVM tools must be optional |
| `fs.appendFileSync` in Stop hook critical path | Simplest logging pattern | Hook latency increase; potential timeout under slow I/O | Never — use async append |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TLA+ spec + TLC runner | Running TLC once against production slot count (N=10) | Start with N=3, validate spec structure, then scale; use TLC profiler to identify explosion source |
| XState machine + CJS hooks | `require('xstate')` in hook file | Machine is a standalone `.ts` file compiled to CJS; hooks never import it directly |
| Conformance logger + Stop hook stdout | `console.log(event)` for debugging inside hook | Only `process.stderr.write()` or file append; never stdout |
| PRISM tool + Node.js | `spawnSync('prism')` without PATH check | `fs.existsSync(prismBin)` pre-check; fail gracefully with install instructions when not found |
| Alloy + quorum edge cases | `fact` declarations remove zero-agent and all-UNAVAIL states | Use `pred` for structural constraints; explicitly run zero-agent and all-UNAVAIL scenarios |
| Conformance schema + scoreboard | VALID_VERDICTS defined independently in validator and scoreboard | Single `conformance-schema.cjs` module; scoreboard and validator both import from it |
| TLC symmetry + liveness | Declaring symmetry set then checking `no_infinite_deliberation` liveness | Separate `.cfg` files: safety uses symmetry, liveness uses smaller N without symmetry |
| Petri Net tools + CI | JVM-based PNML tool in CI test suite | Use JS-native DOT/SVG generator or skip PNML; guard JVM invocation with `JAVA_HOME` check |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| TLC with 10 named slots (no symmetry) | Model checking never completes; memory exhaustion after 10M states | Symmetry sets (safety model only); N=3 for initial validation | With N≥6 slots and any deliberation rounds |
| TLC checking safety + liveness in one model | Verification takes hours; never shows intermediate progress | Separate models: `qgsd_safety.cfg` and `qgsd_liveness.cfg` | As soon as liveness property is added |
| Synchronous conformance event logging in Stop hook | Hook latency visible to user (>200ms pause before Claude response) | Async append with no-await callback | With large transcript files (300+ lines) or slow disk |
| XState actor instantiated per-event (not per-session) | Memory leak; state machine history lost between events | Single actor instance per validation run; actor state persists across events | When processing a trace with >100 events |
| PRISM numeric precision with float probabilities | Verification result changes based on floating-point representation | Round probabilities to 4 decimal places; use PRISM's built-in precision parameter | With computed probabilities from very small sample counts |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Conformance log at world-readable path | Log contains quorum turn content (planning decisions) visible to other processes | Log to `~/.claude/qgsd-conformance.jsonl` with mode 0600; `fs.appendFile` with `{ mode: 0o600 }` |
| Alloy model includes real agent names and IP addresses | Spec doc contains sensitive infrastructure details | Alloy model uses abstract names (Slot0..9); no real hostnames or tokens |
| PRISM `.pm` file embeds raw scoreboard round data | Scoreboard contains task names and planning decision outcomes | PRISM model uses aggregated statistics only; no per-round data in `.pm` file |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| `validate-traces.cjs` emits no output when PRISM not installed | User runs validator, sees nothing, assumes success | Validator prints `[INFO] PRISM not found — skipping probabilistic check. Install via VERIFICATION_TOOLS.md` |
| TLC model check output is raw Java stdout | Difficult to parse; no actionable summary | Wrap TLC invocation to extract final state count and violation summary; emit structured JSON |
| XState machine type errors from TypeScript only visible at build time | Hook runtime silently drops unmodelled events | Add a Jest test that runs the machine against a synthetic trace and asserts every expected event is processed |
| Conformance log grows unbounded across sessions | User's `~/.claude/` fills with trace data | Rotate log: keep only the last 1000 events; truncate older entries on each session start |

---

## "Looks Done But Isn't" Checklist

- [ ] **TLA+ spec:** TLC runs without error on safety model, but liveness model not yet configured — verify `qgsd_liveness.cfg` exists and has checked `no_infinite_deliberation` with N=3.
- [ ] **Conformance schema:** Both hooks and validator define their own event field lists — verify both import from a single `conformance-schema.cjs` module with no duplicate field definitions.
- [ ] **XState machine:** Machine compiles cleanly with `tsc` but `GAPS_FOUND` verdict silently drops — verify every guarded transition list has an explicit fallback `{ target: 'unknownVerdictError' }`.
- [ ] **PRISM model:** `.pm` file exists with plausible-looking probabilities, but no sample size annotations — verify header includes sample sizes and CI widths for every transition probability.
- [ ] **Petri Net:** Visualization renders in browser, but deadlock analysis was not run — verify reachability analysis output (SMPT or equivalent) is included alongside the SVG.
- [ ] **Stop hook emission:** Conformance events appear in `gsd-conformance.jsonl` during development (fast local disk), but hook latency is not measured — benchmark Stop hook execution time on a 300-line transcript with logging enabled.
- [ ] **JVM tool integration:** PRISM test passes on developer machine, but CI build has no Java installed — verify test is gated on `PRISM_BIN` or `JAVA_HOME` env var and skips cleanly when absent.
- [ ] **Alloy model:** `check` command finds no counterexamples, but all constraints are `fact` declarations — verify zero-agent and all-UNAVAIL `run` scenarios find instances; if not, overly-constrained facts exist.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| TLC state explosion (times out at N=10) | LOW | Reduce to N=3; add symmetry set; separate safety/liveness models; re-run. No spec rewrite required. |
| Schema drift — validator gives wrong answers | MEDIUM | Audit all event field names in hooks vs validator; create `conformance-schema.cjs`; update both to import from it; re-run validator on existing traces |
| `ERR_REQUIRE_ESM` from XState in hook | LOW | Move XState import out of hook file; compile machine to CJS via `tsc --module commonjs`; re-install hook |
| Stop hook stdout corrupted by logging | LOW | Replace all `console.log` with `process.stderr.write`; re-run Stop hook tests to confirm clean stdout |
| PRISM model with meaningless probabilities | MEDIUM | Add minimum-data threshold check; recompute with conservative priors for sparse slots; re-annotate CI widths |
| Alloy overconstrained (no counterexamples) | LOW | Identify fact declarations blocking edge cases; convert to `pred`; re-run `check` commands |
| JVM tools blocking CI | LOW | Gate PRISM/PnAT invocations on env var; mark tests as conditional-skip; CI passes without Java |
| XState machine drops events silently | LOW | Add fallback `{ target: 'unknownVerdictError' }` to every guarded transition; add test asserting no events are silently dropped |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| TLA+ state explosion from UNAVAIL permutations | TLA+ spec phase — define two model configs (safety/liveness) from the start | Verify: TLC completes in <5 minutes with N=5 slots on safety model; N=3 on liveness model |
| Conformance log schema drift | Conformance event logger phase — write `conformance-schema.cjs` first | Verify: `grep -r 'VALID_ACTIONS\|VALID_PHASES\|VALID_OUTCOMES' hooks/ bin/` returns zero direct definitions (all imported from schema) |
| Hook stdout contamination from logging | Conformance event logger phase — establish emit helper before any emission | Verify: `node hooks/dist/qgsd-stop.js < test/fixtures/planning-turn.json | jq .` parses cleanly after adding emission |
| XState ESM in CJS hooks | XState machine phase — Pattern A or B decided before any machine code | Verify: `node -e "require('./hooks/dist/qgsd-stop.js')"` exits 0 with xstate installed |
| PRISM model with sparse data | PRISM model phase — minimum-data threshold check written first | Verify: generator logs sample sizes; skips slots with <30 rounds; outputs CI annotations |
| Spec-to-implementation granularity mismatch | Conformance event logger phase — `CONFORMANCE_MAPPING.md` written as first deliverable | Verify: every spec action appears in the mapping document with ≥1 implementation event sequence |
| Alloy fact overconstrain | Alloy model phase — every `fact` reviewed before analyzer run | Verify: zero-agent `run` scenario finds an instance; all-UNAVAIL `run` scenario finds an instance |
| JVM dependency in CI | PRISM phase and Petri Net phase — optional invocation gating from the start | Verify: `npm test` passes on a machine with `PRISM_BIN` unset and no `java` on PATH |
| XState guard incompleteness | XState machine phase — exhaustive guard with fallback established in first transition | Verify: sending `QUORUM_VERDICT` with an unrecognized outcome routes to `unknownVerdictError` state |
| Hook latency regression from conformance logging | Conformance event logger phase — benchmark before and after adding emission | Verify: Stop hook latency on 300-line transcript is <100ms with logging enabled |

---

## Sources

- Direct inspection of `hooks/qgsd-stop.js` — confirmed: CJS, synchronous stdin/stdout protocol, `process.stdout.write` for block decision; `wasOrchestratorUsed()` and `wasSlotCalledSuccessfully()` as key transcript-scan functions; fail-open philosophy throughout
- Direct inspection of `bin/update-scoreboard.cjs` — confirmed: `VALID_VERDICTS` includes APPROVE/BLOCK/DELIBERATE/CONSENSUS/GAPS_FOUND/—; `VALID_MODELS` list; per-slot composite key `<slot>:<model-id>`; scoreboard may have very sparse data (gitignored, rebuilt per project)
- Direct inspection of `bin/call-quorum-slot.cjs` — confirmed: CJS, `require('child_process')`, CJS module system used throughout QGSD bin scripts
- Direct inspection of `agents/qgsd-quorum-orchestrator.md` — confirmed: 4-phase workflow (pre-flight, team identity, worker wave, synthesis); Mode A and Mode B; sequential slot calls with one wave of parallel Task spawns per round
- [Conformance Checking at MongoDB: Testing That Our Code Matches Our TLA+ Specs](https://www.mongodb.com/company/blog/engineering/conformance-checking-at-mongodb-testing-our-code-matches-our-tla-specs) — PRIMARY source; action granularity mismatch, state snapshot complexity, spec-to-implementation divergence; HIGH confidence
- [Optimizing Model Checking — Learn TLA+](https://learntla.com/topics/optimization.html) — symmetry set reduction (n! factor), separate safety/liveness models, constant minimization; HIGH confidence
- [Model Values and Symmetry — TLA+ Toolbox Docs](https://tla.msr-inria.inria.fr/tlatoolbox/doc/model-values.html) — liveness incompatibility with symmetry sets explicitly documented; HIGH confidence
- [Don't let Alloy facts make your specs a fiction — Hillel Wayne](https://www.hillelwayne.com/post/alloy-facts/) — `fact` overconstrain pitfall, use `pred` instead; HIGH confidence
- [PRISM Manual — Installing PRISM / Common Problems](https://www.prismmodelchecker.org/manual/InstallingPRISM/CommonProblemsAndQuestions) — JDK architecture mismatch, macOS XCode libtool errors; MEDIUM confidence (official source but macOS-version-specific)
- [XState v5 Installation Docs](https://stately.ai/docs/installation) — all examples use ESM `import` syntax; "zero dependencies and runs anywhere JavaScript runs"; CJS compatibility unconfirmed — treat as ESM-primary; MEDIUM confidence
- [XState v5 Guards Documentation](https://stately.ai/docs/guards) — multiple guarded transitions evaluated in order; no runtime error on missing match; HIGH confidence
- [Validating Traces of Distributed Programs Against TLA+ Specifications — Springer 2024](https://link.springer.com/chapter/10.1007/978-3-031-77382-2_8) — partial-log trace checking; conformance completeness limitations; MEDIUM confidence (abstract only)
- `.planning/PROJECT.md` — QGSD v0.12 target features, existing hook architecture, scoreboard schema, slot naming convention

---
*Pitfalls research for: v0.12 Formal Verification — adding TLA+, XState, Alloy, PRISM, Petri Net, and conformance logging to existing Node.js QGSD plugin*
*Researched: 2026-02-24*
