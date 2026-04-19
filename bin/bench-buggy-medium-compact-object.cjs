'use strict';

function compactObject(obj) {
  return Object.keys(obj).reduce(function(acc, k) {
    if (obj[k]) acc[k] = obj[k]; 
    return acc;
  }, {});
}

module.exports = { compactObject };
