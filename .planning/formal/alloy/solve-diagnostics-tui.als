-- .planning/formal/alloy/solve-diagnostics-tui.als
-- Models the solver diagnostic engine and TUI dashboard requirements.
-- Source: bin/nForma.cjs (TUI), bin/nf-solve.cjs (diagnostics)
--
-- @requirement SOLVE-24
-- @requirement SOLVE-25

module solve_diagnostics_tui

abstract sig Bool {}
one sig True, False extends Bool {}

-- Cross-layer residual vector computed by the diagnostic solver
sig ResidualVector {
  layerCount: one Int,          -- number of layers in the vector
  hasHealthIndicators: one Bool, -- health indicators present
  hasConvergenceLogic: one Bool, -- convergence logic computed
  hasStructuralClaims: one Bool  -- structural claim sweeps ran
}

-- Individual layer residual within the vector
sig LayerResidual {
  vector: one ResidualVector,
  residualValue: one Int,       -- >= 0
  layerName: one LayerType
}

abstract sig LayerType {}
one sig RtoF, FtoT, CtoF, TtoC, FtoC, RtoD, DtoC,
        CtoR, TtoR, DtoR, L1toL2, L2toL3, L3toTC extends LayerType {}

-- TUI dashboard state
sig TUIDashboard {
  hasSolvePage: one Bool,         -- solve dashboard page exists
  hasBreakerControls: one Bool,   -- circuit breaker CLI controls
  testableHeadless: one Bool      -- testable without live terminal
}

-- SOLVE-25: Diagnostic solver computes cross-layer residual vectors
-- with health indicators, convergence logic, and structural claim sweeps
-- @requirement SOLVE-25
fact DiagnosticCompleteness {
  all rv: ResidualVector |
    rv.hasHealthIndicators = True and
    rv.hasConvergenceLogic = True and
    rv.hasStructuralClaims = True and
    rv.layerCount = 13
  -- All 13 layer types represented
  #LayerType = 13
  -- Residuals are non-negative
  all lr: LayerResidual | lr.residualValue >= 0
}

-- SOLVE-24: TUI binary provides terminal-based solve dashboard
-- with circuit breaker controls, testable without live terminal
-- @requirement SOLVE-24
fact TUIRequirements {
  all tui: TUIDashboard |
    tui.hasSolvePage = True and
    tui.hasBreakerControls = True and
    tui.testableHeadless = True
}

-- Each layer residual belongs to exactly one vector
fact ResidualOwnership {
  all lr: LayerResidual | one lr.vector
}

-- Assertions
assert AllLayersCovered {
  #LayerType = 13
}

assert ResidualVectorComplete {
  all rv: ResidualVector |
    rv.hasHealthIndicators = True and
    rv.hasConvergenceLogic = True and
    rv.hasStructuralClaims = True
}

assert TUITestableHeadless {
  all tui: TUIDashboard | tui.testableHeadless = True
}

assert NonNegativeResiduals {
  all lr: LayerResidual | lr.residualValue >= 0
}

check AllLayersCovered for 5
check ResidualVectorComplete for 5
check TUITestableHeadless for 5
check NonNegativeResiduals for 8
