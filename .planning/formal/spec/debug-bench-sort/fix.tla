---- MODULE fix ----
EXTENDS Integers, TLC
VARIABLES a, b, swapped

Init == a \in {1, 2} /\ b \in {1, 2} /\ swapped = FALSE

\* Fixed comparator: only fires when a > b (strict)
Next == IF a > b
        THEN /\ swapped' = TRUE
             /\ a' = b
             /\ b' = a
        ELSE /\ swapped' = FALSE
             /\ UNCHANGED <<a, b>>

Spec == Init /\ [][Next]_<<a, b, swapped>>

NoUnnecessarySwap == ~(a = b /\ swapped = TRUE)

====
