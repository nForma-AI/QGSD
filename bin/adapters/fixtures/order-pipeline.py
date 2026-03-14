"""
Order processing pipeline — 5-state FSM using Python transitions library.
Demonstrates: guards, multi-source transitions, lifecycle management.
"""
from transitions import Machine

states = ['pending', 'validating', 'processing', 'shipped', 'failed']

transitions = [
    {'trigger': 'validate', 'source': 'pending', 'dest': 'validating'},
    {'trigger': 'approve', 'source': 'validating', 'dest': 'processing'},
    {'trigger': 'reject', 'source': 'validating', 'dest': 'failed'},
    {'trigger': 'ship', 'source': 'processing', 'dest': 'shipped'},
    {'trigger': 'cancel', 'source': 'pending', 'dest': 'failed'},
    {'trigger': 'cancel', 'source': 'validating', 'dest': 'failed'},
    {'trigger': 'cancel', 'source': 'processing', 'dest': 'failed'},
]

class Order:
    pass

order = Order()
machine = Machine(model=order, states=states, transitions=transitions, initial='pending')
