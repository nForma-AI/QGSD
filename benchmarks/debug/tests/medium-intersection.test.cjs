'use strict';
const { intersection } = require('../../../bin/bench-buggy-medium-intersection.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

assert('basic intersection', JSON.stringify(intersection([1,2,3],[2,3,4])), JSON.stringify([2,3]));
assert('no duplicates from a', JSON.stringify(intersection([1,1,2],[1])), JSON.stringify([1]));

process.exit(failed > 0 ? 1 : 0);
