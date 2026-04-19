#!/usr/bin/env node
'use strict';
// bin/strip-bench-hints.cjs
// Two-pass hardening for the debug benchmark:
//   1. Strip ALL JS comments from stub files (removes BUG:/Fix: hints)
//   2. Patch test files: rewrite the assert helper to silently drop the info arg
//      (call sites untouched — no regex surgery on expressions)
//
// Run: node bin/strip-bench-hints.cjs

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Pass 1: Strip comments from stubs ─────────────────────────────────────

function stripComments(src) {
  var out = '';
  var i = 0, n = src.length;
  var inStr1 = false, inStr2 = false, inTpl = false;

  while (i < n) {
    var c = src[i], nx = src[i + 1];

    if (inStr1) {
      out += c;
      if (c === '\\' && i + 1 < n) { out += src[++i]; }
      else if (c === "'") inStr1 = false;
    } else if (inStr2) {
      out += c;
      if (c === '\\' && i + 1 < n) { out += src[++i]; }
      else if (c === '"') inStr2 = false;
    } else if (inTpl) {
      out += c;
      if (c === '\\' && i + 1 < n) { out += src[++i]; }
      else if (c === '`') inTpl = false;
    } else if (c === "'" && !inStr2 && !inTpl) {
      inStr1 = true; out += c;
    } else if (c === '"' && !inStr1 && !inTpl) {
      inStr2 = true; out += c;
    } else if (c === '`' && !inStr1 && !inStr2) {
      inTpl = true; out += c;
    } else if (c === '/' && nx === '*') {
      // Skip block comment
      i += 2;
      while (i < n - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2; // skip */
      continue;
    } else if (c === '/' && nx === '/') {
      // Skip line comment
      while (i < n && src[i] !== '\n') i++;
      continue;
    } else {
      out += c;
    }
    i++;
  }

  // Collapse 3+ blank lines → 2
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim() + '\n';
}

// ── Pass 2: Patch test assert helpers to strip all diagnostic output ───────
//
// Three forms exist across test files; all are replaced with silent versions
// that output only "FAIL {label}" with no expected/actual/info hints.
// Call sites are left untouched — JS silently ignores extra args.

// Form A: function assert(label, cond[, info]) { ... }
//   → replaced with 2-arg boolean form (info arg dropped)
var ASSERT_BOOL_VERBOSE = /function assert\s*\(label,\s*cond(?:,\s*info)?\)\s*\{[^}]*\}\s*\}/g;
var ASSERT_BOOL_SILENT  = "function assert(label, cond) {\n  if (!cond) { process.stderr.write('FAIL ' + label + '\\n'); failed++; }\n}";

// Form B: function assert(label, actual|got, expected[, info]) { ... multiline ... }
//   → replaced with equality check form that emits no actual/expected values
var ASSERT_EQ_VERBOSE = /function assert\s*\(label,\s*(?:actual|got),\s*expected(?:,\s*info)?\)\s*\{[\s\S]*?\n\}/g;
var ASSERT_EQ_SILENT  = "function assert(label, actual, expected) {\n  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\\n'); failed++; }\n}";

// ── Main ──────────────────────────────────────────────────────────────────

var stubsDir  = path.join(ROOT, 'bin');
var testsDir  = path.join(ROOT, 'benchmarks', 'debug', 'tests');
var stubCount = 0, testCount = 0;

// Stubs: strip all comments
fs.readdirSync(stubsDir)
  .filter(function(f) { return /^bench-buggy-.+\.cjs$/.test(f); })
  .forEach(function(f) {
    var fp  = path.join(stubsDir, f);
    var src = fs.readFileSync(fp, 'utf8');
    var out = stripComments(src);
    if (out !== src) { fs.writeFileSync(fp, out, 'utf8'); stubCount++; }
  });

// Tests: patch assert helper only (no surgery on call sites)
fs.readdirSync(testsDir)
  .filter(function(f) { return f.endsWith('.test.cjs'); })
  .forEach(function(f) {
    var fp  = path.join(testsDir, f);
    var src = fs.readFileSync(fp, 'utf8');
    var out = src.replace(ASSERT_BOOL_VERBOSE, ASSERT_BOOL_SILENT);
    out = out.replace(ASSERT_EQ_VERBOSE, ASSERT_EQ_SILENT);
    if (out !== src) { fs.writeFileSync(fp, out, 'utf8'); testCount++; }
  });

process.stdout.write('Stripped comments: ' + stubCount + ' stubs\n');
process.stdout.write('Patched assert helper: ' + testCount + ' test files\n');
