'use strict';
// BUG: doesn't detect cycles — returns partial result instead of empty array
// FIX: add `if (result.length !== nodes.length) return [];` before the final return

function topoSort(nodes, edges) {
  var inDegree = {};
  nodes.forEach(function(n) { inDegree[n] = 0; });
  edges.forEach(function(e) { inDegree[e[1]] = (inDegree[e[1]] || 0) + 1; });
  var queue = nodes.filter(function(n) { return inDegree[n] === 0; });
  var result = [];
  while (queue.length > 0) {
    var node = queue.shift();
    result.push(node);
    edges.filter(function(e) { return e[0] === node; }).forEach(function(e) {
      inDegree[e[1]]--;
      if (inDegree[e[1]] === 0) queue.push(e[1]);
    });
  }
  // BUG: should return [] if result.length !== nodes.length (cycle detected)
  return result;
}

module.exports = { topoSort };
