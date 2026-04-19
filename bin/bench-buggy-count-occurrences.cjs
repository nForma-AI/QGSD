'use strict';
// bin/bench-buggy-count-occurrences.cjs
// BUG: == coercion counts '1' as same as 1
// Fix: change x==val to x===val
function countOccurrences(arr, val) {
  return arr.filter(function(x) { return x == val; }).length;
}
module.exports = { countOccurrences };
