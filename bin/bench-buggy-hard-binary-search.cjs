'use strict';

function f(a, b) {
  var left = 0, right = a.length - 1;
  while (left < right) { 
    var mid = Math.floor((left + right) / 2);
    if (a[mid] === b) return mid;
    if (a[mid] < b) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

module.exports = { f };
