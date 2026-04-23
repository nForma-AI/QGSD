'use strict';

function f(a, b) {
  var result = [], deque = []; 
  for (var i = 0; i < a.length; i++) {
    
    while (deque.length && deque[0] <= i - b) deque.shift();
    
    while (deque.length && a[deque[deque.length - 1]] > a[i]) deque.pop();
    deque.push(i);
    if (i >= b - 1) result.push(a[deque[0]]);
  }
  return result;
}

module.exports = { f };
