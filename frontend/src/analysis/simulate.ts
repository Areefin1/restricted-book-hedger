// Mock implementation of simulate_hedges (owned by Person B in Python).
// Mirrors the MVP accounting convention in docs/team-plan.md §7 so the
// frontend can be built against the response shape before the API exists.

import type { Assumption, PathPoint, SimulationRequest, SimulationResponse, SummaryRow } from '../api/types'
import type { PriceRow } from '../mock/syntheticPrices'
import { calendarDays, maxDrawdown } from './metrics'
import { cashFactors, modelValues } from './accounting'

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
        'Matched cash accounts: short proceeds earn cash less rebate haircut; SJB purchase pays cash plus funding spread. Synthetic cash defaults explicitly to zero; a constant cash override is supported.',
    },
    {
      label: 'Static short',
      detail: `Negative adjusted HYG return-series overlay sized at hedge ratio × initial book size; not an executable fixed-share ledger. Borrow cost ${(
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
        `ETF expenses are embedded and not deducted again. Assumed round-trip cost ${req.round_trip_cost_bps ?? 0} bps on initial notional, charged once after inception. Funding and rebate spreads are user assumptions.`,
    },
    { label: 'Research stress', detail: `Book beta ${req.book_beta ?? 1}, annual basis return ${req.annual_basis_return ?? 0}, equity floor ${req.termination_floor ?? 0}. Freeze at first closing breach, retaining overshoot. Not broker margin or executable liquidation; recalls and actual liquidity remain unmodeled. Capacity is user-supplied or unverified.` },
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
  if (req.max_hedge_notional != null && B * h > req.max_hedge_notional) throw new HedgerError('CAPACITY', 'Initial hedge exceeds assumed capacity.')
  const cash = cashFactors(rows, req)
  const keys = ['unhedged', 'static_short_hedged', 'sjb_hedged'] as const
  const events: SimulationResponse['events'] = []
  const stopped: (number | null)[] = [null, null, null]
  const hyg0 = rows[0].hyg
  const sjb0 = rows[0].sjb

  const paths: PathPoint[] = rows.map((r, i) => {
    const g = r.hyg / hyg0
    const s = r.sjb / sjb0
    const values = modelValues(g, s, cash[i], calendarDays(rows[0].date, r.date), B, h, req.annual_borrow_rate, req)
    for (let k = 0; k < 3; k++) {
      if (stopped[k] !== null) values[k] = stopped[k]!
      else if (values[k] <= B * (req.termination_floor ?? 0)) {
        stopped[k] = values[k]
        events.push({ date: r.date, strategy: keys[k], reason: 'Research equity-floor cutoff; closing overshoot retained, not executable liquidation.' })
      }
    }
    const [book, staticValue, sjbValue] = values
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
    events,
    instrument_returns: rows.map((r) => ({ date: r.date, hyg_return: r.hyg / hyg0 - 1, sjb_return: r.sjb / sjb0 - 1 })),
    exposures: rows.map((r) => {
      const days = calendarDays(rows[0].date, r.date)
      const book = 1 + (req.book_beta ?? 1) * (r.hyg / hyg0 - 1) + (req.annual_basis_return ?? 0) * days / 365
      const active = (k: typeof keys[number]) => book > 0 && !events.some((e) => e.strategy === k && e.date <= r.date)
      return { date: r.date, static_short_ratio: active('static_short_hedged') ? h * r.hyg / hyg0 / book : null, sjb_ratio: active('sjb_hedged') ? h * r.sjb / sjb0 / book : null }
    }),
    paths,
    summary,
    effective_start_date: rows[0].date,
    effective_end_date: rows[rows.length - 1].date,
    assumptions: simulationAssumptions(req),
    data_version: dataVersion,
  }
}
