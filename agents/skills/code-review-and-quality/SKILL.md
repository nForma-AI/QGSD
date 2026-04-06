---
name: code-review-and-quality
description: Runs a reusable merge-readiness review across correctness, readability, architecture, security, performance, and verification evidence.
---

# code-review-and-quality skill

Purpose
-------
Provide a reusable review workflow before merge. This skill turns "looks fine" into a structured quality pass across correctness, readability, architecture, security, and performance.

When to use
-----------
- Before merging any non-trivial change
- After a bug fix, feature implementation, or refactor
- When reviewing code written by another agent or contributor
- When a quick task passed tests but still needs human-grade scrutiny

High-level steps the skill should follow
----------------------------------------
1) Understand intent
  - Identify the task, issue, or spec the change is meant to satisfy
  - Confirm the expected behavior shift before reviewing implementation details

2) Review the verification evidence first
  - Check which tests, builds, or manual flows were run
  - Treat missing evidence as a review concern, not as neutral context

3) Review the implementation on five axes
  - Correctness
  - Readability and simplicity
  - Architecture fit
  - Security impact
  - Performance impact

4) Classify findings
  - Use required findings for breakage, risk, or missing verification
  - Use optional findings for style or non-blocking improvements
  - Keep comments specific and actionable

5) Route the next step
  - If the change is not ready, point back to `/nf:quick`, `/nf:debug`, or `/nf:verify-work`
  - If the change is ready, summarize residual risks and merge confidence

Output format
-------------
Return a review report with:

- `## Findings`
- `## Verification Reviewed`
- `## Residual Risks`
- `## Merge Recommendation`

Findings should be ordered by severity. If no findings exist, state that explicitly.

Best practices / rules
----------------------
- Review tests before code where possible.
- Prioritize correctness and missing proof over style.
- Do not block on personal preference when the code clearly improves the system.
- Prefer concrete file/function references over vague review language.
- Flag dead code, accidental complexity, and unclear naming.
- Treat missing security checks or rollout evidence as real findings.

Recommended nForma integration
------------------------------
- Use after `/nf:quick --full` or `/nf:execute-phase` when implementation is done.
- Pair with `shipping-and-launch` before risky releases.
- If the review surfaces behavior gaps, send the work back through `/nf:verify-work` or `/nf:debug`.
- This skill complements `nf-verifier`; it does not replace the verifier's workflow checks.

Review axes
-----------
- Correctness: does the code satisfy the intended behavior and edge cases?
- Readability: can a new contributor understand it without author narration?
- Architecture: does it fit existing repo patterns and boundaries?
- Security: does it introduce trust-boundary mistakes or unsafe data handling?
- Performance: does it add obvious hot-path or scaling regressions?

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `code-review-and-quality` skill in `addyosmani/agent-skills`, with routing into nForma verification and quick-task workflows.
