---
phase: quick-108
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/qgsd-quorum-slot-worker.md
autonomous: true
requirements:
  - QUICK-108
must_haves:
  truths:
    - "The slot-worker result block includes a citations field (optional) when the model references code"
    - "The raw output cap is 5000 characters, not 2000"
    - "Mode A Round 1 prompt instructs the model to record citations as a citations: YAML field"
    - "Mode A Round 2+ prompt instructs the model to record citations during re-check"
    - "Mode B prompt instructs the model to record citations when referencing traces or files"
    - "The citations field is marked optional in both Step 3 and Step 5"
  artifacts:
    - path: "agents/qgsd-quorum-slot-worker.md"
      provides: "Updated slot-worker agent definition"
      contains: "citations:"
  key_links:
    - from: "Step 3 prompt instructions"
      to: "Step 5 result block format"
      via: "citations: field"
      pattern: "citations:"
---

<objective>
Add a `citations:` field to the slot-worker result block and increase the raw output cap from 2000 to 5000 characters.

Purpose: Richer result blocks let the orchestrator include source-grounded citations in cross-pollination bundles (Quick 109). Models explicitly prompted to cite file paths and code snippets will produce more traceable reasoning.
Output: Updated `agents/qgsd-quorum-slot-worker.md` with citations field in Step 3 prompts and Step 5 result block, raw cap raised to 5000.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@agents/qgsd-quorum-slot-worker.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add citations field to Step 3 prompts and Step 5 result block; raise raw cap to 5000</name>
  <files>agents/qgsd-quorum-slot-worker.md</files>
  <action>
Edit `agents/qgsd-quorum-slot-worker.md` with three targeted changes:

**Change 1 — Step 3, Mode A, Round 1 block:**

Find the existing Round 1 instruction block (the `[If prior_positions absent (Round 1):]` section). It currently ends with:
```
Give your honest answer with reasoning. Be concise (3–6
sentences). Do not defer to peer models.
```

Append after that closing line (still inside the Round 1 block, before the closing triple-backtick):
```
If your answer references specific files, line numbers, or code snippets from the
repository, record them in a citations: field in your response (optional — only
include if you actually cite code).
```

**Change 2 — Step 3, Mode A, Round 2+ block:**

Find the Round 2+ instruction (the `[If prior_positions present (Round 2+):]` section). It currently ends with:
```
Given the above, do you maintain your answer or revise it? State your updated position
clearly (2–4 sentences).
```

Append after that closing line (still inside the Round 2+ block, before the Mode B section):
```
If your re-check references specific files, line numbers, or code snippets, record
them in a citations: field in your response (optional).
```

**Change 3 — Step 3, Mode B prompt:**

Find the Mode B prompt block. It currently ends with:
```
APPROVE if output clearly shows the question is satisfied.
REJECT if output shows it is NOT satisfied.
FLAG if output is ambiguous or requires human judgment.
```

Append after those three lines (still inside the Mode B code block):
```
If your verdict references specific lines from the execution traces or files, record
them in a citations: field (optional — only when you directly cite output lines or
file content).
```

**Change 4 — Step 5, success result block:**

Find the success result block:
```
slot: <slotName>
round: <round>
verdict: <see above>
reasoning: <2–4 sentence summary of the model's position or verdict reasoning>
raw: |
  <first 2000 characters of $RAW_OUTPUT>
```

Replace with:
```
slot: <slotName>
round: <round>
verdict: <see above>
reasoning: <2–4 sentence summary of the model's position or verdict reasoning>
citations: |
  <optional — file paths, line numbers, or code snippets the model cited; omit if none>
raw: |
  <first 5000 characters of $RAW_OUTPUT>
```

Do NOT modify the UNAVAIL result block (the 500-char cap there is intentional for error output only).
  </action>
  <verify>
Run these checks:
```bash
grep -n "citations:" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
grep -n "5000" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
grep -n "2000" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
```

Expected:
- `citations:` appears at minimum 4 times (3 in Step 3 prompts, 1 in Step 5 result block)
- `5000` appears once (Step 5 raw cap)
- `2000` appears zero times (old cap fully replaced)
  </verify>
  <done>
- `citations:` field present in Mode A Round 1 prompt, Mode A Round 2+ prompt, Mode B prompt, and Step 5 result block
- Step 5 result block shows `first 5000 characters` not `first 2000 characters`
- UNAVAIL result block unchanged (still 500-char cap)
- File parses as valid YAML frontmatter (name, description, tools, color fields intact)
  </done>
</task>

</tasks>

<verification>
```bash
# Confirm citations field present in all 4 locations
grep -c "citations:" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md

# Confirm 5000 cap present
grep "5000" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md

# Confirm 2000 cap fully removed
grep "2000" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md

# Confirm UNAVAIL block still has 500-char cap (unchanged)
grep "500" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-slot-worker.md
```
</verification>

<success_criteria>
- `grep -c "citations:"` returns 4 or more
- `grep "5000"` returns the Step 5 raw line
- `grep "2000"` returns no matches
- `grep "500"` returns the UNAVAIL block line (unchanged)
- The file reads coherently: optional citations instruction in each Mode A/B prompt block, optional citations field before raw in Step 5 result block
</success_criteria>

<output>
After completion, create `.planning/quick/108-richer-slot-worker-result-block-add-cita/108-SUMMARY.md` using the summary template.
</output>
