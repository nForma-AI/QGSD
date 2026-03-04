---
phase: quick-162
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/sync-baseline-requirements.cjs
  - bin/sync-baseline-requirements.test.cjs
  - commands/qgsd/sync-baselines.md
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Running sync-baselines with no flags auto-detects project intent and syncs"
    - "Running sync-baselines with --profile still works as explicit override"
    - "Running sync-baselines with --intent-file still works as explicit override"
    - "The --detect flag is removed from the skill argument-hint"
    - "Skill asks user for confirmation only when there are changes to sync"
  artifacts:
    - path: "bin/sync-baseline-requirements.cjs"
      provides: "CLI with auto-detect as default fallback"
      contains: "detectProjectIntent"
    - path: "commands/qgsd/sync-baselines.md"
      provides: "Simplified skill that always auto-detects first"
      contains: "auto-detect"
    - path: "bin/sync-baseline-requirements.test.cjs"
      provides: "Tests covering default auto-detect behavior"
      contains: "auto-detect"
  key_links:
    - from: "bin/sync-baseline-requirements.cjs"
      to: "bin/detect-project-intent.cjs"
      via: "require('./detect-project-intent.cjs')"
      pattern: "detectProjectIntent"
---

<objective>
Make /qgsd:sync-baselines always use auto-detect mode by default. Remove the separate --detect flag from the CLI tool -- when no --profile or --intent-file is given, the tool should auto-detect project intent (via detect-project-intent.cjs), show what it found, and sync. The skill definition should be simplified to always auto-detect first, show signals, and ask for confirmation only if there are actual changes to sync.

Purpose: Eliminate the extra step of passing --detect. Auto-detection is always the right default; explicit --profile is the override.
Output: Updated CLI tool, skill definition, and tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/sync-baseline-requirements.cjs
@bin/detect-project-intent.cjs
@bin/sync-baseline-requirements.test.cjs
@commands/qgsd/sync-baselines.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update CLI to auto-detect by default and simplify skill definition</name>
  <files>
    bin/sync-baseline-requirements.cjs
    commands/qgsd/sync-baselines.md
  </files>
  <action>
**CLI changes in `bin/sync-baseline-requirements.cjs`:**

1. In the CLI section (the `if (require.main === module)` block, line 206+), change the fallback priority. Current: `--intent-file > --detect > --profile > config.json intent > config.json profile > error`. New: `--intent-file > --profile > config.json intent > config.json profile > AUTO-DETECT`.

2. Remove the `if (args.includes('--detect'))` block entirely (lines 235-251). The `--detect` flag is now a no-op for backwards compat -- just strip it silently. Add a comment near the top of CLI section: `// --detect is deprecated (auto-detect is now the default behavior)`.

3. At the bottom of the CLI section, where it currently prints usage and exits with code 1 when no profile is found (lines 277-282), replace with auto-detect fallback:

```javascript
if (!profile) {
  // Auto-detect project intent (default behavior)
  try {
    const { detectProjectIntent } = require('./detect-project-intent.cjs');
    const detectionResult = detectProjectIntent(process.cwd());
    const intent = detectionResult.suggested;
    const result = syncBaselineRequirementsFromIntent(intent);
    if (jsonOutput) {
      console.log(JSON.stringify({ ...result, detection: detectionResult }, null, 2));
    } else {
      printReport(result, `auto-detected intent (base_profile: ${intent.base_profile})`);
    }
    process.exit(0);
  } catch (err) {
    console.error(`Error auto-detecting project intent: ${err.message}`);
    console.error('Hint: use --profile <web|mobile|desktop|api|cli|library> to specify manually');
    process.exit(1);
  }
}
```

Key differences from the old --detect block:
- JSON output includes `detection` field with full detection metadata (suggested, signals, needs_confirmation) so the skill can display signals
- Error message suggests --profile as fallback instead of showing full usage

4. Keep the exported functions (`syncBaselineRequirements`, `syncBaselineRequirementsFromIntent`) unchanged -- this is CLI-only change.

**Skill changes in `commands/qgsd/sync-baselines.md`:**

1. Update frontmatter:
   - `description`: "Sync baseline requirements into .formal/requirements.json (auto-detects project intent by default)"
   - `argument-hint`: `[--profile <web|mobile|desktop|api|cli|library>]` (remove `[--detect]`)

2. Update `<objective>` to: "Sync baseline requirements from the QGSD defaults into `.formal/requirements.json`. Auto-detects project intent by default by scanning the repo for framework, deployment, and configuration signals. Supports explicit `--profile` override. Runs `node bin/sync-baseline-requirements.cjs`, displays results, and commits if requirements were added."

3. Rewrite `<process>` to this simplified flow:

**Step 1: Detect Intent**

If `--profile` in $ARGUMENTS, skip detection and jump to Step 3.

Otherwise, run auto-detection first (read-only, no sync yet):
```bash
node bin/detect-project-intent.cjs --root . --json > /tmp/detection.json
DETECTION=$(cat /tmp/detection.json)
```

Display signals table to user from `signals` array (dimension, confidence, evidence).
Display suggested profile: `Detected profile: <base_profile>`.

**Step 2: Confirm Intent**

If `needs_confirmation` array is non-empty, ask user:
```
AskUserQuestion([{
  header: "Confirm Project Intent",
  question: "Auto-detected base profile: <base_profile>. Is this correct?",
  multiSelect: false,
  options: [
    { label: "Accept", description: "Use auto-detected intent as-is" },
    { label: "Customize", description: "Choose a different profile" },
    { label: "Cancel", description: "Skip baseline sync" }
  ]
}])
```

If "Customize", ask for profile selection (same AskUserQuestion as current Step 1c profile picker), then use `--profile` in Step 3.
If "Cancel", exit.
If "Accept", proceed to Step 3 with no flags (auto-detect default).

If `needs_confirmation` is empty (all high confidence), proceed directly to Step 3 without asking.

**Step 3: Run Sync**

```bash
# If --profile was given or chosen via customize:
node bin/sync-baseline-requirements.cjs --profile "$PROFILE" --json

# Otherwise (auto-detect default):
node bin/sync-baseline-requirements.cjs --json
```

Parse JSON output. Display human-readable summary:
```
Baseline sync complete (<mode>)
  Added:   N new requirements
  Skipped: M (already present)
  Total:   K requirements
```

If added > 0, list each: `+ [ID] text`

**Step 4: Store Intent (if auto-detected)** -- same as current Step 3.

**Step 5: Commit if Needed** -- same as current Step 4.

If `added.length === 0`: display "No new requirements to sync -- .formal/requirements.json is up to date."
  </action>
  <verify>
    node bin/sync-baseline-requirements.cjs --json 2>&amp;1 | head -5
    # Should auto-detect and run without error (no "Usage:" message)
    node bin/sync-baseline-requirements.cjs --profile cli --json 2>&amp;1 | head -5
    # Should still work with explicit profile
  </verify>
  <done>
    - CLI auto-detects when no flags given (no error, no usage message)
    - --profile override still works
    - --intent-file override still works
    - --detect is silently accepted (backwards compat, no-op)
    - Skill definition simplified to auto-detect-first flow with confirmation only when needed
  </done>
</task>

<task type="auto">
  <name>Task 2: Update tests for default auto-detect behavior</name>
  <files>
    bin/sync-baseline-requirements.test.cjs
  </files>
  <action>
Add tests to `bin/sync-baseline-requirements.test.cjs` that verify the new default auto-detect behavior via CLI invocation. Use Node's `child_process.execFileSync` (NOT exec -- execFileSync is the safe alternative that avoids shell injection).

Add `const { execFileSync } = require('child_process');` after the existing requires at the top.

Add a new `describe('CLI auto-detect default')` block after the existing describe block, with these tests:

**Test 19: "CLI with no flags auto-detects and exits 0"**
- Create temp project with `createTempProject([])`
- Write a `package.json` with `{ "bin": { "test": "test.js" } }` in tmpDir (so detect-project-intent finds CLI profile)
- Run: `execFileSync('node', [scriptPath, '--json'], { cwd: tmpDir, encoding: 'utf8' })`
  where `scriptPath = path.join(__dirname, 'sync-baseline-requirements.cjs')`
- Parse output as JSON
- Assert `result.added` is an array with length > 0
- Assert `result.detection` exists (auto-detect metadata included)
- Assert `result.detection.suggested.base_profile === 'cli'`

**Test 20: "CLI --profile override bypasses auto-detect"**
- Create temp project with `createTempProject([])`
- Run with `--profile cli --json`
- Assert output parses as JSON with `added` array
- Assert `result.detection` is undefined (no detection metadata when profile explicit)

**Test 21: "CLI --detect flag accepted silently for backwards compat"**
- Create temp project with `createTempProject([])`
- Write package.json with bin field
- Run with `--detect --json`
- Assert exits 0 (no throw from execFileSync)
- Assert output parses as JSON with `added` array

Each test uses its own `tmpDir` cleaned up in `afterEach`. Use `path.join(__dirname, 'sync-baseline-requirements.cjs')` for the absolute script path since the test file is in `bin/`.
  </action>
  <verify>
    cd /Users/jonathanborduas/code/QGSD && node --test bin/sync-baseline-requirements.test.cjs
  </verify>
  <done>
    - All 18 existing tests still pass unchanged
    - 3 new CLI auto-detect tests (19-21) pass
    - Test 19 confirms no-flag invocation auto-detects and returns detection metadata
    - Test 20 confirms --profile bypasses auto-detect (no detection field)
    - Test 21 confirms --detect flag is silently accepted
  </done>
</task>

</tasks>

<verification>
- `node bin/sync-baseline-requirements.cjs --json` exits 0 with auto-detected output
- `node bin/sync-baseline-requirements.cjs --profile cli --json` still works
- `node --test bin/sync-baseline-requirements.test.cjs` -- all 21 tests pass
- `grep -c '\-\-detect' commands/qgsd/sync-baselines.md` returns 0 (flag removed from skill argument-hint)
</verification>

<success_criteria>
- Auto-detect is the default when no flags provided (exits 0, produces valid output)
- --profile and --intent-file still work as explicit overrides
- --detect is silently accepted (backwards compat, no error)
- Skill definition uses auto-detect-first UX with confirmation only when changes exist
- All 21 tests pass (18 existing + 3 new)
</success_criteria>

<output>
After completion, create `.planning/quick/162-make-sync-baselines-always-use-detect-mo/162-SUMMARY.md`
</output>
