# Quorum Debate
Question: Review the SQLite schema plan against ALL JSON files in .planning/formal/. Are there gaps?
Date: 2026-03-10
Consensus: GAPS_FOUND
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | GAPS_FOUND: ~20 uncovered file types including alloy receipts (12), spec scopes (15), NDJSON files (3), invariant catalog, divergences, debt, state-space-report, archived-non-invariants, bug-to-property, TLA guards, task-classification, traceability baseline | .planning/formal/alloy/*/receipt.json, .planning/formal/spec/*/scope.json, .planning/formal/check-results.ndjson, .planning/formal/semantics/invariant-catalog.json, .planning/formal/semantics/mismatch-register.jsonl |
| codex-1 (primary) | UNAVAIL | -- |
| opencode-1 (T1 fallback) | UNAVAIL (local analysis: GAPS_FOUND — 31 files across 6 categories, estimates 93.8% coverage) | -- |
| gemini-1 (primary) | UNAVAIL | -- |
| copilot-1 (T1 fallback) | UNAVAIL (402 quota) | -- |
| claude-3 (T2 fallback) | GAPS_FOUND: 35 files uncovered across 6 categories. Recommends expanding from 34 to 46 tables. Identified 7+ scripts writing uncovered files. | .planning/formal/alloy/*/receipt.json, .planning/formal/spec/*/scope.json, .planning/formal/semantics/invariant-catalog.json, .planning/formal/tla/guards/qgsd-workflow.json |

## Outcome
Consensus: The schema is ~93% complete by file count but misses ~35 files across 6 critical categories. 12 additional tables are needed: alloy_receipts, alloy_conformance_events, spec_scopes, tla_guards, tla_task_classifications, invariant_catalog, mismatch_register, formal_check_results, divergences, archived_non_invariants, bug_to_property, debt_entries. Additionally, state_space_report, formal_test_sync_report, and traceability_baseline need explicit tables or handling.
