'use strict';
function selectProposalValue(phase1Responses, ownValue) {
  var withValues = phase1Responses.filter(function(r){return r.value !== null;});
  if (!withValues.length) return ownValue;
  withValues.sort(function(a,b){return a.ballot - b.ballot;});
  return withValues[0].value;  // BUG: should be withValues[withValues.length-1].value
}
module.exports = { selectProposalValue };
