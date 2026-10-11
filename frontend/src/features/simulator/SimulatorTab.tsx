import { useMemo } from 'react'
import type { SimulationRequest, SimulationResponse } from '../../api/types'
import { strategyRisk, type StrategyRisk } from '../../analysis/derived'
import { MetricCard, type MetricRow } from '../../components/MetricCard'
import { PortfolioChart } from '../../components/PortfolioChart'
import { SummaryTable } from '../../components/SummaryTable'
import { Panel } from '../../components/ui'
import { fmtPct, fmtSignedPct, fmtSignedUsd, fmtUsd, fmtUsdCompact, signClass } from '../../format'
import { GLOSSARY } from '../../glossary'

/** One row per strategy, in the given (best-first) order; unhedged is the muted baseline. */
function rowsFor(
  ranked: StrategyRisk[],
  value: (r: StrategyRisk) => string,
  delta?: (r: StrategyRisk) => number,
): MetricRow[] {
  return ranked.map((r) => {
    const baseline = r.strategy === 'unhedged'
    const d = delta && !baseline ? delta(r) : null
    return {
      strategy: r.strategy,
      value: value(r),
      baseline,
      delta: d !== null && Math.abs(d) >= 0.5 ? fmtUsdCompact(d).replace(/^(?!-)/, '+') : undefined,
      deltaTone: d !== null ? (signClass(d) as MetricRow['deltaTone']) : '',
    }
  })
}

const IN_SENTENCE = { static_short_hedged: 'static short hedge', sjb_hedged: 'SJB hedge' } as const

function Observations({ risks, ranked }: { risks: StrategyRisk[]; ranked: StrategyRisk[] }) {
  const [u, s, j] = risks
  const best = ranked[0]
  const level = Math.abs(s.hedgePnl) < 0.5 && Math.abs(j.hedgePnl) < 0.5
  const items = [
    level
      ? 'All three strategies finished level; there is no hedge at this ratio.'
      : best.strategy === 'unhedged'
        ? 'Staying unhedged finished best; both hedges cost money in this window.'
        : `The ${IN_SENTENCE[best.strategy]} finished best, ${fmtUsd(best.hedgePnl)} ahead of unhedged.`,
    `SJB finished ${fmtUsd(Math.abs(j.finalValue - s.finalValue))} ${j.finalValue >= s.finalValue ? 'ahead of' : 'behind'} the static short.`,
    `Unhedged fell as much as ${fmtPct(u.maxDrawdownPct, 1)} from its peak.`,
  ]
  return (
    <ul className="observations">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

export function SimulatorTab({ req, res }: { req: SimulationRequest; res: SimulationResponse }) {
  const risks = useMemo(() => strategyRisk(res, req), [res, req])
  const ranked = useMemo(() => [...risks].sort((a, b) => b.finalValue - a.finalValue), [risks])

  return (
    <div className="stack">
      <div className="metric-grid">
        <MetricCard title="Ending value" tip={GLOSSARY.portfolioValue} rows={rowsFor(ranked, (r) => fmtUsdCompact(r.finalValue))} />
        <MetricCard
          title="Profit / loss"
          tip={GLOSSARY.pnl}
          rows={rowsFor(ranked, (r) => fmtSignedUsd(r.finalPnl), (r) => r.hedgePnl)}
        />
        <MetricCard title="Return" tip={GLOSSARY.return} rows={rowsFor(ranked, (r) => fmtSignedPct(r.returnPct))} />
        <MetricCard title="Max drawdown" tip={GLOSSARY.maxDrawdown} rows={rowsFor(ranked, (r) => fmtPct(r.maxDrawdownPct))} />
      </div>
      <Panel title="Portfolio performance">
        <PortfolioChart paths={res.paths} bookSize={req.book_size} />
      </Panel>

      <div className="grid-2-1">
        <Panel title="Strategy summary">
          <SummaryTable rows={ranked} />
        </Panel>
        <Panel title="In this window">
          <Observations risks={risks} ranked={ranked} />
          <p className="fine">Describes this window only. Not a forecast or a recommendation.</p>
        </Panel>
      </div>
    </div>
  )
}
