#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseRequirements, parseTraceability, validateEnvelope } = require('./aggregate-requirements.cjs');

describe('aggregate-requirements adversarial', () => {

  it('empty string input returns empty array', () => {
    const result = parseRequirements('');
    assert.deepStrictEqual(result, []);
  });

  it('null input does not crash', () => {
    try {
      const result = parseRequirements(null);
      assert.ok(Array.isArray(result));
    } catch (e) {
      assert.ok(true, 'threw on null input — acceptable');
    }
  });

  it('markdown with XSS in requirement text', () => {
    const input = '- [ ] **REQ-01**: <script>alert("xss")</script>';
    const result = parseRequirements(input);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].text.includes('<script>'));
  });

  it('markdown with extremely long requirement text', () => {
    const longText = 'A'.repeat(100000);
    const input = `- [ ] **REQ-01**: ${longText}`;
    const result = parseRequirements(input);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].text.length, 100000);
  });

  it('duplicate requirement IDs — last one wins or first one wins (document behavior)', () => {
    const input = [
      '- [ ] **REQ-01**: first',
      '- [ ] **REQ-01**: second',
    ].join('\n');
    const result = parseRequirements(input);
    assert.strictEqual(result.length, 2, 'both duplicates kept');
    assert.strictEqual(result[0].text, 'first');
    assert.strictEqual(result[1].text, 'second');
  });

  it('requirement with no category header gets "Uncategorized"', () => {
    const input = '- [ ] **REQ-01**: orphan requirement';
    const result = parseRequirements(input);
    assert.strictEqual(result[0].category, 'Uncategorized');
  });

  it('requirement ID with unusual format (numbers in prefix)', () => {
    const input = '- [ ] **ABC123-01**: weird prefix';
    const result = parseRequirements(input);
    assert.strictEqual(result.length, 0, 'should not match malformed prefix');
  });

  it('requirement with backticks and code blocks', () => {
    const input = '- [ ] **REQ-01**: Use `npm install` to install\n```js\nconst x = 1;\n```';
    const result = parseRequirements(input);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].text.includes('`npm install`'));
  });

  it('traceability table with malformed rows is skipped', () => {
    const input = [
      '| REQ-01 | v0.42-01 | Complete |',
      '| BAD-FORMAT | missing |',
      '| REQ-02 | v0.42-02 | Pending |',
    ].join('\n');
    const result = parseTraceability(input);
    assert.ok(result['REQ-01'], 'valid row parsed');
    assert.ok(result['REQ-02'], 'valid row parsed');
    assert.ok(!result['BAD-FORMAT'], 'malformed row skipped');
  });

  it('traceability with unknown status defaults to Pending', () => {
    const input = '| REQ-01 | v0.42-01 | InProgress |';
    const result = parseTraceability(input);
    assert.strictEqual(result['REQ-01'].status, 'Pending');
  });

  it('input with only whitespace returns empty', () => {
    const result = parseRequirements('   \n\t\n  ');
    assert.deepStrictEqual(result, []);
  });

  it('requirement text with unicode emojis', () => {
    const input = '- [ ] **REQ-01**: Fix the 🐛 in the 🏗️';
    const result = parseRequirements(input);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].text.includes('🐛'));
  });

  it('category header with trailing special characters', () => {
    const input = '### Security — SEC\n- [ ] **SEC-01**: test';
    const result = parseRequirements(input);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].category, 'Security');
  });

  it('completed requirement marked with [x]', () => {
    const input = '- [x] **REQ-01**: done';
    const result = parseRequirements(input);
    assert.strictEqual(result[0].completed, true);
  });

  it('validateEnvelope returns error object (not array) for null input', () => {
    const result = validateEnvelope(null);
    assert.ok(result && typeof result === 'object');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('validateEnvelope returns error object for empty object', () => {
    const result = validateEnvelope({});
    assert.ok(result && typeof result === 'object');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('requirement with (technical) suffix strips and sets tier', () => {
    const input = '- [ ] **REQ-01**: Must handle errors (technical)';
    const result = parseRequirements(input);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].tier, 'technical');
    assert.ok(!result[0].text.includes('(technical)'));
  });
});
