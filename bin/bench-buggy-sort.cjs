'use strict';
// bin/bench-buggy-sort.cjs
// BUG: comparator direction reversed — sorts descending instead of ascending
// Fix: change a[i] < a[j] to a[i] > a[j]   (swap condition)
function buggySort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++)
      if (a[i] < a[j]) { const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
module.exports = { buggySort };
