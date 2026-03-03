---
phase: quick-135
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ..formal/ (renamed from .formal/)
  - .gitignore
  - bin/*.cjs (76 files)
  - test/*.test.cjs (2 files)
  - ..formal/requirements.json
  - ..formal/model-registry.json
  - ..formal/traceability-matrix.json
  - ..formal/trace/trace.schema.json
  - qgsd-core/workflows/*.md (6 files)
  - commands/qgsd/*.md (3 files)
  - README.md
  - VERIFICATION_TOOLS.md
  - .planning/**/*.md (~383 files, historical references)
autonomous: true
formal_artifacts: none

must_haves:
  truths:
    - ".formal/ directory no longer exists; ..formal/ exists with identical contents"
    - "All JS/CJS files reference ..formal/ (or '.formal') instead of .formal/ (or 'formal')"
    - "All JSON data files use ..formal/ paths in values and keys"
    - ".gitignore ignores ..formal/ paths (not .formal/ paths)"
    - "npm test passes with zero failures"
    - "Workflow and command markdown files reference ..formal/ not .formal/"
  artifacts:
    - path: "..formal/"
      provides: "Renamed formal verification directory (hidden)"
    - path: ".gitignore"
      provides: "Updated ignore rules for ..formal/ paths"
  key_links:
    - from: "bin/requirements-core.cjs"
      to: "..formal/requirements.json"
      via: "path.join with '.formal' segment"
      pattern: "'\\.formal'"
    - from: "bin/run-tlc.cjs"
      to: "..formal/tla/"
      via: "path.join with '.formal' segment"
      pattern: "'\\.formal'"
    - from: "..formal/model-registry.json"
      to: "..formal/alloy/*.als, ..formal/tla/*.tla, ..formal/prism/*.pm"
      via: "JSON model_file values"
      pattern: "\\..formal/"
---

<objective>
Rename `.formal/` to `..formal/` (hidden directory) and update all references across the entire codebase.

Purpose: Align the formal verification directory with the project convention of using hidden directories (like `.planning/`) for infrastructure directories.
Output: Working codebase with `..formal/` as the formal verification root, all tests passing.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Git-rename .formal/ to ..formal/ and bulk-replace all references</name>
  <files>
    .formal/ -> ..formal/ (git mv)
    .gitignore
    bin/*.cjs, bin/*.js (76 files)
    test/*.test.cjs (2 files)
    ..formal/requirements.json
    ..formal/model-registry.json
    ..formal/traceability-matrix.json
    ..formal/trace/trace.schema.json
    qgsd-core/workflows/*.md (6 files)
    commands/qgsd/*.md (3 files)
    README.md
    VERIFICATION_TOOLS.md
  </files>
  <action>
    Execute the rename and replacements in this exact order:

    **Step 1 -- Git rename the directory:**
    ```bash
    git mv .formal/ ..formal/
    ```
    This atomically renames in git history. All files inside keep their content unchanged.

    **Step 2 -- Replace `'formal'` single-quoted path segments in JS/CJS files:**
    This handles `path.join(__dirname, '..', 'formal', 'tla', ...)` patterns and
    `path.basename(current) === 'formal'` comparisons (81 files, ~207 occurrences).
    ```bash
    find bin/ test/ -type f \( -name '*.cjs' -o -name '*.js' \) -exec grep -l "'formal'" {} \; | xargs sed -i '' "s|'formal'|'.formal'|g"
    ```

    **Step 3 -- Replace `.formal/` slash-path references in JS/CJS files:**
    This handles string literals like `'.formal/requirements.json'`, comments like
    `// .formal/spec/...`, and template literals (76 files, ~343 occurrences).
    ```bash
    find bin/ test/ -type f \( -name '*.cjs' -o -name '*.js' \) -exec grep -l '.formal/' {} \; | xargs sed -i '' 's|.formal/|..formal/|g'
    ```
    NOTE: This is safe to run AFTER step 2 because `'formal'` (no slash) and `.formal/`
    (with slash) are non-overlapping patterns. Also safe because `..formal/` does NOT
    match the pattern `.formal/` (the dot prefix prevents re-matching).

    **Step 4 -- Replace `.formal/` in JSON data files inside ..formal/:**
    These files have paths like `".formal/alloy/account-pool-structure.als"` in keys/values
    (requirements.json ~70 refs, model-registry.json ~24 refs, traceability-matrix.json ~298 refs,
    trace.schema.json).
    ```bash
    sed -i '' 's|.formal/|..formal/|g' ..formal/requirements.json ..formal/model-registry.json ..formal/traceability-matrix.json ..formal/trace/trace.schema.json
    ```

    **Step 5 -- Update .gitignore:**
    Replace all `.formal/` path references with `..formal/` equivalents.
    ```bash
    sed -i '' 's|.formal/|..formal/|g' .gitignore
    ```

    **Step 6 -- Update workflow and command markdown files (IN-REPO sources):**
    These are the qgsd-core/ and commands/ sources that get installed. Update them.
    ```bash
    find qgsd-core/ commands/ -name '*.md' -exec grep -l '.formal/' {} \; | xargs sed -i '' 's|.formal/|..formal/|g'
    ```

    **Step 7 -- Update README.md and VERIFICATION_TOOLS.md:**
    ```bash
    sed -i '' 's|.formal/|..formal/|g' README.md VERIFICATION_TOOLS.md
    ```

    **Step 8 -- Update .planning/ markdown references:**
    Historical planning docs reference `.formal/` paths. Update them for consistency.
    ```bash
    find .planning/ -name '*.md' -exec grep -l '.formal/' {} \; | xargs sed -i '' 's|.formal/|..formal/|g'
    ```

    **IMPORTANT -- Do NOT modify:**
    - `~/.claude/qgsd/workflows/` (installed user config, outside repo)
    - Any file names containing "formal" (e.g., `run-formal-verify.cjs` stays as-is)
    - The word "formal" when used as an adjective (e.g., "formal verification") -- the sed
      patterns only match `.formal/` with a trailing slash or `'formal'` as a complete
      single-quoted string, so adjective uses are naturally preserved
  </action>
  <verify>
    ```bash
    # 1. Confirm .formal/ no longer exists and ..formal/ does
    test ! -d .formal/ && test -d ..formal/ && echo "PASS: directory renamed"

    # 2. Confirm no JS/CJS files still reference old paths
    # (allows 'formal' as substring in words like "formal verification" but NOT as path)
    grep -rn "'formal'" bin/ test/ --include='*.cjs' --include='*.js' | grep -v 'formal ' | grep -v 'formally' && echo "FAIL: stale 'formal' path segments" || echo "PASS: no stale single-quote refs"

    # 3. Confirm .gitignore uses ..formal/ not .formal/
    grep '^.formal/' .gitignore && echo "FAIL: gitignore still has .formal/" || echo "PASS: gitignore updated"

    # 4. Spot-check key files
    grep "'\\.formal'" bin/requirements-core.cjs && echo "PASS: requirements-core updated"
    grep "'\\.formal'" bin/run-tlc.cjs && echo "PASS: run-tlc updated"
    grep '..formal/' ..formal/model-registry.json | head -1 && echo "PASS: model-registry updated"
    ```
  </verify>
  <done>
    - `.formal/` directory does not exist; `..formal/` contains all prior contents
    - Zero JS/CJS files contain `'formal'` as a path segment (all now `'.formal'`)
    - Zero JS/CJS files contain `.formal/` as a path string (all now `..formal/`)
    - JSON data files inside `..formal/` use `..formal/` in path values
    - `.gitignore` rules reference `..formal/` paths
    - Workflow, command, and documentation markdown files use `..formal/`
    - `.planning/` historical references updated
  </done>
</task>

<task type="auto">
  <name>Task 2: Run full test suite and fix any breakage</name>
  <files>
    bin/*.cjs (any files needing fixes)
    test/*.test.cjs (any files needing fixes)
  </files>
  <action>
    Run the full test suite to verify the rename did not break anything:
    ```bash
    npm test
    ```

    If any tests fail:
    1. Read the failing test output carefully
    2. Identify whether the failure is a missed `formal` -> `.formal` replacement
    3. Apply targeted fixes to the specific files
    4. Re-run `npm test` until all tests pass

    Common failure patterns to watch for:
    - Test fixtures that create `.formal/` temp directories -- these should create `..formal/`
    - Assertion strings that check for `.formal/` in output -- update to `..formal/`
    - `path.join` calls missed by the bulk sed (e.g., multiline path.join spanning lines)
    - String concatenation patterns like `dir + '/.formal/' + ...`

    After tests pass, do a final sanity check:
    ```bash
    # Verify no runtime path construction still builds 'formal' (without dot)
    grep -rn "formal['\"]" bin/ test/ --include='*.cjs' --include='*.js' | grep -v '.formal' | grep -v 'formal ' | grep -v 'formal_' | grep -v 'formally' | grep -v '-formal' | grep -v 'quorum-formal' | grep -v 'run-formal' | grep -v 'verify-formal' | grep -v 'test-formal' | grep -v 'install-formal' | grep -v 'generate-formal' | grep -v 'roadmapper-formal' | grep -v 'execute-phase-formal'
    ```
    This should return no results. If it does, fix the remaining references.

    **Note on workflow files at `~/.claude/qgsd/workflows/`:** These are installed copies
    outside the repo. They still reference `.formal/`. Log this as a manual follow-up:
    the user should re-run `node bin/install.js` after this task if the installer copies
    workflow files, OR manually update them. Do NOT modify files outside the repo.
  </action>
  <verify>
    ```bash
    npm test 2>&1 | tail -5
    # Should show: all tests passing, zero failures
    ```
  </verify>
  <done>
    - `npm test` exits with code 0 (all tests pass)
    - No remaining stale `formal` path references in runtime code
    - Manual follow-up noted: user should update `~/.claude/qgsd/workflows/` references
      to `..formal/` (outside repo scope)
  </done>
</task>

</tasks>

<verification>
1. `test ! -d .formal/ && test -d ..formal/` -- directory renamed
2. `npm test` -- all tests pass
3. `grep -rn "'formal'" bin/ test/ --include='*.cjs' --include='*.js' | grep -v 'formal ' | wc -l` -- returns 0
4. `grep '^.formal/' .gitignore` -- returns nothing (all updated to ..formal/)
5. `git status` shows clean rename tracking
</verification>

<success_criteria>
- .formal/ directory fully replaced by ..formal/
- All 76+ JS/CJS source files updated (both `.formal/` paths and `'formal'` path segments)
- All 4 JSON data files inside ..formal/ updated
- .gitignore updated
- All workflow/command/doc markdown files in repo updated
- npm test passes with zero failures
- git tracks the change as a rename (not delete+add)
</success_criteria>

<output>
After completion, create `.planning/quick/135-rename-formal-to-formal-and-update-all-r/135-SUMMARY.md`
</output>
