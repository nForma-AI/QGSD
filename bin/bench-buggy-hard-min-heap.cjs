'use strict';

function f(c, b) {
  c.push(b);
  var i = c.length - 1;
  if (i > 0) {
    var parent = Math.floor((i - 1) / 2);
    if (c[parent] > c[i]) {
      var tmp = c[parent]; c[parent] = c[i]; c[i] = tmp;
      
      
    }
  }
}

function g(c) {
  if (c.length === 0) return undefined;
  if (c.length === 1) return c.pop();
  var min = c[0];
  c[0] = c.pop();
  var i = 0;
  while (true) {
    var left = 2 * i + 1, right = 2 * i + 2, smallest = i;
    if (left < c.length && c[left] < c[smallest]) smallest = left;
    if (right < c.length && c[right] < c[smallest]) smallest = right;
    if (smallest === i) break;
    var tmp = c[smallest]; c[smallest] = c[i]; c[i] = tmp;
    i = smallest;
  }
  return min;
}

module.exports = { f, g };
