'use strict';
const { f } = require('../../../bin/bench-buggy-medium-group-by.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var result = f([1,2,3,4], function(x) { return x % 2; });
assert('group even count', result[0].length, 2);
assert('group odd count', result[1].length, 2);

process.exit(failed > 0 ? 1 : 0);
