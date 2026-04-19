'use strict';
const { groupBy } = require('../../../bin/bench-buggy-medium-group-by.cjs');
let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(expected) + '\n'); failed++; }
}

var result = groupBy([1,2,3,4], function(x) { return x % 2; });
assert('group even count', result[0].length, 2);
assert('group odd count', result[1].length, 2);

process.exit(failed > 0 ? 1 : 0);
