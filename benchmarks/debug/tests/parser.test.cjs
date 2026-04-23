'use strict';
// benchmarks/debug/tests/parser.test.cjs
// This test FAILS against the buggy stub. Fix: remove -1 from slice end.
const { f } = require('../../../bin/bench-buggy-hard-parser.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('two tokens', f('hello world'), ['hello', 'world']);
assert('three tokens', f('foo bar baz'), ['foo', 'bar', 'baz']);
assert('single token', f('abc'), ['abc']);
process.exit(failed > 0 ? 1 : 0);
