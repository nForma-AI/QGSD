---
name: nf:ci-cd-and-automation
description: Guides CI/CD pipeline design — quality gates, deployment strategies, environment management, and pipeline optimization.
---

# ci-cd-and-automation skill

Purpose
-------
Design and maintain CI/CD pipelines that catch issues early and deploy safely. The core principle: detect problems as early as possible in the pipeline, because fixing lint issues costs minutes while debugging production failures costs hours.

When to use
-----------
- Setting up CI/CD for a new project
- Adding or modifying quality gates in an existing pipeline
- Designing deployment strategies (staging, canary, rollback)
- Optimizing slow pipelines
- When the user asks about CI, CD, GitHub Actions, or deployment automation

Core principles
---------------
1) **Shift left** — move validation upstream. Lint before test, test before build, build before deploy.

2) **No gate skipping** — if lint fails, fix lint. Don't disable the rule. Every gate exists for a reason.

3) **Faster is safer** — small, frequent deployments reduce risk. A 3-change release is easier to debug than one with 30 changes.

Quality gate pipeline
---------------------
Every PR should pass these checks in order:
1. Lint (eslint, prettier, or equivalent)
2. Type checking (tsc, mypy, or equivalent)
3. Unit tests
4. Build verification
5. Integration tests (API, database)
6. E2E tests (if applicable)
7. Security audit (npm audit, pip audit)
8. Bundle/artifact size checks (if applicable)

Deployment strategies
---------------------
- **Preview deployments**: auto-deploy every PR for manual testing
- **Feature flags**: decouple deployment from release; ship incomplete features safely
- **Staged rollouts**: auto-deploy to staging, manual trigger for production with monitoring window
- **Rollback**: every deployment must be reversible — have a rollback mechanism ready

Environment management
----------------------
- `.env.example` — committed (template for developers)
- `.env` — gitignored (local secrets)
- `.env.test` — committed (test fixtures, no real secrets)
- CI/production — use a secrets manager, never hardcode

Pipeline optimization (when > 10 minutes)
------------------------------------------
1. Cache dependencies (e.g., `setup-node` with cache)
2. Parallelize independent jobs (lint, typecheck, test run separately)
3. Use path filters (skip unrelated jobs)
4. Matrix builds (shard large test suites)
5. Move slow tests to scheduled runs
6. Consider larger runners for CPU-bound work

Verification checklist
----------------------
- [ ] All quality gates present and running in order
- [ ] Pipeline triggers on every PR and main push
- [ ] Failures block merge (branch protection enabled)
- [ ] Secrets use a manager, not code or config files
- [ ] Rollback mechanism exists and has been tested
- [ ] Pipeline completes in under 10 minutes

Integration with nForma
------------------------
- nForma's own CI uses GitHub Actions with lockfile sync, asset staleness, and lint-isolation gates
- For nForma-specific CI gates, see CLAUDE.md "CI gates to remember" section
- Reference `references/security-checklist.md` for CI/CD security practices
- For release automation, see `scripts/prepare-release.sh` and `scripts/release.sh`

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `ci-cd-and-automation` skill in `addyosmani/agent-skills`.
