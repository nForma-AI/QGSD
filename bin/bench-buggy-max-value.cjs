'use strict';
// bin/bench-buggy-max-value.cjs
// BUG: initial max=0 fails for all-negative arrays
// Fix: initialize max to arr[0] instead of 0
function findMax(arr) {
  let max = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}
module.exports = { findMax };
