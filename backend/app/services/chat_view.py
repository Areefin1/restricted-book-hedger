"""Reconstruct the current page and visible chart facts from server-owned data.

The browser supplies view controls, never numerical results. Zoom slices the
original paths: it does not restart holdings, financing, drawdowns or trades.
"""
import numpy as np
import pandas as pd

from app.hedger.metrics import STRATEGIES
from app.hedger.recommend import recommend_ratio
from app.schemas.explanation import ChatView, ChartViewport
from app.schemas.simulation import SimulationRequest, SimulationResponse


PAGE_CHARTS = {
    'simulator': ['portfolio'], 'risk': ['drawdown', 'exposure', 'max-drawdown'],
    'strategies': ['mechanics'], 'research': ['daily', 'convexity', 'volatility'],
    'recommendation': ['ratio-search'], 'assumptions': [],
}
LABELS = dict(zip(STRATEGIES, ['Unhedged (HYG)', 'Static short hedge', 'SJB hedge']))


def _bounds(values, date_axis=False):
    if values is None:
        return None
    try:
        if date_axis:
            parsed = [pd.to_datetime(value, unit='ms', utc=True) if isinstance(value, (int, float))
                      else pd.to_datetime(value, utc=True) for value in values]
            if any(pd.isna(value) for value in parsed):
                raise ValueError()
            return sorted(value.tz_localize(None) for value in parsed)
        parsed = [float(value) for value in values]
        if not np.isfinite(parsed).all():
            raise ValueError()
        return sorted(parsed)
    except (ValueError, TypeError, OverflowError) as exc:
        raise ValueError('Chart ranges must contain valid dates or finite axis values') from exc


def _chart_facts(viewport: ChartViewport, series: list[dict], date_axis=False):
    x_bounds = _bounds(viewport.x_range, date_axis)
    y_bounds = _bounds(viewport.y_range)
    y2_bounds = _bounds(viewport.y2_range)
    output = {'chart': viewport.chart, 'viewport': viewport.model_dump(mode='json'), 'series': []}
    for trace in series:
        if trace['name'] in viewport.hidden_series:
            continue
        points = trace['points']
        selected = []
        for point in points:
            x = pd.Timestamp(point['x']) if date_axis else point['x']
            y = point['y']
            bounds = y2_bounds if trace.get('axis') == 'y2' else y_bounds
            if y is None or not np.isfinite(y):
                continue
            if x_bounds is not None and not x_bounds[0] <= x <= x_bounds[1]:
                continue
            if bounds is not None and not bounds[0] <= y <= bounds[1]:
                continue
            selected.append(point)
        facts = {key: value for key, value in trace.items() if key != 'points'}
        facts['visible_points'] = len(selected)
        if selected:
            low = min(selected, key=lambda p: p['y'])
            high = max(selected, key=lambda p: p['y'])
            indices = set(np.linspace(0, len(selected) - 1, min(24, len(selected)), dtype=int).tolist())
            facts.update(first=selected[0], last=selected[-1], minimum=low, maximum=high,
                         average=float(np.mean([p['y'] for p in selected])),
                         sampled_points=[selected[index] for index in sorted(indices)])
            if date_axis:
                facts['visible_y_change'] = selected[-1]['y'] - selected[0]['y']
            if 'portfolio_value_usd' in selected[0]:
                first, last = selected[0]['portfolio_value_usd'], selected[-1]['portfolio_value_usd']
                facts['visible_value_change_usd'] = last - first
                facts['visible_period_return_pct'] = (last / first - 1) * 100 if first > 0 else None
        output['series'].append(facts)
    return output


def _trace(name, xs, ys, units, **extra):
    return dict(name=name, units=units, points=[dict(x=x, y=y) for x, y in zip(xs, ys)], **extra)


def build_view_context(view: ChatView, inputs: SimulationRequest, result: SimulationResponse, state) -> dict:
    context = {
        'page': view.page, 'settings': view.model_dump(mode='json', exclude={'charts', 'data_version'}),
        'scope_rules': [
            'Answer about the active page and its visible chart bounds first. Full-period summary cards remain full-period even when a chart is zoomed.',
            'Zoom filters already-calculated observations. It never starts a fresh hedge or changes the original simulation capital.',
            'Chart y-ranges may clip lines. Visible samples are bounded summaries; do not invent unsupplied movements between samples.',
            'Numerical chart coordinates use the supplied units. Research returns on chart axes are percentages, not decimals.',
        ],
        'charts': [],
    }
    paths = result.paths
    dates = [p.date.isoformat() for p in paths]
    sources = {}
    if view.page in ('simulator', 'risk'):
        portfolio, drawdown = [], []
        for strategy in STRATEGIES:
            values = np.array([getattr(p, strategy) for p in paths])
            shown = values if view.chart_mode == 'value' else values - inputs.book_size if view.chart_mode == 'pnl' else (values / inputs.book_size - 1) * 100
            portfolio.append(_trace(LABELS[strategy], dates, shown.tolist(), 'percent' if view.chart_mode == 'return' else 'USD'))
            for point, value in zip(portfolio[-1]['points'], values.tolist()):
                point.update(portfolio_value_usd=value, cumulative_pnl_usd=value - inputs.book_size)
            drawdown.append(_trace(LABELS[strategy], dates, ((values / np.maximum.accumulate(values) - 1) * 100).tolist(), 'percent below original running peak'))
            if view.page == 'risk':
                valid = bool((values[:-1] > 0).all())
                returns = values[1:] / values[:-1] - 1 if valid else np.array([])
                context.setdefault('risk_metrics_full_period', []).append(dict(strategy=strategy,
                    annualized_volatility_pct=float(np.std(returns, ddof=1) * np.sqrt(252) * 100) if len(returns) >= 2 else None,
                    worst_day_pct=float(returns.min() * 100) if len(returns) else None,
                    hedge_pnl_usd=float(values[-1] - paths[-1].unhedged)))
        sources['portfolio'] = (portfolio, True)
        sources['drawdown'] = (drawdown, True)
        sources['exposure'] = ([_trace(name, [p.date.isoformat() for p in result.exposures],
            [getattr(p, key) for p in result.exposures], 'hedge/book ratio')
            for name, key in [('Short HYG / book', 'static_short_ratio'), ('SJB / book', 'sjb_ratio')]], True)
        # The horizontal bar chart has a categorical y-axis. Its full-period
        # numbers are supplied in the authoritative summary, not date-filtered.
        context['risk_summary_scope'] = 'Full simulation period; drawdown charts retain peaks before the visible date range.'
    elif view.page == 'strategies':
        points = result.instrument_returns
        xs = [p.date.isoformat() for p in points]
        sources['mechanics'] = ([_trace('HYG', xs, [p.hyg_return * 100 for p in points], 'percent total return from original inception'),
            _trace('Static -1x reference', xs, [-p.hyg_return * 100 for p in points], 'percent total return; excludes costs'),
            _trace('SJB', xs, [p.sjb_return * 100 for p in points], 'percent total return from original inception')], True)
        returns = {'choppy': [.1, -.1], 'down': [-.05, -.05], 'up': [.05, .05]}[view.example]
        hyg, sjb = float(np.prod(1 + np.array(returns)) - 1), float(np.prod(1 - np.array(returns)) - 1)
        context['worked_example'] = dict(path=view.example, illustrative_not_market_data=True,
            daily_hyg_returns=returns, hyg_total_return=hyg, static_total_return=-hyg, inverse_total_return=sjb)
    elif view.page == 'research':
        if state.research_error:
            raise ValueError(state.research_error)
        research = state.convexity[view.window_days]
        points = research['points']
        sanity = state.sanity
        context['research'] = dict(window_days=view.window_days, total_windows=len(points), notes=research['notes'],
            units='Stored research returns/volatility are decimals; chart axes and summaries below are percent.',
            daily_fit={key: value for key, value in sanity.items() if key != 'points'})
        sources['daily'] = ([_trace('Trading day', [p['hyg_return'] * 100 for p in sanity['points']],
            [p['sjb_return'] * 100 for p in sanity['points']], 'percent daily excess return')], False)
        for point, row in zip(sources['daily'][0][0]['points'], sanity['points']):
            point['date'] = row['date']
        sources['convexity'] = ([_trace(f'{view.window_days}-day window', [p['hyg_return'] * 100 for p in points],
            [p['sjb_return'] * 100 for p in points], 'percent compounded excess return')], False)
        for point, row in zip(sources['convexity'][0][0]['points'], points):
            point.update(start_date=row['start_date'], end_date=row['end_date'], hyg_realized_vol_pct=row['hyg_realized_vol'] * 100)
        sources['volatility'] = ([_trace('HYG realized vol', [p['end_date'] for p in points],
            [p['hyg_realized_vol'] * 100 for p in points], 'percent annualized zero-mean excess volatility'),
            _trace('SJB − static reference', [p['end_date'] for p in points],
            [(p['sjb_return'] + p['hyg_return']) * 100 for p in points], 'percentage points', axis='y2')], True)
        context['research']['window_scope'] = 'The date axis is window END date; each observation still includes all N earlier return intervals. Scatter axes are returns, not dates.'
        if len(points) >= 3:
            ordered = sorted(points, key=lambda p: p['hyg_realized_vol'])
            cuts = [0, len(points) // 3, 2 * len(points) // 3, len(points)]
            buckets = []
            for k, label in enumerate(['Low volatility', 'Medium volatility', 'High volatility']):
                group = ordered[cuts[k]:cuts[k + 1]]
                gaps = [p['sjb_return'] + p['hyg_return'] for p in group]
                buckets.append(dict(label=label, windows=len(group),
                    vol_low_pct=group[0]['hyg_realized_vol'] * 100, vol_high_pct=group[-1]['hyg_realized_vol'] * 100,
                    average_hyg_excess_return_pct=float(np.mean([p['hyg_return'] for p in group]) * 100),
                    average_sjb_excess_return_pct=float(np.mean([p['sjb_return'] for p in group]) * 100),
                    average_gap_pp=float(np.mean(gaps) * 100), sjb_ahead_pct=float(np.mean(np.array(gaps) > 0) * 100)))
            context['research']['volatility_table_full_history'] = buckets
    elif view.page == 'recommendation':
        options = inputs.model_dump(exclude={'start_date', 'end_date', 'hedge_ratio', 'annual_borrow_rate'})
        rec = recommend_ratio(state.prices, inputs.start_date, inputs.end_date, view.instrument, view.window_days,
                              inputs.annual_borrow_rate, **options)
        context['search'] = rec
        sources['ratio-search'] = ([_trace(name, [r['hedge_ratio'] for r in rec['grid']],
            [r[key] for r in rec['grid']], 'percent window return')
            for name, key in [('Best window', 'best_window_return_pct'), ('Median window', 'median_window_return_pct'),
                              ('Worst window (objective)', 'worst_window_return_pct')]], False)
        context['search_scope'] = 'In-sample grid search, not an investment recommendation. Axis zoom does not change the search objective or selected ratio.'
    else:
        context['scope_rules'].append('This is the methodology/assumptions page. Explain provenance and model conventions first.')

    requested = {chart.chart: chart for chart in view.charts if chart.chart in PAGE_CHARTS[view.page]}
    for chart_id in PAGE_CHARTS[view.page]:
        if chart_id not in sources:
            continue
        viewport = requested.get(chart_id, ChartViewport(chart=chart_id))
        series, is_date = sources[chart_id]
        context['charts'].append(_chart_facts(viewport, series, is_date))
    return context
