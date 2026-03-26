---- MODULE NFScopeGuard ----
(*
 * formal/tla/NFScopeGuard.tla
 * Models the nf-scope-guard.js PreToolUse hook behavior.
 * Source: hooks/nf-scope-guard.js
 *
 * @requirement SCOPE-01
 * @requirement SCOPE-02
 * @requirement SCOPE-03
 *
 * The scope guard fires on Edit/Write/MultiEdit tool calls and checks
 * whether the target file is within the declared scope contract.
 * If no scope contract exists, the hook is a no-op.
 *)

EXTENDS Naturals, FiniteSets

CONSTANTS
  MaxFiles       \* Maximum files to check (model: 3)

VARIABLES
  scopeContractExists,   \* BOOLEAN: whether a scope contract is loaded
  scopeFiles,            \* Set of files in the declared scope
  targetFile,            \* Current file being edited
  hookFired,             \* BOOLEAN: whether the hook executed logic
  warningEmitted,        \* BOOLEAN: whether an out-of-scope warning was emitted
  decision               \* "IDLE" | "ALLOW" | "WARN"

Files == 1..MaxFiles

vars == <<scopeContractExists, scopeFiles, targetFile, hookFired, warningEmitted, decision>>

\* @requirement SCOPE-01
\* @requirement SCOPE-02
\* @requirement SCOPE-03
TypeOK ==
  /\ scopeContractExists \in BOOLEAN
  /\ scopeFiles          \subseteq Files
  /\ targetFile           \in Files \cup {0}   \* 0 = no target
  /\ hookFired            \in BOOLEAN
  /\ warningEmitted       \in BOOLEAN
  /\ decision             \in {"IDLE", "ALLOW", "WARN"}

Init ==
  /\ scopeContractExists = FALSE
  /\ scopeFiles          = {}
  /\ targetFile           = 0
  /\ hookFired            = FALSE
  /\ warningEmitted       = FALSE
  /\ decision             = "IDLE"

\* Load scope contract (may or may not exist)
LoadScopeContract(exists, files) ==
  /\ decision = "IDLE"
  /\ scopeContractExists' = exists
  /\ scopeFiles' = IF exists THEN files ELSE {}
  /\ UNCHANGED <<targetFile, hookFired, warningEmitted, decision>>

\* Tool call triggers the hook
ToolCallReceived(file) ==
  /\ decision = "IDLE"
  /\ targetFile' = file
  /\ hookFired' = TRUE
  /\ \* SCOPE-03: no-op when no scope contract exists
     IF ~scopeContractExists
     THEN /\ decision' = "ALLOW"
          /\ warningEmitted' = FALSE
     ELSE \* SCOPE-01: check if file is within scope
          IF file \in scopeFiles
          THEN /\ decision' = "ALLOW"
               /\ warningEmitted' = FALSE
          ELSE \* SCOPE-02: emit warning for out-of-scope files
               /\ decision' = "WARN"
               /\ warningEmitted' = TRUE
  /\ UNCHANGED <<scopeContractExists, scopeFiles>>

\* Reset for next tool call
Reset ==
  /\ decision \in {"ALLOW", "WARN"}
  /\ decision' = "IDLE"
  /\ targetFile' = 0
  /\ hookFired' = FALSE
  /\ warningEmitted' = FALSE
  /\ UNCHANGED <<scopeContractExists, scopeFiles>>

Done ==
  /\ decision \in {"ALLOW", "WARN"}
  /\ UNCHANGED vars

Next ==
  \/ \E e \in BOOLEAN, f \in SUBSET Files : LoadScopeContract(e, f)
  \/ \E file \in Files : ToolCallReceived(file)
  \/ Reset
  \/ Done

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* SCOPE-01: Hook fires on Edit/Write/MultiEdit and checks scope
SafetyHookFiresOnToolCall ==
  targetFile # 0 => hookFired

\* SCOPE-02: Out-of-scope files get warning
SafetyOutOfScopeWarning ==
  (scopeContractExists /\ targetFile # 0 /\ targetFile \notin scopeFiles)
  => (decision = "WARN" \/ decision = "IDLE")

\* SCOPE-03: No-op when no scope contract
SafetyNoOpWithoutContract ==
  (~scopeContractExists /\ targetFile # 0)
  => (decision = "ALLOW" \/ decision = "IDLE")

====
