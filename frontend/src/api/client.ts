// API client. The UI only talks to the HedgerApi interface, so the mock can
// be swapped for the FastAPI backend without touching components.
//
// Default: same-origin HTTP (Vite proxies /api during development).
// VITE_API_BASE_URL overrides the origin; VITE_USE_MOCK=true opts into synthetic data.

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
  ExplanationRequest,
  ExplanationResponse,
} from './types'

export interface HedgerApi {
  readonly mode: 'mock' | 'http'
  getMetadata(): Promise<Metadata>
  getScenarios(): Promise<Scenario[]>
  runSimulation(req: SimulationRequest): Promise<SimulationResponse>
  getExplanation(req: ExplanationRequest): Promise<ExplanationResponse>
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
      throw new ApiRequestError('NETWORK', `Could not reach the API at ${base || window.location.origin}. Start the Python backend and retry.`)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null
      throw new ApiRequestError(body?.error?.code ?? `HTTP_${res.status}`, body?.error?.message ?? res.statusText)
    }
    return (await res.json()) as T
  }
  const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  return {
    mode: 'http',
    getMetadata: () => request('/api/metadata'),
    getScenarios: () => request('/api/scenarios'),
    runSimulation: (req) => post('/api/simulations', req),
    getExplanation: (req) => post<ExplanationResponse>('/api/explanations', req),
    getSanity: () => request('/api/research/sanity'),
    getConvexity: (w) => request(`/api/research/convexity?window_days=${w}`),
    getRecommendation: (req) => post('/api/recommendations', req),
  }
}

const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

export const api: HedgerApi = import.meta.env.VITE_USE_MOCK === 'true' ? mockApi : httpApi(baseUrl ?? '')
