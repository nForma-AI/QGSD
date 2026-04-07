---
name: nf:shipping-and-launch
description: Prepares a change for safe release with readiness checks, rollout planning, rollback triggers, and post-launch follow-through.
---

# shipping-and-launch skill

Purpose
-------
Prepare a change for safe release. This skill turns "we think it's ready" into a concrete launch plan covering verification, rollout, monitoring, rollback, and post-launch follow-up.

When to use
-----------
- A feature is ready to go live
- A release candidate needs a launch checklist
- A risky change needs staged rollout or rollback planning
- The team needs explicit go/no-go criteria before deployment

High-level steps the skill should follow
----------------------------------------
1) Confirm release scope
  - State what is shipping, who is affected, and the blast radius
  - Identify dependencies: migrations, config, flags, docs, support, or data backfills

2) Verify readiness
  - Confirm code review, test status, build status, and manual verification
  - Call out missing evidence explicitly
  - Prefer references to actual commands and artifacts already used in this repo

3) Build the rollout plan
  - Choose launch mode: dark launch, internal-only, canary, gradual rollout, or full release
  - Define the exact sequence of rollout steps and decision gates
  - State what metrics or symptoms block rollout progression

4) Define rollback
  - State the fastest safe rollback path
  - Include triggers for rollback and who should make the call
  - Note irreversible operations separately

5) Define post-launch follow-through
  - Monitoring window
  - Owner
  - Flag cleanup or follow-up tasks
  - User-facing comms or changelog updates if needed

Output format
-------------
Return a markdown launch brief with these sections:

- `# Launch Brief: <change>`
- `## Scope`
- `## Readiness Check`
- `## Rollout Plan`
- `## Metrics and Monitors`
- `## Rollback Plan`
- `## Post-Launch Tasks`
- `## Go / No-Go Recommendation`

Best practices / rules
----------------------
- "Ready" is evidence, not confidence. If a check did not run, say so.
- Prefer reversible launches.
- Prefer feature flags or staged exposure when available.
- Separate deploy from release when possible.
- List the exact commands or checks that should be run in this repo.
- Include rollback triggers, not just rollback mechanics.
- Keep launch plans small enough to execute under pressure.

Recommended nForma integration
------------------------------
- Use after `/nf:verify-work` confirms the feature behavior.
- Pull verification evidence from the same test commands used during execution.
- If launch risk is high, suggest an `/nf:observe` watch window immediately after release.
- If readiness is weak, route back to `/nf:debug`, `/nf:fix-tests`, or `/nf:verify-work` instead of forcing a launch.

Repo-specific checklist anchors
-------------------------------
- Fast verification: `npm run test:ci`
- Full suite: `npm test`
- Formal pipeline when relevant: `npm run test:formal` or `node bin/run-formal-verify.cjs`
- Release scripts: `scripts/prepare-release.sh`, `scripts/release.sh`, `scripts/publish.sh`
- Production observation entry point: `/nf:observe`

Edge cases
----------
- If the change includes destructive migrations or irreversible data writes, require an explicit backup and rollback note.
- If no monitoring exists for the affected area, mark launch risk as elevated and call that out in the recommendation.
- If this is an internal or prerelease launch, still define success signals and rollback triggers.

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `shipping-and-launch` skill in `addyosmani/agent-skills`, with nForma-specific verification and observation hooks.
