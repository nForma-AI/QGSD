# Architecture Patterns

**Domain:** Agent harness optimization -- 10 new features integrating with existing nForma hook/config/dispatch architecture
**Researched:** 2026-03-06
**Confidence:** HIGH (all analysis based on direct code inspection of existing hooks, config, and dispatch)

## Existing Architecture Summary

The nForma plugin consists of:

| Layer | Components | Data Flow |
|-------|-----------|-----------|
| **Hooks** (9 scripts) | nf-prompt.js (UserPromptSubmit), nf-stop.js (Stop), nf-circuit-breaker.js (PreToolUse), gsd-context-monitor.js (PostToolUse), nf-precompact.js (PreCompact), nf-session-start.js (SessionStart), nf-token-collector.js (SubagentStop), nf-slot-correlator.js (SubagentStop), nf-statusline.js | stdin JSON -> process logic -> stdout JSON (hook decision channel) |
| **Config** | config-loader.js two-layer merge (DEFAULT -> ~/.claude/nf.json -> .claude/nf.json) | Shallow spread, validated, all hooks import from same loader |
| **Dispatch** | quorum-slot-dispatch.cjs -> call-quorum-slot.cjs | Prompt construction, child process spawn, output parsing |
| **Scoreboard** | update-scoreboard.cjs | Atomic read-modify-write to .planning/quorum-scoreboard.json |
| **Token Tracking** | nf-token-collector.js | JSONL append to .planning/token-usage.jsonl |
| **Conformance** | nf-stop.js / nf-prompt.js | JSONL append to .planning/conformance-events.jsonl |
| **Install** | bin/install.js | hooks/ -> hooks/dist/ -> ~/.claude/hooks/, bin/ -> ~/.claude/nf-bin/ |

Key invariants:
- Hooks NEVER write to stdout except for the hook decision JSON
- All hooks fail open (process.exit(0) on any error)
- Config is loaded per-invocation (no caching across hook calls)
- stderr is the debug/warning channel
- Shallow config merge means nested objects are fully replaced, not deep-merged (flat keys preferred)

---

## 10 New Features: Integration Map

### Feature 1: Hook Profiles

**What:** Named config presets (e.g., "solo", "full-quorum", "budget") that override specific config keys.
**Type:** MODIFICATION of config-loader.js + NEW config keys in nf.json
**Integration point:** config-loader.js `loadConfig()`

**Architecture:**
```
nf.json (global or project):
{
  "profiles": {
    "solo":   { "quorum": { "minSize": 1 }, "fail_mode": "open" },
    "budget": { "quorum": { "minSize": 2 }, "model_tier_worker": "haiku" },
    "full":   { "quorum": { "minSize": 4 } }
  },
  "active_profile": "full"
}
```

Merge order becomes: `DEFAULT -> global -> project -> profiles[active_profile]`. The profile layer applies AFTER the two-layer merge but BEFORE validation. CLI override via `--profile <name>` in nf-prompt.js (parsed from user prompt text, similar to existing `--n N` flag parsing in nf-stop.js).

**Files modified:**
- `hooks/config-loader.js` -- add `applyProfile()` step in `loadConfig()`, validate `profiles` and `active_profile` keys
- `hooks/nf-prompt.js` -- parse `--profile <name>` from prompt, pass to loadConfig or override config post-load
- `hooks/nf-stop.js` -- same profile-aware config loading for consistency

**No new files needed.** This is a pure config-layer enhancement.

---

### Feature 2: Quorum Caching

**What:** Cache quorum results so repeated runs on unchanged artifacts skip re-dispatch.
**Type:** NEW file (.planning/quorum-cache.json) + MODIFICATIONS to dispatch path

**Architecture:**
```
Cache key = SHA256(artifact_content + question + slot_list + round)
Cache entry = { key, verdict, reasoning, timestamp, artifact_path, ttl_minutes }
```

Cache is checked BEFORE dispatch in quorum-slot-dispatch.cjs. On cache hit, emit cached result block immediately. On miss, dispatch normally and write result to cache after success.

TTL-based invalidation (default 60 minutes). File-change detection: if artifact mtime > cache entry timestamp, invalidate.

**Files modified:**
- `bin/quorum-slot-dispatch.cjs` -- add cache check before spawn, cache write after success
- `hooks/config-loader.js` -- add `quorum_cache: { enabled: true, ttl_minutes: 60 }` to DEFAULT_CONFIG

**New files:**
- `.planning/quorum-cache.json` -- cache store (gitignored)

**Data flow change:** quorum-slot-dispatch.cjs gains an early-exit path on cache hit. No changes to hook decision flow.

---

### Feature 3: Budget-Aware Downgrade

**What:** When token spend exceeds a threshold, automatically downgrade model tiers or reduce quorum size.
**Type:** MODIFICATION to nf-prompt.js + NEW budget tracking logic

**Architecture:**
```
Budget config in nf.json:
{
  "budget": {
    "daily_token_limit": 500000,
    "downgrade_at_pct": 80,
    "downgrade_tier": "haiku",
    "reduce_quorum_to": 2
  }
}
```

nf-prompt.js already runs on every UserPromptSubmit. Add a budget check step:
1. Read .planning/token-usage.jsonl, sum today's tokens
2. If sum >= daily_token_limit * downgrade_at_pct/100, override config in-memory:
   - Set model_tier_worker to downgrade_tier
   - Set quorum.minSize to reduce_quorum_to
3. Inject a warning into additionalContext: "BUDGET ALERT: 80% of daily token budget consumed. Quorum downgraded to 2 models, worker tier set to haiku."

**Files modified:**
- `hooks/nf-prompt.js` -- add budget check after config load, before quorum injection
- `hooks/config-loader.js` -- add `budget` key to DEFAULT_CONFIG with validation

**New utility (optional):**
- `bin/budget-check.cjs` -- standalone CLI to query current spend. But for the hook path, inline the JSONL sum directly in nf-prompt.js to avoid child process overhead.

**Data flow change:** nf-prompt.js reads token-usage.jsonl (currently only written by nf-token-collector.js). Creates a new read dependency: prompt hook -> token log.

---

### Feature 4: Session State Reminder

**What:** On context compaction, inject richer session state (not just STATE.md current position, but also recent quorum decisions, active profile, budget status).
**Type:** MODIFICATION of nf-precompact.js

**Architecture:**

nf-precompact.js currently injects: Current Position from STATE.md + pending tasks + resume instructions.

Enhanced injection adds:
1. Last 3 conformance events from .planning/conformance-events.jsonl (recent quorum decisions)
2. Active profile name from config
3. Budget status (if budget feature enabled)
4. Circuit breaker state (active/inactive from .claude/circuit-breaker-state.json)

All reads are fail-open. If any file is missing, that section is omitted from the injected context.

**Files modified:**
- `hooks/nf-precompact.js` -- add sections for conformance history, profile, budget, breaker state

**No new files.** Reads existing data files that other hooks already write.

---

### Feature 5: Security Sweep

**What:** Scan for leaked secrets/credentials in planning artifacts and hook configs before commit.
**Type:** NEW PreToolUse hook logic added to existing nf-circuit-breaker.js

**Architecture decision:** Add to existing nf-circuit-breaker.js (PreToolUse) rather than a new hook. The circuit breaker already inspects Bash commands. Add a secret-scan check for `git commit` and `git add` commands.

Pattern: When a Bash command matches `git commit` or `git add`, scan the staged files for patterns:
- API keys (regex: `/[A-Za-z0-9_]{20,}/` near "key", "token", "secret", "password")
- .env file content
- Known credential file names (credentials.json, .env.local, etc.)

If secrets detected, emit a warning in additionalContext (not a block -- fail-open philosophy). The warning tells Claude to remove the secret before committing.

**Files modified:**
- `hooks/nf-circuit-breaker.js` -- add secret scan on git commit/add commands
- `bin/secret-audit.sh` -- already exists, can be invoked as the thorough offline scan engine

**Alternative considered:** Standalone `bin/security-sweep.cjs` invoked by the hook. Better separation of concerns, but adds child process latency to every git commit. Recommend inline regex scan for speed, with `secret-audit.sh` as the thorough offline tool.

---

### Feature 6: Pass@k Metrics

**What:** Track how many quorum rounds are needed to reach consensus, measuring "pass at k" efficiency.
**Type:** MODIFICATION to update-scoreboard.cjs + NEW metrics in scoreboard JSON

**Architecture:**
```
scoreboard.json gains:
{
  "pass_at_k": {
    "k1": 0.72,   // % of tasks reaching consensus in round 1
    "k2": 0.89,   // % reaching consensus by round 2
    "k3": 0.96,   // % reaching consensus by round 3
    "total_tasks": 150,
    "by_category": { ... }
  }
}
```

Data source: conformance-events.jsonl already logs `quorum_complete` with vote_result counts. update-scoreboard.cjs `merge-wave` command already receives `--round` flag.

Integrate pass@k calculation into the existing stats recalculation pass that runs on every `merge-wave`.

**Files modified:**
- `bin/update-scoreboard.cjs` -- add pass@k calculation in the stats recalculation step
- Scoreboard JSON schema gets new `pass_at_k` key

**No new hooks or data files.** Pure scoreboard enhancement using existing data.

---

### Feature 7: De-Sloppify Cleanup

**What:** Lint pass to remove dead code, unused imports, stale config keys, inconsistent naming across the codebase.
**Type:** STANDALONE script (no architecture changes)

**Architecture:** This is a maintenance task, not a runtime feature. Create a lint script that:
1. Scans hooks/ for unused require() calls
2. Checks config-loader.js DEFAULT_CONFIG against actual usage in hooks
3. Finds stale references to old "qgsd" naming
4. Reports dead exports in bin/ scripts

**New files:**
- `bin/lint-codebase.cjs` -- standalone lint/cleanup tool

**No modifications to existing hooks or data flow.** This is a tooling-only addition.

---

### Feature 8: Stall Detection

**What:** Detect when Claude is stuck in a loop (not oscillation -- different from circuit breaker) and intervene.
**Type:** MODIFICATION to gsd-context-monitor.js (PostToolUse)

**Architecture:**

Stall vs oscillation distinction:
- **Oscillation** (circuit breaker): alternating commits on same files = detected by git history pattern
- **Stall**: repeated tool calls with no progress = detected by tool call patterns in real-time

gsd-context-monitor.js already fires on every PostToolUse event. Add stall detection:

1. Track tool call history in a state file: `.claude/stall-detector-state.json`
2. On each PostToolUse, record: `{ tool_name, timestamp, input_hash }`
3. If last N tool calls (default 5) have same tool_name AND same input_hash, inject warning:
   "STALL DETECTED: You have called {tool} {N} times with identical input. Step back and try a different approach."

**Files modified:**
- `hooks/gsd-context-monitor.js` -- add stall detection after context window check
- `hooks/config-loader.js` -- add `stall_detector: { enabled: true, window: 5 }` to DEFAULT_CONFIG

**New state file:**
- `.claude/stall-detector-state.json` -- rolling window of recent tool calls (gitignored)

**Data flow change:** gsd-context-monitor.js gains a write path (state file). Currently it is read-only (reads context_window from input, reads config). Adding a write makes it stateful across invocations.

---

### Feature 9: Harness Diagnostic Agent

**What:** A subagent that can diagnose nForma infrastructure issues (hook failures, MCP connectivity, config problems).
**Type:** NEW agent definition + NEW diagnostic script + NEW slash command

**Architecture:**

New agent type: `nf-diagnostics` (spawned via Task like slot workers).

The agent runs a diagnostic script that checks:
1. Hook installation status (are all hooks in ~/.claude/hooks/?)
2. MCP server connectivity (ping each configured server)
3. Config validation (load both layers, report issues)
4. Token usage summary (read token-usage.jsonl, aggregate)
5. Scoreboard health (read scoreboard, check for anomalies)
6. Circuit breaker state (check .claude/circuit-breaker-state.json)
7. Recent conformance events (tail conformance-events.jsonl)

**New files:**
- `agents/nf-diagnostics.md` -- agent definition
- `bin/harness-diagnostics.cjs` -- diagnostic runner (consolidates existing health checks from check-provider-health.cjs, verify-quorum-health.cjs, validate-memory.cjs)
- `commands/nf/diagnostics.md` -- slash command definition

**Integration:** Triggered via `/nf:diagnostics` command. nf-prompt.js detects the command and injects diagnostic agent instructions. No quorum required (not a planning command -- does not need to be in `quorum_commands` list).

**No modifications to existing hooks.** Purely additive: new command + new agent + new script.

---

### Feature 10: Smart Compact Timing

**What:** Proactively suggest or trigger compaction before context window is exhausted, based on task complexity estimation.
**Type:** MODIFICATION to gsd-context-monitor.js

**Architecture:**

Currently gsd-context-monitor.js warns at 70% (warn) and 90% (critical). Smart compact adds:

1. **Predictive threshold:** Estimate remaining work from STATE.md (how many phases left, current phase complexity). If estimated tokens needed > remaining tokens, warn earlier.
2. **Pre-compact state save:** At the new predictive threshold, automatically write a snapshot to `.claude/pre-compact-state.json` with: current phase, last tool call, pending operations.
3. **Compact suggestion:** Inject "Consider running /compact now -- estimated remaining work may exceed available context" at the predictive threshold.

The predictive model is simple: `estimated_remaining = (phases_remaining / phases_completed) * tokens_used_so_far`. No ML needed.

**Files modified:**
- `hooks/gsd-context-monitor.js` -- add predictive threshold calculation, pre-compact state write
- `hooks/config-loader.js` -- add `smart_compact: { enabled: true, safety_margin_pct: 15 }` to DEFAULT_CONFIG

**Data flow change:** gsd-context-monitor.js reads .planning/STATE.md (new read dependency). Writes .claude/pre-compact-state.json (new write).

---

## Component Boundaries

| Component | Responsibility | Reads | Writes | Modified By Features |
|-----------|---------------|-------|--------|---------------------|
| config-loader.js | Config merge + validation | nf.json (global + project) | - | 1, 2, 3, 8, 10 |
| nf-prompt.js | Quorum injection, circuit breaker recovery, pending tasks | config, prompt text, pending-task files, token-usage.jsonl (new) | conformance-events.jsonl | 1, 3 |
| nf-stop.js | Quorum verification gate | config, transcript, ~/.claude.json | conformance-events.jsonl | 1 |
| nf-circuit-breaker.js | Oscillation detection + secret scan (new) | config, git history, state file, staged files (new) | circuit-breaker-state.json | 5 |
| gsd-context-monitor.js | Context window warnings + stall detection (new) + smart compact (new) | config, context_window payload, STATE.md (new) | stall-detector-state.json (new), pre-compact-state.json (new) | 8, 10 |
| nf-precompact.js | Compaction context injection | STATE.md, pending tasks, conformance-events.jsonl (new), config (new) | - | 4 |
| nf-token-collector.js | Token tracking | subagent transcript | token-usage.jsonl | - (data producer for Feature 3) |
| quorum-slot-dispatch.cjs | Prompt build + output parse + cache (new) | config, artifact, requirements, cache (new) | quorum-cache.json (new) | 2 |
| update-scoreboard.cjs | Score tracking + pass@k (new) | scoreboard.json, conformance data | scoreboard.json | 6 |
| nf-session-start.js | Secret sync, memory validation | secrets, memory | ~/.claude.json | - (unchanged) |

## Data Flow Changes

### Current Data Flow
```
User prompt -> nf-prompt.js (inject quorum instructions)
            -> Claude executes quorum -> slot-workers -> quorum-slot-dispatch.cjs
            -> Claude delivers output -> nf-stop.js (verify quorum evidence)
            -> nf-token-collector.js (record tokens per slot)
            -> gsd-context-monitor.js (check context window on each tool use)
```

### New Data Flow (with all 10 features)
```
User prompt -> nf-prompt.js:
                 1. Parse --profile flag (Feature 1)
                 2. Load config with profile overlay (Feature 1)
                 3. Check budget against token-usage.jsonl (Feature 3)
                 4. Existing: circuit breaker recovery, pending task, quorum injection
            -> Claude executes quorum:
                 - quorum-slot-dispatch.cjs checks cache (Feature 2)
                 - On cache hit: skip dispatch, return cached result
                 - On cache miss: dispatch normally, write to cache
            -> Claude delivers output -> nf-stop.js (verify, profile-aware)
            -> nf-token-collector.js (record tokens)
            -> update-scoreboard.cjs (merge-wave + pass@k calculation) (Feature 6)
            -> gsd-context-monitor.js:
                 - Existing: context window warnings
                 - Stall detection with state file (Feature 8)
                 - Smart compact prediction from STATE.md (Feature 10)
            -> nf-circuit-breaker.js:
                 - Existing: oscillation detection
                 - Secret scan on git operations (Feature 5)

On compaction:
            -> nf-precompact.js:
                 - Existing: STATE.md + pending tasks
                 - Enhanced: conformance history, profile, budget, breaker state (Feature 4)

On demand:
            -> /nf:diagnostics -> harness-diagnostics.cjs (Feature 9)

Maintenance:
            -> bin/lint-codebase.cjs (Feature 7) -- offline, not in hook path
```

## New File Inventory

| File | Feature | Type | Purpose |
|------|---------|------|---------|
| `.planning/quorum-cache.json` | 2 | Data (gitignored) | Cached quorum results |
| `.claude/stall-detector-state.json` | 8 | State (gitignored) | Rolling window of recent tool calls |
| `.claude/pre-compact-state.json` | 10 | State (gitignored) | Snapshot for smart compaction |
| `bin/harness-diagnostics.cjs` | 9 | Script | Consolidated diagnostic runner |
| `bin/lint-codebase.cjs` | 7 | Script | Codebase lint/cleanup tool |
| `agents/nf-diagnostics.md` | 9 | Agent def | Diagnostic agent definition |
| `commands/nf/diagnostics.md` | 9 | Command | /nf:diagnostics slash command |

**Modified files count by feature:**

| Feature | config-loader | nf-prompt | nf-stop | nf-circuit-breaker | gsd-context-monitor | nf-precompact | quorum-slot-dispatch | update-scoreboard |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1. Profiles | X | X | X | | | | | |
| 2. Cache | X | | | | | | X | |
| 3. Budget | X | X | | | | | | |
| 4. State Reminder | | | | | | X | | |
| 5. Security | | | | X | | | | |
| 6. Pass@k | | | | | | | | X |
| 7. Cleanup | | | | | | | | |
| 8. Stall | X | | | | X | | | |
| 9. Diagnostics | | | | | | | | |
| 10. Smart Compact | X | | | | X | | | |

**Conflict zones:**
- `config-loader.js`: 5 features touch it -- build Feature 1 first, rest add keys incrementally
- `gsd-context-monitor.js`: Features 8 and 10 both modify -- build 8 first (simpler), then 10
- `nf-prompt.js`: Features 1 and 3 both modify -- build 1 first (config foundation), then 3

## Suggested Build Order

Build order is driven by three constraints:
1. **Foundation first:** Config changes (Feature 1) are consumed by most other features
2. **Data producers before consumers:** Token tracking exists, budget reads it (Feature 3)
3. **Same-file conflicts:** Features touching the same file should be sequenced

### Phase 1: Foundation (config + cleanup)
1. **Feature 1: Hook Profiles** -- config-loader.js change that all other config-dependent features build on
2. **Feature 7: De-Sloppify Cleanup** -- standalone, no deps, reduces noise for subsequent work

**Rationale:** Profiles change the config loading path. Every subsequent feature that adds config keys benefits from the profile system existing first. Cleanup is independent and reduces friction.

### Phase 2: Data Pipeline (caching + metrics)
3. **Feature 2: Quorum Caching** -- depends on config (Feature 1 for cache TTL config)
4. **Feature 6: Pass@k Metrics** -- depends on nothing new, reads existing conformance data

**Rationale:** Cache and metrics are independent of each other but both benefit from clean config. Can be parallelized.

### Phase 3: Runtime Intelligence (budget + stall + compact)
5. **Feature 3: Budget-Aware Downgrade** -- depends on config (Feature 1), reads token-usage.jsonl
6. **Feature 8: Stall Detection** -- depends on config (Feature 1), modifies gsd-context-monitor.js
7. **Feature 10: Smart Compact Timing** -- depends on config (Feature 1), modifies same file as Feature 8

**Rationale:** Features 8 and 10 both modify gsd-context-monitor.js. Build 8 first (simpler: tool call pattern matching), then 10 (more complex: STATE.md parsing + prediction). Feature 3 can parallelize with 8.

### Phase 4: Safety + State + Diagnostics
8. **Feature 5: Security Sweep** -- depends on nothing new, modifies nf-circuit-breaker.js
9. **Feature 4: Session State Reminder** -- depends on Features 1, 3 existing (reads their data)
10. **Feature 9: Harness Diagnostic Agent** -- depends on everything existing (tests all components)

**Rationale:** Feature 9 goes last because it diagnoses all other features. Building it last means it can test the full stack. Feature 4 reads data produced by earlier features (conformance, budget, profile).

### Dependency Graph
```
Feature 1 (Profiles) ─────────────────────────────────┐
Feature 7 (Cleanup)  ── parallel with 1 ──────────────┤
                                                       v
Feature 2 (Cache)    ── depends on 1 (config) ────────┐
Feature 6 (Pass@k)   ── parallel with 2 ──────────────┤
                                                       v
Feature 3 (Budget)   ── depends on 1 (config) ────────┐
Feature 8 (Stall)    ── depends on 1, same file as 10 ┤
Feature 10 (Compact) ── depends on 1, after 8 ────────┤
                                                       v
Feature 5 (Security) ── independent ──────────────────┐
Feature 4 (State)    ── reads data from 1, 3 ─────────┤
Feature 9 (Diagnostics) ── tests everything ───────────┘
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding New Hook Files
**What:** Creating new .js files in hooks/ for each feature
**Why bad:** Each new hook file requires install.js updates, dist/ sync, increases startup overhead (every hook runs on its event type regardless), and complicates the install chain
**Instead:** Integrate new logic into existing hooks at the appropriate event type. The existing 9 hooks already cover all Claude Code hook events. Add features as new code paths within existing hooks.

### Anti-Pattern 2: Cross-Hook State Sharing via Files
**What:** Having hooks write state files that other hooks read in the same event cycle
**Why bad:** Hook execution order within the same event type is undefined. Two hooks reading/writing the same state file can race.
**Instead:** Each hook should own its state files exclusively. If data must flow between hooks, use the conformance-events.jsonl append-only log (already established pattern) and have the consumer read it.

### Anti-Pattern 3: Blocking I/O in Hot Paths
**What:** Adding child_process.spawnSync calls in hooks that fire on every tool use (PostToolUse)
**Why bad:** PostToolUse fires potentially hundreds of times per session. A 50ms spawn adds up to seconds of overhead.
**Instead:** Keep PostToolUse hooks (gsd-context-monitor.js) pure: read input JSON + fs reads only. No child processes. Save expensive checks for less frequent hooks (UserPromptSubmit, Stop).

### Anti-Pattern 4: Deep Config Nesting
**What:** Adding deeply nested config objects that require recursive merge
**Why bad:** config-loader.js uses shallow spread (`{ ...DEFAULT, ...global, ...project }`). Nested objects are fully replaced, not deep-merged. This is documented and intentional.
**Instead:** Use flat keys (like existing `model_tier_planner`, `model_tier_worker`) or accept that project config fully replaces global for any nested object. The profile system (Feature 1) must account for this -- profile values override at the same shallow level.

## Patterns to Follow

### Pattern 1: Fail-Open Guard Chain
**What:** Every new feature added to a hook must follow the existing guard chain pattern
**When:** Always, for any hook modification
**Example:**
```javascript
// Feature check is wrapped in try/catch, fails open
try {
  const budgetResult = checkBudget(config, cwd);
  if (budgetResult.overBudget) {
    // Modify config in-memory, add warning to additionalContext
  }
} catch (_) {
  // Budget check failed -- proceed without downgrade (fail-open)
}
```

### Pattern 2: Config Key + DEFAULT_CONFIG + Validation
**What:** Every new config key must appear in all three places
**When:** Adding any feature with configurable behavior
**Example:**
```javascript
// 1. DEFAULT_CONFIG
const DEFAULT_CONFIG = {
  // ... existing keys
  budget: { daily_token_limit: 500000, downgrade_at_pct: 80 },
};

// 2. validateConfig() -- validate and correct
if (typeof config.budget !== 'object') {
  config.budget = { ...DEFAULT_CONFIG.budget };
}

// 3. Usage in hook -- always access via config, never hardcode
const limit = config.budget.daily_token_limit;
```

### Pattern 3: JSONL Append for Observational Data
**What:** Use JSONL append (not JSON read-modify-write) for high-frequency data
**When:** Logging events, token tracking, conformance records
**Example:** token-usage.jsonl, conformance-events.jsonl. Atomic for writes < 4096 bytes (POSIX PIPE_BUF). No locking needed. Consumers sum/filter at read time.

### Pattern 4: Install Chain Awareness
**What:** Any file in hooks/ or bin/ that changes must be synced through the install chain
**When:** Every modification to hook or bin files
**Pattern:** `cp hooks/modified-file.js hooks/dist/ && node bin/install.js --claude --global`

## Scalability Considerations

| Concern | At 10 sessions/day | At 100 sessions/day | At 1000 sessions/day |
|---------|---------------------|----------------------|----------------------|
| token-usage.jsonl size | ~50KB/day | ~500KB/day | ~5MB/day -- needs rotation |
| quorum-cache.json | ~100 entries | ~1000 entries -- needs TTL cleanup | Needs size cap + LRU eviction |
| stall-detector-state.json | No issue (rolling window) | No issue | No issue (fixed-size window) |
| conformance-events.jsonl | ~20KB/day | ~200KB/day | ~2MB/day -- needs rotation |

**Recommendation:** Add a `bin/rotate-logs.cjs` script that rotates JSONL files > 10MB. Run it from nf-session-start.js (fires once per session, low overhead).

## Sources

- config-loader.js source (hooks/config-loader.js) -- direct code inspection, HIGH confidence
- nf-prompt.js source (hooks/nf-prompt.js) -- direct code inspection, HIGH confidence
- nf-stop.js source (hooks/nf-stop.js) -- direct code inspection, HIGH confidence
- nf-precompact.js source (hooks/nf-precompact.js) -- direct code inspection, HIGH confidence
- gsd-context-monitor.js source (hooks/gsd-context-monitor.js) -- direct code inspection, HIGH confidence
- nf-token-collector.js source (hooks/nf-token-collector.js) -- direct code inspection, HIGH confidence
- nf-circuit-breaker.js source (hooks/nf-circuit-breaker.js) -- direct code inspection, HIGH confidence
- quorum-slot-dispatch.cjs source (bin/quorum-slot-dispatch.cjs) -- direct code inspection, HIGH confidence
- update-scoreboard.cjs source (bin/update-scoreboard.cjs) -- direct code inspection, HIGH confidence
- nf-session-start.js source (hooks/nf-session-start.js) -- direct code inspection, HIGH confidence
