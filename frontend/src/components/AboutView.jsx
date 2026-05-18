import { motion } from 'framer-motion'
import InvestigationDemo from './InvestigationDemo'

const PF   = '"Playfair Display", Georgia, serif'
const SF   = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
const MONO = 'JetBrains Mono, monospace'

const AGENTS = [
  {
    id: 'billing', icon: '📊', name: 'Billing Volume Agent', color: 'var(--amber)',
    step: 'Step 1', badge: 'VOLUME ANALYSIS',
    walk: 'Provider → Claim edges',
    how: 'Scans every claim filed by this provider and computes two ratios against the peer group average: claim count ratio and dollar amount ratio. Either ratio above 3× triggers a HIGH flag.',
    signals: [
      { icon: '⚑', label: 'Claim count ratio', sub: '>3× peer average → HIGH risk' },
      { icon: '⚑', label: 'Dollar amount ratio', sub: '>3× peer average → HIGH risk' },
      { icon: '◆', label: 'Per-claim average', sub: 'vs cohort baseline' },
    ],
    why: 'Fraudulent providers bill far more than legitimate peers — phantom claims, upcoded procedures, and inflated volumes all show up here first.',
  },
  {
    id: 'collusion', icon: '🕸️', name: 'Collusion Network Agent', color: 'var(--red)',
    step: 'Step 2', badge: 'RING DETECTION',
    walk: 'Provider → Claim → Physician edges',
    how: 'Maps every physician who appears across multiple providers. A physician linked to two or more providers with high dollar flow is a ring conduit — routing claims through a shared network.',
    signals: [
      { icon: '⚑', label: 'Shared physician', sub: 'Links ≥2 providers → ring found' },
      { icon: '⚑', label: 'Ring dollar flow', sub: 'Total $ flowing through shared physicians' },
      { icon: '◆', label: 'Ring size', sub: 'Number of coordinated providers' },
    ],
    why: 'Organized Medicare fraud rings use shared physicians as referral hubs. Detecting a single physician connecting multiple providers exposes the entire network.',
  },
  {
    id: 'patient', icon: '🏥', name: 'Patient Pattern Agent', color: 'var(--teal)',
    step: 'Step 3', badge: 'PATIENT FLAGS',
    walk: 'Patient → Claim → Provider edges',
    how: 'Checks whether the same patient is billed by multiple providers, whether deceased patients have post-death claims, and whether any single patient has an abnormally high claim volume.',
    signals: [
      { icon: '⚑', label: 'Multi-provider overlap', sub: 'Patient billed by ≥3 providers' },
      { icon: '⚑', label: 'Post-death claim', sub: 'Claim submitted after patient death' },
      { icon: '◆', label: 'High-volume patient', sub: '>10 claims → high utilization flag' },
    ],
    why: 'Fabricated claims reuse the same patient identities across a ring. Legitimate patients almost never share providers with coordinated fraud networks.',
  },
  {
    id: 'temporal', icon: '⏱️', name: 'Temporal Anomaly Agent', color: '#b080e0',
    step: 'Step 4', badge: 'TIMELINE AUDIT',
    walk: 'Claim → Date dimension',
    how: 'Examines timestamps on every claim. Looks for patients admitted to two hospitals simultaneously, claims submitted after recorded death, and burst patterns of 5+ claims within 7 days.',
    signals: [
      { icon: '⚑', label: 'Overlapping stays', sub: 'Patient in two hospitals simultaneously' },
      { icon: '⚑', label: 'Post-death billing', sub: 'Claim date after beneficiary death' },
      { icon: '⚑', label: '7-day burst', sub: '5+ claims in 7 days → fabrication signal' },
    ],
    why: 'Physical impossibilities in claim timelines are ironclad proof of fabrication. A real patient cannot be in two hospitals at once.',
  },
  {
    id: 'synthesis', icon: '⚖️', name: 'Synthesis Agent', color: 'var(--amber)',
    step: 'Step 5', badge: 'FINAL VERDICT',
    walk: 'All 4 agent reports → Case file',
    how: 'Collects findings from all 4 agents and requires corroboration from multiple signals before escalating. A provider flagged HIGH by billing alone may be MEDIUM — billing + collusion + patient = HIGH.',
    signals: [
      { icon: '⚑', label: 'Corroborated HIGH', sub: '≥2 agent signals converge → HIGH verdict' },
      { icon: '◆', label: 'Single-agent flag', sub: '1 signal → MEDIUM, review recommended' },
      { icon: '✓', label: 'Clean provider', sub: 'No signals → LOW, no investigation needed' },
    ],
    why: 'Requiring convergence across multiple independent agents eliminates false positives. Each agent sees different graph edges — agreement means the evidence is real.',
  },
]

export default function AboutView() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ padding: '40px 32px 80px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', marginBottom: 52, maxWidth: 720, margin: '0 auto 52px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 12, opacity: 0.8 }}>
          HOW IT WORKS
        </div>
        <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 16 }}>
          5 Agents. One Investigation.
        </div>
        <div style={{ fontFamily: SF, fontSize: 15, color: 'var(--muted)', lineHeight: 1.85 }}>
          Sentinel deploys <span style={{ color: 'var(--amber)', fontWeight: 600 }}>5 specialist agents</span> that walk different paths through a Medicare knowledge graph.
          Each agent looks for a different fraud signal. The synthesis agent combines their findings into a single verdict —
          requiring multiple agents to agree before flagging HIGH risk.
        </div>
      </div>

      {/* ── Live Demo — full width ── */}
      <div style={{ marginBottom: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.25em', color: 'var(--amber)', textTransform: 'uppercase' }}>
            Live Investigation · Watch the Agents in Action
          </div>
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.9 }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />
        </div>

        <div style={{
          background: 'var(--bg)', borderRadius: 20, padding: '32px 36px',
          boxShadow: '12px 12px 32px var(--shadow-d), -8px -8px 24px var(--shadow-l), 0 0 80px rgba(232,168,56,0.05)',
          border: '1px solid rgba(232,168,56,0.08)',
        }}>
          <InvestigationDemo />
        </div>
      </div>

      {/* ── Agent Cards — always visible, 2-column grid ── */}
      <div style={{ marginBottom: 56 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 28, textAlign: 'center' }}>
          Agent Deep-Dive · All 5 Agents
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {AGENTS.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.45 }}
              style={{
                background: 'var(--bg)',
                borderRadius: 16,
                borderLeft: `4px solid ${a.color}`,
                padding: '22px 24px',
                boxShadow: '6px 6px 16px var(--shadow-d), -4px -4px 12px var(--shadow-l)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: 'var(--bg)', border: `1px solid ${a.color}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, boxShadow: 'inset 2px 2px 6px var(--shadow-d), inset -1px -1px 4px var(--shadow-l)',
                }}>
                  {a.icon}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.16em', color: a.color, textTransform: 'uppercase', opacity: 0.85 }}>{a.step}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em', color: a.color + '88', textTransform: 'uppercase', background: a.color + '14', padding: '1px 8px', borderRadius: 10 }}>{a.badge}</span>
                  </div>
                  <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 15.5, color: 'var(--text)', lineHeight: 1.2 }}>{a.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 8.5, color: 'var(--dim)', marginTop: 3, letterSpacing: '0.07em' }}>walks: {a.walk}</div>
                </div>
              </div>

              {/* How it works */}
              <div style={{ fontFamily: SF, fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>{a.how}</div>

              {/* Signals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {a.signals.map((s, si) => (
                  <div key={si} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    background: 'var(--bg)', borderRadius: 9, padding: '10px 14px',
                    borderLeft: `2px solid ${a.color}${s.icon === '⚑' ? 'cc' : '44'}`,
                    boxShadow: '2px 2px 6px var(--shadow-d), -1px -1px 4px var(--shadow-l)',
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: s.icon === '⚑' ? a.color : 'var(--dim)', flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontFamily: SF, fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>{s.label}</div>
                      <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--dim)' }}>{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Why it matters */}
              <div style={{
                fontFamily: SF, fontSize: 12, color: 'var(--dim)', lineHeight: 1.7,
                fontStyle: 'italic', paddingTop: 4,
                borderTop: '1px solid rgba(255,255,255,0.04)',
              }}>
                {a.why}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Quote ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="nm-inset"
        style={{ padding: '36px 40px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontFamily: PF, fontSize: 20, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.8, marginBottom: 14 }}>
          "Existing tools give a score.{' '}
          <span style={{ color: 'var(--amber)', fontStyle: 'normal', fontWeight: 700 }}>We give an investigation.</span>"
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Built in Jac · JacHacks 2026 · Fintech Track · Multi-Agent Knowledge Graph System
        </div>
      </motion.div>

    </motion.div>
  )
}
