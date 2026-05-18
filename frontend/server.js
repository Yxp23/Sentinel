import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

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
    const resultsPath = path.join(ROOT, 'output', 'results.json')
    if (fs.existsSync(resultsPath)) {
      try {
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
        send('done', { results })
      } catch {
        send('error', { message: 'Failed to read results.json.' })
      }
    } else {
      send('error', { message: code === 0 ? 'No results.json found after synthesis.' : `Agent process failed (code ${code}). Ensure API keys are configured.` })
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

  // Hard timeout: 45s safety net
  const hardTimeout = setTimeout(() => { proc.kill(); finish(-1) }, 45000)
  proc.on('close', () => clearTimeout(hardTimeout))

  req.on('close', () => { proc.kill(); timers.forEach(t => clearTimeout(t)); clearTimeout(hardTimeout) })
  }
)

// SPA fallback (Express 5 requires named wildcard)
app.get('/{*path}', (req, res) => {
  const index = path.join(__dirname, 'dist', 'index.html')
  if (fs.existsSync(index)) res.sendFile(index)
  else res.status(404).send('Run `npm run build` first.')
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Sentinel server → http://localhost:${PORT}`))
