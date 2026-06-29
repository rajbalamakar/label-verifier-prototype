import { useState } from 'react'

export default function LandingPage({ onSelect }) {
  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.heroTitle}>TTB Label Verification</div>
        <div style={s.heroSub}>AI-powered compliance checks for alcohol label applications</div>
      </div>

      <div style={s.cards}>
        <Card
          icon="🏷️"
          title="Single Upload"
          description="Verify one label at a time. Upload an application PDF and label image, get an instant compliance report with field-by-field results."
          cta="Verify a Label →"
          onClick={() => onSelect('single')}
        />
        <Card
          icon="📂"
          title="Bulk Upload"
          description="Process an entire batch in one go. Drop all your PDFs and label images together — we automatically match and verify them in parallel."
          cta="Start Bulk Upload →"
          onClick={() => onSelect('bulk')}
        />
        <Card
          icon="🕑"
          title="Recent Verifications"
          description="Browse and review previously submitted labels. Click any entry to reload the full verification report and update your decision."
          cta="View History →"
          onClick={() => onSelect('recent')}
        />
      </div>
    </div>
  )
}

function Card({ icon, title, description, cta, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ ...s.card, boxShadow: hovered ? '0 6px 24px rgba(26,58,92,0.12)' : '0 2px 8px rgba(0,0,0,0.04)', borderColor: hovered ? '#1a3a5c' : '#e0e4ea', transform: hovered ? 'translateY(-2px)' : 'none' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={s.cardIcon}>{icon}</div>
      <div style={s.cardTitle}>{title}</div>
      <div style={s.cardDesc}>{description}</div>
      <div style={s.cardCta}>{cta}</div>
    </div>
  )
}

const s = {
  page:      { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f6f8', padding: 40, gap: 48 },

  hero:      { textAlign: 'center' },
  heroTitle: { fontSize: 28, fontWeight: 700, color: '#1a3a5c', marginBottom: 10 },
  heroSub:   { fontSize: 14, color: '#666', maxWidth: 460, margin: '0 auto' },

  cards:     { display: 'flex', gap: 28 },

  card:      {
    background: 'white',
    borderRadius: 12,
    border: '1.5px solid #e0e4ea',
    padding: '32px 28px',
    width: 280,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    transition: 'box-shadow 0.15s, border-color 0.15s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  cardIcon:  { fontSize: 36 },
  cardTitle: { fontSize: 18, fontWeight: 700, color: '#1a3a5c' },
  cardDesc:  { fontSize: 13, color: '#555', lineHeight: 1.6, flex: 1 },
  cardCta:   { fontSize: 13, fontWeight: 700, color: '#1a3a5c', marginTop: 8 },
}
