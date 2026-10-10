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
  await expect(chat.getByText('Full simulation · chart zoom is not included')).toBeVisible()
  const bounds = await chat.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.screenshot({ path: testInfo.outputPath('chat-welcome.png'), animations: 'disabled' })
  let finish: (() => void) | undefined
  let count = 0
  await page.route('**/api/explanations', async route => {
    const body = route.request().postDataJSON()
    expect(body.hedge_ratio).toBe(0.6)
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
  await chat.getByLabel('Ask about your simulation', { exact: true }).fill('Why is that?')
  await chat.getByLabel('Ask about your simulation', { exact: true }).press('Enter')
  await expect(chat.getByText('The hedge offsets part of the modeled HYG decline.', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('chat-conversation.png'), animations: 'disabled' })
  await chat.getByRole('button', { name: 'Minimize chat', exact: true }).click()
  await expect(chat).toBeHidden()
  await page.getByRole('button', { name: 'Open assistant chat', exact: true }).click()
  await expect(chat.getByText('The hedge offsets part of the modeled HYG decline.', { exact: true })).toBeVisible()
  await chat.getByRole('button', { name: 'Clear chat', exact: true }).click()
  await expect(chat.getByText('Make sense of your hedge.')).toBeVisible()
  await chat.getByLabel('Ask about your simulation', { exact: true }).press('Escape')
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
  await page.route('**/api/explanations', async route => {
    await new Promise(resolve => setTimeout(resolve, 500))
    await route.fulfill({ json: { explanation: 'Wrong dataset answer.', data_version: 'sha256:changed' } })
  })
  await page.getByRole('button', { name: 'Explain these results', exact: true }).click()
  await expect(page.locator('.chat-spark-active')).toHaveCSS('animation-name', 'none')
  await expect(page.getByRole('alert')).toHaveText('The dataset changed. Refresh the simulation and try again.')
  await expect(page.getByText('Wrong dataset answer.', { exact: true })).toHaveCount(0)
})
