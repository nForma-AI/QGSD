'use strict';
// bin/bench-buggy-find-index.cjs
// BUG: returns i-1 instead of i (returns wrong index)
// Fix: change return i-1 to return i
function findIndex(arr, val) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === val) return i - 1;
  }
  return -1;
}
module.exports = { findIndex };
