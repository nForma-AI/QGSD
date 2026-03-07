// bin/config-audit.test.cjs
// Unit tests for bin/config-audit.cjs
// Uses Node.js built-in test runner (node --test)

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, 'config-audit.cjs');

// Helper: create a temp dir with .claude/nf.json
function setupTempProject(nfJsonContent) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-audit-test-'));
  const claudeDir = path.join(tempDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  if (nfJsonContent !== undefined) {
    fs.writeFileSync(path.join(claudeDir, 'nf.json'), JSON.stringify(nfJsonContent), 'utf8');
  }
  return tempDir;
}

function cleanup(tempDir) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function runAudit(projectRoot) {
  const args = [SCRIPT_PATH, '--json', `--project-root=${projectRoot}`];
  const result = spawnSync('node', args, {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env },
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

describe('config-audit.cjs', () => {
  it('Test 1: empty agent_config produces "all-default" warning and lists all slots as missing', () => {
    const tempDir = setupTempProject({ agent_config: {} });
    try {
      const { stdout, exitCode } = runAudit(tempDir);
      assert.strictEqual(exitCode, 0);

      const result = JSON.parse(stdout.trim());
      assert.ok(Array.isArray(result.warnings));
      assert.ok(Array.isArray(result.missing));

      // Should have the "all-default" warning
      assert.ok(result.warnings.length >= 1, 'Should have at least one warning');
      assert.ok(result.warnings[0].includes('auth_type=api'), 'Warning should mention auth_type=api');
      assert.ok(result.warnings[0].includes('FALLBACK-01'), 'Warning should mention FALLBACK-01');

      // All provider slots should be listed as missing (since no quorum_active, audits all)
      assert.ok(result.missing.length > 0, 'Should list missing slots');
    } finally {
      cleanup(tempDir);
    }
  });

  it('Test 2: properly configured agent_config with sub/api mix produces no "all-default" warning', () => {
    const tempDir = setupTempProject({
      agent_config: {
        'codex-1': { auth_type: 'sub' },
        'gemini-1': { auth_type: 'sub' },
        'opencode-1': { auth_type: 'api' },
        'copilot-1': { auth_type: 'api' },
      },
      quorum_active: ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1'],
    });
    try {
      const { stdout, exitCode } = runAudit(tempDir);
      assert.strictEqual(exitCode, 0);

      const result = JSON.parse(stdout.trim());
      // No "all-default" warning because at least one slot is 'sub'
      const allDefaultWarnings = result.warnings.filter(w => w.includes('FALLBACK-01'));
      assert.strictEqual(allDefaultWarnings.length, 0, 'Should have no FALLBACK-01 warning');
      // No missing slots since all quorum_active slots have entries
      assert.strictEqual(result.missing.length, 0, 'Should have no missing slots');
    } finally {
      cleanup(tempDir);
    }
  });

  it('Test 3: partial agent_config lists missing ones but no "all-default" warning if at least one is sub', () => {
    const tempDir = setupTempProject({
      agent_config: {
        'codex-1': { auth_type: 'sub' },
      },
      quorum_active: ['codex-1', 'gemini-1', 'opencode-1'],
    });
    try {
      const { stdout, exitCode } = runAudit(tempDir);
      assert.strictEqual(exitCode, 0);

      const result = JSON.parse(stdout.trim());
      // No "all-default" warning because codex-1 is 'sub'
      const allDefaultWarnings = result.warnings.filter(w => w.includes('FALLBACK-01'));
      assert.strictEqual(allDefaultWarnings.length, 0, 'Should have no FALLBACK-01 warning');
      // gemini-1 and opencode-1 should be listed as missing
      assert.ok(result.missing.includes('gemini-1'), 'gemini-1 should be missing');
      assert.ok(result.missing.includes('opencode-1'), 'opencode-1 should be missing');
      assert.ok(!result.missing.includes('codex-1'), 'codex-1 should NOT be missing');
    } finally {
      cleanup(tempDir);
    }
  });

  it('Test 4: --json flag produces valid JSON output', () => {
    const tempDir = setupTempProject({});
    try {
      const { stdout, exitCode } = runAudit(tempDir);
      assert.strictEqual(exitCode, 0);

      // Must be valid JSON
      const result = JSON.parse(stdout.trim());
      assert.ok(result.hasOwnProperty('warnings'), 'Must have warnings property');
      assert.ok(result.hasOwnProperty('missing'), 'Must have missing property');
      assert.ok(Array.isArray(result.warnings), 'warnings must be an array');
      assert.ok(Array.isArray(result.missing), 'missing must be an array');
    } finally {
      cleanup(tempDir);
    }
  });

  it('Test 5: exit code is always 0 even with errors (fail-open)', () => {
    // Use a non-existent project root -- should still exit 0
    const { exitCode, stdout } = runAudit('/tmp/nonexistent-config-audit-test-dir-999');
    assert.strictEqual(exitCode, 0, 'Exit code must be 0 (fail-open)');
    // Should still produce some JSON output
    const result = JSON.parse(stdout.trim());
    assert.ok(result.hasOwnProperty('warnings'), 'Must have warnings property');
    assert.ok(result.hasOwnProperty('missing'), 'Must have missing property');
  });
});
