'use strict';

function f(a, b) {
  var inDegree = {};
  a.forEach(function(n) { inDegree[n] = 0; });
  b.forEach(function(e) { inDegree[e[1]] = (inDegree[e[1]] || 0) + 1; });
  var queue = a.filter(function(n) { return inDegree[n] === 0; });
  var result = [];
  while (queue.length > 0) {
    var node = queue.shift();
    result.push(node);
    b.filter(function(e) { return e[0] === node; }).forEach(function(e) {
      inDegree[e[1]]--;
      if (inDegree[e[1]] === 0) queue.push(e[1]);
    });
  }
  
  return result;
}

module.exports = { f };
