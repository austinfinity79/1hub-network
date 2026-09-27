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

import type { OrganizationAllowance } from '@/lib/programme-demo/readiness'
import {
  demoStoreKey,
  parseDemoState,
  withProgramme,
  withoutProgramme,
  type DemoSessionState,
} from '@/lib/programme-demo/session-store'
import type { ProgrammeDemoDetailDTO } from '@/lib/programme-demo/types'

/**
 * WF04-T00 — browser side of the Programme demo session store
 * (DEC-WF04-T00-D3). `sessionStorage` under one key per actor; a same-tab event
 * re-renders subscribers after each write. A write the browser refuses is
 * reported to the caller and changes nothing (DEC-WF04-S02-D4). Nothing is sent
 * to the server.
 */

const CHANGE_EVENT = 'hub:wf04-demo-store'
/** Snapshot when the browser refuses to read the store (distinct from "nothing stored"). */
const READ_FAILED = '\u0000wf04-demo-read-failed'
const noSubscription = () => () => {}

type DemoStore = {
  state: DemoSessionState
  allowance: OrganizationAllowance
  /** False when the browser refused to store it; nothing is saved then. */
  save: (detail: ProgrammeDemoDetailDTO, created?: boolean) => boolean
  remove: (id: string) => boolean
  reset: () => void
  /** Counts resets in this page, so screens can drop editor state that predates one. */
  generation: number
  /** A one-off confirmation for the next screen (kept in memory, gone on reload). */
  flash: string | null
  /** False during the server render and hydration: the session state is not read yet. */
  ready: boolean
  /** The browser refused to read the session store; nothing can be shown or saved safely. */
  readFailed: boolean
  /** Reads the session store again (after a read failure). */
  reread: () => void
  setFlash: (message: string | null) => void
}

const StoreContext = createContext<DemoStore | null>(null)

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function ProgrammeDemoProvider({
  actorKey,
  allowance,
  children,
}: {
  actorKey: string
  allowance: OrganizationAllowance
  children: ReactNode
}) {
  const key = demoStoreKey(actorKey)
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
  // The server (and hydration) always renders the fixture state.
  const raw = useSyncExternalStore(subscribe, read, () => null)
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  const readFailed = raw === READ_FAILED
  const state = useMemo(() => parseDemoState(readFailed ? null : raw), [raw, readFailed])

  const commit = useCallback(
    (next: DemoSessionState | null): boolean => {
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

  const store = useMemo<DemoStore>(
    () => ({
      state,
      allowance,
      // Never write over a store that could not be read.
      save: (detail, created) => {
        const current = read()
        return (
          current !== READ_FAILED && commit(withProgramme(parseDemoState(current), detail, created))
        )
      },
      remove: (id) => {
        const current = read()
        return current !== READ_FAILED && commit(withoutProgramme(parseDemoState(current), id))
      },
      reset: () => {
        commit(null)
        memory.current = null
        setFlash(null)
        setGeneration((g) => g + 1)
        window.dispatchEvent(new Event(CHANGE_EVENT))
      },
      generation,
      flash,
      setFlash,
      ready,
      readFailed,
      reread: () => window.dispatchEvent(new Event(CHANGE_EVENT)),
    }),
    [state, allowance, commit, read, generation, flash, ready, readFailed],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useProgrammeDemo(): DemoStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useProgrammeDemo must be used inside ProgrammeDemoProvider')
  return store
}
