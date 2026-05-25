/**
 * Task scheduler with priority queue and retry logic.
 */

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'retrying'

export interface Task {
  id: string
  name: string
  priority: TaskPriority
  status: TaskStatus
  retries: number
  maxRetries: number
  payload: unknown
  createdAt: Date
  scheduledAt?: Date
  startedAt?: Date
  finishedAt?: Date
  error?: string
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
}

export class TaskScheduler {
  private queue: Task[] = []
  private running = new Map<string, Task>()
  private concurrency: number
  private onTaskComplete?: (task: Task) => void
  private onTaskFail?: (task: Task, error: Error) => void

  constructor(concurrency = 4) {
    this.concurrency = concurrency
  }

  onComplete(cb: (task: Task) => void): this {
    this.onTaskComplete = cb
    return this
  }

  onFail(cb: (task: Task, error: Error) => void): this {
    this.onTaskFail = cb
    return this
  }

  enqueue(task: Omit<Task, 'status' | 'retries' | 'createdAt'>): Task {
    const t: Task = {
      ...task,
      status: 'pending',
      retries: 0,
      createdAt: new Date(),
    }
    this.queue.push(t)
    this.queue.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    return t
  }

  async tick(runner: (task: Task) => Promise<void>): Promise<void> {
    while (this.running.size < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!
      task.status = 'running'
      task.startedAt = new Date()
      this.running.set(task.id, task)

      runner(task)
        .then(() => {
          task.status = 'done'
          task.finishedAt = new Date()
          this.running.delete(task.id)
          this.onTaskComplete?.(task)
        })
        .catch((err: Error) => {
          if (task.retries < task.maxRetries) {
            task.retries++
            task.status = 'retrying'
            task.error = err.message
            this.running.delete(task.id)
            this.queue.unshift(task)
          } else {
            task.status = 'failed'
            task.finishedAt = new Date()
            task.error = err.message
            this.running.delete(task.id)
            this.onTaskFail?.(task, err)
          }
        })
    }
  }

  get pendingCount(): number { return this.queue.length }
  get runningCount(): number { return this.running.size }
  get isIdle(): boolean { return this.queue.length === 0 && this.running.size === 0 }

  drain(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.isIdle) resolve()
        else setTimeout(check, 50)
      }
      check()
    })
  }

  stats(): { pending: number; running: number } {
    return { pending: this.queue.length, running: this.running.size }
  }

  cancelPending(predicate: (task: Task) => boolean): number {
    const before = this.queue.length
    this.queue = this.queue.filter((t) => !predicate(t))
    return before - this.queue.length
  }
}
