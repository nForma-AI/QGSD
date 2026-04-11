---
phase: quick-390
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/coderlm-lifecycle.cjs
autonomous: true
formal_artifacts: none
requirements:
  - INST-11

must_haves:
  truths:
    - "ensureBinary() clones https://github.com/JaredStewart/coderlm.git to a temp dir and runs cargo build --release in server/ subdir"
    - "server/target/release/coderlm-server is copied to _binaryPath and chmod +x'd"
    - "Temp clone directory is removed after build (success or failure)"
    - "Print 'Building coderlm from source (requires Rust)...' before clone starts"
    - "Returns {ok:false, error:'build-failed', detail: stderr} if git or cargo is missing or build fails"
    - "Build timeout is 300000ms (5 min)"
    - "If binary already exists (cached), returns {ok:true, source:'cached'} unchanged"
  artifacts:
    - path: "bin/coderlm-lifecycle.cjs"
      provides: "Updated ensureBinary() with git clone + cargo build approach"
      contains: "cargo build --release"
---

<objective>
Replace the gh release download block in ensureBinary() with a git clone + cargo build --release approach, since JaredStewart/coderlm has no pre-built GitHub Releases.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Replace gh release download with git clone + cargo build in ensureBinary()</name>
  <files>bin/coderlm-lifecycle.cjs</files>
  <action>
Replace lines 151-178 (from "// Determine platform binary name" through the closing brace of the download block and its return statement) with the following build-from-source block:

```javascript
    // Ensure binary directory exists
    fs.mkdirSync(_binaryDir, { recursive: true });

    // Build from source via git clone + cargo build
    process.stderr.write('Building coderlm from source (requires Rust)...\n');

    const tmpDir = path.join(os.tmpdir(), 'coderlm-build-' + Date.now());
    try {
      // Step 1: git clone
      const cloneResult = spawnSync('git', [
        'clone', '--depth', '1',
        'https://github.com/JaredStewart/coderlm.git',
        tmpDir,
      ], { timeout: 60000, encoding: 'utf8' });

      if (cloneResult.status !== 0 || cloneResult.error) {
        const detail = (cloneResult.stderr || (cloneResult.error && cloneResult.error.message) || '').trim().slice(0, 200);
        return { ok: false, error: 'build-failed', detail: detail || 'git clone failed' };
      }

      // Step 2: cargo build --release in server/ subdir
      const buildResult = spawnSync('cargo', ['build', '--release'], {
        cwd: path.join(tmpDir, 'server'),
        timeout: 300000,
        encoding: 'utf8',
      });

      if (buildResult.status !== 0 || buildResult.error) {
        const detail = (buildResult.stderr || (buildResult.error && buildResult.error.message) || '').trim().slice(0, 200);
        return { ok: false, error: 'build-failed', detail: detail || 'cargo build failed' };
      }

      // Step 3: copy binary
      const builtBinary = path.join(tmpDir, 'server', 'target', 'release', 'coderlm-server');
      fs.copyFileSync(builtBinary, _binaryPath);
      fs.chmodSync(_binaryPath, 0o755);

      return { ok: true, path: _binaryPath, source: 'built' };
    } finally {
      // Step 4: cleanup temp clone (fail-open)
      try { spawnSync('rm', ['-rf', tmpDir], { timeout: 10000 }); } catch (_) {}
    }
```

Also remove the `const binaryName = getPlatformBinaryName();` and its null-check block (lines 152-155) since we no longer need platform-specific binary names — we build from source on the current platform.

If `getPlatformBinaryName` is no longer used anywhere after this change, it can remain but is effectively dead code — do NOT remove it to minimize diff.
  </action>
  <verify>
    1. `grep -n 'cargo build' bin/coderlm-lifecycle.cjs` returns a match.
    2. `grep -n 'gh release download' bin/coderlm-lifecycle.cjs` returns no match.
    3. `node -e "const l = require('./bin/coderlm-lifecycle.cjs'); console.log(typeof l.ensureBinary)"` prints "function".
    4. `node --test bin/coderlm-lifecycle.test.cjs` passes (existing tests).
  </verify>
</task>

</tasks>
