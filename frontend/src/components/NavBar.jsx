export default function NavBar({ user }) {
  return (
    <nav style={styles.nav}>
      <span style={styles.logo}>TTB <span style={styles.accent}>LabelCheck</span></span>
      <span style={styles.sub}>Alcohol &amp; Tobacco Tax and Trade Bureau — Label Verification</span>
    </nav>
  )
}

const styles = {
  nav: {
    background: '#1a3a5c',
    color: 'white',
    padding: '0 20px',
    height: 52,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexShrink: 0,
  },
  logo: { fontSize: 18, fontWeight: 700, letterSpacing: 0.5 },
  accent: { color: '#7ec8e3' },
  sub: {
    fontSize: 11,
    color: '#aac4dc',
    borderLeft: '1px solid #2d5a80',
    paddingLeft: 16,
  },
  userChip: {
    marginLeft: 'auto',
    background: '#2d7a3a',
    color: 'white',
    fontSize: 11,
    padding: '3px 10px',
    borderRadius: 3,
  },
}
