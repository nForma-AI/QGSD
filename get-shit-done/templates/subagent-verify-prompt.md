# Subagent Verify Prompt Template

Template for spawning a verification subagent from execute-phase.md.

---

## Template

```markdown
<objective>
Verify Phase {phase_number} achieved its GOAL, not just completed its TASKS.

Your job: Goal-backward verification. Start from what the phase SHOULD deliver, verify it actually exists and works in the codebase.

**Critical mindset:** Do NOT trust SUMMARY.md claims. SUMMARYs document what Claude SAID it did. You verify what ACTUALLY exists in the code. These often differ.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/verify-phase.md
@~/.claude/get-shit-done/templates/verification-report.md
@~/.claude/get-shit-done/references/verification-patterns.md
@~/.claude/get-shit-done/references/goal-backward.md
</execution_context>

<context>
**Phase being verified:**
- Phase: {phase_number} - {phase_name}
- Phase goal: {phase_goal_from_roadmap}
- Phase directory: .planning/phases/{phase_dir}/

**Must-haves to verify:**
{must_haves_yaml_from_plan_frontmatter}

**If must_haves not in frontmatter, derive from:**
- Phase goal (above)
- @.planning/ROADMAP.md (phase description)
- @.planning/REQUIREMENTS.md (requirements mapped to this phase)

**Context for verification:**
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md (if exists)
@.planning/phases/{phase_dir}/*-SUMMARY.md (claims to verify against)
</context>

<verification_approach>

## Step 1: Establish Must-Haves

**If must_haves provided in context above:** Use them directly.

**If must_haves NOT provided:** Derive using goal-backward process:
1. State the phase goal
2. Ask: "What must be TRUE for this goal to be achieved?" (3-7 observable truths)
3. For each truth: "What must EXIST?" (concrete artifacts)
4. For each artifact: "What must be WIRED?" (connections between artifacts)
5. Identify key links (critical connections most likely to be stubs)

Document your derived must-haves before proceeding.

## Step 2: Verify Observable Truths

For each truth, determine if it's achievable given the codebase state.

A truth is:
- ✓ VERIFIED: Codebase makes this truth achievable
- ✗ FAILED: Codebase prevents this truth (missing/stub code)
- ? UNCERTAIN: Can't verify programmatically (needs human)

## Step 3: Verify Required Artifacts

For each artifact, check three levels:

**Level 1 - Exists:**
```bash
[ -f "{artifact_path}" ] && echo "EXISTS" || echo "MISSING"
```

**Level 2 - Substantive:**
- Is it more than a stub? (check line count, grep for stub patterns)
- Does it have expected exports/structure?
- Are there TODO/placeholder comments?

Use patterns from verification-patterns.md.

**Level 3 - Wired:**
- Is it imported somewhere?
- Is it called/used?
- Does data flow through it?

## Step 4: Verify Key Links

Key links are the critical connections. For each:

```bash
# Check if A calls B
grep -E "{pattern_for_call}" "{file_A}"

# Check if the call uses the response
grep -A 5 "{call_pattern}" "{file_A}" | grep -E "await|then|set"
```

Key links are where stubs hide. A component might exist and an API might exist, but the component doesn't actually call the API.

## Step 5: Check Requirements Coverage

If REQUIREMENTS.md exists and has requirements mapped to this phase:
- For each requirement, determine if the codebase satisfies it
- A requirement is BLOCKED if any supporting artifact is missing/stub

## Step 6: Scan for Anti-Patterns

Run stub detection across all phase-related files:

```bash
# Find all files modified in this phase (from SUMMARYs)
# Then scan for anti-patterns

grep -r -E "TODO|FIXME|placeholder|not implemented" {phase_files} -i
grep -r -E "return null|return \{\}|return \[\]" {phase_files}
grep -r -E "console\.log\(.*\)" {phase_files} | grep -v "error\|warn"
```

## Step 7: Generate Report

Create `.planning/phases/{phase_dir}/{phase}-VERIFICATION.md` using the verification-report.md template.

Include:
- All truths with status and evidence
- All artifacts with status and details
- All key links with status and details
- Requirements coverage
- Anti-patterns found
- Human verification needs
- Gap summary with fix recommendations

</verification_approach>

<critical_rules>

**DO NOT trust SUMMARY claims.** SUMMARYs say "implemented chat component" — you verify the component actually renders messages, not a placeholder.

**DO NOT assume existence = implementation.** A file existing is level 1. You need level 2 (substantive) and level 3 (wired) verification.

**DO NOT skip key link verification.** This is where 80% of stubs hide. The pieces exist but aren't connected.

**DO generate fix plans if gaps found.** Don't just report "this is broken" — recommend specific fix plans with tasks.

**DO flag for human verification when uncertain.** If you can't verify programmatically (visual, real-time, external service), say so explicitly.

**DO keep verification fast.** Use grep/file checks, not running the app. Goal is structural verification, not functional testing.

</critical_rules>

<output>
Create: `.planning/phases/{phase_dir}/{phase}-VERIFICATION.md`

Use the verification-report.md template structure.

Return to orchestrator with:
- Status: passed | gaps_found | human_needed
- Score: N/M must-haves verified
- If gaps_found: Summary of gaps and recommended fix plans
- If human_needed: List of items requiring human verification
</output>

<success_criteria>
- [ ] Must-haves established (from frontmatter or derived)
- [ ] All truths verified with evidence
- [ ] All artifacts checked (exists + substantive + wired)
- [ ] All key links traced
- [ ] Requirements coverage assessed
- [ ] Anti-patterns scanned
- [ ] VERIFICATION.md created with full report
- [ ] Fix plans recommended if gaps found
- [ ] Human verification items listed if uncertain
</success_criteria>
```

---

## Usage

The execute-phase orchestrator fills this template and spawns a subagent:

```typescript
Task(
  prompt: filled_template,
  subagent_type: "general-purpose",
  description: "Verify phase {X} goal achievement"
)
```

The subagent:
1. Loads the verification workflow and references
2. Establishes must-haves (from frontmatter or derived)
3. Runs verification checks against codebase
4. Creates VERIFICATION.md report
5. Returns status to orchestrator

The orchestrator then:
- If `passed`: Proceeds to update_roadmap
- If `gaps_found`: Creates fix plans, executes them, re-verifies
- If `human_needed`: Presents human verification items to user

---

## Template Variables

| Variable | Source | Example |
|----------|--------|---------|
| `{phase_number}` | From execute-phase | `03` |
| `{phase_name}` | From ROADMAP.md | `chat-interface` |
| `{phase_goal_from_roadmap}` | From ROADMAP.md phase description | `Working chat interface where users can send and receive messages` |
| `{phase_dir}` | From filesystem | `03-chat-interface` |
| `{must_haves_yaml_from_plan_frontmatter}` | From PLAN.md frontmatter | YAML block with truths, artifacts, key_links |
