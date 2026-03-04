---
phase: quick-164
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install-formal-tools.cjs
  - bin/run-uppaal.cjs
autonomous: true
requirements: [UPPAAL-01, UPPAAL-02, UPPAAL-03]

must_haves:
  truths:
    - "Running `node bin/install-formal-tools.cjs` downloads and extracts verifyta when missing"
    - "verifyta binary is placed at .formal/uppaal/bin/verifyta and is executable"
    - "run-uppaal.cjs finds the locally installed verifyta without VERIFYTA_BIN env var"
    - "Idempotent — re-running skips download if verifyta already present"
  artifacts:
    - path: "bin/install-formal-tools.cjs"
      provides: "UPPAAL verifyta download and extraction"
      contains: "uppaal"
    - path: "bin/run-uppaal.cjs"
      provides: "Local verifyta discovery fallback"
      contains: ".formal/uppaal"
  key_links:
    - from: "bin/install-formal-tools.cjs"
      to: ".formal/uppaal/bin/verifyta"
      via: "download + unzip + chmod"
      pattern: "verifyta"
    - from: "bin/run-uppaal.cjs"
      to: ".formal/uppaal/bin/verifyta"
      via: "locateVerifyta fallback path"
      pattern: "formal.*uppaal.*bin.*verifyta"
---

<objective>
Add UPPAAL verifyta auto-installation to bin/install-formal-tools.cjs and update bin/run-uppaal.cjs to discover the locally installed binary.

Purpose: Close the uppaal:quorum-races INCONCLUSIVE gap in formal verification — currently verifyta is never found because there is no automated install path.
Output: verifyta downloaded to .formal/uppaal/bin/verifyta on `node bin/install.js --formal` or `node bin/install-formal-tools.cjs`, and run-uppaal.cjs discovers it automatically.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/install-formal-tools.cjs
@bin/run-uppaal.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add UPPAAL verifyta section to install-formal-tools.cjs</name>
  <files>bin/install-formal-tools.cjs</files>
  <action>
Add a new UPPAAL section between the PRISM section and the Petri nets section in install-formal-tools.cjs. Follow the exact pattern used by TLA+ and PRISM sections.

The section should:

1. Check if verifyta already exists at `.formal/uppaal/bin/verifyta` — if so, skip() with "UPPAAL verifyta already present".

2. If missing, download the platform-appropriate UPPAAL 5.0.0 zip:
   - macOS (darwin): `https://download.uppaal.org/uppaal-5.0/uppaal-5.0.0/UPPAAL-5.0.0-app.zip`
   - Linux (linux): `https://download.uppaal.org/uppaal-5.0/uppaal-5.0.0/uppaal-5.0.0-linux64.zip`
   - Windows (win32): `https://download.uppaal.org/uppaal-5.0/uppaal-5.0.0/uppaal-5.0.0-win64.zip`
   - Other platforms: fail() with manual download link.

3. Download to `os.tmpdir()/uppaal-<platform>.zip` using the existing `downloadFile()` helper.

4. Extract using `unzip -o <zipPath> -d <tmpDir>` via spawnSync. The archive extracts to a directory like `uppaal-5.0.0/` (Linux) or `UPPAAL-5.0.0.app/` (macOS).

5. Locate the verifyta binary inside the extracted directory:
   - Linux: `<extracted>/bin/verifyta` (or `bin-Linux/verifyta`)
   - macOS: look for `verifyta` recursively inside the extracted dir using a simple fs walk or `find` via spawnSync
   - Windows: `<extracted>/bin-Windows/verifyta.exe`

6. Copy the verifyta binary (and any sibling .so/.dylib files in the same bin directory) to `.formal/uppaal/bin/`.

7. `chmod +x` the verifyta binary (non-Windows).

8. Remove macOS quarantine — multi-step Gatekeeper handling:
   a. Run `xattr -dr com.apple.quarantine .formal/uppaal/bin/` (ignore errors, same pattern as PRISM).
   b. After xattr, attempt to verify the binary runs: `spawnSync(verifytaPath, ['--version'])`. If it exits with a non-zero status or a signal kill (Gatekeeper block), try `codesign --remove-signature <verifytaPath>` as a secondary fix (spawnSync, ignore errors).
   c. If verifyta is still blocked after both steps, include a helpful warning via info(): `"If macOS Gatekeeper blocks verifyta, run: sudo spctl --master-disable  (re-enable after with --master-enable)"`. Do NOT run spctl automatically — it requires sudo and changes system-wide security. The warning is advisory only.

9. ok() with "UPPAAL verifyta installed" and info() showing the path.

10. Push `{ name: 'UPPAAL', status: 'ok'|'skip'|'fail' }` to the results array.

11. Update the `nameWidth` constant from 8 to 8 (already sufficient for "UPPAAL").

Error handling: wrap in try/catch like PRISM — fail() with message and link to https://uppaal.org/downloads/, push fail status, never exit(1).

IMPORTANT: UPPAAL's license is academic — the download URLs are publicly accessible without auth. The zip files do NOT require login to download (verified from uppaal.org/downloads page).
  </action>
  <verify>
Run `node bin/install-formal-tools.cjs` and confirm:
- UPPAAL section appears in output (either "installed" or "skipped")
- `.formal/uppaal/bin/verifyta` exists and is executable
- Running again shows "skipped" (idempotent)
- Results summary table includes UPPAAL row
  </verify>
  <done>
UPPAAL verifyta is downloaded and placed at .formal/uppaal/bin/verifyta by install-formal-tools.cjs. Idempotent — skips if already present. Non-blocking — failure prints warning but exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update run-uppaal.cjs to discover locally installed verifyta</name>
  <files>bin/run-uppaal.cjs</files>
  <action>
Update the `locateVerifyta()` function in bin/run-uppaal.cjs to add a fallback path check BETWEEN the VERIFYTA_BIN env var check and the `which verifyta` PATH check.

Current order:
1. Check VERIFYTA_BIN env var
2. Check PATH via `which verifyta`

New order:
1. Check VERIFYTA_BIN env var
2. Check local install at `path.join(__dirname, '..', '.formal', 'uppaal', 'bin', 'verifyta')` — if it exists, return it
3. Check PATH via `which verifyta`

This ensures that after running `node bin/install-formal-tools.cjs`, the run-uppaal.cjs script automatically finds verifyta without requiring VERIFYTA_BIN to be set.

Add a stderr log when using the local path: `TAG + ' Using local verifyta: ' + localPath`.
  </action>
  <verify>
Run `node bin/run-uppaal.cjs` and confirm it finds the locally installed verifyta (no longer reports "inconclusive: verifyta not installed"). Check that the stderr output shows "Using local verifyta: ..." with the correct path.
  </verify>
  <done>
run-uppaal.cjs discovers .formal/uppaal/bin/verifyta automatically. The uppaal:quorum-races check no longer reports INCONCLUSIVE due to missing verifyta.
  </done>
</task>

</tasks>

<verification>
1. `node bin/install-formal-tools.cjs` — UPPAAL row shows in results table
2. `ls -la .formal/uppaal/bin/verifyta` — file exists and is executable
3. `node bin/run-uppaal.cjs` — does NOT report "verifyta not installed" (may still fail if model has issues, but not due to missing binary)
4. `node bin/install-formal-tools.cjs` again — UPPAAL shows "skipped" (idempotent)
</verification>

<success_criteria>
- verifyta binary auto-installed to .formal/uppaal/bin/verifyta
- run-uppaal.cjs discovers it without VERIFYTA_BIN env var
- uppaal:quorum-races INCONCLUSIVE gap closed (no longer "verifyta not installed")
- Idempotent and non-blocking (exits 0 on failure)
</success_criteria>

<output>
After completion, create `.planning/quick/164-add-uppaal-verifyta-installation-to-bin-/164-SUMMARY.md`
</output>
