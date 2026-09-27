import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react'
import { customerApi } from '../lib/api'
import type { Order, PaymentMethod } from '../types'
import { initialState, randomId, randomPickupCode, reducer, STATE_VERSION, type Action, type AppState } from './reducer'

const STORAGE_KEY = 'buko:state'

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === STATE_VERSION) return { ...initialState(), ...parsed }
    }
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  return initialState()
}

const StateContext = createContext<AppState | null>(null)
const DispatchContext = createContext<Dispatch<Action> | null>(null)

interface Sync {
  /** True once the server answered: stock and orders are live and shared. False = offline demo data. */
  live: boolean
  refresh: () => Promise<void>
}
const SyncContext = createContext<Sync>({ live: false, refresh: async () => {} })

/** How often live stock is refreshed while the app is open. */
const REFRESH_MS = 60_000

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const [live, setLive] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [stores, orders] = await Promise.all([customerApi.stores(), customerApi.orders()])
      if (!Array.isArray(stores) || !Array.isArray(orders)) throw new Error('No API')
      dispatch({ type: 'hydrateStores', stores })
      dispatch({ type: 'upsertOrders', orders })
      setLive(true)
    } catch {
      // No backend reachable (local dev or database not connected): keep the built-in demo data.
      setLive(false)
    }
  }, [])

  useEffect(() => {
    // Initial load from the server; the callback only updates state once the request resolves.
    refresh()
    const id = setInterval(refresh, REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const sync = useMemo(() => ({ live, refresh }), [live, refresh])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore quota / privacy-mode errors.
    }
  }, [state])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
      </DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function useAppState(): AppState {
  const ctx = useContext(StateContext)
  if (!ctx) throw new Error('useAppState must be used inside AppProvider')
  return ctx
}

export function useDispatch(): Dispatch<Action> {
  const ctx = useContext(DispatchContext)
  if (!ctx) throw new Error('useDispatch must be used inside AppProvider')
  return ctx
}

/** Current time, refreshed every 30 s so countdowns and "collect now" stay live. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function useSync(): Sync {
  return useContext(SyncContext)
}

/**
 * Order actions that go through the server when it is reachable and fall back
 * to local demo state otherwise. Server errors (e.g. sold out) are thrown as ApiError.
 */
export function useOrderActions() {
  const dispatch = useDispatch()
  const { live, refresh } = useSync()
  return useMemo(() => {
    const save = (order: Order) => dispatch({ type: 'upsertOrders', orders: [order] })
    return {
      async reserve(storeId: string, quantity: number, paymentMethod: PaymentMethod): Promise<string> {
        if (!live) {
          const orderId = randomId()
          dispatch({ type: 'reserve', storeId, quantity, paymentMethod, now: Date.now(), orderId, pickupCode: randomPickupCode() })
          return orderId
        }
        try {
          const order = await customerApi.reserve(storeId, quantity, paymentMethod)
          save(order)
          return order.id
        } finally {
          refresh()
        }
      },
      async cancel(orderId: string) {
        if (!live) return dispatch({ type: 'cancelOrder', orderId })
        save(await customerApi.cancel(orderId))
        refresh()
      },
      async collect(orderId: string) {
        if (!live) return dispatch({ type: 'collectOrder', orderId, now: Date.now() })
        save(await customerApi.collect(orderId))
      },
      async rate(orderId: string, rating: number, tags: string[]) {
        if (!live) return dispatch({ type: 'rateOrder', orderId, rating, tags })
        save(await customerApi.rate(orderId, rating, tags))
      },
    }
  }, [dispatch, live, refresh])
}
