import type { RatioGridRow, RecommendationRequest, RecommendationResponse, SimulationRequest } from '../api/types'
import type { PriceRow } from '../mock/syntheticPrices'
import { calendarDays, median } from './metrics'
import { HedgerError, simulationAssumptions, sliceRange } from './simulate'
import { cashFactors, modelValues } from './accounting'

export const RATIO_GRID = Array.from({ length: 21 }, (_, i) => i / 20)
export const OBJECTIVE_TEXT = 'Maximize the worst ending portfolio return across overlapping rolling windows.'

export function recommendRatio(prices: PriceRow[], req: RecommendationRequest, dataVersion: string): RecommendationResponse {
  const rows = sliceRange(prices, req.start_date, req.end_date)
  const w = req.window_days
  if (rows.length <= w) throw new HedgerError('INVALID_RANGE', `A ${w}-interval window needs ${w + 1} prices.`)
  const cash = cashFactors(rows, req)
  const capacity = req.max_hedge_notional
  const grid: RatioGridRow[] = RATIO_GRID.filter((h) => capacity == null || h * (req.book_size ?? 1e6) <= capacity).map((h) => {
    const rets: number[] = []
    for (let i = 0; i + w < rows.length; i++) {
      let value = 1
      for (let j = i; j <= i + w; j++) {
        const p = rows[j]
        const v = modelValues(p.hyg / rows[i].hyg, p.sjb / rows[i].sjb, cash[j] / cash[i], calendarDays(rows[i].date, p.date), 1, h, req.annual_borrow_rate, req)
        value = v[req.instrument === 'sjb' ? 2 : 1]
        if (value <= (req.termination_floor ?? 0)) break
      }
      rets.push((value - 1) * 100)
    }
    return { hedge_ratio: h, worst_window_return_pct: Math.min(...rets), median_window_return_pct: median(rets), best_window_return_pct: Math.max(...rets) }
  })
  const best = grid.reduce((a, b) => b.worst_window_return_pct > a.worst_window_return_pct + 1e-9 ? b : a)
  return {
    instrument: req.instrument, window_days: w, objective: OBJECTIVE_TEXT,
    recommended_ratio: best.hedge_ratio, objective_value_pct: best.worst_window_return_pct, grid,
    windows_evaluated: rows.length - w, in_sample: true,
    effective_start_date: rows[0].date, effective_end_date: rows[rows.length - 1].date,
    assumptions: [...simulationAssumptions({ ...req, book_size: req.book_size ?? 1e6, hedge_ratio: 0 } as SimulationRequest),
      { label: 'Historical selection', detail: 'Same overlapping history used for selection and evaluation; no holdout. Each window starts a fresh hedge; capacity excludes infeasible ratios. Ties favor smaller ratios.' }],
    data_version: dataVersion,
  }
}
