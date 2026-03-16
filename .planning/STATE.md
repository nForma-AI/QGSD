# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following
**Current focus:** v0.37 — Close the Loop: Cross-Layer Feedback Integration

## Current Position

Phase: v0.37-01 of 5 (Annotation Back-Linking)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-16 — Roadmap created for v0.37

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: (none yet)
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.37 roadmap]: 5 phases derived from 16 requirements across 6 categories (TLINK, CLINK, GPROMO, FPTUNE, QPREC, HTARGET)
- [v0.37 roadmap]: TLINK + CLINK combined into Phase 01 (both annotation-based scanner improvements sharing proximity graph)
- [v0.37 roadmap]: Phase 03 (FP Tuning) depends on Phase 01 (back-linking reduces baseline FP rates first)
- [v0.37 roadmap]: Phases 02, 04, 05 are independent of each other

### Pending Todos

None yet.

### Blockers/Concerns

- additionalContext token budget contention (multiple injection sources share ~4000 token ceiling)
- Token dashboard path mismatch: token-dashboard.cjs defaults to legacy path (Low severity)

## Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|---|---|---|---|---|
| 293 | Implement context window size detection (200K vs 1M) based on quorum consensus findings | 2026-03-14 | 199af48a | Verified | [293-implement-context-window-size-detection-](./quick/293-implement-context-window-size-detection-/) |
| 294 | Fix 2 XState model gaps identified by Gate A grounding check | 2026-03-15 | bd8da4d9 | Pending | [294-fix-2-xstate-model-gaps-identified-by-ga](./quick/294-fix-2-xstate-model-gaps-identified-by-ga/) |
| 295 | Generate test recipes for 15 uncovered L3 failure modes (Gate C) | 2026-03-15 | 9467c0d0 | Pending | [295-generate-test-recipes-for-15-uncovered-l](./quick/295-generate-test-recipes-for-15-uncovered-l/) |
| 296 | Fix 1 XState model gap identified by Gate A grounding check | 2026-03-15 | ab4c635d | Pending | [296-fix-1-xstate-model-gap-identified-by-gat](./quick/296-fix-1-xstate-model-gap-identified-by-gat/) |
| 297 | Generate test recipes for 9 uncovered L3 failure modes (Gate C) | 2026-03-15 | 0747c695 | Pending | [297-generate-test-recipes-for-9-uncovered-l3](./quick/297-generate-test-recipes-for-9-uncovered-l3/) |
| 298 | Digest V8 coverage at collection time in sweepTtoC | 2026-03-15 | 804a96e0 | Verified | [298-digest-v8-coverage-at-collection-time-in](./quick/298-digest-v8-coverage-at-collection-time-in/) |
| 300 | Fix nf-solve.cjs NDJSON dedup bug and increase verification pipeline timeout | 2026-03-15 | 54438a42 | Verified | [300-fix-nf-solve-cjs-ndjson-dedup-bug-and-in](./quick/300-fix-nf-solve-cjs-ndjson-dedup-bug-and-in/) |
| 301 | Isolate TLC metadir per-config to fix 31 in-pipeline F→C failures | 2026-03-15 | fc0141ff | Verified | [301-isolate-tlc-metadir-per-config-to-fix-31](./quick/301-isolate-tlc-metadir-per-config-to-fix-31/) |
| 302 | Create canonical quorum dispatch snippet and wire into all 8 workflows | 2026-03-15 | a1f7ccda | Verified | [302-create-canonical-quorum-dispatch-snippet](./quick/302-create-canonical-quorum-dispatch-snippet/) |
| 303 | Add hypothesis measurement collection step to solve-diagnose (Step 0e) | 2026-03-15 | ed9a347f | Verified | [303-add-hypothesis-measurement-collection-st](./quick/303-add-hypothesis-measurement-collection-st/) |
| 304 | Eliminate sweep false positives via code-trace-index | 2026-03-16 | 1b499527 | Verified | [304-eliminate-sweep-false-positives-via-code](./quick/304-eliminate-sweep-false-positives-via-code/) |
| 305 | Solve loop hygiene: prune stale cache/archive, fix D→R key stability, extend test/ inheritance | 2026-03-16 | b2c312f7 | Verified | [305-solve-loop-hygiene-prune-stale-cache-arc](./quick/305-solve-loop-hygiene-prune-stale-cache-arc/) |
| 309 | Fix 2 XState model gaps identified by Gate A grounding check | 2026-03-16 | caed0e2d | Pending | [309-fix-2-xstate-model-gaps-identified-by-ga](./quick/309-fix-2-xstate-model-gaps-identified-by-ga/) |
| 311 | Generate test recipes for uncovered L3 failure modes (Gate C) | 2026-03-16 | da37b56d | Pending | [311-generate-test-recipes-for-uncovered-l3-f](./quick/311-generate-test-recipes-for-uncovered-l3-f/) |
| 310 | Make nf-mcp-dispatch-guard read slot names dynamically from providers.json and ~/.claude.json mcpServers instead of hardcoded SLOT_TOOL_SUFFIX families | 2026-03-16 | 5ee08053 | Verified | [310-make-nf-mcp-dispatch-guard-read-slot-nam](./quick/310-make-nf-mcp-dispatch-guard-read-slot-nam/) |
| 312 | Make nf-prompt.js fall back to providers.json when agent_config is empty for model dedup | 2026-03-16 | 5ce50f57 | Verified | [312-make-nf-prompt-js-fall-back-to-providers](./quick/312-make-nf-prompt-js-fall-back-to-providers/) |
| 313 | Add tier field to requirements — tier: user|technical, default existing to user, update C→R and T→R scanners to propose technical requirements instead of FP'ing infra | 2026-03-16 | 1337b827 | Pending | [313-add-tier-field-to-requirements-tier-user](./quick/313-add-tier-field-to-requirements-tier-user/) |
| 314 | Fix proximity pipeline: stats reader, orphan definition, threshold, uncovered surfacing, TLA+/PRISM extraction | 2026-03-16 | 88166e63 | Verified | [314-fix-proximity-pipeline-stats-reader-orph](./quick/314-fix-proximity-pipeline-stats-reader-orph/) |
| 317 | Add proximity pre-filter to nf-solve.cjs reverse scanners | 2026-03-16 | 18d5fb32 | Pending | [317-add-proximity-pre-filter-to-nf-solve-cjs](./quick/317-add-proximity-pre-filter-to-nf-solve-cjs/) |

## Session Continuity

Last session: 2026-03-16
Stopped at: Roadmap created for v0.37
Resume file: None
