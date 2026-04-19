'use strict';

function merge(counterA, counterB) {
  var result = {};
  var keys = Object.keys(counterA).concat(Object.keys(counterB));
  var allNodes = keys.filter(function(k, i) { return keys.indexOf(k) === i; });
  allNodes.forEach(function(node) {
    result[node] = Math.min(counterA[node] || 0, counterB[node] || 0); 
  });
  return result;
}
function value(counter) {
  return Object.values(counter).reduce(function(s, x) { return s + x; }, 0);
}
module.exports = { merge, value };
