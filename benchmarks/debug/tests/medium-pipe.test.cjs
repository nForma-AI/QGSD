'use strict';
const { f } = require('../../../bin/bench-buggy-medium-pipe.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var add1 = function(x) { return x + 1; };
var double = function(x) { return x * 2; };
var addThenDouble = f(add1, double); // should be (x+1)*2
assert('f order', addThenDouble(3), 8);

process.exit(failed > 0 ? 1 : 0);
