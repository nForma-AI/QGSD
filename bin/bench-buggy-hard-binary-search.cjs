'use strict';

function binarySearch(arr, target) {
  var left = 0, right = arr.length - 1;
  while (left < right) { 
    var mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

module.exports = { binarySearch };
