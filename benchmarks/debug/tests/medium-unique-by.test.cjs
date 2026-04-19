'use strict';
const { uniqueBy } = require('../../../bin/bench-buggy-medium-unique-by.cjs');
let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(expected) + '\n'); failed++; }
}

var arr = [{id:1,v:'a'},{id:1,v:'b'},{id:2,v:'c'}];
var result = uniqueBy(arr, function(x) { return x.id; });
assert('keeps first occurrence', result[0].v, 'a');
assert('correct count', result.length, 2);

process.exit(failed > 0 ? 1 : 0);
