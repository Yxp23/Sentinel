import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

const PF = '"Playfair Display", Georgia, serif'
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'

const AGENTS = [
  { icon: '📊', name: 'Billing Volume Agent', color: 'var(--amber)',
    desc: 'Walks the Provider→Claim subgraph. Computes per-provider claims and amount ratios against peer averages. Flags providers with ratios > 1.5× as potential overbilling or phantom claim fabrication.' },
  { icon: '🕸️', name: 'Collusion Network Agent', color: 'var(--red)',
    desc: 'Walks Provider→Claim→Physician edges. Detects physicians appearing across multiple providers simultaneously — a classic organized fraud ring signature. Assesses total money flowing through each shared physician.' },
  { icon: '🏥', name: 'Patient Pattern Agent', color: 'var(--teal)',
    desc: 'Walks Patient→Claim edges. Flags patients billed by 3+ providers, deceased patients with post-death claims, high-volume patients, and multi-provider fraud overlaps — catching patient-level abuse patterns.' },
  { icon: '⏱️', name: 'Temporal Anomaly Agent', color: '#b080e0',
    desc: 'Examines WHEN claims happened. Detects impossible simultaneous hospital stays, 5+ claim bursts within 7 days (batch fabrication), same-day patient shuttling, and post-death billing.' },
  { icon: '⚖️', name: 'Synthesis Agent', color: 'var(--amber)',
    desc: 'Receives findings from all 4 specialist agents and synthesizes them into a unified case file per provider — combining evidence, resolving conflicts, and producing an overall risk verdict with actionable recommendations.' },
]

// Mini animated investigation demo
const PHASES = [
  { label: 'Building knowledge graph...', color: '#8888aa',   active: 'graph' },
  { label: 'Billing Agent scanning provider volumes...', color: '#e8a838', active: 'billing' },
  { label: 'Collusion Agent mapping physician networks...', color: '#e85d5d', active: 'collusion' },
  { label: 'Patient Agent checking beneficiary patterns...', color: '#38b2ac', active: 'patient' },
  { label: 'Temporal Agent detecting impossible timelines...', color: '#b080e0', active: 'temporal' },
  { label: 'Synthesis complete — 96 HIGH RISK case files generated', color: '#e8a838', active: 'synthesis' },
]

const MNODES = [
  { id: 'prov1', x: 100, y: 80,  r: 14, type: 'provider' },
  { id: 'prov2', x: 100, y: 160, r: 14, type: 'provider' },
  { id: 'prov3', x: 100, y: 240, r: 14, type: 'provider' },
  { id: 'phy1',  x: 260, y: 110, r: 10, type: 'physician' },
  { id: 'phy2',  x: 260, y: 210, r: 10, type: 'physician' },
  { id: 'pat1',  x: 400, y: 70,  r: 9,  type: 'patient' },
  { id: 'pat2',  x: 400, y: 160, r: 9,  type: 'patient' },
  { id: 'pat3',  x: 400, y: 250, r: 9,  type: 'patient' },
]

const MEDGES = [
  { s: 'prov1', t: 'phy1', type: 'collusion' },
  { s: 'prov2', t: 'phy1', type: 'collusion' },
  { s: 'prov2', t: 'phy2', type: 'collusion' },
  { s: 'prov3', t: 'phy2', type: 'collusion' },
  { s: 'prov1', t: 'pat1', type: 'patient' },
  { s: 'prov2', t: 'pat2', type: 'patient' },
  { s: 'prov3', t: 'pat3', type: 'patient' },
  { s: 'prov1', t: 'prov2', type: 'billing' },
  { s: 'prov2', t: 'prov3', type: 'billing' },
]

function nodePos(id) { return MNODES.find(n => n.id === id) || { x: 0, y: 0 } }

function MiniDemo() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const DURATIONS = [1200, 2000, 2000, 2000, 2000, 2200]
    const tick = () => setPhase(p => (p + 1) % PHASES.length)
    let elapsed = 0
    const timers = DURATIONS.map(d => { elapsed += d; return setTimeout(tick, elapsed) })
    const loop = setTimeout(() => { setPhase(0) }, elapsed + 600)
    return () => { timers.forEach(clearTimeout); clearTimeout(loop) }
  }, [phase === 0 ? phase : null]) // restart loop when phase resets

  const active = PHASES[phase].active
  const phaseColor = PHASES[phase].color

  const edgeColor = (type) => {
    if (active === 'graph') return '#ffffff15'
    if (active === 'billing' && type === 'billing') return '#e8a838'
    if (active === 'collusion' && type === 'collusion') return '#e85d5d'
    if (active === 'patient' && type === 'patient') return '#38b2ac'
    if (active === 'synthesis') return phaseColor
    return '#ffffff10'
  }

  const nodeColor = (type) => {
    if (active === 'graph') return '#404058'
    if (active === 'billing' && type === 'provider') return '#e8a838'
    if (active === 'collusion' && type === 'physician') return '#e85d5d'
    if (active === 'patient' && type === 'patient') return '#38b2ac'
    if (active === 'temporal' && type === 'provider') return '#b080e0'
    if (active === 'synthesis') return phaseColor
    return '#303050'
  }

  const nodeGlow = (type) => {
    if (active === 'billing' && type === 'provider') return `0 0 12px #e8a83888`
    if (active === 'collusion' && type === 'physician') return `0 0 12px #e85d5d88`
    if (active === 'patient' && type === 'patient') return `0 0 12px #38b2ac88`
    if (active === 'temporal' && type === 'provider') return `0 0 12px #b080e088`
    if (active === 'synthesis') return `0 0 16px ${phaseColor}88`
    return 'none'
  }

  return (
    <div className="nm-inset" style={{ padding: '36px 40px', maxWidth: 660, margin: '0 auto 48px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: '#404058', textTransform: 'uppercase', marginBottom: 24, textAlign: 'center' }}>
        Live Investigation Demo
      </div>

      {/* Mini graph SVG */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <svg width={500} height={320} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="demo-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {MEDGES.map((e, i) => {
            const s = nodePos(e.s), t = nodePos(e.t)
            const col = edgeColor(e.type)
            const lit = col !== '#ffffff15' && col !== '#ffffff10'
            return (
              <motion.line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                animate={{ stroke: col, strokeWidth: lit ? 2 : 1, strokeOpacity: lit ? 0.85 : 0.25 }}
                transition={{ duration: 0.5 }}
                strokeDasharray={e.type === 'billing' ? '4,3' : undefined}
                filter={lit ? 'url(#demo-glow)' : undefined}
              />
            )
          })}

          {/* Nodes */}
          {MNODES.map(n => {
            const col = nodeColor(n.type)
            const glow = nodeGlow(n.type)
            return (
              <motion.circle key={n.id} cx={n.x} cy={n.y} r={n.r}
                animate={{ fill: col, filter: glow !== 'none' ? 'url(#demo-glow)' : 'none', r: active === 'synthesis' ? n.r * 1.3 : n.r }}
                transition={{ duration: 0.5 }}
                stroke={col} strokeWidth={1.5}
              />
            )
          })}

          {/* Node labels */}
          {[
            { x: 100, y: 295, text: 'Providers', color: active === 'billing' ? '#e8a838' : '#404058' },
            { x: 260, y: 295, text: 'Physicians', color: active === 'collusion' ? '#e85d5d' : '#404058' },
            { x: 400, y: 295, text: 'Patients', color: active === 'patient' ? '#38b2ac' : '#404058' },
          ].map(l => (
            <motion.text key={l.text} x={l.x} y={l.y} textAnchor="middle"
              animate={{ fill: l.color }}
              transition={{ duration: 0.4 }}
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.1em' }}
            >{l.text}</motion.text>
          ))}
        </svg>
      </div>

      {/* Phase label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{ fontFamily: PF, fontSize: 15, color: phaseColor, fontWeight: 600, marginBottom: 6 }}>
            {PHASES[phase].label}
          </div>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
            {PHASES.map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === phase ? phaseColor : '#303050', transition: 'background 0.3s' }} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const FLOW_STEPS = [
  { label: 'Medicare Claims', icon: '📋', color: 'var(--muted)', sub: '66K+ records' },
  { label: 'Knowledge Graph', icon: '🗺️', color: 'var(--teal)', sub: 'Jac graph engine' },
  { label: 'Billing Agent', icon: '📊', color: 'var(--amber)', sub: 'Volume analysis' },
  { label: 'Collusion Agent', icon: '🕸️', color: 'var(--red)', sub: 'Ring detection' },
  { label: 'Patient Agent', icon: '🏥', color: 'var(--teal)', sub: 'Pattern flags' },
  { label: 'Temporal Agent', icon: '⏱️', color: '#b080e0', sub: 'Timeline audit' },
  { label: 'Synthesis', icon: '⚖️', color: 'var(--amber)', sub: 'GPT-4o-mini' },
  { label: 'Case Files', icon: '📁', color: 'var(--text)', sub: '15 investigations' },
]

export default function AboutView() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 52, maxWidth: 720, margin: '0 auto 52px' }}>
        <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 16 }}>
          How Sentinel Works
        </div>
        <div style={{ fontFamily: SF, fontSize: 16, color: 'var(--muted)', lineHeight: 1.85 }}>
          Sentinel deploys <span style={{ color: 'var(--amber)', fontWeight: 600 }}>5 specialized AI agents</span> across a Medicare claims knowledge graph.
          Each agent walks the graph, reasons about evidence using <span style={{ color: 'var(--text)', fontWeight: 500 }}>large language models</span>, and reports findings.
          Unlike traditional fraud detection that outputs a score,
          Sentinel produces <span style={{ color: 'var(--amber)', fontWeight: 600 }}>auditable investigations with full reasoning chains</span>.
        </div>
      </div>

      {/* Live animated demo */}
      <MiniDemo />

      {/* Animated Flow Diagram */}
      <div style={{ marginBottom: 56 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 24, textAlign: 'center' }}>
          Investigation Pipeline
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap', overflowX: 'auto', gap: 0, padding: '0 0 8px' }}>
          {FLOW_STEPS.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.18, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{ textAlign: 'center', minWidth: 88 }}
              >
                <motion.div
                  animate={{ boxShadow: [`4px 4px 12px var(--shadow-d), -3px -3px 9px var(--shadow-l)`, `4px 4px 12px var(--shadow-d), -3px -3px 9px var(--shadow-l), 0 0 20px ${step.color}30`, `4px 4px 12px var(--shadow-d), -3px -3px 9px var(--shadow-l)`] }}
                  transition={{ delay: i * 0.18 + 0.6, duration: 2, repeat: Infinity, repeatDelay: FLOW_STEPS.length * 0.18 }}
                  style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 22, border: `1px solid ${step.color}22` }}
                >
                  {step.icon}
                </motion.div>
                <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 600, color: step.color, marginBottom: 3, lineHeight: 1.3 }}>{step.label}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--dim)', letterSpacing: '0.06em' }}>{step.sub}</div>
              </motion.div>

              {i < FLOW_STEPS.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: i * 0.18 + 0.35, duration: 0.4 }}
                  style={{ width: 28, height: 1, background: `linear-gradient(90deg, ${step.color}44, ${FLOW_STEPS[i + 1].color}44)`, flexShrink: 0, transformOrigin: 'left', position: 'relative', top: -12 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agents grid */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 20, textAlign: 'center' }}>
          Specialist Agents
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {AGENTS.map((a, i) => (
            <motion.div
              key={a.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.8, duration: 0.5 }}
              className="nm-raised"
              style={{ padding: '28px 28px', borderLeft: `3px solid ${a.color}` }}
            >
              <div style={{ fontSize: 28, marginBottom: 14 }}>{a.icon}</div>
              <div style={{ fontFamily: PF, fontWeight: 600, fontSize: 15, color: a.color, marginBottom: 8 }}>{a.name}</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>{a.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="nm-inset"
        style={{ padding: '36px 40px', textAlign: 'center', maxWidth: 720, margin: '48px auto 0' }}
      >
        <div style={{ fontFamily: PF, fontSize: 20, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.8, marginBottom: 14 }}>
          "Existing tools give a score.{' '}
          <span style={{ color: 'var(--amber)', fontStyle: 'normal', fontWeight: 700 }}>We give an investigation.</span>"
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Built in Jac · JacHacks 2026 · Fintech Track · Multi-Agent Knowledge Graph System
        </div>
      </motion.div>
    </motion.div>
  )
}
