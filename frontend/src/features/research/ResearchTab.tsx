import { useMemo, useState } from 'react'
import type { Data } from 'plotly.js'
import { api } from '../../api/client'
import type { ConvexityResponse } from '../../api/types'
import { PERMITTED_WINDOWS, volatilityBuckets } from '../../analysis/research'
import { Plot } from '../../components/Plot'
import { EmptyState, ErrorState, InfoTip, Loading, Panel, Segmented } from '../../components/ui'
import { fmtDecPct, fmtSignedDecPct, signClass } from '../../format'
import { GLOSSARY } from '../../glossary'
import { useResource } from '../../hooks/useResource'
import { COLORS, baseLayout } from '../../theme'
import { ConvexityChart } from './ConvexityChart'
import { DailyReturnChart } from './DailyReturnChart'

function VolatilityContext({ data }: { data: ConvexityResponse }) {
  const buckets = useMemo(() => volatilityBuckets(data.points), [data])

  const series = useMemo<Data[]>(
    () => [
      {
        type: 'scatter',
        mode: 'lines',
        name: 'HYG realized vol',
        x: data.points.map((p) => p.end_date),
        y: data.points.map((p) => p.hyg_realized_vol * 100),
        line: { color: COLORS.accent, width: 1.5 },
        hovertemplate: '%{y:.1f}%<extra>Realized vol</extra>',
      },
      {
        type: 'scatter',
        mode: 'lines',
        name: 'SJB − static reference',
        x: data.points.map((p) => p.end_date),
        y: data.points.map((p) => (p.sjb_return + p.hyg_return) * 100),
        yaxis: 'y2',
        line: { color: COLORS.sjb, width: 1.2 },
        hovertemplate: '%{y:+.2f}%<extra>SJB − static</extra>',
      },
    ],
    [data],
  )

  const layout = useMemo(
    () =>
      baseLayout({
        margin: { l: 56, r: 56, t: 12, b: 36 },
        xaxis: { type: 'date', hoverformat: '%b %d, %Y' },
        yaxis: { ticksuffix: '%', title: { text: 'Realized vol (ann.)', font: { size: 11, color: COLORS.accent } } },
        yaxis2: {
          overlaying: 'y',
          side: 'right',
          ticksuffix: '%',
          showgrid: false,
          zeroline: true,
          zerolinecolor: COLORS.axis,
          title: { text: 'SJB − static', font: { size: 11, color: COLORS.sjb } },
          tickfont: { color: COLORS.muted },
        },
      }),
    [],
  )

  if (!buckets.length) return <EmptyState title="Not enough windows to summarize." />

  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Volatility tercile</th>
              <th scope="col" className="r">HYG vol range</th>
              <th scope="col" className="r">Windows</th>
              <th scope="col" className="r">Avg HYG return</th>
              <th scope="col" className="r">Avg SJB return</th>
              <th scope="col" className="r">
                Avg SJB − static <InfoTip text={GLOSSARY.gap} label="About the gap" />
              </th>
              <th scope="col" className="r">SJB ahead</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label}>
                <th scope="row">{b.label}</th>
                <td className="r num muted">
                  {fmtDecPct(b.volLow, 1)} – {fmtDecPct(b.volHigh, 1)}
                </td>
                <td className="r num">{b.count.toLocaleString()}</td>
                <td className={`r num ${signClass(b.avgHyg)}`}>{fmtSignedDecPct(b.avgHyg)}</td>
                <td className={`r num ${signClass(b.avgSjb)}`}>{fmtSignedDecPct(b.avgSjb)}</td>
                <td className={`r num ${signClass(b.avgGap)}`}>{fmtSignedDecPct(b.avgGap)}</td>
                <td className="r num">{fmtDecPct(b.shareSjbAhead, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Plot data={series} layout={layout} height={260} ariaLabel="Rolling realized volatility and SJB gap over time" />
      <div className="chart-legend-inline">
        <span>
          <i className="swatch line" style={{ background: COLORS.accent }} /> HYG realized vol, left axis
        </span>
        <span>
          <i className="swatch line" style={{ background: COLORS.sjb }} /> SJB − static −1x reference, right axis
        </span>
      </div>
    </div>
  )
}

export function ResearchTab() {
  const [windowDays, setWindowDays] = useState<number>(63)
  const sanity = useResource('sanity', () => api.getSanity())
  const convexity = useResource(`convexity-${windowDays}`, () => api.getConvexity(windowDays))

  return (
    <div className="stack">
      <Panel
        title="Daily sanity check"
        subtitle="Does SJB deliver roughly −1x of HYG's daily return? Full history."
      >
        {sanity.error && !sanity.data ? (
          <ErrorState message={sanity.error} onRetry={sanity.retry} />
        ) : !sanity.data ? (
          <Loading label="Loading daily returns…" />
        ) : (
          <div className="grid-1-2">
            <div className="stat-list">
              <div>
                <span className="stat-label">
                  Beta <InfoTip text={GLOSSARY.beta} label="About beta" />
                </span>
                <span className="stat-value num">{sanity.data.beta?.toFixed(3) ?? 'n/a'}</span>
              </div>
              <div>
                <span className="stat-label">
                  Intercept, annualized <InfoTip text={GLOSSARY.intercept} label="About intercept" />
                </span>
                <span className="stat-value num">
                  {sanity.data.intercept_daily === null ? 'n/a' : fmtSignedDecPct(sanity.data.intercept_daily * 252)}
                </span>
              </div>
              <div>
                <span className="stat-label">
                  R² <InfoTip text={GLOSSARY.rSquared} label="About R squared" />
                </span>
                <span className="stat-value num">{sanity.data.r_squared?.toFixed(3) ?? 'n/a'}</span>
              </div>
              <div>
                <span className="stat-label">Correlation</span>
                <span className="stat-value num">{sanity.data.correlation?.toFixed(3) ?? 'n/a'}</span>
              </div>
              <div>
                <span className="stat-label">Observations</span>
                <span className="stat-value num">{sanity.data.observations.toLocaleString()}</span>
              </div>
              <ul className="notes">
                {sanity.data.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
            <div>
              <DailyReturnChart sanity={sanity.data} />
              <div className="chart-legend-inline">
                <span>
                  <i className="swatch dot" style={{ background: COLORS.sjb }} /> Trading day
                </span>
                <span>
                  <i className="swatch line" style={{ background: COLORS.accent }} /> OLS fit
                </span>
                <span>
                  <i className="swatch line dashed" style={{ borderColor: COLORS.muted }} /> Exact −1x
                </span>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={
          <>
            Empirical convexity <InfoTip text={GLOSSARY.rollingWindow} label="About rolling windows" />
          </>
        }
        subtitle="Rolling-window SJB returns against HYG returns, colored by HYG realized volatility."
        actions={
          <Segmented
            size="sm"
            ariaLabel="Window length"
            value={windowDays}
            onChange={setWindowDays}
            options={PERMITTED_WINDOWS.map((w) => ({ value: w, label: `${w}d` }))}
          />
        }
      >
        {convexity.error && !convexity.loading ? (
          <ErrorState message={convexity.error} onRetry={convexity.retry} />
        ) : !convexity.data ? (
          <Loading label="Calculating rolling windows…" />
        ) : convexity.data.points.length === 0 ? (
          <EmptyState title="No complete windows in the available history." />
        ) : (
          <div className={convexity.stale ? 'is-stale' : ''}>
            <ConvexityChart data={convexity.data} />
            <div className="chart-legend-inline">
              <span>
                <i className="swatch dot gradient" /> One window, color = realized vol
              </span>
              <span>
                <i className="swatch line dashed" style={{ borderColor: COLORS.text }} /> Static −1x reference (y = −x)
              </span>
            </div>
            <ul className="notes">
              {convexity.data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>
                Points above the dashed line are windows where SJB beat a static short of the same size; points below are
                windows where it lagged.
              </li>
            </ul>
          </div>
        )}
      </Panel>

      <Panel title="Volatility context" subtitle="How the SJB gap varies with realized volatility, same windows as above.">
        {!convexity.data ? (
          convexity.error ? <ErrorState message={convexity.error} onRetry={convexity.retry} /> : <Loading />
        ) : (
          <div className={convexity.stale ? 'is-stale' : ''}>
            <VolatilityContext data={convexity.data} />
            <p className="fine">
              Averages use the loaded dataset. Overlapping windows mean the counts overstate the amount of independent
              evidence. Benchmark differences, expenses, and tracking affect the gap as well as daily resetting.
            </p>
          </div>
        )}
      </Panel>
    </div>
  )
}
