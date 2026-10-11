import { useMemo, useState } from 'react'
import type { Annotations, Data } from 'plotly.js'
import type { PathPoint, StrategyId } from '../api/types'
import { STRATEGIES } from '../analysis/derived'
import { STRATEGY_META, baseLayout } from '../theme'
import { Plot } from './Plot'
import { Segmented } from './ui'

type Mode = 'value' | 'pnl' | 'return'

const compactUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 })

export function PortfolioChart({ paths, bookSize }: { paths: PathPoint[]; bookSize: number }) {
  const [mode, setMode] = useState<Mode>('value')

  const series = useMemo(() => {
    const y = (p: PathPoint, k: StrategyId) => {
      if (mode === 'value') return p[k]
      if (mode === 'pnl') return p[`${k}_pnl`] ?? p[k] - bookSize
      return (p[k] / bookSize - 1) * 100
    }
    return STRATEGIES.map((k) => ({ k, y: paths.map((p) => y(p, k)) }))
  }, [paths, bookSize, mode])

  const data = useMemo<Data[]>(() => {
    const x = paths.map((p) => p.date)
    return series.map(({ k, y }) => ({
      type: 'scatter',
      mode: 'lines',
      name: STRATEGY_META[k].label,
      x,
      y,
      customdata: paths.map((p) => [p[k], p[`${k}_pnl`] ?? p[k] - bookSize, (p[k] / bookSize - 1) * 100]),
      line: { color: STRATEGY_META[k].color, width: k === 'unhedged' ? 1.6 : 2 },
      hovertemplate:
        'Total value: %{customdata[0]:$,.0f}<br>' +
        'Portfolio P/L: %{customdata[1]:+$,.0f}<br>' +
        'Return: %{customdata[2]:+.2f}%<extra>%{fullData.name}</extra>',
    }))
  }, [paths, bookSize, series])

  const layout = useMemo(() => {
    // Label each line at its last point instead of making the reader match colors.
    const last = paths[paths.length - 1]?.date
    const annotations: Partial<Annotations>[] = series.map(({ k, y }) => {
      const v = y[y.length - 1]
      return {
        x: last,
        y: v,
        xanchor: 'left',
        xshift: 6,
        showarrow: false,
        // Lowercase k to match Plotly's SI tick labels on the axis.
        text: mode === 'return' ? `${v.toFixed(1)}%` : compactUsd.format(v).replace('K', 'k'),
        font: { color: STRATEGY_META[k].color, size: 11 },
      }
    })
    return baseLayout({
      margin: { l: 64, r: 64, t: 8, b: 36 },
      annotations,
      xaxis: { type: 'date', hoverformat: '%b %d, %Y' },
      yaxis: mode === 'return'
        ? { ticksuffix: '%', zeroline: true, zerolinewidth: 1 }
        : { tickformat: '$,.3s', zeroline: mode === 'pnl', zerolinewidth: 1 },
    })
  }, [paths, series, mode])

  return (
    <div className="chart-block">
      <div className="chart-toolbar">
        <ul className="legend" aria-label="Series">
          {STRATEGIES.map((k) => (
            <li key={k}>
              <span className="swatch line" style={{ background: STRATEGY_META[k].color }} aria-hidden="true" />
              {STRATEGY_META[k].label}
            </li>
          ))}
        </ul>
        <Segmented
          size="sm"
          ariaLabel="Chart units"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'value', label: 'Value' },
            { value: 'pnl', label: 'Profit / loss' },
            { value: 'return', label: 'Return' },
          ]}
        />
      </div>
      <Plot
        data={data}
        layout={layout}
        height={320}
        ariaLabel={`${mode === 'value' ? 'Total portfolio value' : mode === 'pnl' ? 'Portfolio profit or loss' : 'Portfolio return'} over time for each strategy`}
      />
    </div>
  )
}
