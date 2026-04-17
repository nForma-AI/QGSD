#!/usr/bin/env node
'use strict';

// bin/contributing-guidelines.test.cjs
// Adversarial tests for contributing-guideline awareness across agents and skills.
//
// Intent: prove that every place that touches a repo (commits, reviews, intake)
// actually reads CONTRIBUTING.md, uses a consistent lookup path list, and that
// nForma's own CONTRIBUTING.md contains the fields agents need to extract.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

// Canonical path list that every agent/skill must use (in this order).
// If you change this list, update every file in FILES_WITH_LOOKUP below.
const CANONICAL_PATHS = [
  'CONTRIBUTING.md',
  '.github/CONTRIBUTING.md',
  'docs/CONTRIBUTING.md',
  'CONTRIBUTING.rst',
  'CONTRIBUTING.txt',
  'CONTRIBUTING',
];

// Every agent/skill source file that should contain a CONTRIBUTING.md lookup step.
const FILES_WITH_LOOKUP = [
  'agents/skills/task-intake/SKILL.md',
  'agents/skills/shipping-and-launch/SKILL.md',
  'agents/skills/code-review-and-quality/SKILL.md', // BUG: missing as of initial implementation
  'agents/nf-executor.md',
  'agents/nf-worktree-executor.md',
  'agents/nf-debugger.md',
];

// Sections that nForma's own CONTRIBUTING.md must contain so agents can extract
// real conventions instead of falling through to defaults.
const REQUIRED_CONTRIBUTING_SECTIONS = [
  { label: 'commit message format or conventional commits', pattern: /commit.{0,30}(format|message|convention|style)/i },
  { label: 'branch naming conventions', pattern: /branch.{0,30}(naming|name|convention|pattern)/i },
];

function readFile(relPath) {
  const fullPath = path.join(REPO_ROOT, relPath);
  assert.ok(fs.existsSync(fullPath), `Expected source file to exist: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

// ---------------------------------------------------------------------------
// Suite 1: every file that touches a repo has the contributing lookup step
// ---------------------------------------------------------------------------
describe('contributing-guidelines — coverage across agents and skills', () => {
  for (const relPath of FILES_WITH_LOOKUP) {
    it(`${relPath} contains a CONTRIBUTING.md lookup step`, () => {
      const content = readFile(relPath);
      assert.ok(
        /contributing/i.test(content),
        `${relPath} has no mention of "contributing" — add a CONTRIBUTING.md lookup step`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 2: path list consistency — no drift across duplicated prose
// ---------------------------------------------------------------------------
describe('contributing-guidelines — canonical path list consistency', () => {
  it('all agent/skill files use the same set of lookup paths', () => {
    const mismatches = [];

    for (const relPath of FILES_WITH_LOOKUP) {
      const content = readFile(relPath);

      for (const p of CANONICAL_PATHS) {
        if (!content.includes(p)) {
          mismatches.push(`${relPath} is missing lookup path: ${p}`);
        }
      }
    }

    assert.deepStrictEqual(
      mismatches,
      [],
      `Path list drift detected:\n${mismatches.join('\n')}`
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 3: nForma's own CONTRIBUTING.md has extractable sections
// ---------------------------------------------------------------------------
describe('CONTRIBUTING.md — contains sections agents need to extract', () => {
  const contributing = fs.existsSync(path.join(REPO_ROOT, 'CONTRIBUTING.md'))
    ? fs.readFileSync(path.join(REPO_ROOT, 'CONTRIBUTING.md'), 'utf8')
    : '';

  it('CONTRIBUTING.md exists at repo root', () => {
    assert.ok(
      fs.existsSync(path.join(REPO_ROOT, 'CONTRIBUTING.md')),
      'CONTRIBUTING.md must exist at repo root'
    );
  });

  for (const { label, pattern } of REQUIRED_CONTRIBUTING_SECTIONS) {
    it(`CONTRIBUTING.md documents ${label}`, () => {
      assert.ok(
        pattern.test(contributing),
        `CONTRIBUTING.md is missing a section on "${label}". ` +
        `Agents will fall through to defaults and ignore project conventions.`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 4: task-intake schema declares the contributing_guidelines output key
// ---------------------------------------------------------------------------
describe('task-intake — output schema declares contributing_guidelines', () => {
  it('SKILL.md output format includes contributing_guidelines field', () => {
    const content = readFile('agents/skills/task-intake/SKILL.md');
    assert.ok(
      /contributing_guidelines/i.test(content),
      'task-intake SKILL.md output schema is missing the contributing_guidelines field'
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 5: commit-making agents declare contributing lookup BEFORE first commit
// ---------------------------------------------------------------------------
describe('contributing-guidelines — lookup precedes commit in agents', () => {
  it('nf-executor loads contributing guidelines in project_context (before task_commit_protocol)', () => {
    const content = readFile('agents/nf-executor.md');
    const lower = content.toLowerCase();
    const ctxIdx = lower.indexOf('contributing guidelines');
    const commitIdx = lower.indexOf('task_commit_protocol');
    assert.ok(ctxIdx !== -1, 'nf-executor missing contributing guidelines block');
    assert.ok(commitIdx !== -1, 'nf-executor missing task_commit_protocol block');
    assert.ok(
      ctxIdx < commitIdx,
      'nf-executor: contributing guidelines lookup must appear before task_commit_protocol'
    );
  });

  it('nf-worktree-executor loads contributing guidelines in project_context (before task_commit_protocol)', () => {
    const content = readFile('agents/nf-worktree-executor.md');
    const lower = content.toLowerCase();
    const ctxIdx = lower.indexOf('contributing guidelines');
    const commitIdx = lower.indexOf('task_commit_protocol');
    assert.ok(ctxIdx !== -1, 'nf-worktree-executor missing contributing guidelines block');
    assert.ok(commitIdx !== -1, 'nf-worktree-executor missing task_commit_protocol block');
    assert.ok(
      ctxIdx < commitIdx,
      'nf-worktree-executor: contributing guidelines lookup must appear before task_commit_protocol'
    );
  });

  it('nf-debugger loads contributing guidelines before the commit command', () => {
    const content = readFile('agents/nf-debugger.md');
    const lower = content.toLowerCase();
    const ctxIdx = lower.indexOf('contributing guideline');
    const commitIdx = lower.indexOf('git commit -m "fix:');
    assert.ok(ctxIdx !== -1, 'nf-debugger missing contributing guidelines block');
    assert.ok(commitIdx !== -1, 'nf-debugger missing fix commit command');
    assert.ok(
      ctxIdx < commitIdx,
      'nf-debugger: contributing guidelines lookup must appear before the commit'
    );
  });
});
