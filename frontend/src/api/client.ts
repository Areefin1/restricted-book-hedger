// API client. The UI only talks to the HedgerApi interface, so the mock can
// be swapped for the FastAPI backend without touching components.
//
// Default: the in-browser mock client (synthetic data). Setting
// VITE_API_BASE_URL switches to HTTP calls against the endpoints proposed in
// docs/team-plan.md §5. That path is untested until the backend exists.

import { mockApi } from '../mock/mockApi'
import { ApiRequestError } from './errors'
import type {
  ApiError,
  ConvexityResponse,
  Metadata,
  RecommendationRequest,
  RecommendationResponse,
  SanityResponse,
  Scenario,
  SimulationRequest,
  SimulationResponse,
} from './types'

export interface HedgerApi {
  readonly mode: 'mock' | 'http'
  getMetadata(): Promise<Metadata>
  getScenarios(): Promise<Scenario[]>
  runSimulation(req: SimulationRequest): Promise<SimulationResponse>
  getSanity(): Promise<SanityResponse>
  getConvexity(windowDays: number): Promise<ConvexityResponse>
  getRecommendation(req: RecommendationRequest): Promise<RecommendationResponse>
}

function httpApi(baseUrl: string): HedgerApi {
  const base = baseUrl.replace(/\/$/, '')
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${base}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      })
    } catch {
      throw new ApiRequestError('NETWORK', `Could not reach the API at ${base}.`)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null
      throw new ApiRequestError(body?.error.code ?? `HTTP_${res.status}`, body?.error.message ?? res.statusText)
    }
    return (await res.json()) as T
  }
  const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  return {
    mode: 'http',
    getMetadata: () => request('/api/metadata'),
    getScenarios: () => request('/api/scenarios'),
    runSimulation: (req) => post('/api/simulations', req),
    getSanity: () => request('/api/research/sanity'),
    getConvexity: (w) => request(`/api/research/convexity?window_days=${w}`),
    getRecommendation: (req) => post('/api/recommendations', req),
  }
}

const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

export const api: HedgerApi = baseUrl ? httpApi(baseUrl) : mockApi
