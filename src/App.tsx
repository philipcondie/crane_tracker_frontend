import { Route, Routes } from 'react-router-dom'
import MapPage from './pages/MapPage'
// Feed and Stats are deferred (v2/v3). They still read the whole in-memory
// dataset and haven't been migrated to the bounding-box API, so they're
// unrouted for now — everything falls through to the map.
// import FeedPage from './pages/FeedPage'
// import StatsPage from './pages/StatsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MapPage />} />
      {/* <Route path="/feed" element={<FeedPage />} /> */}
      {/* <Route path="/stats" element={<StatsPage />} /> */}
      <Route path="*" element={<MapPage />} />
    </Routes>
  )
}
