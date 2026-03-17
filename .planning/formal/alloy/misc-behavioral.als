-- .planning/formal/alloy/misc-behavioral.als
-- Miscellaneous behavioral requirements — adapter, agent wizard, debug invariants, etc.
--
-- @requirement ADAPT-01
-- @requirement AGENT-03
-- @requirement ARCH-03
-- @requirement BRKR-01
-- @requirement DECOMP-01
-- @requirement EXEC-01
-- @requirement HLTH-03
-- @requirement LTCY-01
-- @requirement MCPENV-02
-- @requirement PRIO-01
-- @requirement SCHEMA-02
-- @requirement SHARD-01
-- @requirement SIG-03
-- @requirement TRIAGE-02
-- @requirement UNIF-02
-- @requirement VALID-01

module misc_behavioral

-- MCP detection domain
sig MCPServer {
  name: one ServerName,
  detected: one Bool
}

sig ServerName {}
abstract sig Bool {}
one sig True, False extends Bool {}

sig Config {
  servers: set MCPServer
}

-- @requirement MCP-01
fact AutoDetect {
  all s: MCPServer | one s.name
}

-- @requirement MCP-03
assert DetectedWrittenToConfig {
  all s: MCPServer | s.detected = True => some c: Config | s in c.servers
}
check DetectedWrittenToConfig for 5
