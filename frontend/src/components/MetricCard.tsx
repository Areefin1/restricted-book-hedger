import type { StrategyId } from '../api/types'
import { STRATEGY_META } from '../theme'
import { InfoTip } from './ui'

export interface MetricRow {
  strategy: StrategyId
  value: string
  /** Optional comparison against the unhedged row. */
  delta?: string
  tone?: 'pos' | 'neg' | ''
  deltaTone?: 'pos' | 'neg' | ''
}

interface Props {
  title: string
  tip: string
  rows: MetricRow[]
  footnote?: string
}

export function MetricCard({ title, tip, rows, footnote }: Props) {
  return (
    <article className="metric-card">
      <header>
        <h3>{title}</h3>
        <InfoTip text={tip} label={`About ${title}`} />
      </header>
      <dl>
        {rows.map((r) => (
          <div key={r.strategy} className="metric-row">
            <dt>
              <span className="swatch" style={{ background: STRATEGY_META[r.strategy].color }} aria-hidden="true" />
              {STRATEGY_META[r.strategy].short}
            </dt>
            <dd>
              <span className={`num ${r.tone ?? ''}`}>{r.value}</span>
              {r.delta && <span className={`delta ${r.deltaTone ?? ''}`}>{r.delta}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {footnote && <p className="metric-foot">{footnote}</p>}
    </article>
  )
}
