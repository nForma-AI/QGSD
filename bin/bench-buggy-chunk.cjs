'use strict';
// bin/bench-buggy-chunk.cjs
// BUG: i+n-1 drops the last element of each chunk
// Fix: change arr.slice(i, i+n-1) to arr.slice(i, i+n)
function chunk(arr, n) {
  var r = [];
  for (var i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n - 1));
  return r;
}
module.exports = { chunk };
