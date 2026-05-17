import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MONO = 'JetBrains Mono, monospace'
const SF   = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
const PF   = '"Playfair Display", Georgia, serif'

// ─── Graph geometry (viewBox 0 0 520 350) ────────────────────────────────
const CX = 256, CY = 180  // provider center

const N = {
  prv:  { x: CX,  y: CY,  type: 'provider',  label: 'PRV52019'  },
  clm1: { x: 420, y: 105, type: 'claim',     label: 'CLM-001'   },
  clm2: { x: 444, y: 180, type: 'claim',     label: 'CLM-002'   },
  clm3: { x: 420, y: 258, type: 'claim',     label: 'CLM-003'   },
  phy1: { x: 142, y: 62,  type: 'physician', label: 'PHY395933' },
  phy2: { x: 370, y: 62,  type: 'physician', label: 'PHY393952' },
  col1: { x:  58, y: 16,  type: 'collude',   label: 'PRV52119'  },
  col2: { x: 462, y: 16,  type: 'collude',   label: 'PRV52065'  },
  pat1: { x:  80, y: 105, type: 'patient',   label: 'BENE14097' },
  pat2: { x:  58, y: 180, type: 'patient',   label: 'BENE15144' },
  pat3: { x:  80, y: 258, type: 'patient',   label: 'BENE11670' },
}

// Quadratic bezier path bowing outward from provider center
const qp = (sid, tid, str = 28) => {
  const s = N[sid], t = N[tid]
  const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2
  const dx = mx - CX,          dy = my - CY
  const len = Math.sqrt(dx*dx + dy*dy) || 1
  return { d: `M${s.x},${s.y} Q${mx+dx/len*str},${my+dy/len*str} ${t.x},${t.y}`, cpx: mx+dx/len*str, cpy: my+dy/len*str }
}

const EDGE_DEFS = [
  { id:'e1', s:'prv',  t:'clm1', agent:'billing'   },
  { id:'e2', s:'prv',  t:'clm2', agent:'billing'   },
  { id:'e3', s:'prv',  t:'clm3', agent:'billing'   },
  { id:'e4', s:'prv',  t:'phy1', agent:'collusion', str: 18 },
  { id:'e5', s:'prv',  t:'phy2', agent:'collusion', str: 18 },
  { id:'e6', s:'prv',  t:'pat1', agent:'patient'   },
  { id:'e7', s:'prv',  t:'pat2', agent:'patient'   },
  { id:'e8', s:'prv',  t:'pat3', agent:'patient'   },
  { id:'e9', s:'col1', t:'phy1', agent:'collusion', str: 10 },
  { id:'e10',s:'col2', t:'phy2', agent:'collusion', str: 10 },
]

const AGENT_COLOR = { billing:'#e8a838', collusion:'#e85d5d', patient:'#38b2ac', temporal:'#b080e0' }

const PHASE_ORDER = ['formation','billing','collusion','patient','temporal','synthesis','hold']

// ─── Phase data ────────────────────────────────────────────────────────────
const PHASES = [
  {
    id: 'formation', dur: 3000, color: '#7878b8', agentN: null,
    title: 'Knowledge Graph Formation',
    icon: '🗺️', agentLabel: 'System',
    what: 'Before any analysis, Sentinel maps all Medicare claims into a knowledge graph. Every provider, claim, physician, and patient becomes a node. Edges represent real-world relationships — who treated whom, which doctor referred where.',
    findings: [
      { icon: '◆', text: 'Provider PRV52019 loaded into graph' },
      { icon: '◆', text: '1,961 claims ingested and indexed' },
      { icon: '◆', text: '2 attending physicians linked to claims' },
      { icon: '◆', text: '3 patient beneficiaries identified' },
    ],
    verdict: null,
    visibleNodes: ['prv','clm1','clm2','clm3','phy1','phy2','pat1','pat2','pat3'],
    litAgents: [],
  },
  {
    id: 'billing', dur: 4500, color: '#e8a838', agentN: 1,
    title: 'Billing Volume Agent',
    icon: '📊', agentLabel: 'Agent 1 of 5',
    what: 'Walks the Provider → Claim edges. Computes total claims and dollar volume for this provider, then compares against the peer group average. Ratios above 3× are automatically flagged HIGH RISK.',
    findings: [
      { icon: '⚑', text: 'Claim count ratio: 5.90× above peer average', color: '#e8a838' },
      { icon: '⚑', text: 'Dollar amount ratio: 14.90× above peer average', color: '#e8a838' },
      { icon: '·', text: '1,961 total claims · $5.99M billed' },
      { icon: '·', text: 'Avg $3,057 per claim vs peer avg $402' },
    ],
    verdict: { label: 'HIGH RISK', color: '#e8a838', bg: '#e8a83820', note: 'Both ratios far exceed 3× threshold' },
    visibleNodes: ['prv','clm1','clm2','clm3'],
    litAgents: ['billing'],
  },
  {
    id: 'collusion', dur: 4500, color: '#e85d5d', agentN: 2,
    title: 'Collusion Network Agent',
    icon: '🕸️', agentLabel: 'Agent 2 of 5',
    what: 'Walks Provider → Claim → Physician edges. A physician who appears across multiple distinct fraud-labeled providers is a red flag — they act as a conduit, routing payments through a coordinated ring.',
    findings: [
      { icon: '⚑', text: 'PHY395933 links PRV52019 ↔ PRV52119', color: '#e85d5d' },
      { icon: '⚑', text: '$26,000 flowing through this fraud ring', color: '#e85d5d' },
      { icon: '·', text: 'PHY393952 links PRV52019 ↔ PRV52065' },
      { icon: '·', text: '$48,000 flowing through second ring' },
    ],
    verdict: { label: 'MEDIUM RISK', color: '#e85d5d', bg: '#e85d5d18', note: '2 collusion rings found, $74K total' },
    visibleNodes: ['prv','clm1','clm2','clm3','phy1','phy2','col1','col2'],
    litAgents: ['billing','collusion'],
  },
  {
    id: 'patient', dur: 4500, color: '#38b2ac', agentN: 3,
    title: 'Patient Pattern Agent',
    icon: '🏥', agentLabel: 'Agent 3 of 5',
    what: 'Checks if the same patients are billed by multiple fraud-labeled providers. Legitimate patients almost never receive care from two coordinated fraud rings — this pattern strongly implies fabricated claims.',
    findings: [
      { icon: '⚑', text: 'BENE15144 billed by 2 fraud providers · $29K', color: '#38b2ac' },
      { icon: '⚑', text: 'BENE11670 billed by 2 fraud providers · $19K', color: '#38b2ac' },
      { icon: '·', text: 'BENE14097 billed by 2 fraud providers · $6K' },
      { icon: '·', text: '6 total patients with fraud_provider_overlap' },
    ],
    verdict: { label: 'HIGH RISK', color: '#38b2ac', bg: '#38b2ac18', note: 'Patients shared across fraud ring' },
    visibleNodes: ['prv','clm1','clm2','clm3','phy1','phy2','col1','col2','pat1','pat2','pat3'],
    litAgents: ['billing','collusion','patient'],
  },
  {
    id: 'temporal', dur: 3200, color: '#b080e0', agentN: 4,
    title: 'Temporal Anomaly Agent',
    icon: '⏱️', agentLabel: 'Agent 4 of 5',
    what: 'Scans claim dates for physically impossible scenarios: a patient admitted to two hospitals simultaneously, or medical claims filed after the patient\'s recorded death.',
    findings: [
      { icon: '✓', text: '1,961 claims spanning Jan – Dec 2009', color: '#5050808a' },
      { icon: '✓', text: 'No overlapping inpatient stays found', color: '#5050808a' },
      { icon: '✓', text: 'No post-death claim submissions', color: '#5050808a' },
      { icon: '✓', text: 'No 7-day fabrication burst patterns', color: '#5050808a' },
    ],
    verdict: { label: 'CLEAN — no anomalies', color: '#7070b0', bg: '#7070b015', note: 'Timeline appears legitimate' },
    visibleNodes: ['prv','clm1','clm2','clm3','phy1','phy2','col1','col2','pat1','pat2','pat3'],
    litAgents: ['billing','collusion','patient'],
  },
  {
    id: 'synthesis', dur: 3500, color: '#e8a838', agentN: 5,
    title: 'Synthesis Agent (GPT-4o-mini)',
    icon: '⚖️', agentLabel: 'Agent 5 of 5',
    what: 'Reads all 4 agent reports and uses an LLM to generate a unified case file with full reasoning. Requires corroboration across multiple agents before escalating — this is what eliminates false positives.',
    findings: [
      { icon: '⚑', text: 'Billing: HIGH — 5.9× claims, 14.9× amount', color: '#e8a838' },
      { icon: '⚑', text: 'Collusion: MEDIUM — 2 rings, $74K flowing', color: '#e85d5d' },
      { icon: '⚑', text: 'Patient: HIGH — 6 fraud_provider_overlap', color: '#38b2ac' },
      { icon: '✓', text: 'Temporal: CLEAN — no timeline anomalies', color: '#5050808a' },
    ],
    verdict: { label: '⚑  HIGH RISK · $5.99M estimated fraud', color: '#e8a838', bg: '#e8a83820', note: '3 of 4 agents corroborated', isFinal: true },
    visibleNodes: ['prv','clm1','clm2','clm3','phy1','phy2','col1','col2','pat1','pat2','pat3'],
    litAgents: ['billing','collusion','patient'],
  },
  {
    id: 'hold', dur: 2000, color: '#e8a838', agentN: 5,
    title: 'Synthesis Agent (GPT-4o-mini)',
    icon: '⚖️', agentLabel: 'Agent 5 of 5',
    what: 'Reads all 4 agent reports and uses an LLM to generate a unified case file with full reasoning. Requires corroboration across multiple agents before escalating — this is what eliminates false positives.',
    findings: [
      { icon: '⚑', text: 'Billing: HIGH — 5.9× claims, 14.9× amount', color: '#e8a838' },
      { icon: '⚑', text: 'Collusion: MEDIUM — 2 rings, $74K flowing', color: '#e85d5d' },
      { icon: '⚑', text: 'Patient: HIGH — 6 fraud_provider_overlap', color: '#38b2ac' },
      { icon: '✓', text: 'Temporal: CLEAN — no timeline anomalies', color: '#5050808a' },
    ],
    verdict: { label: '⚑  HIGH RISK · $5.99M estimated fraud', color: '#e8a838', bg: '#e8a83820', note: '3 of 4 agents corroborated', isFinal: true },
    visibleNodes: ['prv','clm1','clm2','clm3','phy1','phy2','col1','col2','pat1','pat2','pat3'],
    litAgents: ['billing','collusion','patient'],
  },
]

// ─── Node visual style ────────────────────────────────────────────────────
const NODE_AGENT = { clm1:'billing', clm2:'billing', clm3:'billing', phy1:'collusion', phy2:'collusion', col1:'collusion', col2:'collusion', pat1:'patient', pat2:'patient', pat3:'patient' }

function nodeVis(id, cfg) {
  if (!cfg.visibleNodes.includes(id)) return null

  const dim  = { fill:'#13131f', stroke:'#2a2a48', sw:1.5, glow:null }
  const na = NODE_AGENT[id]
  const isSynth = cfg.id === 'synthesis' || cfg.id === 'hold'
  const isLit   = na ? cfg.litAgents.includes(na) : cfg.litAgents.length > 0
  const isCurrent = na ? cfg.id === na : false

  if (id === 'prv') {
    if (isSynth) return { fill:'#e8a83820', stroke:'#e8a838', sw:2.5, glow:'#e8a83860' }
    if (cfg.litAgents.length > 0) return { fill:'#e8a83812', stroke:'#e8a83890', sw:2, glow: isCurrent ? null : null }
    return { fill:'#13131f', stroke:'#e8a83855', sw:2, glow:null }
  }

  if (!na) return dim

  const col = AGENT_COLOR[na]
  if (!isLit) return dim
  if (isSynth) return { fill: col+'15', stroke: col,      sw:2,   glow: col+'50' }
  if (isCurrent) return { fill: col+'18', stroke: col,    sw:2,   glow: col+'55' }
  // covered by a past agent — keep visible but dimmer
  return { fill: col+'0c', stroke: col+'60', sw:1.5, glow:null }
}

// ─── Edge visual style ────────────────────────────────────────────────────
function edgeVis(e, cfg) {
  const phIdx  = PHASE_ORDER.indexOf(cfg.id)
  const ePhIdx = PHASE_ORDER.indexOf(e.agent)
  const isSynth = cfg.id === 'synthesis' || cfg.id === 'hold'
  const col = AGENT_COLOR[e.agent]

  // Collusion reveal edges only appear from collusion phase
  if ((e.id === 'e9' || e.id === 'e10') && phIdx < 2) return null

  if (isSynth) return { stroke: col, w: 1.5, op: 0.7, dash: null }
  if (phIdx === ePhIdx) return { stroke: col, w: 2, op: 0.85, dash: null }
  if (phIdx > ePhIdx)   return { stroke: col+'50', w: 1, op: 1, dash: null }
  // future: ghost only if adjacent phase
  if (phIdx === ePhIdx - 1) return { stroke: '#ffffff0a', w: 1, op: 1, dash: '5,4' }
  return null
}

// ─── Pulse (simple, no keyframe array mismatch) ───────────────────────────
function Pulse({ sx, sy, tx, ty, cpx, cpy, delay, color, pkey }) {
  // Animate opacity separately so no keyframe count mismatch
  return (
    <motion.circle
      key={pkey}
      r={5}
      fill={color}
      style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      initial={{ cx: sx, cy: sy, opacity: 0 }}
      animate={{ cx: tx, cy: ty, opacity: [0, 1, 1, 0] }}
      transition={{
        cx:      { duration: 1.0, delay, ease: 'easeInOut' },
        cy:      { duration: 1.0, delay, ease: 'easeInOut' },
        opacity: { duration: 1.0, delay, times: [0, 0.08, 0.82, 1] },
      }}
    />
  )
}

// ─── Pulses per phase ─────────────────────────────────────────────────────
const PHASE_PULSES = {
  billing:   [
    { s:'prv',  t:'clm1', d:0.1  }, { s:'prv',  t:'clm2', d:0.9  },
    { s:'prv',  t:'clm3', d:1.7  }, { s:'prv',  t:'clm1', d:2.8  },
  ],
  collusion: [
    { s:'prv',  t:'phy1', d:0.2  }, { s:'prv',  t:'phy2', d:1.0  },
    { s:'phy1', t:'col1', d:1.6  }, { s:'phy2', t:'col2', d:2.4  },
  ],
  patient:   [
    { s:'pat2', t:'prv',  d:0.2  }, { s:'pat1', t:'prv',  d:1.1  },
    { s:'pat3', t:'prv',  d:1.9  },
  ],
  synthesis: [
    { s:'clm2', t:'prv',  d:0.1,  c:'#e8a838' },
    { s:'phy1', t:'prv',  d:0.55, c:'#e85d5d' },
    { s:'pat2', t:'prv',  d:1.0,  c:'#38b2ac' },
    { s:'clm1', t:'prv',  d:1.55, c:'#e8a838' },
  ],
  hold: [
    { s:'clm2', t:'prv',  d:0.1,  c:'#e8a838' },
    { s:'phy1', t:'prv',  d:0.55, c:'#e85d5d' },
    { s:'pat2', t:'prv',  d:1.0,  c:'#38b2ac' },
  ],
}

// ─── Hex helper ───────────────────────────────────────────────────────────
const hexPts = (cx, cy, r) =>
  [...Array(6)].map((_, i) => {
    const a = (i*60 - 30) * (Math.PI/180)
    return `${(cx + r*Math.cos(a)).toFixed(1)},${(cy + r*Math.sin(a)).toFixed(1)}`
  }).join(' ')

// ─── Node shapes ──────────────────────────────────────────────────────────
function RenderNode({ id, vis, isSynth }) {
  if (!vis) return null
  const n = N[id]
  const glowStyle = vis.glow ? { filter: `drop-shadow(0 0 8px ${vis.glow})` } : undefined
  const anim = { fill: vis.fill, stroke: vis.stroke, strokeWidth: vis.sw }
  const tr   = { duration: 0.5 }

  if (n.type === 'provider') return (
    <g>
      <motion.rect x={n.x-58} y={n.y-22} width={116} height={44} rx={10}
        animate={anim} transition={tr} style={glowStyle} />
      <text x={n.x} y={n.y-3} textAnchor="middle"
        style={{ fontFamily:MONO, fontSize:11, fontWeight:700, fill:vis.stroke, letterSpacing:'0.04em', pointerEvents:'none' }}>
        {n.label}
      </text>
      <text x={n.x} y={n.y+11} textAnchor="middle"
        style={{ fontFamily:MONO, fontSize:6.5, fill:vis.stroke+'80', letterSpacing:'0.22em', pointerEvents:'none' }}>
        PROVIDER
      </text>
      {isSynth && (
        <motion.text x={n.x} y={n.y-32} textAnchor="middle"
          initial={{ opacity:0, y: n.y-26 }} animate={{ opacity:1, y: n.y-32 }}
          transition={{ delay:0.5, duration:0.5 }}
          style={{ fontFamily:MONO, fontSize:10, fontWeight:700, fill:'#e8a838', letterSpacing:'0.06em' }}>
          ⚑ HIGH RISK
        </motion.text>
      )}
    </g>
  )

  if (n.type === 'claim') return (
    <g>
      <motion.rect x={n.x-36} y={n.y-13} width={72} height={26} rx={5}
        animate={anim} transition={tr} style={glowStyle} />
      <text x={n.x} y={n.y+4} textAnchor="middle"
        style={{ fontFamily:MONO, fontSize:8.5, fill:vis.stroke, pointerEvents:'none' }}>
        {n.label}
      </text>
    </g>
  )

  if (n.type === 'physician') {
    const r = 27
    return (
      <g>
        <motion.polygon points={hexPts(n.x, n.y, r)}
          animate={anim} transition={tr} style={glowStyle} />
        <text x={n.x} y={n.y-4} textAnchor="middle"
          style={{ fontFamily:MONO, fontSize:6.5, fill:vis.stroke+'88', letterSpacing:'0.12em', pointerEvents:'none' }}>PHY</text>
        <text x={n.x} y={n.y+7} textAnchor="middle"
          style={{ fontFamily:MONO, fontSize:8, fontWeight:600, fill:vis.stroke, pointerEvents:'none' }}>
          {n.label.slice(3)}
        </text>
      </g>
    )
  }

  if (n.type === 'collude') return (
    <g>
      <motion.rect x={n.x-47} y={n.y-14} width={94} height={28} rx={6}
        animate={anim} transition={tr} style={glowStyle} />
      <text x={n.x} y={n.y-1} textAnchor="middle"
        style={{ fontFamily:MONO, fontSize:8.5, fontWeight:600, fill:vis.stroke, pointerEvents:'none' }}>
        {n.label}
      </text>
      <text x={n.x} y={n.y+9} textAnchor="middle"
        style={{ fontFamily:MONO, fontSize:6, fill:vis.stroke+'80', letterSpacing:'0.1em', pointerEvents:'none' }}>
        FRAUD PARTNER
      </text>
    </g>
  )

  if (n.type === 'patient') return (
    <g>
      <motion.circle cx={n.x} cy={n.y} r={22}
        animate={anim} transition={tr} style={glowStyle} />
      <text x={n.x} y={n.y-3} textAnchor="middle"
        style={{ fontFamily:MONO, fontSize:6.5, fill:vis.stroke+'88', letterSpacing:'0.08em', pointerEvents:'none' }}>
        BENE
      </text>
      <text x={n.x} y={n.y+8} textAnchor="middle"
        style={{ fontFamily:MONO, fontSize:8, fontWeight:600, fill:vis.stroke, pointerEvents:'none' }}>
        {n.label.slice(4)}
      </text>
    </g>
  )

  return null
}

// ─── Main component ────────────────────────────────────────────────────────
export default function InvestigationDemo() {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [paused,   setPaused]   = useState(false)
  const [loopKey,  setLoopKey]  = useState(0)
  const timerRef = useRef(null)

  const cfg   = PHASES[phaseIdx]
  const isSynth = cfg.id === 'synthesis' || cfg.id === 'hold'
  const pulses  = PHASE_PULSES[cfg.id] || []

  useEffect(() => {
    if (paused) return
    timerRef.current = setTimeout(() => {
      setPhaseIdx(p => {
        const next = (p + 1) % PHASES.length
        if (next === 0) setLoopKey(k => k + 1)
        return next
      })
    }, cfg.dur)
    return () => clearTimeout(timerRef.current)
  }, [phaseIdx, paused, cfg.dur])

  const displayPhases = PHASES.filter(p => p.id !== 'hold')

  return (
    <div>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <motion.div animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:2, repeat:Infinity }}
            style={{ width:7, height:7, borderRadius:'50%', background:cfg.color }} />
          <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.2em', color:'#444466', textTransform:'uppercase' }}>
            live investigation · PRV52019 · {cfg.agentLabel}
          </span>
        </div>
        <button onClick={() => setPaused(p => !p)}
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'#555577', cursor:'pointer', fontFamily:MONO, fontSize:10, padding:'5px 14px', letterSpacing:'0.1em' }}>
          {paused ? '▶  play' : '⏸  pause'}
        </button>
      </div>

      {/* ── Two-panel body ── */}
      <div style={{ display:'flex', gap:16, alignItems:'stretch' }}>

        {/* LEFT — SVG graph */}
        <div style={{ flex:'0 0 52%', background:'#07070f', borderRadius:12, overflow:'hidden', boxShadow:'inset 2px 2px 8px #03030a, inset -1px -1px 4px #0f0f1e' }}>
          <svg viewBox="0 0 520 350" width="100%" style={{ display:'block' }}>
            <defs>
              <filter id="ig3glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <linearGradient id="swpg" x1="0" x2="1">
                <stop offset="0%"   stopColor="#b080e000"/>
                <stop offset="55%"  stopColor="#b080e020"/>
                <stop offset="100%" stopColor="#b080e070"/>
              </linearGradient>
            </defs>

            {/* Dot grid */}
            {[...Array(11)].map((_,i) => [...Array(7)].map((__,j) => (
              <circle key={`g${i}${j}`} cx={i*54} cy={j*58} r={0.7} fill="#ffffff07" />
            )))}

            {/* ── Edges ── */}
            {EDGE_DEFS.map((e, i) => {
              const v = edgeVis(e, cfg)
              if (!v) return null
              const { d } = qp(e.s, e.t, e.str ?? 28)
              return (
                <motion.path key={`${e.id}-${loopKey}`} d={d} fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength:1, stroke:v.stroke, strokeWidth:v.w, strokeOpacity:v.op }}
                  transition={{
                    pathLength:   { duration:0.7, delay: i*0.08 },
                    stroke:       { duration:0.45 },
                    strokeWidth:  { duration:0.45 },
                    strokeOpacity:{ duration:0.4 },
                  }}
                  strokeDasharray={v.dash ?? undefined}
                />
              )
            })}

            {/* ── Pulses ── */}
            {pulses.map((p, i) => {
              const s = N[p.s], t = N[p.t]
              if (!s || !t) return null
              const mx = (s.x+t.x)/2, my = (s.y+t.y)/2
              const dx = mx-CX, dy = my-CY
              const len = Math.sqrt(dx*dx+dy*dy) || 1
              const str = (cfg.id === 'synthesis' || cfg.id === 'hold') ? 0 : 25
              const cpx = mx + dx/len*str
              const cpy = my + dy/len*str
              return (
                <Pulse key={`${p.s}${p.t}${i}-${phaseIdx}-${loopKey}`}
                  sx={s.x} sy={s.y} tx={t.x} ty={t.y}
                  cpx={cpx} cpy={cpy}
                  delay={p.d} color={p.c || cfg.color}
                  pkey={`${p.s}${p.t}${i}-${phaseIdx}-${loopKey}`}
                />
              )
            })}

            {/* ── Nodes ── */}
            {Object.keys(N).map(id => (
              <RenderNode key={id} id={id} vis={nodeVis(id, cfg)} isSynth={isSynth} />
            ))}

            {/* ── Collusion ring labels ── */}
            <AnimatePresence>
              {cfg.litAgents.includes('collusion') && (
                <motion.g key="rlabels"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  transition={{ delay:1.6, duration:0.4 }}>
                  <text x={100} y={48} textAnchor="middle"
                    style={{ fontFamily:MONO, fontSize:7, fill:'#e85d5d80' }}>ring · $26K</text>
                  <text x={416} y={48} textAnchor="middle"
                    style={{ fontFamily:MONO, fontSize:7, fill:'#e85d5d60' }}>ring · $48K</text>
                </motion.g>
              )}
            </AnimatePresence>

            {/* ── Temporal timeline ── */}
            <AnimatePresence>
              {cfg.id === 'temporal' && (
                <motion.g key="tl"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  transition={{ duration:0.4 }}>
                  <rect x={28} y={304} width={464} height={26} rx={5} fill="#0c0c18" stroke="#b080e020" strokeWidth={1}/>
                  {[42,82,128,178,232,284,338,390,442,480].map((x,i) => (
                    <rect key={i} x={x} y={306} width={3} height={22} rx={1.5} fill="#b080e050"/>
                  ))}
                  <motion.rect x={28} y={304} width={0} height={26} rx={5}
                    animate={{ width:[0,464] }}
                    transition={{ duration:2.2, delay:0.3, ease:'easeInOut' }}
                    fill="url(#swpg)"/>
                  <text x={34}  y={298} style={{ fontFamily:MONO, fontSize:7, fill:'#404068', letterSpacing:'0.04em' }}>JAN 2009</text>
                  <text x={450} y={298} textAnchor="end" style={{ fontFamily:MONO, fontSize:7, fill:'#404068' }}>DEC 2009</text>
                  <motion.text x={260} y={344} textAnchor="middle"
                    initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.9 }}
                    style={{ fontFamily:MONO, fontSize:9, fill:'#7070c080', letterSpacing:'0.06em' }}>
                    ✓  no impossible overlaps detected
                  </motion.text>
                </motion.g>
              )}
            </AnimatePresence>

          </svg>
        </div>

        {/* RIGHT — Explanation card */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', minHeight:0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={phaseIdx}
              initial={{ opacity:0, x:14 }}
              animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x:-10 }}
              transition={{ duration:0.32 }}
              style={{ display:'flex', flexDirection:'column', gap:12, height:'100%' }}>

              {/* Agent header */}
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flexShrink:0, width:46, height:46, borderRadius:12, background:'#0e0e1c', border:`1px solid ${cfg.color}28`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:`0 0 18px ${cfg.color}18` }}>
                  {cfg.icon}
                </div>
                <div>
                  <div style={{ fontFamily:MONO, fontSize:8, letterSpacing:'0.2em', color:cfg.color+'99', textTransform:'uppercase', marginBottom:3 }}>
                    {cfg.agentLabel}
                  </div>
                  <div style={{ fontFamily:PF, fontWeight:700, fontSize:14.5, color:'var(--text)', lineHeight:1.3 }}>
                    {cfg.title}
                  </div>
                </div>
              </div>

              {/* What it does */}
              <div style={{ background:'#0c0c1a', border:'1px solid rgba(255,255,255,0.045)', borderRadius:10, padding:'13px 15px' }}>
                <div style={{ fontFamily:MONO, fontSize:7, letterSpacing:'0.2em', color:'#404060', textTransform:'uppercase', marginBottom:7 }}>
                  How it works
                </div>
                <div style={{ fontFamily:SF, fontSize:12.5, color:'var(--muted)', lineHeight:1.75 }}>
                  {cfg.what}
                </div>
              </div>

              {/* Findings */}
              <div style={{ background:'#0c0c1a', border:'1px solid rgba(255,255,255,0.045)', borderRadius:10, padding:'13px 15px', flex:1 }}>
                <div style={{ fontFamily:MONO, fontSize:7, letterSpacing:'0.2em', color:'#404060', textTransform:'uppercase', marginBottom:10 }}>
                  {cfg.id === 'formation' ? 'Data loaded' : 'Findings'}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                  {cfg.findings.map((f, i) => (
                    <motion.div key={i}
                      initial={{ opacity:0, x:8 }}
                      animate={{ opacity:1, x:0 }}
                      transition={{ delay: i*0.14 + 0.18, duration:0.3 }}
                      style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <span style={{ fontFamily:MONO, fontSize:11, color: f.color || cfg.color, flexShrink:0, marginTop:1, minWidth:14 }}>
                        {f.icon}
                      </span>
                      <span style={{ fontFamily:SF, fontSize:12.5, color: f.color ? 'var(--text)' : 'var(--muted)', lineHeight:1.5 }}>
                        {f.text}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Verdict */}
              {cfg.verdict && (
                <motion.div
                  initial={{ opacity:0, y:6 }}
                  animate={{ opacity:1, y:0 }}
                  transition={{ delay:0.45, duration:0.4 }}
                  style={{ background: cfg.verdict.bg, border:`1.5px solid ${cfg.verdict.color}`, borderRadius:9, padding: cfg.verdict.isFinal ? '14px 16px' : '11px 15px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                  <div>
                    <div style={{ fontFamily:MONO, fontSize:7, letterSpacing:'0.18em', color:cfg.verdict.color+'88', textTransform:'uppercase', marginBottom:4 }}>
                      {cfg.verdict.isFinal ? 'Final verdict' : 'Agent verdict'}
                    </div>
                    <div style={{ fontFamily:MONO, fontSize: cfg.verdict.isFinal ? 13 : 11, fontWeight:700, color:cfg.verdict.color, letterSpacing:'0.05em' }}>
                      {cfg.verdict.label}
                    </div>
                  </div>
                  <div style={{ fontFamily:SF, fontSize:11, color:cfg.verdict.color+'80', textAlign:'right', lineHeight:1.7, flexShrink:0 }}>
                    {cfg.verdict.note}
                  </div>
                </motion.div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Phase pills ── */}
      <div style={{ marginTop:18, display:'flex', gap:5, flexWrap:'wrap' }}>
        {displayPhases.map((p, i) => {
          const isCurr = phaseIdx === i || (p.id === 'synthesis' && cfg.id === 'hold')
          const isPast = phaseIdx > i && !isCurr
          return (
            <button key={p.id} onClick={() => { setPhaseIdx(i); setPaused(false) }}
              style={{
                background: isCurr ? `${p.color}18` : 'none',
                border: `1px solid ${isCurr ? p.color : isPast ? p.color+'55' : '#22223a'}`,
                borderRadius: 20, color: isCurr ? p.color : isPast ? p.color+'80' : '#38384e',
                cursor:'pointer', fontFamily:MONO, fontSize:8.5, letterSpacing:'0.1em',
                padding:'4px 12px', transition:'all 0.2s',
              }}>
              {p.agentN ? `${p.agentN}. ` : ''}{p.id === 'formation' ? 'GRAPH' : p.title.split(' ').slice(0,2).join(' ').toUpperCase()}
            </button>
          )
        })}
      </div>

    </div>
  )
}
