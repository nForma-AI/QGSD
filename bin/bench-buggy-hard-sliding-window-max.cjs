'use strict';
// BUG: uses a min-heap (smallest at front) instead of a max-deque (largest at front)
// The deque maintenance removes elements from the back that are GREATER than the incoming
// element (instead of smaller), so the deque ends up tracking the minimum instead of maximum.
// FIX: change `arr[deque[deque.length-1]] > arr[i]` to `arr[deque[deque.length-1]] < arr[i]`

function slidingWindowMax(arr, k) {
  var result = [], deque = []; // deque stores indices
  for (var i = 0; i < arr.length; i++) {
    // Remove elements outside window
    while (deque.length && deque[0] <= i - k) deque.shift();
    // BUG: removes larger elements from back instead of smaller — tracks MIN not MAX
    while (deque.length && arr[deque[deque.length - 1]] > arr[i]) deque.pop();
    deque.push(i);
    if (i >= k - 1) result.push(arr[deque[0]]);
  }
  return result;
}

module.exports = { slidingWindowMax };
