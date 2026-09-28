import { adaptStartups, type StartupDirectory } from './startup-adapter'

/**
 * TASK 22-PREVIEW-LIBRARY-FIX — server-side read of the public startup
 * directory for /library (DEC-L15-D7). One fetch per 10 minutes per server
 * process (the page itself is dynamic for the login button, so the fetch cache
 * is kept here, not in Next's fetch cache). Concurrent requests share one
 * in-flight fetch. A failed refresh serves the last good copy for up to a day,
 * then reports an error; it never substitutes invented data.
 */

export const STARTUP_SOURCE_URL =
  process.env.LIBRARY_STARTUP_SOURCE_URL?.trim() || 'https://startup.1hub.cloud/data/startup.json'

const TTL_MS = 10 * 60 * 1000
const STALE_MS = 24 * 60 * 60 * 1000
const TIMEOUT_MS = 5000
const MAX_BYTES = 2_000_000

type Entry = { at: number; data: Extract<StartupDirectory, { status: 'ok' }> }

declare global {
  var __hubStartupDirectory:
    { entry: Entry | null; pending: Promise<StartupDirectory> | null } | undefined
}

const state = () => (globalThis.__hubStartupDirectory ??= { entry: null, pending: null })

async function fetchDirectory(): Promise<StartupDirectory> {
  const res = await fetch(STARTUP_SOURCE_URL, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`startup source answered ${res.status}`)
  const text = await res.text()
  if (text.length > MAX_BYTES) throw new Error('startup source too large')
  return { status: 'ok', ...adaptStartups(JSON.parse(text)) }
}

export async function loadStartupDirectory(now = Date.now()): Promise<StartupDirectory> {
  const s = state()
  if (s.entry && now - s.entry.at < TTL_MS) return s.entry.data
  s.pending ??= fetchDirectory()
    .then((data) => {
      if (data.status === 'ok') s.entry = { at: Date.now(), data }
      return data
    })
    .catch((error: unknown) => {
      // Reason only: never the payload.
      console.warn('library startup source unavailable', (error as Error).name ?? 'Error')
      if (s.entry && now - s.entry.at < STALE_MS) return s.entry.data
      return { status: 'error' } as const
    })
    .finally(() => {
      s.pending = null
    })
  return s.pending
}
