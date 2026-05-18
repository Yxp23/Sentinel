import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MONO = 'JetBrains Mono, monospace'
const SF   = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
const PF   = '"Playfair Display", Georgia, serif'

// ─── Node positions (viewBox 0 0 630 490) ──────────────────────────────────
const CX = 312, CY = 258
const N = {
  prv:  { x: CX,  y: CY,  type: 'provider',  label: 'PRV52019'  },
  clm1: { x: 496, y: 150, type: 'claim',      label: 'CLM-001'  },
  clm2: { x: 522, y: 258, type: 'claim',      label: 'CLM-002'  },
  clm3: { x: 496, y: 366, type: 'claim',      label: 'CLM-003'  },
  phy1: { x: 188, y: 98,  type: 'physician',  label: 'PHY347413'},
  phy2: { x: 438, y: 80,  type: 'physician',  label: 'PHY393952'},
  col1: { x: 68,  y: 72,  type: 'collude',    label: 'PRV52119' },
  col2: { x: 554, y: 72,  type: 'collude',    label: 'PRV52065' },
  pat1: { x: 96,  y: 162, type: 'patient',    label: 'BENE20205'},
  pat2: { x: 72,  y: 268, type: 'patient',    label: 'BENE15144'},
  pat3: { x: 100, y: 372, type: 'patient',    label: 'BENE21360'},
}

const AGENT_COLOR = {
  billing: '#e8a838', collusion: '#e85d5d', patient: '#38b2ac',
  temporal: '#b080e0', synthesis: '#e8a838',
}

// Distance from node center to its boundary in direction `angle` (radians)
function nodeOuterRadius(id, angle) {
  const n = N[id]
  const ca = Math.abs(Math.cos(angle))
  const sa = Math.abs(Math.sin(angle))
  const eps = 1e-6
  if (n.type === 'provider')  { const hw = 64, hh = 28; return ca < eps ? hh : sa < eps ? hw : Math.min(hw / ca, hh / sa) }
  if (n.type === 'claim')     { const hw = 42, hh = 18; return ca < eps ? hh : sa < eps ? hw : Math.min(hw / ca, hh / sa) }
  if (n.type === 'physician') return 31
  if (n.type === 'collude')   { const hw = 54, hh = 19; return ca < eps ? hh : sa < eps ? hw : Math.min(hw / ca, hh / sa) }
  if (n.type === 'patient')   return 27
  return 24
}

// Bezier path clipped to node boundaries — edges start/end at box edges, not centers
const qpEdge = (sid, tid, bow = 30) => {
  const s = N[sid], t = N[tid]
  const dx = t.x - s.x, dy = t.y - s.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const angle = Math.atan2(dy, dx)
  const gap = 6  // extra clearance beyond node boundary
  const sr = nodeOuterRadius(sid, angle) + gap
  const tr = nodeOuterRadius(tid, angle + Math.PI) + gap
  const sx = s.x + (dx / len) * sr,  sy = s.y + (dy / len) * sr
  const ex = t.x - (dx / len) * tr,  ey = t.y - (dy / len) * tr
  const mx = (sx + ex) / 2, my = (sy + ey) / 2
  const cdx = mx - CX, cdy = my - CY
  const clen = Math.sqrt(cdx * cdx + cdy * cdy) || 1
  const cpx = mx + (cdx / clen) * bow, cpy = my + (cdy / clen) * bow
  return { d: `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cpx.toFixed(1)},${cpy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`, cpx, cpy, sx, sy, ex, ey }
}

// Keep qp as alias (used by Pulse — will be updated below)
const qp = qpEdge

const hexPts = (cx, cy, r) =>
  [...Array(6)].map((_, i) => {
    const a = (i * 60 - 30) * (Math.PI / 180)
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')

// ─── Edge definitions ────────────────────────────────────────────────────────
const EDGES = [
  { id: 'e_pc1', s: 'prv',  t: 'clm1', agent: 'billing'   },
  { id: 'e_pc2', s: 'prv',  t: 'clm2', agent: 'billing'   },
  { id: 'e_pc3', s: 'prv',  t: 'clm3', agent: 'billing'   },
  { id: 'e_ph1', s: 'prv',  t: 'phy1', agent: 'collusion', bow: 18 },
  { id: 'e_ph2', s: 'prv',  t: 'phy2', agent: 'collusion', bow: 18 },
  { id: 'e_co1', s: 'phy1', t: 'col1', agent: 'collusion', bow: 12, reveal: true },
  { id: 'e_co2', s: 'phy2', t: 'col2', agent: 'collusion', bow: 12, reveal: true },
  { id: 'e_p1',  s: 'pat1', t: 'prv',  agent: 'patient'   },
  { id: 'e_p2',  s: 'pat2', t: 'prv',  agent: 'patient'   },
  { id: 'e_p3',  s: 'pat3', t: 'prv',  agent: 'patient'   },
]

// ─── Phase data ──────────────────────────────────────────────────────────────
const PHASES = [
  {
    id: 'formation', dur: 7000, color: '#7878c0', agentN: null,
    icon: '🗺️', agentLabel: 'System', title: 'Building Knowledge Graph',
    activeEdges: 'all', activeNodes: 'all',
    showBarChart: false, showTimeline: false, showVerdict: false,
    logLines: [
      { t: 400,  color: '#6060a0', text: '› Initializing knowledge graph engine...' },
      { t: 1200, color: '#e0e0ff', text: '› Provider PRV52019 → node created' },
      { t: 2200, color: '#e0e0ff', text: '› 1,961 claims → 3 representative nodes' },
      { t: 3200, color: '#e0e0ff', text: '› 2 attending physicians → linked' },
      { t: 4200, color: '#e0e0ff', text: '› 3 patient beneficiaries → indexed' },
      { t: 5500, color: '#9090d8', text: '› Graph ready · 11 nodes · 10 edges' },
    ],
    verdict: null,
    pulses: [],
  },
  {
    id: 'billing', dur: 9000, color: '#e8a838', agentN: 1,
    icon: '📊', agentLabel: 'Agent 1 of 5', title: 'Billing Volume Analysis',
    activeEdges: ['billing'], activeNodes: ['prv', 'clm1', 'clm2', 'clm3'],
    showBarChart: true, showTimeline: false, showVerdict: false,
    logLines: [
      { t: 300,  color: '#6060a0', text: '› Walking Provider → Claim edges...' },
      { t: 1400, color: '#e8a83888', text: '› Total claims: 1,961  ·  total billed: $5.99M' },
      { t: 2800, color: '#e8a838',   text: '› claims_ratio = 5.90×  (peer avg = 1.00×)' },
      { t: 4400, color: '#e8a838',   text: '› amount_ratio = 14.90×  (threshold = 3.00×)' },
      { t: 6000, color: '#e0e0ff',   text: '› Avg $3,057/claim vs peer avg $402/claim' },
      { t: 7500, color: '#e8a838',   text: '⚑ ANOMALY — both ratios exceed 3× threshold' },
    ],
    verdict: { label: 'HIGH RISK', note: 'Both ratios far exceed 3× peer threshold', color: '#e8a838' },
    pulses: [
      { s: 'prv', t: 'clm1', d: 0.4, c: '#e8a838' },
      { s: 'prv', t: 'clm2', d: 1.4, c: '#e8a838' },
      { s: 'prv', t: 'clm3', d: 2.4, c: '#e8a838' },
      { s: 'prv', t: 'clm1', d: 4.0, c: '#e8a838' },
      { s: 'prv', t: 'clm2', d: 5.2, c: '#e8a838' },
      { s: 'prv', t: 'clm3', d: 6.5, c: '#e8a838' },
    ],
  },
  {
    id: 'collusion', dur: 9000, color: '#e85d5d', agentN: 2,
    icon: '🕸️', agentLabel: 'Agent 2 of 5', title: 'Collusion Network Analysis',
    activeEdges: ['billing', 'collusion'], activeNodes: ['prv', 'clm1', 'clm2', 'clm3', 'phy1', 'phy2', 'col1', 'col2'],
    showBarChart: false, showTimeline: false, showVerdict: false,
    logLines: [
      { t: 300,  color: '#6060a0', text: '› Walking Provider → Claim → Physician edges...' },
      { t: 1600, color: '#e0e0ff', text: '› Mapping physician-to-provider adjacency...' },
      { t: 3000, color: '#e85d5d', text: '› PHY347413 links PRV52019 ↔ PRV52119' },
      { t: 4400, color: '#e85d5d', text: '› PHY347413 ring flow: $147,300 (6.0× avg)' },
      { t: 5800, color: '#e85d5d', text: '› PHY393952 links PRV52019 ↔ PRV52065' },
      { t: 7500, color: '#e85d5d', text: '⚑ RING DETECTED — 2 shared physicians found' },
    ],
    verdict: { label: 'MEDIUM RISK', note: '2 collusion rings · $213K total flow', color: '#e85d5d' },
    pulses: [
      { s: 'prv',  t: 'phy1', d: 0.4, c: '#e85d5d' },
      { s: 'phy1', t: 'col1', d: 1.5, c: '#e85d5d' },
      { s: 'prv',  t: 'phy2', d: 2.5, c: '#e85d5d' },
      { s: 'phy2', t: 'col2', d: 3.6, c: '#e85d5d' },
      { s: 'prv',  t: 'phy1', d: 5.0, c: '#e85d5d' },
      { s: 'phy1', t: 'col1', d: 6.2, c: '#e85d5d' },
    ],
  },
  {
    id: 'patient', dur: 9000, color: '#38b2ac', agentN: 3,
    icon: '🏥', agentLabel: 'Agent 3 of 5', title: 'Patient Pattern Analysis',
    activeEdges: ['billing', 'collusion', 'patient'], activeNodes: 'all',
    showBarChart: false, showTimeline: false, showVerdict: false,
    logLines: [
      { t: 300,  color: '#6060a0', text: '› Walking Patient → Claim → Provider edges...' },
      { t: 1600, color: '#e0e0ff', text: '› Checking multi-provider billing patterns...' },
      { t: 3000, color: '#38b2ac', text: '› BENE20205 billed by 2 providers · $46K total' },
      { t: 4400, color: '#38b2ac', text: '› BENE15144 billed by 2 providers · $29K total' },
      { t: 5800, color: '#e0e0ff', text: '› Checking post-death claims... none found' },
      { t: 7500, color: '#38b2ac', text: '⚑ OVERLAP — 2 patients flagged HIGH risk' },
    ],
    verdict: { label: 'HIGH RISK', note: 'Patients shared across fraud ring', color: '#38b2ac' },
    pulses: [
      { s: 'pat1', t: 'prv', d: 0.4, c: '#38b2ac' },
      { s: 'pat2', t: 'prv', d: 1.6, c: '#38b2ac' },
      { s: 'pat3', t: 'prv', d: 2.8, c: '#38b2ac' },
      { s: 'pat1', t: 'prv', d: 4.4, c: '#38b2ac' },
      { s: 'pat2', t: 'prv', d: 5.8, c: '#38b2ac' },
    ],
  },
  {
    id: 'temporal', dur: 7500, color: '#b080e0', agentN: 4,
    icon: '⏱️', agentLabel: 'Agent 4 of 5', title: 'Temporal Anomaly Analysis',
    activeEdges: ['billing', 'collusion', 'patient'], activeNodes: 'all',
    showBarChart: false, showTimeline: true, showVerdict: false,
    logLines: [
      { t: 300,  color: '#6060a0', text: '› Scanning all 1,961 claim timestamps...' },
      { t: 1500, color: '#e0e0ff', text: '› Checking for overlapping inpatient stays...' },
      { t: 2800, color: '#7070c0', text: '› ✓ No concurrent admissions detected' },
      { t: 4000, color: '#7070c0', text: '› ✓ No post-death claim submissions' },
      { t: 5200, color: '#7070c0', text: '› ✓ No 7-day fabrication burst patterns' },
      { t: 6500, color: '#9090d8', text: '✓ CLEAN — timeline appears legitimate' },
    ],
    verdict: { label: 'CLEAN', note: 'No timeline anomalies found', color: '#7070c0' },
    pulses: [],
  },
  {
    id: 'synthesis', dur: 10000, color: '#e8a838', agentN: 5,
    icon: '⚖️', agentLabel: 'Agent 5 of 5', title: 'Synthesis Engine',
    activeEdges: 'all', activeNodes: 'all',
    showBarChart: false, showTimeline: false, showVerdict: true,
    logLines: [
      { t: 300,  color: '#6060a0', text: '› Collecting all 4 agent findings...' },
      { t: 1600, color: '#e8a838', text: '› Billing Agent:   HIGH  · 5.9× / 14.9× ratios' },
      { t: 3000, color: '#e85d5d', text: '› Collusion Agent: MEDIUM · 2 rings · $213K' },
      { t: 4400, color: '#38b2ac', text: '› Patient Agent:   HIGH  · 2 patients flagged' },
      { t: 5800, color: '#7070c0', text: '› Temporal Agent:  CLEAN · no anomalies' },
      { t: 7500, color: '#e8a838', text: '⚑ VERDICT — 3 agents corroborated → HIGH RISK' },
    ],
    verdict: { label: '⚑  HIGH RISK · $5.99M', note: '3 of 4 agents corroborated', color: '#e8a838', isFinal: true },
    pulses: [
      { s: 'clm2', t: 'prv',  d: 0.4, c: '#e8a838' },
      { s: 'phy1', t: 'prv',  d: 1.2, c: '#e85d5d' },
      { s: 'pat2', t: 'prv',  d: 2.0, c: '#38b2ac' },
      { s: 'clm1', t: 'prv',  d: 3.2, c: '#e8a838' },
      { s: 'phy2', t: 'prv',  d: 4.0, c: '#e85d5d' },
      { s: 'pat1', t: 'prv',  d: 5.0, c: '#38b2ac' },
      { s: 'clm3', t: 'prv',  d: 6.2, c: '#e8a838' },
    ],
  },
]

const PHASE_DISPLAY = PHASES // all 6 phases shown

// ─── Compute edge visual ─────────────────────────────────────────────────────
function getEdgeStyle(edge, phase) {
  const { activeEdges, id: pid } = phase
  const isSynth = pid === 'synthesis'
  const col = AGENT_COLOR[edge.agent]

  if (edge.reveal && pid !== 'collusion' && pid !== 'patient' && pid !== 'temporal' && !isSynth)
    return null

  const phaseOrder = ['formation', 'billing', 'collusion', 'patient', 'temporal', 'synthesis']
  const edgePhaseOrder = ['billing', 'collusion', 'patient']
  const phIdx = phaseOrder.indexOf(pid)
  const edIdx = edgePhaseOrder.indexOf(edge.agent)

  if (activeEdges === 'all') {
    if (isSynth) return { stroke: col, w: 2, op: 0.75, dash: null }
    return { stroke: col + '40', w: 1, op: 1, dash: null }
  }

  if (!activeEdges.includes(edge.agent)) {
    if (phIdx > edIdx + 1)
      return { stroke: col + '28', w: 1, op: 0.7, dash: null }
    return null
  }

  if (pid === edge.agent)
    return { stroke: col, w: 2.2, op: 0.9, dash: null }

  return { stroke: col + '55', w: 1.2, op: 1, dash: null }
}

// ─── Compute node visual ─────────────────────────────────────────────────────
function getNodeStyle(id, phase) {
  const { activeNodes, id: pid, color } = phase
  const isSynth = pid === 'synthesis'
  const nodeAgentMap = {
    clm1: 'billing', clm2: 'billing', clm3: 'billing',
    phy1: 'collusion', phy2: 'collusion',
    col1: 'collusion', col2: 'collusion',
    pat1: 'patient', pat2: 'patient', pat3: 'patient',
  }
  const na = nodeAgentMap[id]
  const col = na ? AGENT_COLOR[na] : color

  const dim = { fill: '#0f0f1e', stroke: '#252540', sw: 1.5, glow: null, op: 1 }

  if (id === 'prv') {
    if (isSynth) return { fill: '#e8a83818', stroke: '#e8a838', sw: 2.5, glow: '#e8a83870', op: 1 }
    if (activeNodes !== 'all' && !activeNodes.includes('prv')) return { ...dim, op: 0.3 }
    return { fill: '#e8a83810', stroke: '#e8a83880', sw: 2, glow: null, op: 1 }
  }

  if (id === 'col1' || id === 'col2') {
    const visible = pid === 'collusion' || pid === 'patient' || pid === 'temporal' || isSynth
    if (!visible) return null
  }

  if (activeNodes === 'all') {
    if (!na) return dim
    if (isSynth) return { fill: col + '18', stroke: col, sw: 2, glow: col + '55', op: 1 }
    return { fill: col + '0c', stroke: col + '50', sw: 1.5, glow: null, op: 0.7 }
  }

  if (!activeNodes.includes(id)) return { ...dim, op: 0.2 }

  if (!na) return dim

  const isCurrent = pid === na
  if (isCurrent) return { fill: col + '1a', stroke: col, sw: 2, glow: col + '55', op: 1 }
  return { fill: col + '0f', stroke: col + '60', sw: 1.5, glow: null, op: 0.85 }
}

// ─── Pulse dot along bezier ──────────────────────────────────────────────────
function Pulse({ s, t, delay, color, pkey }) {
  const sn = N[s], tn = N[t]
  if (!sn || !tn) return null
  const { cpx, cpy, sx, sy, ex, ey } = qpEdge(s, t, 28)
  // Animate along clipped quadratic bezier
  const steps = 24
  const pts = [...Array(steps + 1)].map((_, i) => {
    const u = i / steps
    const x = (1-u)*(1-u)*sx + 2*(1-u)*u*cpx + u*u*ex
    const y = (1-u)*(1-u)*sy + 2*(1-u)*u*cpy + u*u*ey
    return [x, y]
  })
  return (
    <motion.circle
      key={pkey}
      r={4.5}
      fill={color}
      style={{ filter: `drop-shadow(0 0 7px ${color})` }}
      initial={{ cx: pts[0][0], cy: pts[0][1], opacity: 0 }}
      animate={{
        cx: pts.map(p => p[0]),
        cy: pts.map(p => p[1]),
        opacity: [0, 1, 1, 1, 0],
      }}
      transition={{
        cx: { duration: 1.1, delay, ease: 'easeInOut' },
        cy: { duration: 1.1, delay, ease: 'easeInOut' },
        opacity: { duration: 1.1, delay, times: [0, 0.06, 0.5, 0.88, 1] },
      }}
    />
  )
}

// ─── Node shape renderer ─────────────────────────────────────────────────────
function NodeShape({ id, vis, isSynth, loopKey }) {
  if (!vis) return null
  const n = N[id]
  const glow = vis.glow ? { filter: `drop-shadow(0 0 10px ${vis.glow})` } : undefined
  const a = { fill: vis.fill, stroke: vis.stroke, strokeWidth: vis.sw, opacity: vis.op ?? 1 }
  const tr = { duration: 0.5 }

  if (n.type === 'provider') return (
    <g>
      <motion.rect x={n.x - 60} y={n.y - 24} width={120} height={48} rx={11}
        animate={a} transition={tr} style={glow} />
      <text x={n.x} y={n.y - 4} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, fill: vis.stroke, letterSpacing: '0.04em', pointerEvents: 'none' }}>
        {n.label}
      </text>
      <text x={n.x} y={n.y + 13} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 7, fill: vis.stroke + '70', letterSpacing: '0.24em', pointerEvents: 'none' }}>
        PROVIDER
      </text>
      {isSynth && (
        <motion.g
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}>
          <rect x={n.x - 78} y={n.y - 92} width={156} height={26} rx={6}
            fill="#e8a83822" stroke="#e8a838" strokeWidth={1.5} />
          <text x={n.x} y={n.y - 74} textAnchor="middle"
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, fill: '#e8a838', letterSpacing: '0.05em', pointerEvents: 'none' }}>
            ⚑ HIGH RISK · $5.99M
          </text>
        </motion.g>
      )}
    </g>
  )

  if (n.type === 'claim') return (
    <g>
      <motion.rect x={n.x - 38} y={n.y - 15} width={76} height={30} rx={6}
        animate={a} transition={tr} style={glow} />
      <text x={n.x} y={n.y + 5} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 9, fill: vis.stroke, pointerEvents: 'none' }}>
        {n.label}
      </text>
    </g>
  )

  if (n.type === 'physician') return (
    <g>
      <motion.polygon points={hexPts(n.x, n.y, 28)}
        animate={a} transition={tr} style={glow} />
      <text x={n.x} y={n.y - 4} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 6.5, fill: vis.stroke + '90', letterSpacing: '0.12em', pointerEvents: 'none' }}>PHY</text>
      <text x={n.x} y={n.y + 8} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 600, fill: vis.stroke, pointerEvents: 'none' }}>
        {n.label.slice(3)}
      </text>
    </g>
  )

  if (n.type === 'collude') return (
    <g>
      <motion.rect x={n.x - 50} y={n.y - 16} width={100} height={32} rx={7}
        animate={a} transition={tr} style={glow} />
      <text x={n.x} y={n.y - 2} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, fill: vis.stroke, pointerEvents: 'none' }}>
        {n.label}
      </text>
      <text x={n.x} y={n.y + 10} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 6, fill: vis.stroke + '80', letterSpacing: '0.1em', pointerEvents: 'none' }}>
        PARTNER
      </text>
    </g>
  )

  if (n.type === 'patient') return (
    <g>
      <motion.circle cx={n.x} cy={n.y} r={24}
        animate={a} transition={tr} style={glow} />
      <text x={n.x} y={n.y - 4} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 6.5, fill: vis.stroke + '90', letterSpacing: '0.1em', pointerEvents: 'none' }}>
        BENE
      </text>
      <text x={n.x} y={n.y + 9} textAnchor="middle"
        style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 600, fill: vis.stroke, pointerEvents: 'none' }}>
        {n.label.slice(4)}
      </text>
    </g>
  )

  return null
}

// ─── Billing bar chart overlay ───────────────────────────────────────────────
function BillingChart({ show, loopKey }) {
  if (!show) return null
  const bx = 18, by = 188, bw = 148, bh = 92
  const maxBar = 98
  return (
    <motion.g key={`bc-${loopKey}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ delay: 2.0, duration: 0.7 }}>
      <rect x={bx} y={by} width={bw} height={bh} rx={7}
        fill="#0b0b19" stroke="#e8a83822" strokeWidth={1} />
      <text x={bx + 9} y={by + 14}
        style={{ fontFamily: MONO, fontSize: 7, fill: '#e8a83888', letterSpacing: '0.15em' }}>BILLING RATIOS</text>

      {/* Claims bar */}
      <text x={bx + 9} y={by + 30} style={{ fontFamily: MONO, fontSize: 7, fill: '#707090' }}>CLAIMS</text>
      <rect x={bx + 9} y={by + 33} width={maxBar} height={8} rx={3} fill="#1a1a2e" />
      <motion.rect x={bx + 9} y={by + 33} width={0} height={8} rx={3} fill="#e8a838"
        animate={{ width: maxBar * (5.9 / 15) }}
        transition={{ delay: 2.6, duration: 1.1, ease: 'easeOut' }} />
      <motion.text x={bx + 9 + maxBar * (5.9 / 15) + 4} y={by + 40} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.8 }}
        style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, fill: '#e8a838' }}>5.9×</motion.text>

      {/* Amount bar */}
      <text x={bx + 9} y={by + 57} style={{ fontFamily: MONO, fontSize: 7, fill: '#707090' }}>AMOUNT</text>
      <rect x={bx + 9} y={by + 60} width={maxBar} height={8} rx={3} fill="#1a1a2e" />
      <motion.rect x={bx + 9} y={by + 60} width={0} height={8} rx={3} fill="#e8a838cc"
        animate={{ width: maxBar }}
        transition={{ delay: 3.0, duration: 1.3, ease: 'easeOut' }} />
      <motion.text x={bx + 9 + maxBar + 4} y={by + 68} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.4 }}
        style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, fill: '#e8a838' }}>14.9×</motion.text>

      {/* Peer line */}
      <motion.line x1={bx + 9 + maxBar * (1 / 15)} y1={by + 33} x2={bx + 9 + maxBar * (1 / 15)} y2={by + 68 + 4}
        stroke="#ffffff25" strokeWidth={1} strokeDasharray="2,2"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.8 }} />
      <motion.text x={bx + 9 + maxBar * (1 / 15) + 2} y={by + 78} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.0 }}
        style={{ fontFamily: MONO, fontSize: 6.5, fill: '#454560' }}>peer avg</motion.text>
    </motion.g>
  )
}

// ─── Temporal timeline overlay ───────────────────────────────────────────────
function TimelineBar({ show, loopKey }) {
  if (!show) return null
  const tx = 34, ty = 414, tw = 562, th = 30
  return (
    <motion.g key={`tl-${loopKey}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}>
      <rect x={tx} y={ty} width={tw} height={th} rx={6} fill="#0c0c1a" stroke="#b080e020" strokeWidth={1} />
      {[52, 104, 156, 208, 262, 316, 370, 424, 476, 538].map((x, i) => (
        <rect key={i} x={x} y={ty + 2} width={3} height={th - 4} rx={1.5} fill="#b080e035" />
      ))}
      <defs>
        <linearGradient id="tlswp" x1="0" x2="1">
          <stop offset="0%" stopColor="#b080e000" />
          <stop offset="40%" stopColor="#b080e015" />
          <stop offset="100%" stopColor="#b080e060" />
        </linearGradient>
      </defs>
      <motion.rect x={tx} y={ty} width={0} height={th} rx={6} fill="url(#tlswp)"
        animate={{ width: [0, tw] }}
        transition={{ duration: 2.4, delay: 0.4, ease: 'easeInOut' }} />
      <text x={tx + 6} y={ty - 5}
        style={{ fontFamily: MONO, fontSize: 7, fill: '#3a3a60', letterSpacing: '0.06em' }}>JAN 2009</text>
      <text x={tx + tw - 6} y={ty - 5} textAnchor="end"
        style={{ fontFamily: MONO, fontSize: 7, fill: '#3a3a60' }}>DEC 2009</text>
      <motion.text x={tx + tw / 2} y={ty + th + 16} textAnchor="middle"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}
        style={{ fontFamily: MONO, fontSize: 9, fill: '#6060a060', letterSpacing: '0.08em' }}>
        ✓  no impossible overlaps detected
      </motion.text>
    </motion.g>
  )
}

// ─── Text panel ──────────────────────────────────────────────────────────────
function TextPanel({ phase, phaseKey }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key={phaseKey}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.35 }}
        style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

        {/* Agent header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: '#0d0d1e', border: `1px solid ${phase.color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, boxShadow: `0 0 20px ${phase.color}18`,
          }}>
            {phase.icon}
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.2em', color: phase.color + '99', textTransform: 'uppercase', marginBottom: 4 }}>
              {phase.agentLabel}
            </div>
            <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 16, color: 'var(--text)', lineHeight: 1.2 }}>
              {phase.title}
            </div>
          </div>
        </div>

        {/* Terminal log */}
        <div style={{
          flex: 1, background: '#07071400',
          borderRadius: 10, padding: '14px 16px',
          border: '1px solid rgba(255,255,255,0.04)',
          background: '#09091a',
          overflow: 'hidden', position: 'relative',
          minHeight: 200,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.18em', color: '#30305a', textTransform: 'uppercase', marginBottom: 12 }}>
            ◉ AGENT LOG
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phase.logLines.map((line, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: line.t / 1000, duration: 0.3 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: line.color, lineHeight: 1.6, whiteSpace: 'pre' }}>
                  {line.text}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Verdict */}
        {phase.verdict && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: 14,
              background: phase.verdict.color + (phase.verdict.isFinal ? '18' : '10'),
              border: `1.5px solid ${phase.verdict.color}${phase.verdict.isFinal ? 'cc' : '55'}`,
              borderRadius: 10,
              padding: phase.verdict.isFinal ? '16px 18px' : '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: '0.18em', color: phase.verdict.color + '88', textTransform: 'uppercase', marginBottom: 5 }}>
                {phase.verdict.isFinal ? 'Final Verdict' : 'Agent Verdict'}
              </div>
              <div style={{ fontFamily: MONO, fontSize: phase.verdict.isFinal ? 14 : 12, fontWeight: 700, color: phase.verdict.color, letterSpacing: '0.04em' }}>
                {phase.verdict.label}
              </div>
            </div>
            <div style={{ fontFamily: SF, fontSize: 11, color: phase.verdict.color + '80', textAlign: 'right', lineHeight: 1.7, flexShrink: 0, maxWidth: 120 }}>
              {phase.verdict.note}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function InvestigationDemo() {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [paused, setPaused]     = useState(false)
  const [loopKey, setLoopKey]   = useState(0)
  const timerRef    = useRef(null)
  const startRef    = useRef(Date.now())   // when current phase timer last started
  const remainRef   = useRef(PHASES[0].dur) // remaining ms for current phase

  const phase = PHASES[phaseIdx]
  const isSynth = phase.id === 'synthesis'
  const pulses = phase.pulses

  const advance = () => {
    setPhaseIdx(p => {
      const next = (p + 1) % PHASES.length
      if (next === 0) setLoopKey(k => k + 1)
      return next
    })
  }

  // Reset remaining time whenever the phase changes
  useEffect(() => {
    remainRef.current = phase.dur
  }, [phaseIdx, phase.dur])

  // Start/stop/resume timer based on paused state and phase
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (paused) {
      // Record how much time is left so resume is accurate
      const elapsed = Date.now() - startRef.current
      remainRef.current = Math.max(300, phase.dur - elapsed)
      return
    }
    startRef.current = Date.now()
    timerRef.current = setTimeout(advance, remainRef.current)
    return () => clearTimeout(timerRef.current)
  }, [phaseIdx, paused])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.div
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: phase.color }} />
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: '#3a3a60', textTransform: 'uppercase' }}>
            Live Investigation · PRV52019 · {phase.agentLabel}
          </span>
        </div>
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7, color: '#50507a', cursor: 'pointer',
            fontFamily: MONO, fontSize: 10, padding: '5px 16px', letterSpacing: '0.1em',
          }}>
          {paused ? '▶  play' : '⏸  pause'}
        </button>
      </div>

      {/* ── Two-panel body ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', minHeight: 500 }}>

        {/* LEFT — graph */}
        <div style={{
          flex: '0 0 60%',
          background: '#06060f',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: 'inset 3px 3px 10px #02020a, inset -1px -1px 5px #0e0e1e',
          border: '1px solid rgba(255,255,255,0.03)',
          position: 'relative',
        }}>
          <svg viewBox="0 0 630 490" width="100%" style={{ display: 'block' }}>
            <defs>
              <filter id="idglow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Dot grid */}
            {[...Array(12)].map((_, i) => [...Array(9)].map((__, j) => (
              <circle key={`g${i}${j}`} cx={i * 58} cy={j * 62} r={0.7} fill="#ffffff06" />
            )))}

            {/* Edges */}
            {EDGES.map((e, i) => {
              const v = getEdgeStyle(e, phase)
              if (!v) return null
              const { d } = qpEdge(e.s, e.t, e.bow ?? 30)
              return (
                <motion.path
                  key={`${e.id}-${loopKey}`}
                  d={d} fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1, stroke: v.stroke, strokeWidth: v.w, strokeOpacity: v.op }}
                  transition={{
                    pathLength: { duration: 0.7, delay: i * 0.07 },
                    stroke: { duration: 0.4 },
                    strokeWidth: { duration: 0.4 },
                    strokeOpacity: { duration: 0.4 },
                  }}
                  strokeDasharray={v.dash ?? undefined}
                />
              )
            })}

            {/* Pulses */}
            {pulses.map((p, i) => (
              <Pulse
                key={`${p.s}${p.t}${i}-${phaseIdx}-${loopKey}`}
                s={p.s} t={p.t}
                delay={p.d} color={p.c || phase.color}
                pkey={`${p.s}${p.t}${i}-${phaseIdx}-${loopKey}`}
              />
            ))}

            {/* Billing bar chart */}
            <BillingChart show={phase.showBarChart} loopKey={`${phaseIdx}-${loopKey}`} />

            {/* Timeline */}
            <TimelineBar show={phase.showTimeline} loopKey={`${phaseIdx}-${loopKey}`} />

            {/* Collusion ring labels */}
            <AnimatePresence>
              {(phase.id === 'collusion' || phase.id === 'patient' || phase.id === 'temporal' || isSynth) && (
                <motion.g key="rlabels"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ delay: 1.4, duration: 0.4 }}>
                  <text x={68} y={50} textAnchor="middle"
                    style={{ fontFamily: MONO, fontSize: 7, fill: '#e85d5d70' }}>ring · $147K</text>
                  <text x={554} y={50} textAnchor="middle"
                    style={{ fontFamily: MONO, fontSize: 7, fill: '#e85d5d60' }}>ring · $66K</text>
                </motion.g>
              )}
            </AnimatePresence>

            {/* Synthesis ripple */}
            {isSynth && (
              <motion.circle cx={CX} cy={CY} r={0} fill="none" stroke="#e8a83830" strokeWidth={2}
                animate={{ r: [0, 100, 200], opacity: [0.6, 0.2, 0] }}
                transition={{ duration: 1.5, delay: 0.3, ease: 'easeOut' }}
              />
            )}

            {/* Nodes */}
            {Object.keys(N).map(id => (
              <NodeShape
                key={id} id={id}
                vis={getNodeStyle(id, phase)}
                isSynth={isSynth}
                loopKey={loopKey}
              />
            ))}
          </svg>
        </div>

        {/* RIGHT — text panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TextPanel phase={phase} phaseKey={`${phaseIdx}-${loopKey}`} />
        </div>
      </div>

      {/* ── Progress dots ── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 14 }}>
        {PHASE_DISPLAY.map((p, i) => {
          const isCurr = phaseIdx === i
          const isPast = phaseIdx > i
          return (
            <motion.button
              key={p.id}
              onClick={() => { setPhaseIdx(i); setPaused(false) }}
              animate={{
                width: isCurr ? 28 : 8,
                background: isCurr ? p.color : isPast ? p.color + '55' : '#1e1e36',
                boxShadow: isCurr ? `0 0 10px ${p.color}60` : 'none',
              }}
              transition={{ duration: 0.3 }}
              style={{
                height: 8, borderRadius: 4, border: 'none',
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            />
          )
        })}
      </div>

      {/* ── Phase pills ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {PHASE_DISPLAY.map((p, i) => {
          const isCurr = phaseIdx === i
          const isPast = phaseIdx > i
          return (
            <button key={p.id} onClick={() => { setPhaseIdx(i); setPaused(false) }}
              style={{
                background: isCurr ? `${p.color}14` : 'transparent',
                border: `1px solid ${isCurr ? p.color : isPast ? p.color + '44' : '#1e1e38'}`,
                borderRadius: 20, cursor: 'pointer',
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em',
                color: isCurr ? p.color : isPast ? p.color + '70' : '#32324e',
                padding: '5px 14px',
                transition: 'all 0.2s',
              }}>
              {p.agentN ? `${p.agentN}·` : ''}{p.id === 'formation' ? 'GRAPH' : p.title.split(' ').slice(0, 2).join(' ').toUpperCase()}
            </button>
          )
        })}
      </div>

    </div>
  )
}
