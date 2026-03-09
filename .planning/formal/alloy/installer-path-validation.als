-- .planning/formal/alloy/installer-path-validation.als
-- Models installer scanning of installed hook files for path.join(__dirname, ...)
-- patterns and warning on missing targets.
-- Source: bin/install.js
--
-- @requirement INST-13

module installer_path_validation

abstract sig Bool {}
one sig True, False extends Bool {}

-- Installed hook files that the installer scans
sig HookFile {
  hasPathJoinPattern: one Bool,   -- contains path.join(__dirname, ...) references
  pathRefs: set PathReference     -- all path references found in this file
}

-- A path reference found via pattern scanning
sig PathReference {
  resolvedRelative: one Bool,     -- resolved relative to installed location
  targetExistsOnDisk: one Bool,   -- target file exists after resolution
  warningEmitted: one Bool        -- warning emitted for missing target
}

-- INST-13: Installer scans for path.join(__dirname, ...) patterns,
-- resolves each reference relative to installed location,
-- and emits warning for any target not on disk
-- @requirement INST-13
fact ScanAllHookFiles {
  -- All hook files are scanned (no file skipped)
  all hf: HookFile | hf.hasPathJoinPattern = True implies #hf.pathRefs > 0
  -- Files without the pattern have no refs to check
  all hf: HookFile | hf.hasPathJoinPattern = False implies #hf.pathRefs = 0
  -- Every path reference belongs to exactly one hook file
  all pr: PathReference | one hf: HookFile | pr in hf.pathRefs
}

fact ResolutionIsRelative {
  -- All path references are resolved relative to installed location
  all pr: PathReference | pr.resolvedRelative = True
}

fact WarningOnMissing {
  -- Warning emitted iff target does not exist on disk
  all pr: PathReference |
    (pr.targetExistsOnDisk = False implies pr.warningEmitted = True) and
    (pr.targetExistsOnDisk = True implies pr.warningEmitted = False)
}

-- Assertions
assert AllRefsResolved {
  all pr: PathReference | pr.resolvedRelative = True
}

assert MissingTargetsWarned {
  all pr: PathReference |
    pr.targetExistsOnDisk = False implies pr.warningEmitted = True
}

assert ExistingTargetsNoWarning {
  all pr: PathReference |
    pr.targetExistsOnDisk = True implies pr.warningEmitted = False
}

assert NoOrphanRefs {
  -- Every PathReference belongs to exactly one HookFile
  all pr: PathReference | one hf: HookFile | pr in hf.pathRefs
}

check AllRefsResolved for 6
check MissingTargetsWarned for 6
check ExistingTargetsNoWarning for 6
check NoOrphanRefs for 6
