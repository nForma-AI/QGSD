# Feature Landscape: ECC-Inspired Agent Harness Improvements

**Domain:** Agent harness optimization (Claude Code plugin)
**Researched:** 2026-03-06
**Applies to:** nForma v0.28+ milestone (10 ECC-inspired features)

## Table Stakes

Features that agent harness users increasingly expect. Missing = nForma falls behind the ecosystem baseline.

| # | Feature | Why Expected | Complexity | Dependencies |
|---|---------|--------------|------------|--------------|
| 4 | Session-start state reminder | Every serious harness injects context on session resume. Claude Code fires SessionStart on both new sessions AND after compaction. Without re-injection, agents lose mid-phase positioning. Anthropic's own harness engineering docs call this out as fundamental. nForma already has `nf-precompact.js` that reads STATE.md "Current Position" -- this extends it to also inject phase-specific context (current step, pending tasks, ROADMAP criteria). | Low | Existing: `nf-precompact.js`, `nf-session-start.js`, STATE.md. Extends existing hooks -- no new hook type needed. |
| 5 | Security sweep in verify-phase | AI-generated code leaks secrets at alarming rates (GitGuardian, Clawhatch 2026 audits confirm). nForma already runs TruffleHog + Gitleaks + detect-secrets in CI. But CI catches secrets AFTER commit. Table stakes = catching them BEFORE commit during the verify-phase workflow. Industry standard is shifting security left into the agent harness itself. | Low-Med | Existing: `.github/workflows/secret-scan.yml` (TruffleHog + Gitleaks + detect-secrets), `bin/secrets.cjs`, `.secrets.baseline`. Verify-phase workflow needs a new step calling existing secret-scan tooling locally. |
| 8 | Stall detection in waves | 40% of multi-agent pilots fail in production (Composio 2025 report). Top cause: agents stall silently. nForma's quorum dispatch already uses waves/rounds -- if a slot hangs, the entire wave blocks. Every production harness needs timeout + escalation. The circuit breaker detects oscillation (repetitive behavior) but NOT stalls (no behavior). | Med | Existing: `bin/quorum-slot-dispatch.cjs` (wave dispatch), circuit breaker (oscillation only). New: per-slot timeout tracking, escalation to skip/retry/replace stalled slots. Must not conflict with circuit breaker logic. |
| 10 | Smart compact timing | Context window exhaustion is the #1 session killer. nForma already monitors context via `gsd-context-monitor.js` (warn at 70%, critical at 90%). But warning at 70% is reactive -- by then the agent is mid-task. Smart = suggesting /compact at natural workflow boundaries (between phases, after verification, after commit). Claude Code's buffer is ~33K tokens as of early 2026. | Low | Existing: `gsd-context-monitor.js` (PostToolUse), `context_monitor` config. New: boundary detection logic in the context monitor. Reads workflow stage from STATE.md or task-envelope to determine if current moment is a "clean break." |

## Differentiators

Features that set nForma apart. Not expected by the ecosystem, but high value for multi-model quorum harnesses specifically.

| # | Feature | Value Proposition | Complexity | Dependencies |
|---|---------|-------------------|------------|--------------|
| 1 | Hook profiles (minimal/standard/strict) | No other harness offers tiered enforcement levels as a first-class config concept. Most harnesses are binary (on/off). nForma can offer: **minimal** (circuit breaker only, no quorum enforcement -- fast solo dev), **standard** (current behavior -- quorum on plan/verify), **strict** (quorum on ALL commands, pre-commit security sweep, formal verification gate). Maps cleanly onto existing profile system (`/nf:set-profile` for quality/balanced/budget) but is orthogonal -- budget profile + strict enforcement is a valid combo. | Med | Existing: `config-loader.js` (two-layer config), `/nf:set-profile` (model tiers). New config key `hook_profile` in `nf.json`. Each hook reads this key and adjusts behavior. Must update: `nf-prompt.js`, `nf-stop.js`, `nf-circuit-breaker.js`. |
| 2 | Quorum response caching (content-hash) | Multi-model quorum is expensive. If the same planning prompt is sent twice (session restart, re-run after failure), all 4+ slots re-execute. Content-hash caching: SHA-256 the prompt, cache slot responses, replay on cache hit. Reduces cost 30-50% for re-runs. No other multi-model orchestrator does this at the harness level. Semantic caching (GPTCache, liteLLM) operates at the API proxy layer -- nForma can do it at the quorum dispatch layer with full awareness of which slots responded. | Med-High | Existing: `bin/quorum-slot-dispatch.cjs` (dispatch), scoreboard (records all votes). New: cache directory (`.planning/.quorum-cache/`), hash computation, cache lookup before dispatch, TTL expiry. Risk: stale cache serving outdated responses. Must include invalidation on codebase changes (git HEAD changes = cache bust). |
| 3 | Budget-aware auto-downgrade | Existing profile system requires manual `/nf:set-profile budget`. Auto-downgrade monitors cumulative token spend per session and automatically shifts tiers: quality -> balanced at 60% budget, balanced -> budget at 85%. The token collector hook already tracks per-slot token usage. No manual intervention needed. Real differentiator: per-session spend awareness with automatic cost control. | Med | Existing: `nf-token-collector.js` (per-slot token tracking), `model_tier_planner`/`model_tier_worker` config, `agent_config.auth_type` (sub vs api). New: budget threshold config, auto-profile-switch logic. Must respect `auth_type: "sub"` (subscription slots have zero marginal cost -- never downgrade). |
| 6 | pass@k metrics | HumanEval's pass@k is the gold standard for measuring LLM code reliability. Applying it to quorum: "what fraction of rounds produce consensus on first attempt (pass@1) vs requiring deliberation (pass@2, pass@3)?" This directly measures quorum efficiency and identifies which slots are reliability bottlenecks. nForma already records every round in the scoreboard -- this is a computed metric layer on existing data. | Low-Med | Existing: `bin/update-scoreboard.cjs` (round-by-round vote recording), `bin/verify-quorum-health.cjs` (statistical analysis). New: pass@k computation function. Formula: P(at least `minSize` agreeing votes in round k). Can be added to `verify-quorum-health.cjs` as an additional metric. |
| 7 | De-sloppify cleanup | The desloppify pattern (peteromallet/desloppify) is gaining traction: run a SEPARATE agent context to review code quality AFTER the primary agent finishes. Key insight: the executing agent is biased toward its own output. A fresh context catches naming issues, dead code, missing error handling, and abstraction problems. nForma can spawn this as a post-verify cleanup step using a cheap model (Haiku). | Med | Existing: verify-phase workflow, subagent spawning patterns. New: cleanup subagent prompt template, separate invocation after verify-phase completes. Must use a FRESH context (not the execution context) to avoid bias. Could reuse the Haiku reviewer pattern from the circuit breaker. |
| 9 | Harness self-diagnostic | nForma generates extensive logs: MCP logs, scoreboard data, circuit breaker events, context monitor warnings, token usage. Currently analyzed manually via `bin/review-mcp-logs.cjs`. Self-diagnostic: automatically analyze own performance logs and surface actionable insights (e.g., "codex-1 has been UNAVAIL for 3 consecutive sessions -- consider removing from quorum_active"). | Med | Existing: `bin/review-mcp-logs.cjs` (health report), scoreboard, token collector data. New: diagnostic engine that cross-references multiple data sources. Output: structured diagnostic report in `.planning/diagnostics/`. Could run on SessionStart or on-demand via `/nf:health`. |

## Anti-Features

Features to explicitly NOT build, even though they sound appealing.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full semantic caching (embedding-based similarity) | Massive complexity, requires embedding model, similarity threshold tuning, false positive risk where "similar enough" prompts get stale cached responses. GPTCache and liteLLM already do this at the API proxy layer -- nForma should not duplicate. | Use exact content-hash caching only (Feature #2). Identical prompts get cached responses. Similar-but-different prompts always go to the model. |
| Auto-upgrade (budget -> quality) | Tempting but dangerous. Auto-upgrading burns budget unpredictably. The user chose budget mode for a reason. Auto-DOWNGRADE is safe (saves money). Auto-UPGRADE is not (spends money without consent). | Keep auto-downgrade only (Feature #3). Upgrading requires explicit `/nf:set-profile quality`. |
| Per-file security scanning on every tool call | PreToolUse hook running secret detection on every file write would add 200-500ms latency per tool call. At 50+ tool calls per phase, that is 10-25s of pure overhead. | Batch scan at verify-phase boundary (Feature #5). One scan catches everything. |
| Automatic /compact execution | Claude Code's /compact is user-initiated for good reason -- it destroys context. Auto-executing it risks losing critical mid-task state. | SUGGEST /compact at workflow boundaries (Feature #10). Show the suggestion. Let the user decide. |
| Real-time cost dashboard | Building a live-updating cost UI in a CLI plugin is over-engineering. Token costs change monthly, model pricing varies by provider. | Log cumulative tokens. Auto-downgrade at thresholds (Feature #3). Report costs in harness self-diagnostic (Feature #9). |

## Feature Dependencies

```
Feature 1 (Hook Profiles) --- independent, foundational
  |
  +-- Feature 5 (Security Sweep) can be gated by profile (strict only vs always)
  +-- Feature 2 (Response Caching) can be disabled in strict profile

Feature 3 (Budget Auto-Downgrade) requires:
  +-- Token collector data (already exists)
  +-- Profile system (already exists)

Feature 4 (Session State Reminder) --- independent, extends existing hooks

Feature 6 (pass@k) requires:
  +-- Scoreboard data (already exists)
  +-- Can feed into Feature 9 (Self-Diagnostic)

Feature 7 (De-sloppify) requires:
  +-- Verify-phase completion (existing workflow)
  +-- Subagent spawning (existing pattern)

Feature 8 (Stall Detection) requires:
  +-- Wave dispatch system (already exists)
  +-- Should integrate with Feature 9 (Self-Diagnostic) for post-mortem

Feature 9 (Self-Diagnostic) benefits from:
  +-- Feature 6 (pass@k metrics) as input data
  +-- Feature 8 (stall detection events) as input data
  +-- Feature 3 (budget tracking data) as input data

Feature 10 (Smart Compact) requires:
  +-- Context monitor (already exists)
  +-- Workflow boundary detection (needs STATE.md or task-envelope awareness)
```

## MVP Recommendation

**Phase 1 -- Foundation + Quick Wins (4 features):**
1. **Feature 4** (Session state reminder) -- Low complexity, extends existing hooks, immediate user value
2. **Feature 10** (Smart compact timing) -- Low complexity, extends existing monitor, prevents session crashes
3. **Feature 5** (Security sweep) -- Low-Med complexity, reuses existing CI tools locally, critical safety
4. **Feature 6** (pass@k metrics) -- Low-Med complexity, computed from existing scoreboard data, enables Feature 9

**Phase 2 -- Core Differentiators (3 features):**
5. **Feature 1** (Hook profiles) -- Med complexity, foundational config that gates other features
6. **Feature 8** (Stall detection) -- Med complexity, prevents silent quorum failures
7. **Feature 3** (Budget auto-downgrade) -- Med complexity, requires profile system working

**Phase 3 -- Advanced (3 features):**
8. **Feature 7** (De-sloppify) -- Med complexity, post-verify cleanup pass
9. **Feature 9** (Self-diagnostic) -- Med complexity, benefits from pass@k + stall data from earlier phases
10. **Feature 2** (Response caching) -- Med-High complexity, highest risk (cache invalidation), most cost savings

**Defer rationale:** Response caching is last because cache invalidation is notoriously hard, and doing it wrong serves stale quorum responses. Get the simpler features shipping first.

## Complexity Summary

| Feature | Lines of Code (est.) | New Files | Modified Files | Risk |
|---------|---------------------|-----------|----------------|------|
| 1. Hook Profiles | 200-300 | 0 | 4 (config-loader, 3 hooks) | Low -- config-driven |
| 2. Response Caching | 400-600 | 1-2 (cache module) | 1 (slot-dispatch) | High -- cache invalidation |
| 3. Budget Auto-Downgrade | 150-250 | 0-1 | 2 (token collector, config) | Med -- threshold tuning |
| 4. Session State Reminder | 50-100 | 0 | 1 (nf-precompact.js) | Low -- extends existing |
| 5. Security Sweep | 100-200 | 0-1 | 1 (verify-phase.md) | Low -- reuses CI tools |
| 6. pass@k Metrics | 100-150 | 0 | 1 (verify-quorum-health) | Low -- pure computation |
| 7. De-sloppify | 200-300 | 1 (cleanup template) | 1 (verify-phase.md) | Med -- prompt engineering |
| 8. Stall Detection | 200-300 | 0-1 | 1 (slot-dispatch) | Med -- timeout calibration |
| 9. Self-Diagnostic | 300-400 | 1 (diagnostic engine) | 1 (health workflow) | Med -- data correlation |
| 10. Smart Compact | 80-120 | 0 | 1 (context-monitor) | Low -- boundary detection |

## Sources

- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) -- harness lifecycle, context management
- [OpenAI: Harness Engineering with Codex](https://openai.com/index/harness-engineering/) -- agent harness patterns
- [Martin Fowler: Harness Engineering](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html) -- lifecycle hooks, enforcement tiers
- [Phil Schmid: The Importance of Agent Harness in 2026](https://www.philschmid.de/agent-harness-2026) -- budget management, observability
- [GitGuardian: Shifting Security Left for AI Agents](https://blog.gitguardian.com/shifting-security-left-for-ai-agents-enforcing-ai-generated-code-security-with-gitguardian-mcp/) -- secret detection in agent workflows
- [Clawhatch: State of AI Agent Security 2026](https://clawhatch.com/blog/state-of-ai-agent-security-2026) -- AI-generated code vulnerability rates
- [Composio: Why AI Agent Pilots Fail](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap) -- 40% failure rate, stall detection need
- [peteromallet/desloppify](https://github.com/peteromallet/desloppify) -- separate-context code quality review pattern
- [Emergent Mind: Pass@k Metrics](https://www.emergentmind.com/topics/pass-k-metrics-2508a3b6-8dc0-488f-a854-891fb35d80b0) -- pass@k for LLM evaluation
- [Statistics for AI/ML: pass@k](https://leehanchung.github.io/blogs/2025/09/08/pass-at-k/) -- unbiased estimator formulation
- [Claude Code Context Window Management](https://www.morphllm.com/claude-code-context-window) -- compact timing, 33K buffer
- [Martin Fowler: Context Engineering for Coding Agents](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html) -- session state injection patterns
- [AWS: Optimize LLM Response Costs with Caching](https://aws.amazon.com/blogs/database/optimize-llm-response-costs-and-latency-with-effective-caching/) -- content-hash caching strategies
- [liteLLM: Caching](https://docs.litellm.ai/docs/proxy/caching) -- API-level response caching patterns
- [Skywork: AI API Cost Best Practices 2025](https://skywork.ai/blog/ai-api-cost-throughput-pricing-token-math-budgets-2025/) -- budget alerting patterns
