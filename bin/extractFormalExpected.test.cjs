'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { extractFormalExpected, parseFormalRef } = require('./extractFormalExpected.cjs');

describe('parseFormalRef', () => {
  it('parses spec reference with param', () => {
    const result = parseFormalRef('spec:safety/MCsafety.cfg:MaxDeliberation');
    assert.deepStrictEqual(result, { type: 'spec', path: 'safety/MCsafety.cfg', param: 'MaxDeliberation' });
  });

  it('parses requirement reference', () => {
    const result = parseFormalRef('requirement:DEBT-01');
    assert.deepStrictEqual(result, { type: 'requirement', id: 'DEBT-01' });
  });

  it('parses spec reference without param (invariant)', () => {
    const result = parseFormalRef('spec:safety/invariant-consistency');
    assert.deepStrictEqual(result, { type: 'spec', path: 'safety/invariant-consistency', param: null });
  });

  it('returns null for null input', () => {
    assert.strictEqual(parseFormalRef(null), null);
  });

  it('returns null for empty string', () => {
    assert.strictEqual(parseFormalRef(''), null);
  });
});

describe('extractFormalExpected', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-formal-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts numeric value from .cfg file', () => {
    const specDir = tmpDir;
    const safetyDir = path.join(specDir, 'safety');
    fs.mkdirSync(safetyDir, { recursive: true });
    fs.writeFileSync(path.join(safetyDir, 'MCsafety.cfg'), [
      '\\* MCsafety.cfg',
      'SPECIFICATION Spec',
      'CONSTANTS',
      '    MaxDeliberation = 5',
      '    MaxSize = 3',
      'INVARIANT TypeOK',
    ].join('\n'));

    const result = extractFormalExpected('spec:safety/MCsafety.cfg:MaxDeliberation', { specDir });
    assert.strictEqual(result, 5);
  });

  it('returns null for missing param in .cfg file', () => {
    const specDir = tmpDir;
    const safetyDir = path.join(specDir, 'safety');
    fs.mkdirSync(safetyDir, { recursive: true });
    fs.writeFileSync(path.join(safetyDir, 'MCsafety.cfg'), 'MaxDeliberation = 5\n');

    const result = extractFormalExpected('spec:safety/MCsafety.cfg:MissingParam', { specDir });
    assert.strictEqual(result, null);
  });

  it('returns null when file does not exist (fail-open)', () => {
    const result = extractFormalExpected('spec:nonexistent/file.cfg:Param', { specDir: tmpDir });
    assert.strictEqual(result, null);
  });

  it('returns null for requirement references (text, not numeric)', () => {
    const result = extractFormalExpected('requirement:DEBT-01', { specDir: tmpDir });
    assert.strictEqual(result, null);
  });

  it('returns null for null formalRef', () => {
    const result = extractFormalExpected(null);
    assert.strictEqual(result, null);
  });

  it('extracts value from JSON spec file', () => {
    const specDir = tmpDir;
    const safetyDir = path.join(specDir, 'safety');
    fs.mkdirSync(safetyDir, { recursive: true });
    fs.writeFileSync(path.join(safetyDir, 'thresholds.json'), JSON.stringify({ timeout: 30, name: 'safety' }));

    const result = extractFormalExpected('spec:safety/thresholds.json:timeout', { specDir });
    assert.strictEqual(result, 30);
  });

  it('returns string value from JSON spec file', () => {
    const specDir = tmpDir;
    const safetyDir = path.join(specDir, 'safety');
    fs.mkdirSync(safetyDir, { recursive: true });
    fs.writeFileSync(path.join(safetyDir, 'thresholds.json'), JSON.stringify({ name: 'safety' }));

    const result = extractFormalExpected('spec:safety/thresholds.json:name', { specDir });
    assert.strictEqual(result, 'safety');
  });

  it('returns null for spec ref without param key (invariant)', () => {
    const result = extractFormalExpected('spec:safety/invariant-consistency', { specDir: tmpDir });
    assert.strictEqual(result, null);
  });
});
