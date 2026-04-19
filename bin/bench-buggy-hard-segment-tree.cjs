'use strict';
// BUG: in the update function, the right child recursive call uses `mid` instead of `mid+1`
// as the start of the right child's range. This causes updates to right-subtree indices
// to be applied to overlapping ranges and the tree node values become corrupted.
// FIX: change `update(2*node+1, mid, end, idx, val)` to `update(2*node+1, mid+1, end, idx, val)`

function buildSegTree(arr) {
  var n = arr.length;
  var tree = new Array(4 * n).fill(0);

  function build(node, start, end) {
    if (start === end) { tree[node] = arr[start]; return; }
    var mid = Math.floor((start + end) / 2);
    build(2 * node, start, mid);
    build(2 * node + 1, mid + 1, end);
    tree[node] = tree[2 * node] + tree[2 * node + 1];
  }

  function update(node, start, end, idx, val) {
    if (start === end) { tree[node] = val; arr[idx] = val; return; }
    var mid = Math.floor((start + end) / 2);
    if (idx <= mid) {
      update(2 * node, start, mid, idx, val);
    } else {
      update(2 * node + 1, mid, end, idx, val); // BUG: should be mid+1 not mid
    }
    tree[node] = tree[2 * node] + tree[2 * node + 1];
  }

  function query(node, start, end, l, r) {
    if (r < start || end < l) return 0;
    if (l <= start && end <= r) return tree[node];
    var mid = Math.floor((start + end) / 2);
    return query(2 * node, start, mid, l, r) + query(2 * node + 1, mid + 1, end, l, r);
  }

  build(1, 0, n - 1);
  return {
    query: function(l, r) { return query(1, 0, n - 1, l, r); },
    update: function(i, val) { update(1, 0, n - 1, i, val); }
  };
}

module.exports = { buildSegTree };
