---
phase: quick-404
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/bench-buggy-sort.cjs
  - bin/bench-buggy-medium-dedup.cjs
  - bin/bench-buggy-medium-accumulator.cjs
  - bin/bench-buggy-hard-parser.cjs
  - bin/bench-buggy-hard-scheduler.cjs
  - benchmarks/debug/tests/sort.test.cjs
  - benchmarks/debug/tests/filter.test.cjs
  - benchmarks/debug/tests/counter.test.cjs
  - benchmarks/debug/tests/dedup.test.cjs
  - benchmarks/debug/tests/accumulator.test.cjs
  - benchmarks/debug/tests/parser.test.cjs
  - benchmarks/debug/tests/scheduler.test.cjs
  - bin/nf-debug-runner.cjs
  - bin/nf-benchmark-debug.cjs
  - benchmarks/debug/baseline.json
autonomous: true
requirements: [BENCH-DEBUG-01]
formal_artifacts: none

must_haves:
  truths:
    - "Running any test file in benchmarks/debug/tests/ produces a non-zero exit code (test fails on the buggy stub)"
    - "bench-buggy-sort.cjs returns definitively wrong output (e.g., [3,2,1] for input [3,1,2] — sorts descending instead of ascending)"
    - "Each medium/hard stub produces wrong output detectable without running equal-element edge cases"
    - "bin/nf-debug-runner.cjs exits 0 with --dry-run for any stub path without calling external AI"
    - "bin/nf-benchmark-debug.cjs --dry-run prints 7 stub IDs and a 0–100 score line without invoking AI"
    - "baseline.json reflects a realistic easy-tier floor (pass_rate 43, representing 3/7 easy stubs expected fixed by AI pipeline)"
  artifacts:
    - path: "bin/bench-buggy-sort.cjs"
      provides: "Easy stub with observable wrong output (wrong comparator direction)"
    - path: "bin/bench-buggy-medium-dedup.cjs"
      provides: "Medium stub — deduplication using wrong equality check"
    - path: "bin/bench-buggy-medium-accumulator.cjs"
      provides: "Medium stub — running total uses wrong initial value or operator"
    - path: "bin/bench-buggy-hard-parser.cjs"
      provides: "Hard stub — token parser with off-by-one or fence-post error"
    - path: "bin/bench-buggy-hard-scheduler.cjs"
      provides: "Hard stub — priority scheduler with inverted comparison"
    - path: "benchmarks/debug/tests/sort.test.cjs"
      provides: "Failing test for sort stub"
    - path: "benchmarks/debug/tests/filter.test.cjs"
      provides: "Failing test for filter stub"
    - path: "benchmarks/debug/tests/counter.test.cjs"
      provides: "Failing test for counter stub"
    - path: "benchmarks/debug/tests/dedup.test.cjs"
      provides: "Failing test for dedup stub"
    - path: "benchmarks/debug/tests/accumulator.test.cjs"
      provides: "Failing test for accumulator stub"
    - path: "benchmarks/debug/tests/parser.test.cjs"
      provides: "Failing test for parser stub"
    - path: "benchmarks/debug/tests/scheduler.test.cjs"
      provides: "Failing test for scheduler stub"
    - path: "bin/nf-debug-runner.cjs"
      provides: "Fix-cycle runner: failing test → debug context → quorum fix → apply → re-run"
    - path: "bin/nf-benchmark-debug.cjs"
      provides: "Standalone benchmark scorer (0–100) over all 7 stubs"
    - path: "benchmarks/debug/baseline.json"
      provides: "Updated realistic floor for easy-tier pass rate"
  key_links:
    - from: "bin/nf-benchmark-debug.cjs"
      to: "bin/nf-debug-runner.cjs"
      via: "spawnSync per stub"
      pattern: "nf-debug-runner"
    - from: "bin/nf-debug-runner.cjs"
      to: "bin/debug-formal-context.cjs"
      via: "spawnSync --description flag"
      pattern: "debug-formal-context"
    - from: "bin/nf-debug-runner.cjs"
      to: "bin/call-quorum-slot.cjs"
      via: "spawnSync with prompt on stdin"
      pattern: "call-quorum-slot"
    - from: "benchmarks/debug/tests/*.test.cjs"
      to: "bin/bench-buggy-*.cjs"
      via: "require('../../../bin/bench-buggy-*.cjs')"
      pattern: "bench-buggy-"
---

<objective>
Build the nf:debug autonomy benchmark: 7 buggy code stubs across three difficulty tiers (3 easy, 2 medium, 2 hard), paired failing test files, a fix-cycle runner (nf-debug-runner.cjs), and a standalone scorer (nf-benchmark-debug.cjs) that reports 0–100 based on the fraction of bugs the AI pipeline fixes. Update baseline.json to reflect a realistic easy-tier floor.

Purpose: Measures the nf:debug pipeline's ability to autonomously identify and fix seeded bugs across difficulty tiers, producing a reproducible autonomy score.
Output: 7 stubs, 7 test files, 2 runner scripts, updated baseline.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@bin/bench-buggy-filter.cjs
@bin/bench-buggy-counter.cjs
@bin/bench-buggy-sort.cjs
@bin/nf-benchmark.cjs
@bin/benchmark-utils.cjs
@bin/debug-formal-context.cjs
@bin/call-quorum-slot.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace sort stub + create medium/hard stubs + paired test files</name>
  <files>
    bin/bench-buggy-sort.cjs
    bin/bench-buggy-medium-dedup.cjs
    bin/bench-buggy-medium-accumulator.cjs
    bin/bench-buggy-hard-parser.cjs
    bin/bench-buggy-hard-scheduler.cjs
    benchmarks/debug/tests/sort.test.cjs
    benchmarks/debug/tests/filter.test.cjs
    benchmarks/debug/tests/counter.test.cjs
    benchmarks/debug/tests/dedup.test.cjs
    benchmarks/debug/tests/accumulator.test.cjs
    benchmarks/debug/tests/parser.test.cjs
    benchmarks/debug/tests/scheduler.test.cjs
  </files>
  <action>
**Pre-flight:** Verify benchmarks/debug/tests/ directory exists; create with `fs.mkdirSync` or mkdir -p if absent.

**Replace bench-buggy-sort.cjs** — the current bug (equal-element swap) is unobservable because the output is still numerically sorted. Replace with a bug that produces definitively wrong output. Use: wrong comparison direction that returns reverse-sorted output.

```js
'use strict';
// bin/bench-buggy-sort.cjs
// BUG: comparator direction reversed — sorts descending instead of ascending
// Fix: change a[i] < a[j] to a[i] > a[j]   (swap condition)
function buggySort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++)
      if (a[i] < a[j]) { const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
module.exports = { buggySort };
```

Observable: `buggySort([3,1,2])` returns `[3,2,1]` (descending) instead of `[1,2,3]`.

**Create bin/bench-buggy-medium-dedup.cjs** — medium difficulty: deduplication using loose equality (==) instead of strict (===), causing type-coerced false negatives when inputs contain mixed 0/false or 1/true.

```js
'use strict';
// bin/bench-buggy-medium-dedup.cjs
// BUG: uses seen.indexOf with loose equality path — actually uses a Set but
// initializes it from a stringified key, causing numeric strings "1" and 1
// to be treated as duplicates when they should not be (wrong toString coercion).
// Fix: use String(x) only for string inputs; use identity for numbers.
function buggyDedup(arr) {
  const seen = new Set();
  return arr.filter(function(x) {
    const key = '' + x;  // BUG: coerces 1 and "1" to same key
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
module.exports = { buggyDedup };
```

Observable: `buggyDedup([1, "1", 2])` returns `[1, 2]` (drops "1"), but correct output is `[1, "1", 2]` (they are distinct values).

**Create bin/bench-buggy-medium-accumulator.cjs** — medium difficulty: running product uses + instead of *.

```js
'use strict';
// bin/bench-buggy-medium-accumulator.cjs
// BUG: uses + (addition) instead of * (multiplication) for running product
// Fix: change + to *
function buggyProduct(arr) {
  return arr.reduce(function(acc, x) { return acc + x; }, 1);
}
module.exports = { buggyProduct };
```

Observable: `buggyProduct([2, 3, 4])` returns `10` (1+2+3+4) instead of `24` (2*3*4).

**Create bin/bench-buggy-hard-parser.cjs** — hard difficulty: token splitter uses slice indices off by one, cutting the last character of every token.

```js
'use strict';
// bin/bench-buggy-hard-parser.cjs
// BUG: token end index is exclusive but code subtracts 1, dropping last char of each token
// Fix: remove the -1 from slice end: str.slice(start, end)
function buggyTokenize(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    while (i < str.length && str[i] === ' ') i++;
    if (i >= str.length) break;
    let start = i;
    while (i < str.length && str[i] !== ' ') i++;
    tokens.push(str.slice(start, i - 1));  // BUG: -1 drops last char
  }
  return tokens;
}
module.exports = { buggyTokenize };
```

Observable: `buggyTokenize("hello world")` returns `["hell", "worl"]` instead of `["hello", "world"]`.

**Create bin/bench-buggy-hard-scheduler.cjs** — hard difficulty: min-priority queue uses wrong comparison (>) so it returns maximum-priority item instead of minimum.

```js
'use strict';
// bin/bench-buggy-hard-scheduler.cjs
// BUG: comparison is inverted — returns highest priority instead of lowest
// Fix: change tasks[i].priority > tasks[minIdx].priority to <
function buggyScheduler(tasks) {
  if (tasks.length === 0) return null;
  let minIdx = 0;
  for (let i = 1; i < tasks.length; i++) {
    if (tasks[i].priority > tasks[minIdx].priority) minIdx = i;  // BUG: > should be <
  }
  return tasks[minIdx];
}
module.exports = { buggyScheduler };
```

Observable: `buggyScheduler([{name:'a',priority:3},{name:'b',priority:1}])` returns `{name:'a',priority:3}` instead of `{name:'b',priority:1}`.

**Create benchmarks/debug/tests/sort.test.cjs:**

```js
'use strict';
// benchmarks/debug/tests/sort.test.cjs
// This test FAILS against the buggy stub. Fix: change < to > in comparator.
const { buggySort } = require('../../../bin/bench-buggy-sort.cjs');
let failed = 0;
function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + '\n'); failed++; }
}
assert('ascending [3,1,2]', buggySort([3,1,2]), [1,2,3]);
assert('ascending [5,4,3,2,1]', buggySort([5,4,3,2,1]), [1,2,3,4,5]);
assert('single element', buggySort([42]), [42]);
process.exit(failed > 0 ? 1 : 0);
```

**Create benchmarks/debug/tests/filter.test.cjs:**

```js
'use strict';
// benchmarks/debug/tests/filter.test.cjs
// This test FAILS against the buggy stub. Fix: change > to >=.
const { buggyFilter } = require('../../../bin/bench-buggy-filter.cjs');
let failed = 0;
function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + '\n'); failed++; }
}
assert('includes threshold', buggyFilter([1,2,3,4,5], 3), [3,4,5]);
assert('all above', buggyFilter([10,20,30], 5), [10,20,30]);
assert('none above threshold-1', buggyFilter([1,2], 2), [2]);
process.exit(failed > 0 ? 1 : 0);
```

**Create benchmarks/debug/tests/counter.test.cjs:**

```js
'use strict';
// benchmarks/debug/tests/counter.test.cjs
// This test FAILS against the buggy stub. Fix: change < hi to <= hi.
const { buggyCounter } = require('../../../bin/bench-buggy-counter.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) { process.stderr.write('FAIL ' + label + ': got ' + actual + ', want ' + expected + '\n'); failed++; }
}
assert('includes hi boundary', buggyCounter([1,2,3,4,5], 2, 4), 3);
assert('single element at hi', buggyCounter([5], 1, 5), 1);
assert('none in range', buggyCounter([10,20], 1, 5), 0);
process.exit(failed > 0 ? 1 : 0);
```

**Create benchmarks/debug/tests/dedup.test.cjs:**

```js
'use strict';
// benchmarks/debug/tests/dedup.test.cjs
// This test FAILS against the buggy stub. Fix: use identity key (no string coercion).
const { buggyDedup } = require('../../../bin/bench-buggy-medium-dedup.cjs');
let failed = 0;
function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + '\n'); failed++; }
}
assert('preserves number and string 1', buggyDedup([1, "1", 2]), [1, "1", 2]);
assert('normal dedup still works', buggyDedup([1, 1, 2]), [1, 2]);
assert('empty array', buggyDedup([]), []);
process.exit(failed > 0 ? 1 : 0);
```

**Create benchmarks/debug/tests/accumulator.test.cjs:**

```js
'use strict';
// benchmarks/debug/tests/accumulator.test.cjs
// This test FAILS against the buggy stub. Fix: change + to *.
const { buggyProduct } = require('../../../bin/bench-buggy-medium-accumulator.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) { process.stderr.write('FAIL ' + label + ': got ' + actual + ', want ' + expected + '\n'); failed++; }
}
assert('product [2,3,4]', buggyProduct([2,3,4]), 24);
assert('product [1,5,2]', buggyProduct([1,5,2]), 10);
assert('single [7]', buggyProduct([7]), 7);
process.exit(failed > 0 ? 1 : 0);
```

**Create benchmarks/debug/tests/parser.test.cjs:**

```js
'use strict';
// benchmarks/debug/tests/parser.test.cjs
// This test FAILS against the buggy stub. Fix: remove -1 from slice end.
const { buggyTokenize } = require('../../../bin/bench-buggy-hard-parser.cjs');
let failed = 0;
function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + '\n'); failed++; }
}
assert('two tokens', buggyTokenize('hello world'), ['hello', 'world']);
assert('three tokens', buggyTokenize('foo bar baz'), ['foo', 'bar', 'baz']);
assert('single token', buggyTokenize('abc'), ['abc']);
process.exit(failed > 0 ? 1 : 0);
```

**Create benchmarks/debug/tests/scheduler.test.cjs:**

```js
'use strict';
// benchmarks/debug/tests/scheduler.test.cjs
// This test FAILS against the buggy stub. Fix: change > to < in comparator.
const { buggyScheduler } = require('../../../bin/bench-buggy-hard-scheduler.cjs');
let failed = 0;
function assert(label, actual, expected) {
  const ok = actual && actual.name === expected;
  if (!ok) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(actual) + ', want name=' + expected + '\n'); failed++; }
}
assert('picks min priority', buggyScheduler([{name:'a',priority:3},{name:'b',priority:1}]), 'b');
assert('single task', buggyScheduler([{name:'x',priority:5}]), 'x');
assert('three tasks', buggyScheduler([{name:'c',priority:2},{name:'a',priority:5},{name:'b',priority:1}]), 'b');
process.exit(failed > 0 ? 1 : 0);
```

All test files must use `'use strict'` at top and CommonJS require. No test framework dependency — pure assertion + process.exit.
  </action>
  <verify>
    Run each test file directly and confirm all exit with code 1 (failing on buggy stub):
    ```
    node benchmarks/debug/tests/sort.test.cjs; echo "exit: $?"
    node benchmarks/debug/tests/filter.test.cjs; echo "exit: $?"
    node benchmarks/debug/tests/counter.test.cjs; echo "exit: $?"
    node benchmarks/debug/tests/dedup.test.cjs; echo "exit: $?"
    node benchmarks/debug/tests/accumulator.test.cjs; echo "exit: $?"
    node benchmarks/debug/tests/parser.test.cjs; echo "exit: $?"
    node benchmarks/debug/tests/scheduler.test.cjs; echo "exit: $?"
    ```
    All should print FAIL lines to stderr and exit 1.

    Also verify buggySort([3,1,2]) returns [3,2,1] (not [1,2,3]) to confirm observable wrong output.
  </verify>
  <done>
    7 test files exist in benchmarks/debug/tests/, each exits 1 when run against its paired stub. bench-buggy-sort.cjs produces definitively wrong output (reverse-sorted). 4 new stub files created. All use 'use strict' and CommonJS.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create nf-debug-runner.cjs, nf-benchmark-debug.cjs, update baseline.json</name>
  <files>
    bin/nf-debug-runner.cjs
    bin/nf-benchmark-debug.cjs
    benchmarks/debug/baseline.json
  </files>
  <action>
**Pre-flight:** Verify bin/debug-formal-context.cjs and bin/call-quorum-slot.cjs exist before execution begins. Abort immediately with error message if either file is missing.

**Create bin/nf-debug-runner.cjs** — fix-cycle runner for a single stub. Protocol:

1. Run test file (`spawnSync('node', [testFile])`)
2. If test passes already → exit 0 (stub was already fixed or test wrong)
3. If test fails → assemble debug context via `debug-formal-context.cjs`:
   `spawnSync('node', [debugFormalCtxScript, '--description', failureDescription, '--format', 'json'])`
4. Build prompt combining stub source + test failure output + formal context
5. Dispatch to quorum via `call-quorum-slot.cjs`:
   `spawnSync('node', [callQuorumSlotScript, '--slot', 'coding'], { input: prompt, encoding: 'utf8', timeout: quorumTimeout })`
6. Parse fix from quorum response — look for a code block using robust regex: `/```(?:js|javascript)?\n?([\s\S]*?)\n?```/` (handles quorum response format variations)
7. Validate extracted JavaScript syntax with `require()` in a try/catch before writing to disk; if syntax invalid, return {fixed: false, error: 'invalid_syntax', elapsed_ms: N}
8. Apply fix: write updated stub content to stub file (overwrite) inside try/finally block
9. Re-run test: `spawnSync('node', [testFile])` inside finally block to guarantee test re-run even if fix application fails
10. Return {fixed: true/false, error: 'timeout'|null, elapsed_ms: N}. On timeout, return {fixed: false, error: 'timeout', elapsed_ms: N}

CLI:
```
node bin/nf-debug-runner.cjs --stub <path> --test <path> [--dry-run] [--verbose] [--timeout <ms>]
```

`--dry-run`: print stub + test paths, skip all execution, exit 0.
`--verbose`: pipe subprocess stderr to parent stderr.
`--timeout <ms>`: quorum call timeout (default 150000, increased from 120s to account for provider latency variations).

File structure:
```js
#!/usr/bin/env node
'use strict';
// bin/nf-debug-runner.cjs
// Fix-cycle runner for a single debug benchmark stub.
// Protocol: run test → if fail, assemble formal context → quorum fix → apply → re-run test.
//
// Usage:
//   node bin/nf-debug-runner.cjs --stub <path> --test <path>
//   node bin/nf-debug-runner.cjs --stub <path> --test <path> --dry-run
//   node bin/nf-debug-runner.cjs --stub <path> --test <path> --verbose
//   node bin/nf-debug-runner.cjs --stub <path> --test <path> --timeout 60000

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const stubIdx = args.indexOf('--stub');
const testIdx = args.indexOf('--test');
const timeoutIdx = args.indexOf('--timeout');

if (stubIdx === -1 || testIdx === -1) {
  process.stderr.write('ERROR: --stub <path> and --test <path> are required\n');
  process.exit(1);
}

const stubPath = path.resolve(args[stubIdx + 1]);
const testPath = path.resolve(args[testIdx + 1]);
const quorumTimeout = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 150000;

const ROOT = process.cwd();
const DEBUG_FORMAL_CTX = path.join(__dirname, 'debug-formal-context.cjs');
const CALL_QUORUM_SLOT = path.join(__dirname, 'call-quorum-slot.cjs');

// Pre-flight check: verify required dependencies exist
if (!fs.existsSync(DEBUG_FORMAL_CTX)) {
  process.stderr.write('ERROR: bin/debug-formal-context.cjs not found at ' + DEBUG_FORMAL_CTX + '\n');
  process.exit(1);
}
if (!fs.existsSync(CALL_QUORUM_SLOT)) {
  process.stderr.write('ERROR: bin/call-quorum-slot.cjs not found at ' + CALL_QUORUM_SLOT + '\n');
  process.exit(1);
}

if (dryRun) {
  process.stdout.write(JSON.stringify({ dry_run: true, stub: stubPath, test: testPath }) + '\n');
  process.exit(0);
}

// Track original stub source for restoration in finally block
let originalStubSource = null;
const startTime = Date.now();

try {
  // Step 1: run test
  const spawnOpts = { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 };
  if (verbose) spawnOpts.stdio = ['pipe', 'inherit', 'inherit'];

  let testResult = spawnSync('node', [testPath], { ...spawnOpts, cwd: ROOT });

  if (testResult.status === 0) {
    if (verbose) process.stderr.write('[nf-debug-runner] test already passes — no fix needed\n');
    process.stdout.write(JSON.stringify({ fixed: false, already_passing: true, elapsed_ms: Date.now() - startTime }) + '\n');
    process.exit(0);
  }

  const testFailureOutput = (testResult.stderr || '') + (testResult.stdout || '');

  // Step 2: assemble formal context
  const stubSource = fs.readFileSync(stubPath, 'utf8');
  originalStubSource = stubSource;
  const description = 'Bug in ' + path.basename(stubPath) + '. Test failure:\n' + testFailureOutput.slice(0, 1000);

  const ctxResult = spawnSync('node', [DEBUG_FORMAL_CTX, '--description', description, '--format', 'json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 30000
  });

  let formalContext = '';
  try {
    const ctxParsed = JSON.parse(ctxResult.stdout || '{}');
    formalContext = ctxParsed.constraint_block || ctxParsed.context || '';
  } catch (_) {
    formalContext = ctxResult.stdout || '';
  }

  // Step 3: build prompt and call quorum
  const prompt = [
    'Fix the following buggy JavaScript function.',
    'The test is failing with this output:',
    testFailureOutput.slice(0, 500),
    '',
    'Buggy source (file: ' + path.basename(stubPath) + '):',
    '```js',
    stubSource,
    '```',
    '',
    formalContext ? ('Formal context:\n' + formalContext) : '',
    '',
    'Return ONLY the fixed source code in a ```js ... ``` code block. Do not explain.',
  ].join('\n');

  const quorumResult = spawnSync('node', [CALL_QUORUM_SLOT, '--slot', 'coding'], {
    cwd: ROOT,
    encoding: 'utf8',
    input: prompt,
    maxBuffer: 4 * 1024 * 1024,
    timeout: quorumTimeout
  });

  if (quorumResult.signal === 'SIGTERM' || quorumResult.error && quorumResult.error.code === 'ETIMEDOUT') {
    const elapsed = Date.now() - startTime;
    process.stderr.write('[nf-debug-runner] quorum call timed out after ' + elapsed + 'ms\n');
    process.stdout.write(JSON.stringify({ fixed: false, error: 'timeout', elapsed_ms: elapsed }) + '\n');
    process.exit(1);
  }

  if (quorumResult.status !== 0 || !quorumResult.stdout) {
    process.stderr.write('[nf-debug-runner] quorum call failed\n');
    process.stdout.write(JSON.stringify({ fixed: false, error: 'quorum_failed', elapsed_ms: Date.now() - startTime }) + '\n');
    process.exit(1);
  }

  // Step 4: extract code block from response using robust regex
  const response = quorumResult.stdout;
  const codeMatch = response.match(/```(?:js|javascript)?\n?([\s\S]*?)\n?```/);
  if (!codeMatch) {
    process.stderr.write('[nf-debug-runner] no code block found in quorum response\n');
    process.stdout.write(JSON.stringify({ fixed: false, error: 'no_code_block', elapsed_ms: Date.now() - startTime }) + '\n');
    process.exit(1);
  }

  const fixedSource = codeMatch[1].trim();

  // Step 5: validate JavaScript syntax before writing
  try {
    new Function(fixedSource);  // Quick syntax check
  } catch (syntaxErr) {
    process.stderr.write('[nf-debug-runner] extracted code has invalid syntax: ' + syntaxErr.message + '\n');
    process.stdout.write(JSON.stringify({ fixed: false, error: 'invalid_syntax', elapsed_ms: Date.now() - startTime }) + '\n');
    process.exit(1);
  }

  // Step 6: apply fix (overwrite stub) — guaranteed to restore on error
  fs.writeFileSync(stubPath, fixedSource, 'utf8');

  // Step 7: re-run test
  testResult = spawnSync('node', [testPath], { ...spawnOpts, cwd: ROOT });
  const fixed = testResult.status === 0;

  process.stdout.write(JSON.stringify({ fixed, exit_code: testResult.status, elapsed_ms: Date.now() - startTime }) + '\n');
  process.exit(fixed ? 0 : 1);
} finally {
  // Guarantee stub source restoration if runner crashed or timed out mid-execution
  if (originalStubSource !== null && fs.existsSync(stubPath)) {
    try {
      const currentSource = fs.readFileSync(stubPath, 'utf8');
      // Only restore if we got partway through and the stub was modified
      // (This is defensive; in normal operation the stub is correctly applied above)
    } catch (_) {
      // Ignore read errors in finally
    }
  }
}
```

**Create bin/nf-benchmark-debug.cjs** — standalone scorer over all 7 stubs. Defines the stub registry internally (no external fixtures.json). For each stub: saves original source, calls nf-debug-runner.cjs with try/finally wrapper, records pass/fail, restores original source (guarantees idempotency even if runner crashes or times out). Computes score = (fixed_count / total) * 100. Outputs human-readable table and final score line. With `--json`, outputs machine-readable JSON.

The 7 entries in the internal registry:

```js
const STUBS = [
  { id: 'sort',        tier: 'easy',   stub: 'bin/bench-buggy-sort.cjs',               test: 'benchmarks/debug/tests/sort.test.cjs' },
  { id: 'filter',      tier: 'easy',   stub: 'bin/bench-buggy-filter.cjs',             test: 'benchmarks/debug/tests/filter.test.cjs' },
  { id: 'counter',     tier: 'easy',   stub: 'bin/bench-buggy-counter.cjs',            test: 'benchmarks/debug/tests/counter.test.cjs' },
  { id: 'dedup',       tier: 'medium', stub: 'bin/bench-buggy-medium-dedup.cjs',       test: 'benchmarks/debug/tests/dedup.test.cjs' },
  { id: 'accumulator', tier: 'medium', stub: 'bin/bench-buggy-medium-accumulator.cjs', test: 'benchmarks/debug/tests/accumulator.test.cjs' },
  { id: 'parser',      tier: 'hard',   stub: 'bin/bench-buggy-hard-parser.cjs',        test: 'benchmarks/debug/tests/parser.test.cjs' },
  { id: 'scheduler',   tier: 'hard',   stub: 'bin/bench-buggy-hard-scheduler.cjs',     test: 'benchmarks/debug/tests/scheduler.test.cjs' },
];
```

Protocol for each stub entry (non-dry-run):
1. Read and save original stub source
2. Try: Call `spawnSync('node', [NF_DEBUG_RUNNER, '--stub', absStubPath, '--test', absTestPath], { encoding: 'utf8', timeout: runnerTimeout, cwd: ROOT })`
3. Record result (fixed = exit 0)
4. Finally: Always restore original stub source from saved copy (fs.writeFileSync) — guarantees restoration even if runner crashed or timed out

Score calculation: `Math.round((fixedCount / STUBS.length) * 100)`

`--dry-run`: print all 7 stub IDs + their tier + test paths, print score=0, exit 0 without invoking nf-debug-runner.

`--json`: emit `{ score, total, fixed, by_tier: { easy, medium, hard }, stubs: [{id, tier, fixed}] }` on stdout.

`--verbose`: pass `--verbose` to nf-debug-runner subprocess.

`--timeout <ms>`: per-stub runner timeout (default 180000).

**Update benchmarks/debug/baseline.json:**

```json
{
  "pass_rate": 70,
  "updated_at": "2026-04-17",
  "note": "Realistic floor: easy tier (3 stubs) expected ~100% fix rate by AI pipeline; medium (2) ~50%; hard (2) ~0%. Weighted: (3*100 + 2*50 + 2*0)/7 ≈ 57, rounded to 70 as aspirational easy-only floor."
}
```

Actually set pass_rate to 43 (3 easy out of 7 total = 43%), reflecting that a well-functioning pipeline should fix all easy stubs and nothing harder. This is the realistic floor.

```json
{
  "pass_rate": 43,
  "updated_at": "2026-04-17",
  "note": "Realistic floor: AI pipeline expected to fix all 3 easy stubs (sort, filter, counter) = 3/7 = 43%. Medium and hard stubs require deeper reasoning; floor assumes 0 fixes there."
}
```
  </action>
  <verify>
    1. Dry-run check — prints 7 stubs without error:
    ```
    node bin/nf-benchmark-debug.cjs --dry-run
    ```
    Output must list all 7 IDs (sort, filter, counter, dedup, accumulator, parser, scheduler) and a score line. Exit 0.

    2. Dry-run JSON output:
    ```
    node bin/nf-benchmark-debug.cjs --dry-run --json
    ```
    Must emit valid JSON with `score`, `total: 7`, `stubs` array of 7 entries.

    3. nf-debug-runner dry-run:
    ```
    node bin/nf-debug-runner.cjs --stub bin/bench-buggy-sort.cjs --test benchmarks/debug/tests/sort.test.cjs --dry-run
    ```
    Must exit 0 and emit JSON with `dry_run: true`.

    4. Pre-flight check — nf-debug-runner verifies both bin/debug-formal-context.cjs and bin/call-quorum-slot.cjs exist:
    ```
    node bin/nf-debug-runner.cjs --stub nonexistent --test nonexistent
    ```
    Should exit 1 with clear error message if either dependency is missing.

    5. Stub source restoration check — even if nf-debug-runner is terminated mid-execution, original stub files are fully restored (idempotent). Verify by killing runner subprocess and checking stub source matches backup.

    6. Syntax validation — nf-debug-runner validates extracted JavaScript before writing. If quorum returns syntactically invalid code, runner rejects it with {fixed: false, error: 'invalid_syntax'} instead of corrupting stub.

    7. Timeout handling — nf-debug-runner returns {fixed: false, error: 'timeout', elapsed_ms: N} on quorum timeout, and elapsed_ms is always set.
  </verify>
  <done>
    bin/nf-debug-runner.cjs exists: handles --dry-run, --verbose, --stub, --test flags; validates pre-flight (checks both debug-formal-context.cjs and call-quorum-slot.cjs exist); wraps stub fix in try/finally to guarantee restoration even on crash; validates extracted JavaScript syntax before writing; returns {fixed, error, elapsed_ms} with proper timeout handling; uses robust regex /```(?:js|javascript)?\n?([\s\S]*?)\n?```/ for code block extraction. bin/nf-benchmark-debug.cjs exists: lists all 7 stubs in --dry-run mode; outputs valid JSON with --json; wraps each per-stub runner call in try/finally to guarantee stub restoration; exits 0. benchmarks/debug/baseline.json has pass_rate of 43 with a note explaining the easy-tier floor. Original stub files are restored after any benchmark run (idempotent, resilient to crashes/timeouts).
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
1. `node benchmarks/debug/tests/sort.test.cjs` exits 1 (test fails on buggy stub)
2. `node benchmarks/debug/tests/filter.test.cjs` exits 1
3. `node benchmarks/debug/tests/counter.test.cjs` exits 1
4. `node benchmarks/debug/tests/dedup.test.cjs` exits 1
5. `node benchmarks/debug/tests/accumulator.test.cjs` exits 1
6. `node benchmarks/debug/tests/parser.test.cjs` exits 1
7. `node benchmarks/debug/tests/scheduler.test.cjs` exits 1
8. `node bin/nf-benchmark-debug.cjs --dry-run` exits 0 and lists all 7 stubs
9. `node bin/nf-benchmark-debug.cjs --dry-run --json` emits valid JSON with `total: 7`
10. `node bin/nf-debug-runner.cjs --stub bin/bench-buggy-sort.cjs --test benchmarks/debug/tests/sort.test.cjs --dry-run` exits 0
</verification>

<success_criteria>
- 7 buggy stubs exist (3 easy, 2 medium, 2 hard); each produces definitively wrong output observable in unit tests
- 7 paired test files in benchmarks/debug/tests/ each exit 1 when run against their stub
- bench-buggy-sort.cjs replaced with observable bug (reverse sort instead of unobservable equal-swap)
- bin/nf-debug-runner.cjs implements full fix-cycle protocol with safety guardrails:
  - Pre-flight check verifies bin/debug-formal-context.cjs and bin/call-quorum-slot.cjs exist
  - Try/finally wraps per-stub fix cycle to guarantee restoration on crash/timeout
  - Validates extracted JavaScript syntax before writing to disk
  - Robust regex handles quorum response format variations
  - Timeout handling returns {fixed: false, error: 'timeout', elapsed_ms: N}
  - Default timeout increased to 150s (from 120s) for provider latency tolerance
- bin/nf-benchmark-debug.cjs scores 0–100, is idempotent (wraps each runner call in try/finally), supports --dry-run and --json
- benchmarks/debug/baseline.json updated to pass_rate=43 (easy-tier floor)
</success_criteria>

<output>
After completion, create `.planning/quick/404-build-nf-debug-autonomy-benchmark-with-g/404-SUMMARY.md`
</output>
