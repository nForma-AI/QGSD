'use strict';
const { partition } = require('../../../bin/bench-buggy-medium-partition.cjs');
let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) { process.stderr.write('FAIL ' + label + ': got ' + got + ', expected ' + expected + '\n'); failed++; }
}

var result = partition([1,2,3,4,5], function(x) { return x % 2 === 0; });
assert('evens in first array', JSON.stringify(result[0]), JSON.stringify([2,4]));
assert('odds in second array', JSON.stringify(result[1]), JSON.stringify([1,3,5]));

process.exit(failed > 0 ? 1 : 0);
