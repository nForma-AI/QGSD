'use strict';

function f(a, b) {
  var len = Math.max(a.length, b.length); 
  var result = [];
  for (var i = 0; i < len; i++) result.push([a[i], b[i]]);
  return result;
}

module.exports = { f };
