'use strict';

function insertSorted(arr, val) {
  var i = 0;
  while (i < arr.length && arr[i] < val) i++;
  var result = arr.slice();
  result.splice(i - 1, 0, val); 
  return result;
}

module.exports = { insertSorted };
