'use strict';
// BUG: find() returns parent[x] after path compression instead of x (the confirmed root)
// When parent[x] === x (root found), `parent[x]` equals x, so this looks correct at first glance.
// The real bug: when the while loop exits because parent[x] === x, returning parent[x] is fine —
// BUT the path compression is missing entirely (no compression), so find() traverses the full chain
// every call, AND the union() is passed un-compressed node indices by mistake:
//
// ACTUAL BUG: union() calls find() but then sets parent[x] = ry instead of parent[rx] = ry
// So it attaches the original node (not its root) to the other component's root.
// This breaks subsequent find() calls because x's chain now points to ry, while rx remains
// as a separate root — so find(x) may return ry while find(rx) returns rx.
//
// FIX: change `parent[x] = ry` to `parent[rx] = ry` (and similarly for the other branch)

function makeUnionFind(n) {
  var parent = [], rank = [];
  for (var i = 0; i < n; i++) { parent[i] = i; rank[i] = 0; }

  function find(x) {
    while (parent[x] !== x) x = parent[x];
    return x;
  }

  function union(x, y) {
    var rx = find(x), ry = find(y);
    if (rx === ry) return false;
    if (rank[rx] < rank[ry]) {
      parent[x] = ry; // BUG: should be parent[rx] = ry
    } else if (rank[rx] > rank[ry]) {
      parent[y] = rx; // BUG: should be parent[ry] = rx
    } else {
      parent[y] = rx; // BUG: should be parent[ry] = rx
      rank[rx]++;
    }
    return true;
  }

  return { find: find, union: union };
}

module.exports = { makeUnionFind };
