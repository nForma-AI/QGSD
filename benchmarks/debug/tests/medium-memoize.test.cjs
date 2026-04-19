'use strict';
const { memoize } = require('../../../bin/bench-buggy-medium-memoize.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var add = function(a, b) { return a + b; };
var mAdd = memoize(add);
mAdd(1, 2);
assert('multi-arg cache miss', mAdd(1, 3), 4);

process.exit(failed > 0 ? 1 : 0);
