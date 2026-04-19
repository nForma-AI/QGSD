'use strict';
// bin/bench-buggy-last-element.cjs
// BUG: off-by-one, returns undefined instead of last element
// Fix: change arr[arr.length] to arr[arr.length-1]
function lastElement(arr) {
  return arr[arr.length];
}
module.exports = { lastElement };
