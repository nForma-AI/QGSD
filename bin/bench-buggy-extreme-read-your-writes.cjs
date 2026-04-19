'use strict';
// Session consistency — Read Your Writes:
// A read at timestamp readTs satisfies RYW if readTs >= sessionWriteTs.
// Invariant: a client reading at the exact moment it wrote (readTs === sessionWriteTs)
// must see its own write.
// Bug: uses strict greater-than (>) instead of >= — misses the case where the read
// happens at precisely the write timestamp.
function satisfiesReadYourWrites(readTimestamp, sessionWriteTimestamp) {
  return readTimestamp > sessionWriteTimestamp; // BUG: should be >=
}
module.exports = { satisfiesReadYourWrites };
