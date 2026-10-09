import type { StrategyRisk } from '../analysis/derived'
import { fmtDate, fmtPct, fmtSignedPct, fmtSignedUsd, fmtUsd, signClass } from '../format'
import { GLOSSARY } from '../glossary'
import { STRATEGY_META } from '../theme'
import { InfoTip } from './ui'

export function SummaryTable({ rows, detailed = false }: { rows: StrategyRisk[]; detailed?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Strategy</th>
            <th scope="col" className="r">
              Ending value <InfoTip text={GLOSSARY.portfolioValue} label="About ending value" />
            </th>
            <th scope="col" className="r">
              Final P/L <InfoTip text={GLOSSARY.pnl} label="About final P/L" />
            </th>
            <th scope="col" className="r">Return</th>
            <th scope="col" className="r">
              Max drawdown <InfoTip text={GLOSSARY.maxDrawdown} label="About max drawdown" />
            </th>
            {detailed && (
              <>
                <th scope="col">Peak → trough</th>
                <th scope="col" className="r">
                  Ann. volatility <InfoTip text={GLOSSARY.annVol} label="About annualized volatility" />
                </th>
                <th scope="col" className="r">
                  Worst day <InfoTip text={GLOSSARY.worstDay} label="About worst day" />
                </th>
              </>
            )}
            <th scope="col" className="r">
              Hedge P/L <InfoTip text={GLOSSARY.hedgePnl} label="About hedge P/L" />
            </th>
            {detailed && (
              <th scope="col" className="r">
                Borrow cost <InfoTip text={GLOSSARY.borrowRate} label="About borrow cost" />
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.strategy}>
              <th scope="row">
                <span className="swatch" style={{ background: STRATEGY_META[r.strategy].color }} aria-hidden="true" />
                {STRATEGY_META[r.strategy].label}
              </th>
              <td className="r num">{fmtUsd(r.finalValue)}</td>
              <td className={`r num ${signClass(r.finalPnl)}`}>{fmtSignedUsd(r.finalPnl)}</td>
              <td className={`r num ${signClass(r.returnPct)}`}>{fmtSignedPct(r.returnPct)}</td>
              <td className="r num">{fmtPct(r.maxDrawdownPct)}</td>
              {detailed && (
                <>
                  <td className="muted wrap-dates">
                    {r.peakDate ? <>{fmtDate(r.peakDate)} →<br />{fmtDate(r.troughDate)}</> : 'No drawdown'}
                  </td>
                  <td className="r num">{fmtPct(r.annualizedVolPct)}</td>
                  <td className={`r num ${signClass(r.worstDayPct)}`}>{fmtSignedPct(r.worstDayPct)}</td>
                </>
              )}
              <td className={`r num ${r.strategy === 'unhedged' ? 'muted' : signClass(r.hedgePnl)}`}>
                {r.strategy === 'unhedged' ? '—' : fmtSignedUsd(r.hedgePnl)}
              </td>
              {detailed && (
                <td className="r num muted">{r.strategy === 'static_short_hedged' ? fmtUsd(-r.borrowCost) : '—'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
