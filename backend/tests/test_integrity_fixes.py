"""Independent financial identities and operational boundaries for P0/P1 fixes."""
import importlib.util
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.hedger.data import load_prices
from app.hedger.funding import cash_returns
from app.hedger.hedge import simulate_hedges
from app.hedger.convexity import calculate_rolling_windows
from app.hedger.recommend import recommend_ratio
from app.hedger.sanity import run_sanity_check
from app.main import create_app
from convexity import rolling_windows


def fixture(rows=23):
    dates = pd.bdate_range('2022-01-07', periods=rows, name='date')
    h = np.r_[1, np.cumprod(1 + np.resize([.02, -.03, .01], rows - 1))]
    s = np.r_[1, np.cumprod(1 + np.resize([-.02, .03, -.01], rows - 1))]
    return pd.DataFrame(dict(hyg=100*h, sjb=50*s, rf_return=.0001), index=dates)


def test_matched_cash_accounts_spreads_and_costs_have_independent_values():
    prices = fixture(3)
    options = dict(annual_cash_rate=.08, funding_spread=.03, rebate_spread=.01, round_trip_cost_bps=12)
    result = simulate_hedges(prices, 100_000, .6, .02, **options)
    for i, date in enumerate(prices.index):
        years = (date - prices.index[0]).days / 365
        cash = 1.08**years
        H, J = prices.iloc[i][['hyg', 'sjb']] / prices.iloc[0][['hyg', 'sjb']]
        cost = 60_000 * .0012 if i else 0
        assert result.iloc[i].static_short_hedged == pytest.approx(100_000*H - 60_000*(H-1) + 60_000*(cash*np.exp(-.01*years)-1) - 60_000*.02*years - cost)
        assert result.iloc[i].sjb_hedged == pytest.approx(100_000*H + 60_000*(J-1) - 60_000*(cash*np.exp(.03*years)-1) - cost)


def test_quote_timing_weekend_and_negative_rates():
    p = fixture(3).drop(columns='rf_return').assign(rf_annual_pct=[8., -2., 99.])
    rates = cash_returns(p)
    np.testing.assert_allclose(rates, [0, 1.08**(3/365)-1, .98**(1/365)-1])
    p = p.assign(rf_return=[0, .001, -.0001])
    np.testing.assert_allclose(cash_returns(p), [0, .001, -.0001])


def test_missing_cash_requires_explicit_assumption_and_price_only_api_stays_healthy(tmp_path):
    p = fixture(3).drop(columns='rf_return')
    with pytest.raises(ValueError, match='Cash returns are required'):
        simulate_hedges(p, 100_000, .5)
    simulate_hedges(p, 100_000, .5, annual_cash_rate=0)
    path = tmp_path/'prices.csv'
    p.to_csv(path)
    with TestClient(create_app(Settings(_env_file=None, prices_path=path, metadata_path=tmp_path/'missing.json'))) as client:
        assert client.get('/api/health').status_code == 200
        assert client.get('/api/research/sanity').status_code == 422
        payload = dict(book_size=100000, hedge_ratio=.5, annual_borrow_rate=0, start_date=str(p.index[0].date()), end_date=str(p.index[-1].date()), annual_cash_rate=0)
        assert client.post('/api/simulations', json=payload).status_code == 200


def test_cash_loader_keeps_series_and_rejects_conflicting_aliases(tmp_path):
    p = fixture(3)
    path = tmp_path/'prices.csv'
    p.to_csv(path)
    pd.testing.assert_frame_equal(load_prices(path), p, check_freq=False)
    p.assign(hyg_adj_close=p.hyg+1, sjb_adj_close=p.sjb).to_csv(path)
    with pytest.raises(ValueError, match='[Cc]onflict'):
        load_prices(path)


@pytest.mark.parametrize('bad', [np.nan, np.inf, -1., 'bad'])
def test_cash_series_validation(bad):
    p = fixture(3).astype(object)
    p.loc[p.index[1], 'rf_return'] = bad
    with pytest.raises(ValueError):
        cash_returns(p)


def test_research_compounded_excess_and_zero_mean_volatility():
    p = fixture(23)
    w = calculate_rolling_windows(p, 21).iloc[0]
    cash = (1.0001)**21-1
    assert w.cash_return == pytest.approx(cash)
    assert w.hyg_return == pytest.approx(p.hyg.iloc[21]/p.hyg.iloc[0]-1-cash)
    daily = p.hyg.pct_change().iloc[1:22]-.0001
    assert w.hyg_realized_vol == pytest.approx(np.sqrt(252*np.mean(daily**2)))
    assert w.hyg_sample_vol == pytest.approx(np.std(daily, ddof=1)*np.sqrt(252))
    sanity = run_sanity_check(p)
    assert sanity['points'][0]['hyg_return'] == pytest.approx(.02-.0001)
    assert sanity['points'][0]['sjb_return'] == pytest.approx(-.02-.0001)


def test_zero_mean_vol_includes_constant_trend():
    p = fixture(22).assign(hyg=100*1.01**np.arange(22), rf_return=0)
    w = calculate_rolling_windows(p, 21).iloc[0]
    assert w.hyg_realized_vol == pytest.approx(.01*np.sqrt(252))
    assert w.hyg_sample_vol < 1e-12


@pytest.mark.parametrize('instrument,strategy', [('sjb', 'sjb_hedged'), ('static_short', 'static_short_hedged')])
def test_nonzero_funding_stress_capacity_search_simulator_parity(instrument, strategy):
    p = fixture(25)
    o = dict(annual_cash_rate=.06, funding_spread=.03, rebate_spread=.02, round_trip_cost_bps=15,
             book_beta=2., annual_basis_return=-.1, termination_floor=.97, max_hedge_notional=60_000)
    result = recommend_ratio(p, str(p.index[0].date()), str(p.index[-1].date()), instrument, 21, .025, book_size=100_000, **o)
    assert result['grid'][-1]['hedge_ratio'] == .6
    for row in result['grid']:
        rets = [100*(simulate_hedges(p.iloc[i:i+22], 100_000, row['hedge_ratio'], .025, **o)[strategy].iloc[-1]/100_000-1) for i in range(4)]
        assert row['worst_window_return_pct'] == pytest.approx(min(rets), abs=1e-10)
        assert row['median_window_return_pct'] == pytest.approx(np.median(rets), abs=1e-10)


def test_cutoff_preserves_overshoot_and_exposure_drift():
    p = fixture(3).assign(hyg=[100, 40, 120], sjb=[50, 75, 25], rf_return=0)
    r = simulate_hedges(p, 100_000, .6, book_beta=2)
    assert list(r.unhedged) == pytest.approx([100_000, -20_000, -20_000])
    assert r.attrs['events'][0]['date'] == p.index[1].date()
    assert r.attrs['exposures'][1]['sjb_ratio'] is None
    r = simulate_hedges(p, 100_000, .6)
    assert r.attrs['exposures'][1]['static_short_ratio'] == pytest.approx(.6)
    assert r.attrs['exposures'][1]['sjb_ratio'] == pytest.approx(2.25)
    with pytest.raises(ValueError, match='capacity'):
        simulate_hedges(p, 100_000, .6, max_hedge_notional=50_000)


def test_standalone_funded_inverse_uses_same_cash_and_baseline():
    p = fixture(23)
    old = p.rename(columns={'hyg':'hyg_adj_close', 'sjb':'sjb_adj_close'})
    window = rolling_windows(old, 21).iloc[0]
    cash = 1.0001**21
    H = p.hyg.iloc[21]/p.hyg.iloc[0]
    assert window['start'] == p.index[0]
    assert window['end'] == p.index[21]
    assert window.static_ret == pytest.approx(2*cash-H-1)
    assert (window.static_ret - window.rf) == pytest.approx(-window.hyg_ex)
    assert window.vol == pytest.approx(calculate_rolling_windows(p, 21).iloc[0].hyg_realized_vol*np.sqrt(21/252))


def test_local_cash_import_requires_complete_unique_dates(tmp_path):
    script = Path(__file__).resolve().parents[1]/'scripts/download_prices.py'
    spec = importlib.util.spec_from_file_location('price_import', script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    p = fixture(3)
    path = tmp_path/'cash.csv'
    p[['rf_return']].to_csv(path)
    np.testing.assert_allclose(module.import_cash(path, p.index), .0001)
    p[['rf_return']].iloc[:2].to_csv(path)
    with pytest.raises(ValueError, match='cover every'):
        module.import_cash(path, p.index)
