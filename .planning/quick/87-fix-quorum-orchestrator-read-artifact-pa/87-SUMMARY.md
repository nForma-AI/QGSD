---
phase: quick-87
plan: 01
subsystem: quorum-orchestrator
tags: [quorum, orchestrator, context-injection, artifact-path, repo-context]
dependency_graph:
  requires: []
  provides: [artifact-path-injection, repo-context-injection]
  affects: [agents/qgsd-quorum-orchestrator.md, ~/.claude/agents/qgsd-quorum-orchestrator.md]
tech_stack:
  added: []
  patterns: [path-hint-injection, backward-compatible-optional-context]
key_files:
  created: []
  modified:
    - agents/qgsd-quorum-orchestrator.md
decisions:
  - "Pass artifact path + line count hint instead of raw content — workers use their own Read tool (cleaner, avoids pasting large files into every prompt)"
  - "ARTIFACT_PATH is optional — absent = no injection, no error (backward compatible)"
  - "REPO_DIR always injected via Bash(pwd) — zero overhead, always useful context"
metrics:
  duration: "~8 minutes"
  completed: "2026-02-23"
  tasks_completed: 3
  files_modified: 1
---

# Phase quick-87 Plan 01: Fix Quorum Orchestrator Artifact Path and Repo Context Summary

**One-liner:** Added Pre-step to parse artifact_path + cwd from $ARGUMENTS and injected Repository header + artifact path hint into all Mode A and Mode B worker prompts.

## What Was Built

The quorum orchestrator lacked context about which plan was being reviewed and where the code lived. Workers received only a question, making their feedback shallow and off-target.

This quick task adds two injections:

1. **Repository context** — `Bash(pwd)` captured as `$REPO_DIR`, injected as a `Repository:` header into every worker prompt (Mode A Round 1, Mode A Deliberation, Mode B Execution Review).

2. **Artifact path hint** — when `artifact_path: <path>` is present in `$ARGUMENTS`, the orchestrator reads the file (to get line count) and passes a path hint block to workers:
   ```
   === Artifact ===
   Path: /path/to/87-PLAN.md (read this file for full context)
   Lines: ~150 lines
   ================
   ```
   Workers running in Claude Code subagent context can use their own Read tool to fetch the file. This avoids pasting large plan contents into every worker prompt.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add Pre-step — Parse $ARGUMENTS extras section | ca822ed |
| 2 | Inject $ARTIFACT_PATH and $REPO_DIR into Mode A and Mode B worker prompts | 1b54632 |
| 3 | Run installer to sync repo source to ~/.claude/agents/ | (no new commit — install writes to ~/.claude/ only) |

## Deviations from Plan

### Design Override (user instruction)

**What changed:** The plan called for embedding raw `$ARTIFACT_CONTENT` (full file text) in every worker prompt. The user overrode this before execution.

**Applied design:** Pass artifact path + line count hint instead of raw content. Workers read the file themselves using their own Read tool.

**Rationale:** Workers in Claude Code subagent context have file read access. Pasting large plan files into every worker prompt is wasteful and increases prompt size unnecessarily. The path hint is cleaner.

**Impact:** `must_haves` greps updated accordingly — the orchestrator checks for `ARTIFACT_PATH` rather than `ARTIFACT_CONTENT`. The verification patterns in the plan frontmatter reference `ARTIFACT_CONTENT` but the actual implementation uses `ARTIFACT_PATH` per the user override. Structural correctness is maintained.

## Self-Check

### Files exist

- [x] `/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — modified
- [x] `~/.claude/agents/qgsd-quorum-orchestrator.md` — synced via install

### Commits exist

- [x] ca822ed — feat(quick-87): add Pre-step to parse artifact_path and cwd from ARGUMENTS
- [x] 1b54632 — feat(quick-87): inject artifact path and repo context into all worker prompts

### Verification greps

- `grep "Pre-step" agents/qgsd-quorum-orchestrator.md` → found (line 38)
- `grep -c "REPO_DIR" agents/qgsd-quorum-orchestrator.md` → 6 occurrences
- `grep -c "ARTIFACT_PATH" agents/qgsd-quorum-orchestrator.md` → 14 occurrences
- `grep "artifact_path" agents/qgsd-quorum-orchestrator.md` → found (Pre-step parsing instruction)
- `grep -c "artifact_path" ~/.claude/agents/qgsd-quorum-orchestrator.md` → 1 (installed copy synced)
- `grep -c "REPO_DIR" ~/.claude/agents/qgsd-quorum-orchestrator.md` → 6 (installed copy synced)

## Self-Check: PASSED
