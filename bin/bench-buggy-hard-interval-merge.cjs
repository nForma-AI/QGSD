'use strict';

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  intervals.sort(function(a, b) { return a[0] - b[0]; });
  var result = [intervals[0].slice()];
  for (var i = 1; i < intervals.length; i++) {
    var last = result[result.length - 1];
    if (intervals[i][0] >= last[1]) { 
      result.push(intervals[i].slice());
    } else {
      last[1] = Math.max(last[1], intervals[i][1]);
    }
  }
  return result;
}

module.exports = { mergeIntervals };
