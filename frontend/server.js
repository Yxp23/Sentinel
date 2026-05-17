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

app.post('/api/upload', upload.array('files'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  const fileCount = req.files?.length || 0
  send('stage', { id: 'uploaded', message: `${fileCount} file${fileCount !== 1 ? 's' : ''} received — starting agents` })

  const proc = spawn('python3', ['src/api/export_results.py'], {
    cwd: ROOT,
    env: { ...process.env },
  })

  const STAGES = [
    { re: /billing/i,   id: 'billing',   message: 'Billing Agent: scanning claims anomalies...' },
    { re: /collusion/i, id: 'collusion', message: 'Collusion Agent: mapping provider networks...' },
    { re: /patient/i,   id: 'patient',   message: 'Patient Agent: analyzing patient patterns...' },
    { re: /temporal/i,  id: 'temporal',  message: 'Temporal Agent: detecting time sequences...' },
    { re: /synthesis/i, id: 'synthesis', message: 'Synthesis Agent: building case files...' },
  ]
  const seen = new Set()

  const parseOutput = (text) => {
    for (const s of STAGES) {
      if (!seen.has(s.id) && s.re.test(text)) {
        seen.add(s.id)
        send('stage', { id: s.id, message: s.message })
      }
    }
  }

  proc.stdout.on('data', (chunk) => parseOutput(chunk.toString()))
  proc.stderr.on('data', (chunk) => parseOutput(chunk.toString()))

  proc.on('close', (code) => {
    if (code === 0) {
      const resultsPath = path.join(ROOT, 'output', 'results.json')
      try {
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
        send('done', { results })
      } catch {
        send('error', { message: 'Failed to read results after synthesis.' })
      }
    } else {
      send('error', { message: `Agent process exited with code ${code}. Check server logs.` })
    }
    res.end()
  })

  req.on('close', () => proc.kill())
})

// SPA fallback (Express 5 requires named wildcard)
app.get('/{*path}', (req, res) => {
  const index = path.join(__dirname, 'dist', 'index.html')
  if (fs.existsSync(index)) res.sendFile(index)
  else res.status(404).send('Run `npm run build` first.')
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Sentinel server → http://localhost:${PORT}`))
