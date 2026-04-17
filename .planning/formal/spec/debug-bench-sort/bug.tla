---- MODULE bug ----
EXTENDS Integers, TLC
VARIABLES a, b, swapped

Init == a \in {1, 2} /\ b \in {1, 2} /\ swapped = FALSE

\* Buggy comparator: fires when a >= b (includes equal)
Next == IF a >= b
        THEN /\ swapped' = TRUE
             /\ a' = b
             /\ b' = a
        ELSE /\ swapped' = FALSE
             /\ UNCHANGED <<a, b>>

Spec == Init /\ [][Next]_<<a, b, swapped>>

\* BUG: this invariant is violated because a=b=1 causes a swap
NoUnnecessarySwap == ~(a = b /\ swapped = TRUE)

====
