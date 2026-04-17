---- MODULE fix ----
EXTENDS Integers, TLC
VARIABLES x, result

Init == x \in {3, 4, 5} /\ result = (x >= 4)

\* Fixed: includes if x >= 4, so x=4 is included
Next == /\ result' = (x >= 4)
        /\ UNCHANGED x

Spec == Init /\ [][Next]_<<x, result>>

ThresholdIncluded == ~(x = 4 /\ result = FALSE)

====
