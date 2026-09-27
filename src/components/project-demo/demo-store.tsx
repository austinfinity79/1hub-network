'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { DemoFrameContext, type DemoFrame } from '@/components/programme-demo/demo-frame'
import {
  parseProjectDemoState,
  projectDemoStoreKey,
  type ApplicationResult,
  type ProjectDemoState,
} from '@/lib/project-demo/application-store'
import { PROJECT_DEMO_COPY } from '@/lib/project-demo/copy'

/**
 * WF05-T00 — browser side of the demo application store (DEC-WF05-G5,
 * DEC-WF05-T00-D1). `sessionStorage` under this actor's key only; a same-tab
 * event re-renders subscribers after each write. A write the browser refuses
 * changes nothing and is reported. "Đặt lại demo" removes this key only — never
 * auth, the WF04 demo key or any canonical data. Nothing is sent to the server.
 */

const CHANGE_EVENT = 'hub:wf05-demo-store'
const READ_FAILED = '\u0000wf05-demo-read-failed'
const noSubscription = () => () => {}

export type StoreRefusal = { ok: false; reason: 'STORAGE' }

type ProjectDemoStore = {
  state: ProjectDemoState
  /** False during the server render and hydration. */
  ready: boolean
  /** The browser refused to read the store; nothing can be shown or saved safely. */
  readFailed: boolean
  reread: () => void
  /**
   * Runs one pure transition on the current stored state and stores the result.
   * A refused transition changes nothing; a refused write is `STORAGE`.
   */
  mutate: (run: (state: ProjectDemoState) => ApplicationResult) => ApplicationResult | StoreRefusal
  reset: () => void
  /** Counts resets in this page, so screens can drop editor state that predates one. */
  generation: number
  flash: string | null
  setFlash: (message: string | null) => void
}

const StoreContext = createContext<ProjectDemoStore | null>(null)

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function ProjectDemoProvider({
  actorKey,
  children,
}: {
  actorKey: string
  children: ReactNode
}) {
  const key = projectDemoStoreKey(actorKey)
  const memory = useRef<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)

  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(CHANGE_EVENT, notify)
    return () => window.removeEventListener(CHANGE_EVENT, notify)
  }, [])
  const read = useCallback(() => {
    try {
      return storage()?.getItem(key) ?? memory.current
    } catch {
      return READ_FAILED
    }
  }, [key])
  const raw = useSyncExternalStore(subscribe, read, () => null)
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  const readFailed = raw === READ_FAILED
  const state = useMemo(() => parseProjectDemoState(readFailed ? null : raw), [raw, readFailed])

  const commit = useCallback(
    (next: ProjectDemoState | null): boolean => {
      const value = next ? JSON.stringify(next) : null
      try {
        const s = storage()
        if (!s) return false
        if (value === null) s.removeItem(key)
        else s.setItem(key, value)
      } catch {
        return false
      }
      memory.current = value
      window.dispatchEvent(new Event(CHANGE_EVENT))
      return true
    },
    [key],
  )

  const reset = useCallback(() => {
    commit(null)
    memory.current = null
    setFlash(null)
    setGeneration((g) => g + 1)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [commit])

  const store = useMemo<ProjectDemoStore>(
    () => ({
      state,
      ready,
      readFailed,
      reread: () => window.dispatchEvent(new Event(CHANGE_EVENT)),
      mutate: (run) => {
        // Never write over a store that could not be read.
        const current = read()
        if (current === READ_FAILED) return { ok: false, reason: 'STORAGE' }
        const result = run(parseProjectDemoState(current))
        if (!result.ok) return result
        return commit(result.state) ? result : { ok: false, reason: 'STORAGE' }
      },
      reset,
      generation,
      flash,
      setFlash,
    }),
    [state, ready, readFailed, read, commit, reset, generation, flash],
  )
  const frame = useMemo<DemoFrame>(
    () => ({ reset, flash, setFlash, copy: PROJECT_DEMO_COPY }),
    [reset, flash],
  )

  return (
    <StoreContext.Provider value={store}>
      <DemoFrameContext.Provider value={frame}>{children}</DemoFrameContext.Provider>
    </StoreContext.Provider>
  )
}

export function useProjectDemo(): ProjectDemoStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useProjectDemo must be used inside ProjectDemoProvider')
  return store
}
