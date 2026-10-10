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
  { label: 'Preset selection', detail: 'Stress presets cover stated periods; the choppy period is selected by an explicit in-sample volatility rule. The preset selector displays its rule.' },
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
          {!meta ? <Badge>Connecting</Badge> : meta.is_synthetic ? <Badge tone="warn">Synthetic sample data</Badge> : <Badge tone="accent">Cached price data</Badge>}
          <Badge>{apiMode === 'mock' ? 'In-browser mock API' : 'HTTP API'}</Badge>
          {meta && <Badge>{meta.data_version}</Badge>}
        </div>
        {meta ? (
          <>
            <p>{meta.provenance}</p>
            <p className="muted">
              {fmtDate(meta.first_date)} – {fmtDate(meta.last_date)} · {meta.trading_days.toLocaleString()} shared observations
            </p>
          </>
        ) : (
          <p className="muted">Loading metadata…</p>
        )}
        {meta?.notes?.map((note) => <p className="fine" key={note}>{note}</p>)}
        {meta?.retrieved_at && <p className="fine">Retrieved: {meta.retrieved_at}</p>}
        {meta?.adjustment && <p className="fine">{meta.adjustment}</p>}
      </Panel>

      <div className="grid-2">
        <Panel title="Simulation assumptions" subtitle="Returned with each simulation response.">
          {assumptions ? <List items={assumptions} /> : <p className="muted">Run a simulation to see its assumptions.</p>}
        </Panel>
        <Panel title="Units and conventions" subtitle="Money, dates, and percentage conventions used throughout the app.">
          <List items={UNITS} />
        </Panel>
      </div>

      <Panel title="Known limitations">
        <List items={LIMITS} />
      </Panel>

      <Panel title="Research scope">
        <p>
          This is an empirical comparison of observed return series. It does not establish that daily resetting alone causes
          the observed gap, replicate an academic paper, or establish suitability for a particular restricted portfolio.
        </p>
      </Panel>
    </div>
  )
}
