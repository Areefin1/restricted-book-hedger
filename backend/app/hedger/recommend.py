"""In-sample search using the same financed paths and cutoff as simulations."""
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

from app.hedger.accounting import overlay_values, terminate_paths
from app.hedger.assumptions import simulation_assumptions
from app.hedger.convexity import PERMITTED_WINDOWS
from app.hedger.data import select_date_range
from app.hedger.funding import cash_growth
from app.hedger.hedge import simulate_hedges


def recommend_ratio(prices, start_date, end_date, instrument, window_days=63,
                    annual_borrow_rate=0.0, book_size=1_000_000, **options):
    if instrument not in {"static_short", "sjb"}:
        raise ValueError("instrument must be static_short or sjb")
    if isinstance(window_days, bool) or window_days not in PERMITTED_WINDOWS:
        raise ValueError("window_days must be one of 21, 63, 126")
    if not np.isfinite(annual_borrow_rate) or not 0 <= annual_borrow_rate <= .25:
        raise ValueError("Annual borrow rate must be between 0 and 0.25")
    selected = select_date_range(prices, start_date, end_date)
    if len(selected) <= window_days:
        raise ValueError(f"A {window_days}-interval window requires at least {window_days + 1} price observations")
    # Validate options with the authoritative simulator, including cash presence.
    simulate_hedges(selected.iloc[:2], book_size, 0, annual_borrow_rate, **options)
    width = window_days + 1
    def windows(array):
        return sliding_window_view(np.asarray(array), width)
    hyg = windows(selected.hyg)
    hyg = hyg / hyg[:, :1]
    sjb = windows(selected.sjb)
    sjb = sjb / sjb[:, :1]
    days = windows(selected.index.to_numpy().astype('datetime64[D]').astype('int64'))
    days = days - days[:, :1]
    rebate = windows(cash_growth(selected, options.get('annual_cash_rate'), -options.get('rebate_spread', 0)))
    rebate = rebate / rebate[:, :1]
    funding = windows(cash_growth(selected, options.get('annual_cash_rate'), options.get('funding_spread', 0)))
    funding = funding / funding[:, :1]
    grid = []
    for ratio in np.arange(21) / 20:
        capacity = options.get('max_hedge_notional')
        if capacity is not None and ratio * book_size > capacity:
            continue
        values = overlay_values(hyg, sjb, rebate, funding, days, 1., ratio,
                                annual_borrow_rate, options.get('round_trip_cost_bps', 0),
                                options.get('book_beta', 1), options.get('annual_basis_return', 0))
        if not np.isfinite(values).all():
            raise ValueError("Search inputs produce nonfinite portfolio values")
        values, _, _ = terminate_paths(values, options.get('termination_floor', 0))
        endings = (values[:, -1, 1 if instrument == 'static_short' else 2] - 1)*100
        grid.append(dict(hedge_ratio=float(ratio), worst_window_return_pct=float(endings.min()),
                         median_window_return_pct=float(np.median(endings)), best_window_return_pct=float(endings.max())))
    best = grid[0]
    for row in grid[1:]:
        if row['worst_window_return_pct'] > best['worst_window_return_pct'] + 1e-9:
            best = row
    return dict(instrument=instrument, objective="Maximize the worst ending portfolio return across overlapping rolling windows.",
                recommended_ratio=best['hedge_ratio'], objective_value_pct=best['worst_window_return_pct'], grid=grid,
                windows_evaluated=len(hyg), window_days=window_days, in_sample=True,
                effective_start_date=selected.index[0].strftime('%Y-%m-%d'), effective_end_date=selected.index[-1].strftime('%Y-%m-%d'),
                assumptions=simulation_assumptions(annual_borrow_rate, selected, **options) + [
                    {"label":"Historical selection", "detail":"Selected and evaluated on the same overlapping history; no holdout. Each window starts with a fresh hedge. Capacity limits exclude infeasible grid ratios."},
                    {"label":"Grid and tradeoffs", "detail":"Ratios 0 to 1 in steps of 0.05; ties favor the smaller ratio. Worst ending return is not within-window drawdown."}])
