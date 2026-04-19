'use strict';

function canReclaim(readerEpochs, reclaimEpoch) {
  return readerEpochs.every(function(e) { return e <= reclaimEpoch; }); 
}
module.exports = { canReclaim };
