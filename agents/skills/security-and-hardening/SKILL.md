---
name: security-and-hardening
description: Applies a security-focused review and minimum hardening checks for changes involving trust boundaries, secrets, auth, or external integrations.
---

# security-and-hardening skill

Purpose
-------
Apply a reusable security review workflow to normal feature work. This skill packages the minimum security checks contributors should run before merge or release.

When to use
-----------
- A change accepts untrusted input
- Authentication, authorization, secrets, or external integrations are involved
- A release needs a minimum security hardening pass
- A reviewer wants a security-focused second look

High-level steps the skill should follow
----------------------------------------
1) Identify trust boundaries
  - What data enters from users, files, APIs, env vars, logs, or external services?
  - What privileged actions or sensitive state does the change touch?

2) Check boundary handling
  - Input validation and parsing
  - Authentication and authorization enforcement
  - Secret handling and logging discipline
  - Safe output handling and command execution boundaries

3) Check repo-level evidence
  - Secret scanning
  - Dependency and audit hygiene
  - Existing security scripts or headers where relevant

4) Classify risk and next step
  - Required fix
  - Launch blocker
  - Acceptable residual risk

Output format
-------------
Return a short security review with:

- `## Security Findings`
- `## Checks Performed`
- `## Residual Risk`
- `## Recommendation`

Best practices / rules
----------------------
- Treat all external input as untrusted.
- Do not trust client-side validation as a security boundary.
- Never normalize away secret leakage or unsafe logging.
- Call out missing authorization checks explicitly.
- Prefer narrowing privileges and surface area over compensating complexity.

Recommended nForma integration
------------------------------
- Use alongside `code-review-and-quality` for merge readiness.
- Use before `shipping-and-launch` for changes with auth, secrets, or external integrations.
- Reuse existing repo tooling where possible:
  - `node bin/security-sweep.cjs --json`
  - `npm audit`
  - secret scan workflows in `.github/workflows/secret-scan.yml`
- If material issues are found, route back to `/nf:debug` or `/nf:quick --full`.

Minimum checklist
-----------------
- Inputs validated at boundaries
- Sensitive output not logged
- Secrets stay out of code and docs
- Authorization enforced for privileged operations
- External commands or queries safely parameterized
- Release evidence includes relevant audit or sweep output when risk is non-trivial

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `security-and-hardening` skill in `addyosmani/agent-skills`, with emphasis on nForma's existing security scans and release workflow.
