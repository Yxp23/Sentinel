import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GraphBackground from './GraphBackground'

const PF = '"Playfair Display", Georgia, serif'
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
const MONO = 'JetBrains Mono, monospace'

const AGENT_STAGES = [
  { id: 'uploaded',  label: 'Files received',                   icon: '📂' },
  { id: 'billing',   label: 'Billing Agent: scanning claims...',  icon: '💰' },
  { id: 'collusion', label: 'Collusion Agent: mapping networks...', icon: '🕸️' },
  { id: 'patient',   label: 'Patient Agent: analyzing patterns...', icon: '👥' },
  { id: 'temporal',  label: 'Temporal Agent: detecting sequences...', icon: '📅' },
  { id: 'synthesis', label: 'Synthesis Agent: building case files...', icon: '🧠' },
]

function parseSSEChunk(text) {
  const events = []
  const parts = text.split('\n\n')
  for (const part of parts) {
    let eventName = 'message'
    let data = null
    for (const line of part.split('\n')) {
      if (line.startsWith('event: ')) eventName = line.slice(7).trim()
      if (line.startsWith('data: ')) {
        try { data = JSON.parse(line.slice(6)) } catch { /* ignore */ }
      }
    }
    if (data !== null) events.push({ event: eventName, data })
  }
  return events
}

export default function DataInputScreen({ data, onBegin, onBack }) {
  const [mode, setMode] = useState('choose') // choose | sample_loading | uploading | error
  const [dragging, setDragging] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [stages, setStages] = useState([])   // completed stage ids
  const [currentMsg, setCurrentMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef(null)
  const abortRef = useRef(null)

  // --- Sample dataset ---
  const handleSample = useCallback(async () => {
    setMode('sample_loading')
    try {
      const res = await fetch('/api/results')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const newData = await res.json()
      onBegin(newData)
    } catch {
      // If API not available, use pre-loaded data and proceed anyway
      onBegin(null)
    }
  }, [onBegin])

  // --- Upload ---
  const handleFiles = useCallback(async (files) => {
    const arr = Array.from(files).filter(f => f.name.endsWith('.csv') || f.name.endsWith('.parquet'))
    if (arr.length === 0) return
    setUploadedFiles(arr)
    setMode('uploading')
    setStages([])
    setCurrentMsg('Uploading files...')

    const formData = new FormData()
    arr.forEach(f => formData.append('files', f))

    const controller = new AbortController()
    abortRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 30 * 60 * 1000) // 30 min

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE blocks (separated by \n\n)
        const events = parseSSEChunk(buffer)
        // Keep any incomplete trailing block in buffer
        const lastSep = buffer.lastIndexOf('\n\n')
        if (lastSep !== -1) buffer = buffer.slice(lastSep + 2)

        for (const { event, data } of events) {
          if (event === 'stage') {
            setCurrentMsg(data.message || '')
            setStages(prev => prev.includes(data.id) ? prev : [...prev, data.id])
          } else if (event === 'done') {
            clearTimeout(timeout)
            setStages(AGENT_STAGES.map(s => s.id))
            setCurrentMsg('Analysis complete!')
            setTimeout(() => onBegin(data.results), 1200)
            return
          } else if (event === 'error') {
            throw new Error(data.message || 'Unknown error')
          }
        }
      }
    } catch (err) {
      clearTimeout(timeout)
      if (err.name === 'AbortError') {
        setErrorMsg('Upload timed out after 30 minutes. Try the sample dataset for instant results.')
      } else {
        setErrorMsg(err.message || 'Upload failed. Make sure the server is running.')
      }
      setMode('error')
    }
  }, [onBegin])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <motion.div
      className="grid-bg"
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <GraphBackground data={data} graphMode="idle" opacity={0.1} />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 820, padding: '0 24px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 10 }}>
            Step 1 of 2
          </div>
          <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 10 }}>
            Select Claims Data
          </div>
          <div style={{ fontFamily: SF, fontSize: 14, color: 'var(--muted)', lineHeight: 1.7 }}>
            Load a pre-computed dataset or upload raw Medicare claims files for analysis
          </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: Sample dataset */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <motion.button
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSample}
              disabled={mode === 'sample_loading'}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid rgba(232,168,56,0.2)',
                borderRadius: 16,
                padding: '36px 32px',
                cursor: mode === 'sample_loading' ? 'default' : 'pointer',
                textAlign: 'left',
                boxShadow: '8px 8px 22px var(--shadow-d), -5px -5px 16px var(--shadow-l)',
                transition: 'box-shadow 0.3s',
                display: 'block',
                opacity: mode === 'sample_loading' ? 0.7 : 1,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 18 }}>
                {mode === 'sample_loading'
                  ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                  : '📦'}
              </div>
              <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 20, color: 'var(--amber)', marginBottom: 10 }}>
                {mode === 'sample_loading' ? 'Loading...' : 'Use Sample Dataset'}
              </div>
              <div style={{ fontFamily: SF, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
                Load pre-analyzed CMS Medicare data with 200 providers, complete agent findings ready to explore.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['200 Providers', '5 Agents', 'Pre-computed', 'Instant'].map(tag => (
                  <span key={tag} style={{ fontFamily: MONO, fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(232,168,56,0.08)', color: 'var(--amber)', letterSpacing: '0.06em' }}>{tag}</span>
                ))}
              </div>
              <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 10, color: 'var(--amber)', letterSpacing: '0.08em', opacity: 0.75 }}>
                Full analysis: 200 providers pre-computed
              </div>
              <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 12, color: 'var(--amber)', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8 }}>
                Begin immediately →
              </div>
            </motion.button>
          </motion.div>

          {/* Right: Upload / Progress / Error */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <AnimatePresence mode="wait">
              {(mode === 'choose' || mode === 'sample_loading') && (
                <motion.div
                  key="drop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: '100%',
                    minHeight: 300,
                    background: dragging ? 'rgba(56,178,172,0.04)' : 'var(--bg)',
                    border: `2px dashed ${dragging ? 'var(--teal)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 16,
                    padding: '36px 32px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: 'inset 4px 4px 10px var(--shadow-d), inset -3px -3px 8px var(--shadow-l)',
                    transition: 'border-color 0.3s, background 0.3s',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 18, filter: dragging ? 'none' : 'grayscale(0.3)' }}>📂</div>
                    <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 20, color: dragging ? 'var(--teal)' : 'var(--text)', marginBottom: 10, transition: 'color 0.3s' }}>
                      Upload Claims Data
                    </div>
                    <div style={{ fontFamily: SF, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
                      Drag & drop CSV or Parquet files. Supports CMS Medicare Part B format, carrier claims, and DMERC files.
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      {['.csv', '.parquet', 'CMS format'].map(tag => (
                        <span key={tag} style={{ fontFamily: MONO, fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(56,178,172,0.08)', color: 'var(--teal)', letterSpacing: '0.06em' }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: 'var(--teal)', letterSpacing: '0.08em', opacity: 0.75 }}>
                      Quick analysis: ~2–3 minutes
                    </div>
                  </div>
                  <div style={{ marginTop: 24, fontFamily: MONO, fontSize: 12, color: 'var(--dim)', letterSpacing: '0.08em', textAlign: 'center', padding: '14px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                    {dragging ? '↓  Drop to upload' : 'Click to browse or drag files here'}
                  </div>
                </motion.div>
              )}

              {mode === 'uploading' && (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    width: '100%', minHeight: 300,
                    background: 'var(--bg)',
                    border: '1px solid rgba(56,178,172,0.2)',
                    borderRadius: 16, padding: '28px 28px',
                    boxShadow: '8px 8px 22px var(--shadow-d), -5px -5px 16px var(--shadow-l)',
                    display: 'flex', flexDirection: 'column', gap: 14,
                  }}
                >
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Running agents
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: 'var(--dim)' }}>
                    {uploadedFiles.map(f => f.name).join(' · ')}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {AGENT_STAGES.map((s, i) => {
                      const done = stages.includes(s.id)
                      const active = !done && stages.length === i
                      return (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: done || active ? 1 : 0.3, x: 0 }}
                          transition={{ delay: i * 0.06, duration: 0.3 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                        >
                          <span style={{ fontSize: 14, width: 22, textAlign: 'center' }}>
                            {done ? '✓' : active ? '⟳' : '○'}
                          </span>
                          <span style={{
                            fontFamily: MONO, fontSize: 11,
                            color: done ? 'var(--teal)' : active ? 'var(--text)' : 'var(--dim)',
                            letterSpacing: '0.04em',
                          }}>
                            {s.label}
                          </span>
                        </motion.div>
                      )
                    })}
                  </div>

                  <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--dim)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12, lineHeight: 1.6 }}>
                    {currentMsg}<br />
                    <span style={{ color: 'rgba(255,255,255,0.18)' }}>Quick analysis: ~2–3 minutes — you can leave this open</span>
                  </div>
                </motion.div>
              )}

              {mode === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    width: '100%', minHeight: 300,
                    background: 'var(--bg)',
                    border: '1px solid rgba(232,93,93,0.25)',
                    borderRadius: 16, padding: '36px 32px',
                    boxShadow: '8px 8px 22px var(--shadow-d), -5px -5px 16px var(--shadow-l)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16,
                  }}
                >
                  <div style={{ fontSize: 32 }}>⚠️</div>
                  <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 18, color: 'var(--red)' }}>Upload Error</div>
                  <div style={{ fontFamily: SF, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{errorMsg}</div>
                  <button
                    onClick={() => { setMode('choose'); setStages([]); setErrorMsg('') }}
                    style={{ background: 'rgba(232,93,93,0.08)', border: '1px solid rgba(232,93,93,0.2)', borderRadius: 8, color: 'var(--red)', cursor: 'pointer', fontFamily: MONO, fontSize: 11, padding: '8px 16px', letterSpacing: '0.08em', marginTop: 4, width: 'fit-content' }}
                  >
                    Try again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Back */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ textAlign: 'center', marginTop: 32 }}
        >
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontFamily: SF, fontSize: 12, letterSpacing: '0.06em' }}
          >
            ← Back to landing
          </button>
        </motion.div>
      </div>

      <input ref={fileRef} type="file" accept=".csv,.parquet" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
    </motion.div>
  )
}
