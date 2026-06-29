import { useState, useEffect } from 'react'
import NavBar from './components/NavBar'
import TopBar from './components/TopBar'
import ResultsPanel from './components/ResultsPanel'
import BulkPage from './pages/BulkPage'
import { getMe, verifyLabel, listVerifications, deleteVerification } from './api'

export default function App() {
  const [user, setUser]                   = useState(null)
  const [mode, setMode]                   = useState('single') // 'single' | 'bulk'
  const [verification, setVerification]   = useState(null)
  const [labelImageUrl, setLabelImageUrl] = useState(null)
  const [queue, setQueue]                 = useState([])
  const [activeId, setActiveId]           = useState(null)

  useEffect(() => {
    getMe().then(r => setUser(r.data)).catch(() => {
      setUser({ email: 'agent@ttb.gov (dev)', name: 'Dev Agent' })
    })
    listVerifications(5).then(r => setQueue(r.data)).catch(() => {})
  }, [])

  const handleVerify = async (pdfFile, imageFile) => {
    setLabelImageUrl(URL.createObjectURL(imageFile))
    const res = await verifyLabel(pdfFile, imageFile)
    const v = res.data
    setVerification(v)
    setLabelImageUrl(`/api/verifications/${v.id}/label`)
    setActiveId(v.id)
    setQueue(prev => [v, ...prev.filter(q => q.id !== v.id)].slice(0, 5))
  }

  const handleSelectQueue = (item) => {
    setVerification(item)
    setLabelImageUrl(`/api/verifications/${item.id}/label`)
    setActiveId(item.id)
  }

  const handleDelete = async (id) => {
    await deleteVerification(id)
    setQueue(prev => prev.filter(v => v.id !== id))
    if (activeId === id) { setVerification(null); setLabelImageUrl(null); setActiveId(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <NavBar user={user} />

      {mode === 'single' ? (
        <>
          <TopBar
            onVerify={handleVerify}
            onSwitchToBulk={() => setMode('bulk')}
            queue={queue}
            activeId={activeId}
            onSelectQueue={handleSelectQueue}
            onDelete={handleDelete}
          />
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <ResultsPanel
              verification={verification}
              labelImageUrl={labelImageUrl}
              onDecisionSaved={(id, decision) => {
                const patch = v => v.id === id ? { ...v, decision } : v
                setQueue(prev => prev.map(patch))
                setVerification(prev => prev?.id === id ? { ...prev, decision } : prev)
              }}
            />
          </div>
        </>
      ) : (
        <BulkPage onSwitchToSingle={() => setMode('single')} />
      )}
    </div>
  )
}
