# Requirements: nForma v0.28

**Defined:** 2026-03-06
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following

## v0.28 Requirements

Requirements for Agent Harness Optimization milestone. Inspired by everything-claude-code patterns, adapted to nForma's quorum-first architecture.

### Hook Infrastructure

- [ ] **PROF-01**: User can set `hook_profile` to `minimal`, `standard`, or `strict` in nf.json, defaulting to `standard`
- [ ] **PROF-02**: In `minimal` profile, only circuit breaker and precompact hooks are active; all other hooks exit(0) immediately
- [ ] **PROF-03**: In `strict` profile, quorum enforcement applies to all nf: commands (not just planning commands) and security sweep runs on every verify
- [ ] **PROF-04**: Hook profile change takes effect on the next tool call without requiring reinstall or restart
- [ ] **CLEAN-01**: After execute-phase verification completes, a cleanup subagent spawns in a fresh context to review code for redundancy, dead code, and over-defensive patterns
- [ ] **CLEAN-02**: Cleanup subagent uses a cheap model (Haiku) and produces a structured report of findings with file:line references

### Quorum Optimization

- [ ] **CACHE-01**: Quorum dispatch computes SHA-256 of (prompt + context + slot list + config hash) before calling any slot
- [ ] **CACHE-02**: On cache hit with valid TTL, cached slot responses are replayed without API calls; cache hits are logged to conformance-events.jsonl
- [ ] **CACHE-03**: Cache is invalidated when git HEAD changes, quorum_active composition changes, or TTL (configurable, default 1 hour) expires
- [ ] **CACHE-04**: Cache is stored in `.planning/.quorum-cache/` (gitignored) with one JSON file per hash key
- [ ] **PASSK-01**: Conformance events include a `pass_at_k` field recording whether consensus was reached at round 1, 2, or 3+
- [ ] **PASSK-02**: `verify-quorum-health.cjs` computes and reports pass@1, pass@3, and pass@k rates from conformance event history

### Runtime Intelligence

- [ ] **BUDG-01**: User can set `budget.session_limit_tokens` in nf.json; nf-prompt.js sums token-usage.jsonl at each prompt and injects a budget warning when cumulative tokens exceed 60% of the limit
- [ ] **BUDG-02**: When cumulative tokens exceed 85% of the session limit, nf-prompt.js automatically downgrades the model profile from quality to balanced (or balanced to budget)
- [ ] **BUDG-03**: Subscription-type slots (`auth_type: "sub"`) are excluded from budget calculations (zero marginal cost)
- [ ] **STALL-01**: Wave execution detects when a quorum slot has not responded within a configurable timeout (default 90s) and marks it as stalled
- [ ] **STALL-02**: After 2 consecutive stalled checkpoints with no new commits, wave execution escalates to the user with a structured stall report
- [ ] **SMART-01**: gsd-context-monitor.js detects workflow boundaries (phase completion, verification done, commit just made) and suggests `/compact` when context usage exceeds the warn threshold at a clean break point
- [ ] **SMART-02**: Compact suggestions include what will survive compaction (STATE.md, CLAUDE.md, memory files) and what will be lost (intermediate reasoning)

### Safety & Diagnostics

- [ ] **SEC-01**: verify-phase workflow includes a security sweep step that greps for hardcoded secrets (`sk-`, `api_key=`, `password=`), debug artifacts (`console.log`, `debugger`), and API keys in committed files
- [ ] **SEC-02**: Security sweep findings are included in VERIFICATION.md under a `## Security Sweep` section with file:line references
- [ ] **SEC-03**: Security sweep is a bin/ script (not a hook) that runs at verify-phase boundary; zero latency impact on normal tool calls
- [ ] **STATE-01**: nf-session-start.js injects a brief state reminder as additionalContext when STATE.md shows an in-progress phase, including phase number, current plan, and last activity
- [ ] **STATE-02**: State reminder only fires on new sessions (not compaction — nf-precompact.js handles that case)
- [ ] **DIAG-01**: A harness diagnostic script (`bin/harness-diagnostic.cjs`) cross-references scoreboard, token-usage.jsonl, conformance-events.jsonl, and circuit breaker logs to produce a structured health report
- [ ] **DIAG-02**: Diagnostic report includes: per-slot availability rate, pass@k trend, cumulative token spend, stall events, and actionable recommendations
- [ ] **DIAG-03**: Diagnostics can run on-demand via `/nf:health` or automatically on SessionStart when the nForma dev repo is detected

## Future Requirements

Deferred beyond v0.28:

- **INSTINCT-01**: Project-scoped convention extraction with confidence scoring (ECC instinct system)
- **WORKTREE-01**: Git worktree isolation for parallel phase execution
- **EVICT-01**: Merge queue with conflict recovery for parallel worktree branches

## Out of Scope

| Feature | Reason |
|---------|--------|
| Semantic caching (embedding-based similarity) | Massive complexity, false positive risk; exact-hash caching sufficient |
| Auto-upgrade (budget to quality) | Spends money without consent; only auto-downgrade is safe |
| Per-file security scanning on every tool call | 200-500ms latency per call; batch scan at verify boundary instead |
| Automatic /compact execution | Destroys context; suggest only, never auto-execute |
| Real-time cost dashboard | Over-engineering for CLI; log tokens and report in diagnostics |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | — | Pending |
| PROF-02 | — | Pending |
| PROF-03 | — | Pending |
| PROF-04 | — | Pending |
| CLEAN-01 | — | Pending |
| CLEAN-02 | — | Pending |
| CACHE-01 | — | Pending |
| CACHE-02 | — | Pending |
| CACHE-03 | — | Pending |
| CACHE-04 | — | Pending |
| PASSK-01 | — | Pending |
| PASSK-02 | — | Pending |
| BUDG-01 | — | Pending |
| BUDG-02 | — | Pending |
| BUDG-03 | — | Pending |
| STALL-01 | — | Pending |
| STALL-02 | — | Pending |
| SMART-01 | — | Pending |
| SMART-02 | — | Pending |
| SEC-01 | — | Pending |
| SEC-02 | — | Pending |
| SEC-03 | — | Pending |
| STATE-01 | — | Pending |
| STATE-02 | — | Pending |
| DIAG-01 | — | Pending |
| DIAG-02 | — | Pending |
| DIAG-03 | — | Pending |

**Coverage:**
- v0.28 requirements: 27 total
- Mapped to phases: 0
- Unmapped: 27

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
