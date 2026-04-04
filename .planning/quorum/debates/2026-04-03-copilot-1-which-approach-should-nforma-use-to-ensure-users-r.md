---
date: 2026-04-03
question: "Which approach should nForma use to ensure users run nf:sync-baselines before workflows that depend on requirements.json? Option A: lightweight guard in nf:solve only (warning when no baseline requirements found). Option B: shared pre-flight check-baselines.cjs script added to solve, close-formal-gaps, formal-test-sync, and resolve. Option C: both the solve warning plus a nudge in nf:progress (the natural what-next entry point). Context: nf-solve.cjs silently skips layers E and K when requirements.json has no baselines, producing a deflated residual. new-project and new-milestone already call sync-baselines, but users adopting nForma on existing projects or running solve first never get prompted. Also: should the check be blocking (refuse to run) or advisory (warn and continue)?"
slot: copilot-1
round: 3
mode: "A"
verdict: Revised position: Choose Option C — add a lightweight, non-blocking warning in nf:solve plus a clear “run nf:sync-baselines” nudge in nf:progress, and make nf:solve set residual = -1 when baselines are missing (fixes DIAG-02/false convergence). Keep the default behavior advisory (warn-and-continue) to preserve the project’s fail-open culture, but provide an explicit --require-baselines/CI mode that fails fast for automated pipelines. A shared check-baselines.cjs is still recommended for .cjs com
matched_requirement_ids: [SENS-01, DETECT-01, DIAG-02, SCOPE-01, ENFC-03, STOP-05, TEST-01, TEST-02, DRIFT-02, PRED-02, REDACT-02, SCOPE-02, TRIAGE-01, UPPAAL-01, UPPAAL-02, UPS-02, UPS-05, SOLVE-09, DIAG-01, DRIFT-01]
artifact_path: ""
---

# Debate Trace: copilot-1 on round 3

## Reasoning
Revised position: Choose Option C — add a lightweight, non-blocking warning in nf:solve plus a clear “run nf:sync-baselines” nudge in nf:progress, and make nf:solve set residual = -1 when baselines are missing (fixes DIAG-02/false convergence). Keep the default behavior advisory (warn-and-continue) to preserve the project’s fail-open culture, but provide an explicit --require-baselines/CI mode tha

## Citations
(none)
