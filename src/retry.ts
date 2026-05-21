/**
 * Generic retry utility with exponential backoff, jitter, and abort support.
 */

export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
  jitter?: boolean
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
  signal?: AbortSignal
}

function computeDelay(attempt: number, options: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry' | 'signal'>>): number {
  const base = options.initialDelayMs * Math.pow(options.backoffFactor, attempt - 1)
  const capped = Math.min(base, options.maxDelayMs)
  return options.jitter ? capped * (0.5 + Math.random() * 0.5) : capped
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 200,
    maxDelayMs = 5000,
    backoffFactor = 2,
    jitter = true,
    shouldRetry = () => true,
    onRetry,
    signal,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error('Aborted')
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxAttempts || !shouldRetry(err, attempt)) throw err
      const delay = computeDelay(attempt, { maxAttempts, initialDelayMs, maxDelayMs, backoffFactor, jitter })
      onRetry?.(err, attempt, delay)
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delay)
        signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('Aborted')) })
      })
    }
  }
  throw lastError
}

export function retrySync<T>(fn: () => T, maxAttempts = 3): T {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return fn() } catch (err) { lastError = err }
  }
  throw lastError
}
