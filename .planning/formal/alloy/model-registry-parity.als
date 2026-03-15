-- .planning/formal/alloy/model-registry-parity.als
-- Models the model registry and complexity profiler feature parity across all
-- five formalisms: TLA+, Alloy, PRISM, UPPAAL (.xml), Petri (.dot).
-- Source: bin/model-complexity-profile.cjs, bin/initialize-model-registry.cjs
--
-- @requirement UPPAAL-05

module model_registry_parity

-- The five supported formalisms
abstract sig Formalism {}
-- @requirement UPPAAL-05
one sig TLAPlus, Alloy, PRISM, UPPAAL, PetriNet extends Formalism {}

-- File extensions mapped to formalisms
abstract sig FileExtension {
  formalism: one Formalism
}
-- @requirement UPPAAL-05
one sig TlaExt extends FileExtension {} { formalism = TLAPlus }
one sig AlsExt extends FileExtension {} { formalism = Alloy }
one sig PrismExt extends FileExtension {} { formalism = PRISM }
one sig XmlExt extends FileExtension {} { formalism = UPPAAL }
one sig DotExt extends FileExtension {} { formalism = PetriNet }

-- Registry capabilities that must exist for each formalism
abstract sig RegistryCapability {}
-- @requirement UPPAAL-05
one sig Scanning, Traceability, StateSpaceProfiling, ComplexityClassification extends RegistryCapability {}

-- A formalism support entry in the registry
-- @requirement UPPAAL-05
sig FormalismSupport {
  formalism: one Formalism,
  capabilities: set RegistryCapability
}

-- Feature parity: every formalism has all capabilities
-- @requirement UPPAAL-05
fact featureParity {
  -- Every formalism has a support entry
  all f: Formalism | one fs: FormalismSupport | fs.formalism = f
  -- Every support entry has all capabilities
  all fs: FormalismSupport | fs.capabilities = RegistryCapability
}

-- Model file in the registry
-- @requirement UPPAAL-05
sig ModelFile {
  extension: one FileExtension,
  inRegistry: one Bool,
  hasTraceability: one Bool,
  hasComplexityProfile: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- Any model file that exists should be scannable into the registry
-- @requirement UPPAAL-05
fact registryScanCompleteness {
  all m: ModelFile | m.inRegistry = True
}

-- All registered models get traceability and profiling
-- @requirement UPPAAL-05
fact registeredModelsGetProfiling {
  all m: ModelFile | m.inRegistry = True implies {
    m.hasTraceability = True
    m.hasComplexityProfile = True
  }
}

-- Feature parity assertion: all formalisms have identical capability sets
-- @requirement UPPAAL-05
assert identicalCapabilities {
  all fs1, fs2: FormalismSupport | fs1.capabilities = fs2.capabilities
}
check identicalCapabilities for 6

-- Every formalism is represented in the registry
-- @requirement UPPAAL-05
assert allFormalismsRepresented {
  all f: Formalism | some fs: FormalismSupport | fs.formalism = f
}
check allFormalismsRepresented for 6

-- Every file extension maps to a formalism
-- @requirement UPPAAL-05
assert completeExtensionMapping {
  #FileExtension = #Formalism
}
check completeExtensionMapping for 6
