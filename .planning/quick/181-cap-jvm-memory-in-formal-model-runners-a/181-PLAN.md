---
phase: quick-181
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/run-tlc.cjs
  - bin/run-oscillation-tlc.cjs
  - bin/run-breaker-tlc.cjs
  - bin/run-protocol-tlc.cjs
  - bin/run-stop-hook-tlc.cjs
  - bin/run-account-manager-tlc.cjs
  - bin/run-phase-tlc.cjs
  - bin/run-sensitivity-sweep.cjs
  - bin/run-alloy.cjs
  - bin/run-audit-alloy.cjs
  - bin/run-installer-alloy.cjs
  - bin/run-account-pool-alloy.cjs
  - bin/run-quorum-composition-alloy.cjs
  - bin/run-transcript-alloy.cjs
  - bin/run-formal-verify.cjs
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "Every JVM spawn for TLC and Alloy includes -Xms64m and -Xmx heap cap"
    - "Each runner logs effective heap cap to stderr before spawning"
    - "Formal verification orchestrator runs tool groups sequentially by default"
    - "Concurrent mode is available via --concurrent flag"
    - "Heap cap is configurable via QGSD_JAVA_HEAP_MAX env var"
    - "All existing formal checks still pass with capped memory"
  artifacts:
    - path: "bin/run-tlc.cjs"
      provides: "TLC runner with -Xms/-Xmx flags and heap log"
      contains: "Xmx.*Xms64m.*\\[heap\\]"
    - path: "bin/run-alloy.cjs"
      provides: "Alloy runner with -Xms/-Xmx flags and heap log"
      contains: "Xmx.*Xms64m.*\\[heap\\]"
    - path: "bin/run-formal-verify.cjs"
      provides: "Sequential-by-default orchestrator"
      contains: "sequential"
  key_links:
    - from: "bin/run-formal-verify.cjs"
      to: "all TLC/Alloy runners"
      via: "spawnSync in runGroup"
      pattern: "sequential.*concurrent|--concurrent"
    - from: "bin/run-tlc.cjs"
      to: "JVM"
      via: "spawnSync args array"
      pattern: "-Xmx"
---

<objective>
Cap JVM heap memory in all formal model runners and make the orchestrator run tool groups sequentially by default to prevent RAM exhaustion when 5+ JVMs launch concurrently.

Purpose: The formal verification suite spawns up to 14 JVM processes across 5 tool groups. Without -Xmx caps, each JVM claims ~25% of physical RAM (Java default). Running groups concurrently via Promise.all means 5+ JVMs competing for 125%+ RAM, causing swap thrashing or OOM kills.

Output: All JVM spawns capped at 512MB (configurable), orchestrator defaults to sequential execution with --concurrent opt-in.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/run-formal-verify.cjs
@bin/run-tlc.cjs
@bin/run-alloy.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add -Xmx heap cap to all 14 JVM-spawning runners</name>
  <files>
    bin/run-tlc.cjs
    bin/run-oscillation-tlc.cjs
    bin/run-breaker-tlc.cjs
    bin/run-protocol-tlc.cjs
    bin/run-stop-hook-tlc.cjs
    bin/run-account-manager-tlc.cjs
    bin/run-phase-tlc.cjs
    bin/run-sensitivity-sweep.cjs
    bin/run-alloy.cjs
    bin/run-audit-alloy.cjs
    bin/run-installer-alloy.cjs
    bin/run-account-pool-alloy.cjs
    bin/run-quorum-composition-alloy.cjs
    bin/run-transcript-alloy.cjs
  </files>
  <action>
    Add a configurable heap cap constant near the top of each file:
    ```
    const JAVA_HEAP_MAX = process.env.QGSD_JAVA_HEAP_MAX || '512m';
    ```

    Then inject `-Xms64m` and `-Xmx${JAVA_HEAP_MAX}` into the spawnSync args array for each file's -jar invocation. Both flags must appear BEFORE `-jar` in the args array. The `-Xms64m` prevents JVMs from eagerly reserving the full 512MB on startup, reducing peak RSS when sequential runs overlap during cleanup/startup transitions.

    Also add a log line immediately before each spawnSync call that prints the effective heap cap:
    ```
    process.stderr.write('[heap] Xms=64m Xmx=' + JAVA_HEAP_MAX + '\n');
    ```
    This gives operators observability to confirm the setting is active without grepping source.

    **TLC runners** (7 files) — pattern: `spawnSync(javaExe, ['-jar', jarPath, ...])` or `spawnSync(javaExe, ['-XX:+UseParallelGC', '-jar', ...])`
    - `run-tlc.cjs` line 359: insert `-Xms64m`, `-Xmx${JAVA_HEAP_MAX}` before `-jar`
    - `run-oscillation-tlc.cjs` line 147: insert before `-jar`
    - `run-breaker-tlc.cjs` line 130: insert before `-jar`
    - `run-protocol-tlc.cjs` line 146: insert before `-jar`
    - `run-stop-hook-tlc.cjs` line 132: insert after `-XX:+UseParallelGC` but before `-jar`
    - `run-account-manager-tlc.cjs` line 137: insert before `-jar`
    - `run-phase-tlc.cjs` line 83: insert after `-XX:+UseParallelGC` but before `-jar`

    **Sensitivity sweep** (1 file) — uses `spawnSync('java', [...])` not `javaExe`:
    - `run-sensitivity-sweep.cjs` line 70: insert `-Xms64m`, `-Xmx${JAVA_HEAP_MAX}` before `-jar`

    **Alloy runners** (6 files) — pattern: `spawnSync(javaExe, ['-Djava.awt.headless=true', '-jar', jarPath, ...])`:
    - `run-alloy.cjs` line 105: insert `-Xms64m`, `-Xmx${JAVA_HEAP_MAX}` after `-Djava.awt.headless=true` but before `-jar`
    - `run-audit-alloy.cjs` line 140: same position
    - `run-installer-alloy.cjs` line 140: same position
    - `run-account-pool-alloy.cjs` line 110: same position
    - `run-quorum-composition-alloy.cjs` line 107: same position
    - `run-transcript-alloy.cjs` line 126: same position

    Do NOT modify version-check calls (`spawnSync(javaExe, ['--version']...)`) — those do not launch JVMs.
    Do NOT modify PRISM (`run-prism.cjs`, `run-oauth-rotation-prism.cjs`) or UPPAAL (`run-uppaal.cjs`) — they use native binaries, not Java -jar.
  </action>
  <verify>
    Run: `grep -rn 'Xmx' bin/run-*.cjs | wc -l` — expect 14 lines (one per runner file).
    Run: `grep -rn 'Xms64m' bin/run-*.cjs | wc -l` — expect 14 lines (one per runner file).
    Run: `grep -rn 'QGSD_JAVA_HEAP_MAX' bin/run-*.cjs | wc -l` — expect 14 lines.
    Run: `grep -rn '\[heap\]' bin/run-*.cjs | wc -l` — expect 14 lines (log line in each runner).
    Spot-check: `grep -A2 'Xmx' bin/run-tlc.cjs` shows flag before `-jar`.
    Spot-check: `grep -A2 'Xmx' bin/run-alloy.cjs` shows flag after `-Djava.awt.headless=true` and before `-jar`.
    Regression lock: `grep -B5 'spawnSync.*jar' bin/run-tlc.cjs | grep -q 'Xmx'` — exits 0, confirming -Xmx is in spawn args (prevents future removal).
  </verify>
  <done>All 14 JVM-spawning runner files contain -Xms64m and -Xmx${JAVA_HEAP_MAX} in their -jar spawnSync call, defaulting to 512m, configurable via QGSD_JAVA_HEAP_MAX env var. Each runner logs the effective heap cap to stderr before spawning.</done>
</task>

<task type="auto">
  <name>Task 2: Make run-formal-verify.cjs sequential by default with --concurrent opt-in</name>
  <files>bin/run-formal-verify.cjs</files>
  <action>
    In `bin/run-formal-verify.cjs`:

    1. Near the CLI filter section (around line 410), add parsing for the new flag:
    ```
    const concurrent = argv.includes('--concurrent') || process.env.QGSD_FORMAL_CONCURRENT === '1';
    ```

    2. Update the Phase 2 block (lines 569-577) to check this flag:
    ```
    if (toolSteps.length > 0) {
      const toolGroupNames = [...new Set(toolSteps.map(s => s.tool))];
      if (concurrent) {
        process.stdout.write(TAG + ' Phase 2: Running tool groups concurrently: ' + toolGroupNames.join(', ') + '\n\n');
        await Promise.all(
          toolGroupNames.map(tool => runGroup(toolSteps.filter(s => s.tool === tool)))
        );
      } else {
        process.stdout.write(TAG + ' Phase 2: Running tool groups sequentially: ' + toolGroupNames.join(', ') + '\n\n');
        for (const tool of toolGroupNames) {
          await runGroup(toolSteps.filter(s => s.tool === tool));
        }
      }
    }
    ```

    3. Update the usage comment at the top of the file to document:
    ```
    //   node bin/run-formal-verify.cjs --concurrent       # run tool groups in parallel (old behavior)
    //   QGSD_FORMAL_CONCURRENT=1 node bin/run-formal-verify.cjs  # same via env var
    ```

    4. If there is a --help or tip output section, add mention of `--concurrent`.

    Default behavior changes from concurrent to sequential. This caps peak JVM count from 5+ down to 1.
  </action>
  <verify>
    Run: `grep -n 'concurrent' bin/run-formal-verify.cjs` — shows flag parsing, conditional branch, and usage comment.
    Run: `node bin/run-formal-verify.cjs --only=generate 2>&1 | head -5` — still works (generate steps are already sequential, validates no parse errors).
  </verify>
  <done>run-formal-verify.cjs defaults to sequential tool group execution. --concurrent flag or QGSD_FORMAL_CONCURRENT=1 env var restores old parallel behavior. Peak JVM count capped at 1 by default.</done>
</task>

<task type="auto">
  <name>Task 3: Run full formal verification to validate capped runners</name>
  <files></files>
  <action>
    Run the full formal verification suite with memory caps active to confirm nothing breaks:

    1. Run: `node bin/run-formal-verify.cjs 2>&1 | tail -30` (sequential mode, default)
       - Confirm all checks pass (or at least the same set that passed before)
       - Confirm output shows "Running tool groups sequentially" not "concurrently"

    2. If any check fails that was previously passing, investigate whether the 512MB cap is too low for that specific model. If so, consider bumping the default to 768m or 1g. The bounded state spaces used in this project should fit well within 512m.

    3. If tests exist for runners: `npm test -- --grep "tlc\|alloy" 2>&1 | tail -20` — confirm they still pass.

    No file modifications expected unless a default needs adjusting.
  </action>
  <verify>
    Formal verify output shows "sequentially" in Phase 2 header.
    Pass rate is equal to or better than before the change (same checks pass).
  </verify>
  <done>Full formal verification suite passes with 512MB heap caps and sequential execution. No regressions introduced.</done>
</task>

</tasks>

<verification>
1. `grep -rn 'Xmx' bin/run-*.cjs | wc -l` returns 14
2. `grep -rn 'Xms64m' bin/run-*.cjs | wc -l` returns 14
3. `grep -rn '\[heap\]' bin/run-*.cjs | wc -l` returns 14
4. `grep -n 'sequential' bin/run-formal-verify.cjs` shows the default path
5. `node bin/run-formal-verify.cjs --only=generate` completes without errors
6. Full verification suite passes with sequential default
7. `grep -B5 'spawnSync.*jar' bin/run-tlc.cjs | grep -q 'Xmx'` exits 0 (regression lock)
</verification>

<success_criteria>
- All 14 JVM-spawning runners have -Xms64m and -Xmx512m (configurable) before -jar
- Each runner logs effective heap cap value to stderr for operator observability
- run-formal-verify.cjs defaults to sequential tool group execution
- --concurrent flag restores old parallel behavior
- Full formal verification suite passes without regressions
</success_criteria>

<output>
After completion, create `.planning/quick/181-cap-jvm-memory-in-formal-model-runners-a/181-SUMMARY.md`
</output>
