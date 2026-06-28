import { useState, useEffect } from 'react'
import FieldResultCard from './FieldResultCard'
import { submitDecision } from '../api'

const OVERALL = {
  pass:     { label: 'ALL FIELDS PASS', color: '#1a5928', bg: '#d4edda' },
  warn:     { label: 'REVIEW NEEDED',   color: '#856404', bg: '#fff3cd' },
  fail:     { label: 'FAILED',          color: '#721c24', bg: '#f8d7da' },
  mismatch: { label: 'WRONG LABEL?',    color: '#7b3f00', bg: '#ffe8cc' },
}

function parseMismatch(status) {
  if (status?.startsWith('mismatch:')) return status.slice('mismatch:'.length)
  return null
}

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={s.lightboxOverlay} onClick={onClose}>
      <img src={src} alt="Label (expanded)" style={s.lightboxImg} onClick={e => e.stopPropagation()} />
      <button style={s.lightboxClose} onClick={onClose}>✕</button>
    </div>
  )
}

export default function ResultsPanel({ verification, labelImageUrl, onDecisionSaved }) {
  const application = verification?.application
  const [notes, setNotes]         = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(null)
  const [lightbox, setLightbox]   = useState(false)

  useEffect(() => {
    setNotes(verification?.decision?.notes || '')
    setShowNotes(false)
    setSaved(verification?.decision?.decision || null)
  }, [verification?.id])

  if (!verification) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>🏷️</div>
        <div style={s.emptyTitle}>No label loaded</div>
        <div style={s.emptySub}>Upload an application PDF and label image above to begin verification</div>
      </div>
    )
  }

  const mismatchReason = parseMismatch(verification.overall_status)
  const overallKey = mismatchReason ? 'mismatch' : verification.overall_status
  const overall = OVERALL[overallKey] || OVERALL.warn
  const results = verification.results || []

  const handleDecision = async (decision) => {
    setSaving(true)
    try {
      const res = await submitDecision(verification.id, decision, notes)
      setSaved(decision)
      onDecisionSaved?.(verification.id, res.data)
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to save decision')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.columns}>
      {lightbox && labelImageUrl && <Lightbox src={labelImageUrl} onClose={() => setLightbox(false)} />}

      {/* Column 1 — Label image */}
      <div style={s.col}>
        <div style={s.colHeader}>Label Image</div>
        <div style={s.imageArea}>
          {labelImageUrl ? (
            <div style={s.imgWrapper} onClick={() => setLightbox(true)} title="Click to expand">
              <img src={labelImageUrl} alt="Label" style={s.labelImg} />
              <div style={s.expandHint}>⤢ expand</div>
            </div>
          ) : (
            <div style={s.imagePlaceholder}>
              <span style={{ fontSize: 40 }}>🏷️</span>
              <div style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>{application?.cola_id}</div>
            </div>
          )}
        </div>
      </div>

      {/* Column 2 — Application data */}
      <div style={s.col}>
        <div style={s.colHeader}>
          Application Data
          {application?.cola_id && <span style={s.colaChip}>{application.cola_id}</span>}
        </div>
        <div style={s.appData}>
          {application ? (
            <table style={s.table}>
              <tbody>
                {[
                  ['Brand Name',         application.brand_name],
                  ['Class / Type',       application.class_type],
                  ['Alcohol Content',    application.alcohol_content ? `${application.alcohol_content}% by vol.` : null],
                  ['Net Contents',       application.net_contents],
                  ['Bottler / Producer', application.bottler_producer],
                  ['Address',            application.address],
                  ['Country of Origin',  application.country_of_origin],
                  ['Govt. Warning',      'Required (standard)'],
                ].map(([label, value]) => (
                  <tr key={label} style={s.tr}>
                    <td style={s.tdLabel}>{label}</td>
                    <td style={s.tdValue}>{value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#aaa', fontSize: 12 }}>No application data</div>
          )}
        </div>
      </div>

      {/* Column 3 — Verification results */}
      <div style={{ ...s.col, borderRight: 'none' }}>
        <div style={s.colHeader}>
          Verification Results
          <span style={{ ...s.badge, color: overall.color, background: overall.bg }}>{overall.label}</span>
          <span style={s.timer}>{(verification.processing_time_ms / 1000).toFixed(1)}s</span>
        </div>
        <div style={s.resultsBody}>
          {mismatchReason && (
            <div style={s.mismatchBanner}>
              <div style={s.mismatchTitle}>⚠ Possible Wrong Label Submitted</div>
              <div style={s.mismatchDetail}>{mismatchReason}</div>
            </div>
          )}
          <div style={s.fieldsGrid}>
            {results.map(r => <FieldResultCard key={r.field} result={r} />)}
          </div>

          {showNotes && (
            <textarea
              style={s.notes}
              placeholder="Add notes for this decision…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          )}
        </div>

        {/* Action bar pinned to bottom of column 3 */}
        <div style={s.actionBar}>
          {saved ? (
            <div style={{
            ...s.savedBanner,
            ...(saved === 'reject' ? { background: '#f8d7da', color: '#721c24' } : {}),
            ...(saved === 'hold'   ? { background: '#e9ecef', color: '#495057' } : {}),
          }}>✓ Decision recorded: <strong>{saved.toUpperCase()}</strong></div>
          ) : (
            <>
              <button style={{ ...s.btn, background: '#2d7a3a', color: 'white' }} onClick={() => handleDecision('approve')} disabled={saving}>✓ Approve</button>
              <button style={{ ...s.btn, background: '#c0392b', color: 'white' }} onClick={() => handleDecision('reject')} disabled={saving}>✗ Reject</button>
              <button style={{ ...s.btn, background: '#e0e4ea', color: '#333' }}  onClick={() => handleDecision('hold')}   disabled={saving}>⏸ Hold</button>
              <button style={{ ...s.btn, background: 'transparent', color: '#1a3a5c', border: '1px solid #b0bec5' }} onClick={() => setShowNotes(v => !v)}>
                📝 {showNotes ? 'Hide Notes' : 'Add Notes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  columns:   { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', overflow: 'hidden' },

  col:       { display: 'flex', flexDirection: 'column', borderRight: '1px solid #e0e4ea', overflow: 'hidden' },
  colHeader: { fontSize: 10, fontWeight: 700, color: '#1a3a5c', textTransform: 'uppercase', letterSpacing: 0.5, padding: '10px 14px', borderBottom: '1px solid #e0e4ea', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },

  colaChip:  { fontSize: 10, background: '#eef3f8', color: '#1a3a5c', borderRadius: 3, padding: '2px 7px', fontWeight: 600 },
  badge:     { fontSize: 10, borderRadius: 3, padding: '2px 8px', fontWeight: 700 },
  timer:     { marginLeft: 'auto', fontSize: 10, color: '#aaa', fontWeight: 400 },

  /* Image column */
  imageArea: { flex: 1, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' },
  imgWrapper: { position: 'relative', cursor: 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '100%' },
  labelImg:  { maxHeight: 'calc(100vh - 180px)', maxWidth: '100%', objectFit: 'contain', borderRadius: 4, border: '1px solid #333' },
  expandHint: { position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 3, pointerEvents: 'none' },
  imagePlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #333', borderRadius: 6, width: 160, height: 200, background: 'rgba(255,255,255,0.05)' },

  /* App data column */
  appData:   { flex: 1, overflowY: 'auto', padding: '10px 14px' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  tr:        { borderBottom: '1px solid #f0f2f5' },
  tdLabel:   { fontSize: 11, color: '#888', padding: '7px 10px 7px 0', whiteSpace: 'nowrap', verticalAlign: 'top', width: '40%' },
  tdValue:   { fontSize: 12, color: '#222', fontWeight: 500, padding: '7px 0' },

  /* Mismatch banner */
  mismatchBanner: { background: '#fff3e0', border: '1.5px solid #e65100', borderRadius: 6, padding: '10px 12px', marginBottom: 10 },
  mismatchTitle:  { fontSize: 12, fontWeight: 700, color: '#bf360c', marginBottom: 4 },
  mismatchDetail: { fontSize: 11, color: '#6d4c41', lineHeight: 1.5 },

  /* Results column */
  resultsBody: { flex: 1, overflowY: 'auto', padding: 12, background: '#f5f6f8' },
  fieldsGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  notes:       { width: '100%', marginTop: 10, border: '1px solid #cdd3da', borderRadius: 4, padding: '8px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' },

  actionBar:  { background: 'white', borderTop: '1px solid #e0e4ea', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 },
  btn:        { borderRadius: 4, padding: '7px 12px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer' },
  savedBanner: { fontSize: 12, color: '#1a5928', background: '#d4edda', padding: '7px 12px', borderRadius: 4, flex: 1, textAlign: 'center' },

  /* Empty state */
  empty:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: '#555' },
  emptySub:  { fontSize: 12, color: '#aaa', textAlign: 'center', maxWidth: 320 },

  /* Lightbox */
  lightboxOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'zoom-out' },
  lightboxImg:     { maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: 6, cursor: 'default' },
  lightboxClose:   { position: 'fixed', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 20, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer' },
}
