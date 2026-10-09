import type { Assumption, Metadata } from '../../api/types'
import { Badge, Panel } from '../../components/ui'
import { fmtDate } from '../../format'

interface Props {
  meta: Metadata | undefined
  assumptions: Assumption[] | undefined
  apiMode: 'mock' | 'http'
}

const UNITS: Assumption[] = [
  { label: 'Dates', detail: 'YYYY-MM-DD. Nontrading boundary dates resolve to the nearest trading day inside the range.' },
  { label: 'Currency', detail: 'Numeric US dollars.' },
  { label: 'Rates and ratios', detail: 'Requests use decimals: 0.02 means 2%.' },
  { label: 'Fields ending in _pct', detail: 'Percentage points: 5.0 means 5%.' },
  { label: 'Drawdown', detail: 'Shown as a nonnegative loss magnitude.' },
  { label: 'Research values', detail: 'Returns and volatility are decimals in the API; the UI converts them to percentages.' },
]

const LIMITS: Assumption[] = [
  { label: 'Proxy risk', detail: 'HYG stands in for the restricted book. A specific bond portfolio can diverge materially.' },
  { label: 'Simplified short', detail: 'A comparison of return series, not an executable short-trade ledger (no recalls, margin, or dividends owed).' },
  { label: 'Historical only', detail: 'Results describe what would have happened in a past window. They do not predict future performance.' },
  { label: 'In-sample search', detail: 'The ratio search selects and evaluates on the same history. No out-of-sample test has been run.' },
  { label: 'Provisional presets', detail: 'Scenario dates are placeholders until validated by the simulator owner.' },
]

function List({ items }: { items: Assumption[] }) {
  return (
    <dl className="assumptions">
      {items.map((a) => (
        <div key={a.label}>
          <dt>{a.label}</dt>
          <dd>{a.detail}</dd>
        </div>
      ))}
    </dl>
  )
}

export function AssumptionsTab({ meta, assumptions, apiMode }: Props) {
  return (
    <div className="stack">
      <Panel title="Data source" subtitle="Where every number in this prototype comes from.">
        <div className="source-row">
          {meta?.is_synthetic ? <Badge tone="warn">Synthetic sample data</Badge> : <Badge tone="accent">Cached price data</Badge>}
          <Badge>{apiMode === 'mock' ? 'In-browser mock API' : 'HTTP API'}</Badge>
          {meta && <Badge>{meta.data_version}</Badge>}
        </div>
        {meta ? (
          <>
            <p>{meta.provenance}</p>
            <p className="muted">
              {fmtDate(meta.first_date)} – {fmtDate(meta.last_date)} · {meta.trading_days.toLocaleString()} trading days (weekday
              calendar)
            </p>
          </>
        ) : (
          <p className="muted">Loading metadata…</p>
        )}
        <p className="fine">
          The mock layer (<code>src/mock</code> and <code>src/analysis</code>) mirrors the response shapes in the team plan so it
          can be replaced by the FastAPI service. Set <code>VITE_API_BASE_URL</code> to switch the client to HTTP. The Python
          modules remain the authoritative calculations.
        </p>
      </Panel>

      <div className="grid-2">
        <Panel title="Simulation assumptions" subtitle="Returned with each simulation response.">
          {assumptions ? <List items={assumptions} /> : <p className="muted">Run a simulation to see its assumptions.</p>}
        </Panel>
        <Panel title="Units and conventions" subtitle="From the shared contract in docs/team-plan.md.">
          <List items={UNITS} />
        </Panel>
      </div>

      <Panel title="Known limitations">
        <List items={LIMITS} />
      </Panel>

      <Panel title="Documentation status">
        <p>
          <code>docs/api-contract.md</code> and <code>docs/methodology.md</code> are currently empty. Types and calculations here
          follow the shared contracts and modeling decisions in <code>docs/team-plan.md</code>. Fields marked “proposed” in{' '}
          <code>src/api/types.ts</code> need team agreement.
        </p>
      </Panel>
    </div>
  )
}
