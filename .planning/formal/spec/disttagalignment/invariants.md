# Liveness Fairness Declarations: disttagalignment

**Spec source:** `formal/tla/DistTagAlignment.tla`
**Config:** `formal/tla/MCDistTagAlignment.cfg`

## EventuallyAligned

**Property:** `EventuallyAligned == [](phase = "publishing_stable" => <>(phase = "done"))`
**Config line:** `PROPERTY EventuallyAligned` (MCDistTagAlignment.cfg)
**Fairness assumption:** WF_vars on 3 actions: AlignNext, ConfirmAlignment, ResetToIdle
**Realism rationale:** After a stable release is published to @latest (phase = "publishing_stable"), the alignment workflow MUST eventually complete (reach "done"). AlignNext fires to set @next to a version >= @latest; ConfirmAlignment records the alignment; ResetToIdle returns to idle. All three actions are enabled when their guard phase conditions hold — the publish pipeline is an automated script (release.yml / publish.sh) that runs to completion without permanent blocking. Weak fairness on these actions models the assumption that the CI pipeline, once triggered, will not be permanently stuck.

**Source:** `formal/tla/DistTagAlignment.tla`, line 76, `Spec` definition
