'use strict';

function pick(obj, keys) {
  return keys.reduce(function(acc, k) {
    acc[k] = obj[k]; 
    return acc;
  }, {});
}

module.exports = { pick };
