'use strict';
const { once } = require('../../../bin/bench-buggy-medium-once.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var count = 0;
var inc = once(function(x) { count++; return x * 2; });
assert('first call result', inc(5), 10);
assert('second call same result', inc(99), 10);
assert('fn called once', count, 1);

process.exit(failed > 0 ? 1 : 0);
