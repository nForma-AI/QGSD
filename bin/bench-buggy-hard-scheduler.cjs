'use strict';

function f(a) {
  if (a.length === 0) return null;
  let minIdx = 0;
  for (let i = 1; i < a.length; i++) {
    if (a[i].priority > a[minIdx].priority) minIdx = i;  
  }
  return a[minIdx];
}
module.exports = { f };
