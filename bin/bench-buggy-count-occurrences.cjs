'use strict';

function countOccurrences(arr, val) {
  return arr.filter(function(x) { return x == val; }).length;
}
module.exports = { countOccurrences };
