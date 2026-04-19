'use strict';
function getCommitTimestamp(truetime) {
  return truetime.earliest;  // BUG: should be truetime.latest
}
module.exports = { getCommitTimestamp };
