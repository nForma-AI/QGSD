---
phase: quick-369
plan: 01
type: execute
wave: 1
completed: 2
duration: "~8 minutes"
completed_date: 2026-04-01
commits:
  - feat(quick-369): add project-level formal spec discovery with security hardening
  - docs(quick-369): apply quorum security revisions to plan
---

# Quick Task 370: Project-Level Formal Spec Discovery with Security Hardening

## Summary

Extended `formal-scope-scan.cjs` and `run-formal-check.cjs` to discover, register, and execute project-level formal specs from `.planning/formal/specs/formal-checks.json`, with quorum-recommended security hardening applied before execution.

## Quorum Review

Plan was reviewed by quorum before execution. Key revisions applied:
1. Removed `sh` from ALLOWED_COMMANDS (shell bypass risk)
2. Added DANGEROUS_ARG_PATTERNS gate (`-e`, `-c`, `--eval`, `--exec`, `-i`)
3. Added path containment checks (reject absolute paths, `../` traversal)
4. Unified manifest path resolution to use ROOT (git root) consistently
5. Added registry collision logging with stderr warnings

## What Was Built

### 1. Project Manifest Discovery (`formal-scope-scan.cjs`)

**New functions:**
- `loadProjectManifest()` — reads `.planning/formal/specs/formal-checks.json` with fail-open
- `matchProjectSpecs()` — matches description tokens against manifest keywords and module names
- `scanUnregisteredSpecs()` — reports `.tla/.als/.pm` files in specs/ not in manifest
- `mergeProjectSpecsIntoRegistry()` — in-memory merge with `source: "project"` marker

**Integration points:**
- After Layer 1 scope.json matching, before Layer 2 proximity enrichment
- In bug-mode branch: project specs merged into registry before bug matching
- All 4 functions exported for testing

### 2. Structured Command Execution (`run-formal-check.cjs`)

**New functions:**
- `loadProjectManifest()` — same fail-open pattern as scope-scan
- `runProjectCheck()` — executes manifest entries with 3 safety gates

**Safety gates (defense-in-depth):**
1. **Command allowlist** — only `make`, `java`, `node`, `npm`, `npx`, `python3`, `python`
2. **Dangerous argument patterns** — blocks `-e`, `-c`, `--eval`, `--exec`, `-i` (prevents `node -e`, `python3 -c`, etc.)
3. **Path containment** — `path.resolve()` + `startsWith()` check prevents traversal and absolute paths

**Integration:** Unknown modules now fall through to project manifest lookup before reporting as unknown (both java-missing and normal branches).

### 3. Template Manifest (`.planning/formal/specs/formal-checks.json`)

Empty manifest with `version: 1` and `specs: []` — ready for projects to populate.

## Test Coverage

17 tests, all passing:
- 5 existing (prism delegation, coverage, unknown modules, shape)
- 12 new:
  - loadProjectManifest returns empty array
  - ALLOWED_COMMANDS contains safe executables (no `sh`, `rm`, `curl`)
  - DANGEROUS_ARG_PATTERNS blocks `-e`, `-c`, `--eval`
  - runProjectCheck rejects disallowed commands
  - runProjectCheck rejects dangerous arg patterns
  - runProjectCheck rejects path traversal
  - runProjectCheck rejects absolute paths
  - runProjectCheck skips missing spec files
  - runProjectCheck returns pass for successful command
  - runProjectCheck returns fail for non-zero exit
  - Idempotent behavior verified
  - Unknown module fallthrough to manifest

## Invariant Preservation

- **Fail-open**: Missing/malformed manifest = no crash, no behavior change
- **No parallel registry**: Project specs merge into model-registry.json in-memory only
- **Internal wins**: nForma-internal registry entries never overwritten by project entries
- **Collision logged**: stderr warning when project key collides with internal key

## Files Modified

| File | Changes |
|------|---------|
| bin/formal-scope-scan.cjs | +130 lines (4 functions, integration, exports) |
| bin/run-formal-check.cjs | +100 lines (2 functions, safety gates, integration, exports) |
| bin/run-formal-check.test.cjs | +130 lines (12 new tests) |
| .planning/formal/specs/formal-checks.json | NEW: template manifest |

## Success Criteria Met

- [x] formal-scope-scan.cjs discovers project-level specs from manifest
- [x] Project specs merged into model-registry.json view with `source: "project"` marker
- [x] Manifest entries carry traceability (requirements, maturity, description)
- [x] scanUnregisteredSpecs() auto-discovers unregistered spec files
- [x] run-formal-check.cjs executes project checks via structured command/args
- [x] ALLOWED_COMMANDS allowlist gates execution (sh removed per quorum)
- [x] DANGEROUS_ARG_PATTERNS blocks -e/-c/--eval (per quorum)
- [x] Path containment prevents traversal attacks (per quorum)
- [x] Manifest path resolution unified to ROOT (per quorum)
- [x] Registry collision logged with warning (per quorum)
- [x] Both scripts fully fail-open
- [x] All 17 tests pass
