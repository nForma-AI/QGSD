-- .planning/formal/alloy/doc-public-boundary.als
-- Models the public/internal boundary for user-facing documentation.
-- Ensures README.md exposes capabilities and commands, not internal
-- model names, directory trees, or CI pipeline identifiers.
-- Source: README.md, docs/USER-GUIDE.md, VERIFICATION_TOOLS.md
--
-- @requirement DOC-02

module doc_public_boundary

-- Content types that can appear in documentation
abstract sig ContentType {}
one sig Capability, Command, InternalModelName, DirectoryTree, CIPipelineDetail, ToolLink extends ContentType {}

-- Documentation sections
abstract sig DocSection {
  contains: set ContentType
}

-- README formal verification section (user-facing)
one sig ReadmeFormalSection extends DocSection {}

-- Internal reference doc (developer-facing)
one sig VerificationToolsDoc extends DocSection {}

-- DOC-02: README formal verification section presents capabilities,
-- not internal model names or directory trees
-- @requirement DOC-02
fact ReadmeShowsCapabilities {
  Capability in ReadmeFormalSection.contains
  Command in ReadmeFormalSection.contains
  ToolLink in ReadmeFormalSection.contains
}

-- DOC-02: README MUST NOT expose internal model names or directory trees
-- @requirement DOC-02
fact ReadmeHidesInternals {
  InternalModelName not in ReadmeFormalSection.contains
  DirectoryTree not in ReadmeFormalSection.contains
  CIPipelineDetail not in ReadmeFormalSection.contains
}

-- Internal docs CAN contain any content type (they are developer-facing)
fact InternalDocsUnrestricted {
  VerificationToolsDoc.contains = ContentType
}

-- Verify: no internal content leaks into README
assert NoInternalLeakToReadme {
  no c: ReadmeFormalSection.contains |
    c in (InternalModelName + DirectoryTree + CIPipelineDetail)
}

-- Verify: README always has user-facing content
assert ReadmeHasUserContent {
  Capability in ReadmeFormalSection.contains
  Command in ReadmeFormalSection.contains
}

check NoInternalLeakToReadme for 10
check ReadmeHasUserContent for 10

run {} for 5
