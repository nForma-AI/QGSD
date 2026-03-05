module sample
sig Agent {}
fact AgentCount { #Agent = 5 }
assert ThresholdPasses { all a: Agent | a.score >= 1 }
pred ValidState [x: Agent] { #Agent > 0 }
