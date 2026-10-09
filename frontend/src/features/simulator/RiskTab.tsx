import { useMemo } from 'react'
import type { Data } from 'plotly.js'
import type { SimulationRequest, SimulationResponse } from '../../api/types'
import { STRATEGIES, drawdownPaths, strategyRisk } from '../../analysis/derived'
import { Plot } from '../../components/Plot'
import { SummaryTable } from '../../components/SummaryTable'
import { InfoTip, Panel } from '../../components/ui'
import { fmtDate, fmtPct } from '../../format'
import { GLOSSARY } from '../../glossary'
import { COLORS, STRATEGY_META, baseLayout } from '../../theme'

export function RiskTab({ req, res }: { req: SimulationRequest; res: SimulationResponse }) {
  const risks = useMemo(() => strategyRisk(res, req), [res, req])

  const ddData = useMemo<Data[]>(() => {
    const dd = drawdownPaths(res.paths)
    const x = res.paths.map((p) => p.date)
    return STRATEGIES.map((k) => ({
      type: 'scatter',
      mode: 'lines',
      name: STRATEGY_META[k].label,
      x,
      y: dd[k].map((v) => -v),
      line: { color: STRATEGY_META[k].color, width: 1.6 },
      fill: k === 'unhedged' ? 'tozeroy' : 'none',
      fillcolor: 'rgba(139,150,170,0.10)',
      hovertemplate: '%{y:.2f}%<extra>%{fullData.name}</extra>',
    }))
  }, [res])

  const ddLayout = useMemo(
    () => baseLayout({ xaxis: { type: 'date', hoverformat: '%b %d, %Y' }, yaxis: { ticksuffix: '%', rangemode: 'tozero' } }),
    [],
  )

  const barData = useMemo<Data[]>(
    () => [
      {
        type: 'bar',
        orientation: 'h',
        name: 'Max drawdown',
        y: risks.map((r) => STRATEGY_META[r.strategy].short),
        x: risks.map((r) => r.maxDrawdownPct),
        marker: { color: risks.map((r) => STRATEGY_META[r.strategy].color) },
        text: risks.map((r) => fmtPct(r.maxDrawdownPct)),
        textposition: 'outside',
        textfont: { color: COLORS.text },
        hovertemplate: '%{y}: %{x:.2f}%<extra>Max drawdown</extra>',
        cliponaxis: false,
      },
    ],
    [risks],
  )

  const barLayout = useMemo(
    () =>
      baseLayout({
        hovermode: 'closest',
        margin: { l: 90, r: 48, t: 8, b: 32 },
        xaxis: { ticksuffix: '%', rangemode: 'tozero' },
        yaxis: { autorange: 'reversed', gridcolor: 'rgba(0,0,0,0)' },
        bargap: 0.45,
      }),
    [],
  )

  const unhedged = risks[0]

  return (
    <div className="stack">
      <Panel
        title="Risk metrics"
        subtitle={`${fmtDate(res.effective_start_date)} – ${fmtDate(res.effective_end_date)} · ${res.paths.length} trading days`}
      >
        <SummaryTable rows={risks} detailed />
      </Panel>

      <div className="grid-2-1">
        <Panel
          title={
            <>
              Drawdown from peak <InfoTip text={GLOSSARY.maxDrawdown} label="About drawdown" />
            </>
          }
          subtitle="Distance below each strategy's running high, daily."
        >
          <Plot data={ddData} layout={ddLayout} height={300} ariaLabel="Drawdown over time for each strategy" />
        </Panel>
        <Panel title="Maximum drawdown" subtitle="Largest peak-to-trough loss in the window.">
          <Plot data={barData} layout={barLayout} height={300} ariaLabel="Maximum drawdown by strategy" />
        </Panel>
      </div>

      <Panel title="Reading these numbers">
        <div className="explain-grid">
          <div>
            <h4>Loss versus drawdown</h4>
            <p>
              Final P/L compares only the first and last day. Maximum drawdown measures the deepest fall from any earlier
              peak, so a strategy can finish flat and still have had a large drawdown along the way. Unhedged here: final{' '}
              {unhedged.returnPct >= 0 ? 'gain' : 'loss'} {fmtPct(Math.abs(unhedged.returnPct))}, drawdown{' '}
              {fmtPct(unhedged.maxDrawdownPct)}.
            </p>
          </div>
          <div>
            <h4>What is and isn't counted</h4>
            <p>
              The static short pays the stated borrow rate on its initial notional. ETF expenses are already inside the price
              series. Spreads, trading costs, financing interest, and margin are not modeled.
            </p>
          </div>
          <div>
            <h4>Volatility</h4>
            <p>
              Annualized volatility uses daily portfolio returns over the selected window. Short windows give noisy estimates.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}
