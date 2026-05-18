import { useState, useEffect, useRef } from 'react'

const MONO = 'JetBrains Mono, monospace'

// Simulated Jac pipeline execution log — based on real synthesis_run.log output
const JAC_LOG = [
  { text: '$ jac run src/agents/synthesis_agent.jac', color: 'var(--amber)', delay: 0 },
  { text: '', delay: 100 },
  { text: '[jac] Loading graph schema from src/graph/schema.jac', color: '#8888aa', delay: 200 },
  { text: '[jac] Nodes registered: Provider, Patient, Claim, Physician', color: '#8888aa', delay: 300 },
  { text: '[jac] Walker "billing_walker" compiled ✓', color: 'var(--teal)', delay: 400 },
  { text: '[jac] Walker "collusion_walker" compiled ✓', color: 'var(--teal)', delay: 500 },
  { text: '[jac] Walker "patient_walker" compiled ✓', color: 'var(--teal)', delay: 600 },
  { text: '[jac] Walker "temporal_walker" compiled ✓', color: 'var(--teal)', delay: 700 },
  { text: '', delay: 800 },
  { text: '[loader] Reading provider labels...', color: '#8888aa', delay: 900 },
  { text: '[loader]   200 providers selected (100 fraud, 100 non-fraud)', color: '#c0c0d8', delay: 1100 },
  { text: '[loader] Filtering claims to selected providers...', color: '#8888aa', delay: 1300 },
  { text: '[loader]   66,773 claims (11,854 inpatient, 54,919 outpatient)', color: '#c0c0d8', delay: 1500 },
  { text: '[loader]   27,891 unique patients, 9,142 unique physicians', color: '#c0c0d8', delay: 1700 },
  { text: '', delay: 1800 },
  { text: '[loader] ── Dataset summary ──────────────────────────', color: 'var(--amber)', delay: 1900 },
  { text: '  Providers :    200', color: '#c0c0d8', delay: 2000 },
  { text: '  Patients  : 27,891', color: '#c0c0d8', delay: 2050 },
  { text: '  Claims    : 66,773', color: '#c0c0d8', delay: 2100 },
  { text: '  Physicians:  9,142', color: '#c0c0d8', delay: 2150 },
  { text: '', delay: 2200 },
  { text: '[billing_walker] Walking Provider → Claim edges...', color: 'var(--amber)', delay: 2400 },
  { text: '[billing_walker] Computing peer averages: avg_claims=332.4, avg_amount=$201,582', color: '#8888aa', delay: 2800 },
  { text: '[billing_walker] PRV52019: ratio=5.90× peers → HIGH RISK', color: 'var(--red)', delay: 3200 },
  { text: '[billing_walker] PRV51595: ratio=4.21× peers → HIGH RISK', color: 'var(--red)', delay: 3400 },
  { text: '[billing_walker] 45 HIGH + 82 MEDIUM risk providers identified', color: 'var(--amber)', delay: 3800 },
  { text: '', delay: 3900 },
  { text: '[collusion_walker] Mapping physician-provider bipartite graph...', color: 'var(--red)', delay: 4100 },
  { text: '[collusion_walker] 9,142 physicians → cross-provider edge analysis', color: '#8888aa', delay: 4500 },
  { text: '[collusion_walker] RING: PHY393952 links PRV52019 ↔ PRV51423 ($2.3M)', color: 'var(--red)', delay: 4900 },
  { text: '[collusion_walker] 7 collusion rings detected', color: 'var(--amber)', delay: 5300 },
  { text: '', delay: 5400 },
  { text: '[patient_walker] Scanning 27,891 beneficiary records...', color: 'var(--teal)', delay: 5600 },
  { text: '[patient_walker] Multi-provider patterns: 1,247 patients across ≥3 providers', color: '#8888aa', delay: 6000 },
  { text: '[patient_walker] Post-death claims: 12 claims filed after recorded death date', color: 'var(--red)', delay: 6400 },
  { text: '', delay: 6500 },
  { text: '[temporal_walker] Building claim timeline index...', color: '#b080e0', delay: 6700 },
  { text: '[temporal_walker] Scanning for overlapping stays + claim bursts...', color: '#8888aa', delay: 7100 },
  { text: '[temporal_walker] 8 temporal anomalies detected', color: '#b080e0', delay: 7500 },
  { text: '', delay: 7600 },
  { text: '[synthesis] ── Cross-agent convergence analysis ──', color: 'var(--amber)', delay: 7800 },
  { text: '[synthesis] Requiring 2+ agent agreement for HIGH risk escalation', color: '#8888aa', delay: 8200 },
  { text: '[synthesis] PRV52019: billing(HIGH) + collusion(MED) + patient(MED) → HIGH', color: 'var(--amber)', delay: 8600 },
  { text: '[synthesis] 127 case files generated', color: 'var(--teal)', delay: 9000 },
  { text: '[synthesis] 45 HIGH risk · 82 MEDIUM risk', color: 'var(--amber)', delay: 9200 },
  { text: '[synthesis] Estimated fraud exposure: $55,860,800', color: 'var(--amber)', delay: 9400 },
  { text: '', delay: 9500 },
  { text: '[byLLM] Generating forensic reasoning narratives via gpt-4o-mini...', color: '#8888aa', delay: 9700 },
  { text: '[byLLM] 127 narratives generated ✓', color: 'var(--teal)', delay: 10100 },
  { text: '', delay: 10200 },
  { text: '✓ Pipeline complete — results exported to output/results.json', color: 'var(--teal)', delay: 10500 },
]

export default function JacTerminal() {
  const [visibleLines, setVisibleLines] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const containerRef = useRef(null)

  const start = () => {
    setVisibleLines(0)
    setIsRunning(true)
  }

  useEffect(() => {
    if (!isRunning) return
    const timers = JAC_LOG.map((line, i) =>
      setTimeout(() => {
        setVisibleLines(i + 1)
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
        if (i === JAC_LOG.length - 1) setIsRunning(false)
      }, line.delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [isRunning])

  return (
    <div className="nm-inset" style={{ borderRadius: 14, overflow: 'hidden' }}>
      {/* Terminal header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(5,5,14,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e85d5d' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e8a838' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#38b2ac' }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#606078', letterSpacing: '0.06em', marginLeft: 8 }}>
            jac-pipeline — synthesis_agent.jac
          </span>
        </div>
        <button
          onClick={start}
          disabled={isRunning}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
            color: isRunning ? 'var(--dim)' : 'var(--amber)',
            background: 'rgba(232,168,56,0.08)',
            border: `1px solid ${isRunning ? 'rgba(255,255,255,0.06)' : 'rgba(232,168,56,0.25)'}`,
            borderRadius: 6, padding: '5px 14px', cursor: isRunning ? 'default' : 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {isRunning ? '● Running...' : '▶ Run Pipeline'}
        </button>
      </div>

      {/* Terminal body */}
      <div
        ref={containerRef}
        style={{
          background: 'rgba(5,5,14,0.85)',
          padding: '14px 18px',
          height: 320,
          overflowY: 'auto',
          fontFamily: MONO,
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        {visibleLines === 0 && !isRunning && (
          <div style={{ color: '#404058', fontStyle: 'italic' }}>
            Click "Run Pipeline" to simulate Jac execution →
          </div>
        )}
        {JAC_LOG.slice(0, visibleLines).map((line, i) => (
          <div key={i} style={{ color: line.color || '#8888aa', minHeight: line.text ? undefined : 8 }}>
            {line.text}
          </div>
        ))}
        {isRunning && (
          <span style={{ color: 'var(--amber)', animation: 'pulseAmber 1s infinite' }}>█</span>
        )}
      </div>
    </div>
  )
}
