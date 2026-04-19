'use strict';

function readSnapshot(versions, readTimestamp) {
  
  var result = null;
  for (var i = 0; i < versions.length; i++) {
    if (versions[i].commitTs < readTimestamp) { 
      result = versions[i].value;
    }
  }
  return result;
}
module.exports = { readSnapshot };
