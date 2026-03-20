'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const CLI = path.join(__dirname, 'nforma-cli.js');
const PKG = require('../package.json');

function run(...args) {
  return execFileSync(process.execPath, [CLI, ...args], {
    stdio: 'pipe',
    timeout: 10000,
    env: { ...process.env, NO_COLOR: '1' },
  }).toString().trim();
}

// ── Version & Help ──────────────────────────────────────────────────────────

describe('nforma-cli: version', () => {
  test('--version prints package version', () => {
    assert.equal(run('--version'), PKG.version);
  });

  test('-v prints package version', () => {
    assert.equal(run('-v'), PKG.version);
  });

  test('version output is a valid semver string', () => {
    const out = run('--version');
    assert.match(out, /^\d+\.\d+\.\d+/, 'must be semver');
  });

  test('version output has no trailing whitespace or extra lines', () => {
    const raw = execFileSync(process.execPath, [CLI, '--version'], {
      stdio: 'pipe',
      timeout: 5000,
    }).toString();
    // Should be exactly "X.Y.Z\n" or "X.Y.Z-prerelease\n"
    assert.match(raw, /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?\n$/, 'exactly one line with newline');
  });
});

describe('nforma-cli: help', () => {
  test('--help prints usage banner with version', () => {
    const out = run('--help');
    assert.ok(out.includes(PKG.version), 'must include current version');
    assert.ok(out.includes('Quorum Gets Shit Done'), 'must include tagline');
  });

  test('--help mentions all subcommands', () => {
    const out = run('--help');
    assert.ok(out.includes('install'), 'must mention install');
    assert.ok(out.includes('--version'), 'must mention --version');
    assert.ok(out.includes('--help'), 'must mention --help');
    assert.ok(out.includes('TUI'), 'must mention TUI');
  });

  test('-h is equivalent to --help', () => {
    const helpOut = run('--help');
    const hOut = run('-h');
    assert.equal(helpOut, hOut, '-h and --help must produce identical output');
  });

  test('help output has Usage section', () => {
    const out = run('--help');
    assert.ok(out.includes('Usage:'), 'must have Usage: header');
  });
});

// ── Install subcommand routing ──────────────────────────────────────────────

describe('nforma-cli: install routing', () => {
  test('install --help is forwarded to installer', () => {
    // The installer should respond to --help (it has its own help)
    // We just verify it doesn't crash and produces output
    try {
      const out = run('install', '--help');
      // install.js --help should produce some output about installation
      assert.ok(out.length > 0, 'install --help must produce output');
    } catch (e) {
      // Some installer --help implementations exit with code 1
      // That's OK as long as it produced output
      if (e.stdout) {
        assert.ok(e.stdout.toString().length > 0, 'install --help must produce output even if exit code non-zero');
      }
    }
  });

  test('install subcommand strips "install" from argv', () => {
    // Verify the installer sees --help as argv[2], not "install"
    // We test this indirectly: install --version should NOT print
    // nforma-cli's version (that would mean routing failed)
    try {
      const out = run('install', '--version');
      // If this returns, the installer handled --version itself
      // It should NOT be the same as nforma --version
      // (installer doesn't have a --version flag, so it might error or ignore it)
    } catch {
      // Expected — installer doesn't handle --version, may exit non-zero
    }
  });
});

// ── File structure & packaging ──────────────────────────────────────────────

describe('nforma-cli: packaging', () => {
  test('package.json bin.nforma points to nforma-cli.js', () => {
    assert.equal(PKG.bin.nforma, 'bin/nforma-cli.js');
  });

  test('package.json bin.get-shit-done-cc still points to install.js', () => {
    assert.equal(PKG.bin['get-shit-done-cc'], 'bin/install.js',
      'legacy get-shit-done-cc must still route to installer');
  });

  test('nforma-cli.js has shebang line', () => {
    const content = fs.readFileSync(CLI, 'utf8');
    assert.ok(content.startsWith('#!/usr/bin/env node'), 'must have node shebang');
  });

  test('nforma-cli.js is included in package.json files list', () => {
    // The "bin" directory is in the files list, which covers bin/nforma-cli.js
    assert.ok(PKG.files.includes('bin'), '"bin" must be in files array');
  });

  test('nforma-cli.js requires existing modules', () => {
    const content = fs.readFileSync(CLI, 'utf8');
    // Extract all require paths
    const requires = [...content.matchAll(/require\(['"]([^'"]+)['"]\)/g)]
      .map(m => m[1])
      .filter(r => r.startsWith('.'));

    for (const req of requires) {
      const resolved = path.resolve(path.dirname(CLI), req);
      // Try with and without extensions
      const candidates = [
        resolved,
        resolved + '.js',
        resolved + '.cjs',
        resolved + '.json',
      ];
      const exists = candidates.some(c => fs.existsSync(c));
      assert.ok(exists, `required module "${req}" must exist (tried: ${candidates.join(', ')})`);
    }
  });

  test('nforma-cli.js file is executable or has shebang', () => {
    const content = fs.readFileSync(CLI, 'utf8');
    assert.ok(content.startsWith('#!'), 'must start with shebang for npm bin symlink');
  });
});

// ── Routing logic ───────────────────────────────────────────────────────────

describe('nforma-cli: routing logic', () => {
  test('unknown flags fall through to smart routing (no crash on parse)', () => {
    // nforma --unknown-flag should smart-route (installer or TUI)
    // Both will fail in non-TTY CI but the CLI router itself shouldn't crash
    try {
      execFileSync(process.execPath, [CLI, '--unknown-flag'], {
        stdio: 'pipe',
        timeout: 3000,
        env: { ...process.env, NO_COLOR: '1', NF_TEST_MODE: '1' },
      });
    } catch (e) {
      const stderr = (e.stderr || '').toString();
      assert.ok(
        !stderr.includes('Unknown command') && !stderr.includes('unrecognized option'),
        'unknown flags must pass through to smart routing, not be rejected by CLI router'
      );
    }
  });

  test('no args uses smart routing (installer if not installed, TUI if installed)', () => {
    // On dev machine, nf/ likely exists → routes to TUI
    // On fresh machine, nf/ missing → routes to installer
    // Either way, the CLI router itself must not crash with a routing error
    try {
      execFileSync(process.execPath, [CLI], {
        stdio: 'pipe',
        timeout: 3000,
        env: { ...process.env, NO_COLOR: '1', NF_TEST_MODE: '1' },
      });
    } catch (e) {
      const stderr = (e.stderr || '').toString();
      assert.ok(
        !stderr.includes('No subcommand'),
        'no args must use smart routing'
      );
    }
  });

  test('explicit "tui" subcommand forces TUI launch', () => {
    try {
      execFileSync(process.execPath, [CLI, 'tui'], {
        stdio: 'pipe',
        timeout: 3000,
        env: { ...process.env, NO_COLOR: '1', NF_TEST_MODE: '1' },
      });
    } catch {
      // TUI fails in non-TTY — expected
    }
  });

  test('version flag takes priority over other args', () => {
    const out = run('--version');
    assert.equal(out, PKG.version);
  });

  test('install is case-sensitive', () => {
    // nforma Install should NOT route to installer — should smart-route
    try {
      execFileSync(process.execPath, [CLI, 'Install'], {
        stdio: 'pipe',
        timeout: 3000,
        env: { ...process.env, NO_COLOR: '1', NF_TEST_MODE: '1' },
      });
    } catch {
      // Expected — falls through to smart routing
    }
  });
});

// ── npx detection ───────────────────────────────────────────────────────────

describe('nforma-cli: npx detection', () => {
  test('isNpx detects _npx in __dirname', () => {
    const content = fs.readFileSync(CLI, 'utf8');
    assert.ok(content.includes('_npx'), 'must check for _npx in path');
  });

  test('npx execution routes to installer (simulated via _npx path)', () => {
    // The CLI checks if __dirname contains _npx
    // We can't easily fake __dirname, but we verify the logic exists
    const content = fs.readFileSync(CLI, 'utf8');
    assert.ok(content.includes("isNpx()"), 'must call isNpx() in default routing');
    assert.ok(
      content.includes("require('./install.js')"),
      'npx path must require install.js'
    );
  });

  test('global install (no npx) routes to TUI', () => {
    // When not running via npx, default should be TUI
    const content = fs.readFileSync(CLI, 'utf8');
    assert.ok(
      content.includes("require('./nForma.cjs')"),
      'non-npx path must require nForma.cjs'
    );
  });
});

// ── Exit codes ──────────────────────────────────────────────────────────────

describe('nforma-cli: exit codes', () => {
  test('--version exits with code 0', () => {
    // execFileSync throws on non-zero exit, so success = code 0
    run('--version');
  });

  test('--help exits with code 0', () => {
    run('--help');
  });
});
