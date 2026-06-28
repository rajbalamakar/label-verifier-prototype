import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { parsePdfIds, verifyBulk } from '../api'

export default function BulkModal({ onClose, onComplete, onSelect }) {
  const [phase, setPhase]     = useState('drop')
  const [allFiles, setAllFiles] = useState([])
  const [pairs, setPairs]     = useState([])
  const [parsing, setParsing] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)

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
      const res = await parsePdfIds(pdfs)
      const parsed = res.data

      const usedImages = new Set()
      const newPairs = parsed.map(({ filename, cola_id }) => {
        const pdf = pdfs.find(p => p.name === filename)
        let image = null

        // Match by COLA ID appearing in image filename
        if (cola_id) {
          image = images.find(
            img => !usedImages.has(img.name) &&
                   img.name.toUpperCase().includes(cola_id.toUpperCase())
          )
        }
        // Fallback: match by shared filename prefix
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

      // Add unmatched images as unpairable rows
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
    setPairs(prev => prev.map(p => p.matched ? { ...p, status: 'processing' } : p))
    try {
      await verifyBulk(matchedPairs, (event) => {
        if (event.status === 'complete') {
          setDone(true)
          onComplete?.()
          return
        }
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

  const handleExportCsv = () => {
    const headers = ['COLA ID', 'PDF', 'Image', 'Result', 'Processing (ms)', 'Fields']
    const rows = pairs.filter(p => p.matched && p.result).map(p => [
      p.cola_id,
      p.pdf?.name || '',
      p.image?.name || '',
      p.result?.overall_status || '',
      p.result?.processing_time_ms || '',
      (p.result?.results || []).map(r => `${r.field}:${r.status}`).join('; '),
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bulk-verification-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.title}>Bulk Upload</div>
            <div style={s.subtitle}>
              {phase === 'drop'       && 'Drop all PDFs and label images together'}
              {phase === 'pair'       && `${matchedPairs.length} of ${pairs.length} items matched`}
              {phase === 'processing' && (done ? `${matchedPairs.length} verifications complete` : `Processing ${matchedPairs.length} verifications…`)}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Phase: drop */}
        {phase === 'drop' && (
          <div style={s.body}>
            <div
              {...getRootProps()}
              style={{
                ...s.dropZone,
                borderColor: isDragActive ? '#1a3a5c' : allFiles.length > 0 ? '#2d7a3a' : '#b0bec5',
                background:  isDragActive ? '#eef3f8' : allFiles.length > 0 ? '#f0faf2' : '#fafbfc',
              }}
            >
              <input {...getInputProps()} />
              <span style={{ fontSize: 40 }}>📂</span>
              {allFiles.length === 0 ? (
                <>
                  <div style={s.dropMain}>Drop PDFs and label images here</div>
                  <div style={s.dropSub}>Or click to browse — mix all files together, we'll match them</div>
                </>
              ) : (
                <>
                  <div style={s.dropMain}>
                    <strong>{pdfs.length}</strong> PDF{pdfs.length !== 1 ? 's' : ''} &nbsp;+&nbsp;
                    <strong>{images.length}</strong> image{images.length !== 1 ? 's' : ''}
                  </div>
                  <div style={s.dropSub}>Drop more to add, or click Match Files to continue</div>
                </>
              )}
            </div>
            {error && <div style={s.error}>{error}</div>}
            <div style={s.footer}>
              <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                style={{ ...s.primaryBtn, opacity: allFiles.length === 0 || parsing ? 0.6 : 1 }}
                onClick={handleMatch}
                disabled={allFiles.length === 0 || parsing}
              >
                {parsing ? 'Matching…' : 'Match Files →'}
              </button>
            </div>
          </div>
        )}

        {/* Phase: pair */}
        {phase === 'pair' && (
          <div style={s.body}>
            {pairs.some(p => !p.matched) && (
              <div style={s.warnBanner}>
                {pairs.filter(p => !p.matched).length} item{pairs.filter(p => !p.matched).length !== 1 ? 's' : ''} could not be matched and will be skipped.
                Rename files to share a common prefix (e.g. TTB-001_cola.pdf + TTB-001_label.jpg).
              </div>
            )}
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>COLA ID</th>
                    <th style={s.th}>PDF</th>
                    <th style={s.th}>Label Image</th>
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
                      <td style={s.td}>
                        <span style={{ fontSize: 11, color: pair.pdf ? '#333' : '#e65100' }}>
                          {pair.pdf?.name || '— no PDF'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={{ fontSize: 11, color: pair.image ? '#333' : '#e65100' }}>
                          {pair.image?.name || '— no image'}
                        </span>
                      </td>
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
            <div style={s.footer}>
              <button style={s.cancelBtn} onClick={() => setPhase('drop')}>← Back</button>
              <button
                style={{ ...s.primaryBtn, opacity: matchedPairs.length === 0 ? 0.5 : 1 }}
                onClick={handleSubmit}
                disabled={matchedPairs.length === 0}
              >
                Submit {matchedPairs.length} verification{matchedPairs.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Phase: processing */}
        {phase === 'processing' && (
          <div style={s.body}>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>COLA ID</th>
                    <th style={s.th}>PDF</th>
                    <th style={s.th}>Image</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Result</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.filter(p => p.matched).map((pair, i) => (
                    <tr key={i}>
                      <td style={s.td}><span style={s.colaChip}>{pair.cola_id}</span></td>
                      <td style={s.td}><span style={{ fontSize: 11 }}>{pair.pdf?.name}</span></td>
                      <td style={s.td}><span style={{ fontSize: 11 }}>{pair.image?.name}</span></td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <StatusBadge status={pair.status} result={pair.result} err={pair.error} />
                      </td>
                      <td style={s.td}>
                        {pair.result && (
                          <button
                            style={s.viewBtn}
                            onClick={() => onSelect?.(pair.result)}
                          >
                            View →
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <div style={s.error}>{error}</div>}
            <div style={s.footer}>
              {done && (
                <button style={s.secondaryBtn} onClick={handleExportCsv}>Export CSV</button>
              )}
              <button style={s.cancelBtn} onClick={onClose}>{done ? 'Close' : 'Cancel'}</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function StatusBadge({ status, result, err }) {
  if (status === 'pending')    return <span style={{ color: '#aaa', fontSize: 11 }}>—</span>
  if (status === 'processing') return <span style={{ color: '#e67e22', fontSize: 11 }}>⏳ processing</span>
  if (status === 'error')      return <span style={{ ...badge('#f8d7da', '#721c24') }}>Error</span>
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
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal:    { background: 'white', borderRadius: 10, width: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },

  header:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e0e4ea', flexShrink: 0 },
  title:    { fontSize: 15, fontWeight: 700, color: '#1a3a5c' },
  subtitle: { fontSize: 11, color: '#888', marginTop: 3 },
  closeBtn: { background: 'none', border: 'none', fontSize: 16, color: '#aaa', cursor: 'pointer', padding: 0 },

  body:     { flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 14, overflow: 'hidden', minHeight: 0 },

  dropZone: { flex: 1, border: '2px dashed', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.12s', padding: 30, minHeight: 220 },
  dropMain: { fontSize: 14, fontWeight: 600, color: '#333', textAlign: 'center' },
  dropSub:  { fontSize: 11, color: '#888', textAlign: 'center' },

  warnBanner: { background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#5d4037' },

  tableWrap: { flex: 1, overflowY: 'auto', border: '1px solid #e0e4ea', borderRadius: 6, minHeight: 0 },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 14px', borderBottom: '1px solid #e0e4ea', textAlign: 'left', background: '#f8f9fa', position: 'sticky', top: 0 },
  td:        { fontSize: 12, padding: '9px 14px', borderBottom: '1px solid #f0f2f5', verticalAlign: 'middle' },
  colaChip:  { fontSize: 11, fontWeight: 600, color: '#1a3a5c', background: '#eef3f8', borderRadius: 3, padding: '2px 7px' },

  footer:      { display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 },
  error:       { fontSize: 11, color: '#c0392b' },
  cancelBtn:   { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: 5, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  secondaryBtn: { background: 'white', color: '#1a3a5c', border: '1px solid #b0bec5', borderRadius: 5, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  primaryBtn:  { background: '#1a3a5c', color: 'white', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  viewBtn:     { background: 'none', border: '1px solid #c5d3f0', color: '#1a3a5c', borderRadius: 4, padding: '3px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
}
