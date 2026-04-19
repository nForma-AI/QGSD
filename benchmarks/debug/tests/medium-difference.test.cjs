'use strict';
const { difference } = require('../../../bin/bench-buggy-medium-difference.cjs');
let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) { process.stderr.write('FAIL ' + label + ': got ' + got + ', expected ' + expected + '\n'); failed++; }
}

assert('a minus b', JSON.stringify(difference([1,2,3],[2,4])), JSON.stringify([1,3]));

process.exit(failed > 0 ? 1 : 0);
