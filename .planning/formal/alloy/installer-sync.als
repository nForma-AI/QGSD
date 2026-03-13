-- .planning/formal/alloy/installer-sync.als
-- Models installer auto-sync of provider slots from providers.json to claude.json.
-- Source: bin/install.js
--
-- @requirement MULTI-04

module installer_sync

-- ═══ Provider Slots ═══

sig SlotName {}

sig ProvidersJson {
  slots: set SlotName
}

sig ClaudeJson {
  mcpEntries: set SlotName,
  quorumActive: set SlotName
}

-- @requirement MULTI-04
-- After sync: every slot in providers.json has an MCP entry in claude.json
fact AllSlotsPresent {
  all pj: ProvidersJson, cj: ClaudeJson |
    pj.slots in cj.mcpEntries
}

-- @requirement MULTI-04
-- After sync: every slot in providers.json is in quorum_active
fact AllSlotsInQuorum {
  all pj: ProvidersJson, cj: ClaudeJson |
    pj.slots in cj.quorumActive
}

-- @requirement MULTI-04
-- Existing entries are not modified (only missing slots are created)
-- Modeled: pre-existing entries remain in post-sync state
sig PreExistingEntry {
  slot: one SlotName,
  config: one Config
}

sig Config {}

sig SyncResult {
  preExisting: set PreExistingEntry,
  postEntries: set PreExistingEntry
}

-- @requirement MULTI-04
fact PreserveExisting {
  all sr: SyncResult |
    sr.preExisting in sr.postEntries
}

-- @requirement MULTI-04
assert InstallerSyncComplete {
  all pj: ProvidersJson, cj: ClaudeJson |
    pj.slots in cj.mcpEntries and pj.slots in cj.quorumActive
}
check InstallerSyncComplete for 6

assert ExistingEntriesPreserved {
  all sr: SyncResult |
    sr.preExisting in sr.postEntries
}
check ExistingEntriesPreserved for 5
