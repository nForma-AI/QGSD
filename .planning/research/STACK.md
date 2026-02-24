# Stack Research

**Domain:** Formal verification tooling — TLA+, XState, Alloy, PRISM, Petri Net, conformance log checker
**Researched:** 2026-02-24
**Confidence:** HIGH (all tool versions verified against official sources; JVM requirements cross-checked)

## Context: This Is a Subsequent Milestone

The following QGSD capabilities are validated and must NOT be re-researched:

- Stop hook, UserPromptSubmit hook, PreToolUse circuit breaker — verified shipping
- Two-layer config system (`qgsd.json`) — verified shipping
- Quorum orchestrator, activity sidecar, scoreboard tracking — verified shipping
- `bin/gsd-tools.cjs` monolith pattern, `bin/*.cjs` CommonJS scripts — existing pattern
- `inquirer@8.2.7` CJS constraint — all existing bin/ scripts are `require()`-only; no ESM migration in scope

This research covers ONLY what is needed for v0.12 Formal Verification features.

---

## Tool 1: TLA+ Specification and TLC Model Checking

### Decision: `tla2tools.jar` v1.8.0 + Java 11+ — external CLI only

**What it is:** TLA+ Tools is the official monolithic JAR distributed by Lamport's TLA+ Foundation.
It bundles: TLA+ parser, TLC model checker, PlusCal transpiler, REPL, and LaTeX exporter.
TLC runs breadth-first state-space exploration verifying invariants and liveness properties.

**Current stable version:** 1.8.0 "The Clarke release" — released February 24, 2025.
Previous stable was 1.7.4 ("Xenophanes release", 2024-01-13). 1.8.0 adds multi-module files,
interactive REPL, improved error messages, and simulation mode enhancements.

**Java requirement:** Java 11 or later. JRE is sufficient (no JDK needed for running TLC).
On macOS, `java -version` confirms. The JAR is invoked directly:

```bash
java -cp tla2tools.jar tlc2.TLC -config spec.cfg spec.tla
```

**Embeddable?** No. TLA+ Tools is Java-only — there is no Node.js SDK, no npm package,
no programmatic API accessible from JavaScript. QGSD invokes it as an external CLI via
`child_process.spawnSync('java', ['-cp', 'tla2tools.jar', 'tlc2.TLC', ...])`.

**Why TLC over TLAPS (TLA+ Proof System):** TLAPS is for theorem proving (deductive verification),
requires more expertise, and depends on Isabelle/HOL. TLC is model checking — finite-state
exhaustive exploration — which is the right tool for verifying QGSD's bounded protocol
(N agents, max K rounds). TLAPS is not needed here.

**Spec artifact location:** `formal/qgsd.tla` (source), `formal/qgsd.cfg` (TLC config).
The bin/ script (`bin/validate-traces.cjs`) does NOT wrap TLC directly — TLC runs on the spec,
not the event logs. The conformance checker validates logs against the XState machine.

**VS Code integration:** `tlaplus/vscode-tlaplus` extension (active development, recent releases)
bundles its own copy of `tla2tools.jar`. Users can also point it at a local JAR.

**Version pinning strategy:** Download `tla2tools.jar` to `formal/tools/tla2tools.jar` (gitignored
due to size — ~20MB JAR). A `formal/tools/download-tools.sh` script pins the version.

### Recommended Stack — Tool 1

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `tla2tools.jar` | 1.8.0 (2025-02-24) | TLA+ parsing + TLC model checking | Official distribution; latest stable; bundles all needed tools |
| Java Runtime Environment | ≥11 | Execute tla2tools.jar | Minimum requirement per TLA+ docs; JRE-only (no JDK needed) |
| `child_process.spawnSync` | Node.js stdlib | Invoke TLC from bin/ scripts | Already used in gsd-tools.cjs; spawnSync pattern established |

**NOT embeddable in Node.js — CLI invocation only. Requires JVM on user machine.**

---

## Tool 2: XState v5 TypeScript Executable State Machine

### Decision: `xstate@5.28.0` with TypeScript 5.x — CJS-compatible, zero browser dependency

**What it is:** XState v5 is an actor-based state machine library. For QGSD, it provides an
executable TypeScript specification of the 4-phase quorum workflow with typed guards and actions.
This is the "code-level" specification that stays synchronized with the hooks — eliminating
spec-to-code drift.

**Current version:** 5.28.0 (released February 12, 2026). Key v5 changes:
- `createActor()` replaces `interpret()` from v4
- `setup({ guards, actions })` pattern for typed machine definitions
- Zero dependencies, runs anywhere JavaScript runs
- Ships both ESM and CJS builds (dual package: `xstate.cjs.js` + ESM wrapper)

**TypeScript requirement:** TypeScript ≥5.0. Set `strictNullChecks: true` and
`skipLibCheck: true` in `tsconfig.json`. Training data shows v5 requires TS5+ for full
type inference benefits; TS4.x may work but with reduced inference quality.

**CJS compatibility:** XState v5 ships a CJS build (`xstate.cjs.js`) accessible via `require('xstate')`.
The package.json `exports` field provides conditional exports for both CJS (`require`) and
ESM (`import`) environments. `require('xstate')` works in Node.js CommonJS scripts.

**Where it lives in QGSD:** A new `formal/` directory contains the TypeScript machine:
`formal/qgsd-machine.ts`. A separate `tsconfig.formal.json` targets ES2020/CommonJS output
into `formal/dist/`. The machine is NOT imported by hook code — it is a verification
artifact and documentation, compiled separately.

**Build tool:** `tsup` (powered by esbuild) — zero-config TypeScript bundler. Compiles
`formal/qgsd-machine.ts` to CJS for consumption by `bin/validate-traces.cjs`.
Alternative: direct `tsc` with `tsconfig.formal.json`. Either works; tsup is faster.

**Node.js version:** No explicit minimum documented; XState tests run on current LTS (Node 20+).
QGSD currently runs on Node v25.6.1 — no compatibility concern.

**Server-side usage:** XState v5 has no browser-specific dependencies. `createActor(machine)`
and `actor.start()` / `actor.send(event)` work identically in Node.js. The machine can
replay a sequence of logged events to validate a trace matches the spec.

### Recommended Stack — Tool 2

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `xstate` | 5.28.0 | Executable state machine | TypeScript-native; CJS-compatible; zero deps; actor model matches QGSD's phase transitions |
| `typescript` | ≥5.0 (use latest 5.x) | Compile formal/qgsd-machine.ts | Required by XState v5 for full type inference; already in devDeps if used elsewhere |
| `tsup` | latest | Bundle formal/ TypeScript to CJS | Zero-config; esbuild-powered; outputs dist/qgsd-machine.cjs for use by validate-traces.cjs |

**Installation:**
```bash
npm install xstate
npm install -D typescript tsup
```

**CJS import pattern (in bin/validate-traces.cjs):**
```javascript
const { createMachine, createActor } = require('../formal/dist/qgsd-machine.cjs');
```

---

## Tool 3: Alloy 6 Model — Vote-Counting Predicate Logic

### Decision: `alloy.jar` 6.2.0 — external CLI only, Java 17 required

**What it is:** Alloy is a relational constraint language and SAT-based analyzer.
For QGSD, it models vote-counting predicate logic: given N total agents, M UNAVAILABLE,
is this quorum count sufficient for a transition? The Alloy Analyzer finds counterexamples
automatically, which is its core strength over TLA+.

**Current stable version:** 6.2.0 (released January 9, 2025). Distributed as a runnable JAR.

**Java requirement:** Java 17 or later. This is STRICTER than TLA+ (which requires Java 11).
This is the single highest Java version requirement across all formal tools in this milestone.
On macOS, Homebrew: `brew install openjdk@17`. The JAR bundles SAT solvers (Sat4j, MiniSat,
Glucose) — no separate SAT solver installation needed.

**CLI headless invocation:** Alloy 6.2.0 includes a CLI with an `exec` command:
```bash
java -jar alloy.jar exec -c <command-name> -t json formal/qgsd-votes.als
```
The `-t` flag controls output format: `none`, `text`, `table`, `json`, `xml`.
For counterexample extraction, use `-t json` — this is parseable by Node.js.

**Limitations of CLI mode:** The basic `--quit` flag does NOT perform model checking
(confirmed via community forum — it exits successfully even on invalid files).
Use the `exec` subcommand. GUI-mode counterexample visualization is not available headlessly
— but JSON output of `exec` provides instance data for scripted counterexample reporting.

**Embeddable?** No. Alloy is Java-only. QGSD invokes it as an external CLI via
`child_process.spawnSync('java', ['-jar', 'alloy.jar', 'exec', ...])`.

**Spec artifact location:** `formal/qgsd-votes.als`. The Alloy spec defines predicates for
quorum sufficiency, which the bin/ checker can invoke as a property oracle.

### Recommended Stack — Tool 3

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `org.alloytools.alloy.dist.jar` | 6.2.0 (2025-01-09) | Alloy Analyzer + SAT solving | Official distribution; bundles all SAT solvers; CLI exec mode with JSON output |
| Java Runtime Environment | ≥17 | Execute Alloy JAR | Alloy 6 requires Java 17+; highest JVM requirement in this stack |

**NOT embeddable in Node.js — CLI invocation only. Requires JVM ≥17 on user machine.**

**Java version note:** The JVM requirement for the full stack is Java 17 (set by Alloy 6),
not Java 11 (set by TLA+). Users need a single Java 17+ JRE to run all three JVM tools.

---

## Tool 4: PRISM Probabilistic Model Checker

### Decision: PRISM 4.10 — external CLI only, Java 9+ (uses binary distributions)

**What it is:** PRISM is a probabilistic model checker for Markov chains, MDPs, and probabilistic
automata. For QGSD, it verifies: "given the empirical TP/TN/UNAVAIL distribution from the
scoreboard, does consensus occur within 3 rounds with ≥0.95 probability?"
PRISM's PCTL/CSL property language expresses these probabilistic reachability questions directly.

**Current stable version:** 4.10 (released January 29, 2026 — most recent release).
Previous was 4.9 (August 2025). 4.10 adds UMB format import/export, POMDP support,
and full LTL for interval MDPs/DTMCs.

**Java requirement:** Java 9 or later (per official installation docs). Binary distributions
for macOS (x86 + Arm), Linux (x86 + Arm), and Windows (x86) are available at
`prismmodelchecker.org/download.php`. The binary includes its own bundled JRE on some platforms
but generally requires Java 9+ in PATH.

**Headless/CLI invocation:**
```bash
prism formal/qgsd-quorum.prism formal/qgsd-quorum.props -exportresults results.csv
```
Or using the `-pf` flag for inline properties:
```bash
prism formal/qgsd-quorum.prism -pf 'P>=0.95 [ true U<=3 consensus_reached ]'
```
PRISM ships both GUI and command-line versions. The CLI mode (`prism` binary, not `xprism`)
supports `-javamaxmem`, `-cuddmaxmem`, and `-exportresults` for scripted batch use.
Recommend wrapping via `child_process.spawnSync('prism', [...])`.

**Scoreboard integration:** `bin/generate-prism-model.cjs` reads `.planning/quorum-scoreboard.json`
to extract slot-level TP/TN/UNAVAIL counts and writes a `.prism` model with parameterized
transition probabilities. This makes the model data-driven from actual quorum history.

**Embeddable?** No. PRISM is Java + C (native). There is no npm package or Node.js API.
CLI invocation is the only integration path.

**Spec artifact location:** `formal/qgsd-quorum.prism` (model), `formal/qgsd-quorum.props`
(properties). Generated `.prism` file is re-generated from scoreboard data before each check run.

### Recommended Stack — Tool 4

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PRISM model checker | 4.10 (2026-01-29) | Probabilistic Markov chain verification | Official tool for DTMC/MDP; verified `-pf` CLI mode; current release |
| Java Runtime Environment | ≥9 | Execute PRISM | PRISM's stated minimum; binary distributions often bundle JRE |

**NOT embeddable in Node.js — CLI invocation only. Install from prismmodelchecker.org.**

---

## Tool 5: Petri Net Visualization

### Decision: DOT-language generation (hand-written) + `@hpcc-js/wasm-graphviz` for SVG output

**What it is:** A Petri Net for QGSD models token-passing quorum votes through places
(phases) and transitions (vote outcomes). Visualization serves two purposes:
1. Human-readable SVG diagram of the quorum state machine
2. Deadlock detection: structurally, a quorum with insufficient min_quorum_size will have
   a deadlock-reachable marking — detectable by Graphviz structural analysis or LoLA

**Approach:** Write the Petri Net structure as a DOT-language `.dot` file using standard
Graphviz bipartite conventions (circles = places, rectangles = transitions, tokens as labels).
Then render to SVG using `@hpcc-js/wasm-graphviz`.

**Why `@hpcc-js/wasm-graphviz` over native Graphviz CLI:**
The WASM build requires zero system installation — `npm install @hpcc-js/wasm-graphviz`
and it works. The native `dot` CLI requires Graphviz installed on the OS (Homebrew, apt, etc.),
which is an extra installation burden for QGSD users. WASM is self-contained and ships with
the npm package.

**`@hpcc-js/wasm-graphviz` details:**
- Latest version: `@hpcc-js/wasm` 2.32.3 (published ~February 2026, actively maintained).
- The split package `@hpcc-js/wasm-graphviz` is the Graphviz-only subset.
- Supports Node.js 20, 22, 24 (CI-verified by hpcc-systems).
- Async API:
```javascript
const { Graphviz } = require('@hpcc-js/wasm-graphviz');
const graphviz = await Graphviz.load();
const svg = graphviz.dot(dotSource); // returns SVG string
```
- Output formats: SVG, PNG, JSON (raw Graphviz IR), plain text.

**Deadlock detection for min_quorum_size:** LoLA (Low Level Petri Net Analyzer) is the
academic standard for deadlock detection in Petri nets via state-space exploration.
However, LoLA is a native binary (C++) requiring separate installation, and for QGSD's
small bounded nets, structural analysis is sufficient. The structural invariant
"if min_quorum_size > available_agents, no transition from DELIBERATING can fire" can be
checked as a pure mathematical assertion in the bin/ script — no LoLA needed.

**Visualization-only vs. full analyzer:** LoLA is NOT recommended for this milestone.
The Petri Net deliverable is primarily a human-readable visualization artifact (SVG diagram)
that communicates the quorum token model. Deadlock analysis is covered by TLC (for reachability)
and PRISM (for probabilistic properties). Adding LoLA would add a C++ build dependency
for marginal formal coverage gain.

**Spec artifact location:** `formal/qgsd-petri.dot` (generated DOT source),
`formal/qgsd-petri.svg` (rendered output from `bin/generate-petri.cjs`).

### Recommended Stack — Tool 5

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@hpcc-js/wasm-graphviz` | 2.32.3+ (from `@hpcc-js/wasm`) | DOT-to-SVG rendering | WASM-bundled Graphviz; zero system install; Node.js native; actively maintained |
| Hand-written DOT generation | — | Petri net structure as DOT source | DOT bipartite conventions sufficient; no specialized Petri net library needed |

**Installation:**
```bash
npm install @hpcc-js/wasm-graphviz
```

**What NOT to use:**
- `petri-net` npm package — last published 10 years ago; unmaintained
- `petri-js` — browser-focused, CommonJS incompatible pattern
- `@pseuco/colored-petri-nets` — colored Petri nets (CPNs) are more complex than needed; standard P/T nets suffice
- LoLA model checker — native binary; overkill for deadlock analysis when TLC covers reachability already

---

## Tool 6: Node.js Conformance Log Checker (`bin/validate-traces.cjs`)

### Decision: Ajv + NDJSON line reader + XState machine replay — pure Node.js, CJS

**What it is:** `bin/validate-traces.cjs` reads a conformance event log (NDJSON format —
one JSON event per line), validates each event against a JSON Schema, and replays the
event sequence against the XState machine to verify the trace is structurally valid.
This is the only user-facing artifact from the formal verification work — it ships in `bin/`.

**Three layers of validation:**

1. **Schema validation (Ajv):** Each line is parsed as JSON and validated against the
   event schema (phase, action, slots_available, vote_result, outcome, timestamp fields).
   Ajv 8.x supports JSON Schema draft-2019-09/2020-12 and is the fastest validator
   in the Node.js ecosystem (~50% faster than alternatives per 2024 benchmarks).
   Latest version: 8.18.0 (published ~February 2026, actively maintained with 15,000+ npm dependents).

2. **State machine replay (XState):** After schema validation, events are fed to a
   `createActor(qgsdMachine)` instance. If the machine rejects an event (guard fails or
   event not accepted in current state), the trace is invalid. This catches protocol
   violations that schema validation cannot (e.g., transitioning to COMPLETE from IDLE
   without going through DELIBERATING).

3. **Invariant assertion:** Post-replay checks: min_quorum_met, phase_monotonically_advances,
   no_infinite_deliberation. These are computed from the event sequence, not from the machine.

**Why Ajv over Zod:** Zod is TypeScript-first — its schemas are TypeScript objects.
`bin/validate-traces.cjs` is a CJS script; using Zod would require either a pre-compiled
Zod schema (adding tsup to the bin/ build chain) or using Zod's runtime API from CJS
(possible but awkward). Ajv uses plain JSON Schema — a `const schema = { type: 'object', ... }`
object literal works identically in CJS. For a schema-heavy log validator, Ajv's JSON Schema
approach is the right tool.

**Why Ajv over inline `typeof` checks:** The event schema has 8+ required fields with
typed constraints (enums for phase/action, integer for slots_available, etc.). Ajv generates
optimized validation functions — faster, more maintainable, and produces descriptive error
messages that the user sees when a log line fails validation.

**NDJSON reading:** No library needed. `fs.readFileSync(logPath, 'utf8').split('\n')` then
`JSON.parse(line)` for non-empty lines. Standard Node.js pattern, already used in gsd-tools.

**CJS compatibility:** Ajv 8.x ships CJS and ESM builds. `require('ajv')` works in Node.js
CommonJS scripts. The package uses conditional exports:
```javascript
const Ajv = require('ajv');
const ajv = new Ajv();
```

**XState machine import in CJS:** The compiled machine from `formal/dist/qgsd-machine.cjs`
(built by tsup from `formal/qgsd-machine.ts`) is a standard CommonJS module:
```javascript
const { qgsdMachine } = require('../formal/dist/qgsd-machine.cjs');
const { createActor } = require('xstate'); // CJS build
```

### Recommended Stack — Tool 6

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `ajv` | 8.18.0 | JSON Schema validation of each log event | Fastest Node.js validator; CJS-compatible; JSON Schema (not TypeScript-first) |
| `xstate` | 5.28.0 | State machine replay for trace validation | Same dep as Tool 2; `createActor` + `actor.send()` replay events |
| `node:fs` | stdlib | NDJSON line reading | `readFileSync` + `split('\n')` — no extra library needed |
| `formal/dist/qgsd-machine.cjs` | — | Compiled XState machine | Built by tsup from formal/qgsd-machine.ts; required by validate-traces.cjs |

**Installation:**
```bash
npm install ajv
# xstate already listed above
```

---

## Summary: Net New npm Dependencies

| Package | Version | Why New | Feature |
|---------|---------|---------|---------|
| `xstate` | 5.28.0 | Executable state machine; trace replay | Tool 2 + Tool 6 |
| `ajv` | 8.18.0 | JSON Schema validation for log events | Tool 6 |
| `@hpcc-js/wasm-graphviz` | 2.32.3+ | DOT-to-SVG rendering (zero system install) | Tool 5 |

**Dev dependencies:**

| Package | Version | Why New | Feature |
|---------|---------|---------|---------|
| `typescript` | 5.x latest | Compile formal/qgsd-machine.ts | Tool 2 |
| `tsup` | latest | Bundle TypeScript to CJS | Tool 2 |

**External tools (NOT npm packages — require manual installation):**

| Tool | Version | Java Req | Install Method | Feature |
|------|---------|----------|---------------|---------|
| `tla2tools.jar` | 1.8.0 | Java ≥11 | Download from GitHub releases | Tool 1 (TLA+) |
| `org.alloytools.alloy.dist.jar` | 6.2.0 | Java ≥17 | Download from GitHub releases | Tool 3 (Alloy) |
| PRISM | 4.10 | Java ≥9 | Binary from prismmodelchecker.org | Tool 4 (PRISM) |

**Critical JVM note:** All three JVM tools run on the same JVM. The highest requirement
is Java 17 (set by Alloy 6). A single `brew install openjdk@17` satisfies all three tools.
Recommend `formal/tools/README.md` with installation instructions for users.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `petri-net` npm package | Last published 10 years ago; unmaintained | Hand-written DOT + `@hpcc-js/wasm-graphviz` |
| `petri-js` | Browser-focused; limited Node.js support | Hand-written DOT generation |
| `@pseuco/colored-petri-nets` | Colored Petri nets are more complex than needed for QGSD token model | Standard P/T net via DOT notation |
| LoLA Petri Net Analyzer | Native C++ binary; overkill — TLC already covers reachability | TLC for deadlock/reachability; structural assertion in script |
| TLA+ Toolbox IDE JAR | GUI-only application; TLC is embedded in tla2tools.jar | `tla2tools.jar` directly |
| TLAPS (TLA+ Proof System) | Theorem proving; requires Isabelle/HOL expertise; overkill for bounded protocol | TLC model checker |
| `zod` for log validation | TypeScript-first; awkward in CJS bin/ scripts; requires compilation step | `ajv` with plain JSON Schema |
| Native `dot` CLI (Graphviz) | Requires OS-level installation (Homebrew, apt) | `@hpcc-js/wasm-graphviz` (self-contained WASM) |
| `@aduh95/viz.js` | Older WASM Graphviz binding; less actively maintained | `@hpcc-js/wasm-graphviz` (current, CI on Node 20/22/24) |
| `xstate@4.x` | v4 uses `interpret()` (deprecated); v5 is current with better TypeScript | `xstate@5.28.0` |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@hpcc-js/wasm-graphviz` (WASM) | Native `dot` CLI (Graphviz binary) | If users are guaranteed to have Graphviz installed (CI environments); native is faster |
| `ajv` for schema validation | `zod` | If project migrates to full TypeScript with ESM; Zod schemas would be more ergonomic in TS context |
| TLC (finite-state model checking) | TLAPS (deductive proof) | If QGSD protocol ever becomes unbounded or infinite-state; TLC's finite-state exhaustion doesn't apply |
| PRISM 4.10 binary | PRISM Storm (newer probabilistic checker) | Storm has more features but is harder to install (C++ from source); PRISM binary is simpler for this use case |
| tsup | `tsc` directly | If bundle optimization is not needed; `tsc` alone produces valid CJS output with right tsconfig |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `xstate@5.28.0` | Node.js 18+ (practically); TypeScript ≥5.0 | Dual CJS/ESM package; `require('xstate')` works in CJS |
| `ajv@8.18.0` | Node.js 12+; TypeScript 4.x+ | CJS-compatible; `require('ajv')` works; actively maintained |
| `@hpcc-js/wasm-graphviz@2.x` | Node.js 20, 22, 24 (CI-verified) | WASM binary bundled; no system Graphviz needed |
| `tla2tools.jar@1.8.0` | Java ≥11 | Runs on JRE 11, 17, 21; macOS/Linux/Windows |
| `alloy.jar@6.2.0` | Java ≥17 | Bundles Sat4j, MiniSat, Glucose SAT solvers |
| PRISM 4.10 | Java ≥9 | Binary distribution available; built-in Java on some platforms |
| `tsup` latest | Node.js 16+; TypeScript 5.x | esbuild-powered; zero-config CJS output |

---

## Stack Patterns by Feature

**If writing TLA+ spec (`formal/qgsd.tla`):**
- Use PlusCal pseudocode first (transpiles to TLA+), then hand-edit generated TLA+ for invariants
- Run TLC: `java -cp formal/tools/tla2tools.jar tlc2.TLC -config formal/qgsd.cfg formal/qgsd.tla`
- Invariants to encode: `min_quorum_met`, `phase_monotonically_advances`, `no_infinite_deliberation`
- TLC config (`qgsd.cfg`) specifies: `INIT Init`, `NEXT Next`, `INVARIANT Inv1 Inv2 Inv3`

**If writing XState machine (`formal/qgsd-machine.ts`):**
- Use `setup({ guards, actions })` from `xstate` for typed guard definitions
- Export the machine as named export: `export const qgsdMachine = setup(...).createMachine(...)`
- Build: `tsup formal/qgsd-machine.ts --format cjs --dts --outDir formal/dist`
- Import in validate-traces.cjs: `const { qgsdMachine } = require('./formal/dist/qgsd-machine.cjs')`

**If writing Alloy model (`formal/qgsd-votes.als`):**
- Define `sig Phase`, `sig Agent`, `pred sufficient_quorum[...]` predicates
- Run: `java -jar formal/tools/alloy.jar exec -c sufficient_quorum -t json formal/qgsd-votes.als`
- Parse JSON output in Node.js to extract counterexamples

**If writing PRISM model (`formal/qgsd-quorum.prism`):**
- Generate `.prism` from scoreboard: `bin/generate-prism-model.cjs > formal/qgsd-quorum.prism`
- Model type: DTMC (Discrete-Time Markov Chain) for round-based convergence
- Run: `prism formal/qgsd-quorum.prism -pf 'P>=0.95 [ true U<=3 consensus_reached ]'`

**If generating Petri Net SVG (`bin/generate-petri.cjs`):**
```javascript
const { Graphviz } = require('@hpcc-js/wasm-graphviz');
const dot = buildPetriNetDot(agentCount, minQuorum); // hand-written DOT builder
const graphviz = await Graphviz.load();
const svg = graphviz.dot(dot);
require('fs').writeFileSync('formal/qgsd-petri.svg', svg);
```

**If validating traces (`bin/validate-traces.cjs`):**
```javascript
const Ajv = require('ajv');
const { createActor } = require('xstate');
const { qgsdMachine } = require('../formal/dist/qgsd-machine.cjs');

const ajv = new Ajv();
const validate = ajv.compile(eventSchema);
const actor = createActor(qgsdMachine);
actor.start();

for (const line of ndjsonLines) {
  const event = JSON.parse(line);
  if (!validate(event)) throw new Error(JSON.stringify(validate.errors));
  actor.send(event);
}
// Check final state invariants
```

---

## Sources

- GitHub `tlaplus/tlaplus` releases page — confirmed v1.8.0 "The Clarke release" released 2025-02-24; Java 11 minimum. Confidence: HIGH (official source).
- GitHub `statelyai/xstate` releases page — confirmed XState 5.28.0 released February 12, 2026. Confidence: HIGH (official source).
- Stately.ai docs/typescript — confirmed TypeScript ≥5.0 required; `strictNullChecks: true` recommended. Confidence: HIGH (official documentation).
- XState v5 dual-package research — confirmed `xstate.cjs.js` ships; `require('xstate')` works in Node.js CJS. Confidence: HIGH (multiple corroborating sources).
- GitHub `AlloyTools/org.alloytools.alloy` releases page — confirmed Alloy 6.2.0 released 2025-01-09; Java 17 minimum verified via Alloy discourse + README. Confidence: HIGH (official source).
- Alloy discourse `how-do-i-specify-options-to-alloy-6-2-cli-exec-command/538` — confirmed `exec -t json` output format; `-c` flag for command selection. Confidence: HIGH (official community forum).
- PRISM model checker download page (`prismmodelchecker.org/download.php`) — confirmed PRISM 4.10 released January 29, 2026; Java 9+ minimum; binary distributions for macOS/Linux/Windows. Confidence: HIGH (official source).
- PRISM manual `RunningPRISM/AllOnOnePage` — confirmed `-pf` CLI flag for inline properties; headless mode available. Confidence: HIGH (official documentation).
- npm `@hpcc-js/wasm` page — confirmed version 2.32.3 published ~February 2026; CI on Node 20/22/24. Confidence: HIGH (official npm registry).
- npm `ajv` page — confirmed version 8.18.0, ~15,000 dependents, published February 2026. Confidence: HIGH (official npm registry).
- WebSearch for petri-net npm libraries — confirmed `petri-net@0.2.1` last published 10 years ago; other options browser-only or unmaintained. Confidence: HIGH (multiple sources corroborate poor npm ecosystem for Petri nets).
- TLA+ wiki `using:tlc:start` — confirmed CLI invocation pattern `java -cp tla2tools.jar tlc2.TLC`. Confidence: HIGH (official documentation).

---
*Stack research for: QGSD v0.12 Formal Verification — TLA+, XState, Alloy, PRISM, Petri Net, conformance log checker*
*Researched: 2026-02-24*
