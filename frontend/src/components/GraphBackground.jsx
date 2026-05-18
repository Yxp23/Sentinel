import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

// Force-directed graph using actual results.json data
// graphMode: 'idle' | 'billing' | 'collusion' | 'patient' | 'temporal' | 'synthesis' | 'investigation'
// highlightProvider: provider_id string for investigation view
export default function GraphBackground({ data, graphMode = 'idle', highlightProvider = null, opacity = 0.18 }) {
  const svgRef = useRef(null)
  const simRef = useRef(null)
  const nodesRef = useRef([])
  const linksRef = useRef([])
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    if (!data || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const W = window.innerWidth
    const H = window.innerHeight

    svg.attr('width', W).attr('height', H)

    // Build nodes
    const nodes = []
    const links = []
    const nodeMap = {}

    // Provider nodes from case files
    ;(data.case_files || []).forEach(cf => {
      const n = {
        id: cf.provider_id,
        type: 'provider',
        risk: cf.overall_risk_level,
        fraud: cf.fraud_label === true || cf.fraud_label === 'Yes',
        x: W * 0.2 + Math.random() * W * 0.6,
        y: H * 0.2 + Math.random() * H * 0.6,
      }
      nodes.push(n)
      nodeMap[cf.provider_id] = n
    })

    // Physician nodes from collusion findings
    const physMap = {}
    ;(data.case_files || []).forEach(cf => {
      ;(cf.collusion_findings || []).forEach(finding => {
        const match = finding.match(/physician=(PHY\d+)/)
        if (match) {
          const physId = match[1]
          if (!physMap[physId]) {
            const n = {
              id: physId,
              type: 'physician',
              x: W * 0.2 + Math.random() * W * 0.6,
              y: H * 0.2 + Math.random() * H * 0.6,
            }
            nodes.push(n)
            physMap[physId] = n
          }
          if (nodeMap[cf.provider_id]) {
            links.push({ source: physId, target: cf.provider_id, type: 'collusion' })
          }
        }
      })
    })

    // Patient nodes (synthetic, decorative — based on patient_detail counts)
    const patientIds = new Set()
    ;(data.case_files || []).forEach(cf => {
      ;(cf.patient_detail || []).slice(0, 3).forEach(p => {
        if (!patientIds.has(p.patient_id)) {
          patientIds.add(p.patient_id)
          const n = {
            id: p.patient_id,
            type: 'patient',
            risk: p.risk_level,
            x: Math.random() * W,
            y: Math.random() * H,
          }
          nodes.push(n)
          nodeMap[p.patient_id] = n
          // Link to the provider
          if (nodeMap[cf.provider_id]) {
            links.push({ source: p.patient_id, target: cf.provider_id, type: 'patient' })
          }
        }
      })
    })

    nodesRef.current = nodes
    linksRef.current = links

    // Defs for glow filters
    const defs = svg.append('defs')
    const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
    const feMerge = glow.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'blur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    const glowStrong = defs.append('filter').attr('id', 'glow-strong').attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%')
    glowStrong.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'blur')
    const feMerge2 = glowStrong.append('feMerge')
    feMerge2.append('feMergeNode').attr('in', 'blur')
    feMerge2.append('feMergeNode').attr('in', 'SourceGraphic')

    // Link layer
    const linkSel = svg.append('g').attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')

    // Node layer
    const nodeSel = svg.append('g').attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .join('circle')

    // Force simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80).strength(0.15))
      .force('charge', d3.forceManyBody().strength(-60))
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.04))
      .force('collision', d3.forceCollide(20))
      .alphaDecay(0.015)
      .velocityDecay(0.7)
    // Pre-calculate ticks to skip the initial "explosion" visual glitch
    sim.tick(40)

    sim.on('tick', () => {
        linkSel
          .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
        nodeSel
          .attr('cx', d => d.x)
          .attr('cy', d => d.y)
      })

    simRef.current = sim

    // Gentle breathing animation
    let frame = 0
    const breathe = () => {
      frame++
      nodes.forEach(n => {
        n.vx = (n.vx || 0) + Math.sin(frame * 0.007 + n.x * 0.003) * 0.08
        n.vy = (n.vy || 0) + Math.cos(frame * 0.005 + n.y * 0.003) * 0.08
        n.vx *= 0.96
        n.vy *= 0.96
      })
      sim.alpha(Math.max(sim.alpha(), 0.05)).restart()
    }
    const breatheInterval = setInterval(breathe, 100)

    return () => {
      sim.stop()
      clearInterval(breatheInterval)
    }
  }, [data])

  // Update visual state when graphMode or highlightProvider changes
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    const linkSel = svg.select('.links').selectAll('line')
    const nodeSel = svg.select('.nodes').selectAll('circle')

    if (graphMode === 'billing') {
      linkSel.attr('stroke', 'rgba(160,160,200,0.08)').attr('stroke-width', 0.5)
      nodeSel.attr('fill', d => d.type === 'provider' ? 'rgba(232,168,56,0.9)' : 'rgba(130,130,170,0.2)')
             .attr('r', d => d.type === 'provider' ? 6 : 2.5)
    } else if (graphMode === 'collusion') {
      linkSel
        .attr('stroke', d => d.type === 'collusion' ? 'rgba(56,178,172,0.8)' : 'rgba(160,160,200,0.05)')
        .attr('stroke-width', d => d.type === 'collusion' ? 2.5 : 0.3)
      nodeSel.attr('fill', d => d.type === 'physician' ? 'rgba(56,178,172,1)' : d.type === 'provider' ? 'rgba(232,168,56,0.5)' : 'rgba(130,130,170,0.15)')
             .attr('r', d => d.type === 'physician' ? 8 : d.type === 'provider' ? 5 : 2.5)
    } else if (graphMode === 'patient') {
      linkSel.attr('stroke', d => d.type === 'patient' ? 'rgba(232,93,93,0.6)' : 'rgba(160,160,200,0.05)').attr('stroke-width', d => d.type === 'patient' ? 1.5 : 0.3)
      nodeSel.attr('fill', d => d.type === 'patient' ? 'rgba(232,93,93,0.8)' : d.type === 'provider' ? 'rgba(232,168,56,0.4)' : 'rgba(130,130,170,0.2)')
             .attr('r', d => d.type === 'patient' ? 5 : d.type === 'provider' ? 5 : 2.5)
    } else if (graphMode === 'temporal') {
      linkSel.attr('stroke', 'rgba(176,128,224,0.7)').attr('stroke-width', 1.5)
      nodeSel.attr('fill', d => {
        if (d.type === 'provider' && d.risk === 'HIGH') return 'rgba(176,128,224,0.9)'
        return 'rgba(130,130,170,0.2)'
      }).attr('r', d => (d.type === 'provider' && d.risk === 'HIGH') ? 8 : 2.5)
    } else if (graphMode === 'synthesis') {
      linkSel.attr('stroke', 'rgba(232,168,56,0.5)').attr('stroke-width', 1.5)
      nodeSel.attr('fill', d => {
        if (d.type === 'provider') {
          if (d.risk === 'HIGH') return 'rgba(232,168,56,1)'
          if (d.risk === 'MEDIUM') return 'rgba(56,178,172,0.8)'
          return 'rgba(160,160,200,0.5)'
        }
        if (d.type === 'physician') return 'rgba(56,178,172,0.7)'
        return 'rgba(232,93,93,0.5)'
      }).attr('r', d => d.type === 'provider' && d.risk === 'HIGH' ? 8 : 4)
    } else if (graphMode === 'investigation' && highlightProvider) {
      linkSel.attr('stroke', d => {
        const src = d.source?.id || d.source
        const tgt = d.target?.id || d.target
        return (src === highlightProvider || tgt === highlightProvider)
          ? 'rgba(232,168,56,0.8)' : 'rgba(160,160,200,0.05)'
      }).attr('stroke-width', d => {
        const src = d.source?.id || d.source
        const tgt = d.target?.id || d.target
        return (src === highlightProvider || tgt === highlightProvider) ? 2 : 0.3
      })
      nodeSel.attr('fill', d => {
        if (d.id === highlightProvider) return 'rgba(232,168,56,1)'
        const isConnected = linksRef.current.some(l => {
          const s = l.source?.id || l.source; const t = l.target?.id || l.target
          return (s === highlightProvider && t === d.id) || (t === highlightProvider && s === d.id)
        })
        if (isConnected) {
          if (d.type === 'physician') return 'rgba(56,178,172,0.9)'
          if (d.type === 'patient') return 'rgba(232,93,93,0.7)'
          return 'rgba(232,168,56,0.5)'
        }
        return 'rgba(100,100,130,0.15)'
      }).attr('r', d => {
        if (d.id === highlightProvider) return 12
        if (d.type === 'provider') return d.risk === 'HIGH' ? 6 : 4
        return d.type === 'physician' ? 5 : 2.5
      })
    } else if (graphMode === 'xray') {
      linkSel.attr('stroke', d => {
        if (d.type === 'collusion') return 'rgba(232,93,93,0.9)'
        if (d.type === 'patient') return 'rgba(232,93,93,0.2)'
        return 'rgba(160,160,200,0.08)'
      }).attr('stroke-width', d => d.type === 'collusion' ? 3 : 0.5)
      
      nodeSel.attr('fill', d => {
        if (d.type === 'physician') return 'rgba(232,93,93,1)'
        if (d.type === 'provider') return d.risk === 'HIGH' ? 'rgba(232,168,56,0.9)' : 'rgba(100,100,130,0.3)'
        return 'rgba(130,130,170,0.2)'
      }).attr('r', d => {
        if (d.type === 'physician') return 8
        if (d.type === 'provider') return d.risk === 'HIGH' ? 10 : 4
        return 2.5
      })
    } else {
      // idle / reset
      linkSel
        .attr('stroke', d => d.type === 'collusion' ? 'rgba(232,93,93,0.4)' : 'rgba(160,160,200,0.12)')
        .attr('stroke-width', d => d.type === 'collusion' ? 1 : 0.5)
      nodeSel
        .attr('r', d => d.type === 'provider' ? (d.risk === 'HIGH' ? 6 : 4) : d.type === 'physician' ? 4 : 2)
        .attr('fill', d => {
          if (d.type === 'provider') {
            if (d.risk === 'HIGH') return 'rgba(232,168,56,0.8)'
            if (d.risk === 'MEDIUM') return 'rgba(56,178,172,0.6)'
            return 'rgba(160,160,200,0.3)'
          }
          if (d.type === 'physician') return 'rgba(56,178,172,0.5)'
          return 'rgba(130,130,170,0.25)'
        })
    }

    // Interactivity for X-Ray mode
    if (graphMode === 'xray') {
      nodeSel
        .style('cursor', 'crosshair')
        .on('mouseover', (event, d) => {
          // Dim non-connected
          nodeSel.attr('opacity', n => {
            if (n.id === d.id) return 1
            const isConnected = linksRef.current.some(l => 
              (l.source.id === d.id && l.target.id === n.id) || 
              (l.target.id === d.id && l.source.id === n.id)
            )
            return isConnected ? 1 : 0.1
          })
          linkSel.attr('opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.05)

          setTooltip({ x: event.clientX, y: event.clientY, data: d })
        })
        .on('mouseout', () => {
          nodeSel.attr('opacity', 1)
          linkSel.attr('opacity', 1)
          setTooltip(null)
        })
    } else {
      nodeSel.style('cursor', 'default').on('mouseover', null).on('mouseout', null)
      nodeSel.attr('opacity', 1)
      linkSel.attr('opacity', 1)
    }

  }, [graphMode, highlightProvider])

  return (
    <>
      <svg
        ref={svgRef}
        style={{
          position: 'fixed', inset: 0,
          width: '100vw', height: '100vh',
          opacity,
          pointerEvents: graphMode === 'xray' ? 'auto' : 'none',
          zIndex: 0,
        }}
      />
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 20, top: tooltip.y + 20,
          background: 'rgba(5, 5, 14, 0.95)', border: '1px solid var(--border)',
          padding: '12px 16px', borderRadius: 8, color: 'var(--text)',
          zIndex: 100, pointerEvents: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          fontFamily: 'Inter, sans-serif',
          backdropFilter: 'blur(8px)',
          minWidth: 200
        }}>
          {tooltip.data.type === 'physician' && (
            <>
              <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 10, marginBottom: 4, letterSpacing: '0.08em' }}>SUSPECTED COLLUSION HUB</div>
              <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>Physician {tooltip.data.id}</div>
              <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 8 }}>
                Connected to {linksRef.current.filter(l => l.source.id === tooltip.data.id || l.target.id === tooltip.data.id).length} providers
              </div>
            </>
          )}
          {tooltip.data.type === 'provider' && (
            <>
              <div style={{ color: tooltip.data.risk === 'HIGH' ? 'var(--amber)' : tooltip.data.risk === 'MEDIUM' ? 'var(--teal)' : 'var(--muted)', fontWeight: 700, fontSize: 10, marginBottom: 4, letterSpacing: '0.08em' }}>
                {tooltip.data.risk} RISK PROVIDER
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>{tooltip.data.id}</div>
              {tooltip.data.fraud && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, fontWeight: 600 }}>★ Confirmed Fraud (Ground Truth)</div>
              )}
            </>
          )}
          {tooltip.data.type === 'patient' && (
            <>
              <div style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 10, marginBottom: 4, letterSpacing: '0.08em' }}>PATIENT</div>
              <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>{tooltip.data.id}</div>
            </>
          )}
        </div>
      )}
    </>
  )
}
