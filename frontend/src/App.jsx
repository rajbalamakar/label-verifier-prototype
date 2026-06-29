import { useState, useEffect } from 'react'
import NavBar from './components/NavBar'
import LandingPage from './pages/LandingPage'
import SinglePage from './pages/SinglePage'
import BulkPage from './pages/BulkPage'
import RecentPage from './pages/RecentPage'
import { getMe } from './api'

export default function App() {
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState('home') // 'home' | 'single' | 'bulk'

  useEffect(() => {
    getMe().then(r => setUser(r.data)).catch(() => {
      setUser({ email: 'agent@ttb.gov (dev)', name: 'Dev Agent' })
    })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <NavBar user={user} />
      {mode === 'home'   && <LandingPage onSelect={setMode} />}
      {mode === 'single' && <SinglePage  onGoHome={() => setMode('home')} />}
      {mode === 'bulk'   && <BulkPage    onSwitchToSingle={() => setMode('home')} />}
      {mode === 'recent' && <RecentPage  onGoHome={() => setMode('home')} />}
    </div>
  )
}
