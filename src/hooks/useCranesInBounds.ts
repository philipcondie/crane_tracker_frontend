import { useCallback, useEffect, useRef, useState } from 'react'
import { getCranesInBounds, type Bounds } from '../api/client'
import type { CraneSummary } from '../types'

const DEBOUNCE_MS = 350

interface State {
  cranes: CraneSummary[]
  loading: boolean
  error: string | null
}

interface Result extends State {
  /**
   * Show a just-created crane immediately, before the refetch that confirms it.
   * Without this the pin is missing for a full round trip after the temp marker
   * is removed, which reads as a flicker.
   *
   * The insert is provisional: the next completed fetch replaces the list
   * wholesale, so a crane the server doesn't return simply disappears.
   */
  addOptimistic: (crane: CraneSummary) => void
}

/**
 * Fetches crane summaries for the given viewport bounds. Debounces rapid bounds
 * changes (map panning) and must guard against out-of-order responses: when the
 * user pans quickly, an earlier request can resolve AFTER a later one and clobber
 * fresher data on screen.
 *
 * Pass `null` bounds to skip fetching (e.g. before the map has initialized).
 *
 * `refetchToken` forces a refetch of the *same* viewport. Bounds alone can't
 * express "same view, new data": syncBounds deliberately preserves the previous
 * object when the viewport is numerically unchanged, so writes that don't move
 * the map (adding a crane) would otherwise never re-run this effect. Bump the
 * token to invalidate.
 */
export function useCranesInBounds(bounds: Bounds | null, refetchToken = 0): Result {
  const [state, setState] = useState<State>({ cranes: [], loading: false, error: null })

  // Holds the AbortController for the request currently in flight, so a newer
  // request can cancel it. Lives in a ref so it survives re-renders.
  const inFlight = useRef<AbortController | null>(null)

  // Last token this effect ran for, so a run can tell whether it was triggered
  // by the token (a write — fetch now) or by bounds (a pan — debounce).
  const lastToken = useRef(refetchToken)

  const addOptimistic = useCallback((crane: CraneSummary) => {
    setState((s) =>
      s.cranes.some((c) => c.id === crane.id) ? s : { ...s, cranes: [...s.cranes, crane] },
    )
  }, [])

  useEffect(() => {
    if (!bounds) return

    // A token bump means a write just landed, so skip the debounce: it exists to
    // throttle panning, and waiting here only widens the window where the new
    // crane is missing from the map.
    const immediate = refetchToken !== lastToken.current
    lastToken.current = refetchToken

    // The controller this effect run creates, if its debounce fires. Cleanup
    // aborts only this one — never inFlight.current, which by then may point at
    // a newer request that should survive.
    let own: AbortController | null = null

    const run = () => {
      // Abort-on-new: cancel any in-flight request so a slow response for an old
      // viewport can't clobber the current one.
      inFlight.current?.abort()
      const controller = new AbortController()
      own = controller
      inFlight.current = controller

      // Keep existing cranes on screen while loading so the map doesn't flash
      // empty — this is also what preserves an optimistic pin until its refetch
      // lands.
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
    }

    // window.setTimeout(fn, 0) rather than calling run() inline: an immediate
    // synchronous fetch would setState during render-phase effect setup, and
    // keeping one code path means cleanup can cancel either kind the same way.
    const timer = window.setTimeout(run, immediate ? 0 : DEBOUNCE_MS)

    // Clearing the timer only helps if the debounce hasn't fired yet. If it has,
    // the fetch is already live and must be aborted, or it resolves into a
    // setState on an unmounted component (and leaks the connection).
    return () => {
      window.clearTimeout(timer)
      own?.abort()
      if (inFlight.current === own) inFlight.current = null
    }
  }, [bounds, refetchToken])

  return { ...state, addOptimistic }
}
