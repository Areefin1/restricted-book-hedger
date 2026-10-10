import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { ChatMessage, SimulationRequest } from '../api/types'

function Spark({ animated = false }: { animated?: boolean }) {
  return (
    <svg className={`chat-spark ${animated ? 'chat-spark-active' : ''}`} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M20 5v8" transform={`rotate(${i * 30} 20 20)`} stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" />
      ))}
    </svg>
  )
}

const SUGGESTIONS = ['Explain these results', 'Why do the hedges differ?', 'What does drawdown mean?']

function Conversation({ req, dataVersion, disabledReason, open }: {
  req: SimulationRequest
  dataVersion: string
  disabledReason: string
  open: boolean
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState('')
  const [failed, setFailed] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)
  // Covers rapid submissions before React commits the disabled button.
  const inFlight = useRef(false)

  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages, pending, error, open])

  async function send(rawQuestion: string) {
    const question = rawQuestion.trim()
    if (!question || inFlight.current || disabledReason) return
    inFlight.current = true
    setPending(question)
    setDraft('')
    setFailed('')
    setError('')
    try {
      const result = await api.getExplanation({ ...req, question, history: messages.slice(-12) })
      if (result.data_version !== dataVersion) {
        throw new Error('The dataset changed. Refresh the simulation and try again.')
      }
      setMessages(previous => [...previous,
        { role: 'user', content: question },
        { role: 'assistant', content: result.explanation },
      ])
    } catch (err) {
      setFailed(question)
      setError(err instanceof Error ? err.message : 'Could not generate an answer.')
    } finally {
      inFlight.current = false
      setPending('')
      input.current?.focus({ preventScroll: true })
    }
  }

  return (
    <>
      <div className="chat-scope">
        <span className="chat-scope-dot" />
        <span>{req.start_date} to {req.end_date} · {(req.hedge_ratio * 100).toFixed(0)}% hedge</span>
        <span className="chat-scope-note">Full simulation · chart zoom is not included</span>
      </div>
      <div className="chat-log" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text" ref={log}>
        {messages.length === 0 && !pending && !failed && (
          <div className="chat-welcome">
            <div className="chat-welcome-spark"><Spark /></div>
            <h3>Make sense of your hedge.</h3>
            <p>Explore the results, compare strategies, or ask about the assumptions behind the numbers.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map(question => (
                <button type="button" key={question} disabled={!!disabledReason} onClick={() => void send(question)}>
                  {question}<span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div className={`chat-message chat-message-${message.role}`} key={index}>
            <span className="chat-message-author">{message.role === 'user' ? 'You' : 'Hedge assistant'}</span>
            <div className="chat-message-text">{message.content}</div>
          </div>
        ))}
        {(pending || failed) && (
          <div className="chat-message chat-message-user">
            <span className="chat-message-author">You</span>
            <div className="chat-message-text">{pending || failed}</div>
          </div>
        )}
        {pending && (
          <div className="chat-thinking" role="status">
            <Spark animated /><span>Thinking<span className="chat-thinking-dots">…</span></span>
          </div>
        )}
        {error && (
          <div className="chat-error">
            <p role="alert">{error}</p>
            <button type="button" className="btn" disabled={!!disabledReason} onClick={() => void send(failed)}>Try again</button>
          </div>
        )}
      </div>
      <form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(draft) }}>
        {disabledReason && <p className="chat-disabled" role="status">{disabledReason}</p>}
        <div className="chat-input-wrap">
          <label className="chat-sr-only" htmlFor="hedge-chat-question">Ask about your simulation</label>
          <textarea id="hedge-chat-question" ref={input} rows={2} maxLength={2000} value={draft}
            placeholder="Ask about your simulation…" disabled={!!disabledReason}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void send(draft)
              }
            }} />
          <button className="chat-send" type="submit" aria-label="Send message" disabled={!!pending || !!disabledReason || !draft.trim()}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          </button>
        </div>
        <div className="chat-composer-foot">
          <span>AI can make mistakes. Check the figures.</span>
          <button type="button" disabled={!!pending || (!messages.length && !failed)} onClick={() => {
            setMessages([]); setFailed(''); setError(''); setDraft(''); input.current?.focus()
          }}>Clear chat</button>
        </div>
      </form>
    </>
  )
}

export function HedgeChat({ req, dataVersion, disabledReason }: {
  req?: SimulationRequest
  dataVersion?: string
  disabledReason: string
}) {
  const [open, setOpen] = useState(false)
  const launcher = useRef<HTMLButtonElement>(null)
  function close() { setOpen(false); launcher.current?.focus() }

  return (
    <div className="chat-dock" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close() } }}>
      <section id="hedge-chat" className="hedge-chat" role="dialog" aria-labelledby="hedge-chat-title" hidden={!open}>
        <header className="chat-header">
          <Spark />
          <div><h2 id="hedge-chat-title">Hedge assistant</h2><p>Questions meet calculations.</p></div>
          <button type="button" className="chat-minimize" onClick={close} aria-label="Minimize chat">
            <svg viewBox="0 0 20 20" width="20" height="20" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 10h10" /></svg>
          </button>
        </header>
        {req && dataVersion ? (
          <Conversation key={JSON.stringify([req, dataVersion])} req={req} dataVersion={dataVersion} disabledReason={disabledReason} open={open} />
        ) : <p className="chat-empty" role="status">{disabledReason || 'Run a simulation to start chatting.'}</p>}
      </section>
      <button type="button" className={`chat-launcher ${open ? 'chat-launcher-open' : ''}`} ref={launcher}
        aria-label={open ? 'Minimize assistant chat' : 'Open assistant chat'} aria-expanded={open} aria-controls="hedge-chat"
        onClick={() => open ? close() : setOpen(true)}>
        <Spark /><span>Ask about results</span>
      </button>
    </div>
  )
}
