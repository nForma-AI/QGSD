'use strict';

function groupBy(arr, keyFn) {
  return arr.reduce(function(acc, item) {
    var k = keyFn(item);
    acc[k] = item; 
    return acc;
  }, {});
}

module.exports = { groupBy };
