// Worked arithmetic examples of static -1x versus daily-reset -1x. These are
// textbook illustrations with chosen returns, not data.

export interface ExampleDay {
  day: number
  hygReturn: number | null
  hygCum: number
  staticCum: number
  sjbReturn: number | null
  sjbCum: number
}

export function resetExample(dailyHygReturns: number[]): ExampleDay[] {
  const rows: ExampleDay[] = [{ day: 0, hygReturn: null, hygCum: 0, staticCum: 0, sjbReturn: null, sjbCum: 0 }]
  let hyg = 1
  let sjb = 1
  dailyHygReturns.forEach((r, i) => {
    hyg *= 1 + r
    sjb *= 1 - r
    rows.push({ day: i + 1, hygReturn: r, hygCum: hyg - 1, staticCum: -(hyg - 1), sjbReturn: -r, sjbCum: sjb - 1 })
  })
  return rows
}

export const EXAMPLES = {
  choppy: { label: 'Choppy', returns: [0.1, -0.1], note: 'HYG rises then falls back. The daily-reset product loses value even though HYG ends almost flat.' },
  down: { label: 'Falling', returns: [-0.05, -0.05], note: 'HYG falls on consecutive days. Daily compounding makes the inverse product gain slightly more than a static short.' },
  up: { label: 'Rising', returns: [0.05, 0.05], note: 'HYG rises on consecutive days. The inverse product loses slightly less than a static short.' },
} as const

export type ExampleId = keyof typeof EXAMPLES
