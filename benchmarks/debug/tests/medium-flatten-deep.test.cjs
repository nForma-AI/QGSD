'use strict';
const { f } = require('../../../bin/bench-buggy-medium-flatten-deep.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

assert('nested 2 levels', JSON.stringify(f([1,[2,[3,4]],5])), JSON.stringify([1,2,3,4,5]));

process.exit(failed > 0 ? 1 : 0);
