"""Daily observed-return diagnostics; degenerate fits return null."""

import numpy as np
import pandas as pd
from app.hedger.funding import cash_returns, cash_note


def run_sanity_check(prices: pd.DataFrame) -> dict:
    returns = prices[["hyg", "sjb"]].pct_change(fill_method=None).sub(cash_returns(prices), axis=0).iloc[1:]
    x, y = returns["hyg"].to_numpy(), returns["sjb"].to_numpy()
    diagnostics = dict(beta=None, intercept_daily=None, r_squared=None, correlation=None)
    notes = [
        "OLS of SJB daily excess returns on HYG daily excess returns over the full cache; cash is subtracted from both series.",
        cash_note(prices),
        "HYG is a comparison proxy, not an identical benchmark. A beta near -1 indicates inverse co-movement, not proof of exact target delivery.",
        "The intercept combines benchmark differences, tracking, expenses, and noise; it is not an exact expense estimate.",
    ]
    if len(x) >= 3:
        dx, dy = x - x.mean(), y - y.mean()
        sxx, syy, sxy = float(dx @ dx), float(dy @ dy), float(dx @ dy)
        if sxx > 0 and syy > 0:
            beta = sxy / sxx
            correlation = float(np.clip(sxy / np.sqrt(sxx * syy), -1, 1))
            diagnostics = dict(beta=beta, intercept_daily=float(y.mean() - beta * x.mean()),
                               r_squared=correlation ** 2, correlation=correlation)
    if diagnostics["beta"] is None:
        notes.append("Regression unavailable: at least three daily returns with nonzero variance in both series are required.")
    return {
        "points": [{"date": day.strftime("%Y-%m-%d"), "hyg_return": float(row.hyg), "sjb_return": float(row.sjb)}
                   for day, row in returns.iterrows()],
        **diagnostics, "observations": len(returns), "notes": notes,
    }
