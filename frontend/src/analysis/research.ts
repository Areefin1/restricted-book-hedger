// Mock implementations of run_sanity_check and calculate_rolling_windows
// (owned by Person C in Python). Research uses the full price history.

import type { ConvexityResponse, RollingWindowPoint, SanityResponse } from '../api/types'
import type { PriceRow } from '../mock/syntheticPrices'
import { annualizedVol, mean, ols, simpleReturns } from './metrics'
import { HedgerError } from './simulate'

export const PERMITTED_WINDOWS = [21, 63, 126] as const

export function runSanityCheck(prices: PriceRow[], dataVersion: string): SanityResponse {
  const hyg = simpleReturns(prices.map((p) => p.hyg))
  const sjb = simpleReturns(prices.map((p) => p.sjb))
  const fit = ols(hyg, sjb)
  return {
    points: hyg.map((r, i) => ({ date: prices[i + 1].date, hyg_return: r, sjb_return: sjb[i] })),
    beta: fit?.beta ?? null,
    intercept_daily: fit?.intercept ?? null,
    r_squared: fit?.rSquared ?? null,
    correlation: fit?.correlation ?? null,
    observations: hyg.length,
    notes: [
      'OLS of SJB daily return on HYG daily return over the full history.',
      'A beta near -1 indicates inverse co-movement with HYG, not exact benchmark replication. The intercept mixes expenses, benchmark differences, tracking error, and noise.',
    ],
    data_version: dataVersion,
  }
}

/**
 * A window of N trading days uses N daily return intervals, which needs
 * N + 1 price observations. Windows overlap (step of one day).
 */
export function calculateRollingWindows(
  prices: PriceRow[],
  windowDays: number,
  dataVersion: string,
): ConvexityResponse {
  if (!(PERMITTED_WINDOWS as readonly number[]).includes(windowDays)) {
    throw new HedgerError('INVALID_WINDOW', `window_days must be one of ${PERMITTED_WINDOWS.join(', ')}.`)
  }
  const hygRets = simpleReturns(prices.map((p) => p.hyg))
  const points: RollingWindowPoint[] = []
  for (let i = 0; i + windowDays < prices.length; i++) {
    const a = prices[i]
    const b = prices[i + windowDays]
    points.push({
      start_date: a.date,
      end_date: b.date,
      hyg_return: b.hyg / a.hyg - 1,
      sjb_return: b.sjb / a.sjb - 1,
      hyg_realized_vol: annualizedVol(hygRets.slice(i, i + windowDays)),
    })
  }
  return {
    window_days: windowDays,
    points,
    notes: [
      `Each point is one ${windowDays}-trading-day window (${windowDays} return intervals, ${windowDays + 1} prices).`,
      'Windows overlap by construction, so neighboring points are highly correlated and are not independent observations.',
      'The dashed line y = -x is what a static -1x short would have returned before costs.',
    ],
    data_version: dataVersion,
  }
}

export interface VolBucket {
  label: string
  volLow: number
  volHigh: number
  count: number
  avgHyg: number
  avgSjb: number
  /** Average SJB return minus the static -1x reference (-HYG return). */
  avgGap: number
  /** Share of windows where SJB beat the static -1x reference. */
  shareSjbAhead: number
}

/** Split rolling windows into realized-volatility terciles. */
export function volatilityBuckets(points: RollingWindowPoint[]): VolBucket[] {
  if (points.length < 3) return []
  const sorted = [...points].sort((a, b) => a.hyg_realized_vol - b.hyg_realized_vol)
  const n = sorted.length
  const cuts = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n]
  const labels = ['Low volatility', 'Medium volatility', 'High volatility']
  return labels.map((label, k) => {
    const group = sorted.slice(cuts[k], cuts[k + 1])
    const gaps = group.map((p) => p.sjb_return + p.hyg_return)
    return {
      label,
      volLow: group[0].hyg_realized_vol,
      volHigh: group[group.length - 1].hyg_realized_vol,
      count: group.length,
      avgHyg: mean(group.map((p) => p.hyg_return)),
      avgSjb: mean(group.map((p) => p.sjb_return)),
      avgGap: mean(gaps),
      shareSjbAhead: gaps.filter((g) => g > 0).length / group.length,
    }
  })
}
