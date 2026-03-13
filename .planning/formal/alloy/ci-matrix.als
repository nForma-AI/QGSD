-- .planning/formal/alloy/ci-matrix.als
-- Models CI/CD workflow configuration: branch triggers, Node matrix, npm integrity.
-- Source: .github/workflows/*.yml
--
-- @requirement CI-07

module ci_matrix

-- ═══ Branch triggers ═══

abstract sig Branch {}
one sig Main, Staging extends Branch {}

sig Workflow {
  triggers: set Branch,
  nodeVersions: set NodeVersion,
  checksNpmIntegrity: one Bool,
  autoPublishStaging: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

abstract sig NodeVersion {}
one sig Node18, Node20, Node22 extends NodeVersion {}

-- @requirement CI-07
-- Workflows trigger on both main and staging branches
fact TriggersOnBothBranches {
  all w: Workflow |
    Main in w.triggers and Staging in w.triggers
}

-- @requirement CI-07
-- Tests run across Node 18/20/22 matrix
fact FullNodeMatrix {
  all w: Workflow |
    Node18 in w.nodeVersions and
    Node20 in w.nodeVersions and
    Node22 in w.nodeVersions
}

-- @requirement CI-07
-- Verify npm package integrity
fact NpmIntegrity {
  all w: Workflow | w.checksNpmIntegrity = True
}

-- @requirement CI-07
-- Auto-publish @staging dist-tag on staging push
fact StagingAutoPublish {
  all w: Workflow | w.autoPublishStaging = True
}

-- @requirement CI-07
assert CIMatrixComplete {
  all w: Workflow |
    Main in w.triggers and
    Staging in w.triggers and
    #w.nodeVersions = 3 and
    w.checksNpmIntegrity = True and
    w.autoPublishStaging = True
}
check CIMatrixComplete for 5
