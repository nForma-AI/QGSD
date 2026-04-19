'use strict';
const { binarySearch } = require('../../../bin/bench-buggy-hard-binary-search.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// Single-element array: loop never runs when left === right, returns -1 instead of 0
assert('found at index 0 single element', binarySearch([1], 1), 0);
assert('found in middle', binarySearch([1, 3, 5, 7, 9], 5), 2);
assert('not found', binarySearch([1, 2, 3], 4), -1);
assert('found last', binarySearch([1, 3, 5, 7], 7), 3);

process.exit(failed > 0 ? 1 : 0);
