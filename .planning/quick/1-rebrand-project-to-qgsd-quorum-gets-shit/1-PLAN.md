---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/gsd/ → commands/qgsd/ (directory rename)
  - bin/install.js
  - README.md
  - package.json
  - docs/USER-GUIDE.md
  - get-shit-done/workflows/*.md
  - get-shit-done/templates/*.md
  - get-shit-done/references/*.md
  - agents/*.md
  - CLAUDE.md
  - all other .md files with /gsd: references
autonomous: true
requirements: [REBRAND-01, REBRAND-02]

must_haves:
  truths:
    - "README headline reads 'QGSD: Quorum Gets Shit Done'"
    - "package.json description starts with QGSD:"
    - "commands/ directory is commands/qgsd/ (not commands/gsd/)"
    - "All /gsd: command references in docs/commands/workflows are /qgsd:"
    - "bin/install.js installs from commands/qgsd and uses qgsd- prefix for OpenCode"
    - "Binary name get-shit-done-cc preserved for backward compat"
    - "CHANGELOG.md left unchanged (historical record)"
  artifacts:
    - path: "commands/qgsd/"
      provides: "Renamed command directory — installs as /qgsd:* commands"
    - path: "bin/install.js"
      provides: "Updated installer using commands/qgsd and qgsd- OpenCode prefix"
    - path: "README.md"
      provides: "Updated headline, tagline, and all command references use /qgsd:"
    - path: "package.json"
      provides: "Updated description starting with QGSD:"
  key_links:
    - from: "commands/qgsd/"
      to: "bin/install.js"
      via: "Installer copies commands/qgsd/ to ~/.claude/commands/qgsd/"
      pattern: "qgsd"
---

<objective>
Full rebrand of QGSD to own its identity: rename commands from /gsd:* to /qgsd:*, update installer, and update all user-facing copy to "QGSD: Quorum Gets Shit Done".

This lets GSD and QGSD coexist side-by-side: GSD installs to commands/gsd/, QGSD installs to commands/qgsd/.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename commands directory and update bin/install.js</name>
  <files>commands/gsd/ → commands/qgsd/, bin/install.js</files>
  <action>
    **Step A — Rename commands directory:**
    ```bash
    git mv commands/gsd commands/qgsd
    ```

    **Step B — Update bin/install.js (7 targeted changes):**

    Change 1 — OpenCode command reference converter (line ~579):
    OLD: `convertedContent = convertedContent.replace(/\/gsd:/g, '/gsd-');`
    NEW: `convertedContent = convertedContent.replace(/\/qgsd:/g, '/qgsd-');`

    Change 2 — Uninstall OpenCode: remove qgsd-*.md files (line ~946):
    OLD: `if (file.startsWith('gsd-') && file.endsWith('.md')) {`
    NEW: `if (file.startsWith('qgsd-') && file.endsWith('.md')) {`

    Change 3 — Uninstall Claude/Gemini: commands/gsd path (line ~957):
    OLD: `const gsdCommandsDir = path.join(targetDir, 'commands', 'gsd');`
    NEW: `const gsdCommandsDir = path.join(targetDir, 'commands', 'qgsd');`

    Change 4 — Install OpenCode: source dir and prefix (lines ~1499-1506):
    OLD:
    ```
    const gsdSrc = path.join(src, 'commands', 'gsd');
    copyFlattenedCommands(gsdSrc, commandDir, 'gsd', pathPrefix, runtime);
    if (verifyInstalled(commandDir, 'command/gsd-*')) {
      const count = fs.readdirSync(commandDir).filter(f => f.startsWith('gsd-')).length;
    ```
    NEW:
    ```
    const gsdSrc = path.join(src, 'commands', 'qgsd');
    copyFlattenedCommands(gsdSrc, commandDir, 'qgsd', pathPrefix, runtime);
    if (verifyInstalled(commandDir, 'command/qgsd-*')) {
      const count = fs.readdirSync(commandDir).filter(f => f.startsWith('qgsd-')).length;
    ```

    Change 5 — Install Claude/Gemini: source dir, dest dir, log (lines ~1513-1520):
    OLD:
    ```
    const gsdSrc = path.join(src, 'commands', 'gsd');
    const gsdDest = path.join(commandsDir, 'gsd');
    copyWithPathReplacement(gsdSrc, gsdDest, pathPrefix, runtime);
    if (verifyInstalled(gsdDest, 'commands/gsd')) {
      console.log(`  ${green}✓${reset} Installed commands/gsd`);
    ```
    NEW:
    ```
    const gsdSrc = path.join(src, 'commands', 'qgsd');
    const gsdDest = path.join(commandsDir, 'qgsd');
    copyWithPathReplacement(gsdSrc, gsdDest, pathPrefix, runtime);
    if (verifyInstalled(gsdDest, 'commands/qgsd')) {
      console.log(`  ${green}✓${reset} Installed commands/qgsd`);
    ```

    Change 6 — Failure tracking strings in install (if present): 'command/gsd-*' → 'command/qgsd-*', 'commands/gsd' → 'commands/qgsd'

    Change 7 — Final completion message (line ~1787):
    OLD: `const command = isOpencode ? '/gsd-help' : '/gsd:help';`
    NEW: `const command = isOpencode ? '/qgsd-help' : '/qgsd:help';`
  </action>
  <verify>
    ls commands/ | grep qgsd
    # Should show: qgsd
    ls commands/ | grep "^gsd$"
    # Should return nothing
    grep -n "commands/qgsd" bin/install.js | head -5
    # Should show multiple matches
    grep -n "commands/gsd'" bin/install.js
    # Should return nothing
    grep -n "qgsd-help" bin/install.js
    # Should show 1 match
  </verify>
  <done>commands/qgsd/ exists (renamed from commands/gsd/). bin/install.js uses commands/qgsd and qgsd- prefix throughout.</done>
</task>

<task type="auto">
  <name>Task 2: Global /gsd: → /qgsd: replacement in all markdown files</name>
  <files>All .md files except CHANGELOG.md and .planning/</files>
  <action>
    Run a targeted find-replace across all markdown files.

    **IMPORTANT exclusions — do NOT change these files:**
    - CHANGELOG.md (historical record, leave entirely unchanged)
    - .planning/ directory (working state files)
    - .git/ directory

    **Also do NOT change these patterns (they are NOT command references):**
    - `mcp__codex-cli__` — MCP tool names
    - `peerDependencies: get-shit-done-cc` — npm dep
    - `npx get-shit-done-cc` — install command
    - Agent file names like `gsd-executor.md` — these are internal implementation files, not commands

    **The replacement:** `/gsd:` → `/qgsd:` in ALL remaining .md files

    Use bash to do this efficiently:
    ```bash
    find /Users/jonathanborduas/code/QGSD -name "*.md" \
      -not -path "*/CHANGELOG.md" \
      -not -path "*/.git/*" \
      -not -path "*/.planning/*" \
      | xargs grep -l "/gsd:" \
      | xargs sed -i '' 's|/gsd:|/qgsd:|g'
    ```

    This will update:
    - commands/qgsd/*.md (all command files — cross-references between commands)
    - get-shit-done/workflows/*.md (workflow files reference commands)
    - get-shit-done/templates/*.md (templates with command examples)
    - get-shit-done/references/*.md (references mentioning commands)
    - agents/*.md (agent files that reference commands)
    - docs/USER-GUIDE.md (command examples)
    - README.md (command examples in docs)
    - CLAUDE.md (R3.1 lists /gsd:plan-phase etc. — these are command names, update them)

    After running, verify no /gsd: remains in non-excluded files:
    ```bash
    grep -r "/gsd:" /Users/jonathanborduas/code/QGSD \
      --include="*.md" \
      --exclude="CHANGELOG.md" \
      --exclude-dir=".git" \
      --exclude-dir=".planning"
    ```
    Should return nothing.
  </action>
  <verify>
    grep -r "/gsd:" /Users/jonathanborduas/code/QGSD --include="*.md" --exclude="CHANGELOG.md" --exclude-dir=".git" --exclude-dir=".planning"
    # Should return nothing
    grep -c "/qgsd:" /Users/jonathanborduas/code/QGSD/README.md
    # Should be > 0
    grep -c "/qgsd:" /Users/jonathanborduas/code/QGSD/CLAUDE.md
    # Should be > 0
  </verify>
  <done>All /gsd: command references replaced with /qgsd: across the codebase. CHANGELOG.md unchanged. No /gsd: remains in active markdown files.</done>
</task>

<task type="auto">
  <name>Task 3: Update branding copy — README headline, package.json, USER-GUIDE title</name>
  <files>README.md, package.json, docs/USER-GUIDE.md</files>
  <action>
    **README.md:**

    1. Replace H1:
       OLD: `# GET SHIT DONE`
       NEW: `# QGSD: Quorum Gets Shit Done`

    2. Replace subtitle tagline:
       OLD: "A light-weight and powerful meta-prompting, context engineering and spec-driven development system for Claude Code, OpenCode, and Gemini CLI."
       NEW: "A multi-model quorum enforcement layer on top of GSD — every planning decision verified by Codex, Gemini, OpenCode, and Copilot before Claude executes."

    3. Replace the closing line near the bottom div (if present):
       Search for: "Claude Code is powerful. GSD makes it reliable."
       Replace with: "Claude Code is powerful. QGSD makes its plans trustworthy."

    Do NOT change:
    - npm badge URLs (reference get-shit-done-cc — correct)
    - `npx get-shit-done-cc@latest` install command
    - The "So I built GSD" line in Why I Built This (historical context)
    - Any /qgsd: commands (already updated by Task 2)

    **package.json:**
    Update `description` field only:
    OLD: "Multi-model quorum enforcement for GSD planning commands via Claude Code hooks."
    NEW: "QGSD: Quorum Gets Shit Done — multi-model quorum enforcement for GSD planning commands via Claude Code hooks."

    Do NOT change: name, version, bin, scripts, dependencies, or any other field.

    **docs/USER-GUIDE.md:**
    1. Replace title: `# GSD User Guide` → `# QGSD User Guide`
    2. Replace subtitle immediately after title to reference QGSD
    3. Replace standalone product references "GSD stores..." → "QGSD stores..."
    4. Replace section headers like "### GSD Update Overwrote..." → "### QGSD Update Overwrote..."
    5. Replace "GSD is designed around fresh contexts" → "QGSD is designed around fresh contexts"
    6. Replace "here is what GSD creates in your project" → "here is what QGSD creates in your project"
    7. Replace "Ad-hoc task with GSD guarantees" → "Ad-hoc task with QGSD guarantees"

    Do NOT change any /qgsd:* command references in USER-GUIDE.md (already updated by Task 2).
    Do NOT change references to "GSD" when referring specifically to the upstream get-shit-done-cc peer dependency.
  </action>
  <verify>
    grep -n "^# QGSD" /Users/jonathanborduas/code/QGSD/README.md
    # Should match H1
    grep -n "^# GET SHIT DONE" /Users/jonathanborduas/code/QGSD/README.md
    # Should return nothing
    node -e "const p=require('/Users/jonathanborduas/code/QGSD/package.json'); console.log(p.description)"
    # Should start with "QGSD: Quorum Gets Shit Done"
    node -e "const p=require('/Users/jonathanborduas/code/QGSD/package.json'); console.log(p.name, JSON.stringify(p.bin))"
    # name must be "qgsd", bin must include "get-shit-done-cc"
    grep -n "^# QGSD User Guide" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
    # Should match line 1
  </verify>
  <done>README H1 is "# QGSD: Quorum Gets Shit Done". package.json description starts with "QGSD:". USER-GUIDE.md title is "# QGSD User Guide". Binary and install command unchanged.</done>
</task>

</tasks>

<verification>
After all tasks:
1. ls commands/ — should show qgsd, NOT gsd
2. grep -rn "commands/gsd" bin/install.js — should return nothing
3. grep -n "^# QGSD" README.md — should match
4. node -e "const p=require('./package.json'); console.log(p.name, p.bin['get-shit-done-cc'])" — name=qgsd, bin entry preserved
5. grep -r "/gsd:" . --include="*.md" --exclude="CHANGELOG.md" --exclude-dir=".git" --exclude-dir=".planning" — should return nothing
6. grep -c "/qgsd:" README.md — should be > 0
</verification>

<success_criteria>
- commands/ directory has qgsd/ not gsd/
- bin/install.js uses commands/qgsd/ and qgsd- prefix throughout
- All /gsd: command references replaced with /qgsd: in all .md files (except CHANGELOG.md)
- README H1 is "# QGSD: Quorum Gets Shit Done"
- package.json description starts with "QGSD:"
- package.json name remains "qgsd", bin "get-shit-done-cc" preserved
- USER-GUIDE.md title is "# QGSD User Guide"
- CHANGELOG.md completely unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/1-rebrand-project-to-qgsd-quorum-gets-shit/1-SUMMARY.md`
</output>
