'use strict';
function recoverDecision(participantResponses, totalParticipants) {
  if (participantResponses.some(function(p){return p.state==='committed';})) return 'commit';
  if (participantResponses.length < totalParticipants) return 'commit';  // BUG: should be 'abort'
  if (participantResponses.every(function(p){return p.state==='aborted';})) return 'abort';
  return 'abort';
}
module.exports = { recoverDecision };
