'use strict';
// bin/bench-buggy-counter.cjs
// BUG: < hi misses upper boundary element that should be counted
// Fix: change < hi to <= hi
function buggyCounter(arr, lo, hi) {
  return arr.filter(function(x) { return x >= lo && x < hi; }).length;
}
module.exports = { buggyCounter };
