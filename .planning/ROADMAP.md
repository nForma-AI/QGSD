# Roadmap: nForma

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1–17 (shipped 2026-02-21)
- ✅ **v0.3 — Test Suite Maintenance Tool** — Phases 18–22 (shipped 2026-02-22)
- ✅ **v0.4 — MCP Ecosystem** — Phases 23–31 (shipped 2026-02-22)
- ✅ **v0.5 — MCP Setup Wizard** — Phases 32–38 (shipped 2026-02-23)
- ✅ **v0.6 — Agent Slots & Quorum Composition** — Phase 39 (shipped 2026-02-23)
- ✅ **v0.7 — Composition Config & Multi-Slot** — Phases v0.7-01..v0.7-04 (shipped 2026-02-23)
- ✅ **v0.8 — fix-tests ddmin Pipeline** — Phase v0.8-01 (shipped 2026-02-23)
- ✅ **v0.9 — GSD Sync** — Phases v0.9-01..v0.9-09 (shipped 2026-02-27)
- ✅ **v0.10 — Roster Toolkit** — Phases v0.10-01..v0.10-08 (shipped 2026-02-25)
- ✅ **v0.11 — Parallel Quorum** — Phase v0.11-01 (shipped 2026-02-24)
- ✅ **v0.13 — Autonomous Milestone Execution** — Phases v0.13-01..v0.13-06 (shipped 2026-02-25)
- ✅ **v0.14 — FV Pipeline Integration** — Phases v0.14-01..v0.14-05 (shipped 2026-02-26)
- ✅ **v0.15 — Health & Tooling Modernization** — Phases v0.15-01..v0.15-04 (shipped 2026-02-27)
- ✅ **v0.19 — FV Pipeline Hardening** — Phases v0.19-01..v0.19-11 (completed 2026-02-28)
- ✅ **v0.20 — FV as Active Planning Gate** — Phases v0.20-01..v0.20-09 (shipped 2026-03-01)
- ✅ **v0.21 — FV Closed Loop** — Phases v0.21-01..v0.21-06 (shipped 2026-03-01)
- ✅ **v0.23 — Formal Gates** — Phases v0.23-01..v0.23-04 (shipped 2026-03-02)
- ✅ **v0.24 — Quorum Reliability Hardening** — Phases v0.24-01..v0.24-05 (shipped 2026-03-03)
- ✅ **v0.25 — Formal Traceability & Coverage** — Phases v0.25-01..v0.25-07 (shipped 2026-03-03)
- ✅ **v0.26 — Operational Completeness** — Phases v0.26-01..v0.26-06 (shipped 2026-03-04)
- ✅ **v0.27 — Production Feedback Loop** — Phases v0.27-01..v0.27-05 (shipped 2026-03-04)

> **v0.2 through v0.27 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

## v0.28 — Agent Harness Optimization

### Overview

This milestone optimizes the nForma agent harness for production use -- adding configurable hook profiles, quorum response caching, budget-aware model downgrade, stall detection, smart compaction timing, security sweep, session state reminders, and a unified harness diagnostic tool. All 10 features integrate into existing hooks and scripts; no new hook files are needed.

## Phases

- [ ] **Phase v0.28-01: Foundation -- Hook Profiles + De-Sloppify** - Configurable hook profiles and post-verification cleanup subagent
- [ ] **Phase v0.28-02: Data Pipeline -- Quorum Cache + Pass@k Metrics** - SHA-256 quorum response caching and pass@k conformance tracking
- [ ] **Phase v0.28-03: Runtime Intelligence -- Budget Downgrade + Stall Detection + Smart Compact** - Token budget monitoring, stall escalation, and workflow-aware compaction suggestions
- [ ] **Phase v0.28-04: Safety & Diagnostics -- Security Sweep + Session State + Harness Diagnostics** - Verify-time security scanning, session state reminders, and unified diagnostic reporting

## Phase Details

### Phase v0.28-01: Foundation -- Hook Profiles + De-Sloppify
**Goal**: Users can configure how aggressively nForma hooks enforce, and completed phases get automatic code quality review
**Depends on**: Nothing (first phase)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. User sets `hook_profile: "minimal"` in nf.json and only circuit breaker and precompact hooks fire on subsequent tool calls
  2. User sets `hook_profile: "strict"` in nf.json and quorum enforcement applies to all `/nf:` commands, not just planning commands
  3. Changing `hook_profile` in nf.json takes effect on the next tool call without restart or reinstall
  4. After a successful execute-phase verification, a cleanup subagent spawns and produces a structured report listing redundancy, dead code, and over-defensive patterns with file:line references
  5. Circuit breaker remains functional across all three profiles -- oscillation detection fires in minimal, standard, and strict modes (formal: MonitoringReachable invariant holds regardless of profile)
**Plans**: TBD

### Phase v0.28-02: Data Pipeline -- Quorum Cache + Pass@k Metrics
**Goal**: Identical quorum dispatches are served from cache, and consensus efficiency is tracked per-round
**Depends on**: Phase v0.28-01
**Requirements**: CACHE-01, CACHE-02, CACHE-03, CACHE-04, PASSK-01, PASSK-02
**Success Criteria** (what must be TRUE):
  1. Running the same quorum dispatch twice within TTL produces identical results without any API calls on the second invocation, and the cache hit is logged to conformance-events.jsonl
  2. Cache auto-invalidates when git HEAD changes, quorum_active composition changes, or TTL expires
  3. Cache files are stored in `.planning/.quorum-cache/` and are gitignored
  4. `verify-quorum-health.cjs` reports pass@1, pass@3, and pass@k rates computed from conformance event history
  5. Quorum still reaches a DECIDED state on every run where at least one slot responds, whether results come from cache or live dispatch (formal: EventualConsensus invariant preserved)
**Plans**: TBD

### Phase v0.28-03: Runtime Intelligence -- Budget Downgrade + Stall Detection + Smart Compact
**Goal**: The harness monitors token spend, detects stalled slots, and suggests compaction at clean workflow boundaries
**Depends on**: Phase v0.28-01
**Requirements**: BUDG-01, BUDG-02, BUDG-03, STALL-01, STALL-02, SMART-01, SMART-02
**Success Criteria** (what must be TRUE):
  1. User sets `budget.session_limit_tokens` in nf.json and sees a budget warning injected into context when cumulative tokens exceed 60% of the limit
  2. When cumulative tokens exceed 85% of the session limit, the model profile automatically downgrades (quality to balanced, or balanced to budget) without user action
  3. Subscription-type slots (auth_type: "sub") are excluded from budget calculations
  4. When a quorum slot has not responded within the configured timeout (default 90s), it is marked stalled; after 2 consecutive stalled checkpoints with no new commits, the user receives a structured stall report
  5. At clean workflow boundaries (phase completion, verification done, commit just made), the user sees a `/compact` suggestion when context usage exceeds the warn threshold, including what will survive and what will be lost
**Plans**: TBD

### Phase v0.28-04: Safety & Diagnostics -- Security Sweep + Session State + Harness Diagnostics
**Goal**: Verification includes security scanning, new sessions resume with state context, and a unified diagnostic tool reports harness health
**Depends on**: Phase v0.28-02, Phase v0.28-03
**Requirements**: SEC-01, SEC-02, SEC-03, STATE-01, STATE-02, DIAG-01, DIAG-02, DIAG-03
**Success Criteria** (what must be TRUE):
  1. Running verify-phase produces a `## Security Sweep` section in VERIFICATION.md listing any hardcoded secrets, debug artifacts, or API keys with file:line references
  2. Security sweep runs as a bin/ script at verify-phase boundary with zero latency impact on normal tool calls
  3. Starting a new session while STATE.md shows an in-progress phase injects a brief state reminder (phase number, current plan, last activity) into additionalContext
  4. State reminder fires only on new sessions, not on compaction events
  5. Running `bin/harness-diagnostic.cjs` (or `/nf:health`) produces a structured report covering per-slot availability, pass@k trend, cumulative token spend, stall events, and actionable recommendations
  6. Stop hook continues to BLOCK planning responses that lack quorum evidence and PASS responses that include it, regardless of which features are active (formal: LivenessProperty2 and LivenessProperty3 invariants preserved)
**Plans**: TBD

## Progress

**Execution Order:** v0.28-01 -> v0.28-02 -> v0.28-03 -> v0.28-04
(v0.28-02 and v0.28-03 both depend on v0.28-01 only; v0.28-04 depends on both)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.28-01. Foundation -- Hook Profiles + De-Sloppify | 0/TBD | Not started | - |
| v0.28-02. Data Pipeline -- Quorum Cache + Pass@k Metrics | 0/TBD | Not started | - |
| v0.28-03. Runtime Intelligence -- Budget + Stall + Smart Compact | 0/TBD | Not started | - |
| v0.28-04. Safety & Diagnostics -- Security + State + Diagnostics | 0/TBD | Not started | - |
