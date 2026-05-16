import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GraphBackground from './GraphBackground'

const AGENTS = [
  { icon: '📊', name: 'Billing Volume Analysis', color: 'var(--amber)', mode: 'billing',   duration: 2800 },
  { icon: '🕸️', name: 'Collusion Network Analysis', color: 'var(--teal)',   mode: 'collusion', duration: 2600 },
  { icon: '🏥', name: 'Patient Pattern Analysis',  color: 'var(--red)',    mode: 'patient',   duration: 2400 },
  { icon: '⏱️', name: 'Temporal Anomaly Analysis', color: '#b080e0',       mode: 'temporal',  duration: 2200 },
  { icon: '⚖️', name: 'Synthesis Engine',          color: 'var(--amber)',  mode: 'synthesis', duration: 2000 },
]

function useCountUp(target, duration, active) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active || !target) return
    const start = Date.now()
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [active, target, duration])
  return val
}

export default function AnalysisScreen({ data, onDone, setGraphMode }) {
  const [activeAgent, setActiveAgent] = useState(-1)    // which agent is deploying (-1 = none yet)
  const [doneAgents, setDoneAgents] = useState([])      // indices of completed agents
  const [progress, setProgress] = useState(0)           // 0–100 for current agent's bar
  const [showSummary, setShowSummary] = useState(false)
  const [scanY, setScanY] = useState(-4)
  const timerRef = useRef(null)

  const meta = data?.meta || {}
  const fraudCountUp = useCountUp(meta.estimated_fraud_total || 6906440, 2000, showSummary)
  const fmt = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`

  // Result text per agent
  const results = [
    `${meta.high_risk_count || 14} anomalies detected across ${meta.provider_count || 30} providers`,
    `${meta.collusion_rings || 5} collusion rings found`,
    `${data?.case_files?.reduce((s, c) => s + (c.patient_detail?.length || 0), 0) || 34} patient patterns flagged`,
    `${meta.temporal_anomalies || 4} impossible timelines detected`,
    `${meta.case_count || 15} case files generated · ${fmt(meta.estimated_fraud_total || 6906440)} estimated fraud`,
  ]

  // Scan line
  useEffect(() => {
    let pos = -4
    const id = setInterval(() => {
      pos = (pos + 3) % (window.innerHeight + 8)
      setScanY(pos)
    }, 20)
    return () => clearInterval(id)
  }, [])

  // Agent sequence
  useEffect(() => {
    let cancelled = false
    let currentIdx = 0

    const runAgent = (idx) => {
      if (cancelled || idx >= AGENTS.length) return
      setActiveAgent(idx)
      setGraphMode(AGENTS[idx].mode)
      setProgress(0)

      const dur = AGENTS[idx].duration
      const start = Date.now()
      const fillBar = () => {
        if (cancelled) return
        const p = Math.min(((Date.now() - start) / dur) * 100, 100)
        setProgress(p)
        if (p < 100) requestAnimationFrame(fillBar)
        else {
          setDoneAgents(prev => [...prev, idx])
          setTimeout(() => {
            if (cancelled) return
            if (idx + 1 < AGENTS.length) {
              runAgent(idx + 1)
            } else {
              setActiveAgent(-1)
              setGraphMode('synthesis')
              setShowSummary(true)
            }
          }, 900)
        }
      }
      requestAnimationFrame(fillBar)
    }

    const startDelay = setTimeout(() => runAgent(0), 600)
    return () => { cancelled = true; clearTimeout(startDelay) }
  }, [setGraphMode])

  return (
    <motion.div
      className="grid-bg"
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, overflow: 'hidden' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <GraphBackground data={data} graphMode={activeAgent >= 0 ? AGENTS[activeAgent]?.mode : 'synthesis'} opacity={0.22} />

      {/* Scan line */}
      <div style={{
        position: 'fixed', left: 0, right: 0, height: 2, top: scanY,
        background: 'linear-gradient(90deg, transparent, rgba(232,168,56,0.12), rgba(232,168,56,0.06), transparent)',
        pointerEvents: 'none', zIndex: 5,
      }} />

      {/* Main content panel */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 680, padding: '0 24px' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 40 }}
        >
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.3em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 8 }}>
            ◉ SYSTEM ONLINE
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 28, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Deploying Investigation Agents
          </div>
        </motion.div>

        {/* Agent cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {AGENTS.map((agent, i) => {
            const isDone = doneAgents.includes(i)
            const isActive = activeAgent === i
            const isPending = !isDone && !isActive && i > activeAgent

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: isPending ? 0.25 : 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                style={{
                  background: 'var(--bg)',
                  borderRadius: 14,
                  padding: '18px 24px',
                  boxShadow: isActive
                    ? `6px 6px 16px var(--shadow-d), -4px -4px 12px var(--shadow-l), 0 0 30px ${agent.color}22`
                    : '6px 6px 16px var(--shadow-d), -4px -4px 12px var(--shadow-l)',
                  borderLeft: `3px solid ${isDone ? agent.color : isActive ? agent.color : 'var(--dim)'}`,
                  transition: 'box-shadow 0.4s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Icon */}
                  <div style={{ fontSize: 20, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'var(--bg)', boxShadow: 'inset 3px 3px 7px var(--shadow-d), inset -2px -2px 5px var(--shadow-l)', flexShrink: 0 }}>
                    {isDone ? '✓' : agent.icon}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.15em', color: 'var(--dim)', textTransform: 'uppercase' }}>
                        Agent {i + 1}
                      </div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, color: isActive || isDone ? 'var(--text)' : 'var(--muted)' }}>
                        {agent.name}
                      </div>
                    </div>

                    {/* Status line */}
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: isDone ? agent.color : isActive ? 'var(--muted)' : 'var(--dim)' }}>
                      {isDone
                        ? `✓ Complete — ${results[i]}`
                        : isActive
                          ? 'Analyzing Medicare claims graph...'
                          : 'Waiting...'}
                    </div>

                    {/* Progress bar */}
                    {(isActive || isDone) && (
                      <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'var(--shadow-d)', overflow: 'hidden', boxShadow: 'inset 1px 1px 3px var(--shadow-d)' }}>
                        <motion.div
                          style={{ height: '100%', borderRadius: 2, background: agent.color, transformOrigin: 'left' }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: isDone ? 1 : progress / 100 }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Agent number badge */}
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: isDone ? agent.color : 'var(--dim)', minWidth: 28, textAlign: 'right' }}>
                    {isDone ? '100%' : isActive ? `${Math.floor(progress)}%` : '--'}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Summary reveal */}
        <AnimatePresence>
          {showSummary && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginTop: 36, textAlign: 'center' }}
            >
              <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '36px 40px', boxShadow: '8px 8px 20px var(--shadow-d), -6px -6px 16px var(--shadow-l), 0 0 60px rgba(232,168,56,0.08)' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.3em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Investigation Complete
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(2.5rem, 7vw, 4rem)', fontWeight: 700, color: 'var(--amber)', lineHeight: 1, marginBottom: 4 }}>
                  {fmt(fraudCountUp)}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300, fontSize: 13, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 20 }}>
                  Estimated Fraud Identified
                </div>
                <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 28 }}>
                  {[
                    { val: meta.case_count || 15, label: 'Case Files' },
                    { val: meta.high_risk_count || 14, label: 'HIGH Risk' },
                    { val: meta.collusion_rings || 5, label: 'Collusion Rings' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{s.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onDone}
                  style={{
                    background: 'var(--bg)',
                    border: 'none',
                    borderRadius: 10,
                    color: 'var(--amber)',
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    padding: '14px 40px',
                    textTransform: 'uppercase',
                    boxShadow: '5px 5px 12px var(--shadow-d), -4px -4px 10px var(--shadow-l)',
                  }}
                >
                  View Case Files →
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
