# Debug Subagent Prompt Template

Template for spawning debug investigation agents. Used by:
- `/gsd:debug` — Interactive debugging (find and offer to fix)
- `diagnose-issues` — UAT parallel diagnosis (find root cause only)

The `goal` flag determines behavior after root cause is found.

---

## Template

```markdown
<objective>
Investigate issue and find root cause.

**Issue:** {issue_id}
**Summary:** {issue_summary}

Symptoms are pre-filled. Skip symptom gathering, start investigating immediately.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/debug.md
@~/.claude/get-shit-done/templates/DEBUG.md
@~/.claude/get-shit-done/references/debugging/debugging-mindset.md
@~/.claude/get-shit-done/references/debugging/hypothesis-testing.md
@~/.claude/get-shit-done/references/debugging/investigation-techniques.md
</execution_context>

<symptoms>
**Pre-filled from orchestrator:**

- expected: {expected}
- actual: {actual}
- errors: {errors}
- reproduction: {reproduction}
- timeline: {timeline}
</symptoms>

<mode>
**symptoms_prefilled: true**

Skip the symptom_gathering step entirely. Symptoms section is already filled.
Start directly at investigation_loop.

**goal: {goal}**

- `find_root_cause_only` — Diagnose but do NOT fix. Return root cause to orchestrator. Used by UAT diagnosis flow where plan-fix handles the fix.
- `find_and_fix` — Find root cause, then fix and verify. Used by interactive /gsd:debug where user wants immediate resolution.
</mode>

<debug_file>
**Path:** .planning/debug/{slug}.md

Create debug file immediately with symptoms pre-filled:

```markdown
---
status: investigating
trigger: "{issue_summary}"
created: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Focus

hypothesis: gathering initial evidence
test: examining error context and relevant code
expecting: clues about failure point
next_action: search for error text in codebase

## Symptoms

expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
started: {timeline}

## Eliminated

[none yet]

## Evidence

[none yet]

## Resolution

root_cause:
fix:
verification:
files_changed: []
```

**Update continuously.** The debug file is your memory. Before every action, update Current Focus. After every finding, append to Evidence.
</debug_file>

<checkpoint_behavior>
**When you need user input during investigation:**

If you cannot proceed without user action or verification:

1. Update debug file with current state
2. Return structured checkpoint instead of completing

**Checkpoint format:**

```markdown
## CHECKPOINT REACHED

**Type:** [human-verify | human-action | decision]
**Debug Session:** .planning/debug/{slug}.md
**Progress:** {evidence_count} evidence entries, {eliminated_count} hypotheses eliminated

### Investigation State

**Current Hypothesis:** {from Current Focus}
**Evidence So Far:**
- {key finding 1}
- {key finding 2}

### Checkpoint Details

[Type-specific content]

### Awaiting

[What you need from user]
```

**Checkpoint types:**

**human-verify** — Need user to confirm something you can't observe:
- What to check, how to check it, what to report back

**human-action** — Need user to do something (auth, physical action):
- What action, why you can't do it, steps to complete

**decision** — Need user to choose investigation direction:
- What's being decided, options with implications

**After checkpoint:** Orchestrator gets user response, spawns fresh continuation agent. You will NOT be resumed.
</checkpoint_behavior>

<return_formats>
**Return ONE of these when done:**

---

**Root cause found (goal: find_root_cause_only):**

```markdown
## ROOT CAUSE FOUND

**Debug Session:** .planning/debug/{slug}.md

**Root Cause:** [specific cause with evidence]

**Evidence Summary:**
- [key finding 1]
- [key finding 2]
- [key finding 3]

**Files Involved:**
- [file1]: [what's wrong]
- [file2]: [related issue]

**Suggested Fix Direction:** [brief hint for plan-fix, not implementation]
```

---

**Root cause found (goal: find_and_fix):**

After finding root cause, proceed to fix_and_verify step per workflow.

When complete:

```markdown
## DEBUG COMPLETE

**Debug Session:** .planning/debug/resolved/{slug}.md

**Root Cause:** [what was wrong]
**Fix Applied:** [what was changed]
**Verification:** [how verified]

**Files Changed:**
- [file1]: [change]
- [file2]: [change]

**Commit:** [hash]
```

---

**Investigation inconclusive:**

```markdown
## INVESTIGATION INCONCLUSIVE

**Debug Session:** .planning/debug/{slug}.md

**What Was Checked:**
- [area 1]: [finding]
- [area 2]: [finding]

**Hypotheses Eliminated:**
- [hypothesis 1]: [why eliminated]
- [hypothesis 2]: [why eliminated]

**Remaining Possibilities:**
- [possibility 1]
- [possibility 2]

**Recommendation:** [next steps or manual review needed]
```
</return_formats>

<investigation_protocol>
**Phase 1: Gather initial evidence**

1. If errors in symptoms → search codebase for error text
2. Identify relevant code area from symptoms
3. Read relevant files COMPLETELY (don't skim)
4. Run app/tests to observe behavior firsthand

After EACH finding → append to Evidence with timestamp, what was checked, what was found, implication.

**Phase 2: Form hypothesis**

Based on evidence, form SPECIFIC, FALSIFIABLE hypothesis.

Update Current Focus:
- hypothesis: [specific theory]
- test: [how you'll test it]
- expecting: [what proves/disproves it]
- next_action: [immediate next step]

**Phase 3: Test hypothesis**

Execute ONE test at a time. Append result to Evidence.

**Phase 4: Evaluate**

If CONFIRMED:
- Update Resolution.root_cause with evidence
- If goal is find_root_cause_only → return ROOT CAUSE FOUND
- If goal is find_and_fix → proceed to fix_and_verify

If ELIMINATED:
- Append to Eliminated section with evidence
- Form new hypothesis based on evidence
- Return to Phase 2

**If stuck:** Consider checkpoint to ask user for more context or verification.
</investigation_protocol>

<success_criteria>
- [ ] Debug file created with symptoms pre-filled
- [ ] Current Focus updated before every action
- [ ] Evidence appended after every finding
- [ ] Hypotheses tested one at a time
- [ ] Root cause confirmed with evidence
- [ ] Appropriate return format based on goal
- [ ] Debug file reflects final state
</success_criteria>
```

---

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{issue_id}` | Orchestrator-assigned | `auth-screen-dark` or `UAT-001` |
| `{issue_summary}` | User description or UAT | `Auth screen is too dark` |
| `{expected}` | From symptoms | `See logo and form clearly` |
| `{actual}` | From symptoms | `Screen is dark, logo not visible` |
| `{errors}` | From symptoms | `None in console` |
| `{reproduction}` | From symptoms | `Open /auth page` |
| `{timeline}` | From symptoms | `After recent deploy` |
| `{goal}` | Orchestrator sets | `find_and_fix` or `find_root_cause_only` |
| `{slug}` | Generated from summary | `auth-screen-dark` |

---

## Usage by Orchestrator

**From /gsd:debug (interactive):**

```python
Task(
  prompt=filled_template,  # goal: find_and_fix
  subagent_type="general-purpose",
  description="Debug {slug}"
)
```

**From diagnose-issues (UAT parallel):**

```python
# Spawn all in parallel
Task(prompt=template_001, subagent_type="general-purpose", description="Debug UAT-001")  # goal: find_root_cause_only
Task(prompt=template_002, subagent_type="general-purpose", description="Debug UAT-002")
Task(prompt=template_003, subagent_type="general-purpose", description="Debug UAT-003")
```

---

## Continuation Agent

When orchestrator spawns fresh agent after checkpoint:

```markdown
<objective>
Continue debugging {slug}.

**DO NOT REDO** previous investigation. Evidence is in the debug file.
</objective>

<prior_state>
Debug file: @.planning/debug/{slug}.md

Read this file first - it contains all evidence gathered so far.
</prior_state>

<checkpoint_response>
**Checkpoint was:** {checkpoint_type}
**User response:** {user_response}

{interpretation based on checkpoint type}
</checkpoint_response>

<mode>
**goal: {goal}**
</mode>

<execution_context>
@~/.claude/get-shit-done/workflows/debug.md
@~/.claude/get-shit-done/templates/DEBUG.md
@~/.claude/get-shit-done/references/debugging/debugging-mindset.md
</execution_context>

<instructions>
1. Read debug file to understand current state
2. Incorporate user's checkpoint response into investigation
3. Continue from Current Focus
4. Update debug file continuously
5. Return with ROOT CAUSE FOUND, DEBUG COMPLETE, CHECKPOINT REACHED, or INVESTIGATION INCONCLUSIVE
</instructions>
```
