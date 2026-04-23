'use strict';
const { f } = require('../../../bin/bench-buggy-medium-pick.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var result = f({a:1, b:2}, ['a', 'c']);
assert('existing key', result.a, 1);
assert('missing key absent', ('c' in result), false);

process.exit(failed > 0 ? 1 : 0);
