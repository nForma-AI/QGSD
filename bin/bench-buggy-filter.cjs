'use strict';
// bin/bench-buggy-filter.cjs
// BUG: > threshold excludes threshold value that should be included
// Fix: change > to >=
function buggyFilter(arr, threshold) {
  return arr.filter(function(x) { return x > threshold; });
}
module.exports = { buggyFilter };
