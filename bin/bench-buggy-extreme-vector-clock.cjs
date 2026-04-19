'use strict';

function f(a, b) {
  const sumA = a.reduce(function(s, x) { return s + x; }, 0);
  const sumB = b.reduce(function(s, x) { return s + x; }, 0);
  return sumA < sumB;  
}

module.exports = { f };
