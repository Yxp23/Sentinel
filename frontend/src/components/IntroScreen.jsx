import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Mirrors the Apple "Hello" intro — black screen, clean typography, no overlap
export default function IntroScreen({ onDone }) {
  const [phase, setPhase] = useState('hello')  // hello | sentinel | done

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('sentinel'), 2600)  // hello holds for 2.6s
    const t2 = setTimeout(() => setPhase('done'),    5200)   // sentinel holds for 2.6s
    const t3 = setTimeout(onDone,                    6000)   // fade out complete
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <motion.div
      style={{
        position: 'fixed', inset: 0,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Skip button */}
      <button
        onClick={onDone}
        style={{
          position: 'absolute', bottom: 32, right: 32,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          color: 'rgba(255,255,255,0.35)',
          cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
          fontSize: 11,
          letterSpacing: '0.1em',
          padding: '7px 16px',
          textTransform: 'uppercase',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.target.style.color = 'rgba(255,255,255,0.6)'; e.target.style.borderColor = 'rgba(255,255,255,0.25)' }}
        onMouseLeave={e => { e.target.style.color = 'rgba(255,255,255,0.35)'; e.target.style.borderColor = 'rgba(255,255,255,0.12)' }}
      >
        skip
      </button>

      {/* "hello" phase */}
      <AnimatePresence>
        {phase === 'hello' && (
          <motion.div
            key="hello"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
              fontWeight: 200,
              fontSize: 'clamp(3.5rem, 10vw, 7rem)',
              color: '#fff',
              letterSpacing: '-0.04em',
              userSelect: 'none',
            }}
          >
            hello
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Welcome to Sentinel" phase */}
      <AnimatePresence>
        {phase === 'sentinel' && (
          <motion.div
            key="sentinel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6,
              userSelect: 'none',
              textAlign: 'center',
              padding: '0 20px',
            }}
          >
            <div style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
              fontWeight: 300,
              fontSize: 'clamp(1.2rem, 3vw, 2rem)',
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              Welcome to
            </div>
            <div style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(3rem, 9vw, 6.5rem)',
              color: '#e8a838',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>
              Sentinel
            </div>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
                fontWeight: 300,
                fontSize: 'clamp(0.75rem, 1.6vw, 1rem)',
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop: 8,
              }}
            >
              Multi-Agent Healthcare Fraud Investigation System
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
