---- MODULE bug ----
EXTENDS Integers, TLC
VARIABLES x, counted

CONSTANTS Lo, Hi

Init == x \in {1, 2, 3} /\ counted = FALSE

\* Buggy: x < Hi excludes the upper boundary element
Next == /\ counted' = (x >= Lo /\ x < Hi)
        /\ UNCHANGED x

Spec == Init /\ [][Next]_<<x, counted>>

\* BUG: x=Hi is not counted
BoundaryIncluded == ~(x = Hi /\ counted = FALSE)

====
