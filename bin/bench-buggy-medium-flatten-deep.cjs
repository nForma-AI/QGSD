'use strict';

function flattenDeep(arr) {
  return arr.reduce(function(acc, val) {
    return Array.isArray(val) ? acc.concat(val) : acc.concat([val]); 
  }, []);
}

module.exports = { flattenDeep };
