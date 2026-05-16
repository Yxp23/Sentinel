import { motion } from 'framer-motion'
import GraphBackground from './GraphBackground'

export default function LandingScreen({ data, onBegin }) {
  return (
    <motion.div
      className="grid-bg"
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* D3 network graph background */}
      <GraphBackground data={data} graphMode="idle" opacity={0.18} />

      {/* Center content */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        {/* Logo / wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 500, letterSpacing: '0.4em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>
            SENTINEL
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Multi-Agent Fraud<br />
            <span style={{ color: 'var(--amber)' }}>Investigation System</span>
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300, fontSize: 14, color: 'var(--muted)', letterSpacing: '0.08em', marginTop: 16 }}>
            Medicare Claims · Knowledge Graph · 5 AI Agents
          </div>
        </motion.div>

        {/* BEGIN INVESTIGATION button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.6, type: 'spring', damping: 20 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onBegin}
          style={{
            background: 'var(--bg)',
            border: 'none',
            borderRadius: 14,
            cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '0.18em',
            color: 'var(--amber)',
            padding: '22px 56px',
            animation: 'pulseAmber 2.5s ease-in-out infinite',
            textTransform: 'uppercase',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span style={{ position: 'relative', zIndex: 1 }}>Begin Investigation</span>
        </motion.button>

        {/* Data stats teaser */}
        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            style={{ display: 'flex', gap: 32, alignItems: 'center' }}
          >
            {[
              { label: 'Providers', val: data.meta?.provider_count || 30 },
              { label: 'Claims Graph', val: '66K+' },
              { label: 'AI Agents', val: 5 },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Corner watermark */}
      <div style={{ position: 'absolute', bottom: 24, left: 32, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--dim)', letterSpacing: '0.08em' }}>
        SENTINEL v1.0 · JacHacks 2026 · Fintech Track
      </div>
    </motion.div>
  )
}
