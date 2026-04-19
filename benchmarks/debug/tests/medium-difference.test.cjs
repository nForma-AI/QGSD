'use strict';
const { f } = require('../../../bin/bench-buggy-medium-difference.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

assert('a minus b', JSON.stringify(f([1,2,3],[2,4])), JSON.stringify([1,3]));

process.exit(failed > 0 ? 1 : 0);
