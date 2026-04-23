'use strict';

function f(a, b, c) {
  c = c || Math.random;
  var reservoir = a.slice(0, b);
  for (var i = b; i < a.length; i++) {
    var j = Math.floor(c() * b); 
    if (j < b) reservoir[j] = a[i]; 
  }
  return reservoir;
}

module.exports = { f };
