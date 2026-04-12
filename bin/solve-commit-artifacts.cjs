#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PATHSPECS = [
  '.planning/formal/',
  '.planning/upstream-state.json',
  'docs/dev/requirements-coverage.md',
  'bin/',
  'test/',
];

const COMMIT_MSG = `chore(solve): update formal verification artifacts

Automated commit from nf-solve — includes layer manifests, gate results,
evidence snapshots, model registry, and requirements coverage updates.`;

function git(args, opts) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    cwd: (opts && opts.cwd) || ROOT,
    timeout: (opts && opts.timeout) || 30000,
    stdio: 'pipe',
  });
}

function isGitRepo(opts) {
  const r = git(['rev-parse', '--is-inside-work-tree'], opts);
  return r.status === 0 && (r.stdout || '').trim() === 'true';
}

function stagePaths(opts) {
  const cwd = (opts && opts.cwd) || ROOT;
  for (const spec of PATHSPECS) {
    spawnSync('git', ['add', '-A', '--', spec], {
      encoding: 'utf8', cwd, timeout: 15000, stdio: 'pipe',
    });
  }
}

function hasStagedChanges(opts) {
  const r = git(['diff', '--cached', '--quiet'], opts);
  return r.status !== 0;
}

function doCommit(opts) {
  const cwd = (opts && opts.cwd) || ROOT;
  const r = spawnSync('git', ['commit', '-m', COMMIT_MSG, '--no-verify'], {
    encoding: 'utf8', cwd, timeout: 30000, stdio: 'pipe',
  });
  if (r.status !== 0) {
    if ((r.stderr || '').includes('nothing to commit')) {
      return { committed: false, reason: 'nothing staged' };
    }
    return {
      committed: false,
      reason: 'commit failed',
      stderr: (r.stderr || '').trim(),
    };
  }
  const hash = (r.stdout || '').match(/\[.*?([0-9a-f]{7,})/);
  return { committed: true, hash: hash ? hash[1] : null };
}

function main() {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const dryRun = argv.includes('--dry-run');
  const projectRoot = argv.find(a => a.startsWith('--project-root='));
  const cwd = projectRoot ? projectRoot.split('=').slice(1).join('=') : ROOT;
  const opts = { cwd };

  if (!isGitRepo(opts)) {
    const result = { committed: false, reason: 'not a git repo' };
    if (jsonMode) console.log(JSON.stringify(result));
    else process.stderr.write('[solve-commit] Skipping: not a git repo\n');
    process.exit(0);
  }

  if (dryRun) {
    for (const spec of PATHSPECS) {
      const r = spawnSync('git', ['add', '-A', '--dry-run', '--', spec], {
        encoding: 'utf8', cwd, timeout: 15000, stdio: 'pipe',
      });
      if (r.stdout && r.stdout.trim()) {
        console.log(r.stdout.trim());
      }
    }
    process.exit(0);
  }

  stagePaths(opts);

  if (!hasStagedChanges(opts)) {
    const result = { committed: false, reason: 'nothing to commit' };
    if (jsonMode) console.log(JSON.stringify(result));
    else process.stderr.write('[solve-commit] Nothing to commit\n');
    process.exit(0);
  }

  const commitResult = doCommit(opts);

  if (!commitResult.committed) {
    if (jsonMode) console.log(JSON.stringify(commitResult));
    else process.stderr.write('[solve-commit] Commit failed: ' + (commitResult.stderr || commitResult.reason) + '\n');
    process.exit(1);
  }

  const result = {
    committed: true,
    hash: commitResult.hash,
    message: COMMIT_MSG.split('\n')[0],
  };

  if (jsonMode) {
    console.log(JSON.stringify(result));
  } else {
    process.stderr.write('[solve-commit] Committed ' + (result.hash || '') + ' — ' + result.message + '\n');
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { PATHSPECS, COMMIT_MSG, isGitRepo, stagePaths, hasStagedChanges, doCommit };
