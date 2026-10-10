// Short explanations shown in InfoTip tooltips.

export const GLOSSARY = {
  bookSize: 'Dollar value of the restricted bond book at the start date. The book is modeled as tracking HYG.',
  hedgeRatio:
    'Hedge notional as a fraction of book size. 0.6 on a $1M book means $600k of short HYG or $600k of SJB.',
  borrowRate:
    'Annual cost of borrowing HYG shares to short. Applied only to the static short hedge, on the initial short notional.',
  dateRange:
    'Historical window to replay. Dates that are not trading days resolve to the nearest trading day inside the range.',
  portfolioValue: 'Book value plus hedge P/L, including modeled cash financing, spreads, borrow and trading costs.',
  return: 'Ending portfolio value relative to starting book size.',
  pnl: 'Profit or loss in dollars: ending portfolio value minus starting book size.',
  maxDrawdown:
    'Largest fall from a previous peak to a later trough within the window, shown as a positive loss. Differs from final P/L, which only compares start and end.',
  staticShort:
    'Fixed initial short exposure modeled as negative adjusted HYG returns, before calendar-day borrow cost. This is a simplified return-series comparison.',
  sjb: 'SJB is an inverse ETF that targets -1x of the daily return of a high-yield index. It resets every day, so over several days it does not deliver exactly -1x the cumulative return.',
  dailyReset:
    'Daily inverse returns compound. Their gap from a static inverse depends on cumulative return and realized variation; high volatility alone does not imply underperformance.',
  realizedVol: 'Research uses annualized zero-mean root-sum-squares of daily HYG excess returns. Instrument and portfolio risk views use sample standard deviation of total returns.',
  annVol: 'Annualized standard deviation of the portfolio’s daily returns over the selected window.',
  worstDay: 'Worst single-day portfolio return in the window.',
  hedgePnl: 'Ending value of the hedged portfolio minus ending value of the unhedged portfolio.',
  beta: 'Slope from regressing SJB daily excess returns on HYG daily excess returns. HYG is a comparison proxy, so a slope near -1 indicates inverse co-movement rather than exact target delivery.',
  intercept:
    'Regression intercept, annualized. It mixes expenses, tracking error, and noise, so it is not an exact fund expense.',
  rSquared: 'Share of SJB daily-return variance explained by HYG daily returns.',
  rollingWindow:
    'A window of N trading days uses N daily returns (N + 1 prices). Windows overlap, so neighboring points are not independent.',
  gap: 'Research gap is SJB excess return plus HYG excess return, against a funded static inverse before costs. Mechanics instead compares total instrument returns against a zero-carry negative-return reference.',
  objective:
    'Choose the hedge ratio whose worst rolling-window portfolio return is highest. This is not the same as minimizing maximum drawdown.',
  inSample: 'The ratio is chosen and evaluated on the same history, so results are optimistic about future performance.',
} as const
