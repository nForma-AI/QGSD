---- MODULE TaskClassification ----
(*
 * .planning/formal/tla/TaskClassification.tla
 * Models the task classification and routing pipeline:
 * Haiku subagent classifies task type, then routes to appropriate pipeline.
 * Source: commands/nf/quick.md (Step 2.7), scope-contract.json
 *
 * @requirement ROUTE-01
 * @requirement ROUTE-02
 * @requirement ROUTE-03
 * @requirement ROUTE-04
 *)
EXTENDS Naturals, TLC

VARIABLES phase, taskType, routedTo, classificationStored

vars == <<phase, taskType, routedTo, classificationStored>>

TaskTypes == {"unclassified", "bug_fix", "feature", "refactor"}
Pipelines == {"none", "debug", "normal"}

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement ROUTE-01
TypeOK ==
    /\ phase \in {"pending", "classifying", "classified", "routing", "routed"}
    /\ taskType \in TaskTypes
    /\ routedTo \in Pipelines
    /\ classificationStored \in BOOLEAN

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ phase = "pending"
    /\ taskType = "unclassified"
    /\ routedTo = "none"
    /\ classificationStored = FALSE

\* ── Actions ──────────────────────────────────────────────────────────────────

\* ROUTE-01: Haiku subagent classifies task
ClassifyTask ==
    /\ phase = "pending"
    /\ phase' = "classifying"
    /\ UNCHANGED <<taskType, routedTo, classificationStored>>

\* ROUTE-01: Classification result determined
ClassificationComplete ==
    /\ phase = "classifying"
    /\ taskType' \in {"bug_fix", "feature", "refactor"}
    /\ phase' = "classified"
    /\ UNCHANGED <<routedTo, classificationStored>>

\* ROUTE-04: Store classification in scope-contract.json
StoreClassification ==
    /\ phase = "classified"
    /\ classificationStored' = TRUE
    /\ phase' = "routing"
    /\ UNCHANGED <<taskType, routedTo>>

\* ROUTE-02: Bug fix tasks route through /nf:debug pipeline
RouteBugFix ==
    /\ phase = "routing"
    /\ taskType = "bug_fix"
    /\ routedTo' = "debug"
    /\ phase' = "routed"
    /\ UNCHANGED <<taskType, classificationStored>>

\* ROUTE-03: Feature/refactor tasks proceed to normal execution
RouteNormal ==
    /\ phase = "routing"
    /\ taskType \in {"feature", "refactor"}
    /\ routedTo' = "normal"
    /\ phase' = "routed"
    /\ UNCHANGED <<taskType, classificationStored>>

Next ==
    \/ ClassifyTask
    \/ ClassificationComplete
    \/ StoreClassification
    \/ RouteBugFix
    \/ RouteNormal

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* ── Safety invariants ────────────────────────────────────────────────────────

\* ROUTE-02: Bug fixes always route to debug pipeline
\* @requirement ROUTE-02
BugFixRoutesToDebug ==
    (phase = "routed" /\ taskType = "bug_fix") => routedTo = "debug"

\* ROUTE-03: Feature/refactor routes to normal pipeline
\* @requirement ROUTE-03
NonBugRoutesToNormal ==
    (phase = "routed" /\ taskType \in {"feature", "refactor"}) => routedTo = "normal"

\* ROUTE-04: Classification stored before routing
\* @requirement ROUTE-04
StoredBeforeRouting ==
    phase \in {"routing", "routed"} => classificationStored = TRUE

\* No routing before classification
NoEarlyRouting ==
    phase \in {"pending", "classifying"} => routedTo = "none"

\* ── Liveness ─────────────────────────────────────────────────────────────────
EventuallyRouted == <>(phase = "routed")

====
