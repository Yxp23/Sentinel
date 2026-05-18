import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GraphBackground from './GraphBackground'

function useCountUp(target, duration = 1800) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    const start = Date.now()
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return val
}

export default function LandingScreen({ data, onBegin }) {
  const animProviders = useCountUp(data?.meta?.provider_count || 200)
  const animCases = useCountUp(data?.meta?.case_count || 0)
  const animAgents = useCountUp(5)

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
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 500, letterSpacing: '0.5em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 14, opacity: 0.7 }}>
            SENTINEL
          </div>
          <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 700, fontSize: 'clamp(2rem, 5vw, 3.6rem)', color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
            Multi-Agent Fraud<br />
            <span style={{ color: 'var(--amber)' }}>Investigation System</span>
          </div>
          <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', fontWeight: 300, fontSize: 14, color: 'var(--muted)', letterSpacing: '0.06em', marginTop: 18 }}>
            Medicare Claims · Knowledge Graph · 5 AI Agents
          </div>
          <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', fontWeight: 300, fontSize: 12, color: 'var(--dim)', letterSpacing: '0.04em', marginTop: 8, fontStyle: 'italic' }}>
            5 AI agents. One knowledge graph. Zero wasted investigations.
          </div>
        </motion.div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.6, type: 'spring', damping: 20 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onBegin}
            disabled={!data}
            style={{
              background: 'var(--bg)',
              border: 'none',
              borderRadius: 14,
              cursor: data ? 'pointer' : 'default',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: data ? 'var(--amber)' : 'var(--dim)',
              padding: '22px 56px',
              animation: data ? 'pulseAmber 2.5s ease-in-out infinite' : 'none',
              textTransform: 'uppercase',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: data ? 'none' : 'inset 2px 2px 5px var(--shadow-d), inset -2px -2px 5px var(--shadow-l)',
            }}
          >
            <span style={{ position: 'relative', zIndex: 1 }}>{data ? 'Begin Investigation' : 'Booting System...'}</span>
          </motion.button>
          
        </div>

        {/* Data stats teaser */}
        <div style={{ height: 60 }}>
          <AnimatePresence mode="wait">
            {!data ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 10 }}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dim)' }}
                    />
                  ))}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.15em', color: 'var(--dim)', textTransform: 'uppercase' }}>
                  Awaiting Knowledge Graph Data
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{ display: 'flex', gap: 32, alignItems: 'center' }}
              >
                {[
                  { label: 'Providers', val: animProviders },
                  { label: 'Case Files', val: animCases },
                  { label: 'AI Agents', val: animAgents },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Corner watermark */}
      <div style={{ position: 'absolute', bottom: 24, left: 32, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--dim)', letterSpacing: '0.08em' }}>
        SENTINEL v1.0 · JacHacks 2026 · Fintech Track
      </div>
    </motion.div>
  )
}
