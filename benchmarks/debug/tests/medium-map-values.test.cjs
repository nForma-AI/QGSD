'use strict';
const { mapValues } = require('../../../bin/bench-buggy-medium-map-values.cjs');
let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(expected) + '\n'); failed++; }
}

var result = mapValues({a:1, b:2}, function(v) { return v * 2; });
assert('returns object not array', typeof result, 'object');
assert('not array', Array.isArray(result), false);
assert('a doubled', result.a, 2);
assert('b doubled', result.b, 4);

process.exit(failed > 0 ? 1 : 0);
