# Phase 29: Restore mcp-status v2 + Requirements Checkbox Cleanup - Research

**Researched:** 2026-02-22
**Domain:** Git working-tree recovery + REQUIREMENTS.md documentation maintenance
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OBS-01 | User can run `/qgsd:mcp-status` to see all connected MCPs with name, version, current model, and availability | v2 exists at HEAD (29a8236); `git checkout -- commands/qgsd/mcp-status.md` restores it; copy to installed path makes it live |
| OBS-02 | Status display shows health state (available / quota-exceeded / error) derived from scoreboard data | v2 Step 4 has explicit 3-branch derivation from `counts[scoreboardKey]`; already verified by 26-VERIFICATION.md must-have #3 |
| OBS-03 | Status shows available models for each agent (from `identity` tool response) | v2 Step 3 parses `available_models` from identity JSON response with truncation; already verified by 26-VERIFICATION.md must-have #5 |
| OBS-04 | Status shows recent UNAVAIL count per agent from quorum scoreboard | v2 Step 1 inline script iterates `rounds[].votes`, counts UNAVAIL per key; already verified by 26-VERIFICATION.md must-have #4 |
</phase_requirements>

---

## Summary

Phase 29 is a surgical recovery operation with two independent tasks: (1) restore `commands/qgsd/mcp-status.md` from its regressed working-tree v1 state back to the v2 implementation committed at `29a8236`, and (2) mark OBS-01 through OBS-04 as `[x]` in REQUIREMENTS.md.

The regression root cause: Phase 28 plan `28-01-PLAN.md` contained the full text of an older `mcp-status.md` v1 as a reference copy (for mcp-update.md authoring context). During Phase 28 execution, the v1 content was written to `commands/qgsd/mcp-status.md` overwriting the v2, and subsequently `cp`-ed to the installed path — both without a git commit. The git commit history shows `29a8236` is the only commit that ever touched `commands/qgsd/mcp-status.md`, meaning HEAD still contains v2 (125 lines). The working tree file is the problem, not git history.

The REQUIREMENTS.md checkbox situation is simpler than the audit suggested. Inspection of the current file shows STD-01, STD-03, STD-05, STD-06, STD-07, and STD-09 are already marked `[x]` — this drift was resolved before the audit's finding crystallized into the gap-closure phases. Only OBS-01 through OBS-04 remain as `[ ]` and need to be updated to `[x]`.

**Primary recommendation:** Execute `git checkout -- commands/qgsd/mcp-status.md` to restore v2 from HEAD, copy to installed path, then flip 4 checkbox lines in REQUIREMENTS.md from `[ ]` to `[x]`. Commit both changes together.

---

## Standard Stack

No external libraries needed. This phase uses only:

| Tool | Purpose | Why Standard |
|------|---------|--------------|
| `git checkout -- <file>` | Restore working-tree file to HEAD version | Native git; the only safe way to discard unstaged modifications to a tracked file |
| `cp <src> <dst>` | Sync source command file to installed location | Direct file copy; no transformation needed |
| `sed -i` or direct file edit | Update `[ ]` to `[x]` in REQUIREMENTS.md | Targeted line replacement on 4 specific lines |

**No npm install needed.** No new files. No new dependencies.

---

## Architecture Patterns

### Pattern 1: Working Tree Recovery via git checkout

**What:** Discard an unstaged modification by checking out the HEAD version of a specific file.
**When to use:** When `git status` shows a tracked file as modified (unstaged) and HEAD has the correct version.
**Example:**
```bash
# Verify HEAD has v2 (expected: 125)
git show HEAD:commands/qgsd/mcp-status.md | wc -l

# Restore working tree to HEAD version (discards v1 overwrite)
git checkout -- commands/qgsd/mcp-status.md

# Verify restoration (expected: 125)
wc -l commands/qgsd/mcp-status.md
```

**Critical:** `git checkout --` (with double dash) is safe — it only restores the file, it does NOT switch branches. Equivalent to `git restore commands/qgsd/mcp-status.md` in git >= 2.23.

### Pattern 2: Source-to-Installed Sync

**What:** After restoring the source file, copy it to the installed Claude commands path.
**When to use:** Any time `commands/qgsd/*.md` is modified — both paths must be in sync.
**Example:**
```bash
cp /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md \
   ~/.claude/commands/qgsd/mcp-status.md

# Verify sync
diff /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md \
     ~/.claude/commands/qgsd/mcp-status.md && echo "SYNC OK"
```

### Pattern 3: Checkbox Update in REQUIREMENTS.md

**What:** Change `- [ ]` to `- [x]` for 4 specific requirement lines.
**When to use:** When a requirement was verified in a VERIFICATION.md but the checkbox was never updated.
**Target lines (current state — confirmed by direct inspection 2026-02-22):**

```
Line 57: - [ ] **OBS-01**: ...
Line 58: - [ ] **OBS-02**: ...
Line 59: - [ ] **OBS-03**: ...
Line 60: - [ ] **OBS-04**: ...
```

These must become `- [x]`. STD-01, STD-03, STD-05, STD-06, STD-07, STD-09 are already `[x]` — do NOT touch them.

### Recommended Project Structure (no changes needed)

```
commands/qgsd/
└── mcp-status.md        # source — restored to v2 (125 lines) via git checkout --

~/.claude/commands/qgsd/
└── mcp-status.md        # installed — overwritten with cp from source

.planning/
└── REQUIREMENTS.md      # OBS-01–04 checkbox updated from [ ] to [x]
```

### Anti-Patterns to Avoid

- **Using `git stash` then reapply:** The working tree has v1 which is wrong — we want to DISCARD it, not stash it.
- **Manually rewriting mcp-status.md from scratch:** v2 exists in git; always prefer `git checkout --` over manual reconstruction.
- **Updating all STD checkboxes:** STD-01, 03, 05, 06, 07, 09 are already `[x]`. Touching them adds unnecessary noise and risks corrupting already-correct state.
- **Forgetting the installed copy:** Restoring source without copying to `~/.claude/commands/qgsd/mcp-status.md` means Claude Code still serves v1.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Restore modified tracked file | Manually recreate v2 content | `git checkout -- <file>` | HEAD already has v2; reconstruction risks transcription errors |
| Verify two files are identical | Write comparison script | `diff <file1> <file2>` | Standard tool, zero dependencies |

**Key insight:** This phase is about undoing an accidental overwrite, not building new functionality. The correct v2 content already exists in git at HEAD.

---

## Common Pitfalls

### Pitfall 1: Assuming HEAD Does Not Have v2

**What goes wrong:** Planner uses `git show 29a8236:commands/qgsd/mcp-status.md` to get v2 content instead of simply `git checkout -- commands/qgsd/mcp-status.md` because they assume HEAD has been overwritten.
**Why it happens:** The audit says the regression happened "during Phase 28 work" — which could imply a committed overwrite.
**How to avoid:** Verify with `git log --oneline -- commands/qgsd/mcp-status.md` first. Only one commit ever touched this file: `29a8236`. HEAD IS v2. `git checkout --` is correct and sufficient.
**Warning signs:** If `git log -- commands/qgsd/mcp-status.md` shows more than one commit, use `git checkout 29a8236 -- commands/qgsd/mcp-status.md` instead.

### Pitfall 2: REQUIREMENTS.md Checkbox Drift — Already Partially Fixed

**What goes wrong:** Plan assumes all 7 STD checkboxes (STD-01, 03, 05, 06, 07, 09, 10) need to be flipped to `[x]`.
**Why it happens:** The milestone audit listed them as drift, but direct file inspection shows they are already `[x]` in the current REQUIREMENTS.md.
**How to avoid:** Always read REQUIREMENTS.md directly before editing. Only OBS-01–04 need to change. STD-10 remains `[ ]` (addressed in Phase 30, not this phase).
**Warning signs:** If a plan task says "update STD-01 checkbox", that task is wrong — it's already done.

### Pitfall 3: Using git restore Instead of git checkout

**What goes wrong:** `git restore` syntax differs between git versions and Claude may generate wrong flags.
**How to avoid:** Use `git checkout -- commands/qgsd/mcp-status.md` — universally supported syntax across all git versions >= 1.8.

### Pitfall 4: Wrong Traceability Table Update

**What goes wrong:** Updating the traceability table in REQUIREMENTS.md when only the checkbox section needs updating.
**Why it happens:** The traceability table (lines 121–124) already shows `Phase 29 (gap closure) | Pending` for OBS-01–04. After this phase completes, these should be updated to `Complete`.
**How to avoid:** Update BOTH the checkbox (line 57–60: `[ ]` → `[x]`) AND the traceability table status column (`Pending` → `Complete`).

---

## Code Examples

### Complete Execution Sequence

```bash
# Step 1: Verify current state before touching anything
git status commands/qgsd/mcp-status.md
# Expected: "modified:   commands/qgsd/mcp-status.md"

wc -l commands/qgsd/mcp-status.md
# Expected: 103 (v1 — the regression)

wc -l ~/.claude/commands/qgsd/mcp-status.md
# Expected: 103 (v1 — installed copy also regressed)

git show HEAD:commands/qgsd/mcp-status.md | wc -l
# Expected: 125 (v2 — HEAD is correct)

# Step 2: Restore v2 from HEAD
git checkout -- commands/qgsd/mcp-status.md

# Step 3: Verify restoration
wc -l commands/qgsd/mcp-status.md
# Expected: 125

grep "allowed-tools" commands/qgsd/mcp-status.md -A 12 | grep "mcp__claude-glm__identity"
# Expected: match (confirms v2 with 10 agents)

# Step 4: Install to ~/.claude
cp /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md \
   ~/.claude/commands/qgsd/mcp-status.md

# Step 5: Verify installed copy matches source
diff /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md \
     ~/.claude/commands/qgsd/mcp-status.md && echo "SYNC OK"

wc -l ~/.claude/commands/qgsd/mcp-status.md
# Expected: 125
```

### REQUIREMENTS.md Checkbox Edit

The 4 lines to change (by exact content match, confirmed by grep on 2026-02-22):

```
Before:
- [ ] **OBS-01**: User can run `/qgsd:mcp-status` to see all connected MCPs with name, version, current model, and availability
- [ ] **OBS-02**: Status display shows health state (available / quota-exceeded / error) derived from scoreboard data
- [ ] **OBS-03**: Status shows available models for each agent (from `identity` tool response)
- [ ] **OBS-04**: Status shows recent UNAVAIL count per agent from quorum scoreboard

After:
- [x] **OBS-01**: User can run `/qgsd:mcp-status` to see all connected MCPs with name, version, current model, and availability
- [x] **OBS-02**: Status display shows health state (available / quota-exceeded / error) derived from scoreboard data
- [x] **OBS-03**: Status shows available models for each agent (from `identity` tool response)
- [x] **OBS-04**: Status shows recent UNAVAIL count per agent from quorum scoreboard
```

Also update the traceability table for OBS-01–04 (around line 121–124):

```
Before (4 rows):
| OBS-01 | Phase 29 (gap closure) | Pending |
| OBS-02 | Phase 29 (gap closure) | Pending |
| OBS-03 | Phase 29 (gap closure) | Pending |
| OBS-04 | Phase 29 (gap closure) | Pending |

After:
| OBS-01 | Phase 29 (gap closure) | Complete |
| OBS-02 | Phase 29 (gap closure) | Complete |
| OBS-03 | Phase 29 (gap closure) | Complete |
| OBS-04 | Phase 29 (gap closure) | Complete |
```

### Verification Sequence After Changes

```bash
# Confirm v2 is live (source)
wc -l /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md
# Expected: 125

# Confirm v2 is live (installed)
wc -l ~/.claude/commands/qgsd/mcp-status.md
# Expected: 125

# Confirm 10-agent frontmatter present
grep "mcp__claude-glm__identity" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md
# Expected: match

grep "mcp__claude-glm__identity" ~/.claude/commands/qgsd/mcp-status.md
# Expected: match

# Confirm no git modification on mcp-status.md after commit
git status commands/qgsd/mcp-status.md
# Expected: clean (no output)

# Confirm OBS checkboxes now [x]
grep "OBS-0[1234]" /Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md | grep "\[ \]"
# Expected: no output (all [x])

# Confirm STD checkboxes still [x] (not regressed)
grep "STD-0[135679]" /Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md | grep "\[ \]"
# Expected: no output (all [x])
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| v1 mcp-status.md (103 lines, 4 agents, provider HTTP probe) | v2 (125 lines, 10 agents, identity tool polling, scoreboard UNAVAIL) | OBS-01–04 satisfied |
| REQUIREMENTS.md OBS-01–04: `[ ]` | `[x]` | Documentation reflects implementation truth |

**Regression timeline:**
- `2026-02-22 19:05` — `29a8236`: v2 committed, both source and installed copy = 125 lines (v2)
- `2026-02-22 19:48` — Phase 28 execution: v1 content written to source, cp-ed to installed — no commit recorded
- `2026-02-22 20:xx` — Audit discovers regression, gap closure phase 29 created

---

## Open Questions

1. **Why did Phase 28 overwrite mcp-status.md?**
   - What we know: `28-01-PLAN.md` contains the full v1 text of the older mcp-status.md in its task content (as context for writing mcp-update.md). The Phase 28 executor appears to have written that content to disk.
   - What's unclear: Whether this was a deliberate action or an accidental tool call.
   - Recommendation: This is informational only — no action needed for Phase 29. The fix (`git checkout --`) is unambiguous.

2. **Should the traceability table status be updated too?**
   - What we know: The traceability table at lines 121–124 shows `Pending` for OBS-01–04.
   - What's unclear: The phase description mentions only checkboxes, not the traceability table.
   - Recommendation: Update both for consistency. Traceability table `Pending` → `Complete` for OBS-01–04 in the same REQUIREMENTS.md edit.

---

## Sources

### Primary (HIGH confidence)

- Direct git inspection — `git log --oneline -- commands/qgsd/mcp-status.md`: confirms only one commit (29a8236) ever touched the file; HEAD is v2 (125 lines)
- Direct file inspection — `wc -l commands/qgsd/mcp-status.md`: confirms working tree is 103 lines (v1)
- Direct file inspection — `wc -l ~/.claude/commands/qgsd/mcp-status.md`: confirms installed copy is 103 lines (v1)
- `git diff HEAD -- commands/qgsd/mcp-status.md`: shows exact diff — v1 description, no identity tools in frontmatter, no scoreboard steps
- Direct REQUIREMENTS.md inspection (grep on 2026-02-22): STD-01/03/05/06/07/09 already `[x]`; only OBS-01–04 are `[ ]`
- `.planning/phases/26-mcp-status-command/26-VERIFICATION.md`: Phase 26 VERIFICATION explicitly noted OBS-01–04 checkbox gap; all 4 OBS requirements marked SATISFIED
- `.planning/v0.4-MILESTONE-AUDIT.md`: Root cause of regression documented; fix identified as `git checkout -- commands/qgsd/mcp-status.md`

### Secondary (MEDIUM confidence)

- Phase 28 `28-01-PLAN.md` task content: explains why v1 content was in the execution context (reference for mcp-update.md authoring), consistent with accidental overwrite pattern

---

## Metadata

**Confidence breakdown:**
- mcp-status.md recovery approach: HIGH — verified by git log, git diff, wc -l; fix is single command
- REQUIREMENTS.md checkbox scope: HIGH — verified by direct grep; exactly 4 lines need changing
- Traceability table update: MEDIUM — inferred from consistency; phase description focuses on checkboxes only

**Research date:** 2026-02-22
**Valid until:** N/A — this is a point-in-time gap closure; state is fully determined by current git + file state
