# Requirements: QGSD v0.12 Formal Verification

**Defined:** 2026-02-24
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.12 Requirements

### Conformance Logging

- [ ] **LOG-01**: Developer can require a shared `conformance-schema.cjs` module from both hooks and `validate-traces.cjs` — single source of truth for event field definitions
- [ ] **LOG-02**: Stop, UserPromptSubmit, and PreToolUse hooks emit structured NDJSON events to `.planning/conformance-events.jsonl` on every quorum decision turn
- [ ] **LOG-03**: Each emitted event contains `{ ts, phase, action, slots_available, vote_result, outcome }` matching the schema module definition

### XState Machine

- [ ] **XST-01**: Developer can find `src/machines/qgsd-workflow.machine.ts` — a 4-phase XState v5 state machine modeling QGSD's planning → research → execution → verification workflow
- [ ] **XST-02**: `tsconfig.formal.json` + `tsup` build step compiles the machine to CJS output usable by `validate-traces.cjs` without importing XState in hook files
- [ ] **XST-03**: Machine guards encode quorum predicates: `minQuorumMet`, `noInfiniteDeliberation`, `phaseMonotonicallyAdvances`

### Trace Validator

- [ ] **VAL-01**: User can run `bin/validate-traces.cjs` to replay `.planning/conformance-events.jsonl` through the XState machine and see divergences flagged
- [ ] **VAL-02**: Validator outputs a deviation score (% of traces that are valid XState executions) — the "closeness" metric
- [ ] **VAL-03**: `validate-traces.cjs` is shipped to users via npm install and runnable as `node ~/.claude/qgsd-bin/validate-traces.cjs`

### TLA+ Spec

- [ ] **TLA-01**: Developer can find `formal/tla/QGSDQuorum.tla` — formal TLA+ spec of QGSD states, actions, and invariants
- [ ] **TLA-02**: `formal/tla/MCsafety.cfg` configures TLC with symmetry sets to check safety invariants (MinQuorumMet, NoInvalidTransition)
- [ ] **TLA-03**: `formal/tla/MCliveness.cfg` configures TLC with N=3 bounded model to check liveness (EventualConsensus)
- [ ] **TLA-04**: Developer can run `bin/run-tlc.cjs` to invoke TLC JAR; script checks Java ≥17 and exits cleanly if `JAVA_HOME` unset

### Alloy Model

- [ ] **ALY-01**: Developer can find `formal/alloy/quorum-votes.als` — vote-counting predicates using `pred` (not `fact`) to enable counterexample generation
- [ ] **ALY-02**: Developer can run `bin/run-alloy.cjs` to invoke Alloy 6 JAR headless; gated on `JAVA_HOME`

### PRISM Model

- [ ] **PRM-01**: Developer can find `formal/prism/quorum.pm` — DTMC model of quorum convergence with transition probabilities
- [ ] **PRM-02**: Developer can run `bin/export-prism-constants.cjs` to read scoreboard TP/TN/UNAVAIL data and export empirical rates as a `.const` file for PRISM
- [ ] **PRM-03**: Rate exporter warns and uses conservative priors when scoreboard has fewer than 30 rounds per slot

### Petri Net

- [ ] **PET-01**: Developer can run `bin/generate-petri-net.cjs` to emit a Graphviz DOT file of the quorum token-passing net
- [ ] **PET-02**: `generate-petri-net.cjs` renders DOT to SVG via `@hpcc-js/wasm-graphviz` (no system Graphviz install required)
- [ ] **PET-03**: Script emits a structural deadlock warning if `min_quorum_size > available_slots` (net can never fire)

## Future Requirements

### Extended Verification

- **EXT-01**: CI integration — run `validate-traces.cjs` automatically after each quorum round
- **EXT-02**: TLA+ PlusCal variant for human-readable spec alongside machine-checkable version
- **EXT-03**: Real-time dashboard showing conformance deviation score trend over time

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hook-time formal checking | Hooks are fail-open, zero-dep, stdout-gated — no JVM or TypeScript import allowed at runtime |
| PRISM web UI | Offline CLI tooling only; no server process |
| Automated TLA+ spec generation from code | Too fragile — spec is hand-authored against CLAUDE.md R0–R8 invariants |
| Petri Net PNML format | DOT + WASM Graphviz is simpler and eliminates JVM dependency for visualization |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOG-01 | v0.12-01 | Pending |
| LOG-02 | v0.12-01 | Pending |
| LOG-03 | v0.12-01 | Pending |
| XST-01 | v0.12-01 | Pending |
| XST-02 | v0.12-01 | Pending |
| XST-03 | v0.12-01 | Pending |
| VAL-01 | v0.12-01 | Pending |
| VAL-02 | v0.12-01 | Pending |
| VAL-03 | v0.12-01 | Pending |
| TLA-01 | v0.12-02 | Pending |
| TLA-02 | v0.12-02 | Pending |
| TLA-03 | v0.12-02 | Pending |
| TLA-04 | v0.12-02 | Pending |
| ALY-01 | v0.12-03 | Pending |
| ALY-02 | v0.12-03 | Pending |
| PRM-01 | v0.12-03 | Pending |
| PRM-02 | v0.12-03 | Pending |
| PRM-03 | v0.12-03 | Pending |
| PET-01 | v0.12-03 | Pending |
| PET-02 | v0.12-03 | Pending |
| PET-03 | v0.12-03 | Pending |

**Coverage:**
- v0.12 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initial definition*
