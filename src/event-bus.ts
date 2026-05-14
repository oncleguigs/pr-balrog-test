/**
 * Typed in-process event bus with wildcard support and once() listeners.
 */

type Listener<T> = (event: T) => void | Promise<void>

interface Subscription {
  topic: string
  listener: Listener<unknown>
  once: boolean
}

export class EventBus {
  private subscriptions: Subscription[] = []
  private history = new Map<string, unknown[]>()
  private maxHistory: number

  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory
  }

  on<T>(topic: string, listener: Listener<T>): () => void {
    const sub: Subscription = { topic, listener: listener as Listener<unknown>, once: false }
    this.subscriptions.push(sub)
    return () => this.off(topic, listener)
  }

  once<T>(topic: string, listener: Listener<T>): () => void {
    const sub: Subscription = { topic, listener: listener as Listener<unknown>, once: true }
    this.subscriptions.push(sub)
    return () => this.off(topic, listener)
  }

  off<T>(topic: string, listener: Listener<T>): void {
    this.subscriptions = this.subscriptions.filter(
      (s) => !(s.topic === topic && s.listener === (listener as Listener<unknown>))
    )
  }

  async emit<T>(topic: string, event: T): Promise<void> {
    const hist = this.history.get(topic) ?? []
    hist.push(event)
    if (hist.length > this.maxHistory) hist.shift()
    this.history.set(topic, hist)

    const matched = this.subscriptions.filter(
      (s) => s.topic === topic || s.topic === '*'
    )

    const toRemove: Subscription[] = []
    for (const sub of matched) {
      await sub.listener(event)
      if (sub.once) toRemove.push(sub)
    }
    this.subscriptions = this.subscriptions.filter((s) => !toRemove.includes(s))
  }

  replay<T>(topic: string, listener: Listener<T>): void {
    const hist = (this.history.get(topic) ?? []) as T[]
    for (const event of hist) listener(event)
  }

  clear(topic?: string): void {
    if (topic) {
      this.history.delete(topic)
      this.subscriptions = this.subscriptions.filter((s) => s.topic !== topic)
    } else {
      this.history.clear()
      this.subscriptions = []
    }
  }

  listenerCount(topic: string): number {
    return this.subscriptions.filter((s) => s.topic === topic || s.topic === '*').length
  }
}
