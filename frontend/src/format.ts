// Display formatting. Inputs follow the API unit conventions: dollars are
// numbers, *_pct fields are percentage points, research values are decimals.

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export function fmtUsd(v: number): string {
  return usd0.format(v)
}

export function fmtUsdCompact(v: number): string {
  return `${v < 0 ? '-' : ''}$${compact.format(Math.abs(v))}`
}

export function fmtSignedUsd(v: number): string {
  const s = usd0.format(Math.abs(v))
  if (Math.abs(v) < 0.5) return s
  return v > 0 ? `+${s}` : `-${s}`
}

/** Percentage points in, e.g. 5.234 -> "5.23%". */
export function fmtPct(pp: number, digits = 2): string {
  return `${pp.toFixed(digits)}%`
}

export function fmtSignedPct(pp: number, digits = 2): string {
  const s = Math.abs(pp).toFixed(digits)
  if (Number(s) === 0) return `${s}%`
  return pp > 0 ? `+${s}%` : `-${s}%`
}

/** Decimal in, e.g. 0.0523 -> "5.23%". */
export function fmtDecPct(dec: number, digits = 2): string {
  return fmtPct(dec * 100, digits)
}

export function fmtSignedDecPct(dec: number, digits = 2): string {
  return fmtSignedPct(dec * 100, digits)
}

const dateFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return dateFmt.format(new Date(`${iso}T00:00:00Z`))
}

export function signClass(v: number): string {
  if (v > 1e-9) return 'pos'
  if (v < -1e-9) return 'neg'
  return ''
}
