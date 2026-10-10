// Simulator form state and validation. Inputs stay as strings while the user
// types; a SimulationRequest is produced only when every field is valid.

import type { Metadata, Scenario, SimulationRequest } from '../../api/types'
import { LIMITS } from '../../analysis/simulate'

export const CUSTOM_SCENARIO = 'custom'

export interface SimForm {
  scenarioId: string
  startDate: string
  endDate: string
  bookSize: string
  hedgeRatio: string
  borrowRatePct: string
  cashRatePct: string
  fundingSpreadPct: string
  rebateSpreadPct: string
  tradingCostBps: string
  bookBeta: string
  basisReturnPct: string
  terminationFloorPct: string
  hedgeCapacity: string
}

export type FormErrors = Partial<Record<keyof SimForm, string>>

export const DEFAULT_FORM: SimForm = {
  scenarioId: 'rates-2022',
  startDate: '2022-01-03',
  endDate: '2022-12-30',
  bookSize: '1,000,000',
  hedgeRatio: '0.6',
  borrowRatePct: '2',
  cashRatePct: '',
  fundingSpreadPct: '0',
  rebateSpreadPct: '0',
  tradingCostBps: '0',
  bookBeta: '1',
  basisReturnPct: '0',
  terminationFloorPct: '0',
  hedgeCapacity: '',
}

export function parseAmount(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, '')
  if (cleaned === '') return NaN
  const m = /^(\d*\.?\d+)([kmb]?)$/i.exec(cleaned)
  if (!m) return NaN
  const mult = { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase() as '' | 'k' | 'm' | 'b']
  return Number(m[1]) * mult
}

function parseNumber(s: string): number {
  return s.trim() === '' ? NaN : Number(s)
}

export function validateForm(form: SimForm, meta: Metadata | undefined): { request: SimulationRequest | null; errors: FormErrors } {
  const errors: FormErrors = {}

  const bookSize = parseAmount(form.bookSize)
  if (!Number.isFinite(bookSize)) errors.bookSize = 'Enter a dollar amount, e.g. 1,000,000 or 25m.'
  else if (bookSize < LIMITS.minBookSize) errors.bookSize = 'Minimum book size is $1,000.'
  else if (bookSize > LIMITS.maxBookSize) errors.bookSize = 'Maximum book size is $50bn.'

  const ratio = parseNumber(form.hedgeRatio)
  if (!Number.isFinite(ratio)) errors.hedgeRatio = 'Enter a number between 0 and 1.'
  else if (ratio < LIMITS.minRatio || ratio > LIMITS.maxRatio) errors.hedgeRatio = 'Hedge ratio must be between 0 and 1.'

  const borrowPct = parseNumber(form.borrowRatePct)
  if (!Number.isFinite(borrowPct)) errors.borrowRatePct = 'Enter a rate in percent.'
  else if (borrowPct < 0 || borrowPct > LIMITS.maxBorrowRate * 100) errors.borrowRatePct = 'Borrow rate must be between 0% and 25%.'

  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (!iso.test(form.startDate)) errors.startDate = 'Choose a start date.'
  if (!iso.test(form.endDate)) errors.endDate = 'Choose an end date.'
  if (!errors.startDate && !errors.endDate) {
    if (form.startDate >= form.endDate) errors.endDate = 'End date must be after start date.'
    else if (meta && form.endDate < meta.first_date) errors.endDate = `Data starts ${meta.first_date}.`
    else if (meta && form.startDate > meta.last_date) errors.startDate = `Data ends ${meta.last_date}.`
  }

  const specs = [
    ['cashRatePct', -99.999, 100], ['fundingSpreadPct', 0, 100],
    ['rebateSpreadPct', 0, 100], ['tradingCostBps', 0, 10000],
    ['bookBeta', 0, 3], ['basisReturnPct', -100, 100], ['terminationFloorPct', 0, 99],
  ] as const
  for (const [key, lo, hi] of specs) {
    if (key === 'cashRatePct' && form[key].trim() === '') continue
    const n = parseNumber(form[key])
    if (!Number.isFinite(n) || n < lo || n > hi) errors[key] = `Enter a number from ${lo} to ${hi}.`
  }
  const capacity = form.hedgeCapacity.trim() ? parseAmount(form.hedgeCapacity) : null
  if (capacity !== null && (!Number.isFinite(capacity) || capacity <= 0)) errors.hedgeCapacity = 'Enter a positive dollar limit or leave blank.'
  else if (capacity !== null && bookSize * ratio > capacity) errors.hedgeRatio = 'Initial hedge exceeds the assumed capacity.'
  if (Object.keys(errors).length) return { request: null, errors }
  return {
    request: {
      book_size: bookSize,
      hedge_ratio: ratio,
      start_date: form.startDate,
      end_date: form.endDate,
      annual_borrow_rate: borrowPct / 100,
      annual_cash_rate: form.cashRatePct.trim() ? Number(form.cashRatePct) / 100 : null,
      funding_spread: Number(form.fundingSpreadPct) / 100,
      rebate_spread: Number(form.rebateSpreadPct) / 100,
      round_trip_cost_bps: Number(form.tradingCostBps),
      book_beta: Number(form.bookBeta),
      annual_basis_return: Number(form.basisReturnPct) / 100,
      termination_floor: Number(form.terminationFloorPct) / 100,
      max_hedge_notional: capacity,
    },
    errors,
  }
}

export function applyScenario(form: SimForm, scenario: Scenario): SimForm {
  return { ...form, scenarioId: scenario.id, startDate: scenario.start_date, endDate: scenario.end_date }
}

export function requestKey(r: SimulationRequest): string {
  return JSON.stringify(r)
}
