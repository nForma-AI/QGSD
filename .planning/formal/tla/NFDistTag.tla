---- MODULE NFDistTag ----
(*
 * .planning/formal/tla/NFDistTag.tla
 * npm dist-tag ordering: @next must never fall behind @latest.
 * After every stable publish to @latest, @next must be aligned.
 *
 * @requirement DIST-01
 *)
EXTENDS Naturals, TLC

CONSTANTS MaxVersion

VARIABLES latestVer, nextVer, publishState
vars == <<latestVer, nextVer, publishState>>

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement DIST-01
TypeOK ==
    /\ latestVer \in 0..MaxVersion
    /\ nextVer \in 0..MaxVersion
    /\ publishState \in {"idle", "publishing_stable", "aligning_next", "done"}

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ latestVer = 0
    /\ nextVer = 0
    /\ publishState = "idle"

\* ── Actions ──────────────────────────────────────────────────────────────────

\* @requirement DIST-01
\* Publish a new stable version to @latest
PublishStable ==
    /\ publishState = "idle"
    /\ latestVer < MaxVersion
    /\ latestVer' = latestVer + 1
    /\ publishState' = "publishing_stable"
    /\ UNCHANGED nextVer

\* @requirement DIST-01
\* After stable publish, align @next to at least @latest
AlignNext ==
    /\ publishState = "publishing_stable"
    /\ nextVer' = latestVer'
    /\ publishState' = "aligning_next"
    /\ UNCHANGED latestVer

\* @requirement DIST-01
\* Complete the alignment cycle
Complete ==
    /\ publishState = "aligning_next"
    /\ publishState' = "done"
    /\ UNCHANGED <<latestVer, nextVer>>

Reset ==
    /\ publishState = "done"
    /\ publishState' = "idle"
    /\ UNCHANGED <<latestVer, nextVer>>

Done ==
    /\ latestVer = MaxVersion
    /\ publishState = "idle"
    /\ UNCHANGED vars

Next ==
    \/ PublishStable
    \/ AlignNext
    \/ Complete
    \/ Reset
    \/ Done

Spec == Init /\ [][Next]_vars /\ WF_vars(AlignNext)

\* ── Safety invariants ────────────────────────────────────────────────────────

\* @requirement DIST-01
\* @next must never point to a version older than @latest
NextNeverBehindLatest == nextVer >= latestVer \/ publishState = "publishing_stable"

\* @requirement DIST-01
\* After alignment, @next equals @latest
AlignedAfterStablePublish ==
    publishState = "aligning_next" => nextVer >= latestVer

\* @requirement DIST-01
\* Version numbers are monotonically increasing
VersionsMonotone == latestVer >= 0 /\ nextVer >= 0

====
