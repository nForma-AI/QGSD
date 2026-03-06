# Domain Pitfalls: Agent Harness Optimization (v0.28)

**Domain:** AI agent harness hooks — adding profiles, caching, budget tracking, security scanning, and self-diagnostics to an existing Claude Code plugin
**Researched:** 2026-03-06
**Confidence:** HIGH (based on direct codebase analysis of hooks/, config-loader.js, install.js, and 26 shipped milestones)

---

## Critical Pitfalls

Mistakes that cause session crashes, data loss, or silent behavioral regression.

### Pitfall 1: Shallow Merge Destroys Nested Profile Config

**What goes wrong:** Hook profiles (minimal/standard/strict) naturally suggest a nested config structure like `profiles: { minimal: { ... }, standard: { ... } }`. The config-loader uses shallow spread (`{ ...DEFAULT_CONFIG, ...global, ...project }`). Any nested object in project config entirely replaces the global value — a project-level `profiles` key with one field wipes all other profile fields from global config.

**Why it happens:** The config-loader was designed for flat keys. The comment at line 83 of config-loader.js explicitly warns: "Flat keys required -- nested objects lost in shallow merge." Every nested config addition in the past (circuit_breaker, context_monitor, quorum) required per-field fallback validation. Developers forget this and add nested structures assuming deep merge.

**Consequences:** Users with global nf.json profiles who set a project-level override lose all unset profile fields. Hooks read incomplete config, fall back to defaults unpredictably. Worst case: strict profile degrades to minimal silently.

**Prevention:**
- Use flat keys for profile selection: `hook_profile: "standard"` (not nested profile definitions)
- Profile definitions should be hardcoded in the hook code itself, not user-configurable nested objects
- If nested config is unavoidable, add per-field fallback logic in `validateConfig()` like circuit_breaker already does (lines 124-160)

**Detection:** Add a test that loads config with partial project override and verifies no field loss. Pattern exists in config-loader.test.js already.

**Phase:** Must be addressed in the hook profiles phase (Phase 1). Getting this wrong contaminates every subsequent feature.

---

### Pitfall 2: Cache Invalidation Serving Stale Quorum Decisions

**What goes wrong:** Content-hash caching for quorum responses sounds efficient — same prompt hash = reuse cached votes. But quorum context includes dynamic state: provider health, scoreboard stats, availability windows, recent conformance events. Two identical prompts at different times should produce different quorum outcomes because the system state changed.

**Why it happens:** The hash key captures prompt content but misses ambient state. The existing provider cache (`nf-provider-cache.json`) already demonstrates this: it uses TTL-based expiry (cache entries have `cachedAt` timestamps checked against a TTL, visible in nf-prompt.js lines 268-284). A content-hash cache without similar TTL or state-sensitivity will serve stale decisions.

**Consequences:** Quorum votes from 30 minutes ago (when Gemini was healthy) get replayed when Gemini is now in quota cooldown. Worse: cached APPROVE decisions bypass the structural enforcement guarantee — the Stop hook sees tool_call evidence in the transcript and passes, but the actual quorum reasoning is stale.

**Prevention:**
- Hash key MUST include: prompt content + quorum_active slot list + provider health snapshot hash + timestamp bucket (e.g., 15-minute windows)
- Add mandatory TTL with conservative default (10-15 minutes max)
- Cache hits should still log a conformance event with `cache_hit: true` so the diagnostic agent can detect over-caching
- Never cache BLOCK decisions — those represent problems that need fresh evaluation

**Detection:** If conformance-events.jsonl shows repeated identical `quorum_complete` events with zero token usage, cache is serving stale decisions.

**Phase:** Quorum caching phase (Phase 2). Must be designed together with budget-aware downgrade to avoid caching at the wrong tier.

---

### Pitfall 3: Budget Tracker Race Condition Across Concurrent Hooks

**What goes wrong:** Multiple hooks fire per turn (nf-prompt on UserPromptSubmit, nf-circuit-breaker on PreToolUse, gsd-context-monitor on PostToolUse, nf-stop on Stop, nf-token-collector on SubagentStop). If the budget tracker writes to a shared state file (e.g., `.claude/budget-state.json`), concurrent hook processes can race on read-modify-write.

**Why it happens:** Claude Code hooks run as separate Node.js processes (not threads). There is no shared memory. The existing codebase uses `appendFileSync` for JSONL logs (atomic for writes < POSIX PIPE_BUF = 4096 bytes, documented in nf-prompt.js line 49) but full JSON files require read-parse-modify-write which is NOT atomic.

**Consequences:** Budget counter resets, double-counts tokens, or triggers premature downgrade. A race between nf-token-collector (writing token usage) and the budget-aware downgrade hook (reading cumulative usage) can cause the downgrade to fire based on partial data.

**Prevention:**
- Use append-only JSONL for budget events (same pattern as token-usage.jsonl and conformance-events.jsonl)
- Budget calculation should be a read-time aggregation (sum the JSONL) not a stateful counter
- If a running total is needed for performance, use `fs.renameSync` for atomic swap (same pattern as `consumePendingTask` in nf-prompt.js line 78)
- Alternatively, have ONE hook own the budget state exclusively (nf-token-collector is the natural owner since it already tracks all token usage)

**Detection:** Budget total that does not match `sum(token-usage.jsonl)` indicates a race. Add a reconciliation check in the diagnostic agent.

**Phase:** Budget-aware downgrade phase (Phase 3). Must be implemented AFTER token collector enhancements, not before.

---

### Pitfall 4: Stdout Pollution Crashes Hook Protocol

**What goes wrong:** A new feature (diagnostic agent, security scanner) writes informational output to stdout. The Claude Code hook protocol uses stdout exclusively for the JSON decision payload. Any non-JSON bytes on stdout — even a stray `console.log` — corrupt the hook response and crash the session.

**Why it happens:** Every existing hook has the comment "NEVER writes to stdout — stdout is the Claude Code hook decision channel" but new developers or new code paths (especially shelling out to external tools like `detect-secrets` or `gitleaks`) inherit stdout from the parent process. The security sweep calling `gitleaks` via `spawnSync` with `stdio: 'inherit'` would dump scanner output to the hook's stdout.

**Consequences:** Session crash. Claude Code receives malformed JSON from the hook and may kill the session or enter an undefined state. This is not a soft failure — it is a hard crash.

**Prevention:**
- All `spawnSync`/`execFileSync` calls in hooks MUST use `stdio: 'pipe'` (never 'inherit')
- Add a lint rule or test that greps hook source files for `console.log` and `stdio: 'inherit'` — fail the build if found
- Wrap all hook entry points in a top-level try/catch that writes errors to stderr and exits 0 (fail-open pattern already used in all existing hooks)
- The security sweep should run as a bin/ script called during verify-phase workflow, NOT as a hook

**Detection:** If users report "hook crashed my session," check for stdout pollution first.

**Phase:** Applies to ALL phases. Add the lint guard in Phase 1 and enforce it throughout.

---

### Pitfall 5: Install Sync Desynchronization

**What goes wrong:** Developer edits hook source in `hooks/nf-*.js`, tests pass locally (tests require from `hooks/`), but forgets to copy to `hooks/dist/` and run `node bin/install.js --claude --global`. The installed copy at `~/.claude/hooks/` is stale. New features appear to work in tests but are absent in actual sessions.

**Why it happens:** The three-stage pipeline (hooks/ -> hooks/dist/ -> ~/.claude/hooks/) has no automated sync. The memory doc explicitly calls this out: "Install sync required: source -> hooks/dist/ -> ~/.claude/hooks/". The build:hooks script exists but is only run on prepublishOnly, not on every change.

**Consequences:** Silent feature absence. Developer thinks hook profiles are active but the installed hook is the old version. Debugging is extremely confusing because tests pass and source looks correct.

**Prevention:**
- Every phase plan that modifies hook files MUST include an explicit install sync task as the final step
- Consider adding a version hash to each hook file (e.g., `const HOOK_VERSION = 'v0.28.1'`) and having nf-session-start.js compare installed vs source versions on startup, warning on mismatch
- The diagnostic agent should check for source/installed version drift as one of its first checks

**Detection:** `diff hooks/nf-prompt.js hooks/dist/nf-prompt.js` shows differences = desync. Automate this check.

**Phase:** Phase 1 should add the version hash mechanism. Every subsequent phase must include install sync in its plan.

---

## Moderate Pitfalls

### Pitfall 6: Profile Switch Mid-Session Causes Inconsistent Enforcement

**What goes wrong:** User switches from `strict` to `minimal` profile mid-session. The prompt hook reads the new profile on next prompt, but the stop hook still has the old profile's expectations cached from its previous invocation (hooks are separate processes, no shared state). Result: prompt injects minimal quorum instructions but stop hook still expects full quorum evidence.

**Prevention:**
- Profiles must be stateless — each hook invocation reads the profile fresh from config (loadConfig already does this, so the risk is low IF profile selection is config-driven)
- Never cache profile selection in a state file between hook invocations
- Document that profile changes take effect on next prompt (not retroactively on current turn)

**Phase:** Hook profiles (Phase 1).

---

### Pitfall 7: Security Scanner False Positives Block Legitimate Work

**What goes wrong:** The security sweep in verify-phase flags base64-encoded test fixtures, example API keys in documentation, or hash constants as "leaked secrets." Developer has to manually dismiss dozens of false positives, eroding trust in the feature.

**Why it happens:** Generic secret scanners (gitleaks, detect-secrets) have high false-positive rates on codebases with test fixtures, formal verification models (TLA+/Alloy files contain string constants), and configuration examples.

**Prevention:**
- Use allowlisting from day one: `.gitleaks.toml` already exists in the repo (package.json line 85) — extend its allowlist with known false-positive patterns
- Scope scanning to changed files only (`git diff --name-only` against the phase's starting commit), not the entire repo
- Classify findings as CRITICAL (high-entropy strings in .env/credentials files) vs INFO (everything else) — only CRITICAL blocks the phase
- The existing `scripts/secret-audit.sh` and `bin/secrets.cjs` should be reused, not reimplemented

**Phase:** Security sweep phase (Phase 5).

---

### Pitfall 8: Diagnostic Agent Token Overhead Defeats Budget Savings

**What goes wrong:** The harness diagnostic agent is implemented as an AI agent call (Task subagent) that reads conformance logs, token usage, and provider health to produce a diagnostic report. But calling an AI model to diagnose cost issues itself costs tokens — potentially more than the savings from its recommendations.

**Prevention:**
- Implement diagnostics as a deterministic Node.js script (bin/ tool), NOT as an AI agent call
- The script should produce a structured JSON report that a human or Claude can read
- Only escalate to an AI agent call if the deterministic analysis finds anomalies that need natural-language explanation
- Set a hard token ceiling on the diagnostic agent if it must use AI (e.g., use Haiku tier, 2k max output)

**Phase:** Diagnostic agent phase (Phase 9). Design the deterministic analysis first, AI escalation second.

---

### Pitfall 9: Stall Detection False Triggers During Legitimate Long Operations

**What goes wrong:** Stall detection fires after N minutes without checkpoint progress. But some legitimate operations take a long time: formal verification (TLC can run 30+ seconds), large quorum deliberation rounds (up to 10 rounds per R3.3), or complex file generation. The stall detector escalates or interrupts a productive operation.

**Prevention:**
- Stall detection should track checkpoint TYPES, not just time since last checkpoint — a running TLC check is not a stall
- Use a heartbeat mechanism: long-running operations emit periodic "still working" signals to a state file that the stall detector reads
- Default threshold should be generous (10+ minutes for wave execution, configurable per workflow step)
- Never auto-interrupt — only surface a warning. Let the user or quorum decide to abort

**Phase:** Stall detection phase (Phase 8).

---

### Pitfall 10: Smart Compact Timing Fights Context Monitor

**What goes wrong:** Smart compact timing suggests "compact now" at workflow boundaries. But the context monitor (gsd-context-monitor.js) already injects warnings at 70% and critical at 90%. Two independent systems both advising about context usage create conflicting or redundant messages, confusing Claude.

**Prevention:**
- Smart compact timing should integrate WITH the context monitor, not beside it. Extend the existing context_monitor config with workflow-boundary awareness
- At a workflow boundary: lower the warn_pct temporarily (e.g., 60% instead of 70%) to encourage compaction at natural break points
- Single source of compaction advice: the context monitor hook, with smart timing as an input signal rather than a separate hook

**Phase:** Smart compact timing phase (Phase 10). Implement as an enhancement to gsd-context-monitor.js, not a new hook.

---

### Pitfall 11: pass@k Metric Calculation Assumes Independent Samples

**What goes wrong:** pass@k metrics (probability that at least one of k quorum samples passes) assume independent, identically distributed samples. But quorum slots are NOT independent — they share the same prompt, the same codebase context, and providers have correlated failure modes (e.g., all API-backed providers fail during a cloud outage). The metric gives false confidence.

**Prevention:**
- Document that pass@k is a proxy metric, not a rigorous statistical guarantee
- Track correlation between slot outcomes in conformance events — if slots consistently agree, the effective k is lower than nominal k
- Use pass@k as a trend indicator (is reliability improving over milestones?) not an absolute reliability guarantee
- Consider reporting both raw pass@k and correlation-adjusted pass@k

**Phase:** pass@k metrics phase (Phase 6).

---

## Minor Pitfalls

### Pitfall 12: De-sloppify Cleanup Creates Context Pollution

**What goes wrong:** Running a cleanup pass in "fresh context" after phase execution means spawning a new agent context. But the cleanup agent needs to understand what was just built — requiring it to re-read significant codebase context. This context loading partially defeats the "fresh eyes" benefit.

**Prevention:**
- Provide the cleanup agent with a focused manifest: list of files changed in the phase (from git diff) and the phase's PLAN.md
- Do NOT give it the full codebase map — scoped context only
- Set a hard time/token limit to prevent the cleanup pass from becoming more expensive than the original work

**Phase:** De-sloppify phase (Phase 7).

---

### Pitfall 13: Session State Reminder Leaks Sensitive Context

**What goes wrong:** The session-start state reminder reads STATE.md and injects it as additionalContext. If STATE.md contains task-specific details from a previous session (e.g., specific file paths with security-relevant content, API endpoint details), this leaks into the new session's context regardless of whether it's relevant.

**Prevention:**
- State reminder should inject only structural position (milestone, phase number, step) not task-specific content
- The existing nf-precompact.js already extracts only the "Current Position" section from STATE.md — reuse that same extraction function
- Never inject raw STATE.md content; always filter through `extractCurrentPosition()`

**Phase:** Session state reminder phase (Phase 4).

---

### Pitfall 14: Adding New Config Keys Without Backward Compatibility

**What goes wrong:** New features add config keys to DEFAULT_CONFIG (hook_profile, budget_limit, cache_ttl, etc.). Existing user nf.json files don't have these keys. If validation treats missing keys as errors instead of falling back to defaults, existing installations break on upgrade.

**Prevention:**
- Every new config key MUST have a default in DEFAULT_CONFIG
- Validation MUST use the pattern: `if (config.X !== undefined) { validate(config.X) }` — missing = use default, present = validate
- Add a test for each new key: load config with empty nf.json, verify default is applied
- The existing validateConfig function demonstrates the correct pattern (lines 246-265 for model_tier_planner)

**Phase:** Applies to ALL phases that add config keys. Enforce in Phase 1 code review.

---

### Pitfall 15: Hook File Count Explosion

**What goes wrong:** Each new feature becomes a new hook file: nf-budget-tracker.js, nf-diagnostic.js, nf-security-scan.js, nf-stall-detector.js. Each hook is a separate Node.js process spawned by Claude Code on every relevant event. 10+ hooks firing per turn adds measurable latency and process overhead.

**Prevention:**
- Consolidate features into existing hooks by event type:
  - UserPromptSubmit (nf-prompt.js): add profile selection, state reminder injection, cache lookup
  - PostToolUse (gsd-context-monitor.js): add smart compact timing
  - SubagentStop (nf-token-collector.js): add budget tracking, pass@k recording
  - Stop (nf-stop.js): add cache write on quorum completion
- New hook files only when the event type is genuinely new
- Target: zero new hook files for v0.28. Extend existing ones

**Detection:** `ls ~/.claude/hooks/nf-*.js | wc -l` growing past 10 is a smell.

**Phase:** Architecture decision for Phase 1. Document the consolidation strategy before implementing any features.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Hook profiles | Shallow merge destroys nested config (#1), mid-session inconsistency (#6) | Flat config key, stateless per-invocation reads |
| Quorum caching | Stale decisions (#2), cache key too narrow | Include dynamic state in hash, mandatory TTL |
| Budget-aware downgrade | Race condition on shared state (#3), double-counting | Append-only JSONL, single-owner pattern |
| Session state reminder | Sensitive context leak (#13) | Reuse extractCurrentPosition(), never inject raw STATE.md |
| Security sweep | False positive flood (#7), stdout pollution if run as hook (#4) | Scoped scanning, allowlists, run as bin/ script not hook |
| pass@k metrics | Independence assumption (#11) | Track correlation, use as trend indicator |
| De-sloppify cleanup | Context pollution (#12), cost exceeds benefit (#8) | Focused manifest, hard token ceiling |
| Stall detection | False triggers (#9) | Checkpoint type awareness, generous defaults, warn-only |
| Diagnostic agent | Token overhead (#8) | Deterministic script first, AI escalation only for anomalies |
| Smart compact timing | Conflicts with context monitor (#10) | Extend existing hook, single advice source |
| All phases | Install desync (#5), backward-compat config (#14), hook proliferation (#15), stdout pollution (#4) | Version hashes, default-first validation, consolidate into existing hooks |

---

## Integration-Level Warnings

### Warning: Feature Interaction Matrix

These features interact with each other in non-obvious ways:

- **Cache + Budget**: A cache hit should NOT count toward the budget (no tokens spent). But the budget tracker must still record that a quorum occurred. If the cache populates before the budget checks, the downgrade logic never fires.
- **Profile + Cache**: Switching from `strict` to `minimal` profile should invalidate the cache — cached strict-quorum results should not satisfy minimal-profile requirements (different slot counts, different enforcement rules).
- **Stall Detection + De-sloppify**: The cleanup pass runs after phase execution. The stall detector must know that a cleanup pass is a legitimate post-phase activity, not a stall.
- **Diagnostic Agent + Budget**: The diagnostic agent analyzing budget data must not itself blow the budget. Circular dependency if not handled.

**Mitigation:** Build a simple integration test matrix that covers these cross-feature interactions. Do not test features in isolation only.

### Warning: Conformance Event Schema Evolution

Adding cache_hit, budget_remaining, profile_name, stall_detected, etc. to conformance events changes the schema. The existing `schema_version = '1'` (conformance-schema.cjs) must be bumped, and `validate-traces.cjs` must handle both v1 and v2 events for backward compatibility with existing JSONL logs.

**Mitigation:** Bump to schema_version '2' in Phase 1. Add v1 compatibility to validate-traces.cjs. All new fields should be optional (not required) in the schema.

---

## Sources

- Direct codebase analysis: hooks/config-loader.js (shallow merge, lines 276-294)
- Direct codebase analysis: hooks/nf-prompt.js (provider cache pattern, lines 264-284; conformance logging, lines 48-60; stdout discipline, lines 17, 51)
- Direct codebase analysis: hooks/nf-stop.js (transcript parsing, conformance events)
- Direct codebase analysis: hooks/nf-token-collector.js (append-only JSONL pattern)
- Direct codebase analysis: hooks/nf-circuit-breaker.js (state file pattern, spawnSync usage)
- Direct codebase analysis: hooks/gsd-context-monitor.js (context threshold pattern)
- Direct codebase analysis: hooks/nf-precompact.js (extractCurrentPosition pattern)
- Direct codebase analysis: hooks/conformance-schema.cjs (schema versioning)
- Direct codebase analysis: bin/install.js (three-stage hook deployment, lines 1745-1772)
- Project memory: install sync requirement, hook constraints, provider availability patterns
