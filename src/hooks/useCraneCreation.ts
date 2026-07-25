import { useCallback, useRef, useState } from 'react'
import { createCrane, type NewCraneInput } from '../api/client'
import type { CraneSummary } from '../types'

interface Result {
  creating: boolean
  isCreating: () => boolean
  createOnce: (input: NewCraneInput) => Promise<CraneSummary | null>
}

/**
 * Allows only one create request at a time. The ref closes the gap before
 * React commits `creating=true`, where two clicks in one frame could otherwise
 * both reach the backend.
 */
export function useCraneCreation(): Result {
  const [creating, setCreating] = useState(false)
  const inFlight = useRef(false)

  const isCreating = useCallback(() => inFlight.current, [])

  const createOnce = useCallback(async (input: NewCraneInput) => {
    if (inFlight.current) return null
    inFlight.current = true
    setCreating(true)
    try {
      return await createCrane(input)
    } finally {
      inFlight.current = false
      setCreating(false)
    }
  }, [])

  return { creating, isCreating, createOnce }
}
