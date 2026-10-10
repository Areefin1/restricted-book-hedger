import { useState, type ReactNode } from 'react'
import { api } from './api/client'
import type { SimulationRequest, SimulationResponse } from './api/types'
import { SimulationForm } from './components/SimulationForm'
import { HedgeChat } from './components/HedgeChat'
import { Badge, ErrorState, Loading } from './components/ui'
import { AssumptionsTab } from './features/assumptions/AssumptionsTab'
import { RecommendationTab } from './features/recommendation/RecommendationTab'
import { ResearchTab } from './features/research/ResearchTab'
import { MechanicsTab } from './features/simulator/MechanicsTab'
import { RiskTab } from './features/simulator/RiskTab'
import { SimulatorTab } from './features/simulator/SimulatorTab'
import { DEFAULT_FORM, validateForm, type SimForm } from './features/simulator/formModel'
import { fmtDate } from './format'
import { useHashRoute } from './hooks/useHashRoute'
import { useDebounced, useResource } from './hooks/useResource'

const ROUTES = ['simulator', 'risk', 'strategies', 'research', 'recommendation', 'assumptions'] as const
type Route = (typeof ROUTES)[number]

const ICONS: Record<Route, ReactNode> = {
  simulator: <path d="M3 17l5-6 4 3 6-8M3 21h18" />,
  risk: <path d="M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7l8-4zM12 8v5M12 16v.5" />,
  strategies: <path d="M4 7h10M4 17h16M17 4l3 3-3 3M7 14l-3 3 3 3" />,
  research: <path d="M5 19a1 1 0 100-2 1 1 0 000 2zM10 13a1 1 0 100-2 1 1 0 000 2zM15 15a1 1 0 100-2 1 1 0 000 2zM19 8a1 1 0 100-2 1 1 0 000 2zM3 21h18M3 3v18" />,
  recommendation: <path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5M12 9a3 3 0 110 6 3 3 0 010-6z" />,
  assumptions: <path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7" />,
}

const PAGES: Record<Route, { nav: string; title: string; subtitle: string; group: 'Analysis' | 'Research' | 'Reference' }> = {
  simulator: {
    nav: 'Overview',
    title: 'Hedge simulator',
    subtitle: 'Compare an unhedged HYG-proxy book against static short and SJB hedges over a historical window.',
    group: 'Analysis',
  },
  risk: {
    nav: 'Risk analysis',
    title: 'Risk analysis',
    subtitle: 'Drawdown, volatility, and cost detail for the current simulation.',
    group: 'Analysis',
  },
  strategies: {
    nav: 'Hedge mechanics',
    title: 'Static short vs. daily-reset inverse ETF',
    subtitle: 'Why SJB does not deliver exactly −1x of HYG over multi-day periods.',
    group: 'Analysis',
  },
  research: {
    nav: 'Research',
    title: 'Research',
    subtitle: 'Daily sanity check and rolling-window convexity across the full history.',
    group: 'Research',
  },
  recommendation: {
    nav: 'Recommendation',
    title: 'Hedge ratio search',
    subtitle: 'In-sample historical search against a single stated objective.',
    group: 'Research',
  },
  assumptions: {
    nav: 'Assumptions',
    title: 'Methodology and assumptions',
    subtitle: 'Data provenance, accounting conventions, and known limitations.',
    group: 'Reference',
  },
}

const GROUPS = ['Analysis', 'Research', 'Reference'] as const

function Icon({ route }: { route: Route }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[route]}
    </svg>
  )
}

interface SimResult {
  req: SimulationRequest
  res: SimulationResponse
}

export default function App() {
  const [route, navigate] = useHashRoute(ROUTES, 'simulator')
  const [navOpen, setNavOpen] = useState(false)
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
  const showControls = usesSimulation || route === 'recommendation'
  const hasErrors = Object.keys(errors).length > 0
  const updating = sim.loading || (request !== null && simKey !== JSON.stringify(request))

  const go = (r: Route) => {
    navigate(r)
    setNavOpen(false)
  }

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

  return (
    <div className={`app ${navOpen ? 'nav-open' : ''}`}>
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <rect x="1" y="1" width="30" height="30" rx="7" fill="#11283a" stroke="#1f4a5a" />
            <path d="M8 21l5-6 4 3 7-8" fill="none" stroke="#2ccfb1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 11h6" stroke="#5aa9f8" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <div>
            <span className="brand-name">Restricted Book Hedger</span>
            <span className="brand-sub">Hedge analytics prototype</span>
          </div>
        </div>
        <nav>
          {GROUPS.map((g) => (
            <div key={g} className="nav-group">
              <span className="nav-group-label">{g}</span>
              <ul>
                {ROUTES.filter((r) => PAGES[r].group === g).map((r) => (
                  <li key={r}>
                    <a
                      href={`#/${r}`}
                      className={route === r ? 'active' : ''}
                      aria-current={route === r ? 'page' : undefined}
                      onClick={() => setNavOpen(false)}
                    >
                      <Icon route={r} />
                      {PAGES[r].nav}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Badge tone={synthetic ? 'warn' : 'accent'}>{dataLabel}</Badge>
          <span title={meta.data?.data_version}>{meta.data ? `${meta.data.first_date.slice(0, 4)}–${meta.data.last_date.slice(0, 4)} · ${meta.data.data_version.slice(0, 19)}` : '—'}</span>
        </div>
      </aside>
      <button type="button" className="scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} tabIndex={navOpen ? 0 : -1} />

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="menu-btn"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className="topbar-title">
            <h1>{page.title}</h1>
            <p>{page.subtitle}</p>
          </div>
          <div className="topbar-status">
            {usesSimulation && (
              <span className={`status ${updating ? 'busy' : hasErrors ? 'warn' : 'ok'}`} role="status">
                <span className="dot" aria-hidden="true" />
                {updating ? 'Updating…' : hasErrors ? 'Inputs need attention' : sim.error ? 'Request failed' : sim.data ? 'Results current' : 'Connecting'}
              </span>
            )}
            <Badge tone={synthetic || !meta.data?.verified ? 'warn' : 'accent'}>{synthetic ? 'Illustrative · not market data' : dataLabel}</Badge>
          </div>
        </header>

        <main className="content" id="content">
          {meta.error && <ErrorState message={`Metadata: ${meta.error}`} onRetry={meta.retry} />}
          {scenarios.error && <ErrorState message={`Scenarios: ${scenarios.error}`} onRetry={scenarios.retry} />}
          {showControls && (
            <section className="controls panel">
              <SimulationForm
                form={form}
                errors={route === 'recommendation' ? searchValidation.errors : errors}
                onChange={setForm}
                scenarios={scenarios.data}
                meta={meta.data}
                fields={route === 'recommendation' ? { book: true, borrow: true } : undefined}
              />
              {usesSimulation && sim.data && (
                <p className="effective">
                  Effective range {fmtDate(sim.data.res.effective_start_date)} – {fmtDate(sim.data.res.effective_end_date)} ·{' '}
                  {sim.data.res.paths.length} trading days · data {sim.data.res.data_version}
                  {hasErrors && <span className="warn-text"> · showing last valid inputs</span>}
                </p>
              )}
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
      </div>
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
