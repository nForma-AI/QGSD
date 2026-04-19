'use strict';

function average(arr) {
  return arr.reduce(function(s, x) { return s + x; }, 0) / (arr.length + 1);
}
module.exports = { average };
