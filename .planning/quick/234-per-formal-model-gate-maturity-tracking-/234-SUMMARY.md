## Quick-234: Per-Formal-Model Gate Maturity Tracking

### What changed

1. **Created `bin/compute-per-model-gates.cjs`** — Per-model gate scoring CLI that evaluates which gates (A/B/C) each formal model passes:
   - Gate A (grounding): checks `has_semantic_declarations` in layer-manifest or passing trace checks
   - Gate B (abstraction): checks if model is referenced by L3 reasoning artifacts or is L3 with requirements
   - Gate C (validation): checks if model's failure modes have test recipes or has passing check-results
   - Computes `layer_maturity` (0-3) per model and auto-promotes eligible ADVISORY → SOFT_GATE → HARD_GATE
   - Supports `--json`, `--dry-run`, `--project-root=` flags

2. **Wired `sweepPerModelGates()` into `bin/nf-solve.cjs`** — New informational sweep layer:
   - Spawns `compute-per-model-gates.cjs --json` during solve iterations
   - Reports residual = count of models at layer_maturity 0
   - Added to formatReport display, formatJSON health keys, and module.exports
   - NOT added to `layer_total` (informational, like git_heatmap)

### Results

| Metric | Value |
|--------|-------|
| Total models | 112 |
| Gate A pass | 39 |
| Gate B pass | 94 |
| Gate C pass | 27 |
| Avg layer_maturity | 1.43 |
| Models at maturity 0 | 8 |
| Auto-promotions | 103 (ADVISORY → SOFT_GATE) |

### Files modified
- `bin/compute-per-model-gates.cjs` (new)
- `bin/nf-solve.cjs` (sweepPerModelGates + wiring)
- `.planning/formal/model-registry.json` (layer_maturity + gate_maturity updates)
