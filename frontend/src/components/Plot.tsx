// Minimal Plotly wrapper. Plotly is loaded lazily on first use so the
// application shell renders without waiting for the charting bundle.

import { useEffect, useRef, useState } from 'react'
import type { Config, Data, Layout } from 'plotly.js'
import type { ChartId, ChartViewport } from '../api/types'
import { useChatView } from '../features/chat/chatView'

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
  chartId?: ChartId
}

export function Plot({ data, layout, config, height = 340, ariaLabel, chartId }: PlotProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const updateChart = useChatView()?.updateChart
  const viewport = useRef<ChartViewport | null>(null)
  const dataKey = JSON.stringify(data)

  useEffect(() => {
    if (!chartId) return
    viewport.current = { chart: chartId }
    updateChart?.(chartId, viewport.current)
    return () => updateChart?.(chartId, null)
  }, [chartId, updateChart, dataKey])

  useEffect(() => {
    if (!chartId || state !== 'ready') return
    type ChartElement = HTMLDivElement & {
      on: (event: string, callback: (event: Record<string, unknown>) => void) => void
      removeListener: (event: string, callback: (event: Record<string, unknown>) => void) => void
      data: { name?: string; visible?: boolean | 'legendonly' }[]
    }
    const el = ref.current as ChartElement | null
    if (!el?.on) return
    const relayout = (event: Record<string, unknown>) => {
      const next = { ...(viewport.current ?? { chart: chartId }) }
      for (const [axis, key] of [['xaxis', 'x_range'], ['yaxis', 'y_range'], ['yaxis2', 'y2_range']] as const) {
        if (event[`${axis}.autorange`] === true) delete next[key]
        const range = event[`${axis}.range`] ??
          (event[`${axis}.range[0]`] !== undefined && event[`${axis}.range[1]`] !== undefined
            ? [event[`${axis}.range[0]`], event[`${axis}.range[1]`]] : undefined)
        if (Array.isArray(range) && range.length === 2 && range.every(v => typeof v === 'string' || typeof v === 'number' && Number.isFinite(v))) {
          next[key] = range as [string | number, string | number]
        }
      }
      viewport.current = next
      updateChart?.(chartId, next)
    }
    const restyle = () => {
      const next = { ...(viewport.current ?? { chart: chartId }), hidden_series: el.data
        .filter(trace => trace.visible === false || trace.visible === 'legendonly').flatMap(trace => trace.name ? [trace.name] : []) }
      viewport.current = next
      updateChart?.(chartId, next)
    }
    el.on('plotly_relayout', relayout)
    el.on('plotly_restyle', restyle)
    return () => { el.removeListener('plotly_relayout', relayout); el.removeListener('plotly_restyle', restyle) }
  }, [chartId, state, updateChart])

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
