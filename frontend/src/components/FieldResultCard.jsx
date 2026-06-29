const STATUS_CONFIG = {
  pass:    { icon: '✅', label: 'Match',            color: '#1a5928', border: '#2d7a3a', bg: 'white' },
  review:  { icon: '⚠️', label: 'Review Needed',    color: '#856404', border: '#e67e22', bg: 'white' },
  fail:    { icon: '❌', label: 'Mismatch',         color: '#721c24', border: '#c0392b', bg: 'white' },
  missing: { icon: '—',  label: 'Not Found',        color: '#555',    border: '#ccc',    bg: '#fafafa' },
}

const FIELD_LABELS = {
  brand_name:       'Brand Name',
  class_type:       'Class / Type',
  alcohol_content:  'Alcohol Content',
  net_contents:     'Net Contents',
  bottler_producer: 'Bottler / Producer',
  country_of_origin:'Country of Origin',
  govt_warning:     'Govt. Warning',
}

export default function FieldResultCard({ result }) {
  const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.missing

  return (
    <div style={{ ...s.card, borderLeft: `3px solid ${cfg.border}`, background: cfg.bg }}>
      <div style={s.fieldName}>{FIELD_LABELS[result.field] || result.field}</div>
      <div style={s.statusRow}>
        <span style={s.icon}>{cfg.icon}</span>
        <span style={{ ...s.statusLabel, color: cfg.color }}>{cfg.label}</span>
        {result.confidence < 1 && result.confidence > 0 && (
          <span style={s.confidence}>{Math.round(result.confidence * 100)}%</span>
        )}
      </div>
      {result.extracted && (
        <div style={s.extracted}>
          Extracted: <em>"{result.extracted}"</em>
        </div>
      )}
      {result.expected && result.status !== 'pass' && (
        <div style={s.expected}>Expected: <em>"{result.expected}"</em></div>
      )}
      {result.detail && <div style={s.detail}>{result.detail}</div>}
    </div>
  )
}

const s = {
  card:        { background: 'white', borderRadius: 5, border: '1px solid #e0e4ea', padding: '10px 12px' },
  fieldName:   { fontSize: 10, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 },
  statusRow:   { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 },
  icon:        { fontSize: 13 },
  statusLabel: { fontSize: 12, fontWeight: 700 },
  confidence:  { marginLeft: 'auto', fontSize: 10, color: '#888', background: '#f0f2f5', borderRadius: 3, padding: '1px 5px' },
  extracted:   { fontSize: 11, color: '#333', marginTop: 2 },
  expected:    { fontSize: 11, color: '#777', marginTop: 1 },
  detail:      { fontSize: 10, color: '#666', marginTop: 4, paddingTop: 4, borderTop: '1px solid #f0f2f5' },
}
