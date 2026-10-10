// Mock implementation of simulate_hedges (owned by Person B in Python).
// Mirrors the MVP accounting convention in docs/team-plan.md §7 so the
// frontend can be built against the response shape before the API exists.

import type { Assumption, PathPoint, SimulationRequest, SimulationResponse, SummaryRow } from '../api/types'
import type { PriceRow } from '../mock/syntheticPrices'
import { calendarDays, maxDrawdown } from './metrics'

export class HedgerError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export const LIMITS = {
  minBookSize: 1_000,
  maxBookSize: 50_000_000_000,
  minRatio: 0,
  maxRatio: 1,
  maxBorrowRate: 0.25,
}

/** Rows within [start, end]; nontrading boundary dates resolve inward. */
export function sliceRange(prices: PriceRow[], start: string, end: string): PriceRow[] {
  return prices.filter((p) => p.date >= start && p.date <= end)
}

export function validateSimulationRequest(req: SimulationRequest): void {
  const { book_size, hedge_ratio, annual_borrow_rate, start_date, end_date } = req
  if (!Number.isFinite(book_size) || book_size < LIMITS.minBookSize || book_size > LIMITS.maxBookSize) {
    throw new HedgerError('INVALID_BOOK_SIZE', 'Book size must be between $1,000 and $50bn.')
  }
  if (!Number.isFinite(hedge_ratio) || hedge_ratio < LIMITS.minRatio || hedge_ratio > LIMITS.maxRatio) {
    throw new HedgerError('INVALID_HEDGE_RATIO', 'Hedge ratio must be between 0 and 1.')
  }
  if (!Number.isFinite(annual_borrow_rate) || annual_borrow_rate < 0 || annual_borrow_rate > LIMITS.maxBorrowRate) {
    throw new HedgerError('INVALID_BORROW_RATE', 'Borrow rate must be between 0% and 25%.')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    throw new HedgerError('INVALID_DATE', 'Dates must use YYYY-MM-DD.')
  }
  if (start_date >= end_date) {
    throw new HedgerError('INVALID_RANGE', 'Start date must be before end date.')
  }
}

export function simulationAssumptions(req: SimulationRequest): Assumption[] {
  return [
    {
      label: 'Proxy',
      detail: 'The restricted book is modeled as tracking HYG. A real bond book may behave differently.',
    },
    {
      label: 'Capital accounting',
      detail:
        'Each series is original book value plus hedge P/L. The SJB purchase is offset by a financing account at zero interest.',
    },
    {
      label: 'Static short',
      detail: `Short HYG worth hedge ratio × book size at the start, share count held fixed. Borrow cost ${(
        req.annual_borrow_rate * 100
      ).toFixed(2)}%/yr accrues on the initial short notional using actual elapsed calendar days / 365.`,
    },
    {
      label: 'SJB hedge',
      detail:
        'Buy SJB worth hedge ratio × book size at the start and hold. SJB resets to -1x daily, so its multi-day return is path dependent.',
    },
    {
      label: 'Fees',
      detail:
        'ETF expenses are already embedded in the price series and are not deducted again. Spreads and trading costs are not modeled.',
    },
  ]
}

export function simulateHedges(
  prices: PriceRow[],
  req: SimulationRequest,
  dataVersion: string,
): SimulationResponse {
  validateSimulationRequest(req)
  const rows = sliceRange(prices, req.start_date, req.end_date)
  if (rows.length < 2) {
    throw new HedgerError('INVALID_RANGE', 'At least two trading days are required in the selected range.')
  }

  const B = req.book_size
  const h = req.hedge_ratio
  const dailyBorrow = (h * B * req.annual_borrow_rate) / 365
  const hyg0 = rows[0].hyg
  const sjb0 = rows[0].sjb

  const paths: PathPoint[] = rows.map((r) => {
    const g = r.hyg / hyg0
    const s = r.sjb / sjb0
    const book = B * g
    const staticValue = book - h * B * (g - 1) - dailyBorrow * calendarDays(rows[0].date, r.date)
    const sjbValue = book + h * B * (s - 1)
    return {
      date: r.date,
      unhedged: book,
      static_short_hedged: staticValue,
      sjb_hedged: sjbValue,
      unhedged_pnl: book - B,
      static_short_hedged_pnl: staticValue - B,
      sjb_hedged_pnl: sjbValue - B,
    }
  })

  const dates = paths.map((p) => p.date)
  const keys = ['unhedged', 'static_short_hedged', 'sjb_hedged'] as const
  const summary: SummaryRow[] = keys.map((k) => {
    const values = paths.map((p) => p[k])
    const final = values[values.length - 1]
    return {
      strategy: k,
      final_pnl: final - B,
      return_pct: (final / B - 1) * 100,
      max_drawdown_pct: maxDrawdown(values, dates).pct,
    }
  })

  return {
    paths,
    summary,
    effective_start_date: rows[0].date,
    effective_end_date: rows[rows.length - 1].date,
    assumptions: simulationAssumptions(req),
    data_version: dataVersion,
  }
}
