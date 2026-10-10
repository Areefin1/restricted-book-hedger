import { useMemo } from 'react'
import type { Data } from 'plotly.js'
import type { ConvexityResponse } from '../../api/types'
import { Plot } from '../../components/Plot'
import { COLORS, baseLayout } from '../../theme'

const VOL_SCALE: [number, string][] = [
  [0, '#1f4e6b'],
  [0.35, '#2a8c9a'],
  [0.65, '#2ccfb1'],
  [1, '#f2d36b'],
]

export function ConvexityChart({ data: res }: { data: ConvexityResponse }) {
  const data = useMemo<Data[]>(() => {
    const xs = res.points.map((p) => p.hyg_return * 100)
    const lo = Math.min(...xs, 0)
    const hi = Math.max(...xs, 0)
    return [
      {
        type: 'scattergl',
        mode: 'markers',
        name: `${res.window_days}-day window`,
        x: xs,
        y: res.points.map((p) => p.sjb_return * 100),
        customdata: res.points.map((p) => [p.start_date, p.end_date, p.hyg_realized_vol * 100]),
        marker: {
          size: 5,
          opacity: 0.75,
          color: res.points.map((p) => p.hyg_realized_vol * 100),
          colorscale: VOL_SCALE,
          colorbar: {
            title: { text: 'HYG vol', font: { size: 11, color: COLORS.muted } },
            ticksuffix: '%',
            thickness: 10,
            outlinewidth: 0,
            tickfont: { color: COLORS.muted, size: 10 },
          },
        },
        hovertemplate:
          '%{customdata[0]} → %{customdata[1]}<br>HYG %{x:+.2f}%<br>SJB %{y:+.2f}%<br>Realized vol %{customdata[2]:.1f}%<extra></extra>',
      },
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Static -1x reference (y = -x)',
        x: [lo, hi],
        y: [-lo, -hi],
        line: { color: COLORS.text, dash: 'dash', width: 1.2 },
        hoverinfo: 'skip',
      },
    ]
  }, [res])

  const layout = useMemo(
    () =>
      baseLayout({
        hovermode: 'closest',
        margin: { l: 60, r: 8, t: 12, b: 44 },
        xaxis: { title: { text: `HYG ${res.window_days}-day return`, font: { size: 11 } }, ticksuffix: '%', zeroline: true },
        yaxis: { title: { text: `SJB ${res.window_days}-day return`, font: { size: 11 } }, ticksuffix: '%', zeroline: true },
      }),
    [res.window_days],
  )

  return <Plot data={data} layout={layout} height={380} ariaLabel="Rolling-window SJB excess returns against HYG excess returns, colored by volatility" />
}
