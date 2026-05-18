import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import GraphBackground from './GraphBackground'
import ValidationView from './ValidationView'
import AboutView from './AboutView'
import { fmt } from '../utils'
import { RiskBadge, GTBadge, SignalPills } from './shared/Badges'

// Simple count up hook for stats
function useCountUp(target, duration = 1500) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    const start = Date.now()
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return val
}

export default function CommandCenter({ data, activeTab, setActiveTab, onInvestigate, graphMode, onChangeDataset }) {
  const [xRayMode, setXRayMode] = useState(false)
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
    { label: 'High Risk', val: meta.high_risk_count ?? 0, color: 'var(--amber)', sub: 'referred for audit', isAnim: true },
    { label: 'Medium Risk', val: meta.medium_risk_count ?? 0, color: 'var(--teal)', sub: 'flagged for review', isAnim: true },
    { label: 'Collusion Rings', val: meta.collusion_rings ?? 0, color: 'var(--text)', sub: 'physician-linked networks', isAnim: true },
    { label: 'Temporal Anomalies', val: meta.temporal_anomalies ?? 0, color: '#b080e0', sub: 'impossible timelines', isAnim: true },
  ]

  const animHighRisk = useCountUp(meta.high_risk_count ?? 0)
  const animMediumRisk = useCountUp(meta.medium_risk_count ?? 0)
  const animRings = useCountUp(meta.collusion_rings ?? 0)
  const animTemporal = useCountUp(meta.temporal_anomalies ?? 0)

  const getAnimVal = (label, val) => {
    if (label === 'High Risk') return animHighRisk
    if (label === 'Medium Risk') return animMediumRisk
    if (label === 'Collusion Rings') return animRings
    if (label === 'Temporal Anomalies') return animTemporal
    return val
  }

  return (
    <motion.div
      className="grid-bg"
      style={{ minHeight: '100vh', position: 'relative' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GraphBackground data={data} graphMode={activeTab === 'command' && xRayMode ? 'xray' : 'idle'} opacity={activeTab === 'command' && xRayMode ? 1.0 : 0.12} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ALERT BANNER */}
        {(meta.high_risk_count > 0 || meta.collusion_rings > 0) && (
          <div style={{
            background: 'rgba(232,168,56,0.06)',
            borderBottom: '1px solid rgba(232,168,56,0.15)',
            padding: '8px 0',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.08em',
              color: 'var(--amber)',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', animation: 'pulseAmber 2s infinite', display: 'inline-block' }} />
                ACTIVE INVESTIGATION
              </span>
              <span style={{ color: 'var(--dim)' }}>│</span>
              <span><span style={{ fontWeight: 700 }}>{meta.high_risk_count || 0}</span> HIGH-risk providers detected</span>
              <span style={{ color: 'var(--dim)' }}>│</span>
              <span><span style={{ fontWeight: 700 }}>{meta.collusion_rings || 0}</span> collusion rings active</span>
              <span style={{ color: 'var(--dim)' }}>│</span>
              <span><span style={{ fontWeight: 700 }}>{fmt(meta.estimated_fraud_total || 0)}</span> estimated exposure</span>
              <span style={{ color: 'var(--dim)' }}>│</span>
              <span><span style={{ fontWeight: 700 }}>{meta.temporal_anomalies || 0}</span> temporal anomalies</span>
            </div>
          </div>
        )}

        {/* TOP BAR */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 40px',
          background: 'rgba(0,0,0,0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div>
            <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--amber)' }}>
              Sentinel
            </div>
            <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', marginTop: 2 }}>
              Multi-Agent Fraud Investigation System
            </div>
          </div>

          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 20, letterSpacing: '0.03em' }}>
            <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{meta.provider_count || 0}</span> Providers Scanned</span>
            <span style={{ color: 'var(--dim)' }}>|</span>
            <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{meta.case_count || 0}</span> Cases Generated</span>
            <span style={{ color: 'var(--dim)' }}>|</span>
            <span><span style={{ color: 'var(--amber)', fontWeight: 600 }}>{fmt(meta.estimated_fraud_total || 0)}</span> Est. Fraud</span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onChangeDataset && (
              <button
                onClick={onChangeDataset}
                style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.08em', padding: '6px 10px', marginRight: 4, transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--muted)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--dim)'}
              >
                ← Change Dataset
              </button>
            )}
            

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
                <div key={c.label} className="stat-card" style={{ flex: 1, minWidth: 160, padding: '24px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 10 }}>{c.label}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 38, fontWeight: 800, color: c.color, lineHeight: 1, marginBottom: 8 }}>
                    {c.isAnim ? getAnimVal(c.label, c.val) : c.val}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: '0.04em' }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Fraud Summary Charts */}
            {sorted.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: '24px 40px 0' }}>
                {/* Top Providers Bar Chart */}
                <div className="stat-card" style={{ padding: '22px 24px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 16 }}>Top Providers by Estimated Fraud</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sorted.slice(0, 8).map((cf, i) => {
                      const maxAmt = sorted[0]?.estimated_fraud_amount || 1
                      const pct = Math.round((cf.estimated_fraud_amount / maxAmt) * 100)
                      return (
                        <div key={cf.provider_id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => onInvestigate(cf.provider_id)}>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--muted)', minWidth: 80, textAlign: 'right' }}>{cf.provider_id}</div>
                          <div style={{ flex: 1, height: 18, borderRadius: 4, background: 'rgba(5,5,14,0.5)', overflow: 'hidden', position: 'relative' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                              style={{
                                height: '100%', borderRadius: 4,
                                background: cf.overall_risk_level === 'HIGH'
                                  ? 'linear-gradient(90deg, rgba(232,168,56,0.5), rgba(232,168,56,0.8))'
                                  : 'linear-gradient(90deg, rgba(56,178,172,0.4), rgba(56,178,172,0.7))',
                              }}
                            />
                          </div>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, color: 'var(--amber)', minWidth: 52, textAlign: 'right' }}>{fmt(cf.estimated_fraud_amount)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Agent Signal Distribution */}
                <div className="stat-card" style={{ padding: '22px 24px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 16 }}>Agent Signal Distribution</div>
                  {(() => {
                    const billing = cases.filter(c => c.agent_signals?.billing).length
                    const collusion = cases.filter(c => c.agent_signals?.collusion).length
                    const patient = cases.filter(c => c.agent_signals?.patient).length
                    const temporal = cases.filter(c => c.agent_signals?.temporal).length
                    const total = billing + collusion + patient + temporal || 1
                    const signals = [
                      { label: 'Billing', count: billing, color: 'var(--amber)', pct: Math.round(billing / total * 100) },
                      { label: 'Collusion', count: collusion, color: 'var(--red)', pct: Math.round(collusion / total * 100) },
                      { label: 'Patient', count: patient, color: 'var(--teal)', pct: Math.round(patient / total * 100) },
                      { label: 'Temporal', count: temporal, color: '#b080e0', pct: Math.round(temporal / total * 100) },
                    ]
                    return (
                      <>
                        {/* Stacked bar */}
                        <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', marginBottom: 20, boxShadow: 'inset 2px 2px 5px var(--shadow-d), inset -1px -1px 3px var(--shadow-l)' }}>
                          {signals.map(s => (
                            <motion.div
                              key={s.label}
                              initial={{ width: 0 }}
                              animate={{ width: `${s.pct}%` }}
                              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                              style={{ background: s.color, height: '100%', minWidth: s.count > 0 ? 4 : 0 }}
                              title={`${s.label}: ${s.count} providers`}
                            />
                          ))}
                        </div>
                        {/* Legend */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {signals.map(s => (
                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(5,5,14,0.4)' }}>
                              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.06em' }}>{s.label}</div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1, marginTop: 2 }}>{s.count}</div>
                                <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 1 }}>{s.pct}% of signals</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Provider table */}
            <div style={{ padding: '28px 40px 48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>
                  Flagged Providers — Click to Investigate
                </div>
              </div>

              <div className="nm-inset" style={{ padding: '8px 4px', overflowX: 'auto' }}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '160px 100px 120px 160px 110px 1fr', gap: 0, padding: '10px 20px', marginBottom: 4, minWidth: 750 }}>
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
                      className="stat-card"
                      style={{
                        display: 'grid', gridTemplateColumns: '160px 100px 120px 160px 110px 1fr',
                        gap: 0, padding: '16px 20px',
                        cursor: 'pointer', transition: 'all 0.2s',
                        borderRadius: 12, minWidth: 750,
                      }}
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
