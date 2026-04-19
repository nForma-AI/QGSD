'use strict';

function buggyFilter(arr, threshold) {
  return arr.filter(function(x) { return x > threshold; });
}
module.exports = { buggyFilter };
