import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App'
import { CraneProvider } from './store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CraneProvider>
        <App />
      </CraneProvider>
    </BrowserRouter>
  </StrictMode>,
)
