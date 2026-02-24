# Quorum Parallel Architecture Research

**Subject:** Wave-barrier parallelism for the QGSD quorum orchestrator
**Researched:** 2026-02-24
**Confidence:** HIGH — all findings derived from reading live source files; no training-data guessing

---

## Goal

The current orchestrator calls every quorum slot one-at-a-time, sequentially. The target
architecture runs Round 1 slots in parallel as a Task fan-out, waits for all of them to
complete (the barrier), then runs Round 2 (deliberation) slots in parallel as a second
fan-out, with synthesis happening only after that second barrier. This document describes
the current architecture in full, explains why the sequential constraint exists today,
identifies every coupling point that must change, and lays out the data contract between
rounds that any parallel implementation must satisfy.

---

## 1. Current Sequential Flow — Full Anatomy

### 1.1 Entry and Pre-flight (Steps 1–2 of the orchestrator)

The orchestrator agent (`agents/qgsd-quorum-orchestrator.md`) executes as a sub-agent.
Before any model calls it runs:

1. **Provider pre-flight** — `node check-provider-health.cjs --json` to determine which
   providers are reachable. Builds `$PROVIDER_STATUS` and `$CLAUDE_MCP_SERVERS`.
2. **Availability cache check** — `node update-scoreboard.cjs get-availability` to filter
   out dormant slots (quota/rate-limited) that were recorded from previous runs.
3. **quorum_active filtering** — reads `~/.claude/qgsd.json` to intersect the slot list
   with the configured `quorum_active` list.
4. **min_quorum_size check** — aborts early if fewer than N slots are available.
5. **preferSub sort + shuffle** — slots are sorted (sub before api) and shuffled within
   each group to randomize call order.
6. **Team identity capture** — `update-scoreboard.cjs init-team` records the session
   fingerprint. This is idempotent and safe to call once before any parallel work.

None of steps 1–6 involve model inference. They are pure bookkeeping. They are already
sequential and fast, and they produce the final ordered slot list that Round 1 will use.
**These steps do not need to change under the wave-barrier design.**

### 1.2 Round 1 — Sequential Slot Calls

After pre-flight the orchestrator issues one Bash call per slot using this pattern:

```bash
node "$HOME/.claude/qgsd-bin/call-quorum-slot.cjs" \
  --slot <slotName> \
  --timeout <quorum_timeout_ms> \
  --cwd "$REPO_DIR" <<'QUORUM_PROMPT'
QGSD Quorum — Round 1
Repository: <path>
Question: <question>
[artifact block if present]
...
QUORUM_PROMPT
```

Each `call-quorum-slot.cjs` call is **blocking** — the orchestrator issues the Bash tool
call, waits for exit, reads stdout/stderr, then issues the next call. The orchestrator
instruction says explicitly:

> "SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS. Every model call and every Task spawn
> MUST be issued as a separate, standalone message turn — never batched or co-submitted
> as sibling calls."

Between each slot call the orchestrator:
- Inspects the exit code (non-zero = TIMEOUT → mark UNAVAIL, continue).
- Scans the output for rate-limit phrases; if found, calls `update-scoreboard.cjs
  set-availability` to record the ETA.
- Stores the output text as that slot's Round 1 position.

After all slots respond, the orchestrator displays the positions table and checks for
early consensus. If all agree, it skips deliberation.

### 1.3 Round 2 (Deliberation) — Sequential Slot Calls

If Round 1 did not produce consensus, the orchestrator runs up to 3 deliberation rounds.
Each deliberation round is the same sequential Bash call pattern as Round 1, but the
prompt now includes all Round 1 positions:

```
Prior positions:
• Claude:    [position]
• Codex:     [position or UNAVAIL]
• Gemini:    [position or UNAVAIL]
• ...
```

Each slot gets the full prior-round context injected into the prompt. The orchestrator
checks for consensus after each deliberation round and stops as soon as all available
models agree.

### 1.4 Scoreboard Updates — After Consensus or Escalation

Only after consensus (or after 4 rounds with no consensus) does the orchestrator write
to the scoreboard:

```bash
# CLI slots:
node update-scoreboard.cjs \
  --model <family> --result <vote_code> --task <label> \
  --round <n> --verdict <VERDICT> --task-description "<text>"

# HTTP/subprocess slots:
node update-scoreboard.cjs \
  --slot <slotName> --model-id <fullModelId> --result <vote_code> \
  --task <label> --round <n> --verdict <VERDICT>
```

One `update-scoreboard.cjs` call per model per round. These writes are sequential but
each completes in <100ms (disk I/O only). No inference involved. Under the current design
the scoreboard is updated as a batch after all rounds are done.

---

## 2. Why SEQUENTIAL CALLS ONLY Exists

The constraint is documented in the orchestrator agent definition at line 21:

> "SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS."

The technical reason is the Claude Code sub-agent execution model: when the orchestrator
runs as a sub-agent (spawned via `Task(subagent_type=qgsd-quorum-orchestrator)`), each
tool call it makes — whether a `Bash`, `Read`, or `Task` — is a message turn in its
session. The orchestrator's **context window accumulates** results from every prior turn
and uses them to reason about consensus, build deliberation prompts, and decide when to
stop.

If the orchestrator issued two Bash calls in the same message turn (sibling calls), it
would receive both responses simultaneously without the ability to inspect the first
result before deciding whether to call the second. For quorum logic this matters:

- **UNAVAIL propagation**: if codex-1 times out, the orchestrator must mark it UNAVAIL
  and skip it in deliberation. Sibling calls prevent this per-slot decision.
- **Availability recording**: if a slot emits a rate-limit message, the orchestrator
  calls `update-scoreboard.cjs set-availability` immediately after reading that slot's
  output. Sibling calls would receive both slot outputs at once, making it impossible
  to know which message came from which slot's rate-limit output.
- **Early consensus detection**: if the first N slots all agree in Round 1, the
  orchestrator can skip the remaining slots. Sibling calls cannot implement this
  short-circuit.
- **Deliberation prompt construction**: the Round 2 prompt requires all Round 1 positions
  to be collected before the first Round 2 call. Sequential calls guarantee this; sibling
  calls do not naturally enforce the wait.

The constraint is **not** a fundamental limitation of the Claude Code tool system. Claude
Code's Task tool supports true parallel fan-out (multiple Task calls issued in the same
message turn, each running in its own sub-agent). The sequential constraint is a policy
choice that prioritizes per-slot control logic over throughput.

---

## 3. call-quorum-slot.cjs — What It Does and What It Returns

`bin/call-quorum-slot.cjs` is a thin stdin-to-subprocess/HTTP dispatcher:

**Inputs:**
- `--slot <name>` — looked up in `providers.json` to find `type`, `cli`, `args_template`,
  `env`, `quorum_timeout_ms`
- `--timeout <ms>` — overrides `quorum_timeout_ms` from providers.json
- `--cwd <dir>` — working directory for subprocess spawns (git context)
- Prompt text on stdin (heredoc or pipe)

**Execution:**
- `type: "subprocess"` slots: spawns `provider.cli` with `args_template` (replacing
  `{prompt}` with the prompt text), captures stdout/stderr, applies timeout via SIGTERM.
- `type: "http"` slots: POSTs to `${baseUrl}/chat/completions` with the prompt as a
  user message, returns `choices[0].message.content`.

**Outputs (stdout):**
- On success (exit 0): the raw text response from the model. No JSON wrapping. Plain text.
- On failure (exit 1): error message to stderr. The orchestrator treats this as TIMEOUT or
  error, marks the slot UNAVAIL.

**What Round 2 needs from Round 1:**
`call-quorum-slot.cjs` itself is stateless. The data Round 2 needs is not produced by the
script — it is produced by the **orchestrator** reading the script's stdout and storing it
as the slot's position. Round 2 needs:

| Data | Produced by | Where stored |
|------|-------------|--------------|
| Slot's Round 1 text position | Orchestrator reads call-quorum-slot stdout | Orchestrator's in-context memory |
| UNAVAIL status for the slot | Orchestrator inspects exit code and stderr | Orchestrator's working variable list |
| ETA if rate-limited | Orchestrator scans output for hint patterns | `quorum-scoreboard.json` availability map |

This means the Round 2 prompt injection (the `Prior positions:` block) requires the
orchestrator to have **all Round 1 text positions stored in memory** before it can
construct a single Round 2 prompt.

---

## 4. Data the Barrier Must Carry

A wave-barrier design replaces the orchestrator's sequential loop with two fan-outs
separated by a barrier. The barrier is the point where Round 1 sub-agents have all
terminated and the orchestrator collects their outputs before issuing Round 2.

The barrier must carry this data from Round 1 to Round 2:

### 4.1 Per-Slot Results (one entry per slot in the active list)

```
{
  slot: "gemini-1",
  position_text: "<full text response from the model>",
  unavail: false,
  timeout: false,
  rate_limit_hint: null,           // or "in 5 hours", "until Feb 24 8:37 PM"
  rate_limit_recorded: false,      // whether set-availability was already called
}
```

Every field matters:
- `position_text` feeds the `Prior positions:` block in the Round 2 prompt.
- `unavail` controls which slots receive a Round 2 call.
- `timeout` is a sub-case of unavail — treated identically.
- `rate_limit_hint` triggers `update-scoreboard.cjs set-availability` calls after
  the barrier (if not already recorded by the Round 1 worker itself).

### 4.2 Consensus Check Result

Before issuing Round 2, the orchestrator must evaluate whether all available Round 1
positions agree. This check requires all positions to be collected.

```
{
  consensus_reached: false,
  agreeing_slots: ["claude-1", "claude-3"],
  disagreeing_slots: ["gemini-1"],
  proposed_answer: null,   // only set if consensus_reached = true
}
```

If `consensus_reached: true` after Round 1, there is no Round 2 fan-out.

### 4.3 The Built Deliberation Prompt Template

The Round 2 prompt is constructed once by the orchestrator from the barrier data:

```
QGSD Quorum — Round 2 Deliberation
Repository: <path>
Question: <question>
[artifact block if present]

Prior positions:
• Claude:    <orchestrator's own Round 1 position>
• gemini-1:  <position_text from barrier>
• claude-1:  <position_text from barrier>
• copilot-1: <position_text from barrier>
• codex-1:   UNAVAIL

Given the above, do you maintain your answer or revise it?
State your updated position clearly (2-4 sentences).
```

This single template string is identical for every Round 2 slot call. Each Round 2
worker receives the same prompt. No per-slot customization is needed in Round 2,
which means the Round 2 fan-out is embarrassingly parallel once the template is built.

---

## 5. update-scoreboard.cjs — What It Reads and Writes

`bin/update-scoreboard.cjs` manages `.planning/quorum-scoreboard.json`. It has four
subcommands relevant to quorum execution:

| Subcommand | Called by orchestrator | When |
|------------|----------------------|------|
| `init-team` | Step 2 (pre-flight) | Once per session, before any model calls |
| `set-availability` | After each UNAVAIL slot | Immediately after the slot's output is parsed |
| `get-availability` | Step 1 (pre-flight) | Before any model calls, to filter dormant slots |
| (default round vote) | After consensus/escalation | One call per model per round |

**Atomicity:** All writes use `fs.writeFileSync` directly (no tmp+rename in the
current code, despite the recommendation in ARCHITECTURE.md). Each write reads the full
JSON, applies the delta, and writes the full JSON back. This means concurrent writes
from parallel workers to the same scoreboard file would produce race conditions and data
loss.

**Implication for parallel design:** Under the current design, the orchestrator calls
`update-scoreboard.cjs` **sequentially and after all model calls finish**. A parallel
design where individual Round 1 workers each call `set-availability` concurrently
would cause write collisions on the scoreboard JSON file.

**Resolution options:**
1. **Defer scoreboard writes to the barrier** — Round 1 workers return rate-limit hints
   as structured output; the orchestrator processes them sequentially after the fan-out
   completes. No concurrent writes.
2. **Add file locking** — modify `update-scoreboard.cjs` to acquire a `.lock` file
   before writing. Complex; adds latency; requires careful timeout handling.
3. **Move availability to a separate file** — split `availability{}` from the scoreboard
   JSON into its own file, with each slot's availability in `availability/<slot>.json`.
   Workers write to separate files with no collision.

Option 1 (defer to barrier) is lowest-risk and requires no changes to
`update-scoreboard.cjs`. It means Round 1 workers cannot call `set-availability`
themselves; instead they return the rate-limit text in their output, and the orchestrator
processes it after the barrier.

---

## 6. The Wave-Barrier Pattern — Structural Changes Required

### 6.1 Current Structure (sequential)

```
Orchestrator
  ├── pre-flight (Bash calls, sequential, fast)
  ├── Round 1:
  │     for each slot:
  │       Bash(call-quorum-slot --slot X)  ← waits for response
  │       inspect output
  │       if rate-limited: Bash(update-scoreboard set-availability)
  ├── consensus check
  ├── Round 2 (if needed):
  │     for each slot:
  │       Bash(call-quorum-slot --slot X)  ← waits for response
  │       inspect output
  ├── consensus check (repeat up to 3 rounds)
  └── scoreboard updates (sequential Bash calls)
```

### 6.2 Wave-Barrier Structure (target)

```
Orchestrator
  ├── pre-flight (unchanged — sequential Bash calls)
  ├── WAVE 1: Task fan-out
  │     Task(worker, slot=codex-1, prompt=R1_PROMPT)  ─┐
  │     Task(worker, slot=gemini-1, prompt=R1_PROMPT)   │ all issued in same message turn
  │     Task(worker, slot=claude-1, prompt=R1_PROMPT)   │
  │     Task(worker, slot=copilot-1, prompt=R1_PROMPT) ─┘
  │         ↓ (barrier — wait for all Task results)
  ├── BARRIER 1:
  │     collect all position_text, unavail flags, rate-limit hints
  │     process rate-limit hints (Bash update-scoreboard set-availability — sequential, fast)
  │     consensus check
  │     build Round 2 deliberation prompt (single template from all positions)
  ├── WAVE 2: Task fan-out (if no consensus)
  │     Task(worker, slot=codex-1, prompt=R2_PROMPT)  ─┐
  │     Task(worker, slot=gemini-1, prompt=R2_PROMPT)   │ all issued in same message turn
  │     Task(worker, slot=claude-1, prompt=R2_PROMPT)   │
  │     Task(worker, slot=copilot-1, prompt=R2_PROMPT) ─┘
  │         ↓ (barrier — wait for all Task results)
  ├── BARRIER 2:
  │     collect all Round 2 positions
  │     consensus check
  │     (repeat WAVE/BARRIER pattern up to 3 deliberation waves)
  └── scoreboard updates (sequential Bash calls — unchanged)
```

### 6.3 What a Round 1 Worker Agent Must Do

Each Round 1 worker is a lightweight agent (e.g., a new `qgsd-quorum-worker.md`) that:

1. Receives its slot name and the pre-built Round 1 prompt as arguments.
2. Calls `call-quorum-slot.cjs` via Bash (one call — this is still sequential *within*
   the worker, which is fine because each worker handles one slot).
3. Parses the output for rate-limit hints (without writing to scoreboard — just returns
   the raw hint text).
4. Returns structured output to the orchestrator:

```
SLOT: gemini-1
STATUS: ok | timeout | unavail | error
RATE_LIMIT_HINT: <raw text, first 500 chars> | none
POSITION:
<full text response from the model>
```

The orchestrator parses this structured output from each Task result at the barrier.

### 6.4 What a Round 2 Worker Agent Must Do

Same as Round 1 worker, but receives the pre-built Round 2 deliberation prompt (which
already contains all Round 1 positions). The worker does not need to know about Round 1;
the orchestrator injects the full prior context into the prompt at the barrier.

Round 2 workers have an identical interface to Round 1 workers. The same worker agent
definition can serve both rounds.

---

## 7. The SEQUENTIAL Constraint — What Stays, What Moves

### 7.1 What MUST remain sequential (within-orchestrator)

| Step | Why sequential |
|------|---------------|
| Pre-flight Bash calls | Fast, order-dependent (each builds on previous result) |
| `update-scoreboard.cjs set-availability` processing | File write — must not overlap |
| Round vote scoreboard updates | File write — must not overlap |
| Consensus evaluation | Requires all positions to be present |
| Deliberation prompt construction | Requires all Round 1 positions |

### 7.2 What CAN be parallelized

| Step | Why parallelizable |
|------|------------------|
| Round 1 slot inference calls | Completely independent — each slot sees the same prompt, no cross-slot dependency |
| Round 2 slot inference calls | Completely independent — each slot sees the same deliberation prompt |
| Round N slot inference calls | Same |

### 7.3 What CANNOT be parallelized even within a wave

The orchestrator's own Round 1 position (`$CLAUDE_POSITION`) must be stated before
dispatching workers. This is already fast (the orchestrator writes a few sentences of
reasoning, no tool call needed) and should remain a sequential pre-step before the
WAVE 1 fan-out.

---

## 8. Coupling Points That Must Change

### 8.1 The orchestrator's per-slot result storage

**Currently:** The orchestrator accumulates slot positions in its in-context memory as
it processes each sequential Bash response. There is no structured storage; the
orchestrator tracks state in its working memory across message turns.

**Change needed:** After the barrier, the orchestrator must parse structured output from
N Task results. It needs a defined output format from workers (see section 6.3). The
orchestrator instruction must specify how to parse the `SLOT:` / `STATUS:` / `POSITION:`
blocks from Task results.

### 8.2 UNAVAIL detection and set-availability timing

**Currently:** `set-availability` is called immediately after a slot returns, before the
next slot is called. This is tightly coupled to the sequential loop.

**Change needed:** Workers must return the rate-limit hint text, not call
`set-availability` themselves. The orchestrator processes rate-limit hints sequentially
at the barrier. This is a protocol change: move "record ETA" from within-loop to
after-barrier.

**No change needed in `update-scoreboard.cjs` itself** — the subcommand interface is
unchanged. Only the *timing* of the call moves.

### 8.3 Early consensus short-circuit

**Currently:** The orchestrator can skip calling remaining slots if the first N slots
all agree. This is a sequential-only optimization (you can only short-circuit if you
process results in order).

**Change needed:** Under wave-barrier, all Round 1 slots are called unconditionally.
There is no early exit mid-wave. This is a correctness trade-off: the wave-barrier
design pays the inference cost of all slots even when early consensus is achievable.
The barrier evaluates consensus only after all workers complete.

**This is acceptable** given the goal: the purpose of parallelism is to reduce total
wall-clock time by running all inference calls concurrently. The sequential early-exit
optimization saves inference cost (avoiding extra calls) but does not reduce wall-clock
time in the multi-slot case because subsequent calls would have started later anyway.
Under parallel execution, all calls run simultaneously, so stopping early mid-wave
gives no wall-clock benefit.

### 8.4 Timeout/UNAVAIL handling mid-wave

**Currently:** A timed-out slot is immediately marked UNAVAIL and subsequent calls skip
it.

**Change needed:** Workers report their own timeout status in structured output. The
orchestrator reads this at the barrier and excludes UNAVAIL slots from WAVE 2. The
orchestrator instruction must define what happens when a worker task itself fails (Task
returns error vs. worker returns a `STATUS: timeout` block).

### 8.5 The orchestrator instruction document

**Currently:** `agents/qgsd-quorum-orchestrator.md` contains the full sequential loop
as literal step-by-step Bash call instructions.

**Change needed:** The document must be rewritten to describe:
1. Pre-flight steps (unchanged, still sequential Bash).
2. WAVE 1: how to issue all round-1 Task calls in a single message turn.
3. BARRIER 1: how to parse structured output from N Task results, how to process
   rate-limit hints, how to build the deliberation prompt.
4. WAVE 2+: how to issue deliberation Task calls.
5. BARRIER 2+: how to check consensus, repeat if needed.
6. Scoreboard updates (unchanged, still sequential Bash after all waves done).

A new `qgsd-quorum-worker.md` agent definition is needed to describe what each worker
does (call one slot, return structured output).

---

## 9. Providers.json — No Changes Needed

`bin/providers.json` is read by `call-quorum-slot.cjs` to find each slot's CLI path,
model, and timeout. This lookup is per-slot and stateless. Under the wave-barrier design,
each worker still calls `call-quorum-slot.cjs` with `--slot <name>`, and the script
reads providers.json exactly as before. No changes needed.

The `quorum_timeout_ms` values currently in providers.json are:

| Slot | quorum_timeout_ms |
|------|-------------------|
| codex-1, codex-2 | 30000ms |
| gemini-1, gemini-2 | 30000ms |
| opencode-1 | 30000ms |
| copilot-1 | 30000ms |
| claude-1 (DeepSeek) | 20000ms |
| claude-2 (MiniMax) | 20000ms |
| claude-3 (Qwen) | 30000ms |
| claude-4 (Kimi) | 30000ms |
| claude-5 (Llama-4) | 10000ms |
| claude-6 (GLM-5) | 8000ms |

Under parallel execution, total Round 1 wall-clock time will be bounded by the
**slowest responding slot** rather than the sum. With the current values, worst case is
~30s (any of the 30000ms slots) vs. the current sequential worst case of 12 slots × 30s
= 360s (if all slots are slow). This is a 10–12x wall-clock reduction assuming similar
per-slot latency.

---

## 10. Scoreboard Write Concurrency — The Only File-Safety Risk

As noted in section 5, `.planning/quorum-scoreboard.json` is a single JSON file written
by `update-scoreboard.cjs`. The write pattern is:

```javascript
const data = loadData(cfg.scoreboard);   // read full JSON
// ... apply delta ...
fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');  // write full JSON
```

There is no locking and no atomic tmp+rename (the code writes directly with
`writeFileSync`). Two concurrent writes will produce a lost-update race: whichever
process reads first, the other's changes will overwrite its view.

**The wave-barrier design avoids this entirely** by keeping all scoreboard writes in
the orchestrator's sequential post-barrier code. Workers do not write to the scoreboard.
Workers only return rate-limit hint text, not parsed availability data. The orchestrator
calls `set-availability` sequentially at the barrier, and calls round-vote updates
sequentially after all waves complete.

This means the file-safety risk introduced by parallelism is zero if the worker agent
definition explicitly prohibits scoreboard writes.

---

## 11. Summary: What Changes, What Stays the Same

| Component | Change? | Detail |
|-----------|---------|--------|
| `call-quorum-slot.cjs` | No | Unchanged — workers call it the same way |
| `update-scoreboard.cjs` | No | Unchanged — orchestrator still calls it sequentially |
| `providers.json` | No | Unchanged — per-slot config lookup is stateless |
| `check-provider-health.cjs` | No | Still called in pre-flight, unchanged |
| `agents/qgsd-quorum-orchestrator.md` | Yes — major rewrite | Replace sequential Bash loop with Task fan-out + barrier logic |
| `agents/qgsd-quorum-worker.md` | Yes — new file | New lightweight agent: receives slot+prompt, calls call-quorum-slot.cjs, returns structured output |
| Scoreboard write timing | Yes | `set-availability` moves from within-loop to after-barrier; round votes still after all waves |
| Early consensus short-circuit | Removed | Wave-barrier calls all slots; consensus checked only at barrier |
| SEQUENTIAL CALLS ONLY constraint | Relaxed, not removed | Sequential within pre-flight, within barriers, within scoreboard updates. Parallel only for inference waves. |

---

## 12. Recommended Implementation Sequence

1. **Define the worker output format** — agree on the structured text block (`SLOT:` /
   `STATUS:` / `RATE_LIMIT_HINT:` / `POSITION:`) before writing any agent definition.
   This is the inter-agent contract that both the orchestrator and the worker must honor.

2. **Write `qgsd-quorum-worker.md`** — the worker is simple: parse args, call
   `call-quorum-slot.cjs`, scan output for rate-limit patterns, emit structured result.

3. **Rewrite the orchestrator's Round 1 section** — replace the sequential loop with
   a Task fan-out. The pre-flight steps (Steps 1–2) and the scoreboard update section
   remain unchanged.

4. **Rewrite the orchestrator's deliberation section** — same fan-out pattern for each
   deliberation wave. The deliberation prompt is constructed from barrier data.

5. **Test with a single available slot** — the wave-barrier design degrades gracefully:
   if only one slot is available, the fan-out is a fan-out of one, which is functionally
   identical to the sequential design.

6. **Test the scoreboard write timing** — verify that `set-availability` is called by
   the orchestrator after the barrier, not by workers. This is purely a protocol
   enforcement question in the worker agent definition.

---

## Sources

All findings are HIGH confidence — derived directly from source files, not training data.

- `/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — full
  orchestrator instruction set, sequential constraint definition, Bash call patterns for
  both rounds, scoreboard update patterns, UNAVAIL handling, availability recording.
- `/Users/jonathanborduas/code/QGSD/bin/call-quorum-slot.cjs` — full implementation.
  Subprocess and HTTP dispatch paths, timeout handling, exit code semantics, stdin/stdout
  contract.
- `/Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs` — full implementation.
  All four subcommands (`init-team`, `set-availability`, `get-availability`, round vote
  default). Write pattern (direct `writeFileSync`, no tmp+rename, no locking).
- `/Users/jonathanborduas/code/QGSD/bin/providers.json` — all 10 provider entries with
  `quorum_timeout_ms` values used for the timeout table in section 9.
- `/Users/jonathanborduas/code/QGSD/.planning/research/ARCHITECTURE.md` — v0.10 system
  component map, config file locations, data model.
