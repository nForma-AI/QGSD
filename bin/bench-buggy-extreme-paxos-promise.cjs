'use strict';

function shouldPromise(ballot, promisedBallot) {
  return ballot >= promisedBallot; 
}
module.exports = { shouldPromise };
