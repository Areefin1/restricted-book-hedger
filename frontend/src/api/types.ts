// Frontend types for the Restricted Book Hedger API.
//
// Mirrors docs/api-contract.md. Unit conventions:
//   - dates are YYYY-MM-DD strings
//   - currency values are numeric dollars
//   - request rates/ratios are decimals (0.02 = 2%)
//   - fields ending in _pct are percentage points (5.0 = 5%)
//   - drawdown is a nonnegative loss magnitude
//   - research returns and volatility are decimals

export type IsoDate = string

export type StrategyId = 'unhedged' | 'static_short_hedged' | 'sjb_hedged'

export interface ApiError {
  error: { code: string; message: string }
}

// GET /api/metadata
export interface Metadata {
  first_date: IsoDate
  last_date: IsoDate
  trading_days: number
  data_version: string
  /** Description of the source and any provenance limitations. */
  provenance: string
  /** True only for explicitly synthetic data. */
  is_synthetic: boolean | null
  verified?: boolean
  cash_provenance?: string
  features: { recommendation: boolean }
  retrieved_at?: string | null
  source?: string
  adjustment?: string
  notes?: string[]
}

// GET /api/scenarios
export interface Scenario {
  id: string
  name: string
  start_date: IsoDate
  end_date: IsoDate
  /** How the dates were chosen. */
  rule: string
}

// POST /api/simulations
export interface ModelingOptions {
  annual_cash_rate?: number | null
  funding_spread?: number
  rebate_spread?: number
  round_trip_cost_bps?: number
  book_beta?: number
  annual_basis_return?: number
  termination_floor?: number
  max_hedge_notional?: number | null
}

export interface SimulationRequest extends ModelingOptions {
  book_size: number
  hedge_ratio: number
  start_date: IsoDate
  end_date: IsoDate
  annual_borrow_rate: number
}

export interface PathPoint {
  date: IsoDate
  unhedged: number
  static_short_hedged: number
  sjb_hedged: number
  /** Cumulative portfolio profit/loss in dollars, including modeled costs. */
  unhedged_pnl: number
  static_short_hedged_pnl: number
  sjb_hedged_pnl: number
}

export interface SummaryRow {
  strategy: StrategyId
  final_pnl: number
  return_pct: number
  max_drawdown_pct: number
}

export interface Assumption {
  label: string
  detail: string
}

export interface SimulationResponse {
  instrument_returns: { date: IsoDate; hyg_return: number; sjb_return: number }[]
  exposures: { date: IsoDate; static_short_ratio: number | null; sjb_ratio: number | null }[]
  events: { date: IsoDate; strategy: StrategyId; reason: string }[]
  paths: PathPoint[]
  summary: SummaryRow[]
  effective_start_date: IsoDate
  effective_end_date: IsoDate
  assumptions: Assumption[]
  data_version: string
}

// GET /api/research/sanity
export interface DailyReturnPoint {
  date: IsoDate
  hyg_return: number
  sjb_return: number
}

export interface SanityResponse {
  points: DailyReturnPoint[]
  /** OLS of SJB daily return on HYG daily return. null when unavailable. */
  beta: number | null
  intercept_daily: number | null
  r_squared: number | null
  correlation: number | null
  observations: number
  notes: string[]
  data_version: string
}

// GET /api/research/convexity?window_days=63
export interface RollingWindowPoint {
  hyg_total_return: number
  sjb_total_return: number
  cash_return: number
  hyg_sample_vol: number
  start_date: IsoDate
  end_date: IsoDate
  hyg_return: number
  sjb_return: number
  /** Annualized realized volatility of HYG daily returns in the window. */
  hyg_realized_vol: number
}

export interface ConvexityResponse {
  window_days: number
  points: RollingWindowPoint[]
  notes: string[]
  data_version: string
}

// POST /api/recommendations (optional feature)
export type HedgeInstrument = 'static_short' | 'sjb'

export interface RecommendationRequest extends ModelingOptions {
  book_size?: number
  start_date: IsoDate
  end_date: IsoDate
  instrument: HedgeInstrument
  window_days: number
  annual_borrow_rate: number
}

export interface RatioGridRow {
  hedge_ratio: number
  worst_window_return_pct: number
  median_window_return_pct: number
  best_window_return_pct: number
}

export interface RecommendationResponse {
  window_days: number
  instrument: HedgeInstrument
  objective: string
  recommended_ratio: number
  objective_value_pct: number
  grid: RatioGridRow[]
  windows_evaluated: number
  in_sample: boolean
  effective_start_date: IsoDate
  effective_end_date: IsoDate
  assumptions: Assumption[]
  data_version: string
}
