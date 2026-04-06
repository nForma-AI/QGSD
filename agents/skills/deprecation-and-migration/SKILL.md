---
name: nf:deprecation-and-migration
description: Guides safe deprecation and migration — decide what to remove, build the replacement, migrate consumers, and clean up completely.
---

# deprecation-and-migration skill

Purpose
-------
Safely remove, replace, or sunset code, APIs, features, or systems. Most teams are good at building but struggle with sunsetting. This skill provides the discipline for clean removal.

When to use
-----------
- Replacing an old system, API, or module with a new one
- Consolidating duplicate implementations
- Removing unmaintained code or features
- Planning the lifecycle of a new feature (design for eventual removal)
- When the user asks about deprecation, migration, or sunsetting

Decision framework
------------------
Before deprecating, answer these questions:
1. Does this system still provide unique value?
2. How many consumers depend on it?
3. Is a replacement available and validated?
4. What is the migration cost per consumer?
5. What is the ongoing maintenance cost if kept?

If the maintenance cost exceeds migration cost and a replacement exists, proceed.

High-level steps
----------------
1) Build the replacement first
  - Cover all critical use cases of the old system
  - Validate in production before announcing deprecation
  - Do not announce deprecation without a working alternative

2) Announce clearly
  - State what is deprecated, why, and when it will be removed
  - Provide a migration guide with concrete before/after examples
  - Set a specific timeline (not "soon" or "eventually")

3) Migrate incrementally
  - Migrate one consumer at a time
  - The team that owns the infrastructure owns the migration burden
  - Use adapters or feature flags for gradual rollover
  - Track migration progress visibly

4) Remove completely
  - Verify zero active usage before removal
  - Delete the code entirely — no commented-out blocks or tombstones
  - Remove all references: docs, config, imports, tests
  - Remove the deprecation notice itself

Migration patterns
------------------
- **Strangler**: Run old and new in parallel; shift traffic gradually
- **Adapter**: Translation layer that maintains old interface backed by new implementation
- **Feature flags**: Per-consumer rollout of the replacement

Anti-patterns to avoid
----------------------
- Deprecating without providing an alternative
- Announcing deprecation without a migration guide
- Adding new features to deprecated systems
- Keeping zombie code with no owner
- Soft-deprecating indefinitely ("we'll remove it someday")

Integration with nForma
------------------------
- Plan migrations using `/nf:plan-phase` with explicit removal tasks
- Track migration progress in milestone requirements
- After removal, run `nf:code-review-and-quality` to verify clean removal
- Use `nf:documentation-and-adrs` to record the deprecation decision

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `deprecation-and-migration` skill in `addyosmani/agent-skills`.
