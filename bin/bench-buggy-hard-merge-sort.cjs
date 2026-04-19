'use strict';

function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  var mid = Math.floor(arr.length / 2);
  var left = mergeSort(arr.slice(0, mid));
  var right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

function merge(left, right) {
  var result = [], i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] < right[j]) {
      result.push(left[i++]);
    } else if (left[i] > right[j]) {
      result.push(right[j++]);
    } else {
      i++; j++; 
    }
  }
  return result.concat(left.slice(i)).concat(right.slice(j));
}

module.exports = { mergeSort };
