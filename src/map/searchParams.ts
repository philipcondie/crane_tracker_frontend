/** Remove a consumed or failed crane deep link while preserving other map params. */
export function withoutCraneParam(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current)
  next.delete('crane')
  return next
}
