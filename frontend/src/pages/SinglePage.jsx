import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import ResultsPanel from '../components/ResultsPanel'
import { verifyLabel, listVerifications, deleteVerification } from '../api'

export default function SinglePage({ onGoHome }) {
  const [imageFile, setImageFile]       = useState(null)
  const [pdfFile, setPdfFile]           = useState(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [verification, setVerification] = useState(null)
  const [labelImageUrl, setLabelImageUrl] = useState(null)
  const [queue, setQueue]       = useState([])
  const [activeId, setActiveId] = useState(null)
  const [leftWidth, setLeftWidth] = useState(300)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  useEffect(() => {
    listVerifications(10).then(r => setQueue(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      setLeftWidth(Math.max(200, Math.min(600, startW.current + delta)))
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

  const onDropPdf   = useCallback((files) => { if (files[0]) setPdfFile(files[0]) }, [])
  const onDropImage = useCallback((files) => { if (files[0]) setImageFile(files[0]) }, [])

  const { getRootProps: getPdfProps, getInputProps: getPdfInput, isDragActive: pdfDrag } =
    useDropzone({ onDrop: onDropPdf, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1 })

  const { getRootProps: getImgProps, getInputProps: getImgInput, isDragActive: imgDrag } =
    useDropzone({ onDrop: onDropImage, accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }, maxFiles: 1 })

  const handleVerify = async () => {
    if (!pdfFile)   return setError('Add the application PDF')
    if (!imageFile) return setError('Add the label image')
    setError('')
    setLoading(true)
    try {
      const res = await verifyLabel(pdfFile, imageFile)
      const v = res.data
      setVerification(v)
      setLabelImageUrl(`/api/verifications/${v.id}/label`)
      setActiveId(v.id)
      setQueue(prev => [v, ...prev.filter(q => q.id !== v.id)].slice(0, 10))
      setPdfFile(null)
      setImageFile(null)
    } catch (e) {
      setError(e.response?.data?.detail || 'Verification failed')
    } finally {
      setLoading(false)
    }
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

  const dotColor = (status) =>
    status?.startsWith('mismatch') ? '#e65100'
    : status === 'pass' ? '#2d7a3a'
    : status === 'fail' ? '#c0392b'
    : status === 'warn' ? '#e67e22'
    : '#aaa'

  return (
    <div style={s.page}>

      {/* ── Left panel ── */}
      <div style={{ ...s.left, width: leftWidth }}>
        <div style={s.leftHeader}>
          <button style={s.backBtn} onClick={onGoHome}>← Home</button>
          <div style={s.leftTitle}>Single Upload</div>
          <div style={s.leftSub}>Upload one application PDF and label image</div>
        </div>

        {/* Drop zones */}
        <div style={s.uploadSection}>
          <DropBox
            getRootProps={getPdfProps}
            getInputProps={getPdfInput}
            isDragActive={pdfDrag}
            file={pdfFile}
            label="Application PDF"
            icon="📄"
          />
          <DropBox
            getRootProps={getImgProps}
            getInputProps={getImgInput}
            isDragActive={imgDrag}
            file={imageFile}
            label="Label Image"
            icon="🏷️"
          />
          {error && <div style={s.error}>{error}</div>}
          <button
            style={{ ...s.verifyBtn, opacity: loading ? 0.65 : 1 }}
            onClick={handleVerify}
            disabled={loading}
          >
            {loading ? '⏳ Processing…' : 'Verify Label'}
          </button>
        </div>

        <div style={s.divider} />

        {/* Recent verifications queue */}
        <div style={s.queueSection}>
          <div style={s.queueLabel}>Recent Verifications</div>
          {queue.length === 0 && <div style={s.queueEmpty}>No verifications yet</div>}
          {queue.map(item => (
            <div
              key={item.id}
              style={{
                ...s.queueItem,
                background:  activeId === item.id ? '#eef3f8' : 'transparent',
                borderLeft:  activeId === item.id ? '5px solid #1a3a5c' : '5px solid transparent',
              }}
              onClick={() => handleSelectQueue(item)}
            >
              <div style={s.queueInfo}>
                <div style={s.queueId}>{item.cola_id}</div>
                <div style={s.queueTime}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <StatusBadge status={item.overall_status} />
              <button
                style={s.deleteBtn}
                title="Delete"
                onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Drag divider ── */}
      <div style={s.colDivider} onMouseDown={onDividerMouseDown} />

      {/* ── Right panel ── */}
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
  )
}

function StatusBadge({ status }) {
  if (status?.startsWith('mismatch')) return <span style={bStyle('#ffe8cc', '#7b3f00')}>MISMATCH</span>
  if (status === 'pass') return <span style={bStyle('#d4edda', '#1a5928')}>PASS</span>
  if (status === 'warn') return <span style={bStyle('#fff3cd', '#856404')}>WARN</span>
  if (status === 'fail') return <span style={bStyle('#f8d7da', '#721c24')}>FAIL</span>
  return null
}
const bStyle = (bg, color) => ({ fontSize: 10, fontWeight: 700, background: bg, color, borderRadius: 3, padding: '2px 6px', flexShrink: 0 })

function DropBox({ getRootProps, getInputProps, isDragActive, file, label, icon }) {
  return (
    <div style={s.dropWrap}>
      <div style={s.dropLabel}>{label}</div>
      <div
        {...getRootProps()}
        style={{
          ...s.dropZone,
          borderColor: isDragActive ? '#1a3a5c' : file ? '#2d7a3a' : '#b0bec5',
          background:  isDragActive ? '#eef3f8' : file ? '#f0faf2' : '#fafbfc',
        }}
      >
        <input {...getInputProps()} />
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ fontSize: 11, color: file ? '#2d7a3a' : '#888', fontWeight: 500, textAlign: 'center' }}>
          {file ? (file.name.length > 26 ? file.name.slice(0, 24) + '…' : file.name) : 'Drop or click to browse'}
        </span>
      </div>
    </div>
  )
}

function StatusIcon({ status }) {
  if (status === 'pass') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2d7a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
  if (status === 'fail') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
  if (status === 'warn') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e65100" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

const s = {
  page: { flex: 1, display: 'flex', overflow: 'hidden' },

  /* Left panel */
  left:          { flexShrink: 0, background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  colDivider:    { width: 5, flexShrink: 0, cursor: 'col-resize', background: '#e0e4ea' },
  leftHeader:    { padding: '12px 16px', borderBottom: '1px solid #e0e4ea', flexShrink: 0 },
  leftTitle:     { fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 2 },
  leftSub:       { fontSize: 11, color: '#888' },
  backBtn:       { background: '#eef3f8', border: '1px solid #c5d3f0', borderRadius: 5, fontSize: 13, color: '#1a3a5c', cursor: 'pointer', padding: '5px 10px', marginBottom: 8, fontWeight: 700 },

  uploadSection: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 },
  dropWrap:      { display: 'flex', flexDirection: 'column', gap: 5 },
  dropLabel:     { fontSize: 12, fontWeight: 600, color: '#333' },
  dropZone:      { border: '1.5px dashed', borderRadius: 6, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', transition: 'all 0.12s' },

  error:     { fontSize: 11, color: '#c0392b' },
  verifyBtn: { background: '#1a3a5c', color: 'white', border: 'none', borderRadius: 5, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 2 },

  divider:      { height: 1, background: '#e0e4ea', flexShrink: 0 },
  queueSection: { flex: 1, overflowY: 'auto', padding: '10px 0' },
  queueLabel:   { fontSize: 13, fontWeight: 600, color: '#000', padding: '0 16px 8px', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  queueEmpty:   { fontSize: 11, color: '#bbb', padding: '0 16px' },
  queueItem:    { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 8px 11px', cursor: 'pointer', transition: 'background 0.1s' },
  queueInfo:    { flex: 1, minWidth: 0 },
  queueId:      { fontSize: 11, fontWeight: 600, color: '#1a3a5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  queueTime:    { fontSize: 10, color: '#aaa' },
  deleteBtn:    { background: 'none', border: 'none', color: '#111', cursor: 'pointer', padding: '2px 3px', borderRadius: 3, flexShrink: 0 },
}
