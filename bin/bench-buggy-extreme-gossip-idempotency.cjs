'use strict';

function mergeState(local, remote) {
  var result = Object.assign({}, local);
  Object.keys(remote).forEach(function(k) {
    result[k] = (result[k] || 0) + remote[k]; 
  });
  return result;
}
module.exports = { mergeState };
