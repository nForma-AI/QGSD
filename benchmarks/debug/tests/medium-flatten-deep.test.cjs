'use strict';
const { flattenDeep } = require('../../../bin/bench-buggy-medium-flatten-deep.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

assert('nested 2 levels', JSON.stringify(flattenDeep([1,[2,[3,4]],5])), JSON.stringify([1,2,3,4,5]));

process.exit(failed > 0 ? 1 : 0);
