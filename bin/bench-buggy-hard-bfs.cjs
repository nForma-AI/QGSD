'use strict';

function bfs(graph, start) {
  var visited = new Set([start]);
  var queue = [start];
  var result = [];
  while (queue.length > 0) {
    var node = queue.shift();
    result.push(node);
    (graph[node] || []).forEach(function(neighbor) {
      queue.push(neighbor); 
      visited.add(neighbor);
    });
  }
  return result;
}

module.exports = { bfs };
