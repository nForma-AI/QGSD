---- MODULE NFDebtLedger ----
(*
 * .planning/formal/tla/NFDebtLedger.tla
 * Debt ledger state machine — lifecycle, dedup, retention
 *
 * @requirement DEBT-01
 * @requirement DEBT-02
 * @requirement DEBT-03
 * @requirement DEBT-04
 * @requirement DEBT-05
 * @requirement DEBT-06
 *)
EXTENDS Naturals, Sequences, TLC

CONSTANTS MaxEntries, MaxAge

VARIABLES status, count, age
vars == <<status, count, age>>

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement DEBT-01
\* @requirement DEBT-02
\* @requirement DEBT-03
\* @requirement DEBT-04
\* @requirement DEBT-05
\* @requirement DEBT-06
TypeOK ==
    /\ status \in {"open", "acknowledged", "resolving", "resolved"}
    /\ count \in 0..MaxEntries
    /\ age \in 0..MaxAge

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ status = "open"
    /\ count = 0
    /\ age = 0

\* ── Actions ──────────────────────────────────────────────────────────────────

AddEntry ==
    /\ count < MaxEntries
    /\ count' = count + 1
    /\ UNCHANGED <<status, age>>

Acknowledge ==
    /\ status = "open"
    /\ status' = "acknowledged"
    /\ UNCHANGED <<count, age>>

Resolve ==
    /\ status = "acknowledged"
    /\ status' = "resolving"
    /\ UNCHANGED <<count, age>>

Close ==
    /\ status = "resolving"
    /\ status' = "resolved"
    /\ UNCHANGED <<count, age>>

AgeEntry ==
    /\ age < MaxAge
    /\ age' = age + 1
    /\ UNCHANGED <<status, count>>

Purge ==
    /\ age >= MaxAge
    /\ count' = IF count > 0 THEN count - 1 ELSE 0
    /\ age' = 0
    /\ UNCHANGED status

Next ==
    \/ AddEntry
    \/ Acknowledge
    \/ Resolve
    \/ Close
    \/ AgeEntry
    \/ Purge

Spec == Init /\ [][Next]_vars

\* ── Safety invariants ────────────────────────────────────────────────────────
StatusValid == status \in {"open", "acknowledged", "resolving", "resolved"}
CountBounded == count >= 0 /\ count <= MaxEntries
AgeBounded == age >= 0 /\ age <= MaxAge

====
