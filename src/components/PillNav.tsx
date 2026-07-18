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
      <NavLink to="/feed" className={seg}>
        FEED
      </NavLink>
      <NavLink to="/stats" className={seg}>
        STATS
      </NavLink>
    </nav>
  )
}
