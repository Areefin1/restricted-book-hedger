// In-browser stand-in for the FastAPI service. Runs the mock analysis
// modules on synthetic prices and returns contract-shaped responses.
// It is not a backend and does not fetch market data.

import type { HedgerApi } from '../api/client'
import { ApiRequestError } from '../api/errors'
import { recommendRatio } from '../analysis/recommend'
import { calculateRollingWindows, runSanityCheck } from '../analysis/research'
import { buildScenarios } from '../analysis/scenarios'
import { HedgerError, simulateHedges } from '../analysis/simulate'
import { SYNTHETIC_DATA_VERSION, SYNTHETIC_PRICES, SYNTHETIC_PROVENANCE } from './syntheticPrices'

// A short delay so loading states behave as they will against a real API.
const LATENCY_MS = 180

function respond<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn())
      } catch (e) {
        if (e instanceof HedgerError) reject(new ApiRequestError(e.code, e.message))
        else reject(e)
      }
    }, LATENCY_MS)
  })
}

const prices = SYNTHETIC_PRICES
const version = SYNTHETIC_DATA_VERSION

export const mockApi: HedgerApi = {
  mode: 'mock',
  getMetadata: () =>
    respond(() => ({
      first_date: prices[0].date,
      last_date: prices[prices.length - 1].date,
      trading_days: prices.length,
      data_version: version,
      provenance: SYNTHETIC_PROVENANCE,
      is_synthetic: true,
      features: { recommendation: true },
    })),
  getScenarios: () => respond(() => buildScenarios(prices)),
  runSimulation: (req) => respond(() => simulateHedges(prices, req, version)),
  getSanity: () => respond(() => runSanityCheck(prices, version)),
  getConvexity: (w) => respond(() => calculateRollingWindows(prices, w, version)),
  getRecommendation: (req) => respond(() => recommendRatio(prices, req, version)),
}
