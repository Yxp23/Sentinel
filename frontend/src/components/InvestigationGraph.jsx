import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as d3 from 'd3'

const fmt = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
const PF = '"Playfair Display", Georgia, serif'

const W = 1400, H = 860

function buildGraph(cf) {
  const nodes = [], links = []

  nodes.push({
    id: 'provider', type: 'provider', w: 196, h: 80,
    color: cf.overall_risk_level === 'HIGH' ? '#e8a838' : '#38b2ac',
    label: cf.provider_id,
    sub: `${cf.overall_risk_level} RISK  ·  ${cf.estimated_fraud_amount > 0 ? fmt(cf.estimated_fraud_amount) : 'No est.'}`,
    tooltip: `Provider: ${cf.provider_id}\nRisk: ${cf.overall_risk_level}\nTotal Claims: ${cf.total_claims || '—'}\nEst. Fraud: ${cf.estimated_fraud_amount > 0 ? fmt(cf.estimated_fraud_amount) : 'None'}`,
  })

  const AGENTS = [
    { id: 'billing',   label: 'Billing Analysis',  icon: '📊', color: '#e8a838', w: 150, h: 60 },
    { id: 'collusion', label: 'Collusion Network', icon: '🕸️', color: '#e85d5d', w: 150, h: 60 },
    { id: 'patient',   label: 'Patient Patterns',  icon: '🏥', color: '#38b2ac', w: 150, h: 60 },
    { id: 'temporal',  label: 'Temporal Analysis', icon: '⏱️', color: '#b080e0', w: 150, h: 60 },
    { id: 'synthesis', label: 'Synthesis Verdict', icon: '⚖️', color: '#e8a838', w: 150, h: 60 },
  ]

  AGENTS.forEach(a => {
    nodes.push({ ...a, id: `agent_${a.id}`, type: 'agent', tooltip: `${a.label}\nClick to scroll to section` })
    links.push({ source: 'provider', target: `agent_${a.id}`, color: a.color, thick: true })
  })
  ;['billing', 'collusion', 'patient', 'temporal'].forEach(a => {
    links.push({ source: `agent_${a}`, target: 'agent_synthesis', color: '#ffffff12', dashed: true })
  })

  ;(cf.billing_detail?.anomalies || []).slice(0, 3).forEach((a, i) => {
    const id = `bf${i}`
    nodes.push({ id, type: 'finding', w: 218, h: 64, color: '#e8a838', label: a, tooltip: `Billing Finding ${i + 1}:\n${a}` })
    links.push({ source: 'agent_billing', target: id, color: '#e8a83840', dashed: true })
  })

  ;(cf.collusion_detail || []).slice(0, 2).forEach((r, i) => {
    const id = `cf${i}`
    const label = `Physician ${r.physician_id}: ${r.connected_providers?.length || 0} providers · ${fmt(r.total_ring_amount || 0)}`
    nodes.push({ id, type: 'finding', w: 218, h: 64, color: '#e85d5d', label, tooltip: `Collusion Ring:\n${label}\nFraud providers: ${r.fraud_providers_in_ring?.length || 0}` })
    links.push({ source: 'agent_collusion', target: id, color: '#e85d5d40', dashed: true })
  })

  ;(cf.patient_detail || []).slice(0, 3).forEach((p, i) => {
    const id = `pf${i}`
    const label = `${p.patient_id}: ${(p.flags || []).slice(0, 2).join(', ')}`
    nodes.push({ id, type: 'finding', w: 218, h: 64, color: '#38b2ac', label, tooltip: `Patient Flag:\n${p.patient_id}\nRisk: ${p.risk_level}\nFlags: ${(p.flags || []).join(', ')}` })
    links.push({ source: 'agent_patient', target: id, color: '#38b2ac40', dashed: true })
  })

  ;(cf.temporal_detail || []).slice(0, 3).forEach((t, i) => {
    const id = `tf${i}`
    const label = `${(t.anomaly_type || '').replace(/_/g, ' ')}: ${t.patient_id}`
    nodes.push({ id, type: 'finding', w: 218, h: 64, color: '#b080e0', label, tooltip: `Temporal Anomaly:\n${label}\n${t.timeline_evidence?.substring(0, 120) || ''}` })
    links.push({ source: 'agent_temporal', target: id, color: '#b080e040', dashed: true })
  })

  return { nodes, links }
}

function NodeCard({ node: n, isHovered, onAgentClick }) {
  const shadow = isHovered
    ? `0 0 0 2px ${n.color}, 6px 6px 20px #05050e`
    : n.type === 'provider'
      ? `0 0 30px ${n.color}28, 7px 7px 18px #05050e, -4px -4px 12px #1c1c30`
      : '5px 5px 14px #05050e, -3px -3px 10px #1c1c30'

  if (n.type === 'provider') return (
    <div style={{ width: n.w, background: '#0f0f1a', borderRadius: 12, padding: '15px 20px', border: `2px solid ${isHovered ? n.color : n.color + '88'}`, boxShadow: shadow, cursor: 'default', transition: 'border-color 0.2s, box-shadow 0.2s' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: n.color, letterSpacing: '0.06em' }}>{n.label}</div>
      <div style={{ fontFamily: SF, fontSize: 11, color: '#8888aa', marginTop: 5 }}>{n.sub}</div>
    </div>
  )

  if (n.type === 'agent') return (
    <div
      onClick={() => onAgentClick?.(n.id.replace('agent_', ''))}
      style={{ width: n.w, background: '#0f0f1a', borderRadius: 10, padding: '12px 16px', borderLeft: `3px solid ${isHovered ? n.color : n.color + '99'}`, boxShadow: shadow, cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s', transform: isHovered ? 'scale(1.04)' : 'scale(1)' }}
    >
      <div style={{ fontSize: 16, marginBottom: 6 }}>{n.icon}</div>
      <div style={{ fontFamily: PF, fontWeight: 600, fontSize: 11, color: isHovered ? n.color : n.color + 'cc', letterSpacing: '0.04em', transition: 'color 0.2s' }}>{n.label}</div>
      {isHovered && <div style={{ fontFamily: SF, fontSize: 9, color: n.color + '99', marginTop: 4, letterSpacing: '0.06em' }}>↓ scroll to section</div>}
    </div>
  )

  return (
    <div style={{ width: n.w, background: 'rgba(8,8,20,0.95)', borderRadius: 8, padding: '9px 13px', border: `1px solid ${isHovered ? n.color + '66' : n.color + '25'}`, boxShadow: shadow, cursor: 'default', transition: 'border-color 0.2s, box-shadow 0.2s' }}>
      <div style={{ fontFamily: SF, fontSize: 11, color: isHovered ? '#c0c0d8' : '#8888aa', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', transition: 'color 0.2s' }}>{n.label}</div>
    </div>
  )
}

export default function InvestigationGraph({ cf, onAgentClick }) {
  const [positions, setPositions]   = useState({})
  const [hovered, setHovered]       = useState(null)
  const [tooltip, setTooltip]       = useState(null)
  const [pan, setPan]               = useState({ x: 0, y: 0 })
  const [zoom, setZoom]             = useState(2.0)
  const [panStart, setPanStart]     = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const simRef        = useRef(null)
  const containerRef  = useRef(null)
  const nodeDragRef   = useRef(null)

  const { nodes, links } = useMemo(() => cf ? buildGraph(cf) : { nodes: [], links: [] }, [cf])

  // Cinematic zoom-out on mount
  useEffect(() => {
    const t = setTimeout(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, 500)
    return () => clearTimeout(t)
  }, [cf?.provider_id])

  // D3 force simulation
  useEffect(() => {
    if (nodes.length === 0) return
    const cx = W / 2, cy = H / 2
    const nodeMap = {}
    const simNodes = nodes.map(n => {
      const nd = { ...n }
      if (n.id === 'provider')             { nd.x = cx;       nd.y = cy;       nd.fx = cx; nd.fy = cy }
      else if (n.id === 'agent_billing')   { nd.x = cx - 300; nd.y = cy - 220 }
      else if (n.id === 'agent_collusion') { nd.x = cx + 300; nd.y = cy - 220 }
      else if (n.id === 'agent_patient')   { nd.x = cx - 300; nd.y = cy + 220 }
      else if (n.id === 'agent_temporal')  { nd.x = cx + 300; nd.y = cy + 220 }
      else if (n.id === 'agent_synthesis') { nd.x = cx;       nd.y = cy + 340 }
      else { nd.x = cx + (Math.random() - 0.5) * 700; nd.y = cy + (Math.random() - 0.5) * 500 }
      nodeMap[n.id] = nd
      return nd
    })

    const simLinks = links.map(l => ({
      ...l,
      source: nodeMap[l.source] || l.source,
      target: nodeMap[l.target] || l.target,
    })).filter(l => l.source && l.target)

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id(d => d.id).distance(d => d.thick ? 220 : 155).strength(0.7))
      .force('charge', d3.forceManyBody().strength(-320))
      .force('collide', d3.forceCollide().radius(d => Math.max(d.w, d.h) / 2 + 18))
      .force('x', d3.forceX(cx).strength(0.025))
      .force('y', d3.forceY(cy).strength(0.025))
      .alphaDecay(0.025)

    let frame = 0
    sim.on('tick', () => {
      frame++
      if (frame % 2 !== 0) return
      const pos = {}
      simNodes.forEach(n => { pos[n.id] = { x: n.x, y: n.y } })
      setPositions(p => ({ ...p, ...pos }))
    })

    simRef.current = sim
    return () => sim.stop()
  }, [nodes.length, cf?.provider_id])

  // Connected node/link ids for hover highlight
  const connectedIds = useMemo(() => {
    if (!hovered) return new Set()
    const ids = new Set([hovered])
    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source
      const t = typeof l.target === 'object' ? l.target.id : l.target
      if (s === hovered) ids.add(t)
      if (t === hovered) ids.add(s)
    })
    return ids
  }, [hovered, links])

  const getPos = id => positions[id] || { x: W / 2, y: H / 2 }

  // Wheel zoom
  const onWheel = useCallback(e => {
    e.preventDefault()
    setZoom(z => Math.max(0.4, Math.min(3, z - e.deltaY * 0.001)))
  }, [])
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // Background pan
  const onBgMouseDown = useCallback(e => {
    if (e.target.closest('[data-nodeid]')) return
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    setIsDragging(true)
  }, [pan])

  const onMouseMove = useCallback(e => {
    // Background pan
    if (isDragging && panStart) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    }
    // Node drag
    const drag = nodeDragRef.current
    if (drag && simRef.current) {
      const dx = (e.clientX - drag.startX) / zoom
      const dy = (e.clientY - drag.startY) / zoom
      const node = simRef.current.nodes().find(n => n.id === drag.nodeId)
      if (node) { node.fx = drag.startPos.x + dx; node.fy = drag.startPos.y + dy; simRef.current.alpha(0.3).restart() }
    }
    // Update tooltip position to follow cursor
    if (hovered) {
      setTooltip(t => t ? { ...t, cx: e.clientX, cy: e.clientY } : t)
    }
  }, [isDragging, panStart, zoom, hovered])

  const onMouseUp = useCallback(() => {
    setIsDragging(false)
    setPanStart(null)
    const drag = nodeDragRef.current
    if (drag && simRef.current) {
      const node = simRef.current.nodes().find(n => n.id === drag.nodeId)
      if (node) { delete node.fx; delete node.fy }
    }
    nodeDragRef.current = null
  }, [])

  const onNodeMouseDown = useCallback((e, nodeId) => {
    if (nodeId === 'provider') return
    e.stopPropagation()
    nodeDragRef.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      startPos: positions[nodeId] || { x: W / 2, y: H / 2 },
    }
  }, [positions])

  // Hover handlers — show tooltip immediately on mouseenter, no click needed
  const onNodeEnter = useCallback((e, n) => {
    setHovered(n.id)
    setTooltip({ cx: e.clientX, cy: e.clientY, text: n.tooltip || n.label })
  }, [])

  const onNodeLeave = useCallback(() => {
    setHovered(null)
    setTooltip(null)
  }, [])

  const resolvedLinks = links.map(l => {
    const sid = typeof l.source === 'object' ? l.source.id : l.source
    const tid = typeof l.target === 'object' ? l.target.id : l.target
    const sp = getPos(sid), tp = getPos(tid)
    const isHov = hovered && connectedIds.has(sid) && connectedIds.has(tid)
    const dimmed = hovered && !isHov
    return { ...l, sid, tid, sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y, isHov, dimmed }
  })

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 14, left: 18, zIndex: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: '#404058', textTransform: 'uppercase', pointerEvents: 'none' }}>
        Scroll to zoom · Drag background to pan · Drag nodes to rearrange
      </div>

      {/* Tooltip — fixed position tracks raw clientX/Y, no parent offset issues */}
      {tooltip && (
        <div style={{
          position: 'fixed', zIndex: 9999,
          left: tooltip.cx + 16, top: tooltip.cy - 12,
          background: '#0a0a18', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: '10px 14px',
          boxShadow: '4px 4px 20px #05050e',
          pointerEvents: 'none', maxWidth: 280,
        }}>
          {tooltip.text.split('\n').map((line, i) => (
            <div key={i} style={{ fontFamily: i === 0 ? PF : SF, fontSize: i === 0 ? 13 : 11, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? '#e8e8f0' : '#8888aa', lineHeight: 1.5, marginBottom: i === 0 ? 4 : 0 }}>{line}</div>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        style={{ width: '100%', height: 680, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(5,5,14,0.55)', cursor: isDragging ? 'grabbing' : 'grab', position: 'relative' }}
        onMouseDown={onBgMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { onMouseUp(); setHovered(null); setTooltip(null) }}
      >
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: W, height: H, position: 'relative',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: zoom === 1 && pan.x === 0 && pan.y === 0 ? 'transform 1.4s cubic-bezier(0.16,1,0.3,1)' : 'none',
            userSelect: 'none',
          }}>
            {/* SVG edges */}
            <svg style={{ position: 'absolute', inset: 0, width: W, height: H, pointerEvents: 'none' }}>
              <defs>
                <filter id="ig-glow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {resolvedLinks.map((l, i) => (
                <line key={i}
                  x1={l.sx} y1={l.sy} x2={l.tx} y2={l.ty}
                  stroke={l.isHov ? (l.thick ? l.color : l.color.replace(/[0-9a-f]{2}$/i, 'cc')) : l.color}
                  strokeWidth={l.thick ? (l.isHov ? 3 : 2) : (l.isHov ? 1.5 : 1)}
                  strokeOpacity={l.dimmed ? 0.1 : l.thick ? 0.75 : 0.45}
                  strokeDasharray={l.dashed ? '5,4' : undefined}
                  filter={l.isHov && l.thick ? 'url(#ig-glow)' : undefined}
                  style={{ transition: 'stroke-opacity 0.25s, stroke-width 0.2s' }}
                />
              ))}
            </svg>

            {/* Nodes */}
            {nodes.map(n => {
              const pos = getPos(n.id)
              const dimmed = hovered && !connectedIds.has(n.id)
              return (
                <div
                  key={n.id}
                  data-nodeid={n.id}
                  onMouseDown={e => onNodeMouseDown(e, n.id)}
                  onMouseEnter={e => onNodeEnter(e, n)}
                  onMouseLeave={onNodeLeave}
                  style={{
                    position: 'absolute',
                    left: pos.x - n.w / 2,
                    top: pos.y - n.h / 2,
                    width: n.w,
                    opacity: dimmed ? 0.2 : 1,
                    zIndex: n.type === 'provider' ? 10 : n.type === 'agent' ? 5 : 1,
                    cursor: n.type === 'agent' ? 'pointer' : n.id === 'provider' ? 'default' : 'grab',
                    transition: 'left 0.07s linear, top 0.07s linear, opacity 0.25s',
                  }}
                >
                  <NodeCard node={n} isHovered={hovered === n.id} onAgentClick={onAgentClick} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Zoom controls */}
        <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 20, display: 'flex', gap: 6 }}>
          {[{ label: '+', delta: 0.25 }, { label: '−', delta: -0.25 }, { label: '⌂', reset: true }].map(btn => (
            <button key={btn.label}
              onClick={() => btn.reset ? (setZoom(1), setPan({ x: 0, y: 0 })) : setZoom(z => Math.max(0.4, Math.min(3, z + btn.delta)))}
              style={{ width: 32, height: 32, borderRadius: 8, background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)', color: '#8888aa', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '3px 3px 8px #05050e, -2px -2px 6px #1c1c30' }}
            >{btn.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
