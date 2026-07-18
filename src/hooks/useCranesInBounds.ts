import { useEffect, useRef, useState } from 'react'
import { getCranesInBounds, type Bounds } from '../api/client'
import type { CraneSummary } from '../types'

const DEBOUNCE_MS = 350

interface State {
  cranes: CraneSummary[]
  loading: boolean
  error: string | null
}

/**
 * Fetches crane summaries for the given viewport bounds. Debounces rapid bounds
 * changes (map panning) and must guard against out-of-order responses: when the
 * user pans quickly, an earlier request can resolve AFTER a later one and clobber
 * fresher data on screen.
 *
 * Pass `null` bounds to skip fetching (e.g. before the map has initialized).
 */
export function useCranesInBounds(bounds: Bounds | null): State {
  const [state, setState] = useState<State>({ cranes: [], loading: false, error: null })

  // Holds the AbortController for the request currently in flight, so a newer
  // request can cancel it. Lives in a ref so it survives re-renders.
  const inFlight = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!bounds) return

    // The controller this effect run creates, if its debounce fires. Cleanup
    // aborts only this one — never inFlight.current, which by then may point at
    // a newer request that should survive.
    let own: AbortController | null = null

    const timer = window.setTimeout(() => {
      // Abort-on-new: cancel any in-flight request so a slow response for an old
      // viewport can't clobber the current one.
      inFlight.current?.abort()
      const controller = new AbortController()
      own = controller
      inFlight.current = controller

      // Keep existing cranes on screen while loading so the map doesn't flash empty.
      setState((s) => ({ ...s, loading: true, error: null }))

      getCranesInBounds(bounds, controller.signal)
        .then((cranes) => setState({ cranes, loading: false, error: null }))
        .catch((err: unknown) => {
          // A superseded request rejects with AbortError — ignore it entirely.
          if (err instanceof DOMException && err.name === 'AbortError') return
          const message = err instanceof Error ? err.message : String(err)
          // Drop the previous viewport's cranes. Retaining them is right while
          // loading (avoids a flash of empty map) but wrong here: pins from the
          // old viewport would render as if they belonged to the new one.
          setState({ cranes: [], loading: false, error: message })
        })
    }, DEBOUNCE_MS)

    // Clearing the timer only helps if the debounce hasn't fired yet. If it has,
    // the fetch is already live and must be aborted, or it resolves into a
    // setState on an unmounted component (and leaks the connection).
    return () => {
      window.clearTimeout(timer)
      own?.abort()
      if (inFlight.current === own) inFlight.current = null
    }
  }, [bounds])

  return state
}
