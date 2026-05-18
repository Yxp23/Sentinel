import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import OpenAI from 'openai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const app = express()
app.use(cors())
app.use(express.static(path.join(__dirname, 'dist')))

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(ROOT, 'data', 'uploads')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => cb(null, file.originalname),
})
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } })

app.get('/api/results', (req, res) => {
  const p = path.join(ROOT, 'output', 'results.json')
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'results.json not found' })
  res.sendFile(p)
})

app.post('/api/upload',
  (req, res, next) => {
    // Clear stale files from previous uploads so file-type detection is always clean
    const dir = path.join(ROOT, 'data', 'uploads')
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    next()
  },
  upload.array('files'),
  (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const fileCount = req.files?.length || 0
  send('stage', { id: 'uploaded', message: `${fileCount} file${fileCount !== 1 ? 's' : ''} received — starting agents` })

  // Timed stage fallbacks so UI always progresses (real stdout triggers these too)
  const STAGE_SCHEDULE = [
    { delay:  1500, id: 'billing',   message: 'Billing Agent: scanning claims anomalies...' },
    { delay:  4000, id: 'collusion', message: 'Collusion Agent: mapping provider networks...' },
    { delay:  6000, id: 'patient',   message: 'Patient Agent: analyzing patient patterns...' },
    { delay:  8000, id: 'temporal',  message: 'Temporal Agent: detecting time sequences...' },
    { delay: 10000, id: 'synthesis', message: 'Synthesis Agent: building case files...' },
  ]
  const timers = STAGE_SCHEDULE.map(s => setTimeout(() => send('stage', { id: s.id, message: s.message }), s.delay))

  // Also detect stages from real jac stdout if it produces output
  const seen = new Set()
  const parseOutput = (text) => {
    const map = [
      { re: /\[billing\]/i,   id: 'billing',   message: 'Billing Agent: scanning claims anomalies...' },
      { re: /\[collusion\]/i, id: 'collusion', message: 'Collusion Agent: mapping provider networks...' },
      { re: /\[patient\]/i,   id: 'patient',   message: 'Patient Agent: analyzing patient patterns...' },
      { re: /\[temporal\]/i,  id: 'temporal',  message: 'Temporal Agent: detecting time sequences...' },
      { re: /\[synthesis\]/i, id: 'synthesis', message: 'Synthesis Agent: building case files...' },
    ]
    for (const s of map) {
      if (!seen.has(s.id) && s.re.test(text)) {
        seen.add(s.id)
        send('stage', { id: s.id, message: s.message })
      }
    }
  }

  const finish = (code) => {
    timers.forEach(t => clearTimeout(t))
    if (res.writableEnded) return
    if (code !== 0) {
      send('error', { message: code === -1 ? 'Agent process timed out.' : `Agent process failed (code ${code}). Check that all required CSV files were uploaded.` })
      res.end()
      return
    }
    const resultsPath = path.join(ROOT, 'output', 'results.json')
    if (fs.existsSync(resultsPath)) {
      try {
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
        send('done', { results })
      } catch {
        send('error', { message: 'Failed to read results.json.' })
      }
    } else {
      send('error', { message: 'No results.json found after synthesis.' })
    }
    res.end()
  }

  const uploadDir = path.join(ROOT, 'data', 'uploads')

  // Run synthesis on the actual uploaded files
  const proc = spawn('python3', ['-u', 'src/api/export_results.py', '--upload_dir', uploadDir], {
    cwd: ROOT,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  })

  proc.stdout.on('data', (chunk) => parseOutput(chunk.toString()))
  proc.stderr.on('data', (chunk) => parseOutput(chunk.toString()))
  proc.on('close', finish)

  // Hard timeout: 300s — real data uploads legitimately take 3-5 minutes
  const hardTimeout = setTimeout(() => { proc.kill(); finish(-1) }, 300000)
  proc.on('close', () => clearTimeout(hardTimeout))

  req.on('close', () => { proc.kill(); timers.forEach(t => clearTimeout(t)); clearTimeout(hardTimeout) })
  }
)

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post('/api/chat', express.json({ limit: '2mb' }), async (req, res) => {
  const { message, context = {}, history = [] } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message required' })
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY not configured. Set it in your environment and restart the server.' })
  }

  // Build system prompt from context
  const { page, provider, meta } = context
  let systemContent = `You are Sentinel's AI investigation assistant helping healthcare fraud investigators. You have access to case file data from Sentinel's multi-agent fraud detection analysis of Medicare claims.

Be specific — always reference actual IDs (provider IDs, physician IDs, patient IDs), dollar amounts, and ratios from the case data provided. Never be vague.

When recommending investigative actions, specify:
- Which records to subpoena (claims, physician records, provider billing records)
- Which people to interview (physicians, provider staff, patients)
- Which agencies to report to: CMS Office of Inspector General (OIG), state Medicaid Fraud Control Unit (MFCU), FBI Healthcare Fraud Unit
- Specific case numbers, dollar thresholds, and timeline windows

When drafting referrals or summaries, use proper investigation report language. Keep responses concise and actionable — investigators are busy.`

  if (page === 'investigation' && provider) {
    const cf = provider
    const signals = Object.entries(cf.agent_signals || {}).filter(([,v]) => v).map(([k]) => k).join(', ')
    systemContent += `\n\nCURRENT CASE FILE:\nProvider: ${cf.provider_id}\nRisk Level: ${cf.overall_risk_level}\nEstimated Fraud: $${(cf.estimated_fraud_amount || 0).toLocaleString()}\nTotal Claims: ${cf.total_claims}\nTotal Billed: $${(cf.total_amount || 0).toLocaleString()}\nAgent Signals: ${signals}\n\nBilling Findings:\n${(cf.billing_findings || []).join('\n')}\n\nCollusion Findings:\n${(cf.collusion_findings || []).join('\n')}\n\nPatient Findings:\n${(cf.patient_findings || []).slice(0, 8).join('\n')}\n\nTemporal Findings:\n${(cf.temporal_findings || []).join('\n')}\n\nReasoning: ${cf.combined_reasoning || ''}\nRecommended Action: ${cf.recommended_action || ''}`
  } else if (page === 'command' && meta) {
    systemContent += `\n\nCURRENT INVESTIGATION SUMMARY:\nProviders Scanned: ${meta.provider_count}\nCase Files: ${meta.case_count}\nHIGH Risk: ${meta.high_risk_count}\nMEDIUM Risk: ${meta.medium_risk_count}\nEstimated Total Fraud: $${(meta.estimated_fraud_total || 0).toLocaleString()}\nCollusion Rings: ${meta.collusion_rings}\nTemporal Anomalies: ${meta.temporal_anomalies}`
  } else if (page === 'validation') {
    systemContent += `\n\nCONTEXT: User is viewing the Validation tab which shows precision/recall metrics comparing Sentinel's agent-flagged HIGH risk providers against confirmed CMS fraud labels.`
  }

  // Build message array
  const messages = [
    { role: 'system', content: systemContent },
    ...history.slice(-12).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  // Stream response via SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      max_tokens: 600,
      temperature: 0.4,
    })
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content
      if (token) send('token', { text: token })
    }
    send('done', {})
  } catch (err) {
    send('error', { message: err.message || 'OpenAI request failed' })
  }
  res.end()
})

// SPA fallback (Express 5 requires named wildcard)
app.get('/{*path}', (req, res) => {
  const index = path.join(__dirname, 'dist', 'index.html')
  if (fs.existsSync(index)) res.sendFile(index)
  else res.status(404).send('Run `npm run build` first.')
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`Sentinel server → http://localhost:${PORT}`))
