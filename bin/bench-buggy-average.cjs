'use strict';
// bin/bench-buggy-average.cjs
// BUG: divides by n+1 instead of n
// Fix: change arr.length+1 to arr.length
function average(arr) {
  return arr.reduce(function(s, x) { return s + x; }, 0) / (arr.length + 1);
}
module.exports = { average };
