import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

export default function TopBar({ onVerify, onBulk, queue, activeId, onSelectQueue, onDelete }) {
  const [imageFile, setImageFile] = useState(null)
  const [pdfFile, setPdfFile]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const onDropImage = useCallback((files) => { if (files[0]) setImageFile(files[0]) }, [])
  const onDropPdf   = useCallback((files) => { if (files[0]) setPdfFile(files[0]) }, [])

  const { getRootProps: getImgProps, getInputProps: getImgInput, isDragActive: imgDrag } =
    useDropzone({ onDrop: onDropImage, accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }, maxFiles: 1 })

  const { getRootProps: getPdfProps, getInputProps: getPdfInput, isDragActive: pdfDrag } =
    useDropzone({ onDrop: onDropPdf, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1 })

  const handleVerify = async () => {
    if (!pdfFile)   return setError('Add the application PDF')
    if (!imageFile) return setError('Add the label image')
    setError('')
    setLoading(true)
    try {
      await onVerify(pdfFile, imageFile)
      setImageFile(null)
      setPdfFile(null)
    } catch (e) {
      setError(e.response?.data?.detail || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const statusColor = { pass: '#2d7a3a', warn: '#e67e22', fail: '#c0392b' }
  const chipColor = (status) => status?.startsWith('mismatch') ? '#e65100' : (statusColor[status] || '#aaa')

  return (
    <div style={s.bar}>
      {/* Upload controls */}
      <div style={s.controls}>
        <Drop
          getRootProps={getPdfProps}
          getInputProps={getPdfInput}
          isDragActive={pdfDrag}
          file={pdfFile}
          label="Application PDF"
          icon="📄"
        />
        <Drop
          getRootProps={getImgProps}
          getInputProps={getImgInput}
          isDragActive={imgDrag}
          file={imageFile}
          label="Label Image"
          icon="🏷️"
        />
        <div style={s.verifyWrap}>
          <div style={{ ...s.dropLabel, visibility: 'hidden' }}>_</div>
          {error && <div style={s.error}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              style={{ ...s.verifyBtn, opacity: loading ? 0.65 : 1 }}
              onClick={handleVerify}
              disabled={loading}
            >
              {loading
                ? <><div style={s.verifyMain}>⏳ Processing…</div></>
                : <><div style={s.verifyMain}>Verify Label</div><div style={s.verifySub}>Run AI compliance check</div></>
              }
            </button>
            <button style={s.bulkBtn} onClick={onBulk} title="Bulk upload multiple labels">
              <div style={{ fontSize: 13 }}>⇪</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>Bulk</div>
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={s.divider} />

      {/* Queue */}
      <div style={s.queue}>
        <div style={s.queueLabel}>Recent Verifications <span style={{ fontWeight: 400, color: '#888' }}>(click to see the results)</span></div>
        <div style={s.queueRow}>
          {queue.length === 0 && <span style={s.queueEmpty}>No recent verifications</span>}
          {queue.map(item => (
            <div
              key={item.id}
              style={{
                ...s.chip,
                borderColor: activeId === item.id ? '#1a3a5c' : '#dde2ea',
                background:  activeId === item.id ? '#eef3f8' : 'white',
              }}
              onClick={() => onSelectQueue(item)}
            >
              <span style={{ ...s.chipDot, background: chipColor(item.overall_status) }} />
              <div style={s.chipInfo}>
                <div style={s.chipId}>{item.cola_id}</div>
                <div style={s.chipTime}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <button
                style={s.chipDelete}
                title="Delete"
                onClick={e => { e.stopPropagation(); onDelete(item.id) }}
              >✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Drop({ getRootProps, getInputProps, isDragActive, file, label, icon }) {
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
        <span style={s.dropIcon}>{icon}</span>
        <span style={{ ...s.dropText, color: file ? '#2d7a3a' : '#888' }}>
          {file ? file.name.length > 22 ? file.name.slice(0, 20) + '…' : file.name : 'Drop or click'}
        </span>
      </div>
    </div>
  )
}

const s = {
  bar:        { display: 'flex', alignItems: 'center', gap: 0, background: 'white', borderBottom: '1px solid #e0e4ea', padding: '12px 16px', flexShrink: 0 },
  controls:   { display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0 },

  dropWrap:   { display: 'flex', flexDirection: 'column', gap: 6 },
  dropLabel:  { fontSize: 13, fontWeight: 600, color: '#333' },
  dropZone:   { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: '1.5px dashed', borderRadius: 6, padding: '14px 8px', cursor: 'pointer', width: 200, transition: 'all 0.12s' },
  dropIcon:   { fontSize: 22, lineHeight: 1 },
  dropText:   { fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center', lineHeight: 1 },

  verifyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  error:      { fontSize: 10, color: '#c0392b' },
  verifyBtn:  { background: '#1a3a5c', color: 'white', border: 'none', borderRadius: 5, padding: '14px 22px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'center' },
  verifyMain: { fontSize: 13, fontWeight: 700, letterSpacing: 0.2 },
  verifySub:  { fontSize: 10, fontWeight: 400, opacity: 0.75, marginTop: 3 },
  bulkBtn:    { background: '#f0f4ff', color: '#1a3a5c', border: '1px solid #c5d3f0', borderRadius: 5, padding: '6px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },

  divider:    { width: 1, background: '#e0e4ea', alignSelf: 'stretch', margin: '0 16px', flexShrink: 0 },

  queue:      { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  queueLabel: { fontSize: 13, fontWeight: 600, color: '#333' },
  queueRow:   { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 },
  queueEmpty: { fontSize: 11, color: '#bbb', alignSelf: 'center' },

  chip:       { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid', borderRadius: 5, padding: '5px 8px', cursor: 'pointer', flexShrink: 0, minWidth: 140, transition: 'all 0.12s' },
  chipDot:    { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  chipInfo:   { flex: 1, minWidth: 0 },
  chipId:     { fontSize: 11, fontWeight: 600, color: '#1a3a5c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chipTime:   { fontSize: 10, color: '#aaa' },
  chipDelete: { background: 'none', border: 'none', color: '#ccc', fontSize: 10, cursor: 'pointer', padding: '1px 3px', borderRadius: 3, flexShrink: 0, lineHeight: 1 },
}
