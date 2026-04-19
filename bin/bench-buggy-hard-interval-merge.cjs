'use strict';
// BUG: uses >= instead of > to check for non-overlap, so touching intervals are not merged
// FIX: change `if (intervals[i][0] >= last[1])` to `if (intervals[i][0] > last[1])`

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  intervals.sort(function(a, b) { return a[0] - b[0]; });
  var result = [intervals[0].slice()];
  for (var i = 1; i < intervals.length; i++) {
    var last = result[result.length - 1];
    if (intervals[i][0] >= last[1]) { // BUG: >= should be > (touching intervals [1,3],[3,5] should merge)
      result.push(intervals[i].slice());
    } else {
      last[1] = Math.max(last[1], intervals[i][1]);
    }
  }
  return result;
}

module.exports = { mergeIntervals };
