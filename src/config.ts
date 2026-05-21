/**
 * Layered config loader: defaults < file < env vars < runtime overrides.
 * Supports dot-notation keys and typed getters.
 */

type ConfigValue = string | number | boolean | null
type ConfigMap = Record<string, ConfigValue>

function dotGet(obj: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((cur, part) => {
    if (cur && typeof cur === 'object') return (cur as Record<string, unknown>)[part]
    return undefined
  }, obj)
}

function dotSet(obj: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

export class Config {
  private layers: Record<string, unknown>[] = []

  constructor(defaults: ConfigMap = {}) {
    this.layers.push(defaults as Record<string, unknown>)
  }

  loadEnv(prefix: string, env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): this {
    const layer: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(env)) {
      if (!k.startsWith(prefix + '_')) continue
      const key = k.slice(prefix.length + 1).toLowerCase().replace(/__/g, '.')
      if (v === 'true') dotSet(layer, key, true)
      else if (v === 'false') dotSet(layer, key, false)
      else if (v !== undefined && !isNaN(Number(v)) && v !== '') dotSet(layer, key, Number(v))
      else if (v !== undefined) dotSet(layer, key, v)
    }
    this.layers.push(layer)
    return this
  }

  set(key: string, value: ConfigValue): this {
    const top = this.layers[this.layers.length - 1]
    dotSet(top, key, value)
    return this
  }

  get(key: string): unknown {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const val = dotGet(this.layers[i], key)
      if (val !== undefined) return val
    }
    return undefined
  }

  getString(key: string, fallback?: string): string {
    const v = this.get(key)
    if (v === undefined || v === null) {
      if (fallback !== undefined) return fallback
      throw new Error(`Config key "${key}" is required`)
    }
    return String(v)
  }

  getNumber(key: string, fallback?: number): number {
    const v = this.get(key)
    const n = Number(v)
    if (v === undefined || v === null || isNaN(n)) {
      if (fallback !== undefined) return fallback
      throw new Error(`Config key "${key}" must be a number`)
    }
    return n
  }

  getBoolean(key: string, fallback?: boolean): boolean {
    const v = this.get(key)
    if (v === undefined || v === null) {
      if (fallback !== undefined) return fallback
      throw new Error(`Config key "${key}" must be a boolean`)
    }
    if (typeof v === 'boolean') return v
    return String(v).toLowerCase() === 'true'
  }

  has(key: string): boolean { return this.get(key) !== undefined }

  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const layer of this.layers) Object.assign(result, layer)
    return result
  }
}
