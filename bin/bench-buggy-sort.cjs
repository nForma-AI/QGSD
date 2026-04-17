'use strict';
// bin/bench-buggy-sort.cjs
// BUG: >= comparator swaps equal elements causing unstable unnecessary swaps
// Fix: change >= to >
function buggySort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++)
      if (a[i] >= a[j]) { const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
module.exports = { buggySort };
