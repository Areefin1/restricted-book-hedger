import { createContext, useContext, useEffect } from 'react'
import type { ChatView, ChartId, ChartViewport } from '../../api/types'

export type ChatSettings = Pick<ChatView, 'window_days' | 'instrument' | 'chart_mode' | 'example'>
export const ChatViewContext = createContext<{
  view: ChatView
  ready: boolean
  updateChart: (chart: ChartId, viewport: ChartViewport | null) => void
  updateSettings: (settings: Partial<ChatSettings>) => void
  updateResource: (name: string, ready: boolean | null) => void
} | null>(null)

export function useChatView() { return useContext(ChatViewContext) }

export function useChatSettings(settings: Partial<ChatSettings>) {
  const update = useContext(ChatViewContext)?.updateSettings
  const key = JSON.stringify(settings)
  useEffect(() => { update?.(JSON.parse(key) as Partial<ChatSettings>) }, [update, key])
}

export function useChatResource(name: string, ready: boolean) {
  const update = useContext(ChatViewContext)?.updateResource
  useEffect(() => { update?.(name, ready); return () => update?.(name, null) }, [update, name, ready])
}
