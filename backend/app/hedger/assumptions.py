"""Shared accounting conventions returned with simulations and searches."""


def simulation_assumptions(annual_borrow_rate: float) -> list[dict[str, str]]:
    return [
        {"label": "Proxy", "detail": "The restricted book follows adjusted HYG returns, not individual bond exposures."},
        {"label": "Capital accounting", "detail": "Original book value plus hedge P/L. Fixed initial positions; the SJB purchase is offset by financing at zero interest."},
        {"label": "Static short", "detail": f"Negative adjusted HYG return on initial hedge exposure, less {annual_borrow_rate:.2%} annual borrow cost using actual elapsed calendar days / 365. This is a return-series approximation, not an executable short ledger."},
        {"label": "SJB hedge", "detail": "Buy and hold the initial SJB investment. Observed adjusted returns include distributions and fund expenses; no additional expense deduction is applied."},
        {"label": "Excluded costs", "detail": "No spreads, commissions, financing interest, margin, borrow recalls, or interest on short-sale proceeds."},
    ]
