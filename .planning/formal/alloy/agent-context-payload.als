-- .planning/formal/alloy/agent-context-payload.als
-- Models the agent context payload safety invariant: data flowing through
-- LLM agent context (Bash output, inter-agent JSON, skill output contracts)
-- must stay under a size threshold. Large outputs must be written to disk
-- with only summaries or file-path references passed through the agent chain.
-- Source: commands/nf/solve-diagnose.md, bin/git-heatmap.cjs, bin/nf-solve.cjs
--
-- @requirement GUARD-01
-- @requirement OBS-11

module agent_context_payload

-- ── Domain entities ────────────────────────────────────────────────────

-- Scripts that produce output consumed by agents
sig Script {
  outputMode: one OutputMode,
  stdoutSize: one SizeClass,
  writesToDisk: one Bool,
  auditableForSize: one Bool
}

-- Output modes a script can operate in
abstract sig OutputMode {}
one sig JsonMode, SummaryMode, SilentMode extends OutputMode {}

-- Size classification (abstract over exact bytes)
abstract sig SizeClass {}
one sig UnderThreshold, OverThreshold extends SizeClass {}

abstract sig Bool {}
one sig True, False extends Bool {}

-- An agent context that receives script output
sig AgentContext {
  ingestedScripts: set Script,
  payloadSize: one SizeClass
}

-- A disk artifact produced by a script for machine consumers
sig DiskArtifact {
  producer: one Script,
  referencedBy: set AgentContext
}

-- ── GUARD-01: Context payload size guardrail ───────────────────────────

-- @requirement GUARD-01
-- All data passed through LLM agent context MUST stay under 128KB.
-- Scripts producing large outputs MUST write to disk and pass only
-- summaries or file-path references through the agent chain.

-- If a script's stdout exceeds threshold, it must not be ingested directly
fact LargeOutputsMustNotBeIngested {
  all s: Script, ctx: AgentContext |
    s in ctx.ingestedScripts and s.stdoutSize = OverThreshold
      implies s.writesToDisk = True
}

-- If a script writes to disk AND is over threshold, the agent context
-- must reference the disk artifact, not ingest the raw output
fact OverThresholdUseDiskReference {
  all s: Script |
    s.stdoutSize = OverThreshold and s.writesToDisk = True
      implies some d: DiskArtifact | d.producer = s
}

-- Agent context payload must always be under threshold
-- @requirement GUARD-01
fact AgentContextUnderThreshold {
  all ctx: AgentContext | ctx.payloadSize = UnderThreshold
}

-- The payload size is determined by ingested scripts
fact PayloadDerivedFromIngested {
  all ctx: AgentContext |
    (some s: ctx.ingestedScripts | s.stdoutSize = OverThreshold and s.outputMode = JsonMode)
      implies ctx.payloadSize = OverThreshold
}

-- ── OBS-11: Agent payload size monitoring ──────────────────────────────

-- @requirement OBS-11
-- All scripts invoked by LLM-facing skills that produce machine-readable
-- output (--json mode) MUST be auditable for output size.

fact JsonScriptsMustBeAuditable {
  all s: Script |
    s.outputMode = JsonMode implies s.auditableForSize = True
}

-- @requirement OBS-11
-- A pre-flight check SHOULD flag any script whose stdout exceeds 128KB
-- when invoked from an agent context.
fact PreflightFlagsOversize {
  all s: Script, ctx: AgentContext |
    s in ctx.ingestedScripts and s.outputMode = JsonMode and s.stdoutSize = OverThreshold
      implies s.auditableForSize = True and s.writesToDisk = True
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement GUARD-01
-- No agent context ever exceeds the payload threshold
assert NoContextOverflow {
  no ctx: AgentContext | ctx.payloadSize = OverThreshold
}

-- @requirement GUARD-01
-- Every over-threshold script ingested by an agent writes to disk
assert LargeScriptsWriteToDisk {
  all s: Script, ctx: AgentContext |
    s in ctx.ingestedScripts and s.stdoutSize = OverThreshold
      implies s.writesToDisk = True
}

-- @requirement OBS-11
-- Every JSON-mode script is auditable for size
assert JsonScriptsAuditable {
  all s: Script |
    s.outputMode = JsonMode implies s.auditableForSize = True
}

-- @requirement OBS-11
-- No over-threshold JSON script is ingested without disk + audit
assert MonitoredBeforeIngestion {
  all s: Script, ctx: AgentContext |
    s in ctx.ingestedScripts and s.outputMode = JsonMode
      implies (s.stdoutSize = UnderThreshold or
               (s.writesToDisk = True and s.auditableForSize = True))
}

-- ── Verification commands ──────────────────────────────────────────────

check NoContextOverflow for 5
check LargeScriptsWriteToDisk for 5
check JsonScriptsAuditable for 5
check MonitoredBeforeIngestion for 5
