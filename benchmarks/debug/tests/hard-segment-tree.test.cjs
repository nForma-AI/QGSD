'use strict';
const { buildSegTree } = require('../../../bin/bench-buggy-hard-segment-tree.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) {
    process.stderr.write('FAIL ' + label + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual) + '\n');
    failed++;
  }
}

var st = buildSegTree([1, 3, 5, 7, 9]);
assert('initial full range sum', st.query(0, 4), 25);
assert('partial range sum', st.query(1, 3), 15);

// Update index 1 from 3 to 10 (change 3 → 10, total should go from 25 to 32)
st.update(1, 10);
assert('updated full range sum', st.query(0, 4), 32); // buggy: wrong update propagation
assert('single element after update', st.query(1, 1), 10);

// Update a right-subtree index to expose the mid vs mid+1 bug
var st2 = buildSegTree([2, 4, 6, 8]);
assert('initial sum st2', st2.query(0, 3), 20);
st2.update(3, 1); // update rightmost element: 8 -> 1, total 20-8+1=13
assert('right subtree update', st2.query(0, 3), 13);
assert('right subtree single', st2.query(3, 3), 1);

process.exit(failed > 0 ? 1 : 0);
