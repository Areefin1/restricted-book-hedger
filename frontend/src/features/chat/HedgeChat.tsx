import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { ChatMessage, ChatView, SimulationRequest } from '../../api/types'
import { useChatView } from './chatView'
import './chat.css'

function Spark({ animated = false }: { animated?: boolean }) {
  const id = useId().replace(/:/g, '')
  const shape = 'M20 2C22.5 12.8 27.2 17.5 38 20C27.2 22.5 22.5 27.2 20 38C17.5 27.2 12.8 22.5 2 20C12.8 17.5 17.5 12.8 20 2Z'
  return (
    <svg className={`chat-spark ${animated ? 'chat-spark-active' : ''}`} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        {([['red', '50%', '0%', '#f45b5b'], ['yellow', '0%', '50%', '#fbbc05'], ['green', '50%', '100%', '#34a853']] as const).map(([name, cx, cy, color]) => (
          <radialGradient key={name} id={`${id}-${name}`} cx={cx} cy={cy} r="70%">
            <stop stopColor={color} /><stop offset="1" stopColor={color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <path d={shape} fill="#4285f4" />
      {['green', 'yellow', 'red'].map(color => <path key={color} d={shape} fill={`url(#${id}-${color})`} />)}
    </svg>
  )
}

const SUGGESTIONS = ['Explain these results', 'Why do the hedges differ?', 'What does drawdown mean?']

function Conversation({ req, dataVersion, view, disabledReason, open }: {
  req: SimulationRequest
  dataVersion: string
  view?: ChatView
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
    if (open && log.current) log.current.scrollTop = messages.length || pending || error ? log.current.scrollHeight : 0
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
      const result = await api.getExplanation({ ...req, view: view ? { ...view, data_version: dataVersion } : undefined, question, history: messages.slice(-12) })
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
        <span>{view?.page === 'research' ? `Research · ${view.window_days} trading-day windows`
          : view?.page === 'recommendation' ? `Hedge search · ${view.instrument === 'sjb' ? 'SJB' : 'Static short'} · ${view.window_days}d`
          : `${PAGE_LABELS[view?.page ?? 'simulator']} · ${(req.hedge_ratio * 100).toFixed(0)}% hedge`}</span>
        <span className="chat-scope-note">{view?.charts.some(chart => chart.x_range || chart.y_range || chart.y2_range)
          ? view.charts.filter(chart => chart.x_range || chart.y_range || chart.y2_range).map(chart => {
            const dates = ['portfolio', 'drawdown', 'exposure', 'mechanics', 'volatility'].includes(chart.chart) ? chart.x_range : undefined
            return dates ? `Visible ${chart.chart}: ${String(dates[0]).slice(0, 10)} to ${String(dates[1]).slice(0, 10)}` : `${chart.chart}: zoomed axes`
          }).join(' · ')
          : view?.page === 'research' ? 'Full CSV history · current chart settings'
          : `${req.start_date} to ${req.end_date} · full chart range`}</span>
      </div>
      <div className="chat-log" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text" ref={log}>
        {messages.length === 0 && !pending && !failed && (
          <div className="chat-welcome">
            <div className="chat-welcome-spark"><Spark /></div>
            <h3>Make sense of your hedge.</h3>
            <p>Ask about this page. I’ll use its current settings and the chart range you’re viewing.</p>
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
          <div className="chat-loading-response">
            <div className="chat-thinking" role="status"><Spark animated /><span>Thinking<span className="chat-thinking-dots">…</span></span></div>
            <div className="chat-shimmer-lines" aria-hidden="true"><i /><i /><i /></div>
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
          <label className="chat-sr-only" htmlFor="hedge-chat-question">Ask about this page</label>
          <textarea id="hedge-chat-question" ref={input} rows={2} maxLength={2000} value={draft}
            placeholder="Ask about this page…" disabled={!!disabledReason}
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
  const context = useChatView()
  const view = context?.view
  const reason = disabledReason || (context && !context.ready ? 'Waiting for the current page results…' : '')
  const launcher = useRef<HTMLButtonElement>(null)
  function close() { setOpen(false); launcher.current?.focus() }

  return (
    <div className="chat-dock" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close() } }}>
      <section id="hedge-chat" className="hedge-chat" role="dialog" aria-labelledby="hedge-chat-title" hidden={!open}>
        <header className="chat-header">
          <Spark />
          <div><h2 id="hedge-chat-title">Hedge assistant</h2><p>Powered by Gemini · grounded in your view</p></div>
          <button type="button" className="chat-minimize" onClick={close} aria-label="Minimize chat">
            <svg viewBox="0 0 20 20" width="20" height="20" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 10h10" /></svg>
          </button>
        </header>
        {req && dataVersion ? (
          <Conversation key={JSON.stringify([req, dataVersion, view])} req={req} dataVersion={dataVersion} view={view} disabledReason={reason} open={open} />
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

const PAGE_LABELS = { simulator: 'Overview', risk: 'Risk analysis', strategies: 'Hedge mechanics', research: 'Research', recommendation: 'Hedge search', assumptions: 'Assumptions' }
