"""Read-only arithmetic probes for the integrity review; does not refresh data."""
import hashlib
import logging
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from app.config import Settings
from app.main import create_app
from app.hedger.data import load_prices
from app.hedger.hedge import simulate_hedges
from app.hedger.metrics import summarize_paths, max_drawdown_pct
from app.schemas.simulation import SimulationResponse

logging.disable(logging.CRITICAL)
path = ROOT / 'backend/data/prices.csv'
raw = pd.read_csv(path, parse_dates=['date']).set_index('date')
loaded = load_prices(path)
sidecar = json.loads((ROOT / 'backend/data/metadata.json').read_text())
evidence = {'csv_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'sidecar_sha256': sidecar['sha256'], 'loaded_columns': list(loaded.columns),
            'observations': len(raw), 'coverage': [str(raw.index[0].date()), str(raw.index[-1].date())]}
settings = Settings(_env_file=None, prices_path=path, metadata_path=ROOT / 'backend/data/metadata.json')
with TestClient(create_app(settings)) as c:
    body = dict(book_size=1_000_000, hedge_ratio=.6, annual_borrow_rate=.02,
                start_date='2022-01-03', end_date='2022-12-30')
    response = c.post('/api/simulations', json=body)
    evidence['simulation_http'] = {'status': response.status_code, 'body': response.json()}
    evidence['metadata'] = c.get('/api/metadata').json()
    evidence['research_http_status'] = c.get('/api/research/sanity').status_code
    evidence['recommendation_http_status'] = c.post('/api/recommendations', json=dict(
        start_date=body['start_date'], end_date=body['end_date'], instrument='static_short',
        annual_borrow_rate=.02, window_days=63)).status_code
    # Inject only the column discarded by the loader to expose the next defect.
    c.app.state.prices = loaded.assign(rf_annual_pct=raw.rf_annual_pct)
    response = c.post('/api/simulations', json=body)
    evidence['simulation_after_rate_injection_http'] = {'status': response.status_code, 'body': response.json()}

prices = loaded.assign(rf_annual_pct=raw.rf_annual_pct)
selected = prices.loc['2022-01-03':'2022-12-30']
paths = simulate_hedges(selected, 1_000_000, .6, .02)
days = (selected.index[-1] - selected.index[0]).days
old_end = 1_000_000 * (1 + .4 * (selected.hyg.iloc[-1] / selected.hyg.iloc[0] - 1) - .6 * .02 * days / 365)
evidence['2022_conditional_on_rate_interpretation'] = {
    'simulated_static_end': float(paths.static_short_hedged.iloc[-1]),
    'search_and_documentation_static_end': float(old_end),
    'difference_dollars': float(paths.static_short_hedged.iloc[-1] - old_end),
    'elapsed_calendar_days': days,
    'warning': 'Assumes unverified rf_annual_pct is an effective annual percentage, as hedge.py does.'}
evidence['simulator_columns'] = list(paths.columns)
try:
    SimulationResponse.model_validate(dict(paths=paths.reset_index().to_dict('records'),
        summary=summarize_paths(paths).to_dict('records'), effective_start_date=selected.index[0].date(),
        effective_end_date=selected.index[-1].date(), assumptions=[{'label':'Probe','detail':'Probe'}],data_version='probe'))
except Exception as exc:
    evidence['response_schema_errors_after_rate_injection'] = [
        {'field': list(e['loc']), 'type': e['type']} for e in exc.errors()[:6]]

# Arbitrary flat-price 365-day example isolates financing conventions exactly.
flat = pd.DataFrame({'hyg':[100.,100.], 'sjb':[50.,50.], 'rf_annual_pct':[5.,5.]},
                    index=pd.DatetimeIndex(['2022-01-03','2023-01-03'], name='date'))
evidence['flat_5pct_one_year'] = simulate_hedges(flat,100.,1.,0.).iloc[-1].to_dict()

def ols(x,y):
    beta = np.sum((x-x.mean())*(y-y.mean())) / np.sum((x-x.mean())**2)
    return {'beta':float(beta),'intercept_daily':float(y.mean()-beta*x.mean()),
            'intercept_times_252_pct':float((y.mean()-beta*x.mean())*25200)}
rets = loaded.pct_change().iloc[1:]
intervals = raw.index.to_series().diff().dt.days.iloc[1:]
rf = (1 + raw.rf_annual_pct.shift(1).iloc[1:]/100)**(intervals/365)-1
evidence['total_return_regression'] = ols(rets.hyg.to_numpy(),rets.sjb.to_numpy())
evidence['conditional_excess_return_regression'] = ols((rets.hyg-rf).to_numpy(),(rets.sjb-rf).to_numpy())

daily = loaded.hyg.pct_change()
w = 63
sample = daily.rolling(w).std(ddof=1).iloc[w:] * np.sqrt(252)
zero_mean = np.sqrt(daily.pow(2).rolling(w).sum().iloc[w:] / w * 252)
sample_bucket = pd.Series(pd.qcut(sample.rank(method='first'),3,labels=False).to_numpy(),index=sample.index)
zero_bucket = pd.Series(pd.qcut(zero_mean.rank(method='first'),3,labels=False).to_numpy(),index=zero_mean.index)
evidence['63_interval_volatility'] = {'windows':len(sample),'tercile_changes_total_returns':int((sample_bucket!=zero_bucket).sum()),
    'max_annualized_vol_difference_pct_points':float((sample-zero_mean).abs().max()*100),
    'note':'Isolates demeaning alone, using the same total returns; paper replication also requires excess returns.'}
evidence['two_day_volatility'] = {label:{'sample_annualized_pct':float(np.std(r,ddof=1)*np.sqrt(252)*100),
    'paper_root_sum_squares_pct':float(np.sqrt(np.sum(np.array(r)**2))*100)}
    for label,r in [('continuation',[.1,.1]),('reversal',[.1,-.1])]}

evidence['independent_arithmetic'] = {
    'drawdown_100_120_90_110_pct':max_drawdown_pct(pd.Series([100.,120.,90.,110.])),
    'flat_daily_5pct_weekend_growth':float(simulate_hedges(pd.DataFrame(
        {'hyg':[100.,100.], 'sjb':[50.,50.], 'rf_annual_pct':[5.,5.]},
        index=pd.DatetimeIndex(['2022-01-07','2022-01-10'])),100.,1.).static_short_hedged.iloc[-1]-100),
    'expected_weekend_growth':100*((1.05)**(3/365)-1)}

evidence['worst_return_days'] = [dict(date=str(i.date()),hyg=float(r.hyg),sjb=float(r.sjb))
    for i,r in rets.loc[rets.abs().max(axis=1).nlargest(8).index].iterrows()]
evidence['rate_min_max'] = [float(raw.rf_annual_pct.min()),float(raw.rf_annual_pct.max())]
evidence['full_history_initial_60pct_sjb_hedge_exposure_at_end'] = float(
    .6 * (loaded.sjb.iloc[-1] / loaded.sjb.iloc[0]) / (loaded.hyg.iloc[-1] / loaded.hyg.iloc[0]))
evidence['zero_price_returns'] = {col:int((rets[col]==0).sum()) for col in rets.columns}
evidence['gaps_above_four_calendar_days'] = {str(i.date()):int(v) for i,v in raw.index.to_series().diff().dt.days.items() if v>4}
out = ROOT / 'docs/review/evidence.json'
out.write_text(json.dumps(evidence,indent=2),encoding='utf-8')
print(json.dumps(evidence,indent=2))
