import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const SF   = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
const MONO = 'JetBrains Mono, monospace'

const QUICK_ACTIONS = {
  investigation: [
    { label: 'Summarize findings', msg: 'Summarize the key fraud findings for this provider in a few sentences.' },
    { label: 'Draft referral', msg: 'Draft a formal OIG referral for this case with the key evidence points.' },
    { label: 'Next steps', msg: 'What are the specific next investigative steps for this case?' },
    { label: 'Subpoena targets', msg: 'Which records should we subpoena and from whom?' },
  ],
  command: [
    { label: 'Priority cases', msg: 'Which cases should investigators prioritize first and why?' },
    { label: 'Collusion rings', msg: 'Describe the collusion rings detected and how to investigate them.' },
    { label: 'Estimated losses', msg: 'Break down the estimated fraud amounts across HIGH risk providers.' },
    { label: 'Report to CMS', msg: 'Draft a summary memo to CMS OIG about the findings from this investigation.' },
  ],
  validation: [
    { label: 'Explain precision', msg: 'Explain what the precision score means for our investigation workload.' },
    { label: 'Improve recall', msg: 'How could the agents be tuned to catch more of the missed fraud cases?' },
    { label: 'False positives', msg: 'Analyze the false positive cases — why might they have been flagged incorrectly?' },
  ],
}

const OPENING_MESSAGES = {
  investigation: (prov) => prov
    ? `I've loaded the case file for provider **${prov.provider_id}** — ${prov.overall_risk_level} risk, $${(prov.estimated_fraud_amount || 0).toLocaleString()} estimated fraud. What would you like to investigate?`
    : `Case file loaded. Ask me anything about this provider's fraud signals, or use a quick action below.`,
  command: (meta) => meta
    ? `I can see ${meta.high_risk_count} HIGH risk providers across ${meta.provider_count} scanned — $${(meta.estimated_fraud_total || 0).toLocaleString()} estimated total fraud. How can I help?`
    : `Command Center loaded. Ask me about the overall investigation findings.`,
  validation: () => `Validation metrics loaded. I can explain precision/recall trade-offs, missed cases, or help you interpret the agent performance.`,
  default: () => `Sentinel Investigation Assistant ready. Ask me about fraud findings, case summaries, or investigative next steps.`,
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '12px 16px' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }}
        />
      ))}
    </div>
  )
}

function renderSimpleMarkdown(text) {
  if (!text) return text
  return text.split('\n').map((line, i) => {
    // Headers
    if (line.startsWith('### ')) return <div key={i} style={{ fontWeight: 700, fontSize: 13, color: 'var(--amber)', marginTop: 8, marginBottom: 2 }}>{line.slice(4)}</div>
    if (line.startsWith('## ')) return <div key={i} style={{ fontWeight: 700, fontSize: 14, color: 'var(--amber)', marginTop: 10, marginBottom: 3 }}>{line.slice(3)}</div>
    // Bullet points
    if (line.startsWith('- ') || line.startsWith('• ')) {
      const content = line.slice(2)
      return <div key={i} style={{ paddingLeft: 12, position: 'relative', marginTop: 2 }}><span style={{ position: 'absolute', left: 0, color: 'var(--amber)' }}>•</span>{renderInline(content)}</div>
    }
    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s(.*)/)
    if (numMatch) return <div key={i} style={{ paddingLeft: 16, position: 'relative', marginTop: 2 }}><span style={{ position: 'absolute', left: 0, color: 'var(--amber)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{numMatch[1]}.</span>{renderInline(numMatch[2])}</div>
    // Regular line
    if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
    return <div key={i}>{renderInline(line)}</div>
  })
}

function renderInline(text) {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 10,
      }}
    >
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 8, marginTop: 2,
          background: 'var(--bg)',
          boxShadow: '3px 3px 8px var(--shadow-d), -2px -2px 6px var(--shadow-l)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13,
        }}>
          ⚖
        </div>
      )}
      <div style={{
        maxWidth: '82%',
        background: isUser
          ? 'linear-gradient(135deg, rgba(232,168,56,0.18) 0%, rgba(232,168,56,0.10) 100%)'
          : 'var(--bg)',
        borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
        padding: '10px 14px',
        boxShadow: isUser
          ? 'inset 1px 1px 3px rgba(232,168,56,0.15), 3px 3px 10px var(--shadow-d)'
          : '4px 4px 12px var(--shadow-d), -2px -2px 8px var(--shadow-l)',
        border: isUser ? '1px solid rgba(232,168,56,0.22)' : 'none',
        fontFamily: SF,
        fontSize: 13,
        lineHeight: 1.7,
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
        position: 'relative'
      }}>
        {isUser ? msg.content : renderSimpleMarkdown(msg.content)}
        {msg.time && (
          <div style={{
            fontSize: 9,
            color: 'var(--dim)',
            textAlign: isUser ? 'right' : 'left',
            marginTop: 4,
            fontFamily: MONO
          }}>
            {msg.time}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function SentinelChat({ page = 'command', provider = null, meta = null }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [hoverBtn, setHoverBtn] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const prevPageRef = useRef(page)
  const prevProvRef = useRef(provider?.provider_id)

  // Reset messages when context changes
  useEffect(() => {
    const provId = provider?.provider_id
    if (page !== prevPageRef.current || provId !== prevProvRef.current) {
      prevPageRef.current = page
      prevProvRef.current = provId
      setMessages([])
      setStreamingText('')
    }
  }, [page, provider])

  // Opening message when panel opens
  useEffect(() => {
    if (open && messages.length === 0) {
      const opener = OPENING_MESSAGES[page] || OPENING_MESSAGES.default
      const text = page === 'investigation' ? opener(provider)
                 : page === 'command' ? opener(meta)
                 : opener()
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setMessages([{ role: 'assistant', content: text, time }])
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const sendMessage = useCallback(async (text) => {
    const msg = text.trim()
    if (!msg || streaming) return
    setInput('')

    const history = messages.filter(m => m.role !== 'system')
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { role: 'user', content: msg, time }
    setMessages(prev => [...prev, userMsg])
    setStreaming(true)
    setStreamingText('')

    const ctx = { page }
    if (page === 'investigation' && provider) ctx.provider = provider
    if (page === 'command' && meta) ctx.meta = meta

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: ctx, history }),
        signal: abortRef.current?.signal,
      })

      if (!resp.ok) {
        let errMsg = `Server error (${resp.status})`
        if (resp.status === 404) errMsg = 'Chat endpoint not found — restart the server.'
        else if (resp.status === 503) errMsg = 'OPENAI_API_KEY not set — add it to your environment and restart the server.'
        else {
          const body = await resp.json().catch(() => null)
          if (body?.error) errMsg = body.error
        }
        const errTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${errMsg}`, time: errTime }])
        setStreaming(false)
        return
      }

      const reader = resp.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop()
        for (const part of parts) {
          const lines = part.split('\n')
          let evtName = '', evtData = ''
          for (const l of lines) {
            if (l.startsWith('event: ')) evtName = l.slice(7).trim()
            if (l.startsWith('data: ')) evtData = l.slice(6).trim()
          }
          if (evtName === 'token') {
            try {
              const { text: tok } = JSON.parse(evtData)
              accumulated += tok
              setStreamingText(accumulated)
            } catch {}
          } else if (evtName === 'done') {
            const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            setMessages(prev => [...prev, { role: 'assistant', content: accumulated, time: botTime }])
            setStreamingText('')
            setStreaming(false)
          } else if (evtName === 'error') {
            try {
              const { message: errMsg } = JSON.parse(evtData)
              const errTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${errMsg}`, time: errTime }])
            } catch {}
            setStreamingText('')
            setStreaming(false)
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        const errTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Connection failed. Check server.', time: errTime }])
      }
      setStreamingText('')
      setStreaming(false)
    }
  }, [messages, streaming, page, provider, meta])

  const quickActions = QUICK_ACTIONS[page] || []

  return (
    <>
      {/* Floating chat button */}
      <motion.button
        onMouseEnter={() => setHoverBtn(true)}
        onMouseLeave={() => setHoverBtn(false)}
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.92 }}
        style={{
          position: 'fixed',
          bottom: open ? 'calc(100vh - 64px)' : 86,
          right: 28,
          zIndex: 1100,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--bg)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: hoverBtn
            ? '6px 6px 16px var(--shadow-d), -4px -4px 12px var(--shadow-l), 0 0 28px rgba(232,168,56,0.35)'
            : '6px 6px 16px var(--shadow-d), -4px -4px 12px var(--shadow-l)',
          color: open ? 'var(--amber)' : 'var(--muted)',
          fontSize: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'box-shadow 0.25s, bottom 0.0s',
        }}
      >
        {open ? '✕' : '💬'}
      </motion.button>

      {/* Slide-out panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={{ x: 440, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 440, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 420,
              zIndex: 1050,
              background: 'var(--bg)',
              boxShadow: '-12px 0 48px rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '18px 20px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              flexShrink: 0,
              background: 'var(--bg)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--bg)',
                  boxShadow: '3px 3px 10px var(--shadow-d), -2px -2px 7px var(--shadow-l)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>⚖️</div>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em' }}>
                    Sentinel Assistant
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }}
                    />
                    {page === 'investigation' && provider
                      ? `Case: ${provider.provider_id} · ${provider.overall_risk_level} risk`
                      : page === 'command' ? 'Command Center context'
                      : page === 'validation' ? 'Validation context'
                      : 'Investigation context'}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>

                  <button 
                    onClick={() => {
                      if (window.confirm('Clear conversation history?')) {
                        const opener = OPENING_MESSAGES[page] || OPENING_MESSAGES.default
                        const text = page === 'investigation' ? opener(provider) : page === 'command' ? opener(meta) : opener()
                        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        setMessages([{ role: 'assistant', content: text, time }])
                      }
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: 13, transition: 'opacity 0.2s', padding: 4 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                    title="Clear Chat"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 16px 8px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {messages.map((m, i) => <Message key={i} msg={m} />)}

              {/* Streaming bubble */}
              {streaming && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 8, marginTop: 2,
                    background: 'var(--bg)',
                    boxShadow: '3px 3px 8px var(--shadow-d), -2px -2px 6px var(--shadow-l)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                  }}>⚖</div>
                  <div style={{
                    maxWidth: '82%',
                    background: 'var(--bg)',
                    borderRadius: '4px 18px 18px 18px',
                    padding: streamingText ? '10px 14px' : '0',
                    boxShadow: '4px 4px 12px var(--shadow-d), -2px -2px 8px var(--shadow-l)',
                    fontFamily: SF, fontSize: 13, lineHeight: 1.7,
                    color: 'var(--text)', whiteSpace: 'pre-wrap',
                    minWidth: streamingText ? 40 : 0,
                  }}>
                    {streamingText || <TypingDots />}
                    {streamingText && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--amber)', marginLeft: 2, verticalAlign: 'text-bottom', borderRadius: 1 }}
                      />
                    )}
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick actions */}
            {quickActions.length > 0 && !streaming && (
              <div style={{
                padding: '8px 12px 6px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', flexWrap: 'wrap', gap: 6,
                flexShrink: 0,
              }}>
                {quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => sendMessage(qa.msg)}
                    style={{
                      fontFamily: SF, fontSize: 11, fontWeight: 500,
                      color: 'var(--muted)',
                      background: 'var(--bg)',
                      border: 'none', borderRadius: 20,
                      padding: '5px 12px', cursor: 'pointer',
                      boxShadow: '2px 2px 6px var(--shadow-d), -1px -1px 4px var(--shadow-l)',
                      transition: 'color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.target.style.color = 'var(--amber)'; e.target.style.boxShadow = '3px 3px 8px var(--shadow-d), -2px -2px 6px var(--shadow-l), 0 0 10px rgba(232,168,56,0.12)' }}
                    onMouseLeave={e => { e.target.style.color = 'var(--muted)'; e.target.style.boxShadow = '2px 2px 6px var(--shadow-d), -1px -1px 4px var(--shadow-l)' }}
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: '10px 14px 16px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              flexShrink: 0,
              display: 'flex', gap: 10, alignItems: 'flex-end',
            }}>
              <div style={{
                flex: 1,
                background: 'var(--bg)',
                borderRadius: 16,
                boxShadow: 'inset 3px 3px 8px var(--shadow-d), inset -2px -2px 6px var(--shadow-l)',
                padding: '10px 14px',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
                  }}
                  placeholder="Ask about this case…"
                  rows={1}
                  style={{
                    width: '100%', resize: 'none', background: 'transparent',
                    border: 'none', outline: 'none', color: 'var(--text)',
                    fontFamily: SF, fontSize: 13, lineHeight: 1.5,
                    maxHeight: 120, overflowY: 'auto',
                  }}
                  onInput={e => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                />
              </div>
              <motion.button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming}
                whileTap={{ scale: 0.9 }}
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: input.trim() && !streaming ? 'var(--amber)' : 'var(--bg)',
                  border: 'none', cursor: input.trim() && !streaming ? 'pointer' : 'default',
                  color: input.trim() && !streaming ? '#1a1510' : 'var(--dim)',
                  fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: input.trim() && !streaming
                    ? '4px 4px 10px var(--shadow-d), -2px -2px 8px var(--shadow-l), 0 0 16px rgba(232,168,56,0.25)'
                    : '3px 3px 8px var(--shadow-d), -2px -2px 6px var(--shadow-l)',
                  transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
                }}
              >
                ↑
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop on mobile / dim overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1040,
              background: 'rgba(0,0,0,0.25)',
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
