// Provisional scenario presets. Person B owns and validates the real
// presets (docs/team-plan.md §7.11); these are placeholders for the UI.

import type { Scenario } from '../api/types'
import type { PriceRow } from '../mock/syntheticPrices'
import { annualizedVol, simpleReturns } from './metrics'

const CHOPPY_WINDOW = 126
const CHOPPY_MAX_NET_MOVE = 0.02

/**
 * Stated rule for the choppy preset: among all 126-trading-day windows whose
 * net HYG move is within ±2%, pick the one with the highest realized
 * volatility, excluding windows that overlap the other stress presets.
 */
function choppyWindow(prices: PriceRow[], exclude: Scenario[]): { start: string; end: string } | null {
  const rets = simpleReturns(prices.map((p) => p.hyg))
  let best: { start: string; end: string; vol: number } | null = null
  for (let i = 0; i + CHOPPY_WINDOW < prices.length; i++) {
    const start = prices[i].date
    const end = prices[i + CHOPPY_WINDOW].date
    if (exclude.some((x) => start <= x.end_date && end >= x.start_date)) continue
    const net = prices[i + CHOPPY_WINDOW].hyg / prices[i].hyg - 1
    if (Math.abs(net) > CHOPPY_MAX_NET_MOVE) continue
    const vol = annualizedVol(rets.slice(i, i + CHOPPY_WINDOW))
    if (!best || vol > best.vol) best = { start, end, vol }
  }
  return best
}

export function buildScenarios(prices: PriceRow[]): Scenario[] {
  const first = prices[0].date
  const last = prices[prices.length - 1].date
  const scenarios: Scenario[] = [
    {
      id: 'covid-2020',
      name: '2020 stress',
      start_date: '2020-02-03',
      end_date: '2020-06-30',
      rule: 'Provisional dates around the 2020 stress period. Exact dates pending validation.',
    },
    {
      id: 'rates-2022',
      name: '2022 drawdown',
      start_date: '2022-01-03',
      end_date: '2022-12-30',
      rule: 'Calendar 2022. Exact dates pending validation.',
    },
  ]
  const choppy = choppyWindow(prices, scenarios)
  if (choppy) {
    scenarios.push({
      id: 'choppy',
      name: 'Choppy period',
      start_date: choppy.start,
      end_date: choppy.end,
      rule: 'Highest realized volatility among 126-day windows with a net HYG move within ±2%, excluding windows that overlap the other stress presets.',
    })
  }
  scenarios.push({ id: 'full', name: 'Full history', start_date: first, end_date: last, rule: 'All available data.' })
  return scenarios
}
