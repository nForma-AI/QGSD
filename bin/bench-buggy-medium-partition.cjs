'use strict';

function partition(arr, predicate) {
  return arr.reduce(function(acc, item) {
    acc[predicate(item) ? 1 : 0].push(item); 
    return acc;
  }, [[], []]);
}

module.exports = { partition };
