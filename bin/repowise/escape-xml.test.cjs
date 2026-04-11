#!/usr/bin/env node
'use strict';
// bin/repowise/escape-xml.test.cjs
// Tests for bin/repowise/escape-xml.cjs — XML character escaping for Repowise

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { escapeXml } = require('./escape-xml.cjs');

// ---------------------------------------------------------------------------
// Basic replacements
// ---------------------------------------------------------------------------

describe('escapeXml — basic replacements', () => {
  it('replaces ampersand', () => {
    assert.equal(escapeXml('a & b'), 'a &amp; b');
  });

  it('replaces less-than', () => {
    assert.equal(escapeXml('a < b'), 'a &lt; b');
  });

  it('replaces greater-than', () => {
    assert.equal(escapeXml('a > b'), 'a &gt; b');
  });

  it('replaces double-quote', () => {
    assert.equal(escapeXml('say "hello"'), 'say &quot;hello&quot;');
  });

  it('replaces single-quote', () => {
    assert.equal(escapeXml("it's fine"), 'it&apos;s fine');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('escapeXml — edge cases', () => {
  it('handles all special chars in one string', () => {
    assert.equal(
      escapeXml('<div class="x">&\'y\'</div>'),
      '&lt;div class=&quot;x&quot;&gt;&amp;&apos;y&apos;&lt;/div&gt;'
    );
  });

  it('does not double-encode (proves & is replaced first)', () => {
    // Input '&lt;' has & which must become &amp; first, yielding &amp;lt;
    assert.equal(escapeXml('&lt;'), '&amp;lt;');
  });

  it('returns empty string for empty string input', () => {
    assert.equal(escapeXml(''), '');
  });

  it('returns empty string for non-string inputs', () => {
    assert.equal(escapeXml(42), '');
    assert.equal(escapeXml(null), '');
    assert.equal(escapeXml(undefined), '');
  });

  it('returns input unchanged when no special characters present', () => {
    assert.equal(escapeXml('hello world'), 'hello world');
  });
});
