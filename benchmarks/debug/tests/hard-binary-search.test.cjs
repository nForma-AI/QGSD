'use strict';
const { f } = require('../../../bin/bench-buggy-hard-binary-search.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Single-element array: loop never runs when left === right, returns -1 instead of 0
assert('found at index 0 single element', f([1], 1), 0);
assert('found in middle', f([1, 3, 5, 7, 9], 5), 2);
assert('not found', f([1, 2, 3], 4), -1);
assert('found last', f([1, 3, 5, 7], 7), 3);

process.exit(failed > 0 ? 1 : 0);
