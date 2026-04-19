'use strict';
// BUG: uses while (left < right) instead of while (left <= right)
// This causes misses when target is the only remaining element (left === right)
// FIX: change `while (left < right)` to `while (left <= right)`

function binarySearch(arr, target) {
  var left = 0, right = arr.length - 1;
  while (left < right) { // BUG: should be left <= right
    var mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

module.exports = { binarySearch };
