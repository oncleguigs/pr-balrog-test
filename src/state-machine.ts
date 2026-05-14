/**
 * Finite state machine with typed states, transitions, guards, and hooks.
 */

export type StateId = string
export type EventId = string

export interface Transition<Context> {
  from: StateId | StateId[]
  event: EventId
  to: StateId
  guard?: (ctx: Context) => boolean
  action?: (ctx: Context) => void | Promise<void>
}

export interface StateHooks<Context> {
  onEnter?: (ctx: Context) => void | Promise<void>
  onExit?: (ctx: Context) => void | Promise<void>
}

export interface StateMachineConfig<Context> {
  initial: StateId
  states: Record<StateId, StateHooks<Context>>
  transitions: Transition<Context>[]
  context: Context
}

export class StateMachine<Context extends object> {
  private current: StateId
  private context: Context
  private states: Record<StateId, StateHooks<Context>>
  private transitions: Transition<Context>[]
  private history: Array<{ from: StateId; to: StateId; event: EventId; at: Date }> = []

  constructor(config: StateMachineConfig<Context>) {
    this.current = config.initial
    this.context = { ...config.context }
    this.states = config.states
    this.transitions = config.transitions
  }

  get state(): StateId { return this.current }
  get ctx(): Readonly<Context> { return this.context }

  can(event: EventId): boolean {
    return this.transitions.some((t) => {
      const froms = Array.isArray(t.from) ? t.from : [t.from]
      if (!froms.includes(this.current) || t.event !== event) return false
      return !t.guard || t.guard(this.context)
    })
  }

  async send(event: EventId): Promise<boolean> {
    const transition = this.transitions.find((t) => {
      const froms = Array.isArray(t.from) ? t.from : [t.from]
      if (!froms.includes(this.current) || t.event !== event) return false
      return !t.guard || t.guard(this.context)
    })

    if (!transition) return false

    const exitHook = this.states[this.current]?.onExit
    if (exitHook) await exitHook(this.context)

    if (transition.action) await transition.action(this.context)

    this.history.push({ from: this.current, to: transition.to, event, at: new Date() })
    this.current = transition.to

    const enterHook = this.states[this.current]?.onEnter
    if (enterHook) await enterHook(this.context)

    return true
  }

  updateContext(patch: Partial<Context>): void {
    Object.assign(this.context, patch)
  }

  getHistory(): Readonly<Array<{ from: StateId; to: StateId; event: EventId; at: Date }>> {
    return this.history
  }

  matches(state: StateId | StateId[]): boolean {
    const states = Array.isArray(state) ? state : [state]
    return states.includes(this.current)
  }

  reset(context?: Partial<Context>): void {
    this.current = Object.keys(this.states)[0]
    if (context) Object.assign(this.context, context)
    this.history = []
  }
}

// ---------------------------------------------------------------------------
// Builder API
// ---------------------------------------------------------------------------

export class StateMachineBuilder<Context extends object> {
  private config: Partial<StateMachineConfig<Context>> = {
    states: {},
    transitions: [],
  }

  initial(state: StateId): this {
    this.config.initial = state
    return this
  }

  context(ctx: Context): this {
    this.config.context = ctx
    return this
  }

  state(id: StateId, hooks: StateHooks<Context> = {}): this {
    this.config.states![id] = hooks
    return this
  }

  transition(t: Transition<Context>): this {
    this.config.transitions!.push(t)
    return this
  }

  build(): StateMachine<Context> {
    if (!this.config.initial) throw new Error('Initial state is required')
    if (!this.config.context) throw new Error('Context is required')
    return new StateMachine(this.config as StateMachineConfig<Context>)
  }
}
