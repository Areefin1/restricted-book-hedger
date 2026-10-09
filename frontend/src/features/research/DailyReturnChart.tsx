import { useMemo } from 'react'
import type { Data } from 'plotly.js'
import type { SanityResponse } from '../../api/types'
import { Plot } from '../../components/Plot'
import { COLORS, STRATEGY_META, baseLayout } from '../../theme'

export function DailyReturnChart({ sanity }: { sanity: SanityResponse }) {
  const data = useMemo<Data[]>(() => {
    const xs = sanity.points.map((p) => p.hyg_return * 100)
    const lo = Math.min(...xs)
    const hi = Math.max(...xs)
    const traces: Data[] = [
      {
        type: 'scattergl',
        mode: 'markers',
        name: 'Trading day',
        x: xs,
        y: sanity.points.map((p) => p.sjb_return * 100),
        customdata: sanity.points.map((p) => p.date),
        marker: { color: STRATEGY_META.sjb_hedged.color, size: 4, opacity: 0.45 },
        hovertemplate: '%{customdata}<br>HYG %{x:+.2f}%<br>SJB %{y:+.2f}%<extra></extra>',
      },
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Exact -1x',
        x: [lo, hi],
        y: [-lo, -hi],
        line: { color: COLORS.muted, dash: 'dash', width: 1 },
        hoverinfo: 'skip',
      },
    ]
    if (sanity.beta !== null && sanity.intercept_daily !== null) {
      const b = sanity.beta
      const a = sanity.intercept_daily * 100
      traces.push({
        type: 'scatter',
        mode: 'lines',
        name: 'OLS fit',
        x: [lo, hi],
        y: [a + b * lo, a + b * hi],
        line: { color: COLORS.accent, width: 1.5 },
        hoverinfo: 'skip',
      })
    }
    return traces
  }, [sanity])

  const layout = useMemo(
    () =>
      baseLayout({
        hovermode: 'closest',
        xaxis: { title: { text: 'HYG daily return', font: { size: 11 } }, ticksuffix: '%', zeroline: true },
        yaxis: { title: { text: 'SJB daily return', font: { size: 11 } }, ticksuffix: '%', zeroline: true },
      }),
    [],
  )

  return <Plot data={data} layout={layout} height={320} ariaLabel="Scatter of SJB daily returns against HYG daily returns" />
}
