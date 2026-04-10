# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** Planning decisions are multi-model verified by structural enforcement
**Current focus:** v0.42 Phase 56 — Diagnostic Enrichment

## Current Position

Phase: 56 (3 of 4) — Diagnostic Enrichment
Plan: 02 complete (2/? plans for phase 56)
Status: Plan 02 executed
Last activity: 2026-04-10 — Phase 056-02 complete (Reverse discovery C->R/T->R caller-count enrichment)

Progress: [████████████████████] 100/99 plans (101%)

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: ~1 session
- Total execution time: ~1.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 54. Adapter Foundation | 3/3 | 0.5h | ~10m |
| 55. Remediation Enrichment | 2/2 | 0.2h | ~6m |
| 56. Diagnostic Enrichment | 2/? | 0.5h | ~15m |
| 57. Accuracy & Safety | 0/? | - | - |

## Accumulated Context

### Decisions

- v0.42 scope: coderlm augments, never replaces -- every layer must work without it (fail-open everywhere)
- v0.42 scope: work with existing 4 coderlm query methods only (getCallers, getImplementation, findTests, peek)
- v0.42 scope: in-memory LRU cache only, no persistent disk cache
- Pre-work: Quick tasks 380-383 established coderlm adapter, graph-driven computeWaves, cross-compilation CI, and lazy lifecycle management
- Phase 054 decision: /implementation endpoint returns { file, line } only (no callers array); queryEdgesSync falls back to getCallersSync for caller discovery with path.resolve() comparison
- Phase 054 decision: LAYER_SYMBOL_MAP contains only 4 entries (distinct scripts with named exports); l3_to_tc excluded (no named exports), inline handlers excluded
- Phase 054 decision: adapter created once per solve run (_solveAdapter) and reused across iterations for accurate session metrics
- Phase 055 decision (Plan 01): Symbol hint for coderlm queries derived from requirement ID (stripped dashes, lowercase) when requirement text unavailable
- Phase 055 decision (Plan 01): Per-requirement dispatch for seeded R->F gaps (individual call per requirement prevents caller context cross-contamination)
- Phase 055 decision (Plan 01): Coderlm unavailability gates via health check — failure routes to batch dispatch, preserving pre-integration behavior
- Phase 055 decision (Plan 02): Recipe enrichment runs in async tail AFTER main() completes (not wrapping main) to preserve process.exit() timing
- Phase 055 decision (Plan 02): Idempotency check on assert_patterns.length > 0 (not test_files.length) for re-runnable partial enrichment
- Phase 056 decision (Plan 01): Git heatmap priority weighting uses Math.log1p(calleeCount) for sublinear boost (avoids explosion on high-caller files while still rewarding callee count)
- Phase 056 decision (Plan 01): Module-level _activeAdapter variable for sweepGitHeatmap() access (matches existing formalTestSyncCache pattern for scope)
- Phase 056 decision (Plan 02): Reverse discovery (C->R and T->R) enriched with caller_count via getCallersSync('', filePath); dead_code_flag true when caller_count===0
- Phase 056 decision (Plan 02): Per-candidate fail-open pattern for enrichment — each getCallersSync wrapped in try-catch to isolate failures; health check gates entire enrichment block
- Phase 056 decision (Plan 02): Report annotation shows "(0 callers — likely dead code)" when dead_code_flag=true, or "(N callers)" for defined counts; undefined counts omit annotation (fail-open)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-08
Stopped at: Phase 055 complete, ready to plan Phase 056 (Diagnostic Enrichment)
Resume file: None

## Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|---|---|---|---|---|
| 374 | Make API slots backup-only | 2026-04-04 | 99b79b4f | Verified | [374-make-api-slots-backup-only-dispatch-to-a](./quick/374-make-api-slots-backup-only-dispatch-to-a/) |
| 375 | issue-47-agents-skip-formal-modeling | 2026-04-05 | d174cae7 | Verified | [375-issue-47-agents-skip-formal-modeling](./quick/375-issue-47-agents-skip-formal-modeling/) |
| 379 | Issue #46: Add formal model staleness detection via content hashing | 2026-04-05 | 7ae0fe01 | Needs Review | [379-issue-46-add-formal-model-staleness-dete](./quick/379-issue-46-add-formal-model-staleness-dete/) |
| 380 | Improve nForma reporting for feature usefulness and bugs caught | 2026-04-07 | 0e3bb9ee | Verified | [380-improve-nforma-reporting-for-feature-use](./quick/380-improve-nforma-reporting-for-feature-use/) |
| 380 | Delegate quorum slot coding to external agents via quorum-slot-dispatch.cjs | 2026-04-06 | f56c7d43 | Verified | [380-delegate-quorum-slot-coding-to-external-](./quick/380-delegate-quorum-slot-coding-to-external-/) |
| 380 | Trim packaged skills to 6, merge into lifecycle | 2026-04-07 | 807f0c5b | Pending | [380-trim-packaged-skills-to-6-merge-removed-](./quick/380-trim-packaged-skills-to-6-merge-removed-/) |
| 380 | Issue #64: Make --auto the default for milestone workflows — complete default_milestone config feature | 2026-04-07 | c7df57eb | Verified | [380-issue-64-make-auto-the-default-for-miles](./quick/380-issue-64-make-auto-the-default-for-miles/) |
| 380 | Integrate coderlm adapter and graph-driven computeWaves into nf:solve (issue #58) | 2026-04-06 | 2c08362a | Verified | [380-integrate-coderlm-adapter-and-graph-driv](./quick/380-integrate-coderlm-adapter-and-graph-driv/) |
| 381 | Add --delegate flag to nf:quick for full task delegation via Mode C dispatch | 2026-04-07 | e77c29eb | Verified | [381-add-delegate-flag-to-nf-quick-for-full-t](./quick/381-add-delegate-flag-to-nf-quick-for-full-t/) |
| 381 | Create checklist registry JSON + matching script | 2026-04-07 | 0c515031 | Pending | [381-create-checklist-registry-json-with-trig](./quick/381-create-checklist-registry-json-with-trig/) |
| 382 | Implement Tier 0 policy interface and Tier 1 River bandit layer for routing authority ladder in selectSlot | 2026-04-07 | 1fc88449 | Verified | [382-implement-tier-0-policy-interface-and-ti](./quick/382-implement-tier-0-policy-interface-and-ti/) |
| 383 | Wire task-intake routing into PresetPolicy, update nf:quick command metadata with delegate flag, add delegation docs | 2026-04-07 | 40ef3ab3 | Verified | [383-wire-task-intake-routing-into-presetpoli](./quick/383-wire-task-intake-routing-into-presetpoli/) |
| 384 | Fully integrate River ML library and Q-learning for quorum slot delegation | 2026-04-08 | 6bf32b45 | Verified | [384-issue-73](./quick/384-issue-73/) |
| 385 | Add River ML phase indicator to nf-statusline.js | 2026-04-08 | 32ca7b5e | Pending | [385-add-river-ml-phase-indicator-to-nf-statu](./quick/385-add-river-ml-phase-indicator-to-nf-statu/) |
| 386 | Add E2E test for River ML learning loop and surface shadow recommendations in status line | 2026-04-08 | 017878fb | Verified | [386-add-e2e-test-for-river-ml-learning-loop-](./quick/386-add-e2e-test-for-river-ml-learning-loop-/) |
| 381 | Wire coderlm adapter queries into nf-solve to populate dependency graph edges from active residual layers | 2026-04-07 | pending | Pending | [381-wire-coderlm-adapter-queries-into-nf-sol](./quick/381-wire-coderlm-adapter-queries-into-nf-sol/) |
| 381 | Wire coderlm adapter queries into nf-solve to populate dependency graph edges from active residual layers | 2026-04-07 | 9e56913e | Verified | [381-wire-coderlm-adapter-queries-into-nf-sol](./quick/381-wire-coderlm-adapter-queries-into-nf-sol/) |
| 382 | Set up coderlm cross-compilation CI | 2026-04-08 | 0f515fa2 | Pending | [382-set-up-coderlm-cross-compilation-ci](./quick/382-set-up-coderlm-cross-compilation-ci/) |
| 383 | Implement coderlm lazy lifecycle management | 2026-04-08 | 67302123 | Pending | [383-implement-coderlm-lazy-lifecycle-managem](./quick/383-implement-coderlm-lazy-lifecycle-managem/) |

## Session Log

- 2026-04-05 - Completed quick task 375: issue-47-agents-skip-formal-modeling
- 2026-04-04: Completed quick task 374 - Make API slots backup-only
- 2026-04-04: STATE.md regenerated by /gsd:health --repair
- 2026-04-05: Completed quick task 379 - Issue #46: Add formal model staleness detection via content hashing
- 2026-04-07: Completed quick task 380 - Improve nForma reporting for feature usefulness and bugs caught
- 2026-04-06 - Completed quick task 380: Delegate quorum slot coding to external agents via quorum-slot-dispatch.cjs
- 2026-04-07: Completed quick task 380: Trim packaged skills to 6
- 2026-04-07: Completed quick task 380 - Issue #64: Make --auto the default for milestone workflows
- 2026-04-06: Completed quick task 380: Integrate coderlm adapter and graph-driven computeWaves into nf:solve (issue #58)
- 2026-04-07 - Completed quick task 381: Add --delegate flag to nf:quick for full task delegation via Mode C dispatch
- 2026-04-07: Completed quick task 381: Create checklist registry JSON + matching script
- 2026-04-07 - Completed quick task 382: Implement Tier 0 policy interface and Tier 1 River bandit layer for routing authority ladder in selectSlot
- 2026-04-07 - Completed quick task 383: Wire task-intake routing into PresetPolicy, update command metadata, add delegation docs
- 2026-04-08 - Completed quick task 384: Fully integrate River ML library and Q-learning for quorum slot delegation
- 2026-04-08 - Completed quick task 385: Add River ML phase indicator to nf-statusline.js
- 2026-04-08 - Completed quick task 386: Add E2E test for River ML learning loop and surface shadow recommendations

Last activity: 2026-04-09 - Completed quick task 396: Fill install.js CLI detection gaps (--rescan, CCR auto-include, null cli paths)
- 2026-04-07: Completed quick task 381: Wire coderlm adapter queries into nf-solve dependency graph
- 2026-04-08: Completed quick task 382: Set up coderlm cross-compilation CI
- 2026-04-08 - Completed quick task 383: Implement coderlm lazy lifecycle management
- 2026-04-09 - Completed quick task 388: Add second tools-status line to nf-statusline (coderlm/River/embed)
- 2026-04-09 - Completed quick task 390: Update ensureBinary() to build coderlm from source via git clone + cargo build
| 384 | Fix nf:mcp-repair to call MCP tools directly instead of via sub-agents | 2026-04-08 | 758b4b32 | Pending | [384-fix-nf-mcp-repair-to-call-mcp-tools-dire](.planning/quick/384-fix-nf-mcp-repair-to-call-mcp-tools-dire/) |
| 385 | Make nf:mcp-repair discover slot names dynamically from ~/.claude.json mcpServers instead of hardcoding them | 2026-04-08 | 77b238ed | Verified | [385-make-nf-mcp-repair-discover-slot-names-d](./quick/385-make-nf-mcp-repair-discover-slot-names-d/) |
| 386 | Add coderlm status indicator to nf-statusline.js | 2026-04-08 | bebd81eb | Verified | [386-add-coderlm-status-indicator-to-nf-statu](./quick/386-add-coderlm-status-indicator-to-nf-statu/) |
| 387 | Improve River ML statusline indicator to use compact dot-style visual matching coderlm indicator pattern | 2026-04-08 | 8e6ff7e8 | Verified | [387-improve-river-ml-statusline-indicator-to](./quick/387-improve-river-ml-statusline-indicator-to/) |
| 388 | Add second tools-status line to nf-statusline showing coderlm/River/embed availability | 2026-04-09 | 573e1a21 | Verified | [388-add-tools-status-second-line-to-nf-statu](./quick/388-add-tools-status-second-line-to-nf-statu/) |
| 389 | Make install.js automatically download and install the coderlm binary... | 2026-04-09 | bf0931c2 | Verified | [389-make-install-js-automatically-download-a](./quick/389-make-install-js-automatically-download-a/) |
| 390 | Update ensureBinary() to build coderlm from source via git clone + cargo build | 2026-04-09 | 644142c6 | Verified | [390-update-ensurebinary-in-bin-coderlm-lifec](./quick/390-update-ensurebinary-in-bin-coderlm-lifec/) |
| 391 | Add auto-install steps for River and embed to install.js with statusline updates | 2026-04-09 | 2918e75c | Verified | [391-add-auto-install-steps-for-river-python-](./quick/391-add-auto-install-steps-for-river-python-/) |
| 393 | Rewrite nf:mcp-status to be fully dynamic | 2026-04-09 | 3dcaabff | Pending | [393-rewrite-nf-mcp-status-to-be-fully-dynami](./quick/393-rewrite-nf-mcp-status-to-be-fully-dynami/) |
| 394 | Fix hardcoded slot names in mcp-restart.md and mcp-set-model.md | 2026-04-09 | 75c8fdd1 | Verified | [394-fix-hardcoded-slot-names-in-mcp-restart-](./quick/394-fix-hardcoded-slot-names-in-mcp-restart-/) |
| 395 | Dynamic slot validation in mcp-update, fix codex-cli-1 refs in restart/set-model/quorum-test | 2026-04-09 | bad70b6d | Verified | [395-dynamic-slots-mcp-update-fix-refs](./quick/395-dynamic-slots-mcp-update-fix-refs/) |
| 395 | Make providers slot list dynamic — detect installed CLIs at startup and build active slots from what is found instead of hardcoding all slots in providers.json | 2026-04-09 | e4a6f606 | Verified | [395-make-providers-slot-list-dynamic-detect-](./quick/395-make-providers-slot-list-dynamic-detect-/) |
| 396 | Fill install.js CLI detection gaps: --rescan flag, CCR auto-include in promptProviders, strip hardcoded cli paths from providers.json | 2026-04-09 | 85e454a9 | Verified | [396-fill-install-js-cli-detection-gaps-add-r](./quick/396-fill-install-js-cli-detection-gaps-add-r/) |
