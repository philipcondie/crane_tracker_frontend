import { Route, Routes } from 'react-router-dom'
import MapPage from './pages/MapPage'
import FeedPage from './pages/FeedPage'
import StatsPage from './pages/StatsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MapPage />} />
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/stats" element={<StatsPage />} />
      <Route path="*" element={<MapPage />} />
    </Routes>
  )
}
