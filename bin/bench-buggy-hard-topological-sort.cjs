'use strict';

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
  
  return result;
}

module.exports = { topoSort };
