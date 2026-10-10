// Metrics derived purely from a SimulationResponse (plus the request that
// produced it). Because these use only contract fields, they keep working
// unchanged when the mock is replaced by the real API.

import type { PathPoint, SimulationRequest, SimulationResponse, StrategyId } from '../api/types'
import { calendarDays, annualizedVol, drawdownSeries, maxDrawdown, simpleReturns } from './metrics'

export const STRATEGIES: StrategyId[] = ['unhedged', 'static_short_hedged', 'sjb_hedged']

export interface StrategyRisk {
  strategy: StrategyId
  finalValue: number
  finalPnl: number
  returnPct: number
  maxDrawdownPct: number
  peakDate: string | null
  troughDate: string | null
  annualizedVolPct: number
  worstDayPct: number
  hedgePnl: number
  borrowCost: number
}

export function seriesOf(paths: PathPoint[], k: StrategyId): number[] {
  return paths.map((p) => p[k])
}

export function strategyRisk(res: SimulationResponse, req: SimulationRequest): StrategyRisk[] {
  const dates = res.paths.map((p) => p.date)
  const unhedged = seriesOf(res.paths, 'unhedged')
  return STRATEGIES.map((k) => {
    const values = seriesOf(res.paths, k)
    const summary = res.summary.find((s) => s.strategy === k)
    const dd = maxDrawdown(values, dates)
    const rets = simpleReturns(values)
    const validReturns = values.slice(0, -1).every((v) => v > 0) && rets.every(Number.isFinite)
    const stopped = res.events.find((event) => event.strategy === k)
    const elapsedDays = calendarDays(res.effective_start_date, stopped?.date ?? res.effective_end_date)
    const finalValue = values[values.length - 1]
    return {
      strategy: k,
      finalValue,
      finalPnl: summary?.final_pnl ?? finalValue - req.book_size,
      returnPct: summary?.return_pct ?? (finalValue / req.book_size - 1) * 100,
      maxDrawdownPct: summary?.max_drawdown_pct ?? dd.pct,
      peakDate: dd.peakDate,
      troughDate: dd.troughDate,
      annualizedVolPct: validReturns ? annualizedVol(rets) * 100 : NaN,
      worstDayPct: validReturns && rets.length ? Math.min(...rets) * 100 : NaN,
      hedgePnl: finalValue - unhedged[unhedged.length - 1],
      borrowCost:
        k === 'static_short_hedged'
          ? (req.hedge_ratio * req.book_size * req.annual_borrow_rate * elapsedDays) / 365
          : 0,
    }
  })
}

export function drawdownPaths(paths: PathPoint[]): Record<StrategyId, number[]> {
  return {
    unhedged: drawdownSeries(seriesOf(paths, 'unhedged')),
    static_short_hedged: drawdownSeries(seriesOf(paths, 'static_short_hedged')),
    sjb_hedged: drawdownSeries(seriesOf(paths, 'sjb_hedged')),
  }
}

export interface MechanicsPoint {
  date: string
  /** Cumulative HYG return (decimal), recovered from the unhedged path. */
  hyg: number
  /** Static -1x reference: exactly the negative of HYG's cumulative return. */
  staticRef: number
  /** Cumulative SJB return (decimal) per $ of hedge notional. */
  sjb: number
}

/**
 * Recover per-dollar instrument returns from portfolio paths. Requires a
 * hedge ratio above zero, because SJB's return is only visible through the
 * hedge P/L.
 */
export function hedgeMechanics(res: SimulationResponse, req: SimulationRequest): MechanicsPoint[] | null {
  void req
  if (!res.instrument_returns.length) return null
  return res.instrument_returns.map((p) => ({ date: p.date, hyg: p.hyg_return, staticRef: -p.hyg_return, sjb: p.sjb_return }))
}

/** Realized annualized volatility (decimal) of HYG over the simulated window. */
export function windowHygVol(res: SimulationResponse): number {
  return annualizedVol(simpleReturns(res.instrument_returns.map((p) => 1 + p.hyg_return)))
}
