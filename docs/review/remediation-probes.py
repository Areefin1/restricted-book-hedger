"""Read-only API acceptance evidence for the P0/P1 remediation.

Run from the repository root. The older probes intentionally demonstrate the
pre-repair failures; this script records current behavior without changing data.
"""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'backend'))
from fastapi.testclient import TestClient
from app.main import create_app

with TestClient(create_app()) as client:
    metadata = client.get('/api/metadata').json()
    body = dict(book_size=1_000_000, hedge_ratio=.6, annual_borrow_rate=.02,
                start_date='2022-01-03', end_date='2022-12-30')
    response = client.post('/api/simulations', json=body)
    assert response.status_code == 200, response.text
    sim = response.json()
    zero = client.post('/api/simulations', json={**body, 'hedge_ratio':0})
    assert zero.status_code == 200, zero.text
    assert all(p['unhedged'] == p['static_short_hedged'] == p['sjb_hedged'] for p in zero.json()['paths'])
    assert all(p[k+'_pnl'] == p[k]-body['book_size'] for p in sim['paths'] for k in ('unhedged','static_short_hedged','sjb_hedged'))
    sanity = client.get('/api/research/sanity').json()
    rolling = client.get('/api/research/convexity?window_days=63').json()
    search = {}
    for instrument in ('static_short','sjb'):
        query = {k:v for k,v in body.items() if k != 'hedge_ratio'}
        r = client.post('/api/recommendations', json={**query, 'instrument':instrument, 'window_days':63})
        assert r.status_code == 200, r.text
        search[instrument] = r.json()
    evidence = dict(metadata=metadata, request=body, simulation_status=response.status_code,
                    zero_hedge_status=zero.status_code, simulation_summary=sim['summary'],
                    ending_exposure=sim['exposures'][-1], events=sim['events'],
                    sanity={k:v for k,v in sanity.items() if k != 'points'},
                    rolling_windows=len(rolling['points']), rolling_notes=rolling['notes'],
                    scenarios=client.get('/api/scenarios').json(), search=search)
    (ROOT/'docs/review/evidence-remediation.json').write_text(json.dumps(evidence, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k:evidence[k] for k in ('simulation_status','zero_hedge_status','simulation_summary','ending_exposure','rolling_windows')}, indent=2))
