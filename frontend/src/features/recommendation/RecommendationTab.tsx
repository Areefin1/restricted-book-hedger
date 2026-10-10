import { useMemo, useState } from 'react'
import type { Data } from 'plotly.js'
import { api } from '../../api/client'
import type { HedgeInstrument, RecommendationRequest, RecommendationResponse } from '../../api/types'
import { PERMITTED_WINDOWS } from '../../analysis/research'
import { Plot } from '../../components/Plot'
import { Badge, ErrorState, InfoTip, Loading, Panel, Segmented } from '../../components/ui'
import { fmtDate, fmtSignedPct, signClass } from '../../format'
import { GLOSSARY } from '../../glossary'
import { useDebounced, useResource } from '../../hooks/useResource'
import { COLORS, STRATEGY_META, baseLayout } from '../../theme'

const INSTRUMENT_LABEL: Record<HedgeInstrument, string> = {
  sjb: STRATEGY_META.sjb_hedged.label,
  static_short: STRATEGY_META.static_short_hedged.label,
}

function GridChart({ rec }: { rec: RecommendationResponse }) {
  const color = rec.instrument === 'sjb' ? STRATEGY_META.sjb_hedged.color : STRATEGY_META.static_short_hedged.color
  const data = useMemo<Data[]>(() => {
    const x = rec.grid.map((g) => g.hedge_ratio)
    const best = rec.grid.find((g) => g.hedge_ratio === rec.recommended_ratio)
    return [
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Best window',
        x,
        y: rec.grid.map((g) => g.best_window_return_pct),
        line: { color: COLORS.faint, width: 1, dash: 'dot' },
        hovertemplate: '%{y:+.2f}%<extra>Best window</extra>',
      },
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Median window',
        x,
        y: rec.grid.map((g) => g.median_window_return_pct),
        line: { color: COLORS.muted, width: 1.4 },
        hovertemplate: '%{y:+.2f}%<extra>Median window</extra>',
      },
      {
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Worst window (objective)',
        x,
        y: rec.grid.map((g) => g.worst_window_return_pct),
        line: { color, width: 2.2 },
        marker: { size: 5, color },
        hovertemplate: '%{y:+.2f}%<extra>Worst window</extra>',
      },
      ...(best
        ? [
            {
              type: 'scatter',
              mode: 'markers',
              name: 'Selected ratio',
              x: [best.hedge_ratio],
              y: [best.worst_window_return_pct],
              marker: { size: 13, color: 'rgba(0,0,0,0)', line: { color: COLORS.accent, width: 2 } },
              hoverinfo: 'skip',
            } as Data,
          ]
        : []),
    ]
  }, [rec, color])

  const layout = useMemo(
    () =>
      baseLayout({
        xaxis: { title: { text: 'Hedge ratio', font: { size: 11 } }, tickformat: '.2f', dtick: 0.1 },
        yaxis: { title: { text: 'Window return', font: { size: 11 } }, ticksuffix: '%', zeroline: true },
        hovermode: 'x unified',
      }),
    [],
  )

  return <Plot data={data} layout={layout} height={320} ariaLabel="Worst, median and best rolling-window return by hedge ratio" />
}

interface Props {
  startDate: string
  endDate: string
  annualBorrowRate: number
  datesValid: boolean
  onApply: (ratio: number) => void
}

export function RecommendationTab({ startDate, endDate, annualBorrowRate, datesValid, onApply }: Props) {
  const [instrument, setInstrument] = useState<HedgeInstrument>('sjb')
  const [windowDays, setWindowDays] = useState<number>(63)

  const req: RecommendationRequest = {
    start_date: startDate,
    end_date: endDate,
    instrument,
    window_days: windowDays,
    annual_borrow_rate: annualBorrowRate,
  }
  const key = useDebounced(datesValid ? JSON.stringify(req) : null, 250)
  const rec = useResource(key, () => api.getRecommendation(JSON.parse(key as string) as RecommendationRequest))

  const tradeoffRows = useMemo(() => {
    if (!rec.data) return []
    const picks = new Set([0, 0.25, 0.5, 0.75, 1, rec.data.recommended_ratio])
    return rec.data.grid.filter((g) => picks.has(g.hedge_ratio))
  }, [rec.data])

  return (
    <div className="stack">
      <Panel
        title="Historical hedge-ratio search"
        subtitle="Uses the date range and borrow rate from the controls above. Selection and evaluation use the same history."
        actions={
          <div className="toolbar">
            <Segmented
              size="sm"
              ariaLabel="Hedge instrument"
              value={instrument}
              onChange={setInstrument}
              options={[
                { value: 'sjb', label: 'SJB' },
                { value: 'static_short', label: 'Static short' },
              ]}
            />
            <Segmented
              size="sm"
              ariaLabel="Window length"
              value={windowDays}
              onChange={setWindowDays}
              options={PERMITTED_WINDOWS.map((w) => ({ value: w, label: `${w}d` }))}
            />
          </div>
        }
      >
        <div className="objective">
          <span className="eyebrow">
            Objective <InfoTip text={GLOSSARY.objective} label="About the objective" />
          </span>
          <p>
            Choose the hedge ratio (0 to 1, step 0.05) that <strong>maximizes the worst ending portfolio return</strong> across
            all overlapping {windowDays}-trading-day windows in the selected range. Each window starts with a fresh hedge.
          </p>
        </div>

        {!datesValid ? (
          <ErrorState message="Fix the date range in the controls above to run the search." />
        ) : rec.error && !rec.loading ? (
          <ErrorState message={rec.error} onRetry={rec.retry} />
        ) : !rec.data ? (
          <Loading label="Searching hedge ratios…" />
        ) : (
          <div className={rec.stale ? 'is-stale' : ''}>
            <div className="rec-head">
              <div className="rec-main">
                <span className="stat-label">Selected ratio · {INSTRUMENT_LABEL[rec.data.instrument]}</span>
                <span className="rec-value num">{rec.data.recommended_ratio.toFixed(2)}</span>
                <span className="muted">
                  Worst {windowDays}-day window return at this ratio:{' '}
                  <strong className={`num ${signClass(rec.data.objective_value_pct)}`}>
                    {fmtSignedPct(rec.data.objective_value_pct)}
                  </strong>
                </span>
              </div>
              <div className="rec-meta">
                <Badge tone="warn">In-sample</Badge>
                <Badge>{rec.data.windows_evaluated.toLocaleString()} windows</Badge>
                <span className="muted">
                  {fmtDate(rec.data.effective_start_date)} – {fmtDate(rec.data.effective_end_date)}
                </span>
                <button type="button" className="btn primary" onClick={() => onApply(rec.data!.recommended_ratio)}>
                  Use {rec.data.recommended_ratio.toFixed(2)} in simulator
                </button>
              </div>
            </div>

            {rec.data.recommended_ratio === 1 && (
              <p className="callout warn">
                The search selected the upper boundary (full hedge). That is a consequence of this objective, which only looks
                at the worst window and ignores the upside given up in the median and best windows. It is not a general
                recommendation to hedge fully.
              </p>
            )}

            <div className="grid-2-1">
              <div>
                <GridChart rec={rec.data} />
                <div className="chart-legend-inline">
                  <span>
                    <i
                      className="swatch line"
                      style={{ background: instrument === 'sjb' ? STRATEGY_META.sjb_hedged.color : STRATEGY_META.static_short_hedged.color }}
                    />{' '}
                    Worst window (objective)
                  </span>
                  <span>
                    <i className="swatch line" style={{ background: COLORS.muted }} /> Median window
                  </span>
                  <span>
                    <i className="swatch line dashed" style={{ borderColor: COLORS.faint }} /> Best window
                  </span>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table compact">
                  <caption>Tradeoff at selected ratios</caption>
                  <thead>
                    <tr>
                      <th scope="col">Ratio</th>
                      <th scope="col" className="r">Worst</th>
                      <th scope="col" className="r">Median</th>
                      <th scope="col" className="r">Best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradeoffRows.map((g) => (
                      <tr key={g.hedge_ratio} className={g.hedge_ratio === rec.data!.recommended_ratio ? 'selected' : ''}>
                        <th scope="row" className="num">
                          {g.hedge_ratio.toFixed(2)}
                        </th>
                        <td className={`r num ${signClass(g.worst_window_return_pct)}`}>{fmtSignedPct(g.worst_window_return_pct)}</td>
                        <td className={`r num ${signClass(g.median_window_return_pct)}`}>{fmtSignedPct(g.median_window_return_pct)}</td>
                        <td className={`r num ${signClass(g.best_window_return_pct)}`}>{fmtSignedPct(g.best_window_return_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <h4 className="subhead">Assumptions</h4>
            <dl className="assumptions">
              {rec.data.assumptions.map((a) => (
                <div key={a.label}>
                  <dt>{a.label}</dt>
                  <dd>{a.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Panel>
    </div>
  )
}
