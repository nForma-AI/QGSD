-- .planning/formal/alloy/ux-interaction-safety.als
-- Models UX interaction safety: immediate feedback for user actions,
-- destructive action confirmation/undo, and actionable error messages.
-- Source: qgsd-baseline requirements
--
-- @requirement UX-04
-- @requirement UX-05
-- @requirement UX-06

module ux_interaction_safety

abstract sig Bool {}
one sig True, False extends Bool {}

-- @requirement UX-04
-- Every user-initiated action produces immediate feedback (loading/disabled
-- state) and completion feedback (result message, navigation change, or
-- visible state update)
sig UserInitiatedAction {
  producesImmediateFeedback: one Bool,
  producesCompletionFeedback: one Bool
}

-- @requirement UX-04
fact AllActionsProduceFeedback {
  all a: UserInitiatedAction |
    a.producesImmediateFeedback = True and
    a.producesCompletionFeedback = True
}

assert NoSilentUserActions {
  no a: UserInitiatedAction |
    a.producesImmediateFeedback = False or
    a.producesCompletionFeedback = False
}

-- @requirement UX-05
-- Destructive actions require explicit confirmation or provide undo
abstract sig ActionKind {}
one sig Destructive, Safe extends ActionKind {}

sig ProtectedAction {
  kind: one ActionKind,
  hasExplicitConfirmation: one Bool,
  hasUndoWindow: one Bool
}

-- @requirement UX-05
fact DestructiveActionsRequireProtection {
  all a: ProtectedAction |
    a.kind = Destructive implies
      (a.hasExplicitConfirmation = True or a.hasUndoWindow = True)
}

assert DestructiveNeverUnguarded {
  no a: ProtectedAction |
    a.kind = Destructive and
    a.hasExplicitConfirmation = False and
    a.hasUndoWindow = False
}

-- @requirement UX-06
-- Error messages are human-readable, explain what went wrong, and suggest
-- a next step or recovery action
sig ErrorOutput {
  humanReadable: one Bool,
  explainsFailure: one Bool,
  suggestsRecovery: one Bool
}

-- @requirement UX-06
fact ErrorOutputsAreActionable {
  all e: ErrorOutput |
    e.humanReadable = True and
    e.explainsFailure = True and
    e.suggestsRecovery = True
}

assert NoOpaqueErrorOutputs {
  no e: ErrorOutput |
    e.humanReadable = False or
    e.explainsFailure = False or
    e.suggestsRecovery = False
}

-- Verification commands
check NoSilentUserActions for 5
check DestructiveNeverUnguarded for 5
check NoOpaqueErrorOutputs for 5
