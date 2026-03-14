package deployment

// Deployment lifecycle FSM using looplab/fsm.
// States: created → building → testing → deploying → live | rolled_back

import "github.com/looplab/fsm"

func NewDeploymentFSM() *fsm.FSM {
	return fsm.NewFSM(
		"created",
		fsm.Events{
			{Name: "build", Src: []string{"created"}, Dst: "building"},
			{Name: "test", Src: []string{"building"}, Dst: "testing"},
			{Name: "deploy", Src: []string{"testing"}, Dst: "deploying"},
			{Name: "go_live", Src: []string{"deploying"}, Dst: "live"},
			{Name: "rollback", Src: []string{"deploying", "live"}, Dst: "rolled_back"},
			{Name: "retry", Src: []string{"rolled_back"}, Dst: "building"},
		},
		fsm.Callbacks{},
	)
}
