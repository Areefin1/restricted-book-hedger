import type { StrategyId } from '../api/types'
import { STRATEGY_META } from '../theme'
import { InfoTip } from './ui'

export interface MetricRow {
  strategy: StrategyId
  value: string
  /** Optional comparison against the unhedged row, shown beside the value. */
  delta?: string
  deltaTone?: 'pos' | 'neg' | ''
  /** De-emphasize this row, e.g. the unhedged baseline. */
  baseline?: boolean
}

interface Props {
  title: string
  tip: string
  rows: MetricRow[]
}

export function MetricCard({ title, tip, rows }: Props) {
  return (
    <article className="metric-card">
      <header>
        <h3>{title}</h3>
        <InfoTip text={tip} label={`About ${title}`} />
      </header>
      <dl>
        {rows.map((r) => (
          <div key={r.strategy} className={`metric-row ${r.baseline ? 'baseline' : ''}`}>
            <dt>
              <span className="swatch" style={{ background: STRATEGY_META[r.strategy].color }} aria-hidden="true" />
              {STRATEGY_META[r.strategy].short}
            </dt>
            <dd>
              <span className="num">{r.value}</span>
              {r.delta && <span className={`delta ${r.deltaTone ?? ''}`}>{r.delta}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
