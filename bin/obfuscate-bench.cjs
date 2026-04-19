#!/usr/bin/env node
'use strict';
// bin/obfuscate-bench.cjs
// Strips ALL semantic hints from the debug benchmark so the AI cannot
// pattern-match to a fix.  Three passes:
//
//   1. Stubs: rename exported function names (happensBefore → f) and their
//      declared parameters (vcA → a, vcB → b).  Word-boundary replacement
//      applied to the full file — require() paths are not present in stubs.
//
//   2. Tests: rename import destructuring + call sites to match new stub
//      exports.  The require() path string is protected via a placeholder so
//      it is never mutated.  No label-string surgery needed (see pass 3).
//
//   3. Tests: replace the assert helper body with a counter-based version
//      that prints "FAIL t{N}" by execution order regardless of the label
//      argument.  Handles ALL label forms: plain strings, concatenations,
//      runtime expressions.
//
// Run: node bin/obfuscate-bench.cjs

const fs   = require('fs');
const path = require('path');

const ROOT  = path.resolve(__dirname, '..');
const STUBS = path.join(ROOT, 'bin');
const TESTS = path.join(ROOT, 'benchmarks', 'debug', 'tests');

// Exported-function replacement letters (distinct from param letters)
const FN_LETTERS    = ['f', 'g', 'h', 'j', 'k', 'p', 'q', 'r'];
// Parameter replacement letters (no overlap with FN_LETTERS)
const PARAM_LETTERS = ['a', 'b', 'c', 'd', 'e', 'l', 'm', 'n', 'o', 's', 'u', 'v', 'w', 'x', 'y', 'z'];

// ── helpers ────────────────────────────────────────────────────────────────

function parseExports(src) {
  const m = src.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  if (!m) return [];
  return m[1].split(',').map(function(s) { return s.trim(); }).filter(Boolean);
}

function buildFuncMap(names) {
  var map = {};
  names.forEach(function(n, i) { if (i < FN_LETTERS.length) map[n] = FN_LETTERS[i]; });
  return map;
}

/**
 * For each exported function, extract its declared parameter names from the
 * stub source and assign the next available PARAM_LETTER to each.
 * Letters are allocated across all functions so no two params share a letter.
 */
function buildParamMap(src, funcMap) {
  var paramMap = {};
  var used     = new Set();
  var li       = 0;

  for (var origName of Object.keys(funcMap)) {
    var re = new RegExp('function\\s+' + origName + '\\s*\\(([^)]*)\\)');
    var m  = src.match(re);
    if (!m || !m[1].trim()) continue;
    var params = m[1].split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    for (var p of params) {
      while (li < PARAM_LETTERS.length && used.has(PARAM_LETTERS[li])) li++;
      if (li < PARAM_LETTERS.length) {
        paramMap[p] = PARAM_LETTERS[li];
        used.add(PARAM_LETTERS[li]);
        li++;
      }
    }
  }
  return paramMap;
}

/**
 * Replace every key in `map` with its value using word-boundary matching.
 * Longer keys first to avoid partial-match shadowing.
 */
function applyMap(src, map) {
  var out    = src;
  var sorted = Object.entries(map).sort(function(a, b) { return b[0].length - a[0].length; });
  for (var [from, to] of sorted) {
    out = out.replace(new RegExp('\\b' + from + '\\b', 'g'), to);
  }
  return out;
}

// ── assert-helper counter replacement ─────────────────────────────────────
//
// strip-bench-hints.cjs normalised every assert helper to one of two forms.
// We replace both with a counter variant that prints "FAIL t{N}" by execution
// order so no information leaks through the label argument.

var BOOL_BEFORE = [
  "function assert(label, cond) {",
  "  if (!cond) { process.stderr.write('FAIL ' + label + '\\n'); failed++; }",
  "}"
].join('\n');

var BOOL_AFTER = [
  "var _i = 0;",
  "function assert(label, cond) {",
  "  _i++;",
  "  if (!cond) { process.stderr.write('FAIL t' + _i + '\\n'); failed++; }",
  "}"
].join('\n');

var EQ_BEFORE = [
  "function assert(label, actual, expected) {",
  "  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\\n'); failed++; }",
  "}"
].join('\n');

var EQ_AFTER = [
  "var _i = 0;",
  "function assert(label, actual, expected) {",
  "  _i++;",
  "  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\\n'); failed++; }",
  "}"
].join('\n');

// ── Pass 1: stubs ──────────────────────────────────────────────────────────

var stubMaps  = {};   // basename → { funcMap, paramMap }
var stubCount = 0;

fs.readdirSync(STUBS)
  .filter(function(f) { return /^bench-buggy-.+\.cjs$/.test(f); })
  .forEach(function(f) {
    var fp      = path.join(STUBS, f);
    var src     = fs.readFileSync(fp, 'utf8');
    var exports = parseExports(src);
    if (!exports.length) return;

    var funcMap  = buildFuncMap(exports);
    var paramMap = buildParamMap(src, funcMap);

    // Params first (longer, more specific names) then function names
    var out = applyMap(src, paramMap);
    out     = applyMap(out, funcMap);

    stubMaps[f] = { funcMap, paramMap };
    if (out !== src) { fs.writeFileSync(fp, out, 'utf8'); stubCount++; }
  });

// ── Pass 2+3: tests ────────────────────────────────────────────────────────

var testCount = 0;

fs.readdirSync(TESTS)
  .filter(function(f) { return f.endsWith('.test.cjs'); })
  .forEach(function(f) {
    var fp  = path.join(TESTS, f);
    var src = fs.readFileSync(fp, 'utf8');

    // Locate the stub this test imports
    var reqRe   = /require\s*\(\s*(['"])[^'"]*\/(bench-buggy-[^'"]+\.cjs)\1\s*\)/;
    var reqMatch = src.match(reqRe);
    if (!reqMatch) return;
    var stubBase = reqMatch[2];
    var maps     = stubMaps[stubBase];
    if (!maps) return;

    var { funcMap, paramMap } = maps;

    // ── Protect the require() path string from word-boundary renaming ──
    // Swap it out for a placeholder, apply renames, then restore.
    var REQ_PLACEHOLDER = '\x00REQ\x00';
    var reqLiteral      = reqMatch[0];                          // e.g. require('../../../bin/bench-buggy-average.cjs')
    var protected_      = src.replace(reqLiteral, REQ_PLACEHOLDER);

    var out = applyMap(protected_, paramMap);
    out     = applyMap(out, funcMap);
    out     = out.replace(REQ_PLACEHOLDER, reqLiteral);        // restore exact path

    // ── Replace assert helper with execution-order counter version ──
    out = out.replace(BOOL_BEFORE, BOOL_AFTER);
    out = out.replace(EQ_BEFORE,   EQ_AFTER);

    if (out !== src) { fs.writeFileSync(fp, out, 'utf8'); testCount++; }
  });

process.stdout.write('Obfuscated stubs:      ' + stubCount + '\n');
process.stdout.write('Obfuscated test files: ' + testCount + '\n');
