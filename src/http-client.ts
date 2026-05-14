/**
 * Minimal HTTP client with retry, timeout, and request/response interceptors.
 */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
}

export interface Response<T> {
  status: number
  headers: Record<string, string>
  data: T
  durationMs: number
}

type RequestInterceptor = (url: string, options: RequestOptions) => RequestOptions
type ResponseInterceptor<T> = (response: Response<T>) => Response<T>

export class HttpClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>
  private requestInterceptors: RequestInterceptor[] = []
  private responseInterceptors: ResponseInterceptor<unknown>[] = []

  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.defaultHeaders = defaultHeaders
  }

  addRequestInterceptor(fn: RequestInterceptor): this {
    this.requestInterceptors.push(fn)
    return this
  }

  addResponseInterceptor<T>(fn: ResponseInterceptor<T>): this {
    this.responseInterceptors.push(fn as ResponseInterceptor<unknown>)
    return this
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<Response<T>> {
    let opts = { ...options }
    for (const interceptor of this.requestInterceptors) {
      opts = interceptor(path, opts)
    }

    const {
      method = 'GET',
      headers = {},
      body,
      timeoutMs = 10000,
      retries = 0,
      retryDelayMs = 500,
    } = opts

    const url = `${this.baseUrl}${path}`
    const mergedHeaders = { ...this.defaultHeaders, ...headers }
    if (body) mergedHeaders['Content-Type'] = 'application/json'

    let attempt = 0
    while (true) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const start = Date.now()

      try {
        const raw = await fetch(url, {
          method,
          headers: mergedHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
        clearTimeout(timer)

        const responseHeaders: Record<string, string> = {}
        raw.headers.forEach((v, k) => { responseHeaders[k] = v })

        const data = await raw.json() as T
        let response: Response<T> = {
          status: raw.status,
          headers: responseHeaders,
          data,
          durationMs: Date.now() - start,
        }

        for (const interceptor of this.responseInterceptors) {
          response = interceptor(response) as Response<T>
        }

        if (!raw.ok) throw Object.assign(new Error(`HTTP ${raw.status}`), { response })
        return response
      } catch (err) {
        clearTimeout(timer)
        if (attempt >= retries) throw err
        attempt++
        await new Promise((r) => setTimeout(r, retryDelayMs * attempt))
      }
    }
  }

  get<T>(path: string, headers?: Record<string, string>): Promise<Response<T>> {
    return this.request<T>(path, { method: 'GET', headers })
  }

  post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<Response<T>> {
    return this.request<T>(path, { method: 'POST', body, headers })
  }

  put<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<Response<T>> {
    return this.request<T>(path, { method: 'PUT', body, headers })
  }

  patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<Response<T>> {
    return this.request<T>(path, { method: 'PATCH', body, headers })
  }

  delete<T>(path: string, headers?: Record<string, string>): Promise<Response<T>> {
    return this.request<T>(path, { method: 'DELETE', headers })
  }
}
