// Short explanations shown in InfoTip tooltips.

export const GLOSSARY = {
  bookSize: 'Dollar value of the restricted bond book at the start date. The book is modeled as tracking HYG.',
  hedgeRatio:
    'Hedge notional as a fraction of book size. 0.6 on a $1M book means $600k of short HYG or $600k of SJB.',
  borrowRate:
    'Annual cost of borrowing HYG shares to short. Applied only to the static short hedge, on the initial short notional.',
  dateRange:
    'Historical window to replay. Dates that are not trading days resolve to the nearest trading day inside the range.',
  portfolioValue: 'Book value plus hedge P/L at the end of the window, less modeled borrow costs.',
  return: 'Ending portfolio value relative to starting book size.',
  pnl: 'Profit or loss in dollars: ending portfolio value minus starting book size.',
  maxDrawdown:
    'Largest fall from a previous peak to a later trough within the window, shown as a positive loss. Differs from final P/L, which only compares start and end.',
  staticShort:
    'Short HYG once at the start and hold the share count fixed. Its P/L is exactly the negative of HYG’s move on the hedged notional, before borrow cost.',
  sjb: 'SJB is an inverse ETF that targets -1x of the daily return of a high-yield index. It resets every day, so over several days it does not deliver exactly -1x the cumulative return.',
  dailyReset:
    'Because SJB rebalances to -1x every day, multi-day returns compound. In trending markets this can help; in volatile, directionless markets it erodes value (volatility drag).',
  realizedVol: 'Annualized standard deviation of daily HYG returns within the window.',
  annVol: 'Annualized standard deviation of the portfolio’s daily returns over the selected window.',
  worstDay: 'Worst single-day portfolio return in the window.',
  hedgePnl: 'Ending value of the hedged portfolio minus ending value of the unhedged portfolio.',
  beta: 'Slope from regressing SJB daily returns on HYG daily returns. A daily -1x product should be close to -1.',
  intercept:
    'Regression intercept, annualized. It mixes expenses, tracking error, and noise, so it is not an exact fund expense.',
  rSquared: 'Share of SJB daily-return variance explained by HYG daily returns.',
  rollingWindow:
    'A window of N trading days uses N daily returns (N + 1 prices). Windows overlap, so neighboring points are not independent.',
  gap: 'SJB window return minus the static -1x reference (-HYG return). Negative means SJB lagged a static short of the same size.',
  objective:
    'Choose the hedge ratio whose worst rolling-window portfolio return is highest. This is not the same as minimizing maximum drawdown.',
  inSample: 'The ratio is chosen and evaluated on the same history, so results are optimistic about future performance.',
} as const
