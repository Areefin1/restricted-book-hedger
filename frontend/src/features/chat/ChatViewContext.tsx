import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { ChatPage, ChartId, ChartViewport } from '../../api/types'
import { ChatViewContext as Context, type ChatSettings as Settings } from './chatView'

const PAGE_CHARTS: Record<ChatPage, ChartId[]> = {
  simulator: ['portfolio'], risk: ['drawdown', 'exposure', 'max-drawdown'], strategies: ['mechanics'],
  research: ['daily', 'convexity', 'volatility'], recommendation: ['ratio-search'], assumptions: [],
}

export function ChatViewProvider({ page, children }: { page: ChatPage; children: ReactNode }) {
  const [charts, setCharts] = useState<Partial<Record<ChartId, ChartViewport>>>({})
  const [settings, setSettings] = useState<Settings>({ window_days: 63, instrument: 'sjb', chart_mode: 'value', example: 'choppy' })
  const [resources, setResources] = useState<Record<string, boolean>>({})
  const updateChart = useCallback((chart: ChartId, viewport: ChartViewport | null) => {
    setCharts(previous => {
      if (JSON.stringify(previous[chart] ?? null) === JSON.stringify(viewport)) return previous
      const next = { ...previous }
      if (viewport) next[chart] = viewport
      else delete next[chart]
      return next
    })
  }, [])
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(previous => Object.entries(patch).every(([key, value]) => previous[key as keyof Settings] === value)
      ? previous : { ...previous, ...patch })
  }, [])
  const updateResource = useCallback((name: string, ready: boolean | null) => {
    setResources(previous => {
      if ((previous[name] ?? null) === ready) return previous
      const next = { ...previous }
      if (ready === null) delete next[name]
      else next[name] = ready
      return next
    })
  }, [])
  const value = useMemo(() => ({
    view: { page, ...settings, charts: PAGE_CHARTS[page].flatMap(id => charts[id] ? [charts[id]!] : []) },
    ready: page === 'research' ? resources.research === true : page === 'recommendation' ? resources.recommendation === true : true,
    updateChart, updateSettings, updateResource,
  }), [page, settings, charts, resources, updateChart, updateSettings, updateResource])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

