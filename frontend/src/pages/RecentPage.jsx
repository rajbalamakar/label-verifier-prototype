import { useState, useEffect, useCallback, useRef } from 'react'
import ResultsPanel from '../components/ResultsPanel'
import { listVerifications, deleteVerification } from '../api'

const STATUS_COLOR = {
  pass: '#2d7a3a', fail: '#c0392b', review: '#e67e22',
}
const dotColor = (s) => s?.startsWith('mismatch') ? '#e65100' : (STATUS_COLOR[s] || '#aaa')

const BADGE = {
  pass:     { bg: '#d4edda', color: '#1a5928', label: 'PASS' },
  review:   { bg: '#fff3cd', color: '#856404', label: 'REVIEW' },
  fail:     { bg: '#f8d7da', color: '#721c24', label: 'FAIL' },
}

function StatusBadge({ status }) {
  if (status?.startsWith('mismatch')) return <span style={bStyle('#ffe8cc', '#7b3f00')}>MISMATCH</span>
  const b = BADGE[status]
  return b ? <span style={bStyle(b.bg, b.color)}>{b.label}</span> : <span style={bStyle('#f0f2f5', '#888')}>—</span>
}
const bStyle = (bg, color) => ({ fontSize: 10, fontWeight: 700, background: bg, color, borderRadius: 3, padding: '2px 8px' })

export default function RecentPage({ onGoHome }) {
  const [queue, setQueue]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(null)
  const [selectedImgUrl, setSelectedImgUrl] = useState(null)
  const [activeId, setActiveId]         = useState(null)
  const [leftWidth, setLeftWidth]       = useState(420)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  const onDividerMouseDown = useCallback((e) => {
    dragging.current = true
    startX.current   = e.clientX
    startW.current   = leftWidth
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftWidth])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      setLeftWidth(Math.max(260, Math.min(700, startW.current + delta)))
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    listVerifications(50)
      .then(r => setQueue(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (item) => {
    setSelected(item)
    setSelectedImgUrl(`/api/verifications/${item.id}/label`)
    setActiveId(item.id)
  }

  const handleDelete = async (id) => {
    await deleteVerification(id)
    setQueue(prev => prev.filter(v => v.id !== id))
    if (activeId === id) { setSelected(null); setSelectedImgUrl(null); setActiveId(null) }
  }

  return (
    <div style={s.page}>

      {/* ── Left panel ── */}
      <div style={{ ...s.left, width: leftWidth }}>
        <div style={s.leftHeader}>
          <button style={s.backBtn} onClick={onGoHome}>← Home</button>
          <div style={s.leftTitle}>Recent Verifications</div>
          <div style={s.leftSub}>Click any row to view full results</div>
        </div>

        <div style={s.tableWrap}>
          {loading && <div style={s.empty}>Loading…</div>}
          {!loading && queue.length === 0 && (
            <div style={s.empty}>No verifications yet. Run a single or bulk upload first.</div>
          )}
          {!loading && queue.length > 0 && (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Application ID</th>
                  <th style={s.th}>Brand</th>
                  <th style={s.th}>Date</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Result</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {queue.map(item => (
                  <tr
                    key={item.id}
                    style={{
                      ...s.tr,
                      background: activeId === item.id ? '#eef3f8' : 'white',
                      boxShadow: activeId === item.id ? 'inset 5px 0 0 #1a3a5c' : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleSelect(item)}
                  >
                    <td style={s.td}>
                      <span style={s.colaChip}>{item.cola_id}</span>
                    </td>
                    <td style={s.td}>
                      <span style={s.brandName}>{item.application?.brand_name || '—'}</span>
                    </td>
                    <td style={s.td}>
                      <span style={s.dateText}>
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        {' '}
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <StatusBadge status={item.overall_status} />
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <button
                        style={s.deleteBtn}
                        title="Delete"
                        onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Drag divider ── */}
      <div style={s.divider} onMouseDown={onDividerMouseDown} />

      {/* ── Right panel ── */}
      <ResultsPanel
        verification={selected}
        labelImageUrl={selectedImgUrl}
        onDecisionSaved={(id, decision) => {
          setQueue(prev => prev.map(v => v.id === id ? { ...v, decision } : v))
          setSelected(prev => prev?.id === id ? { ...prev, decision } : prev)
        }}
      />
    </div>
  )
}

const s = {
  page: { flex: 1, display: 'flex', overflow: 'hidden' },

  left:       { flexShrink: 0, background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  divider:    { width: 5, flexShrink: 0, cursor: 'col-resize', background: '#e0e4ea', transition: 'background 0.15s', zIndex: 1 },
  leftHeader: { padding: '12px 16px', borderBottom: '1px solid #e0e4ea', flexShrink: 0 },
  leftTitle:  { fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 2 },
  leftSub:    { fontSize: 11, color: '#888' },
  backBtn:    { background: '#eef3f8', border: '1px solid #c5d3f0', borderRadius: 5, fontSize: 13, color: '#1a3a5c', cursor: 'pointer', padding: '5px 10px', marginBottom: 8, fontWeight: 700 },

  tableWrap: { flex: 1, overflowY: 'auto' },
  empty:     { padding: 20, fontSize: 12, color: '#aaa', textAlign: 'center' },

  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 14px', borderBottom: '1px solid #e0e4ea', textAlign: 'left', background: '#f8f9fa', position: 'sticky', top: 0 },
  tr:        { borderBottom: '1px solid #f0f2f5', transition: 'background 0.1s' },
  td:        { fontSize: 12, padding: '10px 14px', verticalAlign: 'middle' },

  colaChip:  { fontSize: 11, fontWeight: 600, color: '#1a3a5c', background: '#eef3f8', borderRadius: 3, padding: '2px 7px' },
  brandName: { color: '#333' },
  dateText:  { color: '#888', fontSize: 11 },
  deleteBtn: { background: 'none', border: 'none', color: '#111', cursor: 'pointer', padding: '2px 4px', borderRadius: 3 },
}
