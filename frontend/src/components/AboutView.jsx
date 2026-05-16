import { motion } from 'framer-motion'

const AGENTS = [
  {
    icon: '📊', name: 'Billing Volume Agent', color: 'var(--amber)',
    desc: 'Walks the Provider→Claim subgraph. Computes per-provider claims and amount ratios against peer averages. Flags providers with ratios > 1.5× as potential overbilling or phantom claim fabrication.',
  },
  {
    icon: '🕸️', name: 'Collusion Network Agent', color: 'var(--red)',
    desc: 'Walks Provider→Claim→Physician edges. Detects physicians appearing across multiple providers simultaneously — a classic organized fraud ring signature. Assesses total money flowing through each shared physician.',
  },
  {
    icon: '🏥', name: 'Patient Pattern Agent', color: 'var(--teal)',
    desc: 'Walks Patient→Claim edges. Flags patients billed by 3+ providers, deceased patients with post-death claims, high-volume patients, and multi-provider fraud overlaps — catching patient-level abuse patterns.',
  },
  {
    icon: '⏱️', name: 'Temporal Anomaly Agent', color: '#b080e0',
    desc: 'Examines WHEN claims happened, not how much they cost. Detects: impossible simultaneous hospital stays, 5+ claim bursts within 7 days (batch fabrication), same-day patient shuttling, and post-death billing.',
  },
  {
    icon: '⚖️', name: 'Synthesis Agent', color: 'var(--amber)',
    desc: 'Receives findings from all 4 specialist agents and synthesizes them into a unified case file per provider — combining evidence, resolving conflicts, and producing an overall risk verdict with actionable recommendations.',
  },
]

export default function AboutView() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} style={{ padding: '40px 40px 60px', maxWidth: 1100 }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 52, maxWidth: 720, margin: '0 auto 52px' }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 16 }}>
          How Sentinel Works
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: 'var(--muted)', lineHeight: 1.8 }}>
          Sentinel deploys <span style={{ color: 'var(--amber)', fontWeight: 600 }}>5 specialized AI agents</span> across a Medicare claims knowledge graph.
          Each agent walks the graph, reasons about evidence using <span style={{ color: 'var(--text)', fontWeight: 500 }}>large language models</span>, and reports findings.
          Unlike traditional fraud detection that outputs a score,
          Sentinel produces <span style={{ color: 'var(--amber)', fontWeight: 600 }}>auditable investigations with full reasoning chains</span>.
        </div>
      </div>

      {/* Agents grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 48 }}>
        {AGENTS.map((a, i) => (
          <motion.div
            key={a.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="nm-raised"
            style={{ padding: '28px 28px', borderLeft: `3px solid ${a.color}` }}
          >
            <div style={{ fontSize: 28, marginBottom: 14 }}>{a.icon}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: a.color, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{a.name}</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{a.desc}</div>
          </motion.div>
        ))}
      </div>

      {/* Architecture note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="nm-inset"
        style={{ padding: '36px 40px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}
      >
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.8, marginBottom: 14 }}>
          "Existing tools give a score.{' '}
          <span style={{ color: 'var(--amber)', fontStyle: 'normal', fontWeight: 700 }}>We give an investigation.</span>"
        </div>
        <div style={{ fontSize: 12, color: 'var(--dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Built in Jac · JacHacks 2026 · Fintech Track · Multi-Agent Knowledge Graph System
        </div>
      </motion.div>
    </motion.div>
  )
}
