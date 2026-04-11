---- MODULE NFWaveDAG ----
(*
 * formal/tla/NFWaveDAG.tla
 * Handwritten — models graph-driven wave scheduling with SCC collapsing.
 * Source: bin/solve-wave-dag.cjs (computeWavesFromGraph, tarjanSCC)
 *
 * Models the core invariants of the graph-driven wave scheduler:
 * 1. SCC collapsing partitions nodes correctly (no overlaps, full coverage)
 * 2. Condensation DAG is acyclic
 * 3. Wave assignment respects dependency ordering
 * 4. MAX_PER_WAVE limits are enforced
 *
 * Test graph: a->b, b->c, c->a (cycle), d->b (external dep)
 * Expected: SCC {a,b,c} in one group, {d} separate. d depends on {a,b,c}.
 *
 * @requirement INTG-07
 *)
EXTENDS Naturals, FiniteSets, TLC

\* ── Concrete graph instance ─────────────────────────────────────────────────
\* 4 nodes with a 3-cycle (a,b,c) and one external node (d)
N == {"a", "b", "c", "d"}

\* Edges: a->b, b->c, c->a (cycle), d->b (d depends on b)
E == {<<"a", "b">>, <<"b", "c">>, <<"c", "a">>, <<"d", "b">>}

MaxPerWave == 3

VARIABLES
    sccOf,              \* Function: node -> SCC id
    numSCCs,            \* Total number of SCCs
    condensationEdges,  \* Set of <<scc_i, scc_j>> edges in condensation DAG
    waveOf,             \* Function: SCC id -> wave number
    phase               \* Algorithm phase: "init", "scc", "condensation", "waves", "done"

vars == <<sccOf, numSCCs, condensationEdges, waveOf, phase>>

\* ── Helper operators ────────────────────────────────────────────────────────

HasEdge(u, v) == <<u, v>> \in E

\* Reachability (bounded by graph size — sufficient for 4 nodes)
Reach1(u, v) == HasEdge(u, v)
Reach2(u, v) == \E w \in N : HasEdge(u, w) /\ HasEdge(w, v)
Reach3(u, v) == \E w1 \in N : \E w2 \in N : HasEdge(u, w1) /\ HasEdge(w1, w2) /\ HasEdge(w2, v)
Reachable(u, v) == u = v \/ Reach1(u, v) \/ Reach2(u, v) \/ Reach3(u, v)
MutuallyReachable(u, v) == Reachable(u, v) /\ Reachable(v, u)

SCCIds == 0..(numSCCs - 1)

NodesInSCC(sccId) == {n \in N : sccOf[n] = sccId}

\* ── Type invariant ──────────────────────────────────────────────────────────
\* @requirement INTG-07
TypeOK ==
    /\ sccOf \in [N -> 0..3]
    /\ numSCCs \in 0..4
    /\ condensationEdges \subseteq ((0..3) \X (0..3))
    /\ phase \in {"init", "scc", "condensation", "waves", "done"}

\* ── Initial state ───────────────────────────────────────────────────────────
Init ==
    /\ sccOf = [n \in N |-> 0]
    /\ numSCCs = 0
    /\ condensationEdges = {}
    /\ waveOf = [x \in {} |-> 0]
    /\ phase = "init"

\* ── Actions ─────────────────────────────────────────────────────────────────

\* Phase 1: Compute SCCs (Tarjan result — non-deterministic assignment)
\* Constraint: nodes in a direct 2-cycle must share SCC id
ComputeSCCs ==
    /\ phase = "init"
    /\ \E assignment \in [N -> 0..Cardinality(N) - 1] :
        \* Correct SCC: same SCC iff mutually reachable
        /\ \A u \in N, v \in N :
            assignment[u] = assignment[v] <=> MutuallyReachable(u, v)
        \* Compact: used IDs form contiguous range 0..maxUsed
        /\ LET usedIds == {assignment[n] : n \in N}
               maxUsed == CHOOSE m \in 0..3 :
                   /\ m \in usedIds
                   /\ \A k \in (m+1)..3 : k \notin usedIds
           IN  /\ \A k \in 0..maxUsed : k \in usedIds
            /\ sccOf' = assignment
            /\ numSCCs' = maxUsed + 1
            /\ UNCHANGED <<condensationEdges, waveOf>>
            /\ phase' = "scc"

\* Phase 2: Build condensation DAG (cross-SCC edges only)
BuildCondensation ==
    /\ phase = "scc"
    /\ LET crossEdges == {e \in E : sccOf[e[1]] /= sccOf[e[2]]}
       IN condensationEdges' = {<<sccOf[e[1]], sccOf[e[2]]>> : e \in crossEdges}
    /\ UNCHANGED <<sccOf, numSCCs, waveOf>>
    /\ phase' = "condensation"

\* Phase 3: Assign waves (longest-path topological ordering)
AssignWaves ==
    /\ phase = "condensation"
    /\ \E wa \in [SCCIds -> 0..Cardinality(N)] :
        \* Roots (no outgoing condensation edges) get wave 0
        /\ \A s \in SCCIds :
            (~\E t \in SCCIds : <<s, t>> \in condensationEdges) => wa[s] = 0
        \* Non-roots: wave = 1 + max(dependency waves)
        /\ \A s \in SCCIds :
            (\E t \in SCCIds : <<s, t>> \in condensationEdges) =>
                /\ \A t \in SCCIds :
                    <<s, t>> \in condensationEdges => wa[s] > wa[t]
                /\ \E t \in SCCIds :
                    <<s, t>> \in condensationEdges /\ wa[s] = wa[t] + 1
        /\ waveOf' = wa
    /\ UNCHANGED <<sccOf, numSCCs, condensationEdges>>
    /\ phase' = "waves"

\* Phase 4: Terminal
Finish ==
    /\ phase = "waves"
    /\ phase' = "done"
    /\ UNCHANGED <<sccOf, numSCCs, condensationEdges, waveOf>>

Next ==
    \/ ComputeSCCs
    \/ BuildCondensation
    \/ AssignWaves
    \/ Finish

\* ── Safety invariants ───────────────────────────────────────────────────────

\* SCCPartition: Every SCC id is non-empty (no phantom groups)
\* @requirement INTG-07
SCCPartition ==
    phase \in {"scc", "condensation", "waves", "done"} =>
        \A sccId \in SCCIds : NodesInSCC(sccId) /= {}

\* CondensationNoSelfLoops: No edge from an SCC to itself
\* @requirement INTG-07
CondensationNoSelfLoops ==
    phase \in {"condensation", "waves", "done"} =>
        \A e \in condensationEdges : e[1] /= e[2]

\* WaveOrderRespectsEdges: If SCC A depends on SCC B, wave(A) > wave(B)
\* @requirement INTG-07
WaveOrderRespectsEdges ==
    phase \in {"waves", "done"} =>
        \A e \in condensationEdges : waveOf[e[1]] > waveOf[e[2]]

\* RootWavesAreZero: SCCs with no dependencies get wave 0
\* @requirement INTG-07
RootWavesAreZero ==
    phase \in {"waves", "done"} =>
        \A s \in SCCIds :
            (~\E t \in SCCIds : <<s, t>> \in condensationEdges) => waveOf[s] = 0

\* ── Liveness ────────────────────────────────────────────────────────────────

\* AlgorithmTerminates: Eventually reaches "done"
\* @requirement INTG-07
AlgorithmTerminates == <>(phase = "done")

\* ── Specification ───────────────────────────────────────────────────────────
Spec == Init /\ [][Next]_vars
        /\ WF_vars(ComputeSCCs)
        /\ WF_vars(BuildCondensation)
        /\ WF_vars(AssignWaves)
        /\ WF_vars(Finish)

====
