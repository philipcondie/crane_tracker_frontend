import { NavLink } from 'react-router-dom'

interface Props {
  floating?: boolean
  /** Shift left to stay centered over the visible map when the desktop rail is open */
  railOffset?: boolean
  round?: boolean
}

const seg = ({ isActive }: { isActive: boolean }) => (isActive ? 'pill-seg active' : 'pill-seg')

export function PillNav({ floating, railOffset, round }: Props) {
  const cls = [
    'pill-nav',
    floating ? 'floating' : '',
    railOffset ? 'rail-offset' : '',
    round ? 'round' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <nav className={cls}>
      <NavLink to="/" end className={seg}>
        ▲ MAP
      </NavLink>
      {/* FEED and STATS are deferred (v2/v3) until they're migrated to the API. */}
    </nav>
  )
}
