import { useMemo, type ReactNode } from 'react'
import type { SimulationRequest, SimulationResponse, StrategyId } from '../../api/types'
import { strategyRisk, type StrategyRisk } from '../../analysis/derived'
import { PortfolioChart } from '../../components/PortfolioChart'
import { SummaryTable } from '../../components/SummaryTable'
import { fmtPct, fmtSignedPct, fmtSignedUsd, fmtUsd } from '../../format'
import { GLOSSARY } from '../../glossary'
import { STRATEGY_META } from '../../theme'

const IN_SENTENCE: Record<StrategyId, string> = {
  unhedged: 'unhedged book',
  static_short_hedged: 'static short hedge',
  sjb_hedged: 'SJB hedge',
}

const outcome = (pnl: number) => (pnl < 0 ? `a ${fmtUsd(-pnl)} loss` : `a ${fmtUsd(pnl)} gain`)

/** The one-line takeaway: which strategy finished highest, and by how much. */
function Verdict({ risks }: { risks: StrategyRisk[] }) {
  const [u, s, j] = risks
  const best = risks.reduce((a, b) => (b.finalValue > a.finalValue ? b : a))
  let headline: string
  let detail: ReactNode

  if (Math.abs(s.hedgePnl) < 0.5 && Math.abs(j.hedgePnl) < 0.5) {
    headline = 'All three strategies finished level.'
    detail = <>Each ended with {outcome(u.finalPnl)}. Raise the hedge ratio to compare the hedges.</>
  } else if (best.strategy === 'unhedged') {
    headline = 'Staying unhedged did best in this window.'
    detail = (
      <>
        Unhedged ended with {outcome(u.finalPnl)}. The static short finished {fmtUsd(Math.abs(s.hedgePnl))} {s.hedgePnl < 0 ? 'behind' : 'ahead'} and
        SJB {fmtUsd(Math.abs(j.hedgePnl))} {j.hedgePnl < 0 ? 'behind' : 'ahead'}.
      </>
    )
  } else {
    headline = `The ${IN_SENTENCE[best.strategy]} held up best.`
    detail = (
      <>
        It {best.finalPnl < 0 ? <>limited the loss to <b>{fmtUsd(-best.finalPnl)}</b></> : <>finished up <b>{fmtUsd(best.finalPnl)}</b></>}, compared with{' '}
        <b>{outcome(u.finalPnl)}</b> unhedged — <span className="pos">{fmtUsd(best.hedgePnl)} better</span>.
      </>
    )
  }

  return (
    <section className="answer" aria-labelledby="answer-title">
      <h2 id="answer-title">{headline}</h2>
      <p>{detail}</p>
    </section>
  )
}

/** Strategies ranked by ending value; bar length is the size of the profit or loss. */
function Comparison({ risks }: { risks: StrategyRisk[] }) {
  const ranked = [...risks].sort((a, b) => b.finalValue - a.finalValue)
  const scale = Math.max(...risks.map((r) => Math.abs(r.finalPnl))) || 1
  return (
    <ul className="compare" aria-label="Strategy comparison, best first">
      {ranked.map((r) => {
        const meta = STRATEGY_META[r.strategy]
        return (
          <li key={r.strategy} className={r.strategy === 'unhedged' ? 'baseline' : ''}>
            <span className="compare-name">
              <span className="swatch" style={{ background: meta.color }} aria-hidden="true" />
              {meta.label}
            </span>
            <span className="compare-pnl">
              <span className="num">{fmtSignedUsd(r.finalPnl)}</span>
              <span className="compare-bar" aria-hidden="true">
                <span style={{ width: `${(Math.abs(r.finalPnl) / scale) * 100}%`, background: meta.color }} />
              </span>
            </span>
            <dl className="compare-stats">
              <div>
                <dt>Return</dt>
                <dd className="num">{fmtSignedPct(r.returnPct)}</dd>
              </div>
              <div>
                <dt>Max drawdown</dt>
                <dd className="num">{fmtPct(r.maxDrawdownPct)}</dd>
              </div>
            </dl>
          </li>
        )
      })}
    </ul>
  )
}

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

function Chevron() {
  return (
    <svg className="chev" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M6 3l5 5-5 5" />
    </svg>
  )
}

export function SimulatorTab({ req, res }: { req: SimulationRequest; res: SimulationResponse }) {
  const risks = useMemo(() => strategyRisk(res, req), [res, req])

  return (
    <div className="overview">
      <Verdict risks={risks} />
      <Comparison risks={risks} />

      <section className="chart-section" aria-labelledby="perf-title">
        <h2 id="perf-title">Portfolio performance</h2>
        <PortfolioChart paths={res.paths} bookSize={req.book_size} />
      </section>

      <section className="more" aria-label="More detail">
        <details>
          <summary>
            <span>
              <span>Full breakdown</span> <span className="more-hint">ending values, hedge P/L</span>
            </span>
            <Chevron />
          </summary>
          <div className="more-body">
            <SummaryTable rows={risks} />
          </div>
        </details>
        <details>
          <summary>
            <span>What these numbers mean</span>
            <Chevron />
          </summary>
          <div className="more-body">
            <dl className="definitions">
              <div><dt>Profit / loss</dt><dd>{GLOSSARY.pnl}</dd></div>
              <div><dt>Max drawdown</dt><dd>{GLOSSARY.maxDrawdown}</dd></div>
              <div><dt>Hedge P/L</dt><dd>{GLOSSARY.hedgePnl}</dd></div>
              <div><dt>SJB</dt><dd>{GLOSSARY.sjb}</dd></div>
            </dl>
            <h3 className="subhead">In this window</h3>
            <Observations risks={risks} />
            <p className="fine">Generated from the figures above for the selected window and data version. It is not a forecast or a recommendation.</p>
          </div>
        </details>
      </section>
    </div>
  )
}
