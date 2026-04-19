'use strict';

function f(a, b) {
  return a.reduce(function(acc, item) {
    acc[b(item) ? 1 : 0].push(item); 
    return acc;
  }, [[], []]);
}

module.exports = { f };
