---
phase: quick-167
plan: 01
subsystem: formal-verification
tags: [project-agnostic, dynamic-discovery, solve-05]
dependency_graph:
  requires: []
  provides: [project-agnostic-formal-verify]
  affects: [bin/run-formal-verify.cjs, bin/run-tlc.cjs, bin/run-alloy.cjs, bin/write-check-result.cjs, bin/generate-formal-specs.cjs]
tech_stack:
  added: []
  patterns: [--project-root CLI flag, CHECK_RESULTS_ROOT env var, dynamic filesystem discovery]
key_files:
  created: []
  modified:
    - bin/run-formal-verify.cjs
    - bin/run-tlc.cjs
    - bin/run-alloy.cjs
    - bin/run-audit-alloy.cjs
    - bin/run-account-pool-alloy.cjs
    - bin/run-transcript-alloy.cjs
    - bin/run-installer-alloy.cjs
    - bin/run-quorum-composition-alloy.cjs
    - bin/run-oscillation-tlc.cjs
    - bin/run-breaker-tlc.cjs
    - bin/run-protocol-tlc.cjs
    - bin/run-account-manager-tlc.cjs
    - bin/run-stop-hook-tlc.cjs
    - bin/run-uppaal.cjs
    - bin/write-check-result.cjs
    - bin/generate-formal-specs.cjs
key_decisions:
  - "Dynamic discovery replaces hardcoded STEPS array -- all models in ROOT/.formal/ are found automatically"
  - "VALID_CONFIGS whitelist in run-tlc.cjs replaced with .cfg file existence check"
  - "generate-formal-specs.cjs exits 0 (not 1) when XState machine is missing"
metrics:
  duration: 10 min
  completed: 2026-03-04
---

# Quick Task 167: Make Formal Verification Harness Project-Agnostic (SOLVE-05)

Project-agnostic formal verification: all 16 runner scripts resolve paths from ROOT via --project-root flag; discoverModels() dynamically scans ROOT/.formal/ for TLA+/Alloy/PRISM/Petri/UPPAAL models; QGSD-specific prerequisites gracefully skip when missing.

## Changes

### Task 1: --project-root support for all runners (9fb6c48d)

Added `--project-root=<path>` CLI flag to all 16 runner scripts. Each script parses the flag near the top and uses ROOT instead of `__dirname/..` for all `.formal/` path resolution. Specific changes:

- **run-tlc.cjs**: Removed VALID_CONFIGS whitelist; now accepts any config name as long as the .cfg file exists at `ROOT/.formal/tla/<configName>.cfg`
- **write-check-result.cjs**: Added CHECK_RESULTS_ROOT env var support (priority: CHECK_RESULTS_PATH > CHECK_RESULTS_ROOT > __dirname fallback)
- **generate-formal-specs.cjs**: Changed exit code from 1 to 0 when XState machine is missing, with clear warning message
- **run-formal-verify.cjs**: Sets CHECK_RESULTS_ROOT env var when spawning child scripts; NDJSON truncation path uses ROOT
- **All Alloy runners** (6 files): JAR and ALS paths use ROOT
- **All TLA+ runners** (5 files): JAR, spec, and cfg paths use ROOT
- **run-uppaal.cjs**: Model, query, and verifyta paths use ROOT
- **run-prism.cjs, run-oauth-rotation-prism.cjs**: Already had --project-root (unchanged)

### Task 2: Dynamic model discovery (f3341590)

Refactored run-formal-verify.cjs to split the monolithic 34-step STEPS array into:
- **STATIC_STEPS** (11): generate, CI enforcement, triage, traceability steps
- **Dynamic steps** via `discoverModels(ROOT)`: scans ROOT/.formal/{tla,alloy,prism,petri,uppaal}/

Picker functions map known model names to specialized runners:
- `pickTLARunner()`: Maps MCoscillation->run-oscillation-tlc.cjs, MCbreaker->run-breaker-tlc.cjs, etc.
- `pickAlloyRunner()`: Maps quorum-votes->run-alloy.cjs, scoreboard-recompute->run-audit-alloy.cjs, etc.
- `pickPrismRunner()`: Maps quorum->run-prism.cjs, oauth-rotation->run-oauth-rotation-prism.cjs, etc.

Unknown models fall back to generic runners (run-tlc.cjs, run-alloy.cjs, run-prism.cjs).

### Task 3: Integration verification (no code changes)

Verified backward compatibility:
- QGSD discovers 82 models (11 static + 82 dynamic, 11 deduped = 82 unique dynamic steps)
- External project with MCexternal.cfg is discovered and attempted
- generate-formal-specs.cjs exits 0 when XState machine is missing
- NDJSON output writes to ROOT/.formal/check-results.ndjson

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `grep __dirname.*\.formal` in plan files | Zero matches |
| `grep project-root` in run-tlc/run-alloy/run-breaker-tlc | Each has 2+ matches |
| External project discovery | MCexternal discovered and attempted |
| generate-formal-specs graceful skip | Exit code 0 with warning |
| QGSD backward compatibility | All 82 models discovered |

## Self-Check: PASSED
