---- MODULE fix ----
EXTENDS Integers, TLC
VARIABLES x, counted

CONSTANTS Lo, Hi

Init == x \in {1, 2, 3} /\ counted = (x >= Lo /\ x <= Hi)

\* Fixed: x <= Hi includes the upper boundary
Next == /\ counted' = (x >= Lo /\ x <= Hi)
        /\ UNCHANGED x

Spec == Init /\ [][Next]_<<x, counted>>

BoundaryIncluded == ~(x = Hi /\ counted = FALSE)

====
