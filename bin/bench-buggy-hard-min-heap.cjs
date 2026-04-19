'use strict';
// BUG: heapPush does not sift UP after inserting — it only swaps once with parent
// instead of looping until the heap property is restored.
// This means after inserting a very small value deep in the heap, it only moves up one level,
// leaving the heap property violated.
// FIX: change the condition to a proper while loop that continues until parent <= child

function heapPush(heap, val) {
  heap.push(val);
  var i = heap.length - 1;
  if (i > 0) {
    var parent = Math.floor((i - 1) / 2);
    if (heap[parent] > heap[i]) {
      var tmp = heap[parent]; heap[parent] = heap[i]; heap[i] = tmp;
      // BUG: stops after one swap — does not continue sifting up
      // The loop should continue: i = parent; and repeat until i === 0 or parent <= child
    }
  }
}

function heapPop(heap) {
  if (heap.length === 0) return undefined;
  if (heap.length === 1) return heap.pop();
  var min = heap[0];
  heap[0] = heap.pop();
  var i = 0;
  while (true) {
    var left = 2 * i + 1, right = 2 * i + 2, smallest = i;
    if (left < heap.length && heap[left] < heap[smallest]) smallest = left;
    if (right < heap.length && heap[right] < heap[smallest]) smallest = right;
    if (smallest === i) break;
    var tmp = heap[smallest]; heap[smallest] = heap[i]; heap[i] = tmp;
    i = smallest;
  }
  return min;
}

module.exports = { heapPush, heapPop };
