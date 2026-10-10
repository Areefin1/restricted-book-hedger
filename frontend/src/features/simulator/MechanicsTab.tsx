import { useMemo, useState } from 'react'
import type { Data } from 'plotly.js'
import type { SimulationRequest, SimulationResponse } from '../../api/types'
import { hedgeMechanics, windowHygVol } from '../../analysis/derived'
import { EXAMPLES, resetExample, type ExampleId } from '../../analysis/examples'
import { Plot } from '../../components/Plot'
import { EmptyState, InfoTip, Panel, Segmented } from '../../components/ui'
import { fmtDecPct, fmtSignedDecPct, signClass } from '../../format'
import { GLOSSARY } from '../../glossary'
import { COLORS, STRATEGY_META, baseLayout } from '../../theme'

function WorkedExample() {
  const [id, setId] = useState<ExampleId>('choppy')
  const ex = EXAMPLES[id]
  const rows = resetExample([...ex.returns])
  const last = rows[rows.length - 1]
  const gap = last.sjbCum - last.staticCum

  return (
    <Panel
      title="Two-day illustration"
      subtitle="Arithmetic example with chosen returns, $1 of hedge notional. Not data."
      actions={
        <Segmented
          size="sm"
          ariaLabel="Example path"
          value={id}
          onChange={setId}
          options={(Object.keys(EXAMPLES) as ExampleId[]).map((k) => ({ value: k, label: EXAMPLES[k].label }))}
        />
      }
    >
      <div className="table-wrap">
        <table className="data-table compact">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="r">HYG daily</th>
              <th scope="col" className="r">HYG cumulative</th>
              <th scope="col" className="r">Static short cumulative</th>
              <th scope="col" className="r">SJB daily</th>
              <th scope="col" className="r">SJB cumulative</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <th scope="row">{r.day === 0 ? 'Start' : `Day ${r.day}`}</th>
                <td className="r num">{r.hygReturn === null ? '—' : fmtSignedDecPct(r.hygReturn)}</td>
                <td className={`r num ${signClass(r.hygCum)}`}>{fmtSignedDecPct(r.hygCum)}</td>
                <td className={`r num ${signClass(r.staticCum)}`}>{fmtSignedDecPct(r.staticCum)}</td>
                <td className="r num">{r.sjbReturn === null ? '—' : fmtSignedDecPct(r.sjbReturn)}</td>
                <td className={`r num ${signClass(r.sjbCum)}`}>{fmtSignedDecPct(r.sjbCum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="callout">
        {ex.note} Difference after two days (SJB − static short): <strong className={`num ${signClass(gap)}`}>{fmtSignedDecPct(gap)}</strong>.
      </p>
    </Panel>
  )
}

function WindowDecomposition({ req, res }: { req: SimulationRequest; res: SimulationResponse }) {
  const points = useMemo(() => hedgeMechanics(res, req), [res, req])
  const vol = useMemo(() => windowHygVol(res), [res])

  const data = useMemo<Data[]>(() => {
    if (!points) return []
    const x = points.map((p) => p.date)
    const line = (name: string, y: number[], color: string, dash?: 'dot' | 'dash'): Data => ({
      type: 'scatter',
      mode: 'lines',
      name,
      x,
      y: y.map((v) => v * 100),
      line: { color, width: 1.8, dash },
      hovertemplate: '%{y:+.2f}%<extra>%{fullData.name}</extra>',
    })
    return [
      line('HYG', points.map((p) => p.hyg), COLORS.unhedged),
      line('Static -1x reference', points.map((p) => p.staticRef), STRATEGY_META.static_short_hedged.color, 'dash'),
      line('SJB', points.map((p) => p.sjb), STRATEGY_META.sjb_hedged.color),
    ]
  }, [points])

  const layout = useMemo(
    () => baseLayout({ xaxis: { type: 'date', hoverformat: '%b %d, %Y' }, yaxis: { ticksuffix: '%', zeroline: true } }),
    [],
  )

  if (!points) {
    return (
      <Panel title="Selected window: instrument returns">
        <EmptyState title="Instrument returns unavailable">
          Reload results from the updated API to see this comparison.
        </EmptyState>
      </Panel>
    )
  }

  const end = points[points.length - 1]
  const gap = end.sjb - end.staticRef

  return (
    <Panel
      title="Selected window: instrument returns"
      subtitle="Adjusted instrument total returns, separate from funded portfolio P/L and proxy stresses."
    >
      <div className="stat-strip">
        <div>
          <span className="stat-label">HYG cumulative</span>
          <span className={`stat-value num ${signClass(end.hyg)}`}>{fmtSignedDecPct(end.hyg)}</span>
        </div>
        <div>
          <span className="stat-label">Static -1x reference</span>
          <span className={`stat-value num ${signClass(end.staticRef)}`}>{fmtSignedDecPct(end.staticRef)}</span>
        </div>
        <div>
          <span className="stat-label">SJB cumulative</span>
          <span className={`stat-value num ${signClass(end.sjb)}`}>{fmtSignedDecPct(end.sjb)}</span>
        </div>
        <div>
          <span className="stat-label">
            SJB − static <InfoTip text={GLOSSARY.gap} label="About the gap" />
          </span>
          <span className={`stat-value num ${signClass(gap)}`}>{fmtSignedDecPct(gap)}</span>
        </div>
        <div>
          <span className="stat-label">
            HYG realized vol <InfoTip text={GLOSSARY.realizedVol} label="About realized volatility" />
          </span>
          <span className="stat-value num">{fmtDecPct(vol)}</span>
        </div>
      </div>
      <Plot data={data} layout={layout} height={300} ariaLabel="Cumulative HYG, static short reference, and SJB returns" />
      <div className="chart-legend-inline">
        <span>
          <i className="swatch line" style={{ background: COLORS.unhedged }} /> HYG
        </span>
        <span>
          <i className="swatch line dashed" style={{ borderColor: STRATEGY_META.static_short_hedged.color }} /> Static -1x reference
        </span>
        <span>
          <i className="swatch line" style={{ background: STRATEGY_META.sjb_hedged.color }} /> SJB
        </span>
      </div>
      <p className="fine">
        The observed gap combines daily compounding, benchmark differences, embedded expenses, and tracking.
        This view does not separate those components. The static reference excludes borrow costs.
      </p>
    </Panel>
  )
}

export function MechanicsTab({ req, res }: { req: SimulationRequest; res: SimulationResponse }) {
  return (
    <div className="stack">
      <div className="compare-grid">
        <article className="concept">
          <header>
            <span className="swatch" style={{ background: STRATEGY_META.static_short_hedged.color }} aria-hidden="true" />
            <h3>Static short HYG</h3>
            <InfoTip text={GLOSSARY.staticShort} label="About static short" />
          </header>
          <ul>
            <li>Model a fixed initial short exposure using negative adjusted HYG returns.</li>
            <li>P/L is exactly −1 × HYG's cumulative move on the hedged notional, before costs.</li>
            <li>Negative adjusted-return exposure is an analytical comparison; it is not a fixed-share short ledger.</li>
            <li>Costs: borrow fee on the short (an explicit input here). Requires the ability to borrow shares.</li>
          </ul>
        </article>
        <article className="concept">
          <header>
            <span className="swatch" style={{ background: STRATEGY_META.sjb_hedged.color }} aria-hidden="true" />
            <h3>Long SJB (daily −1x)</h3>
            <InfoTip text={GLOSSARY.sjb} label="About SJB" />
          </header>
          <ul>
            <li>Buy an inverse ETF that targets −1x of the index's return each day.</li>
            <li>Rebalances daily, so multi-day returns compound and depend on the path.</li>
            <li>Compounding can help in trends or hurt in reversals; observed fund returns also reflect tracking and benchmark differences.</li>
            <li>Costs: fund expenses are inside its price. The overlay pays cash funding plus the assumed funding spread and trading cost.</li>
          </ul>
        </article>
      </div>

      <WorkedExample />
      <WindowDecomposition req={req} res={res} />
    </div>
  )
}
