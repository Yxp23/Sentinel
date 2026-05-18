import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GraphBackground from './GraphBackground'

const PF = '"Playfair Display", Georgia, serif'
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'

function buildAgents(meta) {
  const fmtM = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`
  const hi = meta.high_risk_count || 0
  const med = meta.medium_risk_count || 0
  const rings = meta.collusion_rings || 0
  const temp = meta.temporal_anomalies || 0
  const cases = meta.case_count || 0
  const providers = meta.provider_count || 0
  const fraud = meta.estimated_fraud_total || 0
  const patients = meta.patient_count || meta.patient_anomalies || 34
  return [
    { icon: '📊', name: 'Billing Volume Analysis',    color: 'var(--amber)', mode: 'billing',   duration: 1600,
      steps: [`Scanning ${providers} providers against peer baselines...`, 'Computing per-provider claim volume ratios...', 'Flagging providers with ratio > 1.5× peers...', `${hi + med} billing anomalies found across provider cohort`] },
    { icon: '🕸️', name: 'Collusion Network Analysis', color: 'var(--teal)',   mode: 'collusion', duration: 1600,
      steps: ['Loading physician-provider bipartite graph...', 'Tracing cross-provider physician edges...', 'Identifying coordinated referral rings...', `${rings} collusion ring${rings !== 1 ? 's' : ''} detected across provider network`] },
    { icon: '🏥', name: 'Patient Pattern Analysis',   color: 'var(--red)',    mode: 'patient',   duration: 1600,
      steps: ['Indexing beneficiary records...', 'Detecting multi-provider billing patterns...', 'Checking post-death claim submissions...', `${patients} suspicious patient patterns flagged`] },
    { icon: '⏱️', name: 'Temporal Anomaly Analysis',  color: '#b080e0',       mode: 'temporal',  duration: 1600,
      steps: ['Building full claim timeline index...', 'Detecting impossible concurrent admissions...', 'Scanning for 5+ claim bursts within 7 days...', `${temp} impossible timeline${temp !== 1 ? 's' : ''} identified`] },
    { icon: '⚖️', name: 'Synthesis Engine',           color: 'var(--amber)',  mode: 'synthesis', duration: 1600,
      steps: ['Collecting findings from all 4 agents...', 'Cross-referencing overlapping evidence...', 'Generating unified risk verdicts...', `${cases} case files complete · ${fmtM(fraud)} estimated fraud`] },
  ]
}

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
  const [activeAgent, setActiveAgent] = useState(-1)
  const [doneAgents, setDoneAgents] = useState([])
  const [progress, setProgress] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [scanY, setScanY] = useState(-4)

  const meta = data?.meta || {}
  const AGENTS = buildAgents(meta)
  const fraudCountUp = useCountUp(meta.estimated_fraud_total || 0, 2800, showSummary)
  const fmt = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`

  // Scan line
  useEffect(() => {
    let pos = -4
    const id = setInterval(() => {
      pos = (pos + 2) % (window.innerHeight + 8)
      setScanY(pos)
    }, 20)
    return () => clearInterval(id)
  }, [])

  // Agent sequence
  useEffect(() => {
    let cancelled = false

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
            if (idx + 1 < AGENTS.length) runAgent(idx + 1)
            else {
              setActiveAgent(-1)
              setGraphMode('synthesis')
              setShowSummary(true)
            }
          }, 400)
        }
      }
      requestAnimationFrame(fillBar)
    }

    const startDelay = setTimeout(() => runAgent(0), 300)
    return () => { cancelled = true; clearTimeout(startDelay) }
  }, [setGraphMode])

  const getSubStep = (agentIdx) => {
    const steps = AGENTS[agentIdx]?.steps || []
    const idx = Math.min(3, Math.floor(progress / 25))
    return steps[idx] || steps[steps.length - 1]
  }

  return (
    <motion.div
      className="grid-bg"
      data-scroll-root
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, overflowY: 'auto', paddingTop: 80, paddingBottom: 80 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <GraphBackground data={data} graphMode={activeAgent >= 0 ? AGENTS[activeAgent]?.mode : 'synthesis'} opacity={0.22} />

      {/* Scan line */}
      <div style={{ position: 'fixed', left: 0, right: 0, height: 2, top: scanY, background: 'linear-gradient(90deg, transparent, rgba(232,168,56,0.1), rgba(232,168,56,0.05), transparent)', pointerEvents: 'none', zIndex: 5 }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 700, padding: '0 24px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 44 }}
        >
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.3em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 10 }}>
            ◉ SYSTEM ONLINE
          </div>
          <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Deploying Investigation Agents
          </div>
          <div style={{ fontFamily: SF, fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>
            Medicare knowledge graph loaded · {meta.provider_count || 200} providers indexed
          </div>
        </motion.div>

        {/* Agent cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {AGENTS.map((agent, i) => {
            const isDone = doneAgents.includes(i)
            const isActive = activeAgent === i
            const isPending = !isDone && !isActive

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
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
                  <div style={{ fontSize: 20, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'var(--bg)', boxShadow: 'inset 3px 3px 7px var(--shadow-d), inset -2px -2px 5px var(--shadow-l)', flexShrink: 0 }}>
                    {isDone ? '✓' : agent.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.15em', color: 'var(--dim)', textTransform: 'uppercase' }}>
                        Agent {i + 1}
                      </div>
                      <div style={{ fontFamily: PF, fontWeight: 600, fontSize: 15, color: isActive || isDone ? 'var(--text)' : 'var(--muted)' }}>
                        {agent.name}
                      </div>
                    </div>

                    {/* Status line — shows current sub-step when active */}
                    <div style={{ fontFamily: SF, fontSize: 12, color: isDone ? agent.color : isActive ? 'var(--muted)' : 'var(--dim)', lineHeight: 1.5, minHeight: 18 }}>
                      {isDone
                        ? `✓ Complete — ${AGENTS[i].steps[3]}`
                        : isActive
                          ? getSubStep(i)
                          : 'Waiting for previous agent...'}
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

                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: isDone ? agent.color : 'var(--dim)', minWidth: 32, textAlign: 'right' }}>
                    {isDone ? '100%' : isActive ? `${Math.floor(progress)}%` : '--'}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Summary */}
        <AnimatePresence>
          {showSummary && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginTop: 36, textAlign: 'center' }}
            >
              <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '40px 44px', boxShadow: '8px 8px 22px var(--shadow-d), -6px -6px 18px var(--shadow-l), 0 0 60px rgba(232,168,56,0.07)' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.3em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Investigation Complete
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', fontWeight: 700, color: 'var(--amber)', lineHeight: 1, marginBottom: 4 }}>
                  {fmt(fraudCountUp)}
                </div>
                <div style={{ fontFamily: SF, fontWeight: 300, fontSize: 13, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 24 }}>
                  Estimated Fraud Identified
                </div>
                <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginBottom: 32 }}>
                  {[
                    { val: meta.case_count || 15, label: 'Case Files' },
                    { val: meta.high_risk_count || 14, label: 'HIGH Risk' },
                    { val: meta.collusion_rings || 5, label: 'Collusion Rings' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>{s.val}</div>
                      <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
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
                    padding: '14px 44px',
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
