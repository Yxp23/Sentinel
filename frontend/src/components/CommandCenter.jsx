import { motion } from 'framer-motion'
import GraphBackground from './GraphBackground'
import ValidationView from './ValidationView'
import AboutView from './AboutView'

const fmt = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`

function RiskBadge({ level }) {
  const colors = { HIGH: ['rgba(232,168,56,0.12)', 'var(--amber)'], MEDIUM: ['rgba(56,178,172,0.12)', 'var(--teal)'], LOW: ['rgba(80,80,100,0.12)', 'var(--dim)'] }
  const [bg, color] = colors[level] || colors.LOW
  return (
    <span style={{ background: bg, color, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
      {level}
    </span>
  )
}

function GTBadge({ label }) {
  const isFraud = label === true || label === 'Yes' || label === 'true'
  return (
    <span style={{ background: isFraud ? 'rgba(232,93,93,0.12)' : 'rgba(56,178,172,0.12)', color: isFraud ? 'var(--red)' : 'var(--teal)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
      {isFraud ? '⚑ FRAUD' : '✓ LEGIT'}
    </span>
  )
}

function SignalPills({ signals }) {
  const map = { billing: ['BIL', 'var(--amber)'], collusion: ['COL', 'var(--red)'], patient: ['PAT', 'var(--teal)'], temporal: ['TMP', '#b080e0'] }
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {Object.entries(map).map(([k, [label, color]]) => (
        <span key={k} style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          padding: '2px 7px', borderRadius: 20,
          background: signals[k] ? `${color}22` : 'rgba(80,80,100,0.08)',
          color: signals[k] ? color : 'var(--dim)',
          border: signals[k] ? `1px solid ${color}33` : '1px solid transparent',
        }}>
          {label}
        </span>
      ))}
    </div>
  )
}

export default function CommandCenter({ data, activeTab, setActiveTab, onInvestigate, graphMode }) {
  const meta = data?.meta || {}
  const cases = data?.case_files || []
  const sorted = [...cases].sort((a, b) => b.estimated_fraud_amount - a.estimated_fraud_amount)

  const tabs = [
    { id: 'command', label: 'Command Center' },
    { id: 'validation', label: 'Validation' },
    { id: 'about', label: 'About' },
  ]

  const statCards = [
    { label: 'Agents Deployed', val: '5', sub: 'billing · collusion · patient · temporal · synthesis', color: 'var(--text)' },
    { label: 'High Risk', val: meta.high_risk_count ?? 14, color: 'var(--amber)', sub: 'referred for audit' },
    { label: 'Medium Risk', val: meta.medium_risk_count ?? 1, color: 'var(--teal)', sub: 'flagged for review' },
    { label: 'Collusion Rings', val: meta.collusion_rings ?? 5, color: 'var(--text)', sub: 'physician-linked networks' },
    { label: 'Temporal Anomalies', val: meta.temporal_anomalies ?? 0, color: '#b080e0', sub: 'impossible timelines' },
  ]

  return (
    <motion.div
      className="grid-bg"
      style={{ minHeight: '100vh', position: 'relative' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GraphBackground data={data} graphMode="idle" opacity={0.12} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* TOP BAR */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 40px',
          background: 'rgba(15,15,26,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, letterSpacing: '0.25em', color: 'var(--amber)', textTransform: 'uppercase' }}>
              Sentinel
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', marginTop: 2 }}>
              Multi-Agent Fraud Investigation System
            </div>
          </div>

          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 20, letterSpacing: '0.03em' }}>
            <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{meta.provider_count || 30}</span> Providers Scanned</span>
            <span style={{ color: 'var(--dim)' }}>|</span>
            <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{meta.case_count || 15}</span> Cases Generated</span>
            <span style={{ color: 'var(--dim)' }}>|</span>
            <span><span style={{ color: 'var(--amber)', fontWeight: 600 }}>{fmt(meta.estimated_fraud_total || 6906440)}</span> Est. Fraud</span>
          </div>

          <nav style={{ display: 'flex', gap: 8 }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  background: 'var(--bg)',
                  border: 'none',
                  borderRadius: 8,
                  color: activeTab === t.id ? 'var(--amber)' : 'var(--muted)',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '8px 18px',
                  boxShadow: activeTab === t.id
                    ? 'inset 3px 3px 7px var(--shadow-d), inset -2px -2px 5px var(--shadow-l)'
                    : '4px 4px 10px var(--shadow-d), -3px -3px 8px var(--shadow-l)',
                  transition: 'all 0.2s',
                  letterSpacing: '0.02em',
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* COMMAND CENTER TAB */}
        {activeTab === 'command' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 18, padding: '32px 40px 0', flexWrap: 'wrap' }}>
              {statCards.map(c => (
                <div key={c.label} className="nm-raised" style={{ flex: 1, minWidth: 160, padding: '24px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 10 }}>{c.label}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 38, fontWeight: 800, color: c.color, lineHeight: 1, marginBottom: 8 }}>{c.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: '0.04em' }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Provider table */}
            <div style={{ padding: '28px 40px 48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Flagged Providers — Click to Investigate
                </div>
              </div>

              <div className="nm-inset" style={{ padding: '8px 4px' }}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '160px 100px 120px 160px 110px 1fr', gap: 0, padding: '10px 20px', marginBottom: 4 }}>
                  {['Provider ID', 'Risk', 'Est. Fraud', 'Signals', 'Ground Truth', 'Action'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--dim)', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>

                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 4px 4px' }}>
                  {sorted.map((cf, i) => (
                    <motion.div
                      key={cf.provider_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4 }}
                      onClick={() => onInvestigate(cf.provider_id)}
                      className="nm-raised"
                      style={{
                        display: 'grid', gridTemplateColumns: '160px 100px 120px 160px 110px 1fr',
                        gap: 0, padding: '16px 20px',
                        cursor: 'pointer', transition: 'all 0.2s',
                        borderRadius: 12,
                      }}
                      whileHover={{ y: -2, boxShadow: '8px 8px 20px var(--shadow-d), -5px -5px 15px var(--shadow-l)' }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 500, color: 'var(--text)', alignSelf: 'center' }}>
                        {cf.provider_id}
                      </div>
                      <div style={{ alignSelf: 'center' }}>
                        <RiskBadge level={cf.overall_risk_level} />
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: cf.estimated_fraud_amount > 0 ? 'var(--amber)' : 'var(--dim)', alignSelf: 'center' }}>
                        {cf.estimated_fraud_amount > 0 ? fmt(cf.estimated_fraud_amount) : '—'}
                      </div>
                      <div style={{ alignSelf: 'center' }}>
                        <SignalPills signals={cf.agent_signals} />
                      </div>
                      <div style={{ alignSelf: 'center' }}>
                        <GTBadge label={cf.fraud_label} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cf.recommended_action?.split('.')[0]?.substring(0, 55) + '…'}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'validation' && <ValidationView data={data} />}
        {activeTab === 'about' && <AboutView />}
      </div>
    </motion.div>
  )
}
