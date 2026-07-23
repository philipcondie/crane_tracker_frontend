import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
// Base cluster CSS only — positioning and the spiderfy/zoom animations.
// MarkerCluster.Default.css is deliberately NOT imported: its green/yellow
// bubbles fight the blueprint palette. Cluster appearance comes from
// clusterIcon() in map/icons.ts instead.
import 'leaflet.markercluster/dist/MarkerCluster.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
