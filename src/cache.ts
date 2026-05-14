/**
 * Generic LRU cache with TTL, size limits, and stats tracking.
 */

export interface CacheOptions {
  maxSize?: number
  ttlMs?: number
  onEvict?: (key: string, value: unknown) => void
}

interface CacheEntry<V> {
  value: V
  expiresAt: number | null
  lastAccessed: number
  hits: number
}

export class LRUCache<K extends string, V> {
  private store = new Map<K, CacheEntry<V>>()
  private maxSize: number
  private ttlMs: number | null
  private onEvict?: (key: K, value: V) => void
  private _hits = 0
  private _misses = 0

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 256
    this.ttlMs = options.ttlMs ?? null
    this.onEvict = options.onEvict as ((key: K, value: V) => void) | undefined
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) this.store.delete(key)
    if (this.store.size >= this.maxSize) this.evictLRU()
    this.store.set(key, {
      value,
      expiresAt: this.ttlMs ? Date.now() + this.ttlMs : null,
      lastAccessed: Date.now(),
      hits: 0,
    })
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key)
    if (!entry) { this._misses++; return undefined }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key)
      this._misses++
      return undefined
    }
    entry.lastAccessed = Date.now()
    entry.hits++
    this._hits++
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.value
  }

  has(key: K): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    if (entry.expiresAt && Date.now() > entry.expiresAt) { this.delete(key); return false }
    return true
  }

  delete(key: K): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    this.store.delete(key)
    this.onEvict?.(key, entry.value)
    return true
  }

  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.store) this.onEvict(key, entry.value)
    }
    this.store.clear()
  }

  private evictLRU(): void {
    const oldest = [...this.store.entries()].reduce((a, b) =>
      a[1].lastAccessed < b[1].lastAccessed ? a : b
    )
    this.delete(oldest[0])
  }

  purgeExpired(): number {
    const now = Date.now()
    let count = 0
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && now > entry.expiresAt) { this.delete(key); count++ }
    }
    return count
  }

  get size(): number { return this.store.size }
  get hitRate(): number {
    const total = this._hits + this._misses
    return total === 0 ? 0 : this._hits / total
  }
  get stats() { return { hits: this._hits, misses: this._misses, size: this.store.size, hitRate: this.hitRate } }
  keys(): K[] { return [...this.store.keys()] }
  values(): V[] { return [...this.store.values()].map((e) => e.value) }
  entries(): [K, V][] { return [...this.store.entries()].map(([k, e]) => [k, e.value]) }
}
