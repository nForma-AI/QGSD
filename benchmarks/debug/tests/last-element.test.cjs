'use strict';
const { f } = require('../../../bin/bench-buggy-last-element.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('three items', f([1, 2, 3]) === 3, 'got ' + f([1, 2, 3]));
assert('single item', f([42]) === 42, 'got ' + f([42]));
process.exit(failed > 0 ? 1 : 0);
