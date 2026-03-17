-- .planning/formal/alloy/model-registry-parity.als
-- Models the model registry and complexity profiler feature parity across all
-- four formalisms: TLA+, Alloy, PRISM, Petri (.dot).
-- Source: bin/model-complexity-profile.cjs, bin/initialize-model-registry.cjs

module model_registry_parity

-- The four supported formalisms
abstract sig Formalism {}
one sig TLAPlus, Alloy, PRISM, PetriNet extends Formalism {}

-- File extensions mapped to formalisms
abstract sig FileExtension {
  formalism: one Formalism
}
one sig TlaExt extends FileExtension {} { formalism = TLAPlus }
one sig AlsExt extends FileExtension {} { formalism = Alloy }
one sig PrismExt extends FileExtension {} { formalism = PRISM }
one sig DotExt extends FileExtension {} { formalism = PetriNet }

-- Registry capabilities that must exist for each formalism
abstract sig RegistryCapability {}
one sig Scanning, Traceability, StateSpaceProfiling, ComplexityClassification extends RegistryCapability {}

-- A formalism support entry in the registry
sig FormalismSupport {
  formalism: one Formalism,
  capabilities: set RegistryCapability
}

-- Feature parity: every formalism has all capabilities
fact featureParity {
  -- Every formalism has a support entry
  all f: Formalism | one fs: FormalismSupport | fs.formalism = f
  -- Every support entry has all capabilities
  all fs: FormalismSupport | fs.capabilities = RegistryCapability
}

-- Model file in the registry
sig ModelFile {
  extension: one FileExtension,
  inRegistry: one Bool,
  hasTraceability: one Bool,
  hasComplexityProfile: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- Any model file that exists should be scannable into the registry
fact registryScanCompleteness {
  all m: ModelFile | m.inRegistry = True
}

-- All registered models get traceability and profiling
fact registeredModelsGetProfiling {
  all m: ModelFile | m.inRegistry = True implies {
    m.hasTraceability = True
    m.hasComplexityProfile = True
  }
}

-- Feature parity assertion: all formalisms have identical capability sets
assert identicalCapabilities {
  all fs1, fs2: FormalismSupport | fs1.capabilities = fs2.capabilities
}
check identicalCapabilities for 6

-- Every formalism is represented in the registry
assert allFormalismsRepresented {
  all f: Formalism | some fs: FormalismSupport | fs.formalism = f
}
check allFormalismsRepresented for 6

-- Every file extension maps to a formalism
assert completeExtensionMapping {
  #FileExtension = #Formalism
}
check completeExtensionMapping for 6
