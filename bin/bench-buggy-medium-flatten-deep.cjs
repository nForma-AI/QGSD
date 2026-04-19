'use strict';

function f(a) {
  return a.reduce(function(acc, val) {
    return Array.isArray(val) ? acc.concat(val) : acc.concat([val]); 
  }, []);
}

module.exports = { f };
