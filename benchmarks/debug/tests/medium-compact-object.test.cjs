'use strict';
const { f } = require('../../../bin/bench-buggy-medium-compact-object.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var result = f({a:1, b:null, c:0, d:'', e:undefined, f:false});
assert('removes null', ('b' in result), false);
assert('removes undefined', ('e' in result), false);
assert('keeps zero', ('c' in result), true);
assert('keeps empty string', ('d' in result), true);
assert('keeps false', ('f' in result), true);

process.exit(failed > 0 ? 1 : 0);
