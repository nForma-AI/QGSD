---
phase: quick-136
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .npmignore
  - package.json
  - README.md
  - package-lock.json
autonomous: true
formal_artifacts: none
requirements: [QUICK-136]

must_haves:
  truths:
    - "npm pack --dry-run shows zero *.test.* files in package"
    - "npm pack --dry-run excludes generate-logo-svg.js, generate-terminal-svg.js, lint-isolation.js, publish.sh"
    - "Package size drops significantly from current 606.7 kB / 258 files"
    - "README npm badge URLs point to @nforma.ai/qgsd (not bare qgsd)"
    - "package.json author is nForma AI"
    - "package.json has no get-shit-done-cc peerDependency (qgsd-core/ exists)"
    - "package-lock.json name field is @nforma.ai/qgsd (not @langblaze.ai/qgsd)"
  artifacts:
    - path: ".npmignore"
      provides: "Test and dev-script exclusion patterns"
      contains: "*.test.*"
    - path: "package.json"
      provides: "Corrected author and removed stale peerDep"
      contains: "nForma AI"
    - path: "README.md"
      provides: "Corrected npm badge URLs"
      contains: "@nforma.ai/qgsd"
    - path: "package-lock.json"
      provides: "Regenerated lockfile with correct scope"
      contains: "@nforma.ai/qgsd"
  key_links:
    - from: ".npmignore"
      to: "npm pack output"
      via: "npm pack --dry-run"
      pattern: "total files.*<200"
    - from: "package.json"
      to: "package-lock.json"
      via: "npm install regeneration"
      pattern: "@nforma.ai/qgsd"
---

<objective>
Harden npm package for release quality: exclude 87 test files and 4 dev-only scripts from the published tarball, fix README badge URLs to point to the scoped @nforma.ai/qgsd package, update author field, remove stale peerDependency on get-shit-done-cc (qgsd-core/ bundles it now), and regenerate package-lock.json to clear the leftover @langblaze.ai scope name.

Purpose: Ensure `npm publish` produces a clean, minimal package with correct metadata.
Output: Updated .npmignore, package.json, README.md, package-lock.json
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@package.json
@.npmignore
@README.md
@.github/workflows/publish.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Exclude test files and dev-only scripts from npm package</name>
  <files>.npmignore</files>
  <action>
Replace the current `.npmignore` (which only has `**/*.bak`) with comprehensive exclusions:

```
# Backup files
**/*.bak

# Test files — all patterns used in the repo
**/*.test.*
**/*.test.cjs
**/*.test.js
**/*.test.mjs

# Dev-only scripts (not needed by consumers)
scripts/generate-logo-svg.js
scripts/generate-terminal-svg.js
scripts/lint-isolation.js
scripts/publish.sh

# Formal verification artifacts (internal development only)
.formal/
formal/

# Planning and project management
.planning/
.agents/

# Build artifacts and caches
.formal/tla/*_TTrace_*
.formal/check-results.ndjson
```

After writing, run `npm pack --dry-run 2>&1 | tail -20` to verify:
- Zero lines matching `*.test.*` in the output
- No `scripts/generate-logo-svg.js`, `scripts/generate-terminal-svg.js`, `scripts/lint-isolation.js`, `scripts/publish.sh`
- Total files should drop from 258 to ~170 or fewer
- Package size should drop from 606.7 kB

IMPORTANT: The `files` field in package.json is an allowlist that takes precedence. `.npmignore` acts as a denylist within those allowed directories. Since `bin`, `scripts`, and `hooks/dist` are in the `files` array, `.npmignore` patterns will correctly exclude test files from `bin/` and dev scripts from `scripts/`. Verify this with the dry-run.
  </action>
  <verify>
Run `npm pack --dry-run 2>&1 | grep -c '\.test\.'` — must return 0.
Run `npm pack --dry-run 2>&1 | grep -E 'generate-logo|generate-terminal|lint-isolation|publish\.sh'` — must return no matches.
Run `npm pack --dry-run 2>&1 | grep 'total files'` — should show significantly fewer than 258.
  </verify>
  <done>npm pack dry-run contains zero test files, zero dev-only scripts, and total file count is under 200</done>
</task>

<task type="auto">
  <name>Task 2: Fix package metadata — badges, author, peerDeps, lockfile</name>
  <files>README.md, package.json, package-lock.json</files>
  <action>
1. **README.md lines 7-8** — Fix npm badge URLs:
   - Line 7: Change `https://img.shields.io/npm/v/qgsd` to `https://img.shields.io/npm/v/@nforma.ai/qgsd`
     and `https://www.npmjs.com/package/qgsd` to `https://www.npmjs.com/package/@nforma.ai/qgsd`
   - Line 8: Change `https://img.shields.io/npm/dm/qgsd` to `https://img.shields.io/npm/dm/@nforma.ai/qgsd`
     and `https://www.npmjs.com/package/qgsd` to `https://www.npmjs.com/package/@nforma.ai/qgsd`

2. **package.json** — Two changes:
   - Change `"author": "TACHES"` to `"author": "nForma AI"`
   - Remove the entire `"peerDependencies"` block (lines 18-20). Rationale: `qgsd-core/` directory exists and bundles GSD core directly, so the `get-shit-done-cc` peer dependency is stale and would cause spurious warnings for users.

3. **package-lock.json** — Regenerate to fix the stale `@langblaze.ai/qgsd` name:
   - Run `npm install` (this regenerates package-lock.json with the current `@nforma.ai/qgsd` name from package.json)
   - Verify: `grep langblaze package-lock.json` returns no matches

4. **publish.yml** — Already correct (no `@langblaze.ai` references found). No changes needed.
  </action>
  <verify>
Run `grep -c 'npm/v/@nforma.ai' README.md` — must return 1 (version badge).
Run `grep -c 'npm/dm/@nforma.ai' README.md` — must return 1 (downloads badge).
Run `grep -c 'npmjs.com/package/@nforma.ai/qgsd' README.md` — must return 2 (both badge links).
Run `node -e "const p = require('./package.json'); console.log(p.author)"` — must print "nForma AI".
Run `node -e "const p = require('./package.json'); console.log(p.peerDependencies)"` — must print "undefined".
Run `grep langblaze package-lock.json` — must return no matches.
  </verify>
  <done>README badges resolve to @nforma.ai/qgsd on shields.io and npmjs.com; author is "nForma AI"; no peerDependencies block exists; package-lock.json has @nforma.ai/qgsd everywhere with zero @langblaze.ai references</done>
</task>

</tasks>

<verification>
Final comprehensive check after both tasks:
1. `npm pack --dry-run 2>&1 | grep -c '\.test\.'` returns 0
2. `npm pack --dry-run 2>&1 | grep 'total files'` shows under 200 files
3. `npm pack --dry-run 2>&1 | grep -E 'generate-logo|generate-terminal|lint-isolation|publish\.sh'` returns nothing
4. `grep -c '@nforma.ai/qgsd' README.md` returns at least 4 (2 badge images + 2 badge links)
5. `node -e "const p = require('./package.json'); console.log(JSON.stringify({author: p.author, peer: p.peerDependencies}))"` prints `{"author":"nForma AI"}` (peer is undefined, omitted)
6. `grep langblaze package-lock.json` returns no matches
7. `npm test` still passes (test files excluded from package but still present on disk)
</verification>

<success_criteria>
- npm package contains zero test files and zero dev-only scripts
- Package file count under 200 (down from 258)
- All npm badge URLs in README resolve to @nforma.ai/qgsd
- Author field is "nForma AI"
- No peerDependencies on get-shit-done-cc
- package-lock.json uses @nforma.ai/qgsd scope throughout
- npm test still passes (exclusions are publish-only)
</success_criteria>

<output>
After completion, create `.planning/quick/136-npm-release-quality-exclude-test-files-f/136-SUMMARY.md`
</output>
