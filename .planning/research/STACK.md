# Stack Research: Agent Harness Optimization

**Domain:** Hook profiles, content-hash caching, budget-aware downgrade, session state reminder, security sweep, pass@k metrics, stall detection, harness diagnostics, smart compact timing
**Researched:** 2026-03-06
**Overall Confidence:** HIGH

## Foundational Constraint: Zero External Dependencies for Hooks

nForma hooks are standalone Node.js CJS scripts spawned by Claude Code via stdin/stdout IPC. They use **only Node.js built-ins** (`fs`, `path`, `os`, `crypto`, `child_process`, `https`). This is a hard architectural constraint: hooks ship to `~/.claude/hooks/` and must work immediately after install without native compilation or network-fetched packages.

Every recommendation below uses Node.js built-ins exclusively. No new `npm install` required.

**Runtime:** Node.js >= 16.7.0 (package.json `engines`). Dev environment: Node 25.6.1.

---

## Recommended Stack

### 1. Content-Hash Caching (Quorum Response Cache)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node:crypto` (sha256) | Built-in | Content fingerprinting for quorum cache keys | Already used in `fingerprint-issue.cjs` (sha256) and `nf-circuit-breaker.js` (sha1). SHA-256 is the right choice: collision-resistant, consistent with existing fingerprint patterns, and fast enough (< 1ms for typical prompt content). |
| `node:fs` (JSON file) | Built-in | Cache storage at `.planning/quorum-cache.json` | JSONL is the project pattern for append-only logs (token-usage, conformance-events). Cache needs key lookup, so a keyed JSON object `{ [hash]: { verdict, reasoning, ts, ttl_hours } }` is correct. File stays small because entries are keyed by content hash -- deduplication is intrinsic. |

**Cache key construction:** Hash the tuple `(question_text, artifact_content_hash, sorted_slot_names, mode)` into a single sha256 digest. This captures everything that affects the quorum response, matching how `quorum-slot-dispatch.cjs` builds prompts.

**Implementation point:** `bin/quorum-slot-dispatch.cjs`. Before spawning slot calls, compute cache key from inputs. If cache hit with unexpired TTL, return cached verdict directly. On cache miss, dispatch normally and write result to cache.

**Why NOT SQLite/LevelDB/Redis:** Adds native dependencies. The cache is small -- hundreds of entries at most (one per unique quorum question). A JSON file read into memory, checked, and written back is simpler and fits the existing pattern.

### 2. Budget Tracking and Downgrade

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node:fs` (readFileSync) | Built-in | Sum costs from `.planning/token-usage.jsonl` | `nf-token-collector.js` already writes per-slot token records with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`. Add `cost_usd` computed from a static pricing table. No new file needed -- extend the existing JSONL schema. |
| `config-loader.js` (extended) | Existing | New config keys for budget limits and pricing | Two-layer merge already works. Add flat keys to avoid nested-object shallow-merge loss. |

**Cost calculation approach:** Static pricing table in `nf.json`, NOT live API calls. Provider pricing changes infrequently. A config-based table means: (1) no network calls in hot path, (2) user can override for custom providers (AkashML, Together.xyz, Fireworks), (3) works offline.

**Budget enforcement point:** `nf-prompt.js` (UserPromptSubmit hook). Before building quorum steps, sum today's costs from token-usage.jsonl, compare against `budget_daily_limit_usd`. If over threshold percentage, downgrade `model_tier_planner` from opus to sonnet and `model_tier_worker` from sonnet to haiku. This is the right hook because it runs before every quorum dispatch and already reads config.

**Why NOT a separate budget daemon:** Hooks are stateless processes. Reading a JSONL file and summing today's costs is O(n) on line count but n is small (a few hundred lines per day at most). A daemon adds process management complexity for no benefit.

### 3. Hook Profiles

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `config-loader.js` (extended) | Existing | New config key: `hook_profile` | Profiles control which hooks run. Each hook checks `config.hook_profile` on startup and exits(0) immediately if its category is disabled for that profile. |

**Profile definitions:**

| Profile | Active Hooks | Use Case |
|---------|-------------|----------|
| `full` (default) | All 10 hooks | Normal operation, current behavior |
| `fast` | nf-prompt, nf-stop, nf-circuit-breaker, gsd-context-monitor, nf-security-scan | Quick iterations -- skip spec-regen, token-collector, precompact state, statusline |
| `minimal` | nf-prompt, nf-stop | Bare quorum enforcement only -- fastest possible |

**Why self-gating instead of dynamic hook registration:** Claude Code hook registration is in `~/.claude.json` which is static JSON set at install time. There is no API to dynamically enable/disable hooks at runtime. Each hook must check its own profile gate. This is a 3-line check at the top of each hook's stdin handler:

```javascript
const { loadConfig } = require('./config-loader');
const config = loadConfig(input.cwd);
if (config.hook_profile === 'minimal' && !['nf-prompt', 'nf-stop'].includes('THIS_HOOK')) process.exit(0);
```

### 4. Security Scanning

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Regex pattern set | Custom CJS module | Fast secret pattern matching in PostToolUse | Patterns for: AWS keys (`AKIA[0-9A-Z]{16}`), GitHub tokens (`gh[ps]_[A-Za-z0-9_]{36,}`), generic high-entropy base64 > 20 chars, PEM private keys. This is the approach used by gitleaks and detect-secrets -- nForma needs only the regex subset, not the full tools. |
| Shannon entropy (pure JS) | Custom | Entropy analysis for generic secret detection | Calculate `-sum(p * log2(p))` over character frequency distribution. Strings with entropy > 4.5 bits/char and length > 20 are likely secrets. Pure math, no library needed. |
| `node:child_process` (execSync) | Built-in | Optional: shell out to `gitleaks` if installed | Project already has gitleaks configured (`.gitleaks.toml`, `npm run secrets:gitleaks`). For deep scanning, delegate to existing tooling. For hot-path hook scanning, use the lightweight regex + entropy approach. |

**Implementation hook:** PostToolUse. Check `tool_result` content for secret patterns. If found, inject a WARNING via `additionalContext` telling Claude not to echo the value. This mirrors the `gsd-context-monitor.js` pattern exactly.

**Why NOT trufflehog/detect-secrets as runtime deps:** Python tools. Adding Python as a runtime dependency breaks the zero-dep constraint. The regex approach catches 95% of accidental leaks. Deep audits use the existing `npm run secrets:gitleaks`.

### 5. Stall Detection

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node:fs` (statSync) | Built-in | Check file modification times | If no file in `.planning/` has been modified in N minutes while tool calls continue, the session may be stalled (spinning without progress). |
| `Date.now()` | Built-in | Timestamp comparison | Compare current time against last `.planning/` modification. No time libraries needed. |

**Implementation:** PostToolUse hook (extend `gsd-context-monitor.js` or new `nf-stall-detector.js`). On each PostToolUse event, scan `.planning/` for most recent `mtimeMs`. If gap exceeds configurable threshold (default 10 minutes) AND tool calls are happening (the hook is firing), inject stall advisory.

### 6. Smart Compact Timing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `context_window.remaining_percentage` | Hook input payload | Already available in PostToolUse events | `gsd-context-monitor.js` already reads this. Smart compact extends the logic: add task-awareness by reading STATE.md and checking plan progress. |

**Implementation:** Extend `gsd-context-monitor.js` with graduated responses:

| Context Used | Current Behavior | New Behavior |
|-------------|-----------------|-------------|
| 70-84% | WARNING | WARNING + suggest saving state if mid-plan |
| 85-89% | WARNING | Recommend `/nf:pause-work` proactively |
| 90%+ | CRITICAL | CRITICAL (unchanged) |

The 85% tier is new. It reads STATE.md (same pattern as `nf-precompact.js`) to determine if a plan is in progress before recommending pause.

### 7. Session State Reminder

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node:fs` (readFileSync) | Built-in | Read STATE.md and active PLAN.md | On session start or after compaction, remind Claude of current execution state. |

**Implementation:** Extend `nf-precompact.js` (PreCompact hook). Currently injects `## Current Position` from STATE.md. Add: active plan step detection (parse PLAN.md for current checked/unchecked items), pending quorum results, and budget status. This is purely extending existing code, not new infrastructure.

### 8. Pass@k Metrics

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node:fs` | Built-in | Read quorum dispatch results | Pass@k = "of k slots dispatched, how many returned the correct/agreeing verdict." Data already exists in quorum output. |

**Implementation:** Add pass@k computation to `bin/update-scoreboard.cjs`. After each quorum round, record `{ k: slots_dispatched, pass: agreeing_count, pass_at_k: agreeing_count / slots_dispatched }`. This is a pure math addition to existing scoreboard code -- no new files needed.

### 9. Harness Diagnostics Agent

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node:fs` | Built-in | Read scoreboard, token-usage.jsonl, conformance-events.jsonl | Diagnostic agent is a command/workflow, not a hook. Reads existing observability files and produces a structured report. |
| `node:child_process` (execSync) | Built-in | Run `node bin/check-mcp-health.cjs` for live provider health | Reuse existing health-check tooling rather than reimplementing. |

**Implementation:** New command `commands/nf/diagnose-harness.md` + workflow `core/workflows/diagnose-harness.md`. NOT a hook -- diagnostics are user-triggered. The workflow reads all observability files, computes metrics (avg latency, failure rate per slot, budget burn rate, pass@k trend), and outputs a structured report.

---

## Config Changes (config-loader.js)

New flat keys to add to `DEFAULT_CONFIG`:

```javascript
// Hook profiles
hook_profile: 'full',                    // 'full' | 'fast' | 'minimal'

// Budget tracking
budget_daily_limit_usd: 0,              // 0 = unlimited (no enforcement)
budget_downgrade_threshold_pct: 80,     // downgrade model tier at 80% of daily limit
budget_pricing: {},                      // { "model-id": { input_per_mtok: N, output_per_mtok: N } }

// Stall detection
stall_detection_minutes: 10,            // 0 = disabled

// Quorum cache
quorum_cache_ttl_hours: 24,             // content-hash cache TTL
quorum_cache_enabled: true,             // master switch

// Security scanning
security_scan_enabled: true,            // PostToolUse secret detection
security_scan_entropy_threshold: 4.5,   // Shannon entropy bits/char threshold
```

All flat keys (not nested objects) because config-loader.js uses `{ ...DEFAULT_CONFIG, ...global, ...project }` shallow spread. The existing validation pattern in `validateConfig()` handles each key independently with type checks and stderr warnings.

---

## New Files

| File | Type | Purpose |
|------|------|---------|
| `bin/budget-check.cjs` | Utility (imported) | Sum today's costs from token-usage.jsonl, compare against limits. Exported function, imported by `nf-prompt.js`. |
| `bin/secret-patterns.cjs` | Utility (imported) | Regex patterns + Shannon entropy calculator. Exported functions, imported by security hook. |
| `hooks/nf-security-scan.js` | PostToolUse hook | Scan tool output for secret patterns. Inject WARNING via additionalContext. |
| `commands/nf/diagnose-harness.md` | Command definition | `/nf:diagnose-harness` command registration. |
| `core/workflows/diagnose-harness.md` | Workflow | Reads observability files, computes metrics, outputs report. |
| `.planning/quorum-cache.json` | Cache (gitignored) | Content-hash keyed quorum response cache. |

---

## Hook Registration Changes (install.js)

New hooks to register in `~/.claude.json`:

| Hook File | Event Type | Purpose |
|-----------|-----------|---------|
| `nf-security-scan.js` | PostToolUse | Secret detection in tool output |

No new hook event types needed. All features fit into existing types:
- **UserPromptSubmit:** Budget check + downgrade (extends `nf-prompt.js`)
- **PostToolUse:** Security scan (new hook), stall detection (extends `gsd-context-monitor.js`), smart compact (extends `gsd-context-monitor.js`)
- **PreCompact:** Session state reminder (extends `nf-precompact.js`)
- **SubagentStop:** Pass@k + cache write (extends `nf-token-collector.js` or `update-scoreboard.cjs`)

---

## What NOT to Add

| Category | Rejected Option | Why Not |
|----------|----------------|---------|
| Database | SQLite, LevelDB, Redis | Zero-dep constraint. JSON/JSONL files are sufficient for data volumes (< 10K records/day). |
| HTTP framework | Express, Fastify | No HTTP server needed. All hooks are stdin/stdout processes. |
| Logging library | Winston, Pino, Bunyan | `process.stderr.write()` is the established pattern. Structured logging would require consumers -- there are none. |
| Schema validation | Ajv, Zod, Joi | `validateConfig()` in config-loader.js is hand-rolled and works. Adding a schema library for flat config keys is over-engineering. |
| Cron/scheduler | node-cron | Budget checks happen inline at prompt time. No periodic tasks needed. |
| Test framework | Jest, Vitest | Project uses `node:test` (built-in). Do not introduce a second test runner. |
| Secret scanning lib | trufflehog, detect-secrets (runtime) | Python dependencies. Use regex patterns for hot-path, existing `gitleaks` CLI for deep audits. |
| Content hashing | xxhash, murmurhash | `crypto.createHash('sha256')` is fast enough (< 1ms). Non-cryptographic hashes save microseconds but add a dependency. |
| Config format | YAML, TOML | Project uses JSON exclusively (nf.json, requirements.json, providers.json). Do not introduce a second config format. |
| Cache eviction lib | lru-cache, node-cache | Cache is small (< 1000 entries). Manual TTL check on read + periodic prune is simpler than a library. |
| Time library | dayjs, luxon, moment | `Date.now()` and `new Date().toISOString()` cover all needs. Budget sums use JSONL timestamps parsed with `new Date(ts)`. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Cache key hashing | sha256 (node:crypto) | xxhash via wasm | Adds wasm binary. sha256 is < 1ms for prompt-sized text. |
| Cache storage | JSON file | JSONL append log | Cache needs key lookup (is this hash cached?). JSONL requires full scan. JSON object has O(1) lookup after parse. |
| Budget enforcement | Inline in nf-prompt.js | Separate budget-gate hook | Adding another hook means another process spawn per prompt. Inline check in existing hook is zero-cost. |
| Profile gating | Self-gate in each hook | Dynamic ~/.claude.json rewrite | Rewriting claude.json at runtime is fragile and requires re-registering hooks. Self-gating is stateless and safe. |
| Secret detection | Regex + entropy | ML-based classifier | No model inference in hooks. Regex + entropy catches AWS keys, GitHub tokens, PEM keys, generic high-entropy strings. Good enough for hot path. |
| Stall detection | File mtime check | Heartbeat file | Heartbeat requires a writer (another process). File mtime check is passive -- reads existing files. |

---

## Installation

No new `npm install` commands needed. All features use Node.js built-ins.

```bash
# After implementing, rebuild hooks for distribution
npm run build:hooks

# Reinstall to update ~/.claude/hooks/ with new hooks
node bin/install.js --claude --global
```

---

## Sources

- Existing codebase patterns verified by reading source:
  - `hooks/config-loader.js` — two-layer merge, flat keys, validation pattern
  - `hooks/nf-circuit-breaker.js` — sha1 hashing via `crypto.createHash()`
  - `bin/fingerprint-issue.cjs` — sha256 hashing for content addressing
  - `hooks/gsd-context-monitor.js` — PostToolUse `additionalContext` injection pattern
  - `hooks/nf-token-collector.js` — JSONL append, per-slot token records
  - `hooks/nf-precompact.js` — PreCompact STATE.md reading pattern
  - `bin/quorum-slot-dispatch.cjs` — prompt construction, slot dispatch
  - `package.json` — zero runtime deps for hooks (confirmed: all deps are for TUI/terminal, not hooks)
- Node.js crypto module (built-in, verified on Node 25.6.1)
- Node.js fs module (statSync, readFileSync, appendFileSync -- all used elsewhere in codebase)
- gitleaks configuration present at `.gitleaks.toml` with npm scripts `secrets:gitleaks`, `secrets:scan`
