// Minimal Plotly wrapper. Plotly is loaded lazily on first use so the
// application shell renders without waiting for the charting bundle.

import { useEffect, useRef, useState } from 'react'
import type { Config, Data, Layout } from 'plotly.js'

type PlotlyModule = typeof import('plotly.js-dist-min')

let plotlyPromise: Promise<PlotlyModule> | null = null

function loadPlotly(): Promise<PlotlyModule> {
  plotlyPromise ??= import('plotly.js-dist-min').then(
    (m) => ((m as unknown as { default?: PlotlyModule }).default ?? m) as PlotlyModule,
  )
  return plotlyPromise
}

const BASE_CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
  toImageButtonOptions: { format: 'png', scale: 2 },
}

interface PlotProps {
  data: Data[]
  layout: Partial<Layout>
  config?: Partial<Config>
  height?: number
  ariaLabel: string
}

export function Plot({ data, layout, config, height = 340, ariaLabel }: PlotProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const el = ref.current
    if (!el) return
    loadPlotly()
      .then((Plotly) => {
        if (cancelled) return
        return Plotly.react(el, data, { ...layout, height, autosize: true }, { ...BASE_CONFIG, ...config }).then(() => {
          if (!cancelled) setState('ready')
        })
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [data, layout, config, height])

  // Resize with the container (sidebar collapse, grid reflow), not just the window.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (el.querySelector('.plot-container')) {
        void loadPlotly().then((Plotly) => Plotly.Plots.resize(el))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    return () => {
      if (el) void loadPlotly().then((Plotly) => Plotly.purge(el))
    }
  }, [])

  return (
    <div className="plot" style={{ minHeight: height }} role="img" aria-label={ariaLabel}>
      {state === 'loading' && <div className="plot-overlay">Loading chart…</div>}
      {state === 'error' && <div className="plot-overlay error">Chart failed to load.</div>}
      <div ref={ref} />
    </div>
  )
}
