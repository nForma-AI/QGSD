'use strict';

function f(a) {
  if (a.length <= 1) return a;
  var mid = Math.floor(a.length / 2);
  var left = f(a.slice(0, mid));
  var right = f(a.slice(mid));
  return merge(left, right);
}

function merge(left, right) {
  var result = [], i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] < right[j]) {
      result.push(left[i++]);
    } else if (left[i] > right[j]) {
      result.push(right[j++]);
    } else {
      i++; j++; 
    }
  }
  return result.concat(left.slice(i)).concat(right.slice(j));
}

module.exports = { f };
