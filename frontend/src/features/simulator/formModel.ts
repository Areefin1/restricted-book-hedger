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
}

export type FormErrors = Partial<Record<keyof SimForm, string>>

export const DEFAULT_FORM: SimForm = {
  scenarioId: 'rates-2022',
  startDate: '2022-01-03',
  endDate: '2022-12-30',
  bookSize: '1,000,000',
  hedgeRatio: '0.6',
  borrowRatePct: '2',
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

  if (Object.keys(errors).length) return { request: null, errors }
  return {
    request: {
      book_size: bookSize,
      hedge_ratio: ratio,
      start_date: form.startDate,
      end_date: form.endDate,
      annual_borrow_rate: borrowPct / 100,
    },
    errors,
  }
}

export function applyScenario(form: SimForm, scenario: Scenario): SimForm {
  return { ...form, scenarioId: scenario.id, startDate: scenario.start_date, endDate: scenario.end_date }
}

export function requestKey(r: SimulationRequest): string {
  return [r.book_size, r.hedge_ratio, r.start_date, r.end_date, r.annual_borrow_rate].join('|')
}
