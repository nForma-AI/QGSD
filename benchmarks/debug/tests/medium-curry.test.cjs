'use strict';
const { f } = require('../../../bin/bench-buggy-medium-curry.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var add = function(a, b, c) { return a + b + c; };
var curriedAdd = f(add);
assert('partial application', curriedAdd(1)(2)(3), 6);

process.exit(failed > 0 ? 1 : 0);
