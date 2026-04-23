---- MODULE bug ----
EXTENDS Integers, TLC
VARIABLES x, result

Init == x \in {3, 4, 5} /\ result = (x > 4)

\* Buggy: includes only if x > 4, so x=4 is excluded (result stays FALSE)
Next == /\ result' = (x > 4)
        /\ UNCHANGED x

Spec == Init /\ [][Next]_<<x, result>>

\* BUG: when x=4, result=FALSE — threshold value excluded
ThresholdIncluded == ~(x = 4 /\ result = FALSE)

====
