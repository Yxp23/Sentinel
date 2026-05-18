import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const PF = '"Playfair Display", Georgia, serif'
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
const fmt = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`

function useCountUp(target, duration = 3000) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 4)) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    const id = setTimeout(() => requestAnimationFrame(tick), 300)
    return () => clearTimeout(id)
  }, [target, duration])
  return val
}

export default function ValidationView({ data }) {
  const cases = data?.case_files || []
  const hasLabels = cases.some(c => c.fraud_label === true || c.fraud_label === false)
  const highCases = cases.filter(c => c.overall_risk_level === 'HIGH')
  const isKnownFraud = c => c.fraud_label === true || c.fraud_label === 'Yes' || c.fraud_label === 'true'
  const truePositives = highCases.filter(isKnownFraud)
  const falsePositives = highCases.length - truePositives.length
  const actualFraud = cases.filter(isKnownFraud)
  const missed = actualFraud.filter(c => c.overall_risk_level === 'LOW').length
  const precision = highCases.length > 0 ? Math.round((truePositives.length / highCases.length) * 100) : 0
  const recall = actualFraud.length > 0 ? Math.round((truePositives.length / actualFraud.length) * 100) : 0
  const pVal = useCountUp(precision, 3000)

  const flagged = cases.filter(c => c.overall_risk_level !== 'LOW')

  if (!hasLabels) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        style={{ padding: '32px 40px 60px', maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 28, color: 'var(--text)', marginBottom: 20 }}>Agent Validation</div>
        <div className="nm-raised" style={{ padding: '48px 40px', borderLeft: '3px solid var(--amber)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontFamily: PF, fontWeight: 600, fontSize: 20, color: 'var(--text)', marginBottom: 12 }}>No Ground Truth Labels Available</div>
          <div style={{ fontFamily: SF, fontSize: 14, color: 'var(--muted)', lineHeight: 1.85, maxWidth: 480, margin: '0 auto' }}>
            This dataset was uploaded without a fraud labels file (e.g. Test dataset). The agents ran detection purely on behavioral signals —
            billing anomalies, collusion networks, patient patterns, and temporal impossibilities.
            <br /><br />
            To see precision/recall metrics, upload a dataset that includes a labels CSV with a <code style={{ color: 'var(--amber)', background: 'rgba(232,168,56,0.1)', padding: '1px 6px', borderRadius: 4 }}>PotentialFraud</code> column.
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--dim)', marginTop: 24, letterSpacing: '0.1em' }}>
            {highCases.length} HIGH · {flagged.length - highCases.length} MEDIUM · Detection complete
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} style={{ padding: '32px 40px 60px' }}>

      {/* Context */}
      <div style={{ maxWidth: 760, margin: '0 auto 36px', textAlign: 'center' }}>
        <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 28, color: 'var(--text)', marginBottom: 14 }}>
          Agent Validation
        </div>
        <div style={{ fontFamily: SF, fontSize: 14, color: 'var(--muted)', lineHeight: 1.85 }}>
          Sentinel's findings are validated against confirmed fraud labels in the CMS Medicare dataset.
          This measures whether the agents correctly identify real fraud versus generating false alarms —
          the core challenge in fraud detection where <span style={{ color: 'var(--amber)', fontWeight: 500 }}>false positives waste investigator time</span> and{' '}
          <span style={{ color: 'var(--red)', fontWeight: 500 }}>false negatives allow fraud to continue</span>.
        </div>
      </div>

      {/* Hero */}
      <div className="nm-raised" style={{ textAlign: 'center', padding: '48px 24px 40px', marginBottom: 28, position: 'relative', overflow: 'hidden', maxWidth: 760, margin: '0 auto 28px' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(232,168,56,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(4rem, 12vw, 7rem)', fontWeight: 800, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 80px rgba(232,168,56,0.18)' }}>
          {pVal}%
        </div>
        <div style={{ fontFamily: SF, fontWeight: 300, fontSize: 13, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', margin: '10px 0 20px' }}>
          Precision Score
        </div>
        <div style={{ fontFamily: SF, fontSize: 15, color: 'var(--muted)', lineHeight: 1.75, maxWidth: 520, margin: '0 auto 20px' }}>
          Agents flagged <strong style={{ color: 'var(--text)' }}>{highCases.length}</strong> providers as HIGH risk.
          Ground truth confirms <strong style={{ color: 'var(--amber)' }}>{truePositives.length}</strong> are actual fraud.
          <strong style={{ color: 'var(--red)' }}> {falsePositives}</strong> false positive{falsePositives !== 1 ? 's' : ''}.
        </div>

        {/* TP / FP / Missed breakdown */}
        <div style={{ display: 'flex', gap: 0, justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, marginTop: 4 }}>
          {[
            { label: 'True Positives', val: truePositives.length, color: 'var(--amber)', desc: 'Fraud correctly flagged HIGH' },
            { label: 'False Positives', val: falsePositives, color: 'var(--red)', desc: 'Legit providers flagged HIGH' },
            { label: 'Missed (LOW)', val: missed, color: 'var(--dim)', desc: 'Fraud below detection threshold' },
            { label: 'Recall', val: `${recall}%`, color: 'var(--teal)', desc: 'Known fraud caught as HIGH' },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, padding: '0 20px', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: 'var(--dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      {/* What This Means */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="nm-raised"
        style={{ maxWidth: 760, margin: '0 auto 36px', padding: '32px 36px', borderLeft: '3px solid var(--amber)', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 0% 50%, rgba(232,168,56,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 12 }}>
          What This Means
        </div>
        <div style={{ fontFamily: PF, fontWeight: 600, fontSize: 18, color: 'var(--text)', marginBottom: 14, lineHeight: 1.4 }}>
          {precision}% precision — agents stand on their own signals, no labels used.
        </div>
        <div style={{ fontFamily: SF, fontSize: 14, color: 'var(--muted)', lineHeight: 1.85 }}>
          Sentinel detects fraud purely from behavioral signals — billing anomalies, physician collusion networks,
          patient patterns, and temporal impossibilities. Ground-truth fraud labels are <span style={{ color: 'var(--amber)', fontWeight: 500 }}>not used during detection</span>,
          only here for validation. The {precision}% precision on HIGH risk flags means{' '}
          {falsePositives === 0 ? 'zero wasted' : 'minimal'} investigator hours chasing false leads.
        </div>
        <div style={{ fontFamily: SF, fontSize: 14, color: 'var(--muted)', lineHeight: 1.85, marginTop: 12 }}>
          Traditional rule-based systems typically achieve <span style={{ color: 'var(--red)', fontWeight: 500 }}>40–60% precision</span>. Sentinel's multi-agent approach —
          requiring convergent evidence across billing volume, collusion, patient pattern, and temporal anomaly agents —
          drives precision to {precision}% while catching {recall}% of known fraud as HIGH risk.
        </div>
      </motion.div>

      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 14 }}>
          Flagged Provider Breakdown
        </div>
        <div className="nm-inset" style={{ padding: '8px 4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 120px 80px 140px', gap: 0, padding: '10px 20px', marginBottom: 4 }}>
            {['Provider ID', 'Agent Risk', 'Ground Truth', 'Match', 'Est. Fraud'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--dim)', textTransform: 'uppercase', fontFamily: SF }}>{h}</div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 4px 4px' }}>
            {flagged.map((cf, i) => {
              const gt = isKnownFraud(cf)
              const isHigh = cf.overall_risk_level === 'HIGH'
              const matchIcon = isHigh && gt ? '✅' : isHigh && !gt ? '❌' : gt ? '🟡' : '⚪'
              return (
                <motion.div
                  key={cf.provider_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.035, duration: 0.3 }}
                  className="nm-raised"
                  style={{ display: 'grid', gridTemplateColumns: '160px 120px 120px 80px 140px', gap: 0, padding: '14px 20px', borderRadius: 12 }}
                >
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 500, color: 'var(--text)', alignSelf: 'center' }}>{cf.provider_id}</div>
                  <div style={{ alignSelf: 'center' }}>
                    <span style={{ background: cf.overall_risk_level === 'HIGH' ? 'rgba(232,168,56,0.12)' : 'rgba(56,178,172,0.12)', color: cf.overall_risk_level === 'HIGH' ? 'var(--amber)' : 'var(--teal)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>
                      {cf.overall_risk_level}
                    </span>
                  </div>
                  <div style={{ alignSelf: 'center' }}>
                    {cf.fraud_label === null || cf.fraud_label === undefined
                      ? <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--dim)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>— N/A</span>
                      : <span style={{ background: gt ? 'rgba(232,93,93,0.12)' : 'rgba(56,178,172,0.12)', color: gt ? 'var(--red)' : 'var(--teal)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
                          {gt ? '⚑ FRAUD' : '✓ LEGIT'}
                        </span>
                    }
                  </div>
                  <div style={{ fontSize: 18, alignSelf: 'center' }} title={isHigh && gt ? 'True positive' : isHigh && !gt ? 'False positive' : gt ? 'Detected MEDIUM (under-escalated)' : 'MEDIUM, legit'}>{matchIcon}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: cf.estimated_fraud_amount > 0 ? 'var(--amber)' : 'var(--dim)', alignSelf: 'center' }}>
                    {cf.estimated_fraud_amount > 0 ? fmt(cf.estimated_fraud_amount) : '—'}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
