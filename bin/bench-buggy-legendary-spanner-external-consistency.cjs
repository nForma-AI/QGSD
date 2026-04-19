'use strict';
function getCommitTimestamp(truetime) {
  return truetime.earliest;  
}
module.exports = { getCommitTimestamp };
