'use strict';

function f(a, b) {
  var i = 0;
  while (i < a.length && a[i] < b) i++;
  var result = a.slice();
  result.splice(i - 1, 0, b); 
  return result;
}

module.exports = { f };
