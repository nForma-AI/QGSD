---
date: 2026-04-03
question: "Which approach should nForma use to ensure users run nf:sync-baselines before workflows that depend on requirements.json? Option A: lightweight guard in nf:solve only (warning when no baseline requirements found). Option B: shared pre-flight check-baselines.cjs script added to solve, close-formal-gaps, formal-test-sync, and resolve. Option C: both the solve warning plus a nudge in nf:progress (the natural what-next entry point). Context: nf-solve.cjs silently skips layers E and K when requirements.json has no baselines, producing a deflated residual. new-project and new-milestone already call sync-baselines, but users adopting nForma on existing projects or running solve first never get prompted. Also: should the check be blocking (refuse to run) or advisory (warn and continue)?"
slot: codex-1
round: 3
mode: "A"
verdict: I maintain Option C, advisory not blocking. Re-checking the repo reinforced that the clean, high-signal fix is to warn in `nf:solve` at the point where missing baseline-backed `requirements.json` distorts residuals, and add a “run `nf:sync-baselines` next” nudge in `nf:progress`, which is the natural entry point for users deciding what to do next. A shared `check-baselines.cjs` is only cleanly hookable for true script surfaces like `bin/nf-solve.cjs` and `bin/formal-test-sync.cjs`; `commands/nf/
matched_requirement_ids: [SENS-01, DETECT-01, DIAG-02, SCOPE-01, ENFC-03, STOP-05, TEST-01, TEST-02, DRIFT-02, PRED-02, REDACT-02, SCOPE-02, TRIAGE-01, UPPAAL-01, UPPAAL-02, UPS-02, UPS-05, SOLVE-09, DIAG-01, DRIFT-01]
artifact_path: ""
---

# Debate Trace: codex-1 on round 3

## Reasoning
I maintain Option C, advisory not blocking. Re-checking the repo reinforced that the clean, high-signal fix is to warn in `nf:solve` at the point where missing baseline-backed `requirements.json` distorts residuals, and add a “run `nf:sync-baselines` next” nudge in `nf:progress`, which is the natural entry point for users deciding what to do next. A shared `check-baselines.cjs` is only cleanly hoo

## Citations
(none)
