import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import type { SessionUser } from './types'

interface Health {
  ok: boolean
  needsSetup: boolean
}

interface AuthState {
  user: SessionUser | null
  /** null while loading; 'no-database' when the backend is deployed without Postgres. */
  health: Health | 'no-database' | 'offline' | null
  setUser: (u: SessionUser | null) => void
  logout: () => Promise<void>
  reload: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [health, setHealth] = useState<AuthState['health']>(null)

  const reload = useCallback(async () => {
    try {
      const [h, me] = await Promise.all([api<Health>('health'), api<{ user: SessionUser | null }>('auth/me')])
      setHealth(h)
      setUser(me.user)
    } catch (err) {
      setHealth(err instanceof ApiError && err.code === 'NO_DATABASE' ? 'no-database' : 'offline')
    }
  }, [])

  useEffect(() => {
    // Initial session check; state is set when the request resolves.
    reload()
  }, [reload])

  const logout = useCallback(async () => {
    await api('auth/logout', { method: 'POST', json: {} }).catch(() => {})
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, health, setUser, logout, reload }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** Loads an API resource, optionally re-polling it. Keeps showing the last data while refreshing. */
export function useResource<T>(path: string | null, pollMs?: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  // Latest requested path, so a slow response for an old path is ignored.
  const pathRef = useRef(path)
  useEffect(() => {
    pathRef.current = path
  }, [path])

  const reload = useCallback(async () => {
    if (!path) return
    try {
      const result = await api<T>(path)
      if (pathRef.current !== path) return
      setData(result)
      setError(null)
      setLoadedAt(Date.now())
    } catch (err) {
      if (pathRef.current === path) setError(err instanceof Error ? err.message : 'Could not load data.')
    }
  }, [path])

  useEffect(() => {
    // Fetch on mount / path change; results arrive asynchronously.
    reload()
    if (!pollMs) return
    const id = setInterval(() => document.visibilityState === 'visible' && reload(), pollMs)
    return () => clearInterval(id)
  }, [reload, pollMs])

  return { data, error, loading: !data && !error, loadedAt, reload, setData }
}

interface Toast {
  id: number
  text: string
  tone: 'success' | 'error'
}
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <p
            key={t.id}
            className={`toast-in rounded-xl px-4 py-2.5 text-sm font-medium shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] ${
              t.tone === 'success' ? 'bg-ink text-white' : 'bg-red-600 text-white'
            }`}
          >
            {t.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
