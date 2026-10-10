// Deterministic SYNTHETIC price series for HYG and SJB.
//
// These are not market prices. They are generated from a fixed seed so the
// prototype is reproducible and can be replaced by the cached price table
// served by the backend. Volatility regimes are loosely shaped after stress
// periods so the hedges have something to react to; the levels, dates, and
// returns are illustrative only.

export interface PriceRow {
  date: string
  hyg: number
  sjb: number
  rf_return: number
}

export const SYNTHETIC_DATA_VERSION = 'synthetic-v1-seed-42'

const SEED = 42
const START = '2015-01-02'
const END = '2024-12-31'
const HYG_START = 86
const SJB_START = 24
// Illustrative expense drag embedded in the synthetic SJB series (per year).
const SJB_ANNUAL_DRAG = 0.0095
// Daily tracking noise between SJB and an exact -1x of HYG.
const SJB_TRACKING_NOISE = 0.0004

interface Regime {
  from: string
  to: string
  /** Annualized volatility of HYG daily returns. */
  vol: number
  /** Annualized drift of HYG daily returns. */
  drift: number
}

const BASE: Omit<Regime, 'from' | 'to'> = { vol: 0.045, drift: 0.055 }

const REGIMES: Regime[] = [
  { from: '2015-06-01', to: '2016-02-12', vol: 0.085, drift: -0.12 },
  { from: '2016-02-15', to: '2016-06-30', vol: 0.07, drift: 0.16 },
  { from: '2018-10-01', to: '2018-12-24', vol: 0.075, drift: -0.16 },
  { from: '2020-02-21', to: '2020-03-23', vol: 0.4, drift: -3.2 },
  { from: '2020-03-24', to: '2020-06-30', vol: 0.18, drift: 0.55 },
  { from: '2022-01-03', to: '2022-10-14', vol: 0.1, drift: -0.04 },
  { from: '2022-10-17', to: '2023-05-31', vol: 0.13, drift: 0.04 },
  { from: '2024-07-01', to: '2024-08-09', vol: 0.09, drift: -0.02 },
]

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalSource(rand: () => number) {
  return () => {
    const u = Math.max(rand(), 1e-12)
    const v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Weekdays excluding a few fixed holidays. Not an exchange calendar. */
function tradingDays(start: string, end: string): string[] {
  const out: string[] = []
  const d = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (d <= last) {
    const dow = d.getUTCDay()
    const md = toIso(d).slice(5)
    if (dow !== 0 && dow !== 6 && md !== '01-01' && md !== '07-04' && md !== '12-25') {
      out.push(toIso(d))
    }
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

function regimeFor(date: string) {
  return REGIMES.find((r) => date >= r.from && date <= r.to) ?? BASE
}

function generate(): PriceRow[] {
  const rand = mulberry32(SEED)
  const normal = normalSource(rand)
  const days = tradingDays(START, END)
  const rows: PriceRow[] = [{ date: days[0], hyg: HYG_START, sjb: SJB_START, rf_return: 0 }]

  for (let i = 1; i < days.length; i++) {
    const { vol, drift } = regimeFor(days[i])
    const dailyVol = vol / Math.sqrt(252)
    // Occasional larger moves give the series fatter tails than a pure normal.
    const shock = rand() < 0.03 ? 2.5 : 1
    const hygRet = drift / 252 + dailyVol * shock * normal()
    // SJB resets daily: it targets -1x each day's HYG return, less drag.
    const sjbRet = -hygRet - SJB_ANNUAL_DRAG / 252 + SJB_TRACKING_NOISE * normal()
    const prev = rows[i - 1]
    rows.push({
      date: days[i],
      hyg: prev.hyg * (1 + hygRet),
      sjb: prev.sjb * (1 + sjbRet),
      rf_return: 0, // Explicit synthetic zero-cash scenario, not a market rate.
    })
  }
  return rows
}

export const SYNTHETIC_PRICES: PriceRow[] = generate()

export const SYNTHETIC_PROVENANCE =
  'Synthetic HYG/SJB total-return-style series generated in the browser from a fixed seed. ' +
  'SJB is modeled as a daily-reset -1x of HYG with an illustrative 0.95%/yr drag and small ' +
  'tracking noise. Not market data.'
