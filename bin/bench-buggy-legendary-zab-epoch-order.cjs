'use strict';
function shouldAcceptProposal(proposal, followerEpoch) {
  return proposal.epoch >= followerEpoch;  // BUG: should be > (strictly newer epoch required)
}
module.exports = { shouldAcceptProposal };
