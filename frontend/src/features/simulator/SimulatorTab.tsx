import { useMemo } from 'react'
import type { SimulationRequest, SimulationResponse } from '../../api/types'
import { strategyRisk, type StrategyRisk } from '../../analysis/derived'
import { MetricCard, type MetricRow } from '../../components/MetricCard'
import { PortfolioChart } from '../../components/PortfolioChart'
import { SummaryTable } from '../../components/SummaryTable'
import { Panel } from '../../components/ui'
import { fmtPct, fmtSignedPct, fmtSignedUsd, fmtUsd, fmtUsdCompact, signClass } from '../../format'
import { GLOSSARY } from '../../glossary'
import { STRATEGY_META } from '../../theme'
import { ExplanationPanel } from '../../components/ExplanationPanel'

function rowsFor(
  risks: StrategyRisk[],
  value: (r: StrategyRisk) => number,
  fmt: (v: number) => string,
  opts: { signed?: boolean; lowerIsBetter?: boolean; deltaFmt?: (v: number) => string } = {},
): MetricRow[] {
  const base = value(risks[0])
  return risks.map((r, i) => {
    const v = value(r)
    const d = v - base
    const better = opts.lowerIsBetter ? -d : d
    return {
      strategy: r.strategy,
      value: fmt(v),
      tone: opts.signed ? (signClass(v) as MetricRow['tone']) : '',
      delta: i > 0 && opts.deltaFmt ? `${opts.deltaFmt(d)} vs unhedged` : undefined,
      deltaTone: (signClass(better) as MetricRow['deltaTone']) || '',
    }
  })
}

const ppDelta = (d: number) => `${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(2)} pp`

function Observations({ risks }: { risks: StrategyRisk[] }) {
  const [u, s, j] = risks
  const items = [
    `Unhedged ${u.returnPct < 0 ? 'lost' : 'gained'} ${fmtPct(Math.abs(u.returnPct))} with a maximum drawdown of ${fmtPct(u.maxDrawdownPct)}.`,
    `${STRATEGY_META.static_short_hedged.label}: return ${fmtSignedPct(s.returnPct)}, max drawdown ${fmtPct(s.maxDrawdownPct)}.`,
    `${STRATEGY_META.sjb_hedged.label}: return ${fmtSignedPct(j.returnPct)}, max drawdown ${fmtPct(j.maxDrawdownPct)}.`,
    `In this window the SJB hedge ${j.finalValue >= s.finalValue ? 'finished ahead of' : 'finished behind'} the static short by ${fmtUsd(Math.abs(j.finalValue - s.finalValue))}.`,
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

  return (
    <div className="stack">
      <div className="metric-grid">
        <MetricCard
          title="Ending portfolio value"
          tip={GLOSSARY.portfolioValue}
          rows={rowsFor(risks, (r) => r.finalValue, fmtUsdCompact, { deltaFmt: (d) => fmtUsdCompact(d).replace(/^(?!-)/, '+') })}
          footnote={`Start: ${fmtUsdCompact(req.book_size)}`}
        />
        <MetricCard
          title="Return"
          tip={GLOSSARY.return}
          rows={rowsFor(risks, (r) => r.returnPct, (v) => fmtSignedPct(v), { signed: true, deltaFmt: ppDelta })}
        />
        <MetricCard
          title="Profit / loss"
          tip={GLOSSARY.pnl}
          rows={rowsFor(risks, (r) => r.finalPnl, fmtSignedUsd, { signed: true })}
        />
        <MetricCard
          title="Maximum drawdown"
          tip={GLOSSARY.maxDrawdown}
          rows={rowsFor(risks, (r) => r.maxDrawdownPct, (v) => fmtPct(v), { lowerIsBetter: true, deltaFmt: ppDelta })}
          footnote="Peak-to-trough loss, shown as a positive number."
        />
      </div>
      <ExplanationPanel
        key={JSON.stringify([req, res.data_version])}
        req={req}
        dataVersion={res.data_version}
      />
      <Panel title="Portfolio performance" subtitle="Daily total portfolio value and profit / loss relative to starting capital.">
        <PortfolioChart paths={res.paths} bookSize={req.book_size} />
      </Panel>

      <div className="grid-2-1">
        <Panel title="Strategy summary" subtitle="Values at the effective end date.">
          <SummaryTable rows={risks} />
        </Panel>
        <Panel title="Observations" subtitle="Generated from the figures on this page.">
          <Observations risks={risks} />
          <p className="fine">Describes the selected window and data version. It is not a forecast or a recommendation.</p>
        </Panel>
      </div>
    </div>
  )
}
