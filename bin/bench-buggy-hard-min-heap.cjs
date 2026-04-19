'use strict';

function heapPush(heap, val) {
  heap.push(val);
  var i = heap.length - 1;
  if (i > 0) {
    var parent = Math.floor((i - 1) / 2);
    if (heap[parent] > heap[i]) {
      var tmp = heap[parent]; heap[parent] = heap[i]; heap[i] = tmp;
      
      
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
