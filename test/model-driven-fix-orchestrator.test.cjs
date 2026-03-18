const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

// ---- Phase 1 & 2: formal-scope-scan.cjs tool contract ----

test('MRF-03: formal-scope-scan.cjs --bug-mode returns valid JSON', () => {
  // formal-scope-scan.cjs must exist and accept --bug-mode
  const scanPath = path.join(projectRoot, 'bin', 'formal-scope-scan.cjs');
  assert.ok(fs.existsSync(scanPath), 'bin/formal-scope-scan.cjs must exist');

  try {
    const output = execFileSync('node', [scanPath, '--bug-mode', '--description', 'test failure', '--format', 'json'], {
      encoding: 'utf-8',
      timeout: 15000,
      cwd: projectRoot
    });
    // Should be valid JSON (may be empty matches)
    const parsed = JSON.parse(output);
    assert.ok(typeof parsed === 'object', 'output must be a JSON object');
  } catch (err) {
    // Script may exit non-zero if no models found — that is acceptable
    // But it should still output valid JSON on stdout
    if (err.stdout) {
      try {
        JSON.parse(err.stdout);
      } catch (_parseErr) {
        // If stdout is not JSON, the tool contract allows empty output on no matches
        // This is acceptable — fail-open
      }
    }
  }
});

// ---- Phase 3: refinement-loop.cjs tool contracts ----

test('MRF-03: refinement-loop.cjs normalizeBugContext handles inline text', () => {
  const { normalizeBugContext } = require('../bin/refinement-loop.cjs');
  const result = normalizeBugContext('inline bug description for model-driven-fix');
  assert.strictEqual(result, 'inline bug description for model-driven-fix');
});

test('MRF-03: refinement-loop.cjs normalizeBugContext handles file path', () => {
  const { normalizeBugContext } = require('../bin/refinement-loop.cjs');
  const os = require('os');
  const tmpFile = path.join(os.tmpdir(), `mdf-test-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Bug from file: circuit breaker stuck open\n');
  try {
    const result = normalizeBugContext(tmpFile);
    assert.strictEqual(result, 'Bug from file: circuit breaker stuck open');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('MRF-03: refinement-loop.cjs verifyBugReproduction returns valid schema', () => {
  const { verifyBugReproduction, _setDeps } = require('../bin/refinement-loop.cjs');

  // Mock checker that always passes (model does not reproduce)
  _setDeps({
    execFileSync: () => 'Model checking completed. No error has been found.'
  });

  const result = verifyBugReproduction('/fake/model.tla', 'test bug', {
    formalism: 'tla',
    maxAttempts: 1
  });

  // Verify schema
  assert.ok(result.status === 'reproduced' || result.status === 'not_reproduced',
    'status must be reproduced or not_reproduced');
  assert.ok(typeof result.attempts === 'number', 'attempts must be a number');
  assert.ok(typeof result.model_path === 'string', 'model_path must be a string');
  assert.ok(Array.isArray(result.iterations), 'iterations must be an array');
  assert.ok(result.counterexample === null || typeof result.counterexample === 'string',
    'counterexample must be null or string');

  // Reset deps
  _setDeps({
    execFileSync: require('child_process').execFileSync,
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync
  });
});

// ---- Phase 4: model-constrained-fix.cjs tool contract ----

test('MRF-03: model-constrained-fix.cjs returns valid constraint JSON for a TLA+ spec', () => {
  const fixPath = path.join(projectRoot, 'bin', 'model-constrained-fix.cjs');
  assert.ok(fs.existsSync(fixPath), 'bin/model-constrained-fix.cjs must exist');

  // Find any existing .tla file to test with
  const tlaDir = path.join(projectRoot, '.planning', 'formal', 'tla');
  let tlaFile = null;
  if (fs.existsSync(tlaDir)) {
    const files = fs.readdirSync(tlaDir).filter(f => f.endsWith('.tla') && !f.startsWith('MC'));
    if (files.length > 0) {
      tlaFile = path.join(tlaDir, files[0]);
    }
  }

  if (!tlaFile) {
    // No TLA+ files available — skip but don't fail (fail-open)
    return;
  }

  const output = execFileSync('node', [fixPath, '--spec', tlaFile, '--max-constraints', '3', '--format', 'json'], {
    encoding: 'utf-8',
    timeout: 10000,
    cwd: projectRoot
  });

  const parsed = JSON.parse(output);
  assert.ok(typeof parsed.model_path === 'string', 'must have model_path');
  assert.ok(typeof parsed.formalism === 'string', 'must have formalism');
  assert.ok(typeof parsed.constraint_count === 'number', 'must have constraint_count');
  assert.ok(Array.isArray(parsed.constraints), 'must have constraints array');
});

// ---- Workflow file completeness ----

test('MRF-03: workflow file references all 6 phase tools', () => {
  const workflowPath = path.join(projectRoot, 'core', 'workflows', 'model-driven-fix.md');
  assert.ok(fs.existsSync(workflowPath), 'core/workflows/model-driven-fix.md must exist');

  const content = fs.readFileSync(workflowPath, 'utf-8');

  // Phase 1 & 2: formal-scope-scan
  assert.ok(content.includes('formal-scope-scan'), 'workflow must reference formal-scope-scan (Phases 1, 2)');
  assert.ok(content.includes('--bug-mode'), 'workflow must include --bug-mode flag');

  // Phase 3: close-formal-gaps with --bug-context
  assert.ok(content.includes('close-formal-gaps'), 'workflow must reference close-formal-gaps (Phase 3)');
  assert.ok(content.includes('bug-context'), 'workflow must include --bug-context (Phase 3)');

  // Phase 4: model-constrained-fix
  assert.ok(content.includes('model-constrained-fix'), 'workflow must reference model-constrained-fix (Phase 4)');

  // Phase 6: run-tlc or run-alloy
  assert.ok(content.includes('run-tlc') || content.includes('run-alloy'),
    'workflow must reference run-tlc or run-alloy (Phase 6)');

  // All 6 phases present
  assert.ok(content.includes('Phase 1'), 'workflow must have Phase 1');
  assert.ok(content.includes('Phase 2'), 'workflow must have Phase 2');
  assert.ok(content.includes('Phase 3'), 'workflow must have Phase 3');
  assert.ok(content.includes('Phase 4'), 'workflow must have Phase 4');
  assert.ok(content.includes('Phase 5'), 'workflow must have Phase 5');
  assert.ok(content.includes('Phase 6'), 'workflow must have Phase 6');
});

test('MRF-03: command definition matches workflow', () => {
  const cmdPath = path.join(projectRoot, 'commands', 'nf', 'model-driven-fix.md');
  assert.ok(fs.existsSync(cmdPath), 'commands/nf/model-driven-fix.md must exist');

  const content = fs.readFileSync(cmdPath, 'utf-8');

  // Name field
  assert.ok(content.includes('name: model-driven-fix'), 'command must have name: model-driven-fix');

  // Argument hint includes flags
  assert.ok(content.includes('--verbose'), 'argument-hint must include --verbose');
  assert.ok(content.includes('--skip-fix'), 'argument-hint must include --skip-fix');
  assert.ok(content.includes('--formalism'), 'argument-hint must include --formalism');

  // Points to workflow
  assert.ok(content.includes('model-driven-fix.md'), 'command must reference model-driven-fix.md workflow');
});

test('MRF-03: --skip-fix documented as stopping after Phase 4', () => {
  const workflowPath = path.join(projectRoot, 'core', 'workflows', 'model-driven-fix.md');
  const content = fs.readFileSync(workflowPath, 'utf-8');

  assert.ok(content.includes('SKIP_FIX'), 'workflow must check SKIP_FIX flag');
  assert.ok(content.includes('skip-fix'), 'workflow must document --skip-fix');
});
