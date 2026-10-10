"""Shared accounting conventions returned with simulations and searches."""


from app.hedger.funding import cash_note


def simulation_assumptions(annual_borrow_rate, prices=None, **options):
    return [
        {"label": "Proxy", "detail": "The restricted book follows adjusted HYG returns, not individual bond exposures."},
        {"label": "Capital accounting", "detail": "Equal initial equity. SJB borrowing compounds at cash plus the funding spread; short collateral compounds at cash minus the rebate spread. Spreads are continuous annual decimal spreads, and borrow fees are separate."},
        {"label": "Cash input", "detail": cash_note(prices, options.get("annual_cash_rate")) if prices is not None else "Cash provenance must be verified."},
        {"label": "Static short", "detail": f"Negative adjusted HYG return on initial hedge exposure, less {annual_borrow_rate:.2%} annual borrow cost using actual elapsed calendar days / 365. This is a return-series approximation, not an executable short ledger."},
        {"label": "SJB hedge", "detail": "Buy and hold the initial SJB investment. Observed adjusted returns include distributions and fund expenses; no additional expense deduction is applied."},
        {"label": "User assumptions", "detail": f"Funding spread {options.get('funding_spread', 0):.2%}; rebate spread {options.get('rebate_spread', 0):.2%}; round-trip hedge cost {options.get('round_trip_cost_bps', 0):g} bp on initial notional, charged once after inception. Zero costs are assumptions, not observed execution."},
        {"label": "Proxy stress", "detail": f"Book beta {options.get('book_beta', 1):g}; annual additive basis return {options.get('annual_basis_return', 0):.2%}. These are sensitivities, not holdings-based DV01/CS01 or default models."},
        {"label": "Capacity", "detail": f"User-supplied maximum initial hedge notional: {options.get('max_hedge_notional')}. Without a supplied limit, market capacity is unverified; no ADV or market-impact estimate is implied."},
        {"label": "Termination", "detail": f"Research paths freeze at first equity-floor breach ({options.get('termination_floor', 0):.0%} of initial equity), retaining overshoot. This is a stress cutoff, not broker margin or executable liquidation of a restricted book. Recalls and intraday margin remain unmodeled."},
        {"label": "Exposure drift", "detail": "Initial investments are held as return-series exposures. SJB resets internally but the investor does not rebalance; time-varying hedge/book ratios are reported. Adjusted returns assume distribution reinvestment, not fixed shares."},
        {"label": "Excluded costs", "detail": "No observed quotes, market impact, short recalls, broker-specific margin schedules, or taxes. This is a research sensitivity, not an executable trade ledger."},
    ]
