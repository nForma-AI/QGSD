# Project Research Summary

**Project:** QGSD v0.12 — Formal Verification
**Domain:** Formal verification tooling (TLA+, XState, Alloy, PRISM, Petri Net, conformance log checking) integrated into an existing Node.js Claude Code plugin
**Researched:** 2026-02-24
**Confidence:** HIGH (stack and architecture verified against official sources; pitfalls grounded in direct source code inspection and post-mortem literature)

## Executive Summary

QGSD v0.12 adds a formal verification layer to a mature, stable plugin codebase. The core challenge is not building something novel — each tool (TLA+, XState, Alloy, PRISM) is well-understood in isolation — but integrating them as a cohesive layer that preserves the existing hook pipeline's fail-open, zero-dependency philosophy. The existing architecture (CJS hooks, no ESM, no build step, fail-silent I/O) imposes hard constraints on how and where each formal tool can be wired in. Violating these constraints (e.g., importing XState directly into hooks, running PRISM synchronously inside the Stop hook) will silently break production sessions.

The recommended approach is a strict separation of concerns: hooks emit lightweight append-only conformance events as a fire-and-forget side effect, and all formal analysis — XState replay, TLA+ model checking, Alloy counterexample search, PRISM probabilistic verification — runs offline as developer-initiated CLI commands. The only user-facing deliverable is `bin/validate-traces.cjs`, which reads the conformance log and replays it against the compiled XState machine. All JVM-based tools (TLA+, Alloy, PRISM) are optional external dependencies gated by environment variable checks; they must never be required for `npm test` to pass.

The dominant risks are: (1) TLA+ state explosion if all 10 slots are modeled as named constants without symmetry sets, (2) conformance log schema drift if hooks and the validator each define their own event field lists independently, and (3) hook stdout contamination if conformance logging accidentally touches `process.stdout` inside the Stop hook. All three risks are preventable at the start of Phase 1 through a shared schema module, a documented emit helper, and a pre-commitment benchmark of Stop hook latency.

---

## Key Findings

### Recommended Stack

Three npm packages are added (`xstate@5.28.0`, `ajv@8.18.0`, `@hpcc-js/wasm-graphviz@2.32.3+`) plus two dev dependencies (`typescript@5.x`, `tsup` latest). All are CJS-compatible via conditional exports — `require('xstate')` and `require('ajv')` work in Node.js CommonJS scripts. Three external JVM tools require manual installation: `tla2tools.jar` v1.8.0 (Java 11+), `alloy.jar` v6.2.0 (Java 17+), and PRISM v4.10 (Java 9+). A single `brew install openjdk@17` satisfies all three because Alloy sets the highest JVM floor. No native Graphviz installation is needed — `@hpcc-js/wasm-graphviz` bundles Graphviz as WASM.

**Core technologies:**

- `xstate@5.28.0`: Executable state machine + trace replay — CJS-compatible via dual package; TypeScript 5.x required for full type inference; `createActor` + `actor.send()` is the replay API
- `ajv@8.18.0`: JSON Schema validation of conformance log events — fastest Node.js validator; plain JSON Schema avoids TypeScript-compilation dependency for CJS bin/ scripts
- `@hpcc-js/wasm-graphviz@2.32.3+`: DOT-to-SVG rendering for Petri Net — zero OS-level Graphviz install; WASM bundled; CI-verified on Node 20/22/24
- `tla2tools.jar@1.8.0`: TLA+ parsing + TLC model checking — official monolith JAR; CLI invocation only via `child_process.spawnSync('java', ['-cp', ...])`
- `alloy.jar@6.2.0`: Alloy Analyzer + SAT solving — `exec -t json` CLI mode for counterexample output; bundles Sat4j/MiniSat/Glucose; Java 17 required
- PRISM 4.10: Probabilistic DTMC verification — `-pf` flag for inline property; binary distribution; Java 9+
- `typescript@5.x` + `tsup`: Compile `formal/qgsd-machine.ts` to CJS via `tsconfig.formal.json` with `"module": "commonjs"`

**What NOT to use:** `xstate@4.x` (deprecated API), `zod` for log validation (TypeScript-first, awkward in CJS), native `dot` CLI (requires OS install), any npm Petri Net library (`petri-net` last published 10 years ago), TLAPS proof system (requires Isabelle/HOL, overkill for bounded model), LoLA analyzer (C++ native binary, overkill when TLC covers reachability).

### Expected Features

All 6 features are in scope for v0.12. The dependency chain determines delivery order.

**Must have (table stakes — without these the milestone is not "formal verification"):**

- Conformance event logger — JSONL append-only event emission from hooks; data source for everything else; must be the first deliverable built
- XState TypeScript machine (`formal/qgsd-machine.ts`) — 4 states (`IDLE`, `COLLECTING_VOTES`, `DELIBERATING`, `DECIDED`), 4 typed guards; compiled to CJS; the executable spec
- `bin/validate-traces.cjs` — the only user-facing CLI artifact; reads conformance log, replays against XState machine, reports violations with exit code 0/1/2
- TLA+ spec with named invariants (`formal/tla/qgsd-workflow.tla`) — `TypeInvariant`, `MinQuorumMet`, `PhaseMonotonicallyAdvances` (safety), `EventualConsensus` (liveness); TLC-verified at N=3 slots

**Should have (differentiators — without these the milestone is incomplete but functional):**

- Alloy vote-counting model (`formal/alloy/quorum-vote.als`) — structural counterexample generation; catches off-by-one errors in vote counting; independent of trace data
- PRISM probabilistic model + generator (`bin/export-prism-constants.cjs` + `formal/prism/`) — scoreboard-derived DTMC; `P>=0.95 [F<=3 consensus]` property
- Petri Net generator (`bin/generate-petri-net.cjs`) — DOT-format output rendered to SVG; analytical deadlock check for min_quorum_size; lowest complexity deliverable

**Defer to v0.12.x / v0.13+:**

- Continuous conformance CI (run `validate-traces.cjs` in CI on every push)
- XState Stately visualizer JSON export
- Circuit breaker TLA+ spec (requires modeling git history state — high complexity)
- PRISM per-round degradation model (quota saturation over time)

### Architecture Approach

The v0.12 architecture adds a passive event emission layer to the existing hook pipeline without altering the hooks' decision logic. Three hooks (`qgsd-prompt.js`, `qgsd-stop.js`, `qgsd-circuit-breaker.js`) gain a single fire-and-forget `appendConformanceEvent()` call each, placed after their existing decision logic. The function lives in `hooks/config-loader.js` (already required by all three hooks) and uses async `fs.appendFile` with a no-op callback. All formal verification artifacts live under a new `formal/` directory with tool-specific subdirectories (`tla/`, `alloy/`, `prism/`, `petri/`). The XState machine is the sole TypeScript file in the project, compiled separately via `tsconfig.formal.json` to CJS for consumption by `validate-traces.cjs`.

**Major components:**

1. `hooks/config-loader.js` (modified) — adds `appendConformanceEvent()` helper; async, fail-silent, never touches stdout
2. `.planning/conformance-log.ndjson` (new, gitignored) — append-only NDJSON event stream; one JSON object per line
3. `bin/conformance-schema.cjs` (new) — single shared source of truth for `VALID_ACTIONS`, `VALID_PHASES`, `VALID_OUTCOMES`; imported by both hooks (emitters) and `validate-traces.cjs` (consumer)
4. `formal/qgsd-machine.ts` compiled to `formal/dist/qgsd-machine.cjs` (new) — XState v5 machine with `setup()` guards; never imported by any hook file
5. `bin/validate-traces.cjs` (new) — user-facing CLI; reads log, schema-validates with Ajv, replays via XState actor, reports violations
6. `formal/tla/` (new) — TLA+ spec + two TLC configs (safety with symmetry, liveness without); checked offline
7. `formal/alloy/` (new) — Alloy `.als` model; `pred`-only constraints; checked via Alloy Analyzer JAR
8. `formal/prism/` (new) — PRISM `.pm` + `.pctl`; `bin/export-prism-constants.cjs` generates `rates.const` from scoreboard; `rates.const` gitignored
9. `formal/petri/` (new) — DOT-format Petri Net; `bin/generate-petri-net.cjs`; SVG rendered via `@hpcc-js/wasm-graphviz`

**Key patterns to follow:**

- Fail-silent side-effect emission: `appendConformanceEvent` uses async `fs.appendFile` with empty callback; never throws, never blocks hook critical path
- Compiled TypeScript in CJS project: `tsconfig.formal.json` with `"module": "commonjs"`; compiled `.cjs` output committed alongside `.ts` source
- NDJSON for append-only log: `fs.appendFile` writes; `readFileSync + split('\n')` reads; no JSON array rewrite needed
- Generated constants isolate spec from data: PRISM `rates.const` generated per-project from scoreboard; committed `.pm` model is data-independent template

### Critical Pitfalls

1. **TLA+ state explosion from UNAVAIL permutations** — Modeling all 10 slots as named constants without symmetry produces 3^10 state combinations; TLC times out. Prevention: define two separate TLC model configs from the start — `qgsd_safety.cfg` (symmetry sets enabled, N=5) and `qgsd_liveness.cfg` (no symmetry, N=3). Liveness properties cannot use symmetry sets.

2. **Conformance log schema drift** — Hooks and validator independently defining event field lists leads to silent false passes when new verdict types (e.g., `GAPS_FOUND`) are added. Prevention: write `bin/conformance-schema.cjs` as the very first deliverable of Phase 1; both hooks and validator import from it; TypeScript union types enforce guard completeness at compile time.

3. **Hook stdout contamination** — Any `console.log()` inside a hook file while debugging conformance logging corrupts the hook decision channel (stdout is the decision protocol). Prevention: `appendConformanceEvent()` helper uses only `fs.appendFile` + `process.stderr.write()`; Stop hook tests confirm clean stdout after adding emission.

4. **XState ESM in CJS hooks** — `require('xstate')` in a hook file throws `ERR_REQUIRE_ESM` in production because XState v5 is ESM-primary. Prevention: XState machine lives in `formal/` and is compiled to CJS by tsup; no hook file ever imports it; hooks maintain zero npm runtime dependencies.

5. **PRISM model with sparse scoreboard data** — Computing transition probabilities from fewer than 30 rounds per slot produces statistically meaningless verification results. Prevention: generator enforces a 30-round minimum threshold; sparse slots use conservative priors (UNAVAIL=0.3, TP=0.7); `.pm` file header annotates sample sizes and 95% Wilson confidence intervals for every transition probability.

---

## Implications for Roadmap

Research identifies three phases driven by a clear dependency chain. Event emission infrastructure must precede the XState replay checker. Both must precede the static formal specs. The three JVM-based tools (TLA+, Alloy, PRISM) can be developed in parallel within Phase 3. The Petri Net is the capstone visualization artifact with no new code dependencies.

### Phase v0.12-01: Conformance Event Infrastructure

**Rationale:** Every downstream component depends on having a stable event schema and a working log emitter. The shared schema module (`conformance-schema.cjs`) is the foundation that prevents schema drift permanently — it must exist before any hook instrumentation is written. `CONFORMANCE_MAPPING.md` (spec action to implementation event sequence mapping) must also be the first deliverable because validator logic depends on this granularity decision. This phase has zero external tool dependencies.

**Delivers:** `bin/conformance-schema.cjs` (shared schema with `VALID_ACTIONS`, `VALID_PHASES`, `VALID_OUTCOMES`, `schema_version`), `CONFORMANCE_MAPPING.md` (action granularity document), `appendConformanceEvent()` helper in `hooks/config-loader.js` (async, fail-silent), PHASE_START emission in `qgsd-prompt.js`, QUORUM_VERDICT emission in `qgsd-stop.js`, OSCILLATION_DETECTED emission in `qgsd-circuit-breaker.js`, `.planning/conformance-log.ndjson` gitignored, hooks synced to `hooks/dist/` + installed

**Addresses:** Table-stakes feature: Conformance event logger

**Avoids:** Pitfalls 2 (schema drift — shared schema module from day one), 3 (stdout contamination — emit helper established before hook instrumentation), 6 (spec-to-implementation granularity mismatch — CONFORMANCE_MAPPING.md as first deliverable)

**Install sync required:** All three modified hooks must be synced to `hooks/dist/` and installed via `node bin/install.js --claude --global` after changes. Benchmark Stop hook latency on a 300-line transcript before and after adding emission to verify no timing regression.

### Phase v0.12-02: XState Machine and Trace Validator

**Rationale:** `bin/validate-traces.cjs` is the only user-facing CLI artifact of the entire milestone. It requires both the compiled XState machine and a working event log from Phase 1. This phase delivers the core user value: a runnable conformance checker. Critically, writing the XState machine here finalizes the canonical state names (`IDLE`, `COLLECTING_VOTES`, `DELIBERATING`, `DECIDED`) that TLA+ and Alloy in Phase 3 must mirror. Finalizing state names before writing specs prevents naming divergence.

**Delivers:** `formal/qgsd-machine.ts` (XState v5 with `setup()` guards, 4 states, 4 typed guards including fallback `unknownVerdictError` target), `tsconfig.formal.json` (`"module": "commonjs"`), `formal/dist/qgsd-machine.cjs` (compiled output, committed), `bin/validate-traces.cjs` (Ajv 8.x schema validation + XState actor replay + human-readable output + `--json` flag + exit codes 0/1/2), updated `package.json` (`xstate`, `ajv`, `typescript`, `tsup` dependencies, `build` and `test:formal` scripts), unit tests for machine guards including `GAPS_FOUND` unrecognized verdict routing to `unknownVerdictError`

**Addresses:** Table-stakes features: XState executable machine, `validate-traces.cjs` CLI

**Uses stack:** `xstate@5.28.0`, `ajv@8.18.0`, `typescript@5.x`, `tsup`

**Avoids:** Pitfall 4 (XState ESM in CJS hooks — machine compiled separately, never in hook runtime), Pitfall 9 (guard incompleteness — explicit `unknownVerdictError` fallback from the first state transition modeled)

### Phase v0.12-03: Static Formal Specifications

**Rationale:** All four static and probabilistic tools are independent of each other and of the runtime conformance log (PRISM reads only the scoreboard JSON). They can be developed in parallel within this phase. TLA+ should be written first because it is the formal ground truth and its invariant names inform the Alloy predicate and PRISM state naming. Alloy and PRISM can proceed in parallel after TLA+ state names are established. Petri Net is purely a visualization artifact and should be done last.

**Delivers:**

- `formal/tla/qgsd-workflow.tla` + `qgsd-workflow.cfg` (two TLC configs: `qgsd_safety.cfg` with symmetry sets N=5, `qgsd_liveness.cfg` without symmetry N=3); TLC-verified with no violations on both configs; `formal/tla/Makefile` for TLC invocation
- `formal/alloy/quorum-vote.als` with `pred`-based vote-counting predicate and `NoSpuriousApproval` `check` assertion; explicit `run` scenarios for zero-agent and all-UNAVAIL edge cases; Alloy Analyzer confirms no counterexamples for N≤5 slots
- `formal/prism/quorum-consensus.pm` + `quorum-consensus.pctl`; `bin/export-prism-constants.cjs` (scoreboard → `rates.const` with 30-round minimum threshold, conservative priors for sparse slots, sample size and CI width annotations in `.pm` header); `rates.const` gitignored
- `bin/generate-petri-net.cjs` (reads `qgsd.json`, writes DOT-format Petri Net to `formal/petri/quorum-net.dot`, renders SVG via `@hpcc-js/wasm-graphviz`, analytical deadlock check for min_quorum_size)
- `VERIFICATION_TOOLS.md` with JDK installation instructions (Java 17 satisfies all three JVM tools); all JVM invocations gated on `PRISM_BIN`/`JAVA_HOME` env var; `npm test` passes without Java installed

**Addresses:** Differentiator features: Alloy vote-counting model, PRISM probabilistic model, Petri Net generator; Table-stakes feature: TLA+ specification with named invariants

**Uses stack:** `tla2tools.jar@1.8.0`, `alloy.jar@6.2.0`, PRISM 4.10 (all external JVM tools), `@hpcc-js/wasm-graphviz@2.32.3+`

**Avoids:** Pitfall 1 (TLA+ state explosion — two model configs with symmetry sets from the start), Pitfall 5 (PRISM sparse data — 30-round minimum threshold enforced), Pitfall 7 (Alloy fact overconstrain — `pred`-only, explicit edge case `run` scenarios), Pitfall 8 (JVM in CI — all JVM invocations are optional, gated on env var)

### Phase Ordering Rationale

- Phase 1 must come first because all downstream components consume the schema module or the event log. Writing `conformance-schema.cjs` before any hook code is the single highest-leverage decision in the milestone — it permanently prevents the most common real-world failure mode (schema drift leading to silent false passes).
- Phase 2 comes before Phase 3 because the XState machine finalizes the canonical state names that TLA+ and Alloy must mirror. Writing specs before the machine risks naming divergence between the executable model and the formal specifications.
- Phase 3 bundles all JVM-based tools together because they share the Java 17 installation prerequisite, are all independent of the Phase 1/2 runtime log, and can be developed in parallel within the phase.
- The Petri Net is last within Phase 3 because it is purely a visualization artifact derived from the fully stable Phase 2-3 model — it adds no new runtime capability and requires no new code dependencies beyond `@hpcc-js/wasm-graphviz`.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase v0.12-03 (TLA+ spec):** TLA+ is a new language for this project. The liveness property `EventualConsensus` requires a `WF_vars(Next)` fairness assumption in the `.cfg` file — whether standard weak fairness is sufficient or stronger `SF_vars` is needed for the deliberation loop has not been determined. TLC profiler output for N=5 with symmetry sets on the QGSD model is not yet benchmarked. Recommend `/qgsd:research-phase` before writing the TLA+ spec.
- **Phase v0.12-03 (PRISM model):** The mapping from scoreboard `tp`/`tn`/`unavail` categories to DTMC transition probability parameters is designed from first principles — no direct prior art was found for this specific application. The exact syntax for PRISM 4.10's `-const` flag for injecting a constants file (vs inline `-const key=val`) should be verified. Recommend `/qgsd:research-phase` before writing the PRISM model.

Phases with standard patterns (skip research-phase):

- **Phase v0.12-01 (Conformance event logger):** Established pattern. `fs.appendFile` in a try/catch, NDJSON line format, shared constants module — all standard Node.js. No new API surface. Architecture.md provides exact insertion points in each hook file.
- **Phase v0.12-02 (XState + validate-traces):** XState v5 `createActor` + `actor.send()` replay is well-documented with official examples. Ajv 8.x JSON Schema validation is standard. tsup CJS compilation is zero-config. No research needed.
- **Phase v0.12-03 (Alloy model):** Alloy predicate and assertion syntax is confirmed HIGH confidence via haslab formal-software-design docs. The `run` vs `check` command semantics, `pred`-vs-`fact` distinction, and bounded model checking are all well-documented.
- **Phase v0.12-03 (Petri Net):** DOT format generation is trivial. `@hpcc-js/wasm-graphviz` async API is confirmed and CI-verified. No research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tool versions verified against official sources (GitHub releases, npm registry, official download pages); JVM requirements cross-checked; XState and Ajv CJS compatibility confirmed via multiple sources; WASM Graphviz CI matrix confirmed |
| Features | HIGH (P1) / MEDIUM (P2) | XState v5 guard patterns HIGH confidence (official docs); TLA+ invariant categories HIGH confidence (academic consensus); PRISM DTMC syntax MEDIUM (official docs verified, no direct QGSD analog); Alloy predicate patterns MEDIUM (vote-counting logic designed from first principles, no direct prior art found) |
| Architecture | HIGH | All 7 integration points derived from direct inspection of live source files; anti-patterns grounded in confirmed hook pipeline behavior; data flow diagram validated against actual hook execution sequence |
| Pitfalls | HIGH | 7 of 10 pitfalls grounded in official documentation or direct source inspection at specific line numbers; MongoDB conformance checking post-mortem is primary source for spec-to-implementation granularity pitfall; XState silent guard drop confirmed via official docs behavior description |

**Overall confidence:** HIGH for Phases 1-2; MEDIUM for Phase 3 TLA+ and PRISM sub-phases.

### Gaps to Address

- **TLA+ fairness assumption:** The liveness property `EventualConsensus` requires a fairness assumption. Whether `WF_vars(Next)` (weak fairness) is sufficient for the deliberation loop depends on whether the `DELIBERATING → COLLECTING_VOTES` transition can be infinitely deferred. This needs validation during TLA+ spec authoring — address in `/qgsd:research-phase` for the TLA+ sub-phase.

- **PRISM `-const` flag syntax:** PRISM 4.10 supports a `-const` flag for constant override. The exact syntax for injecting a separate `rates.const` file (vs encoding constants inline in the `.pm` file) should be verified against PRISM 4.10 release notes before the Phase 3 PRISM plan is written.

- **Scoreboard data sparsity at execution time:** If the scoreboard has fewer than 30 rounds per slot when Phase 3 executes, the PRISM model must use conservative priors throughout. The Phase 3 PRISM plan should document this as a conditional: proceed with `illustrative` status (not `verified`) and a prominent header comment if scoreboard is sparse.

- **Petri Net format choice (PNML vs DOT):** ARCHITECTURE.md recommends PNML (ISO standard XML) as the primary format, while STACK.md recommends hand-written DOT with `@hpcc-js/wasm-graphviz` as the primary format. These are compatible (DOT is the rendering format; PNML is a data interchange format) but the implementation plan must pick one as primary and document the other as optional. Recommend DOT as primary (simpler, no additional library, directly renderable by `@hpcc-js/wasm-graphviz`).

---

## Sources

### Primary (HIGH confidence)

- `hooks/qgsd-stop.js`, `hooks/qgsd-prompt.js`, `hooks/qgsd-circuit-breaker.js`, `hooks/config-loader.js` — direct source inspection; hook pipeline mechanics, CJS constraint, fail-open philosophy, stdout decision channel confirmed
- `bin/update-scoreboard.cjs` — `VALID_VERDICTS` (includes `GAPS_FOUND`), scoreboard schema, per-slot composite key format confirmed
- `agents/qgsd-quorum-orchestrator.md` — 4-phase quorum workflow, verdict types (APPROVE/BLOCK/CONSENSUS/ESCALATE), Mode A/B, sequential slot calls confirmed
- GitHub `tlaplus/tlaplus` releases — `tla2tools.jar` v1.8.0 "The Clarke release" (2025-02-24); Java 11 minimum
- GitHub `statelyai/xstate` releases — XState 5.28.0 (2026-02-12); TypeScript 5.0+ required; dual CJS/ESM package
- npm registry `ajv` — v8.18.0 confirmed; ~15,000 dependents; CJS-compatible
- npm registry `@hpcc-js/wasm` — v2.32.3 (February 2026); CI-verified on Node 20/22/24
- GitHub `AlloyTools/org.alloytools.alloy` releases — Alloy 6.2.0 (2025-01-09); Java 17 minimum; `exec -t json` CLI confirmed via Alloy discourse
- `prismmodelchecker.org/download.php` — PRISM 4.10 (2026-01-29); Java 9+; binary for macOS ARM64/x86
- [MongoDB Conformance Checking Post-mortem](https://www.mongodb.com/blog/post/engineering/conformance-checking-at-mongodb-testing-our-code-matches-our-tla-specs) — spec-to-implementation granularity mismatch; state snapshot fragility; multiple focused specs recommendation
- [learntla.com optimization guide](https://learntla.com/topics/optimization.html) — symmetry set reduction (N! factor); separate safety/liveness models; constant minimization
- [TLA+ model values and symmetry docs](https://tla.msr-inria.inria.fr/tlatoolbox/doc/model-values.html) — liveness incompatibility with symmetry sets explicitly documented

### Secondary (MEDIUM confidence)

- [Stately.ai XState v5 docs — Guards](https://stately.ai/docs/guards) — `setup()` API, parameterized guards, multiple guarded transitions evaluated in order, silent drop on no-match behavior confirmed
- [PRISM manual — Property Specification](https://www.prismmodelchecker.org/manual/PropertySpecification/SyntaxAndSemantics) — `P>=0.95 [F<=3 "consensus"]` syntax confirmed; `-pf` inline property flag confirmed
- [haslab formal-software-design overview](https://haslab.github.io/formal-software-design/overview/index.html) — `run` vs `check` command semantics; predicate definitions; bounded model checking scope
- [Hillel Wayne — Don't let Alloy facts make your specs a fiction](https://www.hillelwayne.com/post/alloy-facts/) — `fact` overconstrain pitfall; use `pred` for structural constraints
- [Jack Vanlightly — TLA+ Primer](https://jack-vanlightly.com/blog/2023/10/10/a-primer-on-formal-verification-and-tla) — safety vs liveness property distinction; state space explosion mechanics
- [PRISM manual — Installing PRISM / Common Problems](https://www.prismmodelchecker.org/manual/InstallingPRISM/CommonProblemsAndQuestions) — JDK architecture mismatch on macOS; `UnsatisfiedLinkError` from ARM64/x86 mismatch

### Tertiary (LOW confidence)

- WebSearch: Petri net quorum deadlock patterns, PRISM consensus property examples, XState backend workflow examples — supporting directional evidence only; no specific implementation validated
- [Validating Traces Against TLA+ (arXiv 2024)](https://arxiv.org/pdf/2404.16075v2) — confirms active 2024 research area; abstract-only access; confirms trace validation from distributed logs to TLA+ specs is feasible
- [Validating Traces of Distributed Programs Against TLA+ (Springer 2024)](https://link.springer.com/chapter/10.1007/978-3-031-77382-2_8) — partial-log trace checking; conformance completeness limitations; MEDIUM for abstract-derived findings

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
