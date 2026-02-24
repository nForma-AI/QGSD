# Architecture Research

**Domain:** QGSD v0.12 — Formal Verification: conformance event logger, TLA+, XState, Alloy, PRISM, Petri Net
**Researched:** 2026-02-24
**Confidence:** HIGH (all source files read directly; integration points derived from live code; external tool file formats verified via official docs; no novel APIs involved)

---

## Context: This Is a Subsequent Milestone

The existing QGSD architecture (v0.1–v0.11) is stable. The hook pipeline (`UserPromptSubmit → PreToolUse → Stop → PostToolUse`) and orchestrator agent (`agents/qgsd-quorum-orchestrator.md`) are the primary runtime components. The scoreboard (`update-scoreboard.cjs` → `.planning/quorum-scoreboard.json`) is the primary data store that formal verification will consume.

This file answers the seven specific integration questions for v0.12:

1. Where in existing hooks does event emission go?
2. What JSON schema do conformance log events use?
3. How does `bin/validate-traces.cjs` read log files?
4. How does the XState machine relate to the orchestrator agent?
5. Where do TLA+, Alloy, and PRISM spec files live in the repo?
6. How does PRISM read scoreboard data?
7. What is the build order across all seven components?

---

## System Overview — Existing Architecture (v0.11 Stable Baseline)

```
Claude Code host process
    |
    ├─ UserPromptSubmit → hooks/qgsd-prompt.js   (quorum injection + breaker recovery)
    ├─ PreToolUse       → hooks/qgsd-circuit-breaker.js  (oscillation detection)
    ├─ Stop             → hooks/qgsd-stop.js      (quorum gate — reads JSONL transcript)
    └─ PostToolUse      → hooks/gsd-context-monitor.js   (context window warnings)

hooks/config-loader.js   (shared two-layer config; loaded by all 4 hooks above)
hooks/dist/              (installed copies — what Claude Code actually runs)

agents/qgsd-quorum-orchestrator.md   (spawned via Task() inside planning commands)
    |
    └─ bin/call-quorum-slot.cjs      (dispatches to CLI subprocess or HTTP provider)
         |
         ├─ bin/providers.json               (slot → CLI mapping)
         ├─ bin/check-provider-health.cjs    (HTTP probe, pre-flight)
         └─ bin/update-scoreboard.cjs        (writes .planning/quorum-scoreboard.json)

~/.claude/qgsd.json              (global config — quorum_active, agent_config, etc.)
.claude/qgsd.json                (per-project config — shallow-merges over global)
.planning/quorum-scoreboard.json (per-project; gitignored; TP/TN/UNAVAIL data)
```

---

## System Overview — v0.12 Formal Verification Layer

```
Existing hook pipeline (unchanged)
    |
    ├─ hooks/qgsd-prompt.js    ─── + emit PHASE_START event ──────────────────┐
    ├─ hooks/qgsd-stop.js      ─── + emit PHASE_END / QUORUM_VERDICT event ───┤
    ├─ hooks/qgsd-circuit-breaker.js ─ + emit OSCILLATION_DETECTED event ─────┤
    └─ hooks/gsd-context-monitor.js  ─ (no new emission — context % not in
                                        conformance log scope)                 │
                                                                               ▼
                                           .planning/conformance-log.ndjson
                                           (append-only; newline-delimited JSON;
                                            one event per line; gitignored)
                                                    |
                                                    ├── bin/validate-traces.cjs
                                                    │     reads NDJSON, replays
                                                    │     against XState machine,
                                                    │     reports violations
                                                    │
                                                    └── PRISM model
                                                          reads scoreboard JSON
                                                          for TP/TN/UNAVAIL rates


Formal spec layer (static — checked offline by tool invocation, not at runtime)
    |
    ├─ formal/tla/qgsd-workflow.tla       (phase progression + quorum invariants)
    ├─ formal/tla/qgsd-workflow.cfg       (TLC model config — constants, invariants)
    ├─ formal/alloy/quorum-vote.als       (vote-counting predicates)
    ├─ formal/prism/quorum-consensus.pm   (DTMC from scoreboard TP/TN/UNAVAIL rates)
    ├─ formal/prism/quorum-consensus.pctl (PCTL property file — P>=0.95 [F<=3 consensus])
    └─ formal/petri/quorum-net.pnml       (Petri Net XML — token-passing quorum model)


src/ (TypeScript — compiled separately from hooks/bin CJS)
    └─ src/machines/
           └─ qgsd-workflow.machine.ts    (XState v5 createMachine — executable spec)
              qgsd-workflow.machine.test.ts
```

---

## Component Responsibilities

| Component | Responsibility | New or Modified |
|-----------|----------------|-----------------|
| `hooks/qgsd-prompt.js` | Emits `PHASE_START` event after detecting a quorum command | MODIFIED |
| `hooks/qgsd-stop.js` | Emits `PHASE_END` and `QUORUM_VERDICT` events after gate evaluation | MODIFIED |
| `hooks/qgsd-circuit-breaker.js` | Emits `OSCILLATION_DETECTED` event when breaker fires | MODIFIED |
| `.planning/conformance-log.ndjson` | Append-only structured event log; one JSON object per line | NEW FILE |
| `bin/validate-traces.cjs` | CLI: reads `conformance-log.ndjson`, replays events against XState machine, prints violations | NEW |
| `src/machines/qgsd-workflow.machine.ts` | XState v5 `createMachine` — canonical executable state machine for QGSD workflow | NEW |
| `formal/tla/qgsd-workflow.tla` | TLA+ formal spec — phase ordering invariants, quorum invariants | NEW |
| `formal/tla/qgsd-workflow.cfg` | TLC model checker config (CONSTANTS, INVARIANTS, PROPERTY) | NEW |
| `formal/alloy/quorum-vote.als` | Alloy predicate for vote counting — counterexample generation | NEW |
| `formal/prism/quorum-consensus.pm` | PRISM DTMC model — probabilistic quorum convergence | NEW |
| `formal/prism/quorum-consensus.pctl` | PRISM property file — P>=0.95 [F<=3 consensus] | NEW |
| `formal/petri/quorum-net.pnml` | PNML (ISO standard XML) Petri Net — token flow, deadlock check | NEW |

---

## Recommended Project Structure

```
QGSD/
├─ hooks/
│   ├─ qgsd-prompt.js            # MODIFIED: +appendConformanceEvent() call
│   ├─ qgsd-stop.js              # MODIFIED: +appendConformanceEvent() call
│   ├─ qgsd-circuit-breaker.js   # MODIFIED: +appendConformanceEvent() call
│   └─ ... (unchanged)
├─ bin/
│   ├─ validate-traces.cjs       # NEW: conformance checker CLI
│   └─ ... (unchanged)
├─ src/
│   └─ machines/
│       ├─ qgsd-workflow.machine.ts        # NEW: XState v5 machine
│       └─ qgsd-workflow.machine.test.ts   # NEW: unit tests
├─ formal/
│   ├─ tla/
│   │   ├─ qgsd-workflow.tla     # NEW: TLA+ spec
│   │   └─ qgsd-workflow.cfg     # NEW: TLC model config
│   ├─ alloy/
│   │   └─ quorum-vote.als       # NEW: Alloy model
│   ├─ prism/
│   │   ├─ quorum-consensus.pm   # NEW: PRISM DTMC model
│   │   └─ quorum-consensus.pctl # NEW: PRISM property file
│   └─ petri/
│       └─ quorum-net.pnml       # NEW: Petri Net XML (PNML)
└─ .planning/
    ├─ conformance-log.ndjson    # NEW: runtime event log (gitignored)
    └─ quorum-scoreboard.json    # existing; PRISM reads this for rates
```

### Structure Rationale

- **`formal/`**: Convention used by real-world projects with multiple formal verification tools (TLA+, Alloy, PRISM). Tool-specific subdirectories prevent file extension collisions (`.tla` vs `.als` vs `.pm` all look similar) and allow per-tool `.gitattributes` if needed. This follows the pattern of the `tlaplus/Examples` repository where each spec lives in its own named subdirectory.
- **`src/machines/`**: XState machine is TypeScript, compiled separately. It does NOT go in `hooks/` (which is pure CJS, no build step). Isolating it in `src/` keeps the build boundary clean. The machine is the only TypeScript artifact in the project — keeping it in a minimal `src/` tree avoids polluting the root.
- **`.planning/conformance-log.ndjson`**: Lives in `.planning/` alongside `quorum-scoreboard.json`. Per-project (not global), gitignored. NDJSON (newline-delimited JSON) is the correct format for append-only event streams — each line is a complete, valid JSON object that can be read and parsed line by line.
- **`bin/validate-traces.cjs`**: CJS (not ESM), zero new dependencies, consistent with all other `bin/*.cjs` files. Reads NDJSON and drives the XState machine to validate conformance.

---

## Integration Point 1: Hook Event Emission

### Where Emission Goes in Each Hook

Each hook already writes JSON to stdout (decision channel). Event emission is a **side-effect to a file** — it must never touch stdout, which is reserved for hook decisions. The pattern is:

```
hook decision → process.stdout   (unchanged — hook output channel)
event log     → fs.appendFileSync(.planning/conformance-log.ndjson)  (side-effect)
```

The `appendConformanceEvent()` helper is a shared utility — either inline in `config-loader.js` (preferred, because all three hooks already require it) or as a new `hooks/conformance-logger.js` that all three hooks require. The inline-in-config-loader approach avoids adding a new require chain to installed hooks.

**qgsd-prompt.js** — emit after detecting a quorum command (line ~100, after `cmdPattern.test()`):

```javascript
// Emit PHASE_START when a quorum planning command is detected
appendConformanceEvent(cwd, {
  event: 'PHASE_START',
  command: matchedCommand,   // e.g. "plan-phase", "new-project"
  slots_available: activeSlots.length,
  ts: Date.now(),
});
```

**qgsd-stop.js** — emit after the gate decision is made (line ~280, just before `process.exit()`):

```javascript
// Emit QUORUM_VERDICT on every gate evaluation
appendConformanceEvent(gitRoot, {
  event: 'QUORUM_VERDICT',
  command: matchedCommand,
  outcome: decision,          // "block" | "allow"
  vote_result: quorumResult,  // "passed" | "failed" | "skipped"
  slots_called: slotsCalledCount,
  ts: Date.now(),
});
```

**qgsd-circuit-breaker.js** — emit when oscillation is detected (line ~150, inside the oscillation detection branch):

```javascript
appendConformanceEvent(gitRoot, {
  event: 'OSCILLATION_DETECTED',
  file_set_hash: fileSetHash,
  run_groups: runGroupCount,
  ts: Date.now(),
});
```

### Helper Function — appendConformanceEvent

Placed in `config-loader.js` (already required by all three hooks) to minimize install friction:

```javascript
// Appends one JSON event line to .planning/conformance-log.ndjson.
// Fails silently — never throws. Log path is <projectRoot>/.planning/conformance-log.ndjson.
// projectRoot is derived via git rev-parse inside each hook (same as circuit-breaker pattern).
function appendConformanceEvent(projectRoot, event) {
  try {
    const logPath = path.join(projectRoot, '.planning', 'conformance-log.ndjson');
    fs.appendFileSync(logPath, JSON.stringify(event) + '\n');
  } catch (_) { /* fail silently — never block hook pipeline */ }
}
```

The function must fail silently (same principle as all hook error handling — fail-open, never block the pipeline).

---

## Integration Point 2: Conformance Log JSON Schema

Each log line is a single JSON object. Required fields on all events:

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `event` | string | always | `PHASE_START` / `QUORUM_VERDICT` / `OSCILLATION_DETECTED` |
| `ts` | number | always | `Date.now()` — milliseconds since epoch |

Event-specific fields:

**PHASE_START:**

| Field | Type | Values |
|-------|------|--------|
| `command` | string | `plan-phase`, `new-project`, `new-milestone`, `discuss-phase`, `verify-work`, `research-phase`, `quick` |
| `slots_available` | number | count of active slots at time of injection |

**QUORUM_VERDICT:**

| Field | Type | Values |
|-------|------|--------|
| `command` | string | same as PHASE_START |
| `outcome` | string | `allow` or `block` |
| `vote_result` | string | `passed`, `failed`, `skipped` (skipped = no quorum command detected, gate was not in scope) |
| `slots_called` | number | how many slots were counted as successfully called |

**OSCILLATION_DETECTED:**

| Field | Type | Values |
|-------|------|--------|
| `file_set_hash` | string | SHA256 of the oscillating file set |
| `run_groups` | number | number of alternating run groups detected |

Example log line:
```json
{"event":"QUORUM_VERDICT","command":"plan-phase","outcome":"allow","vote_result":"passed","slots_called":4,"ts":1740398400000}
```

**Do NOT include:** model responses, plan content, user message text. The log is a behavioral trace, not a content log.

---

## Integration Point 3: bin/validate-traces.cjs — Reading the Log

`validate-traces.cjs` is a pure Node.js CJS CLI with zero new dependencies. It:

1. Reads `.planning/conformance-log.ndjson` line by line using `fs.readFileSync` + `split('\n')` (file is small — no stream needed)
2. Parses each line as JSON, skips blank lines and parse errors
3. Creates an XState actor from the TypeScript machine (compiled to `src/machines/qgsd-workflow.machine.js` via `tsc`)
4. Replays each event into the actor via `actor.send({ type: event.event, ...event })`
5. After each send, checks `actor.getSnapshot().status` and the current state against the invariant set
6. Reports violations to stdout in a human-readable format

```javascript
// bin/validate-traces.cjs — simplified structure
'use strict';
const fs = require('fs');
const path = require('path');
const { createActor } = require('xstate');
const { qgsdWorkflowMachine } = require('../src/machines/qgsd-workflow.machine.js'); // compiled

const logPath = path.join(process.cwd(), '.planning', 'conformance-log.ndjson');
const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const actor = createActor(qgsdWorkflowMachine);
actor.start();

let violations = 0;
for (const ev of events) {
  actor.send({ type: ev.event, payload: ev });
  const snap = actor.getSnapshot();
  if (snap.status === 'error') {
    console.error(`VIOLATION: machine errored on event ${ev.event} at ts=${ev.ts}`);
    violations++;
  }
}

console.log(violations === 0 ? 'CONFORMANCE OK' : `CONFORMANCE FAILED: ${violations} violation(s)`);
process.exit(violations > 0 ? 1 : 0);
```

The XState machine must be compiled before `validate-traces.cjs` can be used. A `package.json` `build` script (`"build": "tsc -p tsconfig.formal.json"`) handles this. The compiled output goes to `src/machines/qgsd-workflow.machine.js` (CJS output, because `validate-traces.cjs` is CJS and cannot require ESM).

---

## Integration Point 4: XState Machine and the Orchestrator Agent

The XState machine in `src/machines/qgsd-workflow.machine.ts` is the **executable specification** of the QGSD workflow. It is NOT embedded in or invoked by the orchestrator agent at runtime.

The relationship is:

```
agents/qgsd-quorum-orchestrator.md  ─ (runtime behavior; calls call-quorum-slot.cjs)
                                      |
                                      | these two must agree
                                      ↓
src/machines/qgsd-workflow.machine.ts ─ (formal model; verified via validate-traces.cjs)
                                      |
                                      | trace replay validates runtime behavior
                                      ↓
.planning/conformance-log.ndjson     ─ (runtime trace; emitted by hooks)
```

The machine defines four states matching QGSD's 4-phase planning protocol:

```typescript
// src/machines/qgsd-workflow.machine.ts (conceptual structure)
import { createMachine, assign } from 'xstate';

export const qgsdWorkflowMachine = createMachine({
  id: 'qgsd-workflow',
  initial: 'idle',
  context: {
    command: '',
    slotsAvailable: 0,
    slotsCalled: 0,
    outcome: '',
  },
  states: {
    idle: {
      on: {
        PHASE_START: {
          target: 'awaiting_quorum',
          actions: assign({ command: ({ event }) => event.command }),
        },
      },
    },
    awaiting_quorum: {
      on: {
        QUORUM_VERDICT: [
          {
            guard: ({ event }) => event.outcome === 'allow',
            target: 'phase_complete',
            actions: assign({ outcome: 'allow' }),
          },
          {
            guard: ({ event }) => event.outcome === 'block',
            target: 'quorum_blocked',
            actions: assign({ outcome: 'block' }),
          },
        ],
        OSCILLATION_DETECTED: {
          target: 'oscillation',
        },
      },
    },
    phase_complete: {
      on: {
        PHASE_START: { target: 'awaiting_quorum' },  // next phase
      },
    },
    quorum_blocked: {
      on: {
        PHASE_START: { target: 'awaiting_quorum' },  // retry
      },
    },
    oscillation: {
      on: {
        PHASE_START: { target: 'awaiting_quorum' },  // after breaker reset
      },
    },
  },
});
```

Key guards encode QGSD invariants: a `QUORUM_VERDICT` event must always follow `PHASE_START` (no `PHASE_START → PHASE_START` without a verdict in between), and `slots_called` must be >= `quorum.minSize` for an `allow` verdict.

---

## Integration Point 5: TLA+, Alloy, PRISM Spec File Locations

### TLA+ — `formal/tla/`

Two files per spec: the `.tla` module file and the `.cfg` TLC model configuration.

```
formal/tla/qgsd-workflow.tla    # module QGSD_WORKFLOW; VARIABLES phase, quorum_state; INVARIANTS
formal/tla/qgsd-workflow.cfg    # CONSTANTS, INVARIANT MinQuorumMet, ...; PROPERTY NoInfiniteDeliberation
```

The `.tla` file encodes:
- **Phase ordering**: `phase` variable is monotonically non-decreasing (phases cannot go backward)
- **Quorum invariant**: Before any `phase_complete` transition, `quorum_count >= min_quorum_size` must hold
- **No infinite deliberation**: The system cannot loop indefinitely in `awaiting_quorum`

TLC is invoked via CLI (`java -jar tla2tools.jar`). A `Makefile` in `formal/tla/` provides:
```makefile
check:
	java -jar $(TLA_TOOLS) -config qgsd-workflow.cfg qgsd-workflow.tla
```

### Alloy — `formal/alloy/`

Single `.als` file per model:

```
formal/alloy/quorum-vote.als    # sig Agent, Vote; pred quorumValid; check quorumValid for 10
```

The Alloy model encodes:
- `sig Agent {}` — abstract agent
- `sig Vote { agent: Agent, result: one Result }` where `Result = TP + TN + UNAVAIL`
- `pred quorumValid` — given N agents with M UNAVAIL, the remaining available count meets `minSize`
- `assert noSpuriousBlock` — counterexample generation for impossible quorum combinations

The Alloy Analyzer is invoked as a Java JAR (`org.alloytools.alloy.dist.jar`). No build step — the `.als` file is the source and the artifact.

### PRISM — `formal/prism/`

Two files: the model file (`.pm`) and the property file (`.pctl`):

```
formal/prism/quorum-consensus.pm    # dtmc; module QuorumRound; rates from scoreboard
formal/prism/quorum-consensus.pctl  # P>=0.95 [F<=3 consensus=true]
```

The PRISM model type is `dtmc` (discrete-time Markov chain) — appropriate because quorum rounds are discrete and transition probabilities come from historical TP/TN/UNAVAIL rates in the scoreboard.

---

## Integration Point 6: How PRISM Reads Scoreboard Data

PRISM's `.pm` file uses constants for transition probabilities. The workflow is:

1. `bin/validate-traces.cjs` (or a separate `bin/export-prism-constants.cjs`) reads `.planning/quorum-scoreboard.json`
2. Computes per-slot TP rate: `tp_rate = slot.tp / (slot.tp + slot.fp + slot.fn || 1)`
3. Computes UNAVAIL rate: `unavail_rate = slot.unavail / total_rounds`
4. Writes a PRISM constants file `formal/prism/rates.const` with lines like `const double p_tp=0.92; const double p_unavail=0.06;`
5. The main `.pm` model file uses `override` or direct constants: `[] state=0 -> p_tp:(state'=1) + (1-p_tp):(state'=0);`

Alternative: encode constants directly in the `.pm` file and regenerate it from a template. The constant-file approach is simpler and keeps the model readable.

```
Scoreboard JSON (TP/TN/UNAVAIL per slot)
    |
    └── bin/export-prism-constants.cjs  [new utility]
              |
              └── formal/prism/rates.const   [generated; gitignored]
                          |
                          ├── formal/prism/quorum-consensus.pm  [reads via const file]
                          └── PRISM CLI: prism quorum-consensus.pm quorum-consensus.pctl -const rates.const
```

The `rates.const` file is gitignored (it's generated from the per-project scoreboard). The `.pm` and `.pctl` files are committed.

---

## Integration Point 7: Petri Net — `formal/petri/quorum-net.pnml`

PNML (Petri Net Markup Language) is an ISO standard XML format. It is not a script language — it is a data file that tools like LoLA, PIPE2, or any PNML-compliant viewer can open.

The Petri Net models quorum vote token flow:

- **Places**: `p_idle`, `p_waiting_quorum`, `p_vote_slot_N` (one per active slot), `p_consensus_reached`, `p_quorum_blocked`
- **Transitions**: `t_phase_start`, `t_slot_responds_TP`, `t_slot_UNAVAIL`, `t_quorum_threshold_met`, `t_quorum_failed`
- **Invariants**: deadlock detection for `min_quorum_size` — if all available-slot places are empty and `p_consensus_reached` is unreachable, the system is deadlocked

The PNML file is static (not dynamically generated). It uses a fixed `min_quorum_size=4` and `slot_count=10`. The visualization (Petri Net diagram rendering) is done offline by any PNML viewer. No JavaScript library is needed in the QGSD codebase for this — the `.pnml` file is the deliverable.

If interactive visualization is needed: the `petri-net` npm package (`npm install petri-net`) supports simulation but NOT PNML import. JointJS provides PNML-compatible Petri Net diagrams but is browser-only. For QGSD (a CLI tool), the PNML file + offline viewer is the correct approach. Generating an SVG representation via a Makefile target with Graphviz (using a DOT conversion script) is an acceptable alternative for CI-friendly output.

---

## Data Flow — Full v0.12 Pipeline

```
1. User runs /qgsd:plan-phase
       |
       ├─ qgsd-prompt.js fires
       │     ├─ Injects quorum instructions → stdout (unchanged)
       │     └─ appendConformanceEvent(PHASE_START) → .planning/conformance-log.ndjson
       |
2. Claude runs orchestrator → models vote → scoreboard updated
       |
3. Claude delivers plan output → qgsd-stop.js fires
       ├─ Evaluates quorum gate → decision: allow/block → stdout (unchanged)
       └─ appendConformanceEvent(QUORUM_VERDICT) → .planning/conformance-log.ndjson
       |
4. Later: user runs bin/validate-traces.cjs
       ├─ Reads conformance-log.ndjson
       ├─ Replays events into XState machine (compiled from qgsd-workflow.machine.ts)
       └─ Reports CONFORMANCE OK or CONFORMANCE FAILED
       |
5. PRISM analysis (offline, user-initiated)
       ├─ bin/export-prism-constants.cjs reads quorum-scoreboard.json
       ├─ Writes formal/prism/rates.const
       └─ prism formal/prism/quorum-consensus.pm formal/prism/quorum-consensus.pctl
              → "Result: 0.97 (property satisfied)"
       |
6. TLA+ checking (offline, developer-initiated or CI)
       └─ java -jar tla2tools.jar -config formal/tla/qgsd-workflow.cfg formal/tla/qgsd-workflow.tla
              → "Model checking completed. No errors found."
       |
7. Alloy (offline, developer-initiated)
       └─ java -jar alloy.jar formal/alloy/quorum-vote.als
              → counterexample instances or "No counterexample found"
```

---

## Architectural Patterns

### Pattern 1: Fail-Silent Side-Effect Emission

**What:** Hook event emission is a try/catch side-effect with no error propagation. The hook decision and quorum pipeline never depend on whether the event was logged.

**When to use:** All three hook emission points.

**Why:** The existing hook philosophy is fail-open. Adding a logging side-effect that can throw would violate R6. The `appendFileSync` in a try/catch with empty catch body is the correct pattern.

**Trade-off:** If the log file cannot be written (e.g., disk full), events are silently lost. This is acceptable because the conformance log is diagnostic, not load-bearing.

### Pattern 2: Compiled TypeScript in a CJS Project

**What:** `src/machines/qgsd-workflow.machine.ts` is TypeScript, but must be compiled to CJS for `validate-traces.cjs` to require it. Use `"module": "commonjs"` in `tsconfig.formal.json`.

**When to use:** Only for the XState machine. No other file in QGSD is TypeScript.

**Example tsconfig.formal.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "src/machines",
    "rootDir": "src/machines",
    "strict": true
  },
  "include": ["src/machines/**/*.ts"]
}
```

**Trade-off:** The compiled `.js` file must be committed alongside the `.ts` source (or the build step must run before `validate-traces.cjs` is usable). Committing the compiled output is simpler for a CLI tool — no build step required at user install time.

### Pattern 3: NDJSON for Append-Only Event Log

**What:** One JSON object per line; `fs.appendFileSync` adds lines; `readFileSync` + `split('\n')` reads them all.

**When to use:** The conformance log. Not appropriate for the scoreboard (which is a full JSON object, not a stream).

**Why over a full JSON array:** Appending to a JSON array requires reading, parsing, mutating, and rewriting the whole file atomically. With NDJSON, `appendFileSync` is atomic per-line (single syscall on most OSes). The scoreboard uses full JSON + atomic tmp-rename because it needs cumulative computed stats. The conformance log needs neither — it only needs append.

### Pattern 4: Generated Constants Isolate Spec from Data

**What:** PRISM constants that come from runtime data (scoreboard TP rates) are NOT hardcoded into the `.pm` model file. Instead, a generator script produces a `rates.const` file that is passed to PRISM at check time.

**When to use:** The PRISM model. Also applicable to TLA+ if constants need to match real slot counts.

**Why:** It keeps the formal specification stable and version-controlled while allowing the data inputs to vary per project. The `.pm` file becomes a reusable template.

---

## Anti-Patterns

### Anti-Pattern 1: Emitting Events to stdout in Hooks

**What people do:** `console.log(JSON.stringify(event))` inside a hook, intending to capture it.

**Why it's wrong:** Hook stdout is the decision channel. Claude Code reads `process.stdout` for the hook response JSON. Any extra bytes on stdout will corrupt the hook response and cause parse errors, blocking the hook pipeline entirely.

**Do this instead:** `fs.appendFileSync(logPath, JSON.stringify(event) + '\n')` with an outer try/catch.

### Anti-Pattern 2: Importing XState from Hooks

**What people do:** `const { createActor } = require('xstate')` inside a hook file to validate transitions at hook time.

**Why it's wrong:** Hooks are installed into `hooks/dist/` and run from `~/.claude/hooks/`. They run in the user's global Node environment. If xstate is not globally installed, the require fails and breaks the hook. The existing hooks have zero external npm dependencies for exactly this reason.

**Do this instead:** Keep the XState machine in `src/` and `bin/validate-traces.cjs` only. These are developer tools, not runtime hook dependencies.

### Anti-Pattern 3: Per-Turn PRISM Analysis at Hook Time

**What people do:** Regenerate and run PRISM inside `qgsd-stop.js` to "verify probabilistic properties before allowing the plan."

**Why it's wrong:** PRISM is a Java process with 2–10 second startup time. Running it synchronously in a Stop hook blocks Claude Code's response pipeline and defeats the fail-open principle.

**Do this instead:** PRISM analysis is user-initiated or CI-triggered, not hook-triggered. The hook only emits a log event. `validate-traces.cjs` and PRISM are offline tools.

### Anti-Pattern 4: Using the Conformance Log as a State Store

**What people do:** Read `conformance-log.ndjson` in `qgsd-stop.js` to look up whether a prior PHASE_START was emitted.

**Why it's wrong:** The Stop hook already has all the information it needs from the JSONL transcript. Reading the conformance log inside the hook adds a file dependency that can fail, introduces ordering issues, and creates feedback loops between the log writer and reader.

**Do this instead:** The conformance log is write-only for hooks, read-only for `validate-traces.cjs`. No hook reads the log.

---

## Build Order and Dependencies

The seven components have hard dependencies. Build this order:

```
Phase 1 — Conformance Event Logger (foundation for all tracing)
  1a. Add appendConformanceEvent() to hooks/config-loader.js
  1b. Add emission call to hooks/qgsd-prompt.js (PHASE_START)
  1c. Add emission call to hooks/qgsd-stop.js (QUORUM_VERDICT)
  1d. Add emission call to hooks/qgsd-circuit-breaker.js (OSCILLATION_DETECTED)
  1e. Sync all three hooks to hooks/dist/ + run install
  1f. Add conformance-log.ndjson to .gitignore

  Why first: All downstream components consume the log or the schema. Nothing
  can be tested until events are being emitted.

Phase 2 — XState Machine (executable spec)
  2a. Create src/machines/qgsd-workflow.machine.ts
  2b. Create tsconfig.formal.json
  2c. Create src/machines/qgsd-workflow.machine.test.ts (unit tests for guard logic)
  2d. Add "build" and "test:formal" npm scripts to package.json
  2e. Compile: tsc -p tsconfig.formal.json

  Why second: validate-traces.cjs (Phase 3) requires the compiled machine.
  TLA+ (Phase 4) can be developed in parallel once the machine states are defined.

Phase 3 — bin/validate-traces.cjs (conformance checker CLI)
  3a. Create bin/validate-traces.cjs
  3b. Wire to compiled machine from Phase 2
  3c. Add integration test: emit synthetic NDJSON, run validator, assert exit code

  Why third: Depends on Phase 1 (log schema) and Phase 2 (compiled machine).
  Validates that the logger + machine agree before writing static specs.

Phase 4 — TLA+ Specification (static invariant model)
  4a. Create formal/tla/qgsd-workflow.tla
  4b. Create formal/tla/qgsd-workflow.cfg
  4c. Verify with: java -jar tla2tools.jar -config ... (local or CI)
  4d. Add Makefile target in formal/tla/

  Why here: The TLA+ spec is derived from the same state model as the XState
  machine (Phase 2). Define it after the machine is complete so the state names
  and invariants are stable. TLA+ does not depend on the runtime log.

Phase 5 — Alloy Model (vote-counting predicates)
  5a. Create formal/alloy/quorum-vote.als
  5b. Verify with Alloy Analyzer (GUI or CLI)

  Why here: Alloy only models the vote-counting logic, which is independent of
  the phase progression model. Can be developed in parallel with Phase 4.
  Placed here because it is the simplest formal artifact — good to have Phase 2-4
  done and reviewed before adding another formal layer.

Phase 6 — PRISM Model (probabilistic analysis)
  6a. Create formal/prism/quorum-consensus.pm
  6b. Create formal/prism/quorum-consensus.pctl
  6c. Create bin/export-prism-constants.cjs (reads scoreboard → formal/prism/rates.const)
  6d. Add rates.const to .gitignore
  6e. Verify: prism quorum-consensus.pm quorum-consensus.pctl

  Why here: Depends on having real scoreboard data (Phase 1 must have emitted events
  for at least one quorum round so the scoreboard has real TP/TN/UNAVAIL values).
  Also depends on stable state definitions from Phase 2-4 (PRISM state names
  should align with TLA+ and XState state names for consistency).

Phase 7 — Petri Net Visualization
  7a. Create formal/petri/quorum-net.pnml
  7b. (Optional) Add Makefile target to convert PNML → DOT → SVG via Graphviz

  Why last: Petri Net is a visualization and deadlock-checking artifact derived
  from the fully stable Phase 2-6 model. It adds no new runtime capability.
  It is the capstone documentation artifact.
```

**Dependency summary:**

```
Phase 1 (logger) ─→ Phase 3 (validator)
Phase 2 (XState) ─→ Phase 3 (validator)
Phase 1 + 2      ─→ Phase 4 (TLA+) [informs invariant naming]
Phase 2          ─→ Phase 5 (Alloy) [vote-count model same quorum.minSize]
Phase 1 + 4      ─→ Phase 6 (PRISM) [real scoreboard data needed; state names stable]
Phase 2–6        ─→ Phase 7 (Petri Net) [capstone; no new dependencies]
```

Phases 4 and 5 can run in parallel (no dependency between them). Phase 6 requires Phase 1 to have generated real scoreboard data — it cannot be tested purely with synthetic data because the constants file must come from actual quorum rounds.

---

## Scaling Considerations

Formal verification tooling does not scale with user count — it scales with spec complexity.

| Concern | At 10 quorum rounds | At 1000 quorum rounds | At 10000 rounds |
|---------|--------------------|-----------------------|-----------------|
| conformance-log.ndjson size | ~5 KB | ~500 KB | ~5 MB |
| validate-traces.cjs runtime | <100 ms | <1 s | 5–10 s |
| XState replay memory | negligible | negligible | negligible |
| TLA+ check time | unchanged (spec size, not log size) | unchanged | unchanged |
| PRISM model convergence | faster (more stable rates) | most accurate | diminishing returns |

The log file does not need rotation for any realistic QGSD usage (a project doing 1000 quorum rounds would have thousands of planning phases — extreme edge case). If rotation is needed later, rename the file and start fresh; `validate-traces.cjs` can take a `--log-file` flag.

---

## Integration Points Summary Table

| Existing File | Change Type | What Changes |
|---------------|-------------|--------------|
| `hooks/config-loader.js` | Modified | Add `appendConformanceEvent()` helper |
| `hooks/qgsd-prompt.js` | Modified | Call `appendConformanceEvent(PHASE_START)` after quorum command detection |
| `hooks/qgsd-stop.js` | Modified | Call `appendConformanceEvent(QUORUM_VERDICT)` after gate decision |
| `hooks/qgsd-circuit-breaker.js` | Modified | Call `appendConformanceEvent(OSCILLATION_DETECTED)` when breaker fires |
| `hooks/dist/` | Sync | All 4 modified hooks re-synced after changes |
| `.gitignore` | Modified | Add `conformance-log.ndjson` and `formal/prism/rates.const` |
| `package.json` | Modified | Add `build` and `test:formal` scripts; add `xstate` to dependencies |
| `bin/install.js` | No change | No new hooks; installer does not need changes |
| `bin/update-scoreboard.cjs` | No change | PRISM reads scoreboard directly; no new writes needed |

| New File | Purpose |
|----------|---------|
| `.planning/conformance-log.ndjson` | Runtime event log (gitignored; per-project) |
| `bin/validate-traces.cjs` | Conformance checker CLI |
| `bin/export-prism-constants.cjs` | Scoreboard → PRISM constants generator |
| `src/machines/qgsd-workflow.machine.ts` | XState v5 machine (TypeScript source) |
| `src/machines/qgsd-workflow.machine.js` | Compiled CJS output (committed or built) |
| `src/machines/qgsd-workflow.machine.test.ts` | Machine unit tests |
| `tsconfig.formal.json` | TypeScript config for machine compilation |
| `formal/tla/qgsd-workflow.tla` | TLA+ specification |
| `formal/tla/qgsd-workflow.cfg` | TLC model config |
| `formal/tla/Makefile` | TLC invocation shortcut |
| `formal/alloy/quorum-vote.als` | Alloy vote-counting model |
| `formal/prism/quorum-consensus.pm` | PRISM DTMC model |
| `formal/prism/quorum-consensus.pctl` | PRISM property file |
| `formal/prism/rates.const` | Generated constants (gitignored) |
| `formal/petri/quorum-net.pnml` | Petri Net XML (PNML) |

---

## Sources

- XState v5 `createMachine`, `createActor`, inspection API — [Stately official docs](https://stately.ai/docs/machines) / [XState v5 release](https://stately.ai/blog/2023-12-01-xstate-v5)
- TLA+ spec file structure — [tlaplus/Examples repository](https://github.com/tlaplus/Examples)
- Alloy 6.2.0 release (2025-01-09) — [alloytools.org](https://alloytools.org/)
- PRISM DTMC model format — [PRISM manual](https://www.prismmodelchecker.org/manual/Appendices/ExplicitModelFiles)
- PNML ISO standard format — research-standard; PIPE2 and LoLA both accept PNML
- NDJSON format — [ndjson.org](http://ndjson.org/)
- Existing QGSD source files read directly: `hooks/qgsd-prompt.js`, `hooks/qgsd-stop.js`, `hooks/qgsd-circuit-breaker.js`, `hooks/config-loader.js`, `bin/update-scoreboard.cjs`, `bin/call-quorum-slot.cjs`, `agents/qgsd-quorum-orchestrator.md`, `.planning/quorum-scoreboard.json`

---

*Architecture research for: QGSD v0.12 Formal Verification*
*Researched: 2026-02-24*
