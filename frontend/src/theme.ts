// Shared visual constants for charts. CSS uses the matching custom
// properties in styles/global.css; Plotly needs literal values.

import type { Layout } from 'plotly.js'
import type { StrategyId } from './api/types'

export const COLORS = {
  text: '#c9d3e1',
  muted: '#8392a8',
  faint: '#5d6b80',
  grid: '#1b2638',
  axis: '#2a3850',
  surface: '#0f1826',
  accent: '#2ccfb1',
  pos: '#3fcf8e',
  neg: '#f2726f',
  unhedged: '#8b96aa',
  static: '#5aa9f8',
  sjb: '#f2b54b',
}

export const STRATEGY_META: Record<StrategyId, { label: string; short: string; color: string }> = {
  unhedged: { label: 'Unhedged (HYG)', short: 'Unhedged', color: COLORS.unhedged },
  static_short_hedged: { label: 'Static short hedge', short: 'Static short', color: COLORS.static },
  sjb_hedged: { label: 'SJB hedge', short: 'SJB', color: COLORS.sjb },
}

const FONT = 'Inter, "Segoe UI", system-ui, -apple-system, Roboto, sans-serif'

export function baseLayout(overrides: Partial<Layout> = {}): Partial<Layout> {
  const { xaxis, yaxis, ...rest } = overrides
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: FONT, color: COLORS.muted, size: 11 },
    margin: { l: 60, r: 16, t: 12, b: 40 },
    hovermode: 'x unified',
    hoverlabel: {
      bgcolor: COLORS.surface,
      bordercolor: COLORS.axis,
      font: { family: FONT, color: COLORS.text, size: 12 },
    },
    showlegend: false,
    xaxis: {
      gridcolor: COLORS.grid,
      linecolor: COLORS.axis,
      zerolinecolor: COLORS.axis,
      tickcolor: COLORS.axis,
      ticks: 'outside',
      ticklen: 4,
      automargin: true,
      ...xaxis,
    },
    yaxis: {
      gridcolor: COLORS.grid,
      linecolor: COLORS.axis,
      zerolinecolor: COLORS.axis,
      tickcolor: COLORS.axis,
      automargin: true,
      ...yaxis,
    },
    ...rest,
  }
}
