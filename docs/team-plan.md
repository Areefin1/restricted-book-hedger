# Restricted Book Hedger: delivery status and ownership

The original four-person plan is now implemented as a local historical research demo. This document replaces the proposed scaffold checklist with the delivered scope. Run instructions are in [README](../README.md); formulas are in [methodology](methodology.md), endpoint details in [API contract](api-contract.md), and the rehearsal in [demo script](demo-script.md).

## Delivered scope

| Workstream | Original owner | Delivered behavior |
| --- | --- | --- |
| Data and API foundation | A | Validated cache, content hash and provenance, startup snapshot, CORS, normalized errors, metadata and health endpoints |
| Simulation and risk | B | Three portfolio paths and P/L series, summary returns/drawdown, calendar-day borrow costs, validated simulation schema and endpoint |
| Scenarios | B, A exposing | 2020 stress, calendar 2022, rule-selected choppy period, and full-history presets resolved against real data |
| Research | C, A exposing | Daily OLS diagnostics, overlapping 21/63/126-interval returns and sample volatility, finite JSON schemas, full-history API responses |
| Frontend integration | D, C research UI | Real HTTP by default, metadata-driven source labels, forms, portfolio/risk/mechanics views, research charts, retries, stale-response protection, responsive navigation |
| Historical ratio search | B, D UI | Both instruments, 21 candidate ratios, worst-ending-return objective, median/best tradeoffs, in-sample labels, apply-to-simulator action |
| Demo and handoff | All | Single-origin local runner, offline cached-data path, setup/API/methodology/deployment documentation, reference output and browser checks |

Python remains authoritative for simulation, research, and search. The frontend computes display-level risk details from returned paths. Synthetic data is an explicit development option, never an automatic fallback for an unavailable API. Capital accounting and actual/365 borrow accrual are consistent across real and mock calculations.

## Acceptance evidence

- [x] Cached data is loaded locally without provider calls during startup or requests.
- [x] Dates are sorted and unique; paired prices are positive, complete, and finite.
- [x] Known portfolio examples, zero-hedge behavior, full-short behavior, calendar borrowing, and drawdown arithmetic have automated checks.
- [x] Total-value paths and cumulative portfolio P/L are separately returned and displayed.
- [x] API schemas, units, effective dates, data versions, and error bodies are documented and checked.
- [x] A 63-interval return requires 64 price observations; volatility uses the same return window.
- [x] Three required historical presets are available in the bundled cache with stated selection rules.
- [x] Real-cache simulation and research endpoints work through React in desktop and mobile browser tests.
- [x] Both research charts render, window controls work, and interpretation labels state dependence/basis limitations.
- [x] Historical search results agree with independent simulations for every tested candidate/window.
- [x] Frontend lint, type checking/production build, and backend tests pass in the existing development environment.
- [x] One-command local demo and no-download rehearsal instructions are available.

Verification is on the existing installed environment, not a claim that every operating system or fresh dependency environment has been independently exercised. Browser tests launch an isolated local service and browser; they do not verify a public deployment. Offline operation follows the local-only cache/assets path; no OS-wide network settings were changed for testing.

## Remaining boundaries

| Item | Status / next decision |
| --- | --- |
| Legacy data provenance | Original retrieval time is unknown; recorded honestly as null. Explicit future refreshes record provenance. Structural validation does not independently verify provider accuracy. |
| Public hosting | Not deployed; use [deployment notes](deployment.md) and repeat browser checks against the selected host before calling that environment ready. |
| Academic theory overlay | Excluded from the demo; verify the paper and applicability before implementing or claiming replication. |
| Out-of-sample validation | Not implemented. Ratio selection/evaluation uses the same history and is labeled in-sample. |
| Accounts, persistence, exports | Deferred product extensions; not required for the historical demo. |
| Institutional portfolio modeling | Actual exposures, basis/liquidity/financing, model validation, and access controls require a separate scope. |
| Chart load performance | Full Plotly library is lazy-loaded but large; consider a smaller bundle for broader deployment. |
| Environment reproducibility | Python direct dependencies are pinned; frontend has a lockfile. A full Python transitive lock and clean-environment CI can follow. |
| Team rehearsal | Each owner should explain their formulas, evidence, and limitations using the demo script; a human rehearsal is not certified by automated tests. |

## Collaboration and future changes

A owns data/API foundations; B owns simulation, scenarios, metrics, and search; C owns research calculations/interpretation; D owns the frontend shell and integration. These remain maintenance responsibilities, not claims that four independent people reviewed this implementation.

Before changing shared units or response fields, update the Python schema, TypeScript types, contract, methodology, and meaningful checks together. Review small changes, use the cached data for reproducible demos, and keep optional scope from destabilizing core correctness. Production URLs, access controls, provider licensing, and deployment results need explicit operational decisions when public hosting is requested.
