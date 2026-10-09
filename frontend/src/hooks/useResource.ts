import { useEffect, useEffectEvent, useState } from 'react'

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Unexpected error.'
}

interface Settled<T> {
  key: string
  data?: T
  error?: string
}

export interface Resource<T> {
  /** Latest successful result, kept while a newer request is in flight. */
  data: T | undefined
  error: string | undefined
  loading: boolean
  /** True when `data` belongs to an older request than the current key. */
  stale: boolean
  retry: () => void
}

/**
 * Loads `load()` whenever `key` changes. A response for an older key is
 * discarded, so a slow earlier request can never overwrite newer results.
 * Pass `key = null` to pause loading.
 */
export function useResource<T>(key: string | null, load: () => Promise<T>): Resource<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const [lastGood, setLastGood] = useState<{ key: string; data: T } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const runLoad = useEffectEvent(load)
  const fullKey = key === null ? null : `${key}#${attempt}`

  useEffect(() => {
    if (fullKey === null) return
    let active = true
    runLoad().then(
      (data) => {
        if (!active) return
        setSettled({ key: fullKey, data })
        setLastGood({ key: fullKey, data })
      },
      (e: unknown) => {
        if (active) setSettled({ key: fullKey, error: messageOf(e) })
      },
    )
    return () => {
      active = false
    }
  }, [fullKey])

  const current = settled?.key === fullKey ? settled : null
  return {
    data: lastGood?.data,
    error: current?.error,
    loading: fullKey !== null && current === null,
    stale: lastGood !== null && lastGood.key !== fullKey,
    retry: () => setAttempt((n) => n + 1),
  }
}

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
