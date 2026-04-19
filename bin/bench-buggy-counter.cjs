'use strict';

function buggyCounter(arr, lo, hi) {
  return arr.filter(function(x) { return x >= lo && x < hi; }).length;
}
module.exports = { buggyCounter };
