'use strict';
const { pipe } = require('../../../bin/bench-buggy-medium-pipe.cjs');
let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(expected) + '\n'); failed++; }
}

var add1 = function(x) { return x + 1; };
var double = function(x) { return x * 2; };
var addThenDouble = pipe(add1, double); // should be (x+1)*2
assert('pipe order', addThenDouble(3), 8);

process.exit(failed > 0 ? 1 : 0);
