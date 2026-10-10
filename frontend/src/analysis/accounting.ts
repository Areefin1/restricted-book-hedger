import type { ModelingOptions } from '../api/types'
import type { PriceRow } from '../mock/syntheticPrices'
import { calendarDays } from './metrics'

export function cashFactors(rows: PriceRow[], options: ModelingOptions): number[] {
  const out = [1]
  for (let i = 1; i < rows.length; i++) {
    const days = calendarDays(rows[i - 1].date, rows[i].date)
    const ret = options.annual_cash_rate == null ? rows[i].rf_return : Math.expm1(Math.log1p(options.annual_cash_rate) * days / 365)
    out.push(out[i - 1] * (1 + ret))
  }
  return out
}

/** Same return-series overlay convention as backend accounting.py. */
export function modelValues(g: number, s: number, cash: number, days: number, B: number, h: number, borrow: number, o: ModelingOptions): number[] {
  const book = B * (1 + (o.book_beta ?? 1) * (g - 1) + (o.annual_basis_return ?? 0) * days / 365)
  const n = B * h
  const cost = days > 0 ? n * (o.round_trip_cost_bps ?? 0) / 10000 : 0
  const rebate = cash * Math.exp(-(o.rebate_spread ?? 0) * days / 365)
  const funding = cash * Math.exp((o.funding_spread ?? 0) * days / 365)
  return [book, book - n * (g - 1) + n * (rebate - 1) - n * borrow * days / 365 - cost,
    book + n * (s - 1) - n * (funding - 1) - cost]
}
