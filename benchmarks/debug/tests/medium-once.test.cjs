'use strict';
const { f } = require('../../../bin/bench-buggy-medium-once.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var count = 0;
var inc = f(function(x) { count++; return x * 2; });
assert('first call result', inc(5), 10);
assert('second call same result', inc(99), 10);
assert('a called f', count, 1);

process.exit(failed > 0 ? 1 : 0);
