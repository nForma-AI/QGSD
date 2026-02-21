---
phase: quick-24
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ~/.claude/agents/qgsd-quorum-orchestrator.md
  - ~/.claude/commands/qgsd/quorum.md
  - ~/.claude/commands/qgsd/debug.md
  - ~/.claude/gsd-local-patches/agents/qgsd-quorum-orchestrator.md
  - ~/.claude/gsd-local-patches/commands/qgsd/quorum.md
  - ~/.claude/gsd-local-patches/commands/qgsd/debug.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "qgsd-quorum-orchestrator.md worker prompt includes `role: CONTRARIAN | AGREEING | IMPROVING` field with detection rules"
    - "Orchestrator output_format section includes role per model in final_positions"
    - "quorum.md Mode A Step 4 table includes a Role column"
    - "quorum.md Mode B Step 6 table includes a Role column"
    - "debug.md results table (Step 5) includes a Role column"
    - "debug.md Step 5.5 (improvement round) fires when consensus_root_cause AND has_improvements"
    - "debug.md Step 7 auto-executes on HIGH consensus + no improvements — no 'Want me to apply' language"
    - "User is only prompted in ANY quorum workflow when no consensus after max iterations"
  artifacts:
    - path: ~/.claude/agents/qgsd-quorum-orchestrator.md
      provides: "Canonical quorum pattern: role visibility + improvement round + escalate-only-on-failure gate"
    - path: ~/.claude/commands/qgsd/quorum.md
      provides: "Role column in all quorum output tables (Mode A + Mode B)"
    - path: ~/.claude/commands/qgsd/debug.md
      provides: "Debug quorum aligned to canonical pattern: roles, improvement round, auto-execute"
  key_links:
    - from: "Orchestrator role field"
      to: "debug.md Role column"
      via: "same CONTRARIAN | AGREEING | IMPROVING taxonomy"
      pattern: "CONTRARIAN.*AGREEING.*IMPROVING"
---

<objective>
Canonicalize the QGSD quorum pattern across all implementations:

1. **Role visibility** — every quorum output shows each model's stance (CONTRARIAN / AGREEING / IMPROVING) — defined once in the orchestrator, applied everywhere
2. **Improvement round** — when consensus exists but models propose improvements, run a v2 round with the consensus position frozen — already exists as R3.6 in orchestrator but not in debug.md
3. **Strict user-prompt gate** — user is asked ONLY when no consensus after max iterations. On consensus: auto-proceed. No "Want me to apply the fix?" pattern anywhere.

The root problem: debug.md implements its own quorum inline (parallel Task workers) but broke from the canonical pattern by ending with a user prompt on HIGH consensus. The orchestrator and quorum.md already had the right escalation-only-on-failure structure. This task aligns debug.md to the canonical pattern and adds role visibility everywhere.

Files in scope: qgsd-quorum-orchestrator.md (canonical), quorum.md (the /qgsd:quorum command), debug.md (inline quorum that diverged).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add role field to qgsd-quorum-orchestrator.md (canonical source)</name>
  <files>~/.claude/agents/qgsd-quorum-orchestrator.md</files>
  <action>
Make two targeted edits to the orchestrator:

**Edit 1 — Round 1 worker prompt: add `role` field**

In the `<round_1>` section, the current worker prompt template is:
```
Provide your independent position on this artifact with full reasoning. Do you APPROVE or BLOCK? If you APPROVE but have specific, actionable improvements, list them.
```

Replace with:
```
Provide your independent position on this artifact with full reasoning. Do you APPROVE or BLOCK? If you APPROVE but have specific, actionable improvements, list them.

Also classify your stance:
role: CONTRARIAN | AGREEING | IMPROVING

Rules:
- CONTRARIAN: your position (BLOCK or rationale) differs significantly from what the artifact or other models suggest
- AGREEING: you APPROVE and your reasoning aligns with the apparent consensus direction
- IMPROVING: you APPROVE on the substance but propose a specific refinement or expanded next step
- On Round 1 with no prior context: pick CONTRARIAN if you see a non-obvious issue, AGREEING if the artifact is clearly sound, IMPROVING if you'd accept it with enhancements
```

**Edit 2 — Output format: add role to final_positions**

In `<output_format>`, the current `final_positions` block is:
```
final_positions:
  claude: [vote as received — not re-derived]
  codex: [position]
  gemini: [position]
  opencode: [position]
  copilot: [position]
```

Replace with:
```
final_positions:
  claude:    { role: [CONTRARIAN|AGREEING|IMPROVING], position: [vote as received — not re-derived] }
  codex:     { role: [CONTRARIAN|AGREEING|IMPROVING|UNAVAIL], position: [position] }
  gemini:    { role: [CONTRARIAN|AGREEING|IMPROVING|UNAVAIL], position: [position] }
  opencode:  { role: [CONTRARIAN|AGREEING|IMPROVING|UNAVAIL], position: [position] }
  copilot:   { role: [CONTRARIAN|AGREEING|IMPROVING|UNAVAIL], position: [position] }
```

Also add a note at the top of `<output_format>`:
```
Note: user escalation ONLY fires on ESCALATED result (no consensus after 4 rounds). On APPROVED, proceed without prompting the user.
```
  </action>
  <verify>
Read ~/.claude/agents/qgsd-quorum-orchestrator.md and confirm:
- Worker prompt in round_1 contains "role: CONTRARIAN | AGREEING | IMPROVING"
- Output format final_positions uses `{ role: ..., position: ... }` structure
- "user escalation ONLY fires on ESCALATED" note is present
  </verify>
  <done>Orchestrator contains role field in worker prompt and output format. User-escalation note present.</done>
</task>

<task type="auto">
  <name>Task 2: Add Role column to quorum.md tables (Mode A + Mode B)</name>
  <files>~/.claude/commands/qgsd/quorum.md</files>
  <action>
Make two targeted edits to quorum.md:

**Edit 1 — Mode A Step 4: add Role column to position table**

Current table format:
```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ Model        │ Round 1 Position                                         │
├──────────────┼──────────────────────────────────────────────────────────┤
│ Claude       │ [summary]                                                │
│ Codex        │ [summary or UNAVAIL]                                     │
│ Gemini       │ [summary or UNAVAIL]                                     │
│ OpenCode     │ [summary or UNAVAIL]                                     │
│ Copilot      │ [summary or UNAVAIL]                                     │
└──────────────┴──────────────────────────────────────────────────────────┘
```

Replace with:
```
┌──────────────┬─────────────────┬──────────────────────────────────────────┐
│ Model        │ Role            │ Round 1 Position                         │
├──────────────┼─────────────────┼──────────────────────────────────────────┤
│ Claude       │ [role]          │ [summary]                                │
│ Codex        │ [role|UNAVAIL]  │ [summary or UNAVAIL]                     │
│ Gemini       │ [role|UNAVAIL]  │ [summary or UNAVAIL]                     │
│ OpenCode     │ [role|UNAVAIL]  │ [summary or UNAVAIL]                     │
│ Copilot      │ [role|UNAVAIL]  │ [summary or UNAVAIL]                     │
└──────────────┴─────────────────┴──────────────────────────────────────────┘
```

Also update the worker prompt template in Step 3 to request the role field (same taxonomy as orchestrator: CONTRARIAN / AGREEING / IMPROVING).

Add to the end of Step 3 prompt template:
```
Also state: role: CONTRARIAN | AGREEING | IMPROVING
(CONTRARIAN if your position differs from apparent consensus; AGREEING if you align; IMPROVING if you agree but propose refinements)
```

**Edit 2 — Mode B Step 6: add Role column to verdict table**

Current table format:
```
┌──────────────┬──────────────┬──────────────────────────────────────────┐
│ Model        │ Verdict      │ Reasoning                                │
├──────────────┼──────────────┼──────────────────────────────────────────┤
│ Claude       │ [verdict]    │ [summary]                                │
│ Gemini       │ [verdict]    │ [summary or UNAVAIL]                     │
│ OpenCode     │ [verdict]    │ [summary or UNAVAIL]                     │
│ Copilot      │ [verdict]    │ [summary or UNAVAIL]                     │
│ Codex        │ [verdict]    │ [summary or UNAVAIL]                     │
├──────────────┼──────────────┼──────────────────────────────────────────┤
│ CONSENSUS    │ [verdict]    │ [N APPROVE, N REJECT, N FLAG, N UNAVAIL] │
└──────────────┴──────────────┴──────────────────────────────────────────┘
```

Replace with:
```
┌──────────────┬──────────────┬─────────────────┬──────────────────────────────────────────┐
│ Model        │ Verdict      │ Role            │ Reasoning                                │
├──────────────┼──────────────┼─────────────────┼──────────────────────────────────────────┤
│ Claude       │ [verdict]    │ [role]          │ [summary]                                │
│ Gemini       │ [verdict]    │ [role|UNAVAIL]  │ [summary or UNAVAIL]                     │
│ OpenCode     │ [verdict]    │ [role|UNAVAIL]  │ [summary or UNAVAIL]                     │
│ Copilot      │ [verdict]    │ [role|UNAVAIL]  │ [summary or UNAVAIL]                     │
│ Codex        │ [verdict]    │ [role|UNAVAIL]  │ [summary or UNAVAIL]                     │
├──────────────┼──────────────┼─────────────────┼──────────────────────────────────────────┤
│ CONSENSUS    │ [verdict]    │ [N CONTR, N AGR, N IMPR] │ [N APPROVE, N REJECT, N FLAG, N UNAVAIL] │
└──────────────┴──────────────┴─────────────────┴──────────────────────────────────────────┘
```

Also update the Mode B worker prompt template (Step 4) to request role field, same taxonomy.
  </action>
  <verify>
Read ~/.claude/commands/qgsd/quorum.md and confirm:
- Mode A Step 4 table has 3 columns (Model, Role, Position)
- Mode B Step 6 table has 4 columns (Model, Verdict, Role, Reasoning)
- Worker prompts in Step 3 (Mode A) and Step 4 (Mode B) request the role field
  </verify>
  <done>quorum.md Mode A and Mode B both show Role column. Worker prompts request role field.</done>
</task>

<task type="auto">
  <name>Task 3: Align debug.md to canonical quorum pattern</name>
  <files>~/.claude/commands/qgsd/debug.md</files>
  <action>
Read ~/.claude/commands/qgsd/debug.md first to understand current structure, then make targeted changes.

Make these targeted changes to debug.md to align its inline quorum to the canonical pattern:

**Change 1 — Worker prompt: add role field**

In the worker prompt template (the prompt sent to each debug quorum worker), add after `confidence:`:

```
role: CONTRARIAN | AGREEING | IMPROVING

Rules:
- CONTRARIAN: your root_cause or next_step differs significantly from what the bundle or prior models suggest
- AGREEING: your root_cause and next_step align with the apparent consensus direction
- IMPROVING: you agree on the root cause but suggest a refined or expanded next_step
```

**Change 2 — Compute flags after collecting worker responses**

After parsing worker responses (wherever consensus is evaluated), add computation of:
```
consensus_root_cause = (3+ workers share same root cause area)
has_improvements     = (any worker role == IMPROVING)
consensus_level      = HIGH if all available workers are HIGH confidence AND consensus_root_cause
                       MED  if consensus_root_cause but not all HIGH confidence
                       LOW  if not consensus_root_cause
frozen_root_cause    = if consensus_root_cause: label root cause as FROZEN
```

**Change 3 — Results table: add Role column**

Change the results table header from:
```
│ Model        │ Confidence   │ Next Step                                                               │
```
To:
```
│ Model        │ Confidence   │ Role            │ Next Step                                             │
```

And update the CONSENSUS row to show role count:
```
│ CONSENSUS    │ [level]      │ [N CONTR, N AGR, N IMPR] │ [consensus next step]                  │
```

**Change 4 — Step 5.5: insert improvement round between results table and execution**

After the results table, add Step 5.5 — Improvement round:

```
**Step 5.5: Improvement round (v2)**

IF consensus_root_cause AND has_improvements:
  Display banner:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   QGSD ► QUORUM-DEBUG: Running improvement round (v2)...
   Root cause FROZEN. Re-evaluating next step with suggestions.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Re-dispatch workers sequentially (per R3.2 — separate tool calls) with this prompt:
  ```
  ROOT CAUSE (FROZEN — do not re-evaluate): [frozen_root_cause]

  IMPROVEMENT SUGGESTIONS FROM ROUND 1:
  [list each IMPROVING worker's next_step suggestion]

  Given the frozen root cause and these suggestions, provide ONLY:
  next_step: <the single best next debugging action incorporating the improvements>
  confidence: HIGH | MEDIUM | LOW
  role: CONTRARIAN | AGREEING | IMPROVING
  ```

  Parse v2 responses. Recompute consensus_next_step and has_improvements from v2.
  Update consensus_level from v2.
  Render v2 table below the original table under header "── v2 (after improvements) ──".

ELSE:
  Skip Step 5.5. Proceed directly.
```

**Change 5 — Auto-execute gate: remove "Want me to apply the fix?"**

Replace the current execution/escalation step with:

```
IF final_consensus_level == HIGH AND NOT has_improvements:
  ── Auto-execute, no user prompt ──
  Display:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   QGSD ► AUTO-EXECUTING (HIGH consensus, no improvements remaining)
   [consensus next step]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Execute the consensus next step.
  Display what was done.
  Display: "Consensus step executed. Run /qgsd:debug again to continue."

ELSE IF final_consensus_level == MED:
  Display results, then:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   QGSD ► PARTIAL CONSENSUS — apply next step and run /qgsd:debug again.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ELSE (LOW or no consensus):
  Display:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   No consensus — review recommendations above and apply the most relevant step.
   Then run /qgsd:debug again with updated output.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Key invariant: "Want me to apply the fix?" MUST NOT appear anywhere in debug.md.
  </action>
  <verify>
Read ~/.claude/commands/qgsd/debug.md and confirm:
- Worker prompt contains "role: CONTRARIAN | AGREEING | IMPROVING"
- Results table has Role column
- Step 5.5 (improvement round) exists between results table and execution step
- Auto-execute fires on HIGH + no improvements (no user prompt)
- "Want me to apply" does NOT appear anywhere in the file
  </verify>
  <done>debug.md aligned to canonical pattern. Role visible. Improvement round present. Auto-execute gate correct.</done>
</task>

<task type="auto">
  <name>Task 4: Mirror all three files to gsd-local-patches and commit</name>
  <files>
    ~/.claude/gsd-local-patches/agents/qgsd-quorum-orchestrator.md
    ~/.claude/gsd-local-patches/commands/qgsd/quorum.md
    ~/.claude/gsd-local-patches/commands/qgsd/debug.md
  </files>
  <action>
Mirror all three updated files to gsd-local-patches:

```bash
mkdir -p ~/.claude/gsd-local-patches/agents/
cp ~/.claude/agents/qgsd-quorum-orchestrator.md ~/.claude/gsd-local-patches/agents/qgsd-quorum-orchestrator.md

mkdir -p ~/.claude/gsd-local-patches/commands/qgsd/
cp ~/.claude/commands/qgsd/quorum.md ~/.claude/gsd-local-patches/commands/qgsd/quorum.md
cp ~/.claude/commands/qgsd/debug.md ~/.claude/gsd-local-patches/commands/qgsd/debug.md
```

Then commit from QGSD repo:
```bash
node /Users/jonathanborduas/.claude/get-shit-done/bin/gsd-tools.cjs commit \
  "feat(quick-24): canonicalize quorum pattern — role visibility, improvement round, auto-execute gate" \
  --files ~/.claude/agents/qgsd-quorum-orchestrator.md \
          ~/.claude/commands/qgsd/quorum.md \
          ~/.claude/commands/qgsd/debug.md \
          ~/.claude/gsd-local-patches/agents/qgsd-quorum-orchestrator.md \
          ~/.claude/gsd-local-patches/commands/qgsd/quorum.md \
          ~/.claude/gsd-local-patches/commands/qgsd/debug.md
```
  </action>
  <verify>
- `diff ~/.claude/agents/qgsd-quorum-orchestrator.md ~/.claude/gsd-local-patches/agents/qgsd-quorum-orchestrator.md` returns no diff
- `diff ~/.claude/commands/qgsd/quorum.md ~/.claude/gsd-local-patches/commands/qgsd/quorum.md` returns no diff
- `diff ~/.claude/commands/qgsd/debug.md ~/.claude/gsd-local-patches/commands/qgsd/debug.md` returns no diff
- git log --oneline -1 in QGSD repo shows the feat(quick-24) commit
  </verify>
  <done>All three patches mirrored. Commit exists in QGSD repo.</done>
</task>

</tasks>

<verification>
Read all three updated installed files and confirm:
1. qgsd-quorum-orchestrator.md: role field in worker prompt + role in output format + user-escalation-only note
2. quorum.md: Role column in Mode A Step 4 table + Mode B Step 6 table
3. debug.md: Role column in results table + Step 5.5 improvement round + auto-execute gate without "Want me to apply"
4. All three gsd-local-patches mirrors are identical to installed versions
</verification>

<success_criteria>
- Role taxonomy (CONTRARIAN/AGREEING/IMPROVING) defined once in orchestrator, applied in quorum.md and debug.md
- Every quorum output table shows Role column
- Improvement round fires in debug.md when consensus_root_cause AND has_improvements (mirrors R3.6 in orchestrator)
- User is ONLY prompted on no-consensus after max iterations — everywhere
- "Want me to apply the fix?" eliminated from codebase
- All three files mirrored to gsd-local-patches and committed
</success_criteria>

<output>
After completion, create /Users/jonathanborduas/code/QGSD/.planning/quick/24-improve-qgsd-debug-quorum-discussion-flo/24-SUMMARY.md
</output>
