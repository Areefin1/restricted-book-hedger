import { useMemo, useState } from 'react'
import type { Data } from 'plotly.js'
import type { PathPoint } from '../api/types'
import { STRATEGIES } from '../analysis/derived'
import { COLORS, STRATEGY_META, baseLayout } from '../theme'
import { Plot } from './Plot'
import { Segmented } from './ui'

type Mode = 'value' | 'pnl' | 'return'

export function PortfolioChart({ paths, bookSize }: { paths: PathPoint[]; bookSize: number }) {
  const [mode, setMode] = useState<Mode>('value')

  const data = useMemo<Data[]>(() => {
    const x = paths.map((p) => p.date)
    return STRATEGIES.map((k) => ({
      type: 'scatter',
      mode: 'lines',
      name: STRATEGY_META[k].label,
      x,
      y: paths.map((p) => {
        if (mode === 'value') return p[k]
        if (mode === 'pnl') return p[`${k}_pnl`] ?? p[k] - bookSize
        return (p[k] / bookSize - 1) * 100
      }),
      customdata: paths.map((p) => [p[k], p[`${k}_pnl`] ?? p[k] - bookSize, (p[k] / bookSize - 1) * 100]),
      line: { color: STRATEGY_META[k].color, width: k === 'unhedged' ? 1.6 : 2 },
      hovertemplate:
        'Total value: %{customdata[0]:$,.0f}<br>' +
        'Portfolio P/L: %{customdata[1]:+$,.0f}<br>' +
        'Return: %{customdata[2]:+.2f}%<extra>%{fullData.name}</extra>',
    }))
  }, [paths, bookSize, mode])

  const layout = useMemo(
    () =>
      baseLayout({
        margin: { l: 64, r: 16, t: 36, b: 36 },
        xaxis: {
          type: 'date',
          hoverformat: '%b %d, %Y',
          rangeselector: {
            x: 0,
            y: 1.02,
            yanchor: 'bottom',
            bgcolor: COLORS.surface,
            activecolor: '#1d3a46',
            bordercolor: COLORS.axis,
            borderwidth: 1,
            font: { color: COLORS.text, size: 11 },
            buttons: [
              { count: 1, label: '1M', step: 'month', stepmode: 'backward' },
              { count: 3, label: '3M', step: 'month', stepmode: 'backward' },
              { count: 6, label: '6M', step: 'month', stepmode: 'backward' },
              { count: 1, label: '1Y', step: 'year', stepmode: 'backward' },
              { step: 'all', label: 'All' },
            ],
          },
        },
        yaxis: mode === 'return'
          ? { title: { text: 'Return (%)' }, ticksuffix: '%', zeroline: true, zerolinewidth: 1 }
          : {
              title: { text: mode === 'value' ? 'Total value ($)' : 'Portfolio P/L ($)' },
              tickformat: '$,.3s',
              zeroline: mode === 'pnl',
              zerolinewidth: 1,
            },
      }),
    [mode],
  )

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
            { value: 'value', label: 'Total value ($)' },
            { value: 'pnl', label: 'Profit / loss ($)' },
            { value: 'return', label: 'Return (%)' },
          ]}
        />
      </div>
      <Plot
        data={data}
        layout={layout}
        height={360}
        ariaLabel={`${mode === 'value' ? 'Total portfolio value' : mode === 'pnl' ? 'Portfolio profit or loss' : 'Portfolio return'} over time for each strategy`}
      />
      <p className="chart-hint">Portfolio profit / loss = total value minus starting capital ({bookSize.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}). Hover to see both amounts.</p>
      <p className="chart-hint">Drag to zoom into a date range; double-click to reset. Range buttons are relative to the last date.</p>
    </div>
  )
}
