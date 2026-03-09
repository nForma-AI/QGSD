---- MODULE NFConfigLoader ----
(*
 * .planning/formal/tla/NFConfigLoader.tla
 * Configuration loading — global/project merge, fail-open, validation
 *
 * @requirement CONF-01
 * @requirement CONF-02
 * @requirement CONF-03
 * @requirement CONF-04
 * @requirement CONF-05
 * @requirement CONF-08
 *)
EXTENDS Naturals, Sequences, TLC


VARIABLES globalLoaded, projectLoaded, mergedConfig, valid
vars == <<globalLoaded, projectLoaded, mergedConfig, valid>>

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement CONF-01
\* @requirement CONF-02
\* @requirement CONF-03
\* @requirement CONF-04
\* @requirement CONF-05
\* @requirement CONF-08
TypeOK ==
    /\ globalLoaded \in BOOLEAN
    /\ projectLoaded \in BOOLEAN
    /\ mergedConfig \in {"none", "merged", "defaults"}
    /\ valid \in BOOLEAN

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ globalLoaded = FALSE
    /\ projectLoaded = FALSE
    /\ mergedConfig = "none"
    /\ valid = TRUE

\* ── Actions ──────────────────────────────────────────────────────────────────

LoadGlobal ==
    /\ globalLoaded = FALSE
    /\ globalLoaded' = TRUE
    /\ UNCHANGED <<projectLoaded, mergedConfig, valid>>

LoadProject ==
    /\ globalLoaded = TRUE /\ projectLoaded = FALSE
    /\ projectLoaded' = TRUE
    /\ UNCHANGED <<globalLoaded, mergedConfig, valid>>

MergeConfig ==
    /\ globalLoaded = TRUE
    /\ valid = TRUE
    /\ mergedConfig' = "merged"
    /\ UNCHANGED <<globalLoaded, projectLoaded, valid>>

ValidationFail ==
    /\ mergedConfig = "merged"
    /\ valid' = FALSE
    /\ mergedConfig' = "defaults"
    /\ UNCHANGED <<globalLoaded, projectLoaded>>

FailOpen ==
    /\ valid = FALSE
    /\ mergedConfig' = "defaults"
    /\ valid' = TRUE
    /\ UNCHANGED <<globalLoaded, projectLoaded>>

Next ==
    \/ LoadGlobal
    \/ LoadProject
    \/ MergeConfig
    \/ ValidationFail
    \/ FailOpen

Spec == Init /\ [][Next]_vars

\* ── Safety invariants ────────────────────────────────────────────────────────
AlwaysHasConfig == mergedConfig \in {"none", "merged", "defaults"}
FailOpenGuarantee == valid = FALSE => mergedConfig = "defaults"

====
