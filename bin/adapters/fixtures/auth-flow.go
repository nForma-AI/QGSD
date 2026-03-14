package auth

// Auth flow using qmuntal/stateless — builder pattern with guards.

import "github.com/qmuntal/stateless"

const (
	stateUnauthenticated = "unauthenticated"
	stateAuthenticating  = "authenticating"
	stateAuthenticated   = "authenticated"
	stateLocked          = "locked"

	triggerLogin      = "login"
	triggerSuccess    = "success"
	triggerFail       = "fail"
	triggerLock       = "lock"
	triggerUnlock     = "unlock"
	triggerLogout     = "logout"
)

func NewAuthFSM() *stateless.StateMachine {
	sm := stateless.NewStateMachine(stateUnauthenticated)

	sm.Configure(stateUnauthenticated).
		Permit(triggerLogin, stateAuthenticating)

	sm.Configure(stateAuthenticating).
		Permit(triggerSuccess, stateAuthenticated).
		Permit(triggerFail, stateUnauthenticated).
		Permit(triggerLock, stateLocked)

	sm.Configure(stateAuthenticated).
		Permit(triggerLogout, stateUnauthenticated).
		Permit(triggerLock, stateLocked)

	sm.Configure(stateLocked).
		Permit(triggerUnlock, stateUnauthenticated)

	return sm
}
