# Quorum Scoreboard: Concurrency Analysis and Parallel-Safe Strategy

**Topic:** Concurrency safety for `update-scoreboard.cjs` when 5 quorum workers write simultaneously
**Researched:** 2026-02-24
**Confidence:** HIGH — all source files read directly; findings grounded in actual code, not assumptions

---

## 1. How `update-scoreboard.cjs` Works Today

### Commands Supported

The script has four top-level entry points:

| Subcommand / Mode | Trigger | What It Does |
|---|---|---|
| `(default)` — model vote | `--model` flag | Upserts a vote for a named model family into the shared rounds array, recomputes cumulative stats |
| `(default)` — slot vote | `--slot` + `--model-id` flags | Appends a new round entry keyed by `"<slot>:<model-id>"`, recomputes slot stats |
| `init-team` | First positional arg | Captures team fingerprint (idempotent); skips write if fingerprint unchanged |
| `set-availability` | First positional arg | Records a quota/rate-limit ETA for a slot into `data.availability{}` |
| `get-availability` | First positional arg | Reads and formats all availability entries; stdout only, no write |

### Read-Modify-Write Pattern (All Write Paths)

Every write subcommand follows this exact pattern:

```
1. loadData()    — fs.readFileSync(absPath, 'utf8') + JSON.parse
2. mutate data   — append to data.rounds[], update data.slots{}, etc.
3. recompute     — recomputeStats(data) or recomputeSlots(data) replays all rounds from scratch
4. writeFileSync — fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
```

**There is no atomic rename, no file lock, no temp-file swap.** `writeFileSync` writes directly to the target path. On macOS/Linux, a direct `writeFileSync` is NOT atomic — the kernel can interleave writes from concurrent processes.

### What `recomputeStats` Does

After any mutation, `recomputeStats(data)` iterates `data.rounds` from scratch and sums every vote for every model. This is intentional: it prevents score drift if votes are updated retroactively. The implication for concurrency is critical: **the recompute is only correct if `data.rounds` is the complete, canonical set of rounds** at the time of computation.

---

## 2. Scoreboard JSON Structure

```json
{
  "models": {
    "claude":     { "score": 104, "tp": 111, "tn": 1, "fp": 4, "fn": 0, "impr": 0 },
    "gemini":     { "score": 55,  "tp": 45,  ... },
    "opencode":   { "score": 99,  ... },
    "copilot":    { "score": 83,  ... },
    "codex":      { "score": 0,   ... },
    "deepseek":   { "score": 1,   ... },
    "minimax":    { "score": 1,   ... },
    "qwen-coder": { "score": 1,   ... },
    "kimi":       { "score": 1,   ... },
    "llama4":     { "score": 1,   ... }
  },
  "slots": {
    "claude-1:deepseek-ai/DeepSeek-V3.2": { "slot": "claude-1", "model": "deepseek-ai/...", "score": 11, "tp": 18, "fp": 2, "fn": 1, "impr": 0 },
    "claude-2:MiniMaxAI/MiniMax-M2.5":    { "slot": "claude-2", ... },
    "claude-3:Qwen/Qwen3-...":            { "slot": "claude-3", ... },
    "claude-4:accounts/fireworks/...":    { "slot": "claude-4", ... },
    "claude-5:meta-llama/...":            { "slot": "claude-5", ... }
  },
  "categories": {
    "Technical / Engineering": ["Basic programming", "Algorithms & data structures", ...],
    "Quantitative / Business": ["Arithmetic & basic numeracy", ...],
    ...
  },
  "rounds": [
    {
      "date": "02-21",
      "task": "quick-2: R3.6 rule",
      "round": 1,
      "votes": {
        "claude": "TP",
        "codex": "UNAVAIL",
        "gemini": "TP+",
        "opencode": "TP",
        "copilot": "TP"
      },
      "verdict": "APPROVE",
      "team_fingerprint": "abc123..."
    }
  ],
  "availability": {
    "codex-1": {
      "available_at_iso": "2026-02-24T20:37:00.000Z",
      "available_at_local": "2/24/2026, 8:37:00 PM",
      "reason": "usage limit",
      "set_at": "2026-02-23T20:00:00.000Z"
    }
  },
  "team": {
    "fingerprint": "abc123...",
    "captured_at": "...",
    "claude_model": "claude-sonnet-4-6",
    "agents": { "claude-1": { "model": "deepseek-ai/..." }, ... },
    "mcps": ["claude-1", "claude-2", ...],
    "plugins": []
  }
}
```

### Key Design Properties

1. **`rounds[]` is the source of truth.** `models{}` and `slots{}` are derived by replaying `rounds[]`. You can reconstruct the entire scoreboard from `rounds[]` alone.
2. **Votes within a round are keyed by model or composite slot key.** For model-mode: `votes.gemini = "TP+"`. For slot-mode: `votes["claude-1:deepseek-ai/DeepSeek-V3.2"] = "TP"`.
3. **Model-mode upserts; slot-mode appends.** Model-mode calls `findIndex` to locate an existing `(task, round)` entry and patches the vote in. Slot-mode always appends a new round entry (no upsert).
4. **The file is ~4744 lines (real data).** Full-file JSON parse + stringify on every write. At current data volume (~350 rounds) this takes ~5–20ms. Not a bottleneck for sequential writes; becomes a collision window for parallel writes.

---

## 3. Current Write Pattern: Sequential, One Slot Per Call

The orchestrator (`qgsd-quorum-orchestrator.md`) mandates:

> **SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS.**
> Every model call and every Task spawn MUST be issued as a separate, standalone message turn — never batched or co-submitted as sibling calls.

Scoreboard updates happen after consensus is reached, using the same sequential pattern:

```bash
# One command per model, issued sequentially:
node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" --model gemini --result TP ...
node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" --model opencode --result TN ...
node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" --model copilot --result TP ...
```

Each invocation is a separate Node.js process. Because the orchestrator issues them sequentially (one per message turn), only one write process is active at any time. **This is currently safe precisely because of the sequential constraint.**

---

## 4. What Breaks With 5 Parallel Workers

If the orchestrator is modified to spawn 5 slot workers simultaneously (parallel `Task` calls or parallel Bash co-submissions), each worker would eventually call `update-scoreboard.cjs` for its own vote. The write pattern becomes:

```
Worker 1: read → mutate (add claude-1 vote) → recompute → write
Worker 2: read → mutate (add claude-2 vote) → recompute → write
Worker 3: read → mutate (add claude-3 vote) → recompute → write
Worker 4: read → mutate (add claude-4 vote) → recompute → write
Worker 5: read → mutate (add claude-5 vote) → recompute → write
```

These processes all execute concurrently. The failure modes are:

### Failure Mode A: Last-Writer-Wins (Silent Data Loss)

All five workers read the same file state (say, 350 rounds). Each appends its one vote to get a local copy with 351 rounds. Each then writes its full JSON back to disk. The last writer to finish wins — the file contains 351 rounds (only that worker's vote), not 355. **Four votes are silently dropped.** Score totals are wrong. There is no error message, no crash — the file is valid JSON with correct checksums.

This is the most likely failure mode on macOS (HFS+/APFS). `fs.writeFileSync` performs a series of `write()` syscalls. Two concurrent `writeFileSync` calls on the same path can interleave or the second can begin before the first flushes, but even if they don't byte-interleave, the semantics are last-write-wins at the fd level.

### Failure Mode B: Torn File (JSON Parse Error)

If two processes write simultaneously to the same file descriptor at overlapping offsets, the file content can be a byte-level mix of two JSON strings. The result is a file that cannot be parsed — `JSON.parse` throws. The next writer calling `loadData()` catches the error and returns `emptyData()`, then writes an empty scoreboard back, **destroying all historical data**.

This failure mode is less likely on macOS (the kernel serializes concurrent `write()` calls to the same path) but is not impossible, especially when processes open the file independently (no shared fd) or write large buffers (>4KB page size boundary crossing).

### Failure Mode C: Recompute on Stale Rounds

Even if physical writes don't collide, the read-modify-recompute-write cycle introduces a logical race. Worker 1 reads 350 rounds, adds its vote (351), recomputes stats from 351 rounds, and writes. Worker 2 reads 350 rounds (before Worker 1 wrote), adds its vote (351), recomputes from 351 rounds, and writes. After both finish: the file has 351 rounds (Worker 2's state), Worker 1's vote is gone, but Worker 2's recomputed stats are also wrong because they missed Worker 1's data.

### Failure Mode D: `availability` Field Corruption

The `set-availability` subcommand also uses the read-modify-write pattern. If an orchestrator calls `set-availability` for Codex while another worker is simultaneously writing a round vote, the availability entry can be dropped (if the round-vote writer's stale read didn't include the availability update) or the round vote can be dropped (if the availability writer's stale read didn't include the round).

---

## 5. How the Orchestrator Reads Scoreboard Data Between Rounds

The orchestrator uses the scoreboard in two ways:

**Read 1 — Availability Cache Check (Step 1, pre-flight):**
```bash
node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" get-availability \
  --scoreboard .planning/quorum-scoreboard.json 2>/dev/null || echo '{}'
```
This is a read-only call. It parses `data.availability` and outputs JSON. Safe under concurrency — no write.

**Read 2 — Implicit Score Display:**
The orchestrator does not explicitly read the scoreboard to make quorum decisions. Scores are informational. The scoreboard is written to after a verdict is reached, not consulted during deliberation.

**Write — Post-Verdict (after consensus):**
Writes happen only in the "Consensus output" or "Escalate" sections, after all model calls are complete. Under the current sequential architecture, this is safe.

**The concurrency problem only exists if:**
1. Worker processes (not the orchestrator) each call `update-scoreboard.cjs` independently for their own vote, AND
2. Those workers run in parallel.

Under the current architecture, neither condition is true — the orchestrator calls `update-scoreboard.cjs` sequentially after all workers finish. The problem becomes real only if the system is refactored for parallel slot dispatch.

---

## 6. Options for Concurrency-Safe Writes

### Option A: Per-Slot Temp Files Merged Post-Wave (RECOMMENDED)

Each parallel worker writes only its own vote to a separate temp file instead of the shared scoreboard:

```
.planning/scoreboard-tmp/vote-<slot>-<task>-<round>-<pid>.json
```

Each temp file contains only the minimal vote payload:
```json
{ "slot": "claude-1", "model-id": "deepseek-ai/DeepSeek-V3.2", "result": "TP", "task": "quick-97", "round": 1, "verdict": "APPROVE" }
```

After all workers complete, the orchestrator runs a single merge step:

```bash
node update-scoreboard.cjs merge-wave \
  --dir .planning/scoreboard-tmp \
  --task "quick-97" \
  --round 1 \
  --scoreboard .planning/quorum-scoreboard.json
```

`merge-wave` reads all temp files matching the wave pattern, applies all votes in one read-modify-recompute-write cycle, then deletes the temp files.

**Properties:**
- Zero concurrency risk: workers never touch the shared file
- One write per wave (not one per worker): cleaner transaction boundary
- Temp files are idempotent: re-running merge on same temp files is safe
- Temp files survive crashes: merge can be re-run after failure
- Workers still communicate result to orchestrator via stdout (no file needed)

**Cost:**
- New `merge-wave` subcommand in `update-scoreboard.cjs`
- New temp directory management
- Workers need a new code path to write to temp file instead of calling `update-scoreboard.cjs`
- Orchestrator needs to call `merge-wave` after each parallel round

### Option B: Atomic Rename on Single File (Safer Sequential, Not Truly Parallel-Safe)

Replace the current `fs.writeFileSync` direct write with a write-to-temp + atomic rename:

```javascript
const tmpPath = absPath + '.' + process.pid + '.tmp';
fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
fs.renameSync(tmpPath, absPath);
```

`fs.renameSync` is atomic on POSIX (single directory). This prevents torn-file corruption (Failure Mode B) because no reader ever sees a partial write — the old file is visible until the rename completes, then the new file atomically replaces it.

**BUT this does NOT prevent last-writer-wins** (Failure Mode A). Two processes that both read the stale file and both rename will still produce a file with only one writer's data. The race window is still: read-modify-compute-tmpwrite-rename.

**Properties:**
- Prevents torn files (Failure Mode B) — good
- Does NOT prevent data loss from last-writer-wins (Failure Mode A)
- Minimal code change: 2 lines per write path in `update-scoreboard.cjs`
- Should be done regardless as a baseline improvement

**Verdict:** Necessary but not sufficient. Use as a hardening step combined with another strategy.

### Option C: File Locking via `lockfile` or `proper-lockfile` npm Package

Use a lockfile (e.g., `.planning/quorum-scoreboard.json.lock`) to serialize all writer processes:

```javascript
const lock = require('proper-lockfile');
await lock.lock(absPath, { retries: { retries: 10, minTimeout: 50, maxTimeout: 200 } });
try {
  // read → mutate → recompute → write
} finally {
  await lock.unlock(absPath);
}
```

`proper-lockfile` uses directory creation (atomic on POSIX) for the lock primitive and supports retries with backoff.

**Properties:**
- Prevents all concurrent write failures (Failure Modes A, B, C, D)
- Works with the current call-per-slot pattern — no orchestrator change needed
- Adds a dependency (`proper-lockfile` ~5KB, no native deps)
- Lock contention: 5 workers all trying to acquire the lock; they serialize with 50–200ms backoff
- Stale lock risk: if a worker crashes while holding the lock, `proper-lockfile` uses PID-based stale lock detection (checks if PID is still alive)

**Cost:**
- New npm dependency
- Each write invocation takes slightly longer (lock acquisition + retry)
- Lock directory in `.planning/` must be gitignored

**Verdict:** Correct solution for the concurrency problem if parallel calling is required. Adds a dependency. The retry-with-backoff means 5 parallel writers serialize into 5 sequential writes — no data loss, ~50–200ms overhead per write.

### Option D: Single Orchestrator-Owned Write (Architectural Change)

Remove all `update-scoreboard.cjs` calls from worker code. Workers report their vote as structured JSON on stdout. The orchestrator collects all worker outputs, then performs exactly one `update-scoreboard.cjs` call per model with all votes already known.

This is already how the current orchestrator works for the `--model` path — the orchestrator calls `update-scoreboard.cjs` sequentially after all workers complete. The issue only arises if workers themselves are given the responsibility to call `update-scoreboard.cjs`.

**Properties:**
- Zero concurrency risk: all writes are orchestrator-owned and sequential
- No new dependencies, no new subcommands
- Works with the current architecture
- Workers must emit a parseable vote record in their stdout (structured format)

**Cost:**
- Workers cannot self-register their vote
- Orchestrator must parse worker stdout for vote data (not a format burden; the orchestrator already reads worker output to determine TP/TN/FP/FN)

**Verdict:** Best fit for the current QGSD architecture. No dependency, no protocol change, enforces the existing design principle that the orchestrator owns all scoreboard state.

### Option E: In-Process Merge via Shared Memory / IPC

Use Node.js worker threads or IPC (message passing) so all parallel workers communicate their votes to a single coordinating process that owns the scoreboard write.

**Not recommended.** The QGSD architecture uses separate Node.js processes for each slot call (`call-quorum-slot.cjs` is a subprocess). Coordinating across process boundaries with IPC would require a persistent coordinator process — fundamentally changing the architecture. Not worth it.

---

## 7. Recommendation: Hybrid Strategy

### Immediate Hardening (Zero Architecture Change)

Add atomic rename to all four write paths in `update-scoreboard.cjs`. Replace:

```javascript
fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
```

With:

```javascript
const tmpPath = absPath + '.' + process.pid + '.tmp';
fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
fs.renameSync(tmpPath, absPath);
```

This eliminates Failure Mode B (torn files) regardless of calling pattern. It is a 2-line change per write site (4 sites in the file: `init-team`, `set-availability`, slot-mode main, model-mode main). **Do this now as baseline hardening.** The current sequential orchestrator is safe from Failure Mode A as long as the sequential constraint holds.

### For Parallel Worker Architecture (If Implemented)

Use **Option A (per-slot temp files + merge-wave)** as the primary strategy.

**Rationale over Option C (locking):**

1. **No new dependency.** Option A only requires a new directory and a new subcommand in an existing file. Option C requires `proper-lockfile` or equivalent.

2. **Better failure recovery.** Temp files survive a crashed worker — the orchestrator can inspect them to see which votes landed before the crash, and re-run the merge or re-invoke the failed slot without re-running the successful ones.

3. **Transactional semantics.** Merging a full wave's votes in one read-modify-write is a cleaner model than 5 concurrent single-vote writes with lock contention. One merge transaction = one round's complete data.

4. **Temp file cleanup is observable.** If temp files exist after a wave, it signals an incomplete merge (can be detected by `ls .planning/scoreboard-tmp/*.json` check in the orchestrator pre-flight step).

5. **Consistent with QGSD design philosophy.** The orchestrator already owns the quorum logic. Delegating per-slot writes to workers violates the single-writer principle. Temp files keep workers write-isolated while giving the orchestrator full control over scoreboard state.

### Changes Needed in `update-scoreboard.cjs`

| Change | Scope | Priority |
|--------|-------|----------|
| Atomic rename on all 4 write paths | 8 lines changed | HIGH — do now |
| New `merge-wave` subcommand | ~80 new lines | MEDIUM — when parallel dispatch is implemented |
| New `write-temp` subcommand (worker-side) | ~30 new lines | MEDIUM — when parallel dispatch is implemented |

### Changes Needed in Orchestrator (`qgsd-quorum-orchestrator.md`)

| Change | Scope | Priority |
|--------|-------|----------|
| After parallel wave: call `merge-wave` before next round's pre-flight | 1 new Bash step | MEDIUM — when parallel dispatch is implemented |
| Pre-flight: check for stale temp files from prior run | 1 new check | LOW — defensive |

---

## 8. What NOT to Do

**Do not use `flock` (shell-level file locking).** `flock` on macOS (APFS) is advisory only and not reliable across separate Node.js processes. Different processes may not observe each other's locks.

**Do not rely on write ordering.** Even with `O_SYNC` or `fsync()`, the read-modify-write race is a logical race, not a physical one. Fsync after write guarantees durability, not mutual exclusion.

**Do not merge on every vote if sequential is acceptable.** If the architecture remains sequential (orchestrator calls `update-scoreboard.cjs` one at a time), the current approach plus atomic rename is sufficient. Do not add complexity for a problem that does not exist in the current design.

**Do not attempt byte-level merge (JSON patch).** Merging two diverged JSON blobs requires a conflict resolution strategy. For append-only data like `rounds[]`, this is doable but fragile. The `rounds[]` replay approach (recompute from scratch) is deliberately chosen to avoid accumulated drift — don't undermine it with partial-patch merges.

---

## 9. Summary

| Strategy | Prevents Data Loss | Prevents Torn Files | New Dep | Arch Change |
|---|---|---|---|---|
| Current (sequential) | YES (by design) | NO | none | none |
| + Atomic rename (Option B) | NO (for parallel) | YES | none | 2 lines x4 |
| File locking (Option C) | YES | YES | proper-lockfile | moderate |
| Temp files + merge-wave (Option A) | YES | YES | none | new subcommand + dir |
| Orchestrator-owned writes (Option D) | YES (inherent) | YES (inherent) | none | none |

**Recommended path:**

1. **Now:** Add atomic rename to all 4 write paths — 8 lines, no risk, eliminates torn-file corruption permanently.
2. **When parallel dispatch is designed:** Implement temp files + `merge-wave` (Option A) — keeps the orchestrator as the single authority on scoreboard state, no new dependencies, better failure observability than locking.
3. **Keep Option D as the design constraint:** Workers report votes to the orchestrator via stdout; the orchestrator performs the write. Never delegate `update-scoreboard.cjs` calls to parallel worker processes.

---

## Sources

- `/Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs` — HIGH confidence (source read, 741 lines). All 4 write paths, read-modify-write pattern, `recomputeStats` design.
- `/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — HIGH confidence (source read). Sequential call constraint, scoreboard update patterns, availability cache read.
- `/Users/jonathanborduas/code/QGSD/.planning/quorum-scoreboard.json` — HIGH confidence (source read, 4744 lines). Live data: `models{}`, `slots{}` composite keys, `rounds[]` structure, `availability{}`, `team{}`.
- `/Users/jonathanborduas/code/QGSD/bin/call-quorum-slot.cjs` — HIGH confidence (source read). Subprocess + HTTP dispatch, no scoreboard interaction.
- POSIX `rename(2)` atomicity — HIGH confidence (POSIX standard: rename is atomic within same filesystem).
- macOS APFS write semantics — MEDIUM confidence (known behavior: concurrent `write()` syscalls to same path serialize at fd level but `open()` → `write()` → `close()` from two processes is still last-writer-wins at logical level).
