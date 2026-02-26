---
phase: quick-109
plan: 01
subsystem: quorum-protocol
tags: [quorum, citations, audit-trail, deliberation, QUORUM_DEBATE]
dependency_graph:
  requires: [quick-108]
  provides: [citations-in-deliberation, QUORUM_DEBATE-persistence]
  affects: [commands/qgsd/quorum.md]
tech_stack:
  added: []
  patterns: [structured-prior_positions, debate-file-audit-trail]
key_files:
  modified: [commands/qgsd/quorum.md]
decisions:
  - "Mode A and Mode B use identical structured prior_positions format with position: + citations: per model"
  - "Debate file path: artifact_path directory when available, .planning/debates/ slug fallback"
  - "QUORUM_DEBATE.md written at 3 exit points: Mode A consensus, Mode A escalation, Mode B verdict (ESCALATED conditional covers Mode B exhaustion)"
  - "Debate file format includes per-round tables with model, position, citations columns"
metrics:
  duration: 105s
  completed: 2026-02-26
---

# Quick Task 109: citations in prior_positions + QUORUM_DEBATE.md persistence

**One-liner:** Structured position+citations per model in deliberation rounds and durable QUORUM_DEBATE.md audit file at all quorum exit points.

## What Was Built

Quick-108 added `citations:` fields to slot-worker result blocks. This task wires those citations into the deliberation loop and creates a persistent audit trail.

### Task 1: Updated prior_positions format (Mode A and Mode B)

Both deliberation dispatch sections in `commands/qgsd/quorum.md` now use a structured multi-line format instead of flat bullet summaries:

**Before (Mode A ~line 282):**
```
prior_positions: |
  • Claude:    [position]
  • Codex:     [position or UNAVAIL]
  ...
```

**After:**
```
prior_positions: |
  • Claude:
    position: [position from $CLAUDE_POSITION]
    citations: [citations from Claude's analysis, or "(none)"]
  • <slotName>:
    position: [position from slot result block, or UNAVAIL]
    citations: [citations field from slot result block, or "(none)"]
  [one entry per active slot in the same format]
```

A prose note explains how to populate `citations:` from slot result blocks. The same format was applied to Mode B (~line 472). Commit: c7b3c2f

### Task 2: QUORUM_DEBATE.md write step at exit points

Three write instructions added — one per explicit exit point:

1. **Mode A consensus** (after scoreboard update, line 367): `Consensus: APPROVE`
2. **Mode A escalation** (after scoreboard update, line 444): `Consensus: ESCALATED`
3. **Mode B verdict** (after scoreboard update, line 579): `Consensus: APPROVE/REJECT/FLAG` with ESCALATED conditional for 10-round exhaustion

**Debate file path rule** (defined once at first insertion):
- `artifact_path` provided → same directory as artifact
- Otherwise → `.planning/debates/YYYY-MM-DD-<short-slug>.md` (first 6 words of question)
- Create `.planning/debates/` if absent

**Debate file format:**
```markdown
# Quorum Debate
Question: <question>
Date: <YYYY-MM-DD>
Consensus: <APPROVE / REJECT / FLAG / ESCALATED>
Rounds: <N>

## Round 1
| Model | Position | Citations |
|---|---|---|
...

## Outcome
<full answer or escalation summary>
```

Commit: 2875130

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `grep -n "citations:"` returns matches at Mode A (~293) and Mode B (~509) deliberation sections
- `grep -n "QUORUM_DEBATE"` returns 4 matches: 1 path rule definition + 3 write instructions (367, 444, 579)
- `grep -n "planning/debates"` returns path rule definition and directory creation note
- Line count: 579 (from 537, +42 lines — all content present)

## Self-Check: PASSED

- File exists: commands/qgsd/quorum.md — FOUND
- Commits exist: c7b3c2f (Task 1), 2875130 (Task 2) — FOUND
