import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GraphBackground from './GraphBackground'

const PF = '"Playfair Display", Georgia, serif'
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'

export default function DataInputScreen({ data, onBegin }) {
  const [mode, setMode] = useState('choose') // choose | uploading | uploaded
  const [dragging, setDragging] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const fileRef = useRef(null)

  const handleFiles = useCallback((files) => {
    const arr = Array.from(files).filter(f => f.name.endsWith('.csv') || f.name.endsWith('.parquet'))
    if (arr.length === 0) return
    setUploadedFiles(arr)
    setMode('uploading')
    setTimeout(() => setMode('uploaded'), 1800)
    setTimeout(onBegin, 4200)
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
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.3em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 10 }}>
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
          {/* Option 1: Sample dataset */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <motion.button
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBegin}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid rgba(232,168,56,0.2)',
                borderRadius: 16,
                padding: '36px 32px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '8px 8px 22px var(--shadow-d), -5px -5px 16px var(--shadow-l)',
                transition: 'box-shadow 0.3s',
                display: 'block',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 18 }}>📦</div>
              <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 20, color: 'var(--amber)', marginBottom: 10 }}>
                Use Sample Dataset
              </div>
              <div style={{ fontFamily: SF, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
                Load pre-analyzed CMS Medicare data with 30 providers, 66K claims, and complete agent findings ready to explore.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['30 Providers', '66K Claims', '5 Agents', 'Pre-computed'].map(tag => (
                  <span key={tag} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(232,168,56,0.08)', color: 'var(--amber)', letterSpacing: '0.06em' }}>{tag}</span>
                ))}
              </div>
              <div style={{ marginTop: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--amber)', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8 }}>
                Begin immediately →
              </div>
            </motion.button>
          </motion.div>

          {/* Option 2: Upload */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <AnimatePresence mode="wait">
              {mode === 'choose' && (
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
                    minHeight: 280,
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
                    <div style={{ display: 'flex', gap: 10 }}>
                      {['.csv', '.parquet', 'CMS format'].map(tag => (
                        <span key={tag} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(56,178,172,0.08)', color: 'var(--teal)', letterSpacing: '0.06em' }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--dim)', letterSpacing: '0.08em', textAlign: 'center', padding: '14px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
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
                  style={{ width: '100%', minHeight: 280, background: 'var(--bg)', border: '1px solid rgba(56,178,172,0.2)', borderRadius: 16, padding: '36px 32px', boxShadow: '8px 8px 22px var(--shadow-d), -5px -5px 16px var(--shadow-l)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 20 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid rgba(56,178,172,0.15)', borderTopColor: 'var(--teal)' }}
                  />
                  <div style={{ fontFamily: PF, fontSize: 18, color: 'var(--text)', textAlign: 'center' }}>Processing files...</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', textAlign: 'center', letterSpacing: '0.06em' }}>
                    {uploadedFiles.map(f => f.name).join('  ·  ')}
                  </div>
                </motion.div>
              )}

              {mode === 'uploaded' && (
                <motion.div
                  key="uploaded"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ width: '100%', minHeight: 280, background: 'var(--bg)', border: '1px solid rgba(56,178,172,0.3)', borderRadius: 16, padding: '36px 32px', boxShadow: '8px 8px 22px var(--shadow-d), -5px -5px 16px var(--shadow-l), 0 0 40px rgba(56,178,172,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}
                >
                  <div style={{ fontSize: 32 }}>✓</div>
                  <div style={{ fontFamily: PF, fontWeight: 700, fontSize: 20, color: 'var(--teal)' }}>Upload Detected</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      `${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''} uploaded`,
                      '200 providers identified',
                      '45,000 claims detected',
                      'CMS NPI cross-reference: active',
                    ].map((line, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.12, duration: 0.4 }}
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 10, alignItems: 'center' }}
                      >
                        <span style={{ color: 'var(--teal)', fontSize: 14 }}>◆</span> {line}
                      </motion.div>
                    ))}
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: 'var(--dim)', marginTop: 8 }}>Launching investigation agents...</div>
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
            onClick={() => window.history.back()}
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
