'use strict';

function f(a, b) {
  a = a.slice();

  function partition(lo, hi) {
    var pivot = a[hi], i = lo;
    for (var j = lo; j < hi; j++) {
      if (a[j] <= pivot) {
        var t = a[i]; a[i] = a[j]; a[j] = t;
        i++;
      }
    }
    var t = a[i]; a[i] = a[hi]; a[hi] = t;
    return i;
  }

  function select(lo, hi, b) {
    if (lo >= hi) return a[lo];
    var p = partition(lo, hi);
    if (p === b) return a[p];
    if (p < b) return select(p + 1, hi, b);
    return select(lo, p - 1, b);
  }

  return select(0, a.length - 1, b + 1); 
}

module.exports = { f };
