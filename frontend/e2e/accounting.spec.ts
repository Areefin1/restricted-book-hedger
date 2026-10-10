import { expect, test } from '@playwright/test'
import { simulateHedges } from '../src/analysis/simulate.js'
import { recommendRatio } from '../src/analysis/recommend.js'
import { calculateRollingWindows } from '../src/analysis/research.js'
import type { SimulationRequest, SimulationResponse } from '../src/api/types.js'

test('mock accounting matches API with nonzero financing and stress assumptions', async ({ request }) => {
  const body: SimulationRequest = { book_size: 1e6, hedge_ratio: .6, annual_borrow_rate: .025,
    start_date: '2022-01-03', end_date: '2022-03-31', annual_cash_rate: .06,
    funding_spread: .03, rebate_spread: .02, round_trip_cost_bps: 18,
    book_beta: 2, annual_basis_return: -.1, termination_floor: .95, max_hedge_notional: 700000 }
  const response = await request.post('/api/simulations', { data: body })
  expect(response.status()).toBe(200)
  const api = await response.json() as SimulationResponse
  const prices = api.instrument_returns.map((p) => ({ date: p.date, hyg: 100*(1+p.hyg_return), sjb: 50*(1+p.sjb_return), rf_return: 0 }))
  const mock = simulateHedges(prices, body, 'fixture')
  for (let i = 0; i < api.paths.length; i++) {
    for (const k of ['unhedged', 'static_short_hedged', 'sjb_hedged'] as const) expect(mock.paths[i][k]).toBeCloseTo(api.paths[i][k], 6)
  }
  expect(mock.events.map((e) => [e.date, e.strategy])).toEqual(api.events.map((e) => [e.date, e.strategy]))
  const { hedge_ratio: ratio, ...searchBody } = body
  void ratio
  for (const instrument of ['sjb', 'static_short'] as const) {
    const query = { ...searchBody, instrument, window_days: 21 }
    const apiSearch = await request.post('/api/recommendations', { data: query })
    expect(apiSearch.status()).toBe(200)
    const expected = await apiSearch.json()
    const actual = recommendRatio(prices, query, 'fixture')
    expect(actual.recommended_ratio).toBe(expected.recommended_ratio)
    actual.grid.forEach((g, i) => expect(g.worst_window_return_pct).toBeCloseTo(expected.grid[i].worst_window_return_pct, 9))
  }
})

test('mock research separates compounded excess and zero-mean volatility', () => {
  const prices = Array.from({ length: 22 }, (_, i) => ({ date: `2022-01-${String(i + 1).padStart(2, '0')}`, hyg: 100*1.01**i, sjb: 50*.99**i, rf_return: .001 }))
  const p = calculateRollingWindows(prices, 21, 'fixture').points[0]
  expect(p.hyg_return).toBeCloseTo(1.01**21 - 1.001**21, 12)
  expect(p.hyg_realized_vol).toBeCloseTo(.009*Math.sqrt(252), 12)
  expect(p.hyg_sample_vol).toBeLessThan(1e-12)
})

test('advanced controls affect submitted accounting inputs', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Results current', { exact: true })).toBeVisible()
  await page.getByText('Research assumptions and stress controls', { exact: true }).click()
  const pending = page.waitForResponse((r) => r.url().endsWith('/api/simulations') && r.request().postDataJSON().annual_cash_rate === .05)
  await page.getByLabel('Assumed cash rate (%/yr)', { exact: true }).fill('5')
  const response = await pending
  expect(response.status()).toBe(200)
  await page.getByLabel('Assumed hedge capacity ($)', { exact: true }).fill('500000')
  await expect(page.getByText('Initial hedge exceeds the assumed capacity.', { exact: true })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('link', { name: 'Recommendation', exact: true }).click()
  await expect(page.getByRole('button', { name: /Use .* in simulator/ })).toBeEnabled()
})
