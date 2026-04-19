'use strict';
// bin/bench-buggy-min-value.cjs
// BUG: > should be < (finds max instead of min)
// Fix: change arr[i]>min to arr[i]<min
function findMin(arr) {
  var min = arr[0];
  for (var i = 1; i < arr.length; i++) {
    if (arr[i] > min) min = arr[i];
  }
  return min;
}
module.exports = { findMin };
