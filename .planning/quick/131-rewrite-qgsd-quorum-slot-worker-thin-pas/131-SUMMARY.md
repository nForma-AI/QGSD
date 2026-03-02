---
phase: quick-131
plan: 01
subsystem: quorum
tags: [agent, quorum, passthrough, context-delegation]
dependency_graph:
  requires: []
  provides: [thin-passthrough-slot-worker]
  affects: [quorum-dispatch, quorum-slot-agents]
tech_stack:
  added: []
  patterns: [delegate-context-reads-to-downstream, bash-only-worker]
key_files:
  created: []
  modified:
    - agents/qgsd-quorum-slot-worker.md
    - ~/.claude/agents/qgsd-quorum-slot-worker.md
decisions:
  - "Artifact content embedding removed — downstream quorum agents have has_file_access:true and receive repo_dir; reading artifact in the worker was redundant duplication"
  - "skip_context_reads field removed — it only gated the now-deleted Step 2, so it was obsolete"
  - "Round 1 and Round 2+ instructions updated to explicitly enumerate CLAUDE.md, STATE.md, and artifact_path so downstream agents have clear read targets"
metrics:
  duration: 4min
  completed: 2026-03-02
  tasks: 1
  files: 1
---

# Quick Task 131: Rewrite qgsd-quorum-slot-worker Thin Passthrough Bash Only

**One-liner:** Stripped Read/Glob/Grep tools and Step 2 file reads from qgsd-quorum-slot-worker, delegating all context reading to downstream quorum slot agents via explicit path references in the prompt.

## What Was Done

Rewrote `agents/qgsd-quorum-slot-worker.md` to be a thin passthrough agent:

1. **tools frontmatter**: Changed from `Read, Bash, Glob, Grep` to `Bash` only.

2. **Role section**: Removed bullet 2 "Read repository context." — renumbered from 5 bullets to 4.

3. **Step 2 deleted entirely**: The "Step 2 — Read repository context" section (with its skip guard, Read tool instructions, artifact read, Glob/Grep usage) was removed. The old Steps 3/4/5 became 2/3/4.

4. **Artifact embedding removed**: Both Mode A and Mode B prompt templates replaced `<$ARTIFACT_CONTENT — full content>` with `(Read this file to obtain its full content before evaluating.)`. The downstream agent reads the file directly using the path provided.

5. **Round 1 instruction updated** (Mode A): Now explicitly lists CLAUDE.md, STATE.md, and the artifact file as minimum reads for the downstream agent.

6. **Round 2+ re-check instruction updated** (Mode A): Now mentions re-reading the artifact file if one was provided.

7. **Mode B verdict instruction updated**: Now explicitly lists CLAUDE.md, STATE.md, and artifact file.

8. **skip_context_reads removed**: From both the optional fields description in Step 1 and the `<arguments>` block at the bottom. The field only applied to Step 2 which no longer exists.

9. **Installed file synced**: `cp agents/qgsd-quorum-slot-worker.md ~/.claude/agents/qgsd-quorum-slot-worker.md` — both files are identical.

## Verification

All checks passed:
- `grep "^tools:"` → `tools: Bash`
- `grep "Step 2"` → only the new "Step 2 — Build the prompt" heading (renamed from old Step 3)
- `grep "ARTIFACT_CONTENT"` → no output
- `grep "skip_context_reads"` → no output
- `grep "Read this file to obtain"` → two matches (Mode A + Mode B)
- `diff repo installed` → no differences (files identical)

## Deviations from Plan

None — plan executed exactly as written.

## Rationale

The quorum slot agents (gemini-1, codex-1, claude-N, etc.) all have `has_file_access: true` in `providers.json` and receive `repo_dir` as part of the prompt. Having the worker pre-read files and embed their content was redundant: it doubled context cost, forced the worker to carry Read/Glob/Grep tooling it should not need, and created a sync risk if the worker's reads diverged from what the downstream agent would see. Delegating reads makes the worker simpler and puts context decisions where they belong — with the evaluating model.

## Self-Check

- [x] `agents/qgsd-quorum-slot-worker.md` exists and has correct content
- [x] `/Users/jonathanborduas/.claude/agents/qgsd-quorum-slot-worker.md` exists and is identical
- [x] Task commit: 8f277b5a
