import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { parsePdfIds, verifyBulk, listVerifications, deleteVerification } from '../api'
import ResultsPanel from '../components/ResultsPanel'

export default function BulkPage({ onSwitchToSingle }) {
  const [phase, setPhase]     = useState('drop')
  const [allFiles, setAllFiles] = useState([])
  const [pairs, setPairs]     = useState([])
  const [parsing, setParsing] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)

  // Right panel drill-down
  const [selected, setSelected]         = useState(null)
  const [selectedImgUrl, setSelectedImgUrl] = useState(null)

  // Previous verifications (shown in drop phase)
  const [history, setHistory] = useState([])

  useEffect(() => {
    listVerifications(20).then(r => setHistory(r.data)).catch(() => {})
  }, [])

  const refreshHistory = () => listVerifications(20).then(r => setHistory(r.data)).catch(() => {})

  const [leftWidth, setLeftWidth] = useState(360)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      setLeftWidth(Math.max(240, Math.min(640, startW.current + delta)))
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup',   onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup',   onMouseUp)
    }
  }, [])

  const onDividerMouseDown = (e) => {
    dragging.current = true
    startX.current   = e.clientX
    startW.current   = leftWidth
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleDeleteHistory = async (e, id) => {
    e.stopPropagation()
    await deleteVerification(id)
    setHistory(prev => prev.filter(v => v.id !== id))
    if (selected?.id === id) { setSelected(null); setSelectedImgUrl(null) }
  }

  const onDrop = useCallback((files) => {
    setAllFiles(files)
    setError('')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'] },
    multiple: true,
  })

  const pdfs   = allFiles.filter(f => f.type === 'application/pdf')
  const images = allFiles.filter(f => f.type.startsWith('image/'))

  const handleMatch = async () => {
    if (pdfs.length === 0)   return setError('No PDFs found in the dropped files')
    if (images.length === 0) return setError('No label images found in the dropped files')
    setError('')
    setParsing(true)
    try {
      const res    = await parsePdfIds(pdfs)
      const parsed = res.data
      const usedImages = new Set()

      const newPairs = parsed.map(({ filename, cola_id }) => {
        const pdf = pdfs.find(p => p.name === filename)
        let image = null
        if (cola_id) {
          image = images.find(
            img => !usedImages.has(img.name) &&
                   img.name.toUpperCase().includes(cola_id.toUpperCase())
          )
        }
        if (!image) {
          const pdfPrefix = filename.replace(/[_\s]?cola.*$/i, '').replace(/\.pdf$/i, '').toLowerCase()
          image = images.find(img => {
            if (usedImages.has(img.name)) return false
            const imgPrefix = img.name.replace(/[_\s]?label.*$/i, '').replace(/\.(jpg|jpeg|png)$/i, '').toLowerCase()
            return imgPrefix === pdfPrefix || imgPrefix.startsWith(pdfPrefix) || pdfPrefix.startsWith(imgPrefix)
          })
        }
        if (image) usedImages.add(image.name)
        return { pdf, cola_id: cola_id || '—', image, matched: !!image, status: 'pending', result: null, error: null }
      })

      images.filter(img => !usedImages.has(img.name)).forEach(img => {
        newPairs.push({ pdf: null, cola_id: '—', image: img, matched: false, status: 'pending', result: null, error: null })
      })

      setPairs(newPairs)
      setPhase('pair')
    } catch (e) {
      setError('Failed to parse PDFs: ' + (e.response?.data?.detail || e.message))
    } finally {
      setParsing(false)
    }
  }

  const matchedPairs = pairs.filter(p => p.matched)

  const handleSubmit = async () => {
    setPhase('processing')
    setDone(false)
    setSelected(null)
    setPairs(prev => prev.map(p => p.matched ? { ...p, status: 'processing' } : p))
    try {
      await verifyBulk(matchedPairs, (event) => {
        if (event.status === 'complete') { setDone(true); refreshHistory(); return }
        setPairs(prev => {
          const next = [...prev]
          let count = 0
          for (let i = 0; i < next.length; i++) {
            if (next[i].matched) {
              if (count === event.index) {
                next[i] = { ...next[i], status: event.status, result: event.verification || null, error: event.error || null }
                break
              }
              count++
            }
          }
          return next
        })
      })
    } catch (e) {
      setError('Processing failed: ' + e.message)
    }
  }

  const handleReset = () => {
    setPhase('drop')
    setAllFiles([])
    setPairs([])
    setError('')
    setDone(false)
    setSelected(null)
    setSelectedImgUrl(null)
  }

  const handleViewRow = (pair) => {
    setSelected(pair.result)
    setSelectedImgUrl(`/api/verifications/${pair.result.id}/label`)
  }

  const handleExportCsv = () => {
    const headers = ['Application ID', 'PDF', 'Image', 'Result', 'Processing (ms)', 'Fields']
    const rows = pairs.filter(p => p.matched && p.result).map(p => [
      p.cola_id, p.pdf?.name || '', p.image?.name || '',
      p.result?.overall_status || '', p.result?.processing_time_ms || '',
      (p.result?.results || []).map(r => `${r.field}:${r.status}`).join('; '),
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bulk-verification-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div style={s.page}>

      {/* ── Left panel ── */}
      <div style={{ ...s.left, width: leftWidth }}>

        {/* Left header */}
        <div style={s.leftHeader}>
          <button style={s.backBtn} onClick={onSwitchToSingle}>← Home</button>
          <div style={s.leftTitle}>Bulk Upload</div>
          <div style={s.leftSub}>
            {phase === 'drop'       && 'Drop all PDFs and label images together'}
            {phase === 'pair'       && `${matchedPairs.length} of ${pairs.length} items matched`}
            {phase === 'processing' && (done ? `${matchedPairs.length} verifications complete` : `Processing…`)}
          </div>
        </div>

        {/* Phase: drop */}
        {phase === 'drop' && (
          <>
            <div
              {...getRootProps()}
              style={{
                ...s.dropZone,
                borderColor: isDragActive ? '#1a3a5c' : allFiles.length > 0 ? '#2d7a3a' : '#b0bec5',
                background:  isDragActive ? '#eef3f8' : allFiles.length > 0 ? '#f0faf2' : '#fafbfc',
              }}
            >
              <input {...getInputProps()} />
              <span style={{ fontSize: 28 }}>📂</span>
              {allFiles.length === 0 ? (
                <>
                  <div style={s.dropMain}>Drop PDFs and label images here</div>
                  <div style={s.dropSub}>Mix all files together — we'll match them</div>
                </>
              ) : (
                <>
                  <div style={s.dropMain}>
                    <strong>{pdfs.length}</strong> PDF{pdfs.length !== 1 ? 's' : ''} &nbsp;+&nbsp;
                    <strong>{images.length}</strong> image{images.length !== 1 ? 's' : ''}
                  </div>
                  <div style={s.dropSub}>Drop more to add, or click Match Files</div>
                </>
              )}
            </div>
            {error && <div style={s.error}>{error}</div>}
            <div style={s.leftFooter}>
              <button
                style={{ ...s.primaryBtn, opacity: allFiles.length === 0 || parsing ? 0.6 : 1 }}
                onClick={handleMatch}
                disabled={allFiles.length === 0 || parsing}
              >
                {parsing ? 'Matching…' : 'Match Files →'}
              </button>
            </div>
            <div style={s.historyDivider} />
            <div style={s.historyLabel}>Previous Verifications</div>
            <div style={s.historyList}>
              {history.length === 0 && <div style={s.historyEmpty}>No previous verifications</div>}
              {history.map(item => (
                <div
                  key={item.id}
                  style={{
                    ...s.historyRow,
                    background: selected?.id === item.id ? '#eef3f8' : 'transparent',
                    boxShadow:  selected?.id === item.id ? 'inset 5px 0 0 #1a3a5c' : 'none',
                  }}
                  onClick={() => { setSelected(item); setSelectedImgUrl(`/api/verifications/${item.id}/label`) }}
                >
                  <div style={s.historyInfo}>
                    <div style={s.historyId}>{item.cola_id}</div>
                    <div style={s.historyTime}>
                      {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <HistoryBadge status={item.overall_status} />
                  <button style={s.historyDelete} title="Delete" onClick={e => handleDeleteHistory(e, item.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Phase: pair */}
        {phase === 'pair' && (
          <>
            {pairs.some(p => !p.matched) && (
              <div style={s.warnBanner}>
                {pairs.filter(p => !p.matched).length} item(s) unmatched and will be skipped.
                Rename files to share a common prefix (e.g. TTB-001_cola.pdf + TTB-001_label.jpg).
              </div>
            )}
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Application ID</th>
                    <th style={s.th}>PDF</th>
                    <th style={s.th}>Image</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((pair, i) => (
                    <tr key={i} style={{ background: pair.matched ? 'white' : '#fff8f8' }}>
                      <td style={s.td}>
                        <span style={pair.matched ? s.colaChip : { ...s.colaChip, background: '#fdecea', color: '#c62828' }}>
                          {pair.cola_id}
                        </span>
                      </td>
                      <td style={s.td}><span style={{ fontSize: 11, color: pair.pdf ? '#333' : '#e65100' }}>{pair.pdf?.name || '— no PDF'}</span></td>
                      <td style={s.td}><span style={{ fontSize: 11, color: pair.image ? '#333' : '#e65100' }}>{pair.image?.name || '— no image'}</span></td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        {pair.matched
                          ? <span style={{ color: '#2d7a3a', fontWeight: 700 }}>✓</span>
                          : <span style={{ color: '#e65100', fontWeight: 700 }}>✗</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <div style={s.error}>{error}</div>}
            <div style={s.leftFooter}>
              <button style={s.secondaryBtn} onClick={() => setPhase('drop')}>← Back</button>
              <button
                style={{ ...s.primaryBtn, opacity: matchedPairs.length === 0 ? 0.5 : 1 }}
                onClick={handleSubmit}
                disabled={matchedPairs.length === 0}
              >
                Submit {matchedPairs.length} verification{matchedPairs.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {/* Phase: processing / done */}
        {phase === 'processing' && (
          <>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Application ID</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.filter(p => p.matched).map((pair, i) => (
                    <tr
                      key={i}
                      style={{
                        background: selected?.id === pair.result?.id ? '#eef3f8' : 'white',
                        boxShadow: selected?.id === pair.result?.id ? 'inset 5px 0 0 #1a3a5c' : 'none',
                        cursor: pair.result ? 'pointer' : 'default',
                      }}
                      onClick={() => pair.result && handleViewRow(pair)}
                    >
                      <td style={s.td}><span style={s.colaChip}>{pair.cola_id}</span></td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <StatusBadge status={pair.status} result={pair.result} err={pair.error} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <div style={s.error}>{error}</div>}
            <div style={s.leftFooter}>
              {done && <button style={s.secondaryBtn} onClick={handleExportCsv}>Export CSV</button>}
              <button style={s.secondaryBtn} onClick={handleReset}>New Batch</button>
            </div>
          </>
        )}
      </div>

      {/* ── Drag divider ── */}
      <div style={s.colDivider} onMouseDown={onDividerMouseDown} />

      {/* ── Right panel — drill-down ── */}
      <div style={s.right}>
        {selected ? (
          <ResultsPanel
            verification={selected}
            labelImageUrl={selectedImgUrl}
            onDecisionSaved={(id, decision) => {
              setSelected(prev => prev?.id === id ? { ...prev, decision } : prev)
              setPairs(prev => prev.map(p =>
                p.result?.id === id ? { ...p, result: { ...p.result, decision } } : p
              ))
            }}
          />
        ) : (
          <div style={s.emptyRight}>
            <div style={{ fontSize: 48 }}>📋</div>
            <div style={s.emptyTitle}>
              {phase === 'processing'
                ? 'Click a completed row on the left to view its full results'
                : 'Verification details will appear here'}
            </div>
            <div style={s.emptySub}>
              {phase !== 'processing' && 'Upload and process a batch to get started'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryStatusIcon({ status }) {
  const color = status?.startsWith('mismatch') ? '#e65100' : status === 'pass' ? '#2d7a3a' : status === 'fail' ? '#c0392b' : status === 'warn' ? '#e67e22' : '#aaa'
  if (status === 'pass') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  if (status === 'fail') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
  if (status === 'warn') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}

function HistoryBadge({ status }) {
  if (status?.startsWith('mismatch')) return <span style={badge('#ffe8cc', '#7b3f00')}>MISMATCH</span>
  if (status === 'pass') return <span style={badge('#d4edda', '#1a5928')}>PASS</span>
  if (status === 'warn') return <span style={badge('#fff3cd', '#856404')}>WARN</span>
  if (status === 'fail') return <span style={badge('#f8d7da', '#721c24')}>FAIL</span>
  return null
}

function StatusBadge({ status, result, err }) {
  if (status === 'pending')    return <span style={{ color: '#aaa', fontSize: 11 }}>—</span>
  if (status === 'processing') return <span style={{ color: '#e67e22', fontSize: 11 }}>⏳</span>
  if (status === 'error')      return <span style={badge('#f8d7da', '#721c24')}>Error</span>
  if (!result) return null
  const os = result.overall_status
  if (os?.startsWith('mismatch')) return <span style={badge('#ffe8cc', '#7b3f00')}>MISMATCH</span>
  if (os === 'pass') return <span style={badge('#d4edda', '#1a5928')}>PASS</span>
  if (os === 'warn') return <span style={badge('#fff3cd', '#856404')}>WARN</span>
  if (os === 'fail') return <span style={badge('#f8d7da', '#721c24')}>FAIL</span>
  return null
}

const badge = (bg, color) => ({
  fontSize: 10, fontWeight: 700, background: bg, color,
  borderRadius: 3, padding: '2px 7px', display: 'inline-block',
})

const s = {
  page:  { flex: 1, display: 'flex', overflow: 'hidden' },

  /* Left panel */
  left:       { flexShrink: 0, background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  colDivider: { width: 5, flexShrink: 0, cursor: 'col-resize', background: '#e0e4ea' },
  leftHeader: { padding: '12px 16px', borderBottom: '1px solid #e0e4ea', flexShrink: 0 },
  leftTitle:  { fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 2 },
  leftSub:    { fontSize: 11, color: '#888' },
  backBtn:    { background: '#eef3f8', border: '1px solid #c5d3f0', borderRadius: 5, fontSize: 13, color: '#1a3a5c', cursor: 'pointer', padding: '5px 10px', marginBottom: 8, fontWeight: 700 },

  dropZone:   { margin: 16, marginBottom: 0, border: '2px dashed', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.12s', padding: '18px 16px' },
  dropMain:   { fontSize: 13, fontWeight: 600, color: '#333', textAlign: 'center' },
  dropSub:    { fontSize: 11, color: '#888', textAlign: 'center' },

  warnBanner: { margin: '10px 16px 0', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#5d4037', flexShrink: 0 },

  tableWrap:  { flex: 1, overflowY: 'auto', margin: '12px 16px 0', border: '1px solid #e0e4ea', borderRadius: 6, minHeight: 0 },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, padding: '7px 12px', borderBottom: '1px solid #e0e4ea', textAlign: 'left', background: '#f8f9fa', position: 'sticky', top: 0 },
  td:         { fontSize: 12, padding: '8px 12px', borderBottom: '1px solid #f0f2f5', verticalAlign: 'middle' },
  colaChip:   { fontSize: 11, fontWeight: 600, color: '#1a3a5c', background: '#eef3f8', borderRadius: 3, padding: '2px 6px' },

  leftFooter:  { display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #e0e4ea', flexShrink: 0, justifyContent: 'flex-end' },
  error:       { fontSize: 11, color: '#c0392b', padding: '0 16px' },

  historyDivider: { height: 1, background: '#e0e4ea', margin: '4px 0', flexShrink: 0 },
  historyLabel:   { fontSize: 11, fontWeight: 700, color: '#000', padding: '8px 16px 4px', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  historyList:    { flex: 1, overflowY: 'auto' },
  historyEmpty:   { fontSize: 11, color: '#bbb', padding: '6px 16px' },
  historyRow:     { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px 7px 11px', cursor: 'pointer', transition: 'background 0.1s' },
  historyInfo:    { flex: 1, minWidth: 0 },
  historyId:      { fontSize: 11, fontWeight: 600, color: '#1a3a5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  historyTime:    { fontSize: 10, color: '#aaa' },
  historyDelete:  { background: 'none', border: 'none', color: '#111', cursor: 'pointer', padding: '2px 3px', borderRadius: 3, flexShrink: 0 },

  primaryBtn:   { background: '#1a3a5c', color: 'white', border: 'none', borderRadius: 5, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { background: 'white', color: '#1a3a5c', border: '1px solid #b0bec5', borderRadius: 5, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  /* Right panel */
  right:      { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f6f8' },
  emptyRight: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#aaa' },
  emptyTitle: { fontSize: 14, fontWeight: 600, color: '#555', textAlign: 'center', maxWidth: 320 },
  emptySub:   { fontSize: 12, color: '#aaa' },
}
