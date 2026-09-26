'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
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
 * re-renders subscribers after each write. When the browser refuses storage the
 * state is kept in memory for the page's life. Nothing is sent to the server.
 */

const CHANGE_EVENT = 'hub:wf04-demo-store'

type DemoStore = {
  state: DemoSessionState
  allowance: OrganizationAllowance
  save: (detail: ProgrammeDemoDetailDTO, created?: boolean) => void
  remove: (id: string) => void
  reset: () => void
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

  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(CHANGE_EVENT, notify)
    return () => window.removeEventListener(CHANGE_EVENT, notify)
  }, [])
  const read = useCallback(() => {
    try {
      return storage()?.getItem(key) ?? memory.current
    } catch {
      return memory.current
    }
  }, [key])
  // The server (and hydration) always renders the fixture state.
  const raw = useSyncExternalStore(subscribe, read, () => null)
  const state = useMemo(() => parseDemoState(raw), [raw])

  const commit = useCallback(
    (next: DemoSessionState | null) => {
      const value = next ? JSON.stringify(next) : null
      memory.current = value
      try {
        const s = storage()
        if (value === null) s?.removeItem(key)
        else s?.setItem(key, value)
      } catch {
        // Memory keeps the state for this page.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT))
    },
    [key],
  )

  const store = useMemo<DemoStore>(
    () => ({
      state,
      allowance,
      save: (detail, created) => commit(withProgramme(parseDemoState(read()), detail, created)),
      remove: (id) => commit(withoutProgramme(parseDemoState(read()), id)),
      reset: () => commit(null),
    }),
    [state, allowance, commit, read],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useProgrammeDemo(): DemoStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useProgrammeDemo must be used inside ProgrammeDemoProvider')
  return store
}
