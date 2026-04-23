'use strict';

function f(a, b) {
  return a.reduce(function(acc, item) {
    var k = b(item);
    acc[k] = item; 
    return acc;
  }, {});
}

module.exports = { f };
