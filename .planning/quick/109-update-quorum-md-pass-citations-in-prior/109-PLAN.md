---
phase: quick-109
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/quorum.md
autonomous: true
requirements:
  - QUICK-109
must_haves:
  truths:
    - "Deliberation rounds in Mode A carry each model's citations alongside its position in prior_positions"
    - "Deliberation rounds in Mode B carry each model's citations alongside its position in prior_positions"
    - "A QUORUM_DEBATE.md file is written after Mode A consensus is reached"
    - "A QUORUM_DEBATE.md file is written after Mode A escalation (10 rounds exhausted)"
    - "A QUORUM_DEBATE.md file is written after Mode B verdict output"
    - "Debate file path follows artifact_path directory or .planning/debates/ fallback"
  artifacts:
    - path: "commands/qgsd/quorum.md"
      provides: "Updated quorum orchestration protocol"
      contains: "citations:"
  key_links:
    - from: "qgsd-quorum-slot-worker.md result block"
      to: "quorum.md prior_positions bundle"
      via: "citations: field propagated into cross-poll YAML"
      pattern: "citations:"
    - from: "quorum.md consensus/escalation steps"
      to: "QUORUM_DEBATE.md"
      via: "Write tool call after scoreboard update"
      pattern: "QUORUM_DEBATE"
---

<objective>
Update `commands/qgsd/quorum.md` to (1) propagate slot-worker `citations:` fields into the `prior_positions` cross-poll bundle for deliberation rounds, and (2) write a `QUORUM_DEBATE.md` audit file at every consensus/escalation exit point.

Purpose: Quick-108 added `citations:` to slot-worker result blocks. These citations are currently discarded — deliberation rounds receive only flat bullet summaries. This change makes citations visible to all peer models during deliberation so they can verify cited files/lines. The QUORUM_DEBATE.md file creates a durable per-question audit trail of the full debate including all rounds, positions, citations, and outcome.

Output: Modified `commands/qgsd/quorum.md` (~537 lines) with updated prior_positions format (2 sections) and QUORUM_DEBATE.md write instructions (4 exit points).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/quorum.md
@agents/qgsd-quorum-slot-worker.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update prior_positions format to include citations in Mode A and Mode B deliberation</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
In `commands/qgsd/quorum.md`, update the `prior_positions` YAML block format in the deliberation dispatch sections for BOTH Mode A and Mode B.

**Mode A — locate the deliberation section** (around lines 281-297, under "### Deliberation rounds (R3.3)").

Replace the current `prior_positions:` format block:
```
prior_positions: |
  • Claude:    [position]
  • Codex:     [position or UNAVAIL]
  • Gemini:    [position or UNAVAIL]
  • OpenCode:  [position or UNAVAIL]
  • Copilot:   [position or UNAVAIL]
  [one line per claude-mcp server: • <display-name>: [position or UNAVAIL]]
```

With the new expanded format:
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

Add a prose note immediately after the format block:
```
Populate `citations:` from the `citations:` field in each model's slot-worker result block. If the result block had no `citations:` field or it was empty, write `(none)`. For Claude's own position, include any file paths or line numbers Claude cited in its reasoning.
```

**Mode B — locate the deliberation dispatch section** (around lines 471-475, under "### Dispatch quorum workers via Task (parallel per round)", the "For Round 2+ deliberation, also append:" subsection).

Replace the current Mode B `prior_positions:` block:
```
prior_positions: |
  <all prior positions verbatim>
```

With the structured per-model format matching Mode A:
```
prior_positions: |
  • Claude:
    position: [Claude's verdict and reasoning]
    citations: [citations from Claude's analysis, or "(none)"]
  • <slotName>:
    position: [verdict from slot result block, or UNAVAIL]
    citations: [citations field from slot result block, or "(none)"]
  [one entry per active slot in the same format]
```

Add the same prose note about populating citations from slot result blocks.
  </action>
  <verify>
Read commands/qgsd/quorum.md and confirm:
1. Mode A deliberation section (search for "prior_positions: |" near "Deliberation rounds") now uses the multi-line `position:` / `citations:` format with prose note.
2. Mode B deliberation section ("For Round 2+ deliberation") now uses the same multi-line format.
3. No other `prior_positions` blocks were accidentally modified (the Mode A/B format blocks in the slot dispatch area, lines ~240 and ~460, should be the only ones).
4. The file is valid markdown with no broken code fences.
  </verify>
  <done>
Both deliberation dispatch sections (Mode A ~line 282, Mode B ~line 472) emit structured `prior_positions` blocks with nested `position:` and `citations:` per model, and include a prose note explaining how to populate citations from slot result blocks.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add QUORUM_DEBATE.md write step at all four consensus/escalation exit points</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
In `commands/qgsd/quorum.md`, insert a "Write QUORUM_DEBATE.md" step at each of the four output exit points. Insert AFTER the scoreboard update block at each location (scoreboard update always precedes the debate file write).

**Debate file path rule** (add once before the four placements, as a shared definition in a new paragraph at the top of the first insertion, then reference by name at the other three):

```
**Debate file path:** If `artifact_path` was provided → write to the same directory as the artifact (e.g. `.planning/phases/v0.14-02/QUORUM_DEBATE.md`). Otherwise → `.planning/debates/YYYY-MM-DD-<short-slug>.md` where `<short-slug>` is the first 6 words of the question lowercased, spaces replaced with hyphens, non-alphanumeric chars stripped.

Create `.planning/debates/` if it does not exist.
```

**Debate file format:**
```markdown
# Quorum Debate
Question: <question text>
Date: <YYYY-MM-DD>
Consensus: <APPROVE / REJECT / FLAG / ESCALATED>
Rounds: <N>

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | <position> | <citations or —> |
| <slotName> | <position or UNAVAIL> | <citations or —> |
...

## Round N (if deliberation occurred — one section per round)
[same table format]

## Outcome
<Full consensus answer (Mode A) or verdict + rationale (Mode B) or escalation summary>
```

**The four insertion points:**

1. **Mode A — Consensus output** (after "### Consensus output", after the scoreboard update block, ~line 358):

   Add:
   ```
   Write QUORUM_DEBATE.md using the debate file path rule above. Set `Consensus: APPROVE` (Mode A consensus means all models agree on APPROVE). Include one `## Round N` section per round that occurred, populated from the per-round position data collected during this quorum run.
   ```

2. **Mode A — Escalation** (after "### Escalate — no consensus after 10 rounds", after the scoreboard update block, ~line 412):

   Add:
   ```
   Write QUORUM_DEBATE.md using the debate file path rule above. Set `Consensus: ESCALATED`. Include one `## Round N` section per round (all 10). Set `## Outcome` to the core disagreement summary and Claude's recommendation from the escalation output above.
   ```

3. **Mode B — Consensus verdict** (after "### Output consensus verdict", after the scoreboard update block, ~line 536):

   Add:
   ```
   Write QUORUM_DEBATE.md using the debate file path rule above. Set `Consensus:` to the final consensus verdict (APPROVE / REJECT / FLAG). Include one `## Round N` section per round that occurred. Set `## Outcome` to the rationale from the verdict output above. If 10 rounds elapsed without full consensus, set `Consensus: ESCALATED`.
   ```

4. There is no separate Mode B escalation block — Mode B always outputs the verdict table regardless of outcome. The insertion at point 3 (with the ESCALATED conditional) covers the Mode B exhaustion case.

**Implementation note:** Use the Write tool to apply all changes in one pass. Read the current file first, insert the blocks at the correct positions, write the full updated file back.
  </action>
  <verify>
Read commands/qgsd/quorum.md and confirm:
1. The debate file path rule (artifact_path vs .planning/debates/ fallback, slug generation) appears once near the first insertion point.
2. A "Write QUORUM_DEBATE.md" instruction appears after the scoreboard update in Mode A Consensus output section.
3. A "Write QUORUM_DEBATE.md" instruction appears after the scoreboard update in Mode A Escalation section.
4. A "Write QUORUM_DEBATE.md" instruction appears after the scoreboard update in Mode B Output consensus verdict section.
5. The QUORUM_DEBATE.md format block (header, question, date, rounds table, outcome) appears in the file.
6. File is valid markdown with no broken code fences or unclosed sections.
  </verify>
  <done>
All four exit points (Mode A consensus, Mode A escalation, Mode B verdict, Mode B ESCALATED conditional) contain instructions to write QUORUM_DEBATE.md with the defined format, path rule, and correct `Consensus:` value. The debate file accumulates one table section per round with model positions and citations.
  </done>
</task>

</tasks>

<verification>
After both tasks:
- `grep -n "citations:" commands/qgsd/quorum.md` returns matches in both Mode A deliberation (~line 282) and Mode B deliberation (~line 472) sections.
- `grep -n "QUORUM_DEBATE" commands/qgsd/quorum.md` returns exactly 3 matches (one per insertion point — Mode A consensus, Mode A escalation, Mode B verdict).
- `grep -n "planning/debates" commands/qgsd/quorum.md` returns the path rule definition.
- The file line count increases from 537 to approximately 590-610 (accounting for the new blocks).
</verification>

<success_criteria>
- prior_positions cross-poll bundles in both Mode A and Mode B deliberation sections carry structured `position:` + `citations:` per model
- QUORUM_DEBATE.md is written at all three explicit output exit points (Mode A consensus, Mode A escalation, Mode B verdict with ESCALATED conditional)
- Debate format includes per-round tables with model, position, citations columns
- Path rule: artifact_path directory when available, .planning/debates/ slug otherwise
- No regressions to existing dispatch protocol, scoreboard update steps, or mode detection logic
</success_criteria>

<output>
After completion, create `.planning/quick/109-update-quorum-md-pass-citations-in-prior/109-SUMMARY.md`
</output>
