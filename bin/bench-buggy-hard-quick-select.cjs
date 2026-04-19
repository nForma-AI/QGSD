'use strict';
// BUG: calls select with k+1 instead of k, returning the (k+1)th smallest element
// instead of the kth smallest (0-indexed)
// FIX: change `select(0, arr.length - 1, k + 1)` to `select(0, arr.length - 1, k)`

function quickSelect(arr, k) {
  arr = arr.slice();

  function partition(lo, hi) {
    var pivot = arr[hi], i = lo;
    for (var j = lo; j < hi; j++) {
      if (arr[j] <= pivot) {
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        i++;
      }
    }
    var t = arr[i]; arr[i] = arr[hi]; arr[hi] = t;
    return i;
  }

  function select(lo, hi, k) {
    if (lo >= hi) return arr[lo];
    var p = partition(lo, hi);
    if (p === k) return arr[p];
    if (p < k) return select(p + 1, hi, k);
    return select(lo, p - 1, k);
  }

  return select(0, arr.length - 1, k + 1); // BUG: k+1 instead of k
}

module.exports = { quickSelect };
