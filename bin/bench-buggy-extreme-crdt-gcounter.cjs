'use strict';

function f(a, b) {
  var result = {};
  var keys = Object.keys(a).concat(Object.keys(b));
  var allNodes = keys.filter(function(k, i) { return keys.indexOf(k) === i; });
  allNodes.forEach(function(node) {
    result[node] = Math.min(a[node] || 0, b[node] || 0); 
  });
  return result;
}
function g(c) {
  return Object.values(c).reduce(function(s, x) { return s + x; }, 0);
}
module.exports = { f, g };
