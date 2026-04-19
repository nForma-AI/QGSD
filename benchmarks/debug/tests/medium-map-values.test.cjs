'use strict';
const { f } = require('../../../bin/bench-buggy-medium-map-values.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var result = f({a:1, b:2}, function(v) { return v * 2; });
assert('returns object not array', typeof result, 'object');
assert('not array', Array.isArray(result), false);
assert('a doubled', result.a, 2);
assert('b doubled', result.b, 4);

process.exit(failed > 0 ? 1 : 0);
