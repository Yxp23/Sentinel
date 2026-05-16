import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const fmt = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`

function useCountUp(target, duration = 1400) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return val
}

export default function ValidationView({ data }) {
  const cases = data?.case_files || []
  const highCases = cases.filter(c => c.overall_risk_level === 'HIGH')
  const truePositives = highCases.filter(c => c.fraud_label === true || c.fraud_label === 'Yes' || c.fraud_label === 'true')
  const precision = highCases.length > 0 ? Math.round((truePositives.length / highCases.length) * 100) : 0
  const pVal = useCountUp(precision)

  const flagged = cases.filter(c => c.overall_risk_level !== 'LOW')

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} style={{ padding: '32px 40px 60px' }}>
      {/* Hero */}
      <div className="nm-raised" style={{ textAlign: 'center', padding: '48px 24px 40px', marginBottom: 36, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(232,168,56,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(4rem, 12vw, 7rem)', fontWeight: 800, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 80px rgba(232,168,56,0.2)' }}>
          {pVal}%
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300, fontSize: 13, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', margin: '10px 0 20px' }}>
          Precision Score
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
          Agents flagged <strong style={{ color: 'var(--text)' }}>{highCases.length}</strong> providers as HIGH risk.
          Ground truth confirms <strong style={{ color: 'var(--amber)' }}>{truePositives.length}</strong> are actual fraud.
          <strong style={{ color: 'var(--red)' }}> {highCases.length - truePositives.length}</strong> false positive{highCases.length - truePositives.length !== 1 ? 's' : ''}.
        </div>
      </div>

      {/* Table */}
      <div className="nm-inset" style={{ padding: '8px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 120px 80px 140px', gap: 0, padding: '10px 20px', marginBottom: 4 }}>
          {['Provider ID', 'Agent Risk', 'Ground Truth', 'Match', 'Est. Fraud'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--dim)', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 4px 4px' }}>
          {flagged.map((cf, i) => {
            const gt = cf.fraud_label === true || cf.fraud_label === 'Yes' || cf.fraud_label === 'true'
            const match = (cf.overall_risk_level === 'HIGH' && gt) || (cf.overall_risk_level === 'MEDIUM')
            return (
              <motion.div
                key={cf.provider_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
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
                  <span style={{ background: gt ? 'rgba(232,93,93,0.12)' : 'rgba(56,178,172,0.12)', color: gt ? 'var(--red)' : 'var(--teal)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
                    {gt ? '⚑ FRAUD' : '✓ LEGIT'}
                  </span>
                </div>
                <div style={{ fontSize: 20, alignSelf: 'center' }}>{match ? '✅' : '❌'}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: cf.estimated_fraud_amount > 0 ? 'var(--amber)' : 'var(--dim)', alignSelf: 'center' }}>
                  {cf.estimated_fraud_amount > 0 ? fmt(cf.estimated_fraud_amount) : '—'}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
