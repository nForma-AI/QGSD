-- .planning/formal/alloy/gate-naming-migration.als
-- Models the gate naming migration: file renames, script updates,
-- display component updates, and backward-compatible field reading.
--
-- @requirement NAME-01
-- @requirement NAME-02
-- @requirement NAME-03
-- @requirement NAME-04

module gate_naming_migration

abstract sig Bool {}
one sig True, False extends Bool {}

-- Gate field naming: old vs new
abstract sig FieldNaming {}
one sig OldNaming, NewNaming extends FieldNaming {}

-- @requirement NAME-01
-- Gate files that must be renamed
sig GateFile {
  naming: one FieldNaming,
  isRenamed: one Bool
}

-- @requirement NAME-02
-- Scripts that reference gate names
sig ScriptFile {
  usesNaming: one FieldNaming
}

-- @requirement NAME-03
-- Display components that render gate names
sig DisplayComponent {
  usesNaming: one FieldNaming
}

-- @requirement NAME-04
-- Gate fields with backward-compat reading
sig GateField {
  writtenAs: one FieldNaming,
  canReadOld: one Bool
}

-- @requirement NAME-01
-- All gate files must use new naming post-migration
fact AllGateFilesRenamed {
  all g: GateFile |
    g.naming = NewNaming and g.isRenamed = True
}

-- @requirement NAME-02
-- All scripts must reference new gate names
fact AllScriptsUseNewNames {
  all s: ScriptFile |
    s.usesNaming = NewNaming
}

-- @requirement NAME-03
-- All display components must use new gate names
fact AllDisplaysUseNewNames {
  all d: DisplayComponent |
    d.usesNaming = NewNaming
}

-- @requirement NAME-04
-- New writes use new naming, but old fields are still readable
fact OldFieldsStillReadable {
  all f: GateField |
    f.writtenAs = NewNaming and f.canReadOld = True
}

run {} for 4

-- @requirement NAME-01 @requirement NAME-02 @requirement NAME-03
-- Assert: no old names appear in any new writes
assert NoOldNamesInNewWrites {
  no g: GateFile | g.naming = OldNaming
  no s: ScriptFile | s.usesNaming = OldNaming
  no d: DisplayComponent | d.usesNaming = OldNaming
}
check NoOldNamesInNewWrites for 4

-- @requirement NAME-04
-- Assert: backward compatibility maintained (old fields readable)
assert BackwardCompatible {
  all f: GateField | f.canReadOld = True
}
check BackwardCompatible for 4
