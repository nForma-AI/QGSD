---
name: nf:incremental-implementation
description: Guides building features in thin vertical slices — implement, test, verify, commit, repeat — keeping the system functional after each step.
---

# incremental-implementation skill

Purpose
-------
Build features in thin vertical slices. Each increment leaves the system functional and testable. This approach makes large features manageable and reduces the risk of broken intermediate states.

When to use
-----------
- Multi-file changes or new features
- Code refactoring that touches multiple areas
- Any work exceeding ~100 lines before testing
- When the user asks to build something incrementally or in slices

When NOT to use
---------------
- Single-file, minimal-scope changes
- Already using `/nf:execute-phase` (which follows the wave model for incremental execution)

The increment cycle
-------------------
1. **Implement** — the smallest complete piece of functionality
2. **Test** — run the test suite or write new tests
3. **Verify** — confirm tests pass, build succeeds, functionality works
4. **Commit** — atomic commit with a descriptive message
5. **Next slice** — continue forward

Slicing strategies
------------------
- **Vertical slices** (preferred): one complete stack path per increment (data → logic → interface)
- **Contract-first**: define interfaces/types first, then implement behind them
- **Risk-first**: tackle uncertain or risky elements before dependent work

Core rules
----------
1. **Simplicity first** — ask "what's the minimal approach?" before writing code
2. **Scope discipline** — touch only what the current slice requires; note but don't fix adjacent issues
3. **One thing at a time** — don't mix concerns in a single commit
4. **Keep it buildable** — the project must build and existing tests must pass after each slice
5. **Feature flags for incomplete work** — hide unfinished features from users until they're ready

Red flags
---------
- 100+ lines written without testing
- Multiple unrelated changes in one commit
- Skipping the test/verify step
- Broken builds between increments
- Large uncommitted changes accumulating

Integration with nForma
------------------------
- `/nf:execute-phase` already follows incremental execution via the wave model
- This skill is for standalone incremental work outside the phase system
- After each increment, the commit should be atomic (use `gsd-tools.cjs commit` if in nForma context)
- Pair with `nf:test-driven-development` for the test step in each cycle

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `incremental-implementation` skill in `addyosmani/agent-skills`.
