'use strict';

function f(a, b) {
  var seen = {};
  var result = [];
  for (var i = a.length - 1; i >= 0; i--) { 
    var k = String(b(a[i]));
    if (!(k in seen)) { seen[k] = true; result.unshift(a[i]); }
  }
  return result;
}

module.exports = { f };
