---
name: nf:git-workflow-and-versioning
description: Guides git workflow discipline — atomic commits, branch management, pre-commit checks, and versioning practices.
---

# git-workflow-and-versioning skill

Purpose
-------
Use git as a safety net for development. Commits are save points, branches are sandboxes, and history is documentation. This skill covers the discipline of working with git effectively.

When to use
-----------
- Setting up git workflow for a new project
- Reviewing commit and branching practices
- Planning a release or versioning strategy
- When commit hygiene or branch management needs improvement
- When the user asks about git workflow, branching strategy, or versioning

Core principles
---------------
1) **Trunk-based development** — keep `main` always deployable. Use short-lived feature branches (1–3 days max). Avoid long-lived development branches.

2) **Atomic commits** — each commit does one logical thing. Keep concerns separate (refactoring commits vs feature commits). Target ~100 lines per commit; split anything over ~1000 lines.

3) **Descriptive messages** — explain *why*, not just *what*. Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.

4) **Branch naming** — use clear prefixes: `feature/`, `fix/`, `chore/`, `refactor/`. Delete branches after merging.

5) **Pre-commit discipline** — review staged changes, check for secrets, run tests and linting before committing.

Pre-commit checklist
--------------------
- [ ] Review staged changes (`git diff --staged`)
- [ ] Check for secrets (passwords, API keys, tokens, .env files)
- [ ] Run test suite
- [ ] Run linting and type checking
- [ ] Commit message explains the why

Change summaries
----------------
After significant modifications, document:
- What was changed and where
- What was intentionally not touched
- Potential concerns or assumptions

Red flags
---------
- Large uncommitted changes accumulating
- Generic commit messages ("fix", "update", "stuff")
- Mixed formatting and behavior changes in one commit
- Missing `.gitignore`
- Force-pushing to shared branches
- Long-lived divergent branches

Integration with nForma
------------------------
- nForma's executor uses atomic commits via `gsd-tools.cjs commit`
- Branch naming follows `nf/quick-{N}-{slug}` for quick tasks
- Release workflow is documented in CLAUDE.md (`prepare-release.sh`, `release.sh`)
- For nForma-specific versioning rules, see CLAUDE.md "Versioning" section

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `git-workflow-and-versioning` skill in `addyosmani/agent-skills`.
