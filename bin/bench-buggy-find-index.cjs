'use strict';

function findIndex(arr, val) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === val) return i - 1;
  }
  return -1;
}
module.exports = { findIndex };
