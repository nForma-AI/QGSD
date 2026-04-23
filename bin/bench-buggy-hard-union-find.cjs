'use strict';

function f(a) {
  var parent = [], rank = [];
  for (var i = 0; i < a; i++) { parent[i] = i; rank[i] = 0; }

  function find(x) {
    while (parent[x] !== x) x = parent[x];
    return x;
  }

  function union(x, y) {
    var rx = find(x), ry = find(y);
    if (rx === ry) return false;
    if (rank[rx] < rank[ry]) {
      parent[x] = ry; 
    } else if (rank[rx] > rank[ry]) {
      parent[y] = rx; 
    } else {
      parent[y] = rx; 
      rank[rx]++;
    }
    return true;
  }

  return { find: find, union: union };
}

module.exports = { f };
