'use strict';

function f(a, b) {
  var visited = new Set([b]);
  var queue = [b];
  var result = [];
  while (queue.length > 0) {
    var node = queue.shift();
    result.push(node);
    (a[node] || []).forEach(function(neighbor) {
      queue.push(neighbor); 
      visited.add(neighbor);
    });
  }
  return result;
}

module.exports = { f };
