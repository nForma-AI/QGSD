'use strict';

function slidingWindowMax(arr, k) {
  var result = [], deque = []; 
  for (var i = 0; i < arr.length; i++) {
    
    while (deque.length && deque[0] <= i - k) deque.shift();
    
    while (deque.length && arr[deque[deque.length - 1]] > arr[i]) deque.pop();
    deque.push(i);
    if (i >= k - 1) result.push(arr[deque[0]]);
  }
  return result;
}

module.exports = { slidingWindowMax };
