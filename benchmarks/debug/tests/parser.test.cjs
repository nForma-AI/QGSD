'use strict';
// benchmarks/debug/tests/parser.test.cjs
// This test FAILS against the buggy stub. Fix: remove -1 from slice end.
const { buggyTokenize } = require('../../../bin/bench-buggy-hard-parser.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('two tokens', buggyTokenize('hello world'), ['hello', 'world']);
assert('three tokens', buggyTokenize('foo bar baz'), ['foo', 'bar', 'baz']);
assert('single token', buggyTokenize('abc'), ['abc']);
process.exit(failed > 0 ? 1 : 0);
