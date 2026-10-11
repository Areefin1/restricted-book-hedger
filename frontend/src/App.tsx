import { useState, type ReactNode } from 'react'
import { api } from './api/client'
import type { SimulationRequest, SimulationResponse } from './api/types'
import { SimulationForm } from './components/SimulationForm'
import { HedgeChat } from './features/chat/HedgeChat'
import { ErrorState, Loading } from './components/ui'
import { AssumptionsTab } from './features/assumptions/AssumptionsTab'
import { RecommendationTab } from './features/recommendation/RecommendationTab'
import { ResearchTab } from './features/research/ResearchTab'
import { MechanicsTab } from './features/simulator/MechanicsTab'
import { RiskTab } from './features/simulator/RiskTab'
import { SetupSentence } from './features/simulator/SetupSentence'
import { SimulatorTab } from './features/simulator/SimulatorTab'
import { DEFAULT_FORM, validateForm, type SimForm } from './features/simulator/formModel'
import { fmtDate } from './format'
import { useHashRoute } from './hooks/useHashRoute'
import { useDebounced, useResource } from './hooks/useResource'

const ROUTES = ['simulator', 'risk', 'strategies', 'research', 'recommendation', 'assumptions'] as const
type Route = (typeof ROUTES)[number]

const PAGES: Record<Route, { nav: string; title: string; subtitle: string }> = {
  simulator: {
    nav: 'Overview',
    title: 'Hedge simulator',
    subtitle: 'Compare an unhedged HYG-proxy book against static short and SJB hedges over a historical window.',
  },
  risk: {
    nav: 'Risk analysis',
    title: 'Risk analysis',
    subtitle: 'Drawdown, volatility, and cost detail for the current simulation.',
  },
  strategies: {
    nav: 'Hedge mechanics',
    title: 'Static short vs. daily-reset inverse ETF',
    subtitle: 'Why SJB does not deliver exactly −1x of HYG over multi-day periods.',
  },
  research: {
    nav: 'Research',
    title: 'Research',
    subtitle: 'Daily sanity check and rolling-window convexity across the full history.',
  },
  recommendation: {
    nav: 'Recommendation',
    title: 'Hedge ratio search',
    subtitle: 'In-sample historical search against a single stated objective.',
  },
  assumptions: {
    nav: 'Assumptions',
    title: 'Methodology and assumptions',
    subtitle: 'Data provenance, accounting conventions, and known limitations.',
  },
}

interface SimResult {
  req: SimulationRequest
  res: SimulationResponse
}

export default function App() {
  const [route, navigate] = useHashRoute(ROUTES, 'simulator')
  const [form, setForm] = useState<SimForm>(DEFAULT_FORM)

  const meta = useResource('metadata', () => api.getMetadata())
  const scenarios = useResource('scenarios', () => api.getScenarios())
  const synthetic = meta.data?.is_synthetic ?? api.mode === 'mock'
  const dataLabel = meta.data ? (synthetic ? 'Synthetic data' : meta.data.verified ? 'Verified cache' : 'Unverified cache') : 'Connecting to data'

  const { request, errors } = validateForm(form, meta.data)
  // Search chooses its own ratio; a currently infeasible simulation ratio must
  // not prevent it from searching feasible ratios under the capacity limit.
  const searchValidation = validateForm({ ...form, hedgeRatio: '0' }, meta.data)
  const { hedge_ratio: _ratio, start_date: _start, end_date: _end, annual_borrow_rate: _borrow, ...modelingOptions } = searchValidation.request ?? {} as Partial<SimulationRequest>
  void _ratio; void _start; void _end; void _borrow
  const simKey = useDebounced(request ? JSON.stringify(request) : null, 250)
  const sim = useResource<SimResult>(simKey, async () => {
    const req = JSON.parse(simKey as string) as SimulationRequest
    return { req, res: await api.runSimulation(req) }
  })

  const page = PAGES[route]
  const usesSimulation = route === 'simulator' || route === 'risk' || route === 'strategies'
  const hasErrors = Object.keys(errors).length > 0
  const updating = sim.loading || (request !== null && simKey !== JSON.stringify(request))

  const go = (r: Route) => navigate(r)

  function renderSimulation(render: (r: SimResult) => ReactNode) {
    if (!sim.data) {
      if (sim.error) return <ErrorState message={sim.error} onRetry={sim.retry} />
      if (hasErrors) return <ErrorState message="Fix the highlighted inputs to run the simulation." />
      return <Loading label="Running simulation…" />
    }
    return (
      <>
        {sim.error && !updating && <ErrorState message={sim.error} onRetry={sim.retry} />}
        <div className={sim.stale || updating || hasErrors ? 'is-stale' : ''}>{render(sim.data)}</div>
      </>
    )
  }

  let body: ReactNode
  switch (route) {
    case 'simulator':
      body = renderSimulation(({ req, res }) => <SimulatorTab req={req} res={res} />)
      break
    case 'risk':
      body = renderSimulation(({ req, res }) => <RiskTab req={req} res={res} />)
      break
    case 'strategies':
      body = renderSimulation(({ req, res }) => <MechanicsTab req={req} res={res} />)
      break
    case 'research':
      body = <ResearchTab />
      break
    case 'recommendation':
      body = (
        <RecommendationTab
          modelingOptions={modelingOptions}
          startDate={form.startDate}
          endDate={form.endDate}
          annualBorrowRate={searchValidation.request?.annual_borrow_rate ?? 0}
          datesValid={searchValidation.request !== null}
          onApply={(ratio) => {
            setForm((f) => ({ ...f, hedgeRatio: String(ratio) }))
            go('simulator')
          }}
        />
      )
      break
    case 'assumptions':
      body = <AssumptionsTab meta={meta.data} assumptions={sim.data?.res.assumptions} apiMode={api.mode} />
      break
  }

  const runStatus = updating ? 'Updating…' : hasErrors ? 'Inputs need attention' : sim.error ? 'Request failed' : sim.data ? 'Results current' : 'Connecting'

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href="#/simulator">
            <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
              <rect x="1" y="1" width="30" height="30" rx="7" fill="#11283a" stroke="#1f4a5a" />
              <path d="M8 21l5-6 4 3 7-8" fill="none" stroke="#2ccfb1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 11h6" stroke="#5aa9f8" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            Restricted Book Hedger
          </a>
          <nav className="site-nav" aria-label="Primary">
            {ROUTES.map((r) => (
              <a key={r} href={`#/${r}`} className={route === r ? 'active' : ''} aria-current={route === r ? 'page' : undefined}>
                {PAGES[r].nav}
              </a>
            ))}
          </nav>
          <div className={`data-status ${synthetic || !meta.data?.verified ? 'warn' : ''}`} title={meta.data?.data_version}>
            <span className="dot" aria-hidden="true" />
            <span>{dataLabel}</span>
            {meta.data && <span>· {meta.data.first_date.slice(0, 4)}–{meta.data.last_date.slice(0, 4)}</span>}
          </div>
        </div>
      </header>

      <main className="content" id="content">
        <div className="page-head">
          <h1>{page.title}</h1>
          <p>{page.subtitle}</p>
        </div>
        {meta.error && <ErrorState message={`Metadata: ${meta.error}`} onRetry={meta.retry} />}
        {scenarios.error && <ErrorState message={`Scenarios: ${scenarios.error}`} onRetry={scenarios.retry} />}
        {usesSimulation && (
          <SetupSentence
            form={form}
            errors={errors}
            onChange={setForm}
            scenarios={scenarios.data}
            meta={meta.data}
            status={
              <>
                {sim.data && (
                  <p className="effective" title={`Data ${sim.data.res.data_version}`}>
                    {fmtDate(sim.data.res.effective_start_date)} – {fmtDate(sim.data.res.effective_end_date)} · {sim.data.res.paths.length} trading days
                    {hasErrors && <span className="warn-text"> · showing last valid inputs</span>}
                  </p>
                )}
                <span className={`status ${updating ? 'busy' : hasErrors ? 'warn' : 'ok'}`} role="status">
                  <span className="dot" aria-hidden="true" />
                  {runStatus}
                </span>
              </>
            }
          />
        )}
        {route === 'recommendation' && (
          <section className="controls panel">
            <SimulationForm
              form={form}
              errors={searchValidation.errors}
              onChange={setForm}
              scenarios={scenarios.data}
              meta={meta.data}
              fields={{ book: true, borrow: true }}
            />
          </section>
        )}

        {body}

        <footer className="disclaimer">
          <strong>{synthetic ? 'Illustrative analysis on synthetic data.' : 'Historical analysis using cached adjusted prices.'}</strong>{' '}
          {synthetic ? 'The dataset is simulated and does not contain actual HYG or SJB prices. ' : 'HYG is a proxy for the restricted book; costs and financing are simplified. '}
          Past performance, real or simulated, does not
          indicate future results. Nothing here is investment advice or a recommendation to trade any security.
        </footer>
      </main>
      <HedgeChat
        req={sim.data?.req}
        dataVersion={sim.data?.res.data_version}
        disabledReason={api.mode === 'mock' ? 'AI chat is unavailable in synthetic mock mode.'
          : hasErrors ? 'Fix the highlighted simulation inputs to continue.'
          : sim.error ? 'Refresh the simulation before continuing.'
          : updating || sim.stale || !sim.data ? 'Waiting for the current simulation…' : ''}
      />
    </div>
  )
}
