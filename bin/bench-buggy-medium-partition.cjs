'use strict';

function partition(arr, predicate) {
  return arr.reduce(function(acc, item) {
    acc[predicate(item) ? 1 : 0].push(item); // BUG: swapped — truthy goes to [1] instead of [0]
    return acc;
  }, [[], []]);
}

module.exports = { partition };
