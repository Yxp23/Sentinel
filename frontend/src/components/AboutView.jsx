import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import InvestigationDemo from './InvestigationDemo'

const PF = '"Playfair Display", Georgia, serif'
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
const MONO = 'JetBrains Mono, monospace'

const AGENTS = [
  {
    id: 'billing', icon: '📊', name: 'Billing Volume Agent', color: 'var(--amber)',
    step: 'Step 1', badge: 'VOLUME ANALYSIS',
    walk: 'Provider → Claim edges',
    howTitle: 'What it measures',
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
    howTitle: 'What it detects',
    how: 'Maps every physician who appears across multiple providers. A physician linked to two or more fraud-labeled providers is a ring conduit — routing claims through a shared network to obscure the fraud.',
    signals: [
      { icon: '⚑', label: 'Shared physician', sub: 'Links ≥2 fraud providers → ring found' },
      { icon: '⚑', label: 'Ring dollar flow', sub: 'Total $ flowing through shared physicians' },
      { icon: '◆', label: 'Ring size', sub: 'Number of coordinated providers' },
    ],
    why: 'Organized Medicare fraud rings use shared physicians as referral hubs. Detecting a single physician connecting multiple fraud providers exposes the entire network.',
  },
  {
    id: 'patient', icon: '🏥', name: 'Patient Pattern Agent', color: 'var(--teal)',
    step: 'Step 3', badge: 'PATIENT FLAGS',
    walk: 'Patient → Claim → Provider edges',
    howTitle: 'What it flags',
    how: 'Checks whether the same patient is billed by multiple fraud-labeled providers, whether deceased patients have post-death claims, and whether any single patient has an abnormally high claim volume.',
    signals: [
      { icon: '⚑', label: 'Multi-provider overlap', sub: 'Patient billed by ≥2 fraud providers' },
      { icon: '⚑', label: 'Post-death claim', sub: 'Claim submitted after patient death' },
      { icon: '◆', label: 'High-volume patient', sub: '>5 claims → high utilization flag' },
    ],
    why: 'Fabricated claims reuse the same patient identities across a ring. Legitimate patients almost never share providers with coordinated fraud networks.',
  },
  {
    id: 'temporal', icon: '⏱️', name: 'Temporal Anomaly Agent', color: '#b080e0',
    step: 'Step 4', badge: 'TIMELINE AUDIT',
    walk: 'Claim → Date dimension',
    howTitle: 'What it catches',
    how: 'Examines the timestamps on every claim. Looks for patients admitted to two hospitals simultaneously, claims submitted after recorded death, and burst patterns of 5+ claims within 7 days (batch fabrication).',
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
    howTitle: 'How it decides',
    how: 'Collects findings from all 4 agents and requires corroboration from multiple signals before escalating. A provider flagged HIGH by billing alone may be MEDIUM; billing + collusion + patient overlap = HIGH.',
    signals: [
      { icon: '⚑', label: 'Corroborated HIGH', sub: '≥2 agent signals converge → HIGH verdict' },
      { icon: '◆', label: 'Single-agent flag', sub: '1 signal → MEDIUM, review recommended' },
      { icon: '✓', label: 'Clean provider', sub: 'No signals → LOW, no investigation needed' },
    ],
    why: 'Requiring convergence across multiple independent agents eliminates false positives. Each agent sees different graph edges — agreement means the evidence is real.',
  },
]

export default function AboutView() {
  const [activeAgent, setActiveAgent] = useState(null)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ padding: '40px 40px 80px', maxWidth: 1100 }}>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', marginBottom: 52, maxWidth: 720, margin: '0 auto 52px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 12, opacity: 0.8 }}>
          HOW IT WORKS
        </div>
        <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 16 }}>
          5 Agents. One Investigation.
        </div>
        <div style={{ fontFamily: SF, fontSize: 15, color: 'var(--muted)', lineHeight: 1.85 }}>
          Sentinel deploys <span style={{ color: 'var(--amber)', fontWeight: 600 }}>5 specialist agents</span> that walk different paths through a Medicare knowledge graph. Each agent looks for a different fraud signal. The synthesis agent combines their findings into a single verdict — requiring multiple agents to agree before flagging HIGH risk.
        </div>
      </div>

      {/* ── Live Demo — full width, prominent ── */}
      <div style={{ marginBottom: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, justifyContent: 'center' }}>
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.25em', color: 'var(--amber)', textTransform: 'uppercase' }}>
            Live Investigation · Watch the Agents in Action
          </div>
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.9 }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />
        </div>

        <div style={{ background: 'var(--bg)', borderRadius: 20, padding: '28px 32px', boxShadow: '10px 10px 28px var(--shadow-d), -6px -6px 20px var(--shadow-l), 0 0 60px rgba(232,168,56,0.06)', border: '1px solid rgba(232,168,56,0.1)' }}>
          <InvestigationDemo />
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontFamily: SF, fontSize: 12, color: 'var(--dim)' }}>
          Use the phase buttons below the demo to jump between agents · or let it run automatically
        </div>
      </div>

      {/* ── Agent deep-dives ── */}
      <div style={{ marginBottom: 56 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 24, textAlign: 'center' }}>
          Agent Deep-Dive · Click any agent to expand
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {AGENTS.map((a, i) => {
            const isOpen = activeAgent === a.id
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
              >
                {/* Header row — always visible */}
                <button
                  onClick={() => setActiveAgent(isOpen ? null : a.id)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'var(--bg)',
                    border: `1px solid ${isOpen ? a.color + '55' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: isOpen ? '14px 14px 0 0' : 14,
                    padding: '20px 28px', cursor: 'pointer',
                    boxShadow: isOpen
                      ? `6px 6px 18px var(--shadow-d), -4px -4px 12px var(--shadow-l), 0 0 30px ${a.color}15`
                      : '5px 5px 14px var(--shadow-d), -3px -3px 10px var(--shadow-l)',
                    transition: 'border-color 0.3s, box-shadow 0.3s, border-radius 0.2s',
                    display: 'flex', alignItems: 'center', gap: 20,
                  }}
                >
                  {/* Icon */}
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: isOpen ? `${a.color}18` : 'var(--bg)', border: `1px solid ${a.color}${isOpen ? '55' : '28'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, transition: 'all 0.3s' }}>
                    {a.icon}
                  </div>

                  {/* Label */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: a.color, textTransform: 'uppercase', opacity: 0.8 }}>{a.step}</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: a.color + '88', textTransform: 'uppercase', background: a.color + '18', padding: '1px 8px', borderRadius: 10 }}>{a.badge}</span>
                    </div>
                    <div style={{ fontFamily: PF, fontWeight: 600, fontSize: 16, color: isOpen ? a.color : 'var(--text)', transition: 'color 0.2s' }}>{a.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'var(--dim)', marginTop: 3, letterSpacing: '0.08em' }}>walks: {a.walk}</div>
                  </div>

                  {/* Chevron */}
                  <div style={{ color: a.color + '88', fontSize: 14, transition: 'transform 0.3s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>▾</div>
                </button>

                {/* Expandable body */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      key="body"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{
                        background: `${a.color}08`, border: `1px solid ${a.color}22`, borderTop: 'none',
                        borderRadius: '0 0 14px 14px', padding: '24px 28px',
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                          {/* Left — how it works */}
                          <div>
                            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: a.color, textTransform: 'uppercase', marginBottom: 10 }}>{a.howTitle}</div>
                            <div style={{ fontFamily: SF, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 18 }}>{a.how}</div>
                            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.15em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 8 }}>Why it matters</div>
                            <div style={{ fontFamily: SF, fontSize: 13, color: 'var(--dim)', lineHeight: 1.7, fontStyle: 'italic' }}>{a.why}</div>
                          </div>

                          {/* Right — signals */}
                          <div>
                            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: a.color, textTransform: 'uppercase', marginBottom: 10 }}>Detection signals</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {a.signals.map((s, si) => (
                                <motion.div
                                  key={si}
                                  initial={{ opacity: 0, x: 8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: si * 0.1 + 0.1 }}
                                  style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', borderLeft: `3px solid ${a.color}${s.icon === '⚑' ? 'cc' : '44'}`, boxShadow: '3px 3px 8px var(--shadow-d), -2px -2px 6px var(--shadow-l)' }}
                                >
                                  <span style={{ fontFamily: MONO, fontSize: 13, color: s.icon === '⚑' ? a.color : 'var(--dim)', flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                                  <div>
                                    <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{s.label}</div>
                                    <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--dim)' }}>{s.sub}</div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* ── Quote ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="nm-inset"
        style={{ padding: '36px 40px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}
      >
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
