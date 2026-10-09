import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

/** Current route from `#/route`, falling back when unknown. */
export function useHashRoute<T extends string>(routes: readonly T[], fallback: T): [T, (r: T) => void] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  const raw = hash.replace(/^#\/?/, '')
  const route = (routes as readonly string[]).includes(raw) ? (raw as T) : fallback
  const navigate = (r: T) => {
    window.location.hash = `/${r}`
  }
  return [route, navigate]
}
