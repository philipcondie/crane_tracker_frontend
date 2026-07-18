import { useEffect, useState } from 'react'
import { getCrane } from '../api/client'
import type { CraneDetail } from '../types'

interface State {
  crane: CraneDetail | null
  loading: boolean
  error: string | null
}

/**
 * Loads the full CraneDetail for a selected crane. Pass `null` when nothing is
 * selected. Aborts an in-flight fetch if the selection changes before it resolves.
 */
export function useCraneDetail(id: string | null): State {
  const [state, setState] = useState<State>({ crane: null, loading: false, error: null })

  useEffect(() => {
    if (!id) {
      setState({ crane: null, loading: false, error: null })
      return
    }
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    getCrane(id, controller.signal)
      .then((crane) => setState({ crane, loading: false, error: null }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : String(err)
        setState({ crane: null, loading: false, error: message })
      })
    return () => controller.abort()
  }, [id])

  return state
}
