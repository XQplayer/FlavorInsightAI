const environment = typeof import.meta.env === 'object' ? import.meta.env : {}
const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location?.hostname)

export const SHIMADZU_DATA_API_URL = environment.VITE_FEMA_API_URL
  || (localHost ? 'http://127.0.0.1:8787' : 'https://flavorthresholddb-api.onrender.com')

export async function requestShimadzuJson(url, { fetchImpl = fetch, signal, timeoutMs = 35000, attempts = 2, retryDelayMs = 250 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    signal?.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort(signal.reason)
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, { signal: controller.signal })
      if (!response.ok) throw Object.assign(new Error(`HTTP_${response.status || 'UNKNOWN'}`), { status: response.status })
      return await response.json()
    } catch (error) {
      if (signal?.aborted) throw error
      const retryable = !error.status || error.status === 429 || error.status >= 500
      if (!retryable || attempt === attempts - 1) throw error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
    await new Promise((resolve, reject) => {
      const finish = () => { signal?.removeEventListener('abort', abort); resolve() }
      const timer = setTimeout(finish, retryDelayMs)
      const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason) }
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
    })
  }
}
