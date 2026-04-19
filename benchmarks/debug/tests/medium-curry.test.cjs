'use strict';
const { curry } = require('../../../bin/bench-buggy-medium-curry.cjs');
let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(expected) + '\n'); failed++; }
}

var add = function(a, b, c) { return a + b + c; };
var curriedAdd = curry(add);
assert('partial application', curriedAdd(1)(2)(3), 6);

process.exit(failed > 0 ? 1 : 0);
