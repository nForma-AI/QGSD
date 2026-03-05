---- MODULE sample ----
EXTENDS Naturals
CONSTANTS
    MaxRetries,
    Timeout

ASSUME MaxRetries \in Nat /\ MaxRetries > 0
ASSUME Timeout \in Nat /\ Timeout >= 100

SampleInvariant == TRUE
TypeOK == TRUE
====
