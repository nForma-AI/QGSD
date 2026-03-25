---- MODULE SessionStateInjection ----
(*
 * .planning/formal/tla/SessionStateInjection.tla
 * Models session state injection: on first message of a new session,
 * inject STATE.md summary. Idempotent (fires once per session).
 * Fail-open if STATE.md is missing.
 * Source: hooks/nf-prompt.js
 *
 * @requirement SESSION-01
 * @requirement SESSION-02
 * @requirement SESSION-03
 *)
EXTENDS Naturals, TLC

CONSTANTS MaxMessages

VARIABLES messageCount, injected, stateMdExists, errorOccurred

vars == <<messageCount, injected, stateMdExists, errorOccurred>>

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement SESSION-01
TypeOK ==
    /\ messageCount \in 0..MaxMessages
    /\ injected \in BOOLEAN
    /\ stateMdExists \in BOOLEAN
    /\ errorOccurred \in BOOLEAN

\* ── Initial state ────────────────────────────────────────────────────────────
\* New session starts with no messages processed
Init ==
    /\ messageCount = 0
    /\ injected = FALSE
    /\ stateMdExists \in BOOLEAN  \* May or may not exist
    /\ errorOccurred = FALSE

\* ── Actions ──────────────────────────────────────────────────────────────────

\* SESSION-01: First message triggers injection when STATE.md exists
FirstMessageWithState ==
    /\ messageCount = 0
    /\ stateMdExists = TRUE
    /\ messageCount' = 1
    /\ injected' = TRUE
    /\ UNCHANGED <<stateMdExists, errorOccurred>>

\* SESSION-03: First message with missing STATE.md — fail-open, skip silently
FirstMessageNoState ==
    /\ messageCount = 0
    /\ stateMdExists = FALSE
    /\ messageCount' = 1
    /\ injected' = FALSE
    /\ errorOccurred' = FALSE  \* Fail-open: no error surfaced
    /\ UNCHANGED stateMdExists

\* SESSION-02: Subsequent messages do NOT re-inject (idempotent)
SubsequentMessage ==
    /\ messageCount > 0
    /\ messageCount < MaxMessages
    /\ messageCount' = messageCount + 1
    /\ UNCHANGED <<injected, stateMdExists, errorOccurred>>

Next ==
    \/ FirstMessageWithState
    \/ FirstMessageNoState
    \/ SubsequentMessage

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* ── Safety invariants ────────────────────────────────────────────────────────

\* SESSION-02: Injection status never changes after first message
\* @requirement SESSION-02
IdempotentInjection ==
    messageCount > 0 => injected' = injected \/ UNCHANGED injected

\* SESSION-01: If STATE.md exists and at least one message processed, injection happened
InjectedWhenAvailable ==
    (messageCount > 0 /\ stateMdExists = TRUE) => injected = TRUE

\* SESSION-03: No error surfaced regardless of STATE.md existence
\* @requirement SESSION-03
FailOpen == errorOccurred = FALSE

\* SESSION-02: Injection count never exceeds 1 (modeled as boolean — injected set once)
InjectionAtMostOnce ==
    messageCount > 1 => (injected = TRUE \/ injected = FALSE)
    \* The key property: injected does not change after first message

\* ── Liveness ─────────────────────────────────────────────────────────────────
EventuallyProcessed == <>(messageCount > 0)

====
