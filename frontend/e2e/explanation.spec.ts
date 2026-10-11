import { expect, test, type Page } from '@playwright/test'

async function openChat(page: Page) {
  const simulated = page.waitForResponse(response =>
    response.url().endsWith('/api/simulations') && response.status() === 200,
  )
  await page.goto('/')
  const simulation = await (await simulated).json()
  await page.getByRole('button', { name: 'Open assistant chat', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Explain these results', exact: true })).toBeEnabled()
  return simulation
}

test('Floating chat answers follow-ups and keeps history when minimized', async ({ page }, testInfo) => {
  const simulation = await openChat(page)
  const chat = page.getByRole('dialog', { name: 'Hedge assistant' })
  await expect(chat).toBeVisible()
  await expect(chat.locator('.chat-scope-note')).toContainText('full chart range')
  const bounds = await chat.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.screenshot({ path: testInfo.outputPath('chat-welcome.png'), animations: 'disabled' })
  let finish: (() => void) | undefined
  let count = 0
  await page.route('**/api/explanations', async route => {
    const body = route.request().postDataJSON()
    expect(body.hedge_ratio).toBe(0.6)
    expect(body.view.page).toBe('simulator')
    expect(body.view.data_version).toBe(simulation.data_version)
    count++
    if (count === 1) {
      expect(body.question).toBe('Explain these results')
      expect(body.history).toEqual([])
      await new Promise<void>(resolve => { finish = resolve })
    } else {
      expect(body.question).toBe('Why is that?')
      expect(body.history).toEqual([
        { role: 'user', content: 'Explain these results' },
        { role: 'assistant', content: 'The static short hedge reduced the simulated loss.' },
      ])
    }
    await route.fulfill({ json: {
      explanation: count === 1 ? 'The static short hedge reduced the simulated loss.' : 'The hedge offsets part of the modeled HYG decline.',
      data_version: simulation.data_version,
    } })
  })
  await page.getByRole('button', { name: 'Explain these results', exact: true }).click()
  await expect(chat.getByRole('status')).toHaveText('Thinking…')
  await expect(chat.locator('.chat-spark-active')).toBeVisible()
  await expect(chat.getByRole('button', { name: 'Send message' })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('chat-loading.png'), animations: 'disabled' })
  if (!finish) throw new Error('Chat request did not reach API client')
  finish()
  await expect(chat.getByText('The static short hedge reduced the simulated loss.', { exact: true })).toBeVisible()
  await chat.getByLabel('Ask about this page', { exact: true }).fill('Why is that?')
  await chat.getByLabel('Ask about this page', { exact: true }).press('Enter')
  await expect(chat.getByText('The hedge offsets part of the modeled HYG decline.', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('chat-conversation.png'), animations: 'disabled' })
  await chat.getByRole('button', { name: 'Minimize chat', exact: true }).click()
  await expect(chat).toBeHidden()
  await page.getByRole('button', { name: 'Open assistant chat', exact: true }).click()
  await expect(chat.getByText('The hedge offsets part of the modeled HYG decline.', { exact: true })).toBeVisible()
  await chat.getByRole('button', { name: 'Clear chat', exact: true }).click()
  await expect(chat.getByText('Make sense of your hedge.')).toBeVisible()
  await chat.getByLabel('Ask about this page', { exact: true }).press('Escape')
  await expect(chat).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open assistant chat', exact: true })).toBeFocused()
})

test('Changing the simulation resets conversation context', async ({ page }) => {
  const simulation = await openChat(page)
  await page.route('**/api/explanations', route => route.fulfill({ json: {
    explanation: 'Answer for the old simulation.', data_version: simulation.data_version,
  } }))
  await page.getByRole('button', { name: 'Explain these results', exact: true }).click()
  await expect(page.getByText('Answer for the old simulation.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Minimize chat', exact: true }).click()
  const updated = page.waitForResponse(response =>
    response.url().endsWith('/api/simulations') && response.status() === 200 &&
    response.request().postDataJSON().hedge_ratio === 0.4,
  )
  await page.getByLabel('Hedge ratio', { exact: true }).fill('0.4')
  await updated
  await page.getByRole('button', { name: 'Open assistant chat', exact: true }).click()
  await expect(page.getByText('Answer for the old simulation.', { exact: true })).toHaveCount(0)
  await expect(page.locator('.chat-scope')).toContainText('40% hedge')
  await expect(page.getByRole('button', { name: 'Explain these results', exact: true })).toBeEnabled()
})

test('Chat failures allow retry without duplicate messages', async ({ page }) => {
  const simulation = await openChat(page)
  let count = 0
  await page.route('**/api/explanations', route => {
    count++
    expect(route.request().postDataJSON().history).toEqual([])
    return count === 1 ? route.fulfill({ status: 502, json: {
      error: { code: 'AI_UNAVAILABLE', message: 'Chat temporarily unavailable.' },
    } }) : route.fulfill({ json: { explanation: 'Recovered answer.', data_version: simulation.data_version } })
  })
  await page.getByRole('button', { name: 'Explain these results', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Chat temporarily unavailable.')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('Recovered answer.', { exact: true })).toBeVisible()
  await expect(page.locator('.chat-message-user')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Portfolio performance', exact: true })).toBeVisible()
})

test('A mismatched dataset is rejected and reduced motion disables the spinner', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openChat(page)
  let finish: (() => void) | undefined
  await page.route('**/api/explanations', async route => {
    await new Promise<void>(resolve => { finish = resolve })
    await route.fulfill({ json: { explanation: 'Wrong dataset answer.', data_version: 'sha256:changed' } })
  })
  await page.getByRole('button', { name: 'Explain these results', exact: true }).click()
  await expect(page.locator('.chat-spark-active')).toHaveCSS('animation-name', 'none')
  await expect(page.locator('.chat-shimmer-lines i').first()).toHaveCSS('animation-name', 'none')
  if (!finish) throw new Error('Chat request did not reach API client')
  finish()
  await expect(page.getByRole('alert')).toHaveText('The dataset changed. Refresh the simulation and try again.')
  await expect(page.getByText('Wrong dataset answer.', { exact: true })).toHaveCount(0)
})

async function zoomChart(page: Page, label: string) {
  const drag = page.getByRole('img', { name: label, exact: true }).locator('.nsewdrag')
  await drag.scrollIntoViewIfNeeded()
  const bounds = await drag.boundingBox()
  if (!bounds) throw new Error('Chart drag area unavailable')
  await page.mouse.move(bounds.x + bounds.width * .12, bounds.y + bounds.height * .18)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * .48, bounds.y + bounds.height * .82, { steps: 12 })
  await page.mouse.up()
}

test('Portfolio zoom, chart units and reset are sent with the active page', async ({ page }) => {
  const simulation = await openChat(page)
  const chat = page.getByRole('dialog', { name: 'Hedge assistant' })
  const requests: { view: { page: string; chart_mode: string; charts: { chart: string; x_range?: [string, string] }[] } }[] = []
  await page.route('**/api/explanations', route => {
    requests.push(route.request().postDataJSON())
    return route.fulfill({ json: { explanation: 'Answer for this view.', data_version: simulation.data_version } })
  })
  await chat.getByRole('button', { name: 'Minimize chat', exact: true }).click()
  await page.getByRole('radio', { name: 'Return (%)', exact: true }).click()
  await zoomChart(page, 'Portfolio return over time for each strategy')
  await page.getByRole('button', { name: 'Open assistant chat', exact: true }).click()
  await expect(chat.locator('.chat-scope')).toContainText('Visible portfolio:')
  await chat.getByRole('button', { name: 'Explain these results', exact: true }).click()
  await expect(chat.getByText('Answer for this view.', { exact: true })).toBeVisible()
  expect(requests[0].view.page).toBe('simulator')
  expect(requests[0].view.chart_mode).toBe('return')
  const range = requests[0].view.charts.find(chart => chart.chart === 'portfolio')?.x_range
  expect(range).toHaveLength(2)
  expect(new Date(range![0]).getTime()).toBeGreaterThan(new Date(simulation.effective_start_date).getTime())
  await chat.getByRole('button', { name: 'Minimize chat', exact: true }).click()
  await page.getByRole('img', { name: 'Portfolio return over time for each strategy', exact: true }).locator('.nsewdrag').dblclick()
  await page.getByRole('button', { name: 'Open assistant chat', exact: true }).click()
  await expect(chat.locator('.chat-scope')).toContainText('full chart range')
  await expect(chat.getByText('Answer for this view.', { exact: true })).toHaveCount(0)
  await chat.getByRole('button', { name: 'Explain these results', exact: true }).click()
  await expect(chat.getByText('Answer for this view.', { exact: true })).toBeVisible()
  expect(requests[1].view.charts.find(chart => chart.chart === 'portfolio')?.x_range).toBeUndefined()
})

test('Research chat follows the rolling window and date zoom instead of the simulation page', async ({ page }) => {
  const simulation = await openChat(page)
  await page.getByRole('button', { name: 'Minimize chat', exact: true }).click()
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('link', { name: 'Research', exact: true }).click()
  await expect(page.locator('.plot-container')).toHaveCount(3)
  await page.getByRole('radio', { name: '21d', exact: true }).click()
  await expect(page.getByText('Each window uses 21 return intervals', { exact: false })).toBeVisible()
  await zoomChart(page, 'Rolling realized volatility and SJB gap over time')
  await page.getByRole('button', { name: 'Open assistant chat', exact: true }).click()
  const chat = page.getByRole('dialog', { name: 'Hedge assistant' })
  await expect(chat.locator('.chat-scope')).toContainText('Research · 21 trading-day windows')
  await expect(chat.locator('.chat-scope')).toContainText('Visible volatility:')
  await page.route('**/api/explanations', route => {
    const body = route.request().postDataJSON()
    expect(body.view.page).toBe('research')
    expect(body.view.window_days).toBe(21)
    expect(body.view.charts.find((chart: { chart: string }) => chart.chart === 'volatility').x_range).toHaveLength(2)
    return route.fulfill({ json: { explanation: 'Answer for 21-day research windows.', data_version: simulation.data_version } })
  })
  await chat.getByRole('button', { name: 'Explain these results', exact: true }).click()
  await expect(chat.getByText('Answer for 21-day research windows.', { exact: true })).toBeVisible()
})

test('An answer for the previous view is discarded after navigation', async ({ page }) => {
  const simulation = await openChat(page)
  let finish: (() => void) | undefined
  await page.route('**/api/explanations', async route => {
    await new Promise<void>(resolve => { finish = resolve })
    await route.fulfill({ json: { explanation: 'Stale overview answer.', data_version: simulation.data_version } })
  })
  await page.getByRole('button', { name: 'Explain these results', exact: true }).click()
  await expect(page.locator('.chat-thinking')).toBeVisible()
  await page.getByRole('button', { name: 'Minimize chat', exact: true }).click()
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('link', { name: 'Risk analysis', exact: true }).click()
  if (!finish) throw new Error('Request never reached the API')
  const responded = page.waitForResponse('**/api/explanations')
  finish()
  await responded
  await page.getByRole('button', { name: 'Open assistant chat', exact: true }).click()
  await expect(page.locator('.chat-scope')).toContainText('Risk analysis')
  await expect(page.getByText('Stale overview answer.', { exact: true })).toHaveCount(0)
})
