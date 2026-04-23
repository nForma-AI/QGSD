'use strict';
const { f } = require('../../../bin/bench-buggy-medium-zip.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var result = f([1,2,3],[4,5]);
assert('zips to shorter length', result.length, 2);
assert('no undefined', result.every(function(p) { return p[0] !== undefined && p[1] !== undefined; }), true);

process.exit(failed > 0 ? 1 : 0);
