'use strict';
// bin/bench-buggy-sum-array.cjs
// BUG: starts accumulator at 1 instead of 0
// Fix: change initial value from 1 to 0
function sumArray(arr) {
  return arr.reduce(function(s, x) { return s + x; }, 1);
}
module.exports = { sumArray };
