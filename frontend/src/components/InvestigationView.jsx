import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GraphBackground from './GraphBackground'

const fmt = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`

function RiskBadge({ level, large }) {
  const colors = { HIGH: ['rgba(232,168,56,0.12)', 'var(--amber)'], MEDIUM: ['rgba(56,178,172,0.12)', 'var(--teal)'], LOW: ['rgba(80,80,100,0.1)', 'var(--dim)'] }
  const [bg, color] = colors[level] || colors.LOW
  return (
    <span style={{ background: bg, color, borderRadius: 20, padding: large ? '6px 18px' : '4px 12px', fontSize: large ? 13 : 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
      {level}
    </span>
  )
}

// Horizontal pipeline showing agent activation
function AgentPipeline({ activeStep }) {
  const steps = ['Data', 'Billing', 'Collusion', 'Patient', 'Temporal', 'Synthesis']
  const colors = ['var(--muted)', 'var(--amber)', 'var(--red)', 'var(--teal)', '#b080e0', 'var(--amber)']

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '20px 0', overflowX: 'auto' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <motion.div
            initial={{ opacity: 0.3 }}
            animate={{ opacity: i <= activeStep ? 1 : 0.3 }}
            transition={{ delay: i * 0.15, duration: 0.5 }}
            style={{
              background: 'var(--bg)',
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: i <= activeStep ? colors[i] : 'var(--dim)',
              boxShadow: i <= activeStep
                ? `4px 4px 10px var(--shadow-d), -3px -3px 8px var(--shadow-l), 0 0 16px ${colors[i]}22`
                : 'inset 2px 2px 5px var(--shadow-d), inset -2px -2px 4px var(--shadow-l)',
              transition: 'all 0.4s',
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'nowrap',
            }}
          >
            {s}
          </motion.div>
          {i < steps.length - 1 && (
            <motion.div
              animate={{ opacity: i < activeStep ? 0.7 : 0.15 }}
              transition={{ delay: i * 0.15 + 0.3, duration: 0.4 }}
              style={{ width: 32, height: 1, background: i < activeStep ? colors[i + 1] : 'var(--dim)', flexShrink: 0 }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function AgentSection({ icon, agentNum, name, sub, borderColor, children, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'var(--bg)',
        borderRadius: 14,
        padding: '28px 32px',
        boxShadow: `7px 7px 18px var(--shadow-d), -5px -5px 14px var(--shadow-l)`,
        borderLeft: `3px solid ${borderColor}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div style={{ fontSize: 22, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--bg)', boxShadow: 'inset 3px 3px 7px var(--shadow-d), inset -2px -2px 6px var(--shadow-l)', flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 3 }}>Agent {agentNum} — {name}</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--muted)', fontWeight: 400 }}>{sub}</div>
        </div>
      </div>
      {children}
    </motion.div>
  )
}

function FindingItem({ text, color = 'var(--amber)' }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 14px 10px 16px', borderRadius: 10, background: 'rgba(5,5,14,0.4)', lineHeight: 1.6, borderLeft: `2px solid ${color}44`, marginBottom: 6 }}>
      {text}
    </div>
  )
}

function ReasoningBlock({ text }) {
  return (
    <div className="nm-inset" style={{ padding: '16px 18px', marginTop: 10 }}>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, fontStyle: 'italic' }}>
        "{text}"
      </div>
    </div>
  )
}

function NoFindings({ text }) {
  return <div style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center', padding: '24px 0', letterSpacing: '0.04em' }}>{text}</div>
}

export default function InvestigationView({ data, provider: cf, onBack }) {
  const [activeStep, setActiveStep] = useState(5)

  if (!cf) return null

  const bil = cf.billing_detail
  const rings = cf.collusion_detail || []
  const pats = cf.patient_detail || []
  const temps = cf.temporal_detail || []
  const gt = cf.fraud_label === true || cf.fraud_label === 'Yes' || cf.fraud_label === 'true'

  return (
    <motion.div
      className="grid-bg"
      style={{ minHeight: '100vh', position: 'relative' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GraphBackground data={data} graphMode="investigation" highlightProvider={cf.provider_id} opacity={0.2} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* TOP BAR */}
        <div style={{ padding: '18px 40px', background: 'rgba(15,15,26,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
            <button onClick={onBack} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '8px 16px', boxShadow: '4px 4px 10px var(--shadow-d), -3px -3px 8px var(--shadow-l)', display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Back
            </button>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}>
              Investigating
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.06em' }}>
              {cf.provider_id}
            </div>
            <RiskBadge level={cf.overall_risk_level} large />
            {cf.estimated_fraud_amount > 0 && (
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 600, color: 'var(--amber)' }}>
                {fmt(cf.estimated_fraud_amount)} estimated
              </div>
            )}
            <span style={{ background: gt ? 'rgba(232,93,93,0.12)' : 'rgba(56,178,172,0.12)', color: gt ? 'var(--red)' : 'var(--teal)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
              {gt ? '⚑ Ground Truth: FRAUD' : '✓ Ground Truth: LEGIT'}
            </span>
          </div>

          {/* Pipeline */}
          <AgentPipeline activeStep={activeStep} />
        </div>

        {/* Agent sections */}
        <div style={{ padding: '32px 40px 60px', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Agent 1: Billing */}
          <AgentSection icon="📊" agentNum={1} name="Billing Analysis" sub="Volume & amount anomaly detection" borderColor="var(--amber)" delay={0.1}>
            {bil ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Risk Level', val: bil.risk_level, color: bil.risk_level === 'HIGH' ? 'var(--amber)' : 'var(--teal)' },
                    { label: 'Anomalies Found', val: bil.anomalies?.length || 0, color: 'var(--text)' },
                  ].map(m => (
                    <div key={m.label} className="nm-inset-sm" style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 6 }}>{m.label}</div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: m.color }}>{m.val}</div>
                    </div>
                  ))}
                </div>
                {bil.anomalies?.map((a, i) => <FindingItem key={i} text={a} />)}
                {bil.reasoning && <ReasoningBlock text={bil.reasoning.substring(0, 360)} />}
              </>
            ) : <NoFindings text="No billing anomalies detected for this provider" />}
          </AgentSection>

          {/* Agent 2: Collusion */}
          <AgentSection icon="🕸️" agentNum={2} name="Collusion Network" sub="Physician-linked fraud ring detection" borderColor="var(--red)" delay={0.7}>
            {rings.length > 0 ? (
              <>
                {rings.map((r, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <FindingItem
                      text={`Physician ${r.physician_id} connects ${r.connected_providers?.length} providers (${r.fraud_providers_in_ring?.length} fraud-labeled) · ${fmt(r.total_ring_amount)} flowing through ring`}
                      color="var(--red)"
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, marginLeft: 4 }}>
                      {r.connected_providers?.map(p => (
                        <span key={p} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '2px 8px', borderRadius: 4, background: r.fraud_providers_in_ring?.includes(p) ? 'rgba(232,93,93,0.12)' : 'rgba(80,80,100,0.1)', color: r.fraud_providers_in_ring?.includes(p) ? 'var(--red)' : 'var(--dim)' }}>{p}</span>
                      ))}
                    </div>
                    <ReasoningBlock text={r.reasoning?.substring(0, 300)} />
                  </div>
                ))}
              </>
            ) : <NoFindings text="No physician collusion rings detected for this provider" />}
          </AgentSection>

          {/* Agent 3: Patient */}
          <AgentSection icon="🏥" agentNum={3} name="Patient Patterns" sub="Multi-provider & high-volume patient flags" borderColor="var(--teal)" delay={1.3}>
            {pats.length > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Total Flagged', val: pats.length },
                    { label: 'HIGH Risk', val: pats.filter(p => p.risk_level === 'HIGH').length, color: 'var(--amber)' },
                    { label: 'MEDIUM Risk', val: pats.filter(p => p.risk_level === 'MEDIUM').length, color: 'var(--teal)' },
                  ].map(m => (
                    <div key={m.label} className="nm-inset-sm" style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 5 }}>{m.label}</div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: m.color || 'var(--text)' }}>{m.val}</div>
                    </div>
                  ))}
                </div>
                {pats.slice(0, 4).map((p, i) => (
                  <FindingItem key={i} text={`${p.patient_id}  ·  ${p.risk_level}  ·  flags: ${p.flags?.join(', ')}`} color="var(--teal)" />
                ))}
                {pats[0]?.reasoning && <ReasoningBlock text={pats[0].reasoning.substring(0, 320)} />}
              </>
            ) : <NoFindings text="No suspicious patient patterns found at this provider" />}
          </AgentSection>

          {/* Agent 4: Temporal */}
          <AgentSection icon="⏱️" agentNum={4} name="Temporal Analysis" sub="Impossible timelines & post-death billing" borderColor="#b080e0" delay={1.9}>
            {temps.length > 0 ? (
              <>
                {temps.map((t, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <FindingItem
                      text={`${t.anomaly_type?.replace(/_/g, ' ').toUpperCase()} — Patient ${t.patient_id} — ${t.timeline_evidence?.substring(0, 140)}`}
                      color="#b080e0"
                    />
                    {t.reasoning && <ReasoningBlock text={t.reasoning.substring(0, 280)} />}
                  </div>
                ))}
              </>
            ) : <NoFindings text="No temporal anomalies detected (overlapping stays, claim bursts, or post-death billing)" />}
          </AgentSection>

          {/* Agent 5: Synthesis — visually distinct */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: 'var(--bg)',
              borderRadius: 16,
              padding: '36px 40px',
              boxShadow: `8px 8px 22px var(--shadow-d), -6px -6px 18px var(--shadow-l), 0 0 60px rgba(232,168,56,0.06)`,
              border: '1px solid rgba(232,168,56,0.12)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Amber glow behind */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(232,168,56,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
              <div style={{ fontSize: 24, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: 'var(--bg)', boxShadow: 'inset 3px 3px 8px var(--shadow-d), inset -2px -2px 6px var(--shadow-l)' }}>⚖️</div>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 3 }}>Agent 5 — Synthesis Verdict</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--muted)' }}>Combined cross-agent assessment</div>
              </div>
            </div>

            {/* Verdict */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, marginBottom: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 6 }}>Overall Verdict</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(2.5rem, 6vw, 3.5rem)', fontWeight: 800, color: cf.overall_risk_level === 'HIGH' ? 'var(--amber)' : cf.overall_risk_level === 'MEDIUM' ? 'var(--teal)' : 'var(--dim)', lineHeight: 1, textShadow: cf.overall_risk_level === 'HIGH' ? '0 0 40px rgba(232,168,56,0.3)' : 'none' }}>
                  {cf.overall_risk_level} RISK
                </div>
              </div>
              {cf.estimated_fraud_amount > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 6 }}>Estimated Exposure</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 700, color: 'var(--amber)' }}>{fmt(cf.estimated_fraud_amount)}</div>
                </div>
              )}
            </div>

            {/* Reasoning */}
            <div className="nm-inset" style={{ padding: '20px 22px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.9 }}>
                {cf.combined_reasoning}
              </div>
            </div>

            {/* Action */}
            <div style={{ background: 'rgba(232,168,56,0.04)', borderRadius: 12, padding: '18px 20px', borderLeft: '3px solid var(--amber)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 5 }}>Recommended Action</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text)', lineHeight: 1.6, fontWeight: 500 }}>{cf.recommended_action}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
