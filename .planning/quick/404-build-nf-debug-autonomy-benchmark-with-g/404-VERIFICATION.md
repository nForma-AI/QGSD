---
phase: quick-404
verified: 2026-04-17T00:00:00Z
status: passed
score: 6/6 must-haves verified
formal_check:
  passed: 4
  failed: 0
  skipped: 0
  counterexamples: []
---

# Quick Task 404: Build nf:debug Autonomy Benchmark Verification Report

**Task Goal:** Build nf:debug autonomy benchmark: buggy code stubs with failing tests across 3 difficulty tiers (easy/medium/hard), a bin/nf-debug-runner.cjs fix cycle (run failing test → debug-formal-context → call-quorum-slot.cjs for fix → apply → re-run test), and a bin/nf-benchmark-debug.cjs standalone runner that scores 0–100 based on the fraction of bugs the AI pipeline fixes.

**Verified:** 2026-04-17
**Status:** PASSED
**Score:** 6/6 must-haves verified

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running any test file in benchmarks/debug/tests/ produces a non-zero exit code (test fails on the buggy stub) | ✓ VERIFIED | All 7 test files tested: sort, filter, counter, dedup, accumulator, parser, scheduler all exit with code 1 when run against their paired buggy stubs |
| 2 | bench-buggy-sort.cjs returns definitively wrong output (e.g., [3,2,1] for input [3,1,2] — sorts descending instead of ascending) | ✓ VERIFIED | Tested: buggySort([3,1,2]) returns [3,2,1] (descending), not [1,2,3] (ascending). Observable wrong output confirmed. |
| 3 | Each medium/hard stub produces wrong output detectable without running equal-element edge cases | ✓ VERIFIED | dedup coerces numeric/string keys ('1' ≡ 1); accumulator adds instead of multiplies; parser drops last char via -1; scheduler inverts comparison (max instead of min). All observable in unit test assertions. |
| 4 | bin/nf-debug-runner.cjs exits 0 with --dry-run for any stub path without calling external AI | ✓ VERIFIED | Tested: `node bin/nf-debug-runner.cjs --stub bin/bench-buggy-sort.cjs --test benchmarks/debug/tests/sort.test.cjs --dry-run` exits 0 and emits JSON `{ dry_run: true, stub, test }`. No AI invoked. |
| 5 | bin/nf-benchmark-debug.cjs --dry-run prints 7 stub IDs and a 0–100 score line without invoking AI | ✓ VERIFIED | `node bin/nf-benchmark-debug.cjs --dry-run` outputs all 7 stub IDs (sort, filter, counter, dedup, accumulator, parser, scheduler) with tiers and score line "Score: 0/100 (dry run — no AI invoked)". `--json` variant outputs valid JSON with 7 stubs in array, total: 7. |
| 6 | baseline.json reflects a realistic easy-tier floor (pass_rate 43, representing 3/7 easy stubs expected fixed by AI pipeline) | ✓ VERIFIED | benchmarks/debug/baseline.json: pass_rate=43, updated_at=2026-04-17, note explains 3 easy / 7 total = 43%. Correct value and explanation present. |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| bin/bench-buggy-sort.cjs | ✓ VERIFIED | Correct bug: comparison `a[i] < a[j]` reverses sort order (descending). Produces [3,2,1] for [3,1,2]. Observable wrong output. |
| bin/bench-buggy-medium-dedup.cjs | ✓ VERIFIED | Correct bug: string coercion `const key = '' + x;` treats 1 and "1" as duplicates. Output [1,2] instead of [1,"1",2]. |
| bin/bench-buggy-medium-accumulator.cjs | ✓ VERIFIED | Correct bug: `acc + x` instead of `acc * x` in product. Output 10 instead of 24 for [2,3,4]. |
| bin/bench-buggy-hard-parser.cjs | ✓ VERIFIED | Correct bug: `slice(start, i - 1)` drops last char. Output ["hell","worl"] instead of ["hello","world"]. |
| bin/bench-buggy-hard-scheduler.cjs | ✓ VERIFIED | Correct bug: `>` instead of `<` in comparison. Returns max priority instead of min. Output 'a' instead of 'b'. |
| benchmarks/debug/tests/sort.test.cjs | ✓ VERIFIED | Exists, uses `'use strict'` and CommonJS require, exits 1 on buggy stub. |
| benchmarks/debug/tests/filter.test.cjs | ✓ VERIFIED | Exists, uses `'use strict'` and CommonJS require, exits 1 on buggy stub. |
| benchmarks/debug/tests/counter.test.cjs | ✓ VERIFIED | Exists, uses `'use strict'` and CommonJS require, exits 1 on buggy stub. |
| benchmarks/debug/tests/dedup.test.cjs | ✓ VERIFIED | Exists, uses `'use strict'` and CommonJS require, exits 1 on buggy stub. |
| benchmarks/debug/tests/accumulator.test.cjs | ✓ VERIFIED | Exists, uses `'use strict'` and CommonJS require, exits 1 on buggy stub. |
| benchmarks/debug/tests/parser.test.cjs | ✓ VERIFIED | Exists, uses `'use strict'` and CommonJS require, exits 1 on buggy stub. |
| benchmarks/debug/tests/scheduler.test.cjs | ✓ VERIFIED | Exists, uses `'use strict'` and CommonJS require, exits 1 on buggy stub. |
| bin/nf-debug-runner.cjs | ✓ VERIFIED | Implements full fix-cycle: run test → assemble formal context → call quorum → extract code → validate syntax → apply → re-run. Has shebang, pre-flight checks for debug-formal-context.cjs and call-quorum-slot.cjs, try/finally for stub restoration, timeout handling (default 150s). |
| bin/nf-benchmark-debug.cjs | ✓ VERIFIED | Standalone scorer: defines 7-stub registry internally, supports --dry-run and --json, wraps each stub in try/finally for restoration, computes score = (fixed/7)*100, exits 0. Default timeout 180s. |
| benchmarks/debug/baseline.json | ✓ VERIFIED | Valid JSON with pass_rate=43, updated_at=2026-04-17, clear note explaining easy-tier floor rationale. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| bin/nf-benchmark-debug.cjs | bin/nf-debug-runner.cjs | spawnSync per stub | ✓ WIRED | Line 27: `const NF_DEBUG_RUNNER = path.join(__dirname, 'nf-debug-runner.cjs');` Line 87: `spawnSync('node', [NF_DEBUG_RUNNER].concat(runnerArgs))` — called per stub in forEach loop (lines 66-126). |
| bin/nf-debug-runner.cjs | bin/debug-formal-context.cjs | spawnSync --description flag | ✓ WIRED | Lines 34, 39: Path resolved and checked for existence. Line 76: `spawnSync('node', [DEBUG_FORMAL_CTX, '--description', description, '--format', 'json'])` — called during test failure path. |
| bin/nf-debug-runner.cjs | bin/call-quorum-slot.cjs | spawnSync with prompt on stdin | ✓ WIRED | Lines 35, 43: Path resolved and checked for existence. Line 104: `spawnSync('node', [CALL_QUORUM_SLOT, '--slot', 'coding'], { input: prompt })` — called to request fix. |
| benchmarks/debug/tests/*.test.cjs | bin/bench-buggy-*.cjs | require('../../../bin/bench-buggy-*.cjs') | ✓ WIRED | All 7 test files import their paired stub: sort.test → bench-buggy-sort, filter.test → bench-buggy-filter, etc. Each test calls the stub function and asserts output. |

### Formal Verification

**Status: PASSED**

| Checks | Result |
|--------|--------|
| Passed | 4 |
| Failed | 0 |
| Skipped | 0 |

Formal model checker verified quorum and agent-loop invariants. No counterexamples found.

### Code Quality

| Category | Status | Details |
|----------|--------|---------|
| Syntax | ✓ VERIFIED | All files use `'use strict'` at top, CommonJS require/exports, valid JavaScript. No syntax errors. |
| Structure | ✓ VERIFIED | Shebang present in runner scripts. Pre-flight checks for dependencies. Try/finally for error handling and restoration. |
| Error Handling | ✓ VERIFIED | nf-debug-runner: timeout detection (SIGTERM, ETIMEDOUT), syntax validation via `new Function()`, JSON error responses. nf-benchmark-debug: try/finally stub restoration, catch blocks for file I/O. |
| Timeout Configuration | ✓ VERIFIED | nf-debug-runner default 150s (increased from 120s for provider latency). nf-benchmark-debug default 180s per stub. Both support --timeout flag. |
| Code Block Extraction | ✓ VERIFIED | Robust regex: `/```(?:js\|javascript)?\n?([\s\S]*?)\n?```/` handles format variations (with/without lang tag, extra newlines). |
| Idempotency | ✓ VERIFIED | nf-benchmark-debug wraps each stub in try/finally and always restores original source (lines 70-122), guaranteeing idempotency even on crash or timeout. |
| Anti-Patterns | ✓ VERIFIED | No TODO, FIXME, placeholder, or empty implementations found. All functions have substantive code. |

### Requirements Coverage

The plan declared requirement [BENCH-DEBUG-01]. This requirement maps to the goal: "Build the nf:debug autonomy benchmark with 7 stubs, 7 tests, 2 runners, and updated baseline." All components present and verified.

---

## Summary

All 6 must-haves verified:

1. **Failing Tests:** 7 test files, all exit 1 on buggy stubs. Observable failures logged to stderr.
2. **Observable Bugs:** sort returns [3,2,1] (wrong); dedup coerces keys; accumulator adds; parser drops char; scheduler inverts comparison. All detectable in unit tests without edge-case hunting.
3. **Dry-Run Protocol:** nf-debug-runner exits 0 with --dry-run, prints JSON, no AI called. nf-benchmark-debug --dry-run lists all 7 stubs and prints score line.
4. **Fix-Cycle Runner:** nf-debug-runner implements full protocol: test → context → quorum → syntax check → apply → re-run, with pre-flight checks, timeout handling, syntax validation, and try/finally restoration.
5. **Benchmark Scorer:** nf-benchmark-debug defines 7-stub registry, scores 0–100 (fixed/7*100), supports --json, idempotent via try/finally stub restoration.
6. **Baseline Updated:** benchmarks/debug/baseline.json has pass_rate=43, explaining 3 easy stubs as realistic floor (43% = 3/7).

**Formal verification:** 4 checks passed, 0 failed, no counterexamples. Quorum and agent-loop invariants satisfied.

**Task Status:** COMPLETE. Goal achieved. Ready for integration into nf:debug autonomy pipeline.

---

_Verified: 2026-04-17_
_Verifier: Claude (nf-verifier)_
