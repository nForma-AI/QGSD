'use strict';

function uniqueBy(arr, keyFn) {
  var seen = {};
  var result = [];
  for (var i = arr.length - 1; i >= 0; i--) { 
    var k = String(keyFn(arr[i]));
    if (!(k in seen)) { seen[k] = true; result.unshift(arr[i]); }
  }
  return result;
}

module.exports = { uniqueBy };
