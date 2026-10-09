// Small numeric helpers shared by the mock analysis modules.
// The authoritative implementations belong in backend/app/hedger (see
// docs/team-plan.md); these mirror the intended definitions so the prototype
// can run on sample data.

export const TRADING_DAYS_PER_YEAR = 252

export interface Drawdown {
  /** Largest fall from a previous peak, as nonnegative percentage points. */
  pct: number
  peakDate: string | null
  troughDate: string | null
}

export function maxDrawdown(values: number[], dates: string[]): Drawdown {
  let peak = -Infinity
  let peakIdx = 0
  let best: Drawdown = { pct: 0, peakDate: null, troughDate: null }
  for (let i = 0; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i]
      peakIdx = i
    }
    const dd = peak > 0 ? (1 - values[i] / peak) * 100 : 0
    if (dd > best.pct) {
      best = { pct: dd, peakDate: dates[peakIdx], troughDate: dates[i] }
    }
  }
  return best
}

/** Drawdown series (nonnegative percentage points) for an underwater chart. */
export function drawdownSeries(values: number[]): number[] {
  let peak = -Infinity
  return values.map((v) => {
    peak = Math.max(peak, v)
    return peak > 0 ? (1 - v / peak) * 100 : 0
  })
}

export function simpleReturns(values: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < values.length; i++) out.push(values[i] / values[i - 1] - 1)
  return out
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return NaN
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}

/** Annualized volatility (decimal) of daily simple returns. */
export function annualizedVol(dailyReturns: number[]): number {
  return stdev(dailyReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

export interface Ols {
  beta: number
  intercept: number
  rSquared: number
  correlation: number
}

export function ols(x: number[], y: number[]): Ols | null {
  if (x.length !== y.length || x.length < 3) return null
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  if (sxx === 0 || syy === 0) return null
  const beta = sxy / sxx
  const correlation = sxy / Math.sqrt(sxx * syy)
  return { beta, intercept: my - beta * mx, rSquared: correlation ** 2, correlation }
}
