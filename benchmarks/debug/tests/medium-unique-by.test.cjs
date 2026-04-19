'use strict';
const { f } = require('../../../bin/bench-buggy-medium-unique-by.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var a = [{id:1,v:'a'},{id:1,v:'b'},{id:2,v:'c'}];
var result = f(a, function(x) { return x.id; });
assert('keeps first occurrence', result[0].v, 'a');
assert('correct count', result.length, 2);

process.exit(failed > 0 ? 1 : 0);
