import { RISK_COLORS } from '../../utils'

export function RiskBadge({ level, large }) {
  const [bg, color] = RISK_COLORS[level] || RISK_COLORS.LOW
  return (
    <span style={{ 
      background: bg, 
      color, 
      borderRadius: 20, 
      padding: large ? '6px 18px' : '4px 12px', 
      fontSize: large ? 13 : 11, 
      fontWeight: 700, 
      letterSpacing: '0.12em', 
      textTransform: 'uppercase', 
      fontFamily: 'JetBrains Mono, monospace' 
    }}>
      {level}
    </span>
  )
}

export function GTBadge({ label }) {
  const isFraud = label === true || label === 'Yes' || label === 'true'
  return (
    <span style={{ 
      background: isFraud ? 'rgba(232,93,93,0.12)' : 'rgba(56,178,172,0.12)', 
      color: isFraud ? 'var(--red)' : 'var(--teal)', 
      borderRadius: 20, 
      padding: '3px 10px', 
      fontSize: 10, 
      fontWeight: 700, 
      letterSpacing: '0.08em' 
    }}>
      {isFraud ? '⚑ FRAUD' : '✓ LEGIT'}
    </span>
  )
}

export function SignalPills({ signals }) {
  const map = { 
    billing: ['BIL', 'var(--amber)'], 
    collusion: ['COL', 'var(--red)'], 
    patient: ['PAT', 'var(--teal)'], 
    temporal: ['TMP', '#b080e0'] 
  }
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {Object.entries(map).map(([k, [label, color]]) => (
        <span key={k} style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          padding: '2px 7px', borderRadius: 20,
          background: signals && signals[k] ? `${color}22` : 'rgba(80,80,100,0.08)',
          color: signals && signals[k] ? color : 'var(--dim)',
          border: signals && signals[k] ? `1px solid ${color}33` : '1px solid transparent',
        }}>
          {label}
        </span>
      ))}
    </div>
  )
}
