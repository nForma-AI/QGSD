# Plan: Migrate `.planning/formal/` JSON to SQLite

## Context

The `nf:solve` loop and formal verification pipeline currently manage **494 JSON files** (~10MB) in `.planning/formal/`. Every read parses the full file; every write serializes the entire object. The largest files (git-heatmap 2.8MB, proximity-index 1MB) are loaded fully even when only a few rows are needed. There is no schema enforcement — structure drifts silently.

**Goal**: Replace all 494 JSON files with a single SQLite database (`.planning/formal.db`) using `better-sqlite3`. This gives us schema enforcement, indexed queries, transactional writes, and eliminates 417 generated-stub files.

**Quorum review** (2026-03-10): Original 34-table schema was ~93% complete. Quorum identified 35 uncovered files across 6 categories. Schema expanded to **46 tables** covering 100% of JSON/NDJSON/JSONL files.

---

## Phase 1: Foundation (`bin/formal-db.cjs` + schema)

### 1a. Add `better-sqlite3` dependency
- `npm install better-sqlite3`

### 1b. Create `bin/formal-db.cjs` — access layer

Single-file module with:
- **Lazy singleton** DB connection (WAL mode, foreign keys ON)
- **Schema bootstrap** — `ensureSchema()` creates all tables + indexes if missing
- **Loader functions** — return same shapes as current JSON loaders (drop-in compatible)
- **Writer functions** — transactional DELETE+INSERT (matches current full-rewrite pattern)
- **New targeted queries** — `getRequirementById()`, `getModelByPath()`, `bfsReach()` (recursive CTE)

### Tables (46 tables across 14 groups)

<details><summary>Group 1: Requirements & Traceability (7 tables)</summary>

- `requirements` (id PK, text, category, category_raw, status, provenance JSON, formal_models JSON)
- `requirements_envelope` (key PK, aggregated_at, content_hash, schema_version)
- `traceability_properties` (requirement_id FK, model_file, property_name, latest_result, check_id)
- `unit_test_coverage` (requirement_id PK, covered BOOL)
- `unit_test_cases` (requirement_id FK, test_file, test_name)
- `category_groups` (raw_category PK, normalized)
- `phases` + `phase_requirements` junction
</details>

<details><summary>Group 2: Models & Complexity (5 tables)</summary>

- `models` (path PK, version, source_layer, gate_maturity, layer_maturity, description, metadata JSON)
- `model_requirements` (model_path FK, requirement_id FK)
- `model_registry_meta` (singleton: version, last_sync)
- `model_complexity` (model_path PK FK, formalism, runtime_ms, estimated_states, risk_level)
- `layer_manifest` (path PK, layer, description, grounding_status)
</details>

<details><summary>Group 3: Gates & Promotion (3 tables)</summary>

- `gate_scores` (gate_name PK, score, target, target_met, details JSON)
- `per_model_gates` (model_path PK FK, gate_a_pass, gate_b_pass, gate_c_pass, stability_status, etc.)
- `promotion_changelog` (id AUTOINCREMENT, model, from_level, to_level, timestamp, trigger)
</details>

<details><summary>Group 4: Solve State & Convergence (8 tables)</summary>

- `solve_state` (singleton: converged, iteration_count, final_residual_total)
- `solve_known_issues` (layer, residual, net_residual)
- `solve_classifications` (layer+key PK, classification)
- `archived_solve_items` (key, type, summary, doc_file, value, archived_at)
- `acknowledged_false_positives` (doc_file, source, value, type, reason)
- `acknowledged_not_required` (file_or_claim, category, reason)
- `solve_trend` (timestamp, layer, residual, trend, z_score, oscillation_count)
- `oscillation_verdicts` (layer PK, trend, z_score, blocked)
</details>

<details><summary>Group 5: Evidence (7 tables + 2 blobs)</summary>

- `failure_taxonomy` (tool, formalism, result, check_id, triage_tags JSON, requirement_ids JSON)
- `git_heatmap` (singleton blob — 2.8MB, queried rarely)
- `git_history_evidence` (singleton blob — 1.6MB)
- `instrumentation_map` (file, line_number, action, state_variables JSON)
- `proposed_metrics` (metric_name PK, metric_type, tier, source_model, status)
- `state_candidates` (from_action, to_action, count)
- `trace_corpus_stats` (singleton blob — sessions array)
- `event_vocabulary` (action PK, source, xstate_event, layer)
</details>

<details><summary>Group 6: Reasoning/FMEA (3 tables)</summary>

- `hazards` (id PK, state, event, to_state, severity, occurrence, detection, rpn, derived_from JSON)
- `failure_modes` (id PK, state, event, to_state, failure_mode, description, severity_class, derived_from JSON)
- `risk_heatmap` (state, event, to_state, rpn, risk_score, risk_tier, derived_from JSON)
</details>

<details><summary>Group 7: Semantics (4 tables) — EXPANDED from 2</summary>

- `observed_fsm` (state+event PK, to_state, count, source)
- `assumption_register` (singleton blob — 166KB)
- `invariant_catalog` (id PK, invariant_text, source_model, layer, classification, metadata JSON) — **NEW** covers `semantics/invariant-catalog.json`
- `mismatch_register` (id PK, timestamp, l2_source, expected_state, actual_state, divergence_type, resolution, classification) — **NEW** covers `semantics/mismatch-register.jsonl`
</details>

<details><summary>Group 8-9: Recipes & Stubs (2 tables)</summary>

- `test_recipes` (id PK, failure_mode_id, title, setup, input_sequence JSON, expected_outcome)
- `generated_stubs` (requirement_id PK, requirement_text, formal_property JSON, source_files JSON, test_strategy, template)
</details>

<details><summary>Group 10: Proximity Graph (3 tables)</summary>

- `proximity_nodes` (key PK, type) — composite key format `type::id`
- `proximity_edges` (from_key FK, to_key, rel) — indexed both directions for BFS
- `proximity_sources` (path PK, mtime, hash)
</details>

<details><summary>Group 11: Formal Verification Artifacts (2 tables) — NEW</summary>

- `alloy_receipts` (id AUTOINCREMENT, model_name TEXT, run_dir TEXT, timestamp, result JSON, commands JSON) — covers 12 `alloy/*/receipt.json` files
- `alloy_conformance_events` (id AUTOINCREMENT, type, timestamp, data JSON) — covers `alloy/.planning/conformance-events.jsonl`
</details>

<details><summary>Group 12: Specification Scopes & TLA+ (3 tables) — NEW</summary>

- `spec_scopes` (workflow_name PK, source_files JSON, concepts JSON, requirements JSON) — covers 15 `spec/*/scope.json` files
- `tla_guards` (guard_name PK, expression TEXT, metadata JSON) — covers `tla/guards/qgsd-workflow.json`
- `tla_task_classifications` (id AUTOINCREMENT, timestamp, complexity, tier, thinking_budget INTEGER, metadata JSON) — covers `tla/.planning/task-classification.json`
</details>

<details><summary>Group 13: Operational Reports & Baselines (5 tables) — NEW</summary>

- `formal_check_results` (id AUTOINCREMENT, tool, formalism, result, timestamp, check_id, surface, property, runtime_ms, summary, triage_tags JSON, requirement_ids JSON, metadata JSON) — covers `check-results.ndjson` (450 lines)
- `state_space_report` (key PK DEFAULT 'current', data JSON) — covers `state-space-report.json`
- `formal_test_sync_report` (key PK DEFAULT 'current', generated_at, data JSON) — covers `formal-test-sync-report.json`
- `traceability_baseline` (key PK DEFAULT 'current', data JSON, frozen_at TEXT) — covers `traceability-matrix.baseline.json`
- `divergences` (key PK DEFAULT 'current', data JSON) — covers `.divergences.json`
</details>

<details><summary>Group 14: Utility & Archived Data (3 tables) — NEW</summary>

- `archived_non_invariants` (id AUTOINCREMENT, archived_at, reason, entry JSON) — covers `archived-non-invariants.json`
- `bug_to_property` (id AUTOINCREMENT, bug_id TEXT, property_ref TEXT, model_file TEXT, metadata JSON) — covers `bug-to-property.json`
- `debt_entries` (id AUTOINCREMENT, description TEXT, severity TEXT, created_at, resolved_at, metadata JSON) — covers `debt.json`
</details>

### Constants mapping (already in Group 2 but clarified)
- `constants_mapping` table already defined in Group 2 — covers `constants-mapping.json`

### JSON Schema files (4 files — NOT migrated)
- `requirements.schema.json`, `check-result.schema.json`, `debt.schema.json`, `policy.schema.json`
- These are validation schemas, not data. They stay as files and are used by `ajv` at runtime.
- Future: embed in a `schema_definitions` table if needed.

### Key indexes
- `requirements(category)`, `requirements(status)`
- `models(source_layer)`, `models(gate_maturity)`
- `traceability_properties(requirement_id)`, `traceability_properties(model_file)`
- `proximity_edges(from_key)`, `proximity_edges(to_key)`
- `solve_trend(layer, timestamp)`
- `promotion_changelog(model)`, `promotion_changelog(timestamp)`
- `formal_check_results(check_id)`, `formal_check_results(timestamp)`
- `alloy_receipts(model_name)`, `alloy_receipts(run_dir)`
- `spec_scopes(workflow_name)` (already PK)
- `mismatch_register(resolution)` — for filtering open vs resolved

---

## Phase 2: Migration script (`bin/migrate-formal-to-sqlite.cjs`)

Standalone script that:
1. Creates `formal.db` with full schema (46 tables)
2. Reads each JSON/NDJSON/JSONL file, parses, inserts via prepared statements in transaction batches
3. Special handling:
   - `check-results.ndjson` → line-by-line parse into `formal_check_results`
   - `semantics/mismatch-register.jsonl` → line-by-line parse into `mismatch_register`
   - `alloy/.planning/conformance-events.jsonl` → line-by-line parse into `alloy_conformance_events`
   - `alloy/*/receipt.json` → glob + parse each into `alloy_receipts`
   - `spec/*/scope.json` → glob + parse each into `spec_scopes`
   - `generated-stubs/*.stub.recipe.json` → glob + parse each into `generated_stubs`
4. Validates row counts against source files
5. Prints summary table
6. Flags: `--force` (drop+recreate), `--dry-run` (validate only)
7. Adds `.planning/formal.db` + WAL/SHM to `.gitignore`

---

## Phase 3: Bridge layer in `formal-core.cjs` + `requirements-core.cjs`

Update the two shared data loaders (used by all consumers):

**`formal-core.cjs`** — replace `loadJSON()` calls:
```js
// Before:
function loadModelRegistry(basePath) {
  return loadJSON(basePath, '.planning/formal/model-registry.json') || { models: {} };
}
// After:
function loadModelRegistry(basePath) {
  return formalDb.loadModelRegistry();  // same shape returned
}
```

**`requirements-core.cjs`** — replace `readRequirementsJson()` and `readModelRegistry()`.

All downstream consumers (TUI, solve loop, gates) get SQLite automatically with zero changes.

---

## Phase 4: Update writers (Tier 1-2 scripts)

Update scripts that currently do `writeFileSync` + `JSON.stringify`:

| Script | Writes to |
|--------|-----------|
| `bin/nf-solve.cjs` | solve-state, solve-trend, classifications |
| `bin/compute-per-model-gates.cjs` | per-model-gates, gate scores, promotion-changelog |
| `bin/promote-gate-maturity.cjs` | model-registry |
| `bin/formal-proximity.cjs` | proximity-index (nodes + edges) |
| `bin/aggregate-requirements.cjs` | requirements |

Each writer switches from `fs.writeFileSync(path, JSON.stringify(data))` to `formalDb.save*(data)`.

---

## Phase 5: Update remaining writers (Tier 3-7)

Evidence generators, FMEA generators, stub generators, and newly-covered scripts:

| Script | Writes to (table) |
|--------|-----------|
| `bin/invariant-catalog.cjs` | `invariant_catalog` |
| `bin/mismatch-register.cjs` | `mismatch_register` |
| `bin/formal-scope-scan.cjs` | `spec_scopes` |
| `bin/build-phase-index.cjs` | `phases` + `phase_requirements` |
| `bin/budget-tracker.cjs` | `debt_entries` |
| `bin/task-classifier.cjs` | `tla_task_classifications` |
| Alloy verification tools | `alloy_receipts` |
| `bin/formal-test-sync.cjs` | `formal_test_sync_report` |
| `bin/analyze-state-space.cjs` | `state_space_report` |
| `bin/validate-invariant.cjs` | `archived_non_invariants` |
| Formal check runners | `formal_check_results` (append) |

---

## Phase 6: Tests + cleanup

1. Add `test/formal-db.test.cjs` — round-trip fidelity tests (JSON import → DB load → compare shapes)
2. Run existing test suite — all should pass since API shapes are preserved
3. Add `npm run db:migrate` script to package.json
4. Update `.planning/formal/` — keep JSON files as read-only archive initially, remove in follow-up

---

## Critical files to modify

| File | Role |
|------|------|
| `bin/formal-db.cjs` | **NEW** — SQLite access layer (46 tables) |
| `bin/migrate-formal-to-sqlite.cjs` | **NEW** — migration script |
| `bin/formal-core.cjs` | Bridge loaders to DB |
| `bin/requirements-core.cjs` | Bridge loaders to DB |
| `bin/nf-solve.cjs` | Switch writers |
| `bin/compute-per-model-gates.cjs` | Switch writers (6 JSON files) |
| `bin/promote-gate-maturity.cjs` | Switch writers |
| `bin/formal-proximity.cjs` | Switch writers (graph decomposition) |
| `bin/formal-query.cjs` | Switch BFS to recursive CTE |
| `bin/invariant-catalog.cjs` | Switch writers |
| `bin/formal-scope-scan.cjs` | Switch writers |
| `bin/formal-test-sync.cjs` | Switch writers |
| `package.json` | Add `better-sqlite3` dep + `db:migrate` script |
| `.gitignore` | Add `formal.db*` |

---

## Coverage summary

| Group | Tables | Files covered |
|-------|--------|--------------|
| 1. Requirements & Traceability | 7 | requirements.json, traceability-matrix.json, unit-test-coverage.json, category-groups.json, phase-index.json |
| 2. Models & Complexity | 5 | model-registry.json, model-complexity-profile.json, layer-manifest.json, constants-mapping.json |
| 3. Gates & Promotion | 3 | gate-a/b/c-grounding.json, per-model-gates.json, promotion-changelog.json |
| 4. Solve State | 8 | solve-state.json, solve-classifications.json, archived-solve-items.json, acknowledged-*.json, solve-trend.jsonl, oscillation-verdicts.json |
| 5. Evidence | 9 | failure-taxonomy.json, git-heatmap.json, git-history-evidence.json, instrumentation-map.json, proposed-metrics.json, state-candidates.json, trace-corpus-stats.json, event-vocabulary.json |
| 6. Reasoning/FMEA | 3 | hazard-model.json, failure-mode-catalog.json, risk-heatmap.json |
| 7. Semantics | 4 | observed-fsm.json, assumption-register.json, invariant-catalog.json, mismatch-register.jsonl |
| 8-9. Recipes & Stubs | 2 | test-recipes.json, 417 generated-stubs/*.stub.recipe.json |
| 10. Proximity Graph | 3 | proximity-index.json |
| 11. Formal Verification | 2 | 12 alloy/*/receipt.json, conformance-events.jsonl |
| 12. Spec Scopes & TLA+ | 3 | 15 spec/*/scope.json, tla/guards/qgsd-workflow.json, tla/.planning/task-classification.json |
| 13. Reports & Baselines | 5 | check-results.ndjson, state-space-report.json, formal-test-sync-report.json, traceability-matrix.baseline.json, .divergences.json |
| 14. Utility & Archived | 3 | archived-non-invariants.json, bug-to-property.json, debt.json |
| **TOTAL** | **46** | **490 data files** (4 .schema.json files kept as files) |

---

## Verification

1. `node bin/migrate-formal-to-sqlite.cjs` — imports all 494 files, prints count summary (expect 490 data files migrated, 4 schema files skipped)
2. `npm test` — existing 671 tests pass (shapes preserved)
3. `node bin/formal-db.cjs --self-test` — round-trip fidelity check
4. `/nf:solve` — runs one iteration successfully against DB instead of JSON
5. `ls -la .planning/formal.db` — single file replaces 490 JSON/NDJSON/JSONL files
