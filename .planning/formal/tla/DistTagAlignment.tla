---- MODULE DistTagAlignment ----
(*
 * .planning/formal/tla/DistTagAlignment.tla
 * Models the npm dist-tag alignment invariant:
 * The @next dist-tag must never point to a version older than @latest.
 * After every stable publish to @latest, @next must be aligned to the same
 * or a newer version.
 * Source: scripts/publish.sh, .github/workflows/release.yml, CLAUDE.md
 *
 * @requirement DIST-01
 *)
EXTENDS Naturals, TLC

CONSTANTS MaxVersion

(*
 * Versions are modeled as bounded natural numbers (0..MaxVersion).
 * A higher number represents a newer version.
 * latest_version: version currently pointed to by @latest dist-tag
 * next_version:   version currently pointed to by @next dist-tag
 * phase:          current publish lifecycle phase
 *)
VARIABLES latest_version, next_version, phase

vars == <<latest_version, next_version, phase>>

Versions == 0..MaxVersion

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement DIST-01
TypeOK ==
    /\ latest_version \in Versions
    /\ next_version \in Versions
    /\ phase \in {"idle", "publishing_stable", "aligning_next", "done"}

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ latest_version = 0
    /\ next_version = 0
    /\ phase = "idle"

\* ── Actions ──────────────────────────────────────────────────────────────────

\* A stable release is published to @latest, bumping its version
PublishStable ==
    /\ phase = "idle"
    /\ latest_version < MaxVersion
    /\ phase' = "publishing_stable"
    /\ latest_version' = latest_version + 1
    /\ UNCHANGED next_version

\* After a stable publish, @next is aligned to be >= @latest
\* DIST-01: After every stable publish to @latest, @next MUST be aligned
AlignNext ==
    /\ phase = "publishing_stable"
    /\ next_version' \in {v \in Versions : v >= latest_version}
    /\ phase' = "aligning_next"
    /\ UNCHANGED latest_version

\* Alignment confirmation recorded
ConfirmAlignment ==
    /\ phase = "aligning_next"
    /\ phase' = "done"
    /\ UNCHANGED <<latest_version, next_version>>

\* Reset to idle after done (allows multiple publish cycles)
ResetToIdle ==
    /\ phase = "done"
    /\ phase' = "idle"
    /\ UNCHANGED <<latest_version, next_version>>

\* Publish a prerelease to @next only (does not touch @latest)
PublishPrerelease ==
    /\ phase = "idle"
    /\ next_version' \in {v \in Versions : v >= latest_version}
    /\ UNCHANGED <<latest_version, phase>>

Next ==
    \/ PublishStable
    \/ AlignNext
    \/ ConfirmAlignment
    \/ ResetToIdle
    \/ PublishPrerelease

Spec == Init /\ [][Next]_vars /\ WF_vars(AlignNext) /\ WF_vars(ConfirmAlignment) /\ WF_vars(ResetToIdle)

\* ── Safety invariants ────────────────────────────────────────────────────────

\* DIST-01: @next must never be behind @latest once stable state is reached.
\* During the publishing_stable phase, alignment is pending — this is the
\* transient window. Once in aligning_next, done, or idle: @next must be >= @latest.
NextNeverBehindLatest ==
    phase \in {"aligning_next", "done", "idle"} => next_version >= latest_version

\* DIST-01: After alignment, @next is at least as new as @latest
AlignmentSufficient ==
    phase = "aligning_next" => next_version >= latest_version

\* ── Liveness ─────────────────────────────────────────────────────────────────
\* After a stable publish, alignment always eventually completes
EventuallyAligned == [](phase = "publishing_stable" => <>(phase = "done"))

====
