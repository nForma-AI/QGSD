---
task: "isolate GSD and QGSD so a user can have both installed in the same Claude Code instance"
date: 2026-02-21
mode: quick-full

must_haves:
  truths:
    - QGSD installs to ~/.claude/qgsd/ instead of ~/.claude/get-shit-done/ (no collision with upstream GSD)
    - QGSD agents are named qgsd-*.md instead of gsd-*.md (no collision with upstream GSD agents)
    - All QGSD workflow files reference the correct qgsd/ paths and qgsd-* agent names
    - Upstream GSD (commands/gsd/) and QGSD (commands/qgsd/) commands remain fully separate
    - After reinstall, ~/.claude/qgsd/ exists and ~/.claude/get-shit-done/ does NOT exist (for QGSD's content)
  artifacts:
    - bin/install.js (directory name + agent copy pattern updated)
    - hooks/gsd-check-update.js (VERSION path updated)
    - hooks/dist/gsd-check-update.js (VERSION path updated)
    - get-shit-done/workflows/*.md (path references updated)
    - agents/gsd-*.md → agents/qgsd-*.md (renamed)
    - get-shit-done/workflows/*.md (subagent_type references updated)
  key_links:
    - bin/install.js (11 'get-shit-done' occurrences + agent copy pattern)
    - hooks/gsd-check-update.js:16-17
    - agents/ directory (11 agent files to rename)
---

## Task 1 — Fix directory collision: get-shit-done/ → qgsd/

**Goal:** QGSD installs to `~/.claude/qgsd/` not `~/.claude/get-shit-done/`, eliminating the namespace collision with upstream GSD.

files:
  - bin/install.js
  - hooks/gsd-check-update.js
  - hooks/dist/gsd-check-update.js
  - get-shit-done/workflows/set-profile.md
  - get-shit-done/workflows/settings.md
  - get-shit-done/workflows/diagnose-issues.md
  - get-shit-done/workflows/quick.md
  - (any other workflow source files referencing ~/.claude/get-shit-done/)

action: |
  1. In bin/install.js: replace ALL occurrences of the string 'get-shit-done' (the subdirectory name) with 'qgsd'.
     Key locations: lines ~970, 1256, 1257, 1365, 1372, 1529, 1530, 1532, 1534, 1579, 1590.
     Note: do NOT change the function `getDirName()` which handles parent config dir (.claude/.opencode/.gemini).
     The change is ONLY for the subdirectory name: 'get-shit-done' → 'qgsd'.

  2. In hooks/gsd-check-update.js: update VERSION file path references:
     OLD: path.join(homeDir, '.claude', 'get-shit-done', 'VERSION')
     NEW: path.join(homeDir, '.claude', 'qgsd', 'VERSION')
     (Same for local: path.join(cwd, '.claude', 'get-shit-done', 'VERSION') → 'qgsd')

  3. In hooks/dist/gsd-check-update.js: apply the same VERSION path changes.

  4. In workflow source files: replace path references in bash/shell code blocks:
     OLD: ~/.claude/get-shit-done/bin/gsd-tools.cjs
     NEW: ~/.claude/qgsd/bin/gsd-tools.cjs
     Also replace: ./.claude/get-shit-done/ → ./.claude/qgsd/
     Use grep to find all workflow files with 'get-shit-done' in their content:
     grep -r 'get-shit-done' get-shit-done/workflows/ --include="*.md" -l
     Then update each file found.

verify: |
  grep -r 'get-shit-done' bin/install.js | grep -v "^#" | wc -l
  # Should be 0 (no remaining 'get-shit-done' references in installer)
  grep -r 'get-shit-done' hooks/gsd-check-update.js | wc -l
  # Should be 0
  grep -r 'get-shit-done' get-shit-done/workflows/ --include="*.md" | wc -l
  # Should be 0

done: All 'get-shit-done' path references replaced with 'qgsd' in installer, hooks, and workflow sources

---

## Task 2 — Fix agent collision: rename gsd-*.md → qgsd-*.md and update references

**Goal:** QGSD's custom agents are named `qgsd-*.md` so they don't conflict with upstream GSD's `gsd-*.md` agents. All workflow references updated to match.

files:
  - agents/ (11 gsd-*.md files to rename)
  - bin/install.js (agent copy pattern)
  - get-shit-done/workflows/*.md (subagent_type references)

action: |
  1. Rename all agent source files in agents/:
     gsd-codebase-mapper.md    → qgsd-codebase-mapper.md
     gsd-debugger.md           → qgsd-debugger.md
     gsd-executor.md           → qgsd-executor.md
     gsd-integration-checker.md → qgsd-integration-checker.md
     gsd-phase-researcher.md   → qgsd-phase-researcher.md
     gsd-plan-checker.md       → qgsd-plan-checker.md
     gsd-planner.md            → qgsd-planner.md
     gsd-project-researcher.md → qgsd-project-researcher.md
     gsd-research-synthesizer.md → qgsd-research-synthesizer.md
     gsd-roadmapper.md         → qgsd-roadmapper.md
     gsd-verifier.md           → qgsd-verifier.md
     (qgsd-quorum-test-worker.md already correctly named — leave as-is)

  2. In bin/install.js, update the agent copy logic:
     Find where the installer copies agents (searches for gsd-*.md files to copy).
     Change the filter/pattern from 'gsd-' to 'qgsd-' so only QGSD's agents are installed.
     The installer should copy agents/qgsd-*.md → ~/.claude/agents/qgsd-*.md.

  3. In all workflow source files, update subagent_type references:
     "gsd-planner"              → "qgsd-planner"
     "gsd-executor"             → "qgsd-executor"
     "gsd-verifier"             → "qgsd-verifier"
     "gsd-plan-checker"         → "qgsd-plan-checker"
     "gsd-phase-researcher"     → "qgsd-phase-researcher"
     "gsd-project-researcher"   → "qgsd-project-researcher"
     "gsd-research-synthesizer" → "qgsd-research-synthesizer"
     "gsd-roadmapper"           → "qgsd-roadmapper"
     "gsd-debugger"             → "qgsd-debugger"
     "gsd-integration-checker"  → "qgsd-integration-checker"
     "gsd-codebase-mapper"      → "qgsd-codebase-mapper"

     Find all files with these references:
     grep -r 'subagent_type.*gsd-' get-shit-done/ commands/ agents/ --include="*.md" -l
     Update each file found.

     Also update any 'gsd-planner', 'gsd-executor' etc. references that appear outside
     subagent_type= context (e.g. in descriptions or comments) to use qgsd- prefix.

verify: |
  ls agents/ | grep "^gsd-" | wc -l
  # Should be 0 (no gsd-*.md files remain in source agents/)
  ls agents/ | grep "^qgsd-" | wc -l
  # Should be 12 (11 renamed + 1 existing qgsd-quorum-test-worker.md)
  grep -r 'subagent_type="gsd-' get-shit-done/ commands/ --include="*.md" | wc -l
  # Should be 0

done: All agent files renamed to qgsd-* and all subagent_type references updated in workflow sources

---

## Task 3 — Reinstall and verify isolation

**Goal:** Apply the changes by running the QGSD installer, then confirm isolation works.

files:
  - ~/.claude/qgsd/ (expected to exist after reinstall)
  - ~/.claude/agents/qgsd-*.md (expected to exist after reinstall)

action: |
  Run the QGSD installer from source:
  node /Users/jonathanborduas/code/QGSD/bin/install.js --global

  This reinstalls QGSD with the new qgsd/ directory structure.

  After install, verify:
  1. ~/.claude/qgsd/ directory exists
  2. ~/.claude/get-shit-done/ directory does NOT exist (or is empty — upstream GSD only)
  3. ~/.claude/agents/qgsd-planner.md exists
  4. ~/.claude/agents/gsd-planner.md does NOT exist (or belongs to upstream GSD if installed)

verify: |
  ls ~/.claude/qgsd/ > /dev/null 2>&1 && echo "qgsd/ EXISTS" || echo "qgsd/ MISSING"
  ls ~/.claude/get-shit-done/ > /dev/null 2>&1 && echo "WARN: get-shit-done/ still exists" || echo "get-shit-done/ clean"
  ls ~/.claude/agents/qgsd-planner.md > /dev/null 2>&1 && echo "qgsd-planner.md EXISTS" || echo "MISSING"

done: ~/.claude/qgsd/ contains QGSD's workflows/bin, ~/.claude/agents/qgsd-*.md installed, no gsd-* agent collision
