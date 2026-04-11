# 391-VOTE: Add River/embed auto-install and statusline indicators

**VOTE: BLOCK**

**Date:** 2026-04-09  
**Reviewer:** Claude Code (Haiku 4.5)  
**Context:** Pre-execution task plan review

---

## Executive Summary

The plan is **logically sound and addresses the objective correctly**, but contains **three critical path ambiguities** that must be resolved before execution. The core design is solid: fail-open blocks, idempotent checks, global path scoping. The implementation details just need explicit clarification to prevent execution errors.

---

## Detailed Findings

### Task 1: Add River and embed install blocks to install.js

**STRENGTHS:**
- ✅ Placement correct: after coderlm block (line ~2605), before "Validate hook path" comment (line ~2609)
- ✅ fail-open design: Both blocks wrapped in try/catch, idempotency checks via spawnSync/fs.existsSync
- ✅ River block correctly uses `python3 -c 'import river'` to detect availability (importable, not just installed)
- ✅ embed block correctly checks global path: `~/.claude/nf-bin/node_modules/@huggingface/transformers` (not project-local)
- ✅ Colors (cyan, green, yellow, reset) already defined at module level
- ✅ Timeouts reasonable: 3000ms python check, 60000ms pip, 120000ms npm
- ✅ Error messages truncated to 120 chars (no spam)
- ✅ Both blocks are genuinely atomic and idempotent

**CRITICAL ISSUE:**
- ⚠️ **spawnSync scope in install.js:** The coderlm block at line ~2605 is inside the `install()` function (begins line 2258). The plan assumes spawnSync can be used directly, but it's **NOT imported at module level**. Investigation shows spawnSync is **always locally required within function scope** (e.g., line 3655: `const { spawnSync } = require('child_process');`).
  
  **RESOLUTION NEEDED:** The task action must explicitly state:
  ```
  At the start of each new block (the opening {), add:
    const { spawnSync } = require('child_process');
  before first use.
  ```

**MODERATE CONCERNS:**
- pip3 install river --user may fail silently on externally-managed Python installations. This is acceptable for fail-open, but users may be confused why River didn't provision.
- npm timeout 120000ms (2 min) is adequate but tight for slow networks.

**Verification Commands:** ✅ Sound
- grep "pip3 install river" — correctly detects River block
- grep "huggingface/transformers.*nf-bin" — correctly detects embed block

---

### Task 2: Update nf-statusline.js (embed and River indicators)

**Change 1 (embed path):**
- ✅ Correct: replaces project-local path with global nf-bin path
  ```
  FROM: path.join(dir, 'node_modules', '@huggingface', 'transformers')
  TO:   path.join(homeDir, '.claude', 'nf-bin', 'node_modules', '@huggingface', 'transformers')
  ```
- ✅ Matches install.js embed block target exactly
- ✅ Preserves all existing embed indicator logic

**Change 2 (River availability check):**
- ✅ Logic is sound: wraps entire River indicator section in `riverImportable` check
- ✅ Only shows indicator when `python3 -c 'import river'` succeeds
- ✅ Preserves ALL q-table exploration logic and lastShadow recommendation rendering
- ✅ Fail-open: outer try/catch prevents hook crashes if spawnSync fails
- ✅ Timeout 3000ms is within hook execution budget

**CRITICAL ISSUES:**

1. **spawnSync import location not specified:**
   - Plan says: "Note: spawnSync must be required... Check if it already is; if not, add..."
   - Current nf-statusline.js requires: `fs`, `path`, `os`, `config-loader` — but **NOT** `child_process`
   - **RESOLUTION NEEDED:** Explicitly state:
     ```
     After line 7 (const os = require('os');), add:
       const { spawnSync } = require('child_process');
     ```

2. **River section replacement scope is ambiguous:**
   - Plan says: "Replace the entire River section (from `// 2. River indicator` comment through its closing `} catch` block)"
   - Current file has this section at lines 57-104 (from `// 2. River indicator` to closing `} catch`)
   - **RESOLUTION NEEDED:** Add explicit line range to plan:
     ```
     In hooks/nf-statusline.js, lines 57–104: Replace the entire River section...
     ```
     This ensures editor/script doesn't accidentally replace the wrong block if similar comments exist elsewhere.

3. **Verification missing spawnSync import check:**
   - Current verify section checks paths and diff, but doesn't verify that spawnSync was actually imported
   - **RESOLUTION NEEDED:** Add to verify section:
     ```
     grep "spawnSync.*require.*child_process" /path/to/hooks/nf-statusline.js
     ```

**Task 2.2 & 2.3 (dist sync and re-install):**
- ✅ cp command is correct: `cp hooks/nf-statusline.js hooks/dist/nf-statusline.js`
- ✅ diff verification is sound
- ✅ Re-install command is correct: `node bin/install.js --claude --global`

---

## Atomicity and Execution Order

**Task 1:** Atomic ✅
- Two independent blocks inserted into install.js
- No interdependencies

**Task 2:** NOT atomic ⚠️
- Step 1: Edit source (add import, replace River section, change embed path)
- Step 2: cp to dist
- Step 3: npm install
- Step 3 depends on steps 1–2 completing correctly
- This is acceptable IF done sequentially, but plan should clarify that all edits to source must complete before step 2.

---

## Summary of Required Fixes

Before execution, the plan must be updated with:

### Fix 1: Specify spawnSync import for install.js
In Task 1, add explicit note:
```
Each River and embed block must start with:
  const { spawnSync } = require('child_process');
before first use of spawnSync() within that block.
```

### Fix 2: Specify spawnSync import location for nf-statusline.js
In Task 2, change the note from:
```
Note: spawnSync must be required at the top of nf-statusline.js. Check if it already is; if not, add...
```
to:
```
At line 8 (after const os = require('os');), add:
  const { spawnSync } = require('child_process');
```

### Fix 3: Specify exact line range for River section replacement
In Task 2, replace:
```
Replace the entire River section (from `// 2. River indicator` comment through its closing `} catch` block)
```
with:
```
In hooks/nf-statusline.js, lines 57–104, replace the entire River section (from `// 2. River indicator` comment through its closing `} catch` block)
```

### Fix 4: Add spawnSync import verification
In the verification section of Task 2, add:
```
grep "spawnSync.*require.*child_process" /Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/hooks/nf-statusline.js
```

---

## Why Block (Not Approve)

This plan is **not executable as written** because:

1. **Implicit spawnSync requirement in install.js:** The code assumes spawnSync is available without importing it. This will cause a ReferenceError at execution time.

2. **Vague spawnSync import instruction in nf-statusline.js:** The plan says "check if it already is; if not, add" without specifying WHERE. This requires the executor to make a judgment call about placement, which could result in incorrect import scope.

3. **Ambiguous River section boundaries:** Without explicit line numbers, an executor might select the wrong 40-line block if the file is ever refactored or similar comments added elsewhere.

These are **not design flaws** — they're **specification gaps** that prevent safe, deterministic execution. With the four fixes above, this plan becomes a solid APPROVE.

---

## Post-Fix Recommendation

Once the four fixes are applied:
- ✅ Core logic is sound (fail-open, idempotent, global-scoped paths)
- ✅ Verification commands are correct
- ✅ Tasks are truly atomic after fixes clarify import requirements
- **VOTE: APPROVE** (after fixes)

---

## Improvements Suggested (Non-Blocking)

1. **River installation feedback:** Consider more explicit warning if `pip3 install river` silently fails:
   ```
   console.log(`  ${yellow}⚠${reset} River ML install attempt completed (may not be available);
                   check with: python3 -c 'import river'`);
   ```
   This helps users debug if River doesn't appear in statusline.

2. **npm timeout documentation:** Add comment explaining why 120000ms is chosen for transformers:
   ```
   // 120000ms (2 min) allows time for download on slow connections
   // If timeout, embed will be provisioned on next install run (idempotent)
   ```

3. **Testing note:** Add to plan: "Verify in CI/CD that pip3 is available and that —user flag works in the target environment."

---

## Files Affected (Verification Paths)

```
/Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/bin/install.js
  → Line ~2605–2650 (new River block)
  → Line ~2650–2695 (new embed block)

/Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/hooks/nf-statusline.js
  → Line 8 (new spawnSync import)
  → Line 54 (embed path update)
  → Lines 57–104 (new River section)

/Users/jonathanborduas/code/QGSD-worktrees/feature-issue-58-integrate-coderlm-adapter/hooks/dist/nf-statusline.js
  → Auto-synced from source (cp)
```

---

## Conclusion

**VOTE: BLOCK** — Fixes required before execution.  
**Path to APPROVE:** Apply fixes 1–4 above (30 minutes work).  
**Risk if fixes not applied:** ReferenceError or silent failures in import statements; incorrect line replacements.  
**Impact if approved (after fixes):** Safe, atomic, fail-open provisioning of River + embed; statusline reflects actual global availability.

