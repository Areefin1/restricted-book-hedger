// Mock implementation of recommend_ratio (optional, owned by Person B).
// Objective (docs/team-plan.md §7.8): choose the hedge ratio that minimizes
// the worst ending portfolio return across rolling windows. This is NOT the
// same as minimizing within-window maximum drawdown.

import type { RatioGridRow, RecommendationRequest, RecommendationResponse } from '../api/types'
import type { PriceRow } from '../mock/syntheticPrices'
import { TRADING_DAYS_PER_YEAR, median } from './metrics'
import { HedgerError, sliceRange } from './simulate'

export const RATIO_GRID = Array.from({ length: 21 }, (_, i) => i / 20)

export const OBJECTIVE_TEXT =
  'Minimize the worst ending portfolio return across overlapping rolling windows (equivalently, maximize the worst-window return).'

export function recommendRatio(
  prices: PriceRow[],
  req: RecommendationRequest,
  dataVersion: string,
): RecommendationResponse {
  const rows = sliceRange(prices, req.start_date, req.end_date)
  const w = req.window_days
  if (rows.length < w + 1) {
    throw new HedgerError(
      'INVALID_RANGE',
      `The selected range has ${rows.length} trading days; a ${w}-day window needs at least ${w + 1}.`,
    )
  }

  const windows: { hyg: number; sjb: number }[] = []
  for (let i = 0; i + w < rows.length; i++) {
    windows.push({
      hyg: rows[i + w].hyg / rows[i].hyg - 1,
      sjb: rows[i + w].sjb / rows[i].sjb - 1,
    })
  }

  // Each window starts with a fresh hedge sized at h × book value.
  const borrow = (req.annual_borrow_rate * w) / TRADING_DAYS_PER_YEAR
  const windowReturn = (h: number, x: { hyg: number; sjb: number }) =>
    req.instrument === 'static_short' ? (1 - h) * x.hyg - h * borrow : x.hyg + h * x.sjb

  const grid: RatioGridRow[] = RATIO_GRID.map((h) => {
    const rets = windows.map((x) => windowReturn(h, x))
    return {
      hedge_ratio: h,
      worst_window_return_pct: Math.min(...rets) * 100,
      median_window_return_pct: median(rets) * 100,
      best_window_return_pct: Math.max(...rets) * 100,
    }
  })

  // Highest worst-window return; ties go to the smaller ratio.
  const best = grid.reduce((a, b) => (b.worst_window_return_pct > a.worst_window_return_pct + 1e-9 ? b : a))

  return {
    instrument: req.instrument,
    objective: OBJECTIVE_TEXT,
    recommended_ratio: best.hedge_ratio,
    objective_value_pct: best.worst_window_return_pct,
    grid,
    windows_evaluated: windows.length,
    in_sample: true,
    effective_start_date: rows[0].date,
    effective_end_date: rows[rows.length - 1].date,
    assumptions: [
      { label: 'In-sample', detail: 'The ratio is selected and evaluated on the same history. No out-of-sample test has been run.' },
      { label: 'Fresh hedge per window', detail: `Each ${w}-day window starts with book value 1 and a new hedge of h × book value.` },
      {
        label: 'Costs',
        detail:
          req.instrument === 'static_short'
            ? `Borrow cost ${(req.annual_borrow_rate * 100).toFixed(2)}%/yr on the short notional. No spreads or trading costs.`
            : 'SJB expenses are embedded in its price series. Financing is assumed free. No spreads or trading costs.',
      },
      { label: 'Grid', detail: 'Hedge ratios 0 to 1 in steps of 0.05. A result at 1.0 is a boundary of the search, not a universal answer.' },
    ],
    data_version: dataVersion,
  }
}
