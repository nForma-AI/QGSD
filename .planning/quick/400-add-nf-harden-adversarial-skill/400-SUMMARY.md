# Quick Task 400 Summary

## Task
Add nf:harden adversarial hardening loop skill (Issue #101)

## Approach
Create nf:harden skill with iterative adversarial test-write-fix loop (max 10 iterations) detecting convergence at 2 consecutive zero-change iterations, add --area and --full flags, integrate with nf:quick --full for max 5 loop simple hardening.

## Tasks Completed

### Task 1: Create nf:harden command and adversarial hardening workflow
**Commit:** `fea9276c`

Files created:
- `commands/nf/harden.md` — skill command with frontmatter (name, argument-hint, allowed-tools), execution_context pointing to `~/.claude/nf/workflows/harden.md`
- `core/workflows/harden.md` — full adversarial loop workflow with:
  - Argument parsing: `--area <path>`, `--full`, `--max <N>` with validation (--max must be > 0, --area must be non-empty)
  - Test discovery with empty-file guard (returns `skipped` status if no test files found)
  - Baseline test run guard (returns `blocked` if baseline failing)
  - Iterative adversarial agent + fix executor loop
  - Convergence detection: `CONSECUTIVE_ZERO_CHANGE >= 2` (increments ONLY when adversarial agent produces zero new failures, before fix executor)
  - Iteration cap: default 10 (overridable via `--max`)
  - Banners for all terminal states: `converged`, `cap_exhausted`, `skipped`, `blocked`
  - Test framework auto-detection: scripts.test → config files → npm test fallback
  - EventuallyTerminates invariant satisfied: iteration cap guarantees termination regardless of convergence reset logic
- Synced to `~/.claude/nf/workflows/harden.md` and `~/.claude/commands/nf/harden.md`

### Task 2: Wire nf:harden into quick --full post-verification
**Commit:** `8c12260b`

Files modified:
- `core/workflows/quick.md` — added Step 6.6 (adversarial hardening) between Step 6.5.1 (quorum VERIFICATION.md review) and Step 6.7 (requirement elevation):
  - Runs only when `$FULL_MODE` AND `$VERIFICATION_STATUS = "Verified"`
  - Spawns harden workflow with `--max 5` (capped at 5 for quick tasks)
  - Fail-open: if subagent errors, sets `$HARDEN_STATUS = "skipped"` and continues
  - `$HARDEN_STATUS` included in final QUICK TASK COMPLETE (FULL MODE) banner
  - Also fixed two Node.js heredoc blocks to use `--input-type=module` syntax
- Synced to `~/.claude/nf/workflows/quick.md`

## Formal Modeling

### Formal Coverage Auto-Detection
No formal coverage intersections found for changed files (commands/nf/harden.md, core/workflows/harden.md, core/workflows/quick.md) — formal verify skipped (fail-open).

### Loop 2 Simulation
- **Status:** Not applicable (no formal coverage intersections)
- **Reason:** formal-coverage-intersect.cjs returned exit code 2 (no matches) for all changed files

## Verification
- `commands/nf/harden.md` exists with correct frontmatter ✓
- `core/workflows/harden.md` contains convergence logic and all terminal states ✓
- `~/.claude/nf/workflows/harden.md` in sync with core/ ✓
- `~/.claude/commands/nf/harden.md` in sync with commands/ ✓
- Step 6.6 present in `core/workflows/quick.md` ✓
- `~/.claude/nf/workflows/quick.md` in sync with core/ ✓
- `nf:harden` appears in Claude Code skills list ✓
