---- MODULE BugModelLookup ----
(*
 * .planning/formal/tla/BugModelLookup.tla
 * Models the bug-to-model lookup pipeline: scan affected files,
 * find matching formal models, run model checkers, report reproduction status.
 * Source: bin/formal-scope-scan.cjs, bin/bug-model-gaps.json
 *
 * @requirement BML-01
 * @requirement BML-02
 * @requirement BML-03
 *)
EXTENDS Naturals, Sequences, TLC

CONSTANTS MaxModels, MaxTimeout

VARIABLES phase, modelsFound, checksRun, checksCompleted,
          reproductionStatus, gapsTracked

vars == <<phase, modelsFound, checksRun, checksCompleted,
          reproductionStatus, gapsTracked>>

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement BML-01
TypeOK ==
    /\ phase \in {"idle", "scanning", "matching", "checking", "reporting", "done"}
    /\ modelsFound \in 0..MaxModels
    /\ checksRun \in 0..MaxModels
    /\ checksCompleted \in 0..MaxModels
    /\ reproductionStatus \in {"unknown", "no_coverage", "no_reproduction", "reproduced"}
    /\ gapsTracked \in BOOLEAN

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ phase = "idle"
    /\ modelsFound = 0
    /\ checksRun = 0
    /\ checksCompleted = 0
    /\ reproductionStatus = "unknown"
    /\ gapsTracked = FALSE

\* ── Actions ──────────────────────────────────────────────────────────────────

\* BML-01: --bug-mode flag triggers scan for formal models covering affected files
StartScan ==
    /\ phase = "idle"
    /\ phase' = "scanning"
    /\ UNCHANGED <<modelsFound, checksRun, checksCompleted, reproductionStatus, gapsTracked>>

\* BML-01: scan finds model paths for affected code files
FindModels ==
    /\ phase = "scanning"
    /\ phase' = "matching"
    /\ modelsFound' \in 0..MaxModels
    /\ UNCHANGED <<checksRun, checksCompleted, reproductionStatus, gapsTracked>>

\* BML-02: Run matched model checkers (max 3, 60s timeout)
RunCheckers ==
    /\ phase = "matching"
    /\ modelsFound > 0
    /\ phase' = "checking"
    /\ checksRun' = IF modelsFound > 3 THEN 3 ELSE modelsFound
    /\ UNCHANGED <<modelsFound, checksCompleted, reproductionStatus, gapsTracked>>

\* No models found - skip to reporting
NoModelsFound ==
    /\ phase = "matching"
    /\ modelsFound = 0
    /\ phase' = "reporting"
    /\ reproductionStatus' = "no_coverage"
    /\ UNCHANGED <<modelsFound, checksRun, checksCompleted, gapsTracked>>

\* BML-02: Checkers complete with pass/fail/timeout status
CheckersComplete ==
    /\ phase = "checking"
    /\ checksCompleted' = checksRun
    /\ phase' = "reporting"
    /\ reproductionStatus' \in {"no_reproduction", "reproduced"}
    /\ UNCHANGED <<modelsFound, checksRun, gapsTracked>>

\* BML-03: bug-model-gaps.json tracks coverage status and persists
ReportAndTrack ==
    /\ phase = "reporting"
    /\ phase' = "done"
    /\ gapsTracked' = TRUE
    /\ UNCHANGED <<modelsFound, checksRun, checksCompleted, reproductionStatus>>

Next ==
    \/ StartScan
    \/ FindModels
    \/ RunCheckers
    \/ NoModelsFound
    \/ CheckersComplete
    \/ ReportAndTrack

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* ── Safety invariants ────────────────────────────────────────────────────────

\* BML-02: Never run more than 3 checkers
MaxThreeCheckers == checksRun <= 3

\* BML-02: Checks completed never exceeds checks run
ChecksConsistent == checksCompleted <= checksRun

\* BML-03: When done, gaps are always tracked
\* @requirement BML-03
DoneImpliesTracked == phase = "done" => gapsTracked = TRUE

\* BML-01: Reproduction status determined only after scanning
NoStatusBeforeScan == phase \in {"idle", "scanning"} => reproductionStatus = "unknown"

\* ── Liveness ─────────────────────────────────────────────────────────────────
EventuallyDone == <>(phase = "done")

====
