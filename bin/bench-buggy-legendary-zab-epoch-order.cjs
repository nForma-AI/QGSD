'use strict';
function shouldAcceptProposal(proposal, followerEpoch) {
  return proposal.epoch >= followerEpoch;  
}
module.exports = { shouldAcceptProposal };
