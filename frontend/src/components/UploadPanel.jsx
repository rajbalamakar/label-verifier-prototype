import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

export default function UploadPanel({ onVerify, queue, activeId, onSelectQueue, onDelete }) {
  const [imageFile, setImageFile] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onDropImage = useCallback((files) => { if (files[0]) setImageFile(files[0]) }, [])
  const onDropPdf   = useCallback((files) => { if (files[0]) setPdfFile(files[0]) }, [])

  const { getRootProps: getImageProps, getInputProps: getImageInput, isDragActive: imageDrag } = useDropzone({
    onDrop: onDropImage,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  })

  const { getRootProps: getPdfProps, getInputProps: getPdfInput, isDragActive: pdfDrag } = useDropzone({
    onDrop: onDropPdf,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  const handleVerify = async () => {
    if (!pdfFile)   return setError('Upload the COLA application PDF')
    if (!imageFile) return setError('Upload the label image')
    setError('')
    setLoading(true)
    try {
      await onVerify(pdfFile, imageFile)
    } catch (e) {
      setError(e.response?.data?.detail || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const statusColor = { pass: '#2d7a3a', review: '#e67e22', fail: '#c0392b' }

  return (
    <div style={s.panel}>
      <div style={s.section}>
        <div style={s.sectionLabel}>APPLICATION PDF</div>
        <div {...getPdfProps()} style={{ ...s.dropzone, borderColor: pdfDrag ? '#1a3a5c' : '#b0bec5', background: pdfDrag ? '#eef3f8' : '#f8f9fb' }}>
          <input {...getPdfInput()} />
          <div style={s.dropIcon}>📄</div>
          {pdfFile
            ? <div style={s.fileName}>✓ {pdfFile.name}</div>
            : <><div style={s.dropTitle}>Drop COLA PDF</div><div style={s.dropSub}>Application data is extracted automatically</div></>
          }
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionLabel}>LABEL IMAGE</div>
        <div {...getImageProps()} style={{ ...s.dropzone, borderColor: imageDrag ? '#1a3a5c' : '#b0bec5', background: imageDrag ? '#eef3f8' : '#f8f9fb' }}>
          <input {...getImageInput()} />
          <div style={s.dropIcon}>🏷️</div>
          {imageFile
            ? <div style={s.fileName}>✓ {imageFile.name}</div>
            : <><div style={s.dropTitle}>Drop label image</div><div style={s.dropSub}>JPG, PNG · up to 10 MB</div></>
          }
        </div>
      </div>

      <div style={s.section}>
        {error && <div style={s.error}>{error}</div>}
        <button style={{ ...s.verifyBtn, opacity: loading ? 0.7 : 1 }} onClick={handleVerify} disabled={loading}>
          {loading ? '⏳ Processing...' : '▶ Verify Label'}
        </button>
      </div>

      {queue.length > 0 && (
        <div style={s.queue}>
          <div style={s.queueHeader}>
            <span>Recent Queue</span>
            <span style={{ color: '#888' }}>{queue.length} items</span>
          </div>
          {queue.map(item => (
            <div
              key={item.id}
              style={{ ...s.queueItem, background: activeId === item.id ? '#eef3f8' : 'white', borderLeft: activeId === item.id ? '3px solid #1a3a5c' : '3px solid transparent' }}
              onClick={() => onSelectQueue(item)}
            >
              <div style={s.queueThumb}>🏷️</div>
              <div style={s.queueInfo}>
                <div style={s.queueName}>{item.cola_id}</div>
                <div style={s.queueTime}>{new Date(item.created_at).toLocaleTimeString()}</div>
              </div>
              <div style={{ ...s.statusDot, background: statusColor[item.overall_status] || '#aaa' }} />
              <button
                style={s.deleteBtn}
                title="Delete"
                onClick={e => { e.stopPropagation(); onDelete(item.id) }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  panel: { background: 'white', borderRight: '1px solid #e0e4ea', display: 'flex', flexDirection: 'column', width: 300, flexShrink: 0, overflowY: 'auto' },
  section: { padding: '12px 14px', borderBottom: '1px solid #f0f2f5' },
  sectionLabel: { fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  dropzone: { border: '2px dashed', borderRadius: 6, padding: '14px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' },
  dropIcon: { fontSize: 22, marginBottom: 4 },
  dropTitle: { fontSize: 12, fontWeight: 600, color: '#1a3a5c' },
  dropSub: { fontSize: 10, color: '#888', marginTop: 2 },
  fileName: { fontSize: 11, color: '#2d7a3a', fontWeight: 600 },
  error: { fontSize: 11, color: '#c0392b', marginBottom: 6 },
  verifyBtn: { width: '100%', background: '#2d7a3a', color: 'white', border: 'none', borderRadius: 4, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  queue: { flex: 1, overflowY: 'auto' },
  queueHeader: { padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f2f5' },
  queueItem: { padding: '10px 14px', borderBottom: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  queueThumb: { fontSize: 18, flexShrink: 0 },
  queueInfo: { flex: 1, minWidth: 0 },
  queueName: { fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  queueTime: { fontSize: 10, color: '#888', marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  deleteBtn: { marginLeft: 4, background: 'none', border: 'none', color: '#bbb', fontSize: 11, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, lineHeight: 1, flexShrink: 0 },
}
