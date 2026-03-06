# Research Summary: Agent Harness Optimization

**Domain:** Hook profiles, quorum caching, budget-aware downgrade, session state reminder, security sweep, pass@k metrics, de-sloppify cleanup, stall detection, harness diagnostic agent, smart compact timing
**Researched:** 2026-03-06
**Overall confidence:** HIGH

## Executive Summary

This milestone adds 10 optimization features to the existing nForma hook/config/dispatch architecture. All 10 features integrate into existing components -- no new hook files are needed. The primary integration point is config-loader.js (5 of 10 features add config keys), followed by gsd-context-monitor.js (2 features) and nf-prompt.js (2 features).

The architecture analysis reveals a clean separation: 6 features modify existing hooks in-place, 3 features are purely additive (new scripts/commands), and 1 feature (cleanup) is offline maintenance. The existing fail-open, JSONL-append, and shallow-merge patterns accommodate all 10 features without architectural changes.

The critical risk is gsd-context-monitor.js: two features (stall detection + smart compact) both add stateful writes to a hook that is currently pure/read-only and fires on every PostToolUse event. Build order must sequence these carefully to avoid performance regression.

## Key Findings

**Stack:** No new dependencies required -- all features use Node.js built-ins (fs, path, crypto) and existing project patterns.
**Architecture:** 0 new hook files, 5 config-loader changes, 2 gsd-context-monitor changes, 7 new state/data files (all gitignored).
**Critical pitfall:** PostToolUse performance -- gsd-context-monitor.js fires hundreds of times per session; any I/O added must be sub-millisecond.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation: Profiles + Cleanup** - Config profiles (Feature 1) are consumed by 4 downstream features. Cleanup (Feature 7) is independent and reduces friction.
   - Addresses: Hook profiles, de-sloppify cleanup
   - Avoids: Downstream features building on un-profiled config

2. **Data Pipeline: Cache + Metrics** - Quorum caching and pass@k are independent but both benefit from clean config.
   - Addresses: Quorum caching, pass@k metrics
   - Avoids: Repeated quorum dispatch overhead

3. **Runtime Intelligence: Budget + Stall + Compact** - Three features that add real-time monitoring. Stall and compact share gsd-context-monitor.js.
   - Addresses: Budget-aware downgrade, stall detection, smart compact timing
   - Avoids: Same-file conflicts by sequencing 8 before 10

4. **Safety + State + Diagnostics: Security + State Reminder + Diagnostics** - Security sweep is independent. State reminder reads data from earlier features. Diagnostics tests everything.
   - Addresses: Security sweep, session state reminder, harness diagnostic agent
   - Avoids: Building diagnostics before features exist to diagnose

**Phase ordering rationale:**
- Config foundation first because 5 features add config keys
- gsd-context-monitor.js features sequenced (stall before compact) to avoid merge conflicts
- Diagnostics last because it tests the full stack
- Independent features (cleanup, security, pass@k) can parallelize within their phases

**Research flags for phases:**
- Phase 3 (Budget): Needs validation of token-usage.jsonl read performance at high volume
- Phase 3 (Smart Compact): STATE.md parsing heuristic needs empirical tuning
- All other phases: Standard patterns, unlikely to need additional research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; all Node.js built-ins |
| Features | HIGH | All 10 features have clear integration points in existing code |
| Architecture | HIGH | Based on direct source code inspection of all 9 hooks + dispatch + config |
| Pitfalls | HIGH | PostToolUse performance risk is the primary concern; all other risks are LOW |

## Gaps to Address

- Token-usage.jsonl read performance under high volume (budget feature)
- STATE.md parsing heuristic accuracy for remaining-work estimation (smart compact)
- Quorum cache invalidation strategy when multiple sessions run concurrently
- Log rotation strategy for JSONL files exceeding 10MB
