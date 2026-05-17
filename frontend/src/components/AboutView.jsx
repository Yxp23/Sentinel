import { motion } from 'framer-motion'

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
