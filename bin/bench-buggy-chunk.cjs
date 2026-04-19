'use strict';

function chunk(arr, n) {
  var r = [];
  for (var i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n - 1));
  return r;
}
module.exports = { chunk };
