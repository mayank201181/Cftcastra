# CFTC Astra — Positioning Atlas

[Open the live dashboard](https://cftcastra.vercel.app/)

A research dashboard for CFTC futures positioning across foreign exchange, rates, commodities, equity indices and crypto. Built with Next.js and React for Vercel.

## Coverage

- All currently reporting contracts in TFF, Disaggregated and Legacy reports; futures-only and futures/options-combined stay separate.
- Retained history from 2006, with current-universe coverage disclosed (not a survivorship-free archive of every discontinued instrument).
- Long, short, spreading, gross sides, net contracts, open interest, weekly and four-week changes.
- Net/OI empirical percentiles over 6 months, 1/3/5/10 years and all retained history; incomplete windows remain blank.
- Z-scores, flow ranks, market drilldowns, comparisons, source tables, CSV exports and device-local watchlists.
- Indicative dollar notional using dated FX / nearby-futures marks; Treasury face and STIR reference principal are clearly differentiated. Unmapped values remain missing. Optional USD-per-contract overrides are stored only in the browser.
- Nine explicit macro baskets, custom signed baskets and correlations of weekly positioning changes.

## Spec positioning comparison

The Spec positioning view compares leveraged funds (managed money for commodities), Legacy noncommercials and asset managers side by side for the same contract and report basis. The three overlapping classifications are never added together. Asset managers are unavailable in the commodity report. Each card preserves its own net contracts, weekly change, net/OI and 6M/1Y/3Y/5Y/10Y/all-retained percentiles.

The sortable scanner flags opposite net signs and a descriptive historical-rank gap of at least 50 percentile points. These are separate flags: a low historical rank need not mean net short. Cross-lens flags are suppressed if any relevant category is missing or report dates/bases differ. The history chart keeps separate series and gaps; the CSV contains one row per market and category with dates and source URLs. Refresh checks all three report families.

`npm run test:spec` verifies contract/basis alignment, the 20 October 2026 AUD reference when that snapshot is current, independent percentiles, date guards, missing categories, history gaps and exports.

## Run

Node 22.13+ and Python 3. CFTC retrieval uses the standard library; research feeds also need `poppler-utils` and the pinned packages in `scripts/requirements-research.txt`:

```sh
npm install
python3 scripts/refresh.py
python3 -m pip install -r scripts/requirements-research.txt
python3 scripts/refresh-research.py
npm run data:build
npm test
npm run dev
```

Production: `npm run build` then `npm start`. The first build downloads missing seed archives; subsequent builds reuse validated retained archives. Vercel settings are in `vercel.json`.

## Data and updates

The official CFTC public-reporting API supplies all positions. Six compressed raw archives in `data/` retain original numeric fields. `scripts/build-data.mjs` generates static snapshots and individual histories, avoiding an upstream dependency on every page load. `GET /api/snapshot?dataset=...` merges newly reported rows with retained history; `GET /api/history` provides live selected-market history. These routes are read-only public-data operations with one-hour caches and no credentials.

`.github/workflows/refresh.yml` runs Friday and Monday at 22:15 UTC, equivalent to Saturday and Tuesday 06:15 Asia/Singapore. It fetches the latest release, validates accounting, updates raw archives and dated price proxies, and commits changed data. Vercel's Git integration deploys the resulting commit. A workflow run must succeed to establish that unattended refresh is operational; its presence alone is not proof.

Initial historical downloads are revised history, not historical vintages. Git retains the vintages captured prospectively by this project. A backtest must use actual release timing and data available at that time. The conditional-return studies below are exploratory, not validated strategy performance or a washout probability.

## Calculation rules

- `net = long - short`; `net/OI = 100 * net / open_interest`.
- Reported directional longs/shorts exclude separately reported spreading. `gross sides = long + short + 2 * spread`; this is not unique OI.
- Weekly differences require an exact 7-day predecessor. Four-week differences require 28 days. Missing comparisons stay null.
- A percentile is midrank: `100 * (less + 0.5 * ties) / N`, including the current observation. Full lookbacks need history reaching the window boundary (one-week tolerance) and at least 80% of expected weekly observations. Constant histories rank at 50.
- USD weekly flow is the contract change times the currently displayed USD-per-contract mark, not the change in marked position value. It excludes price revaluation.
- Treasury face amounts are not DV01. Short-rate reference principals are not Treasury-equivalent dollar risk. Futures/options-combined uses the CFTC's delta-equivalent positions.
- Theme score: absolute-weighted mean of each leg's percentile, inverted for negative weights. Requires every component. It is an alignment index, not a percentile of the basket's own history or a probability.
- Flow correlations use matching dated changes in net/OI and at least 26 paired weeks. They do not demonstrate shared investors or return correlation.
- Default baskets select consolidated equity series, never their underlying E-mini/micro rows too. All individual rows remain available for inspection.

## Research layers

**Conclusions is the first and default tab.** It selects dated evidence using explicit rules: category disagreement, core-market fund net/OI extremes with price context, weekly rotation, nearby trend-rule switches and WTI's option contribution. Each note includes a conditional implication, a challenge to that reading and links to inspect the evidence. A high historical rank can still be an outright net short. The macro basket summary and independent ICE/JPX context stay separate from measured CFTC holdings.

`scripts/refresh-research.py` archives raw normalized observations in `data/research-inputs.json` and daily prices in `data/research-prices.json.gz`. `scripts/build-research.mjs` produces `/data/research.json`; build-time analytics keep the UI responsive. The read-only refresh button reloads the published archive. `.github/workflows/research.yml` fetches daily at **23:40 UTC Monday–Friday / 07:40 Singapore Tuesday–Saturday**, preserving source dates on failures. The research and CFTC workflows share a concurrency group to serialize archive commits.

| Layer | Implementation | Material limits |
| --- | --- | --- |
| Daily OI / nowcast | Official CME FX bulletin; standard-contract OI, 1D change, change since COT; fund, Legacy and asset-manager regressions | Daily OI does not identify participants. Only FX has a nowcast. Weekly regression validation does not validate partial-week extrapolation. |
| CTA proxy | Completed daily price versus 20/60/120-session SMA, next-close switch levels, 20-day volatility, 5-session return | Model votes, not actual CTA holdings or sized flows. Nearby futures can jump at rolls. CNH history currently insufficient. |
| ICE energy | Brent/gasoil managed money, futures and combined, independent ranks and histories | ICE categories are not added to CFTC categories. |
| TTF | ESMA ICE Endex TFM investment funds; matched basis/unit histories | MWh units; derived OI from reconciled category totals. New futures-only history has limited rank coverage. |
| Japan | JPX Tokyo/Nagoya cash-equity investor purchases, sales and net flows | Five recent weeks seeded; future observations accumulate. Cash flows, not derivatives holdings. |
| Asian FX poll | Validated local CSV import for Reuters' nine-currency −3…+3 USD score | Current numeric poll requires authorized access. No auto-scraping or invented scores. CNY is not a dedicated CNH series. |
| Option contribution | Combined net minus futures net on identical dates/contracts/groups; own historical ranks | Delta equivalents, not inferred call buying. Rank differences alone have no option-trade interpretation. |
| Strike concentration | CME ADU monthly call/put strike buckets, totals reconciled to the bulletin | AUD only, not the entire FX options market. Monthly buckets may combine exact expiries; no dealer gamma or validated pin forecast. |
| Conditional returns | 4/8/13-week returns after entry into 3Y 10/90 extremes; fixed 5/95 sensitivity | Revised CFTC/current universe, assumed publication embargo and proxy prices. Exploratory research, not strategy P&L. |

### Research calculations

- Next-close N-session switch = mean of the latest N−1 completed closes. A close above/below changes that model vote. Three unanimous votes are Long/Short; otherwise Mixed. FX is normalized to USD per foreign currency, so positive means foreign-currency strength. All price histories carry their own dates and source URLs.
- Nowcast target is weekly change in group net / prior OI. Features are price return and OI change. Rolling OLS uses up to 156 weeks; 26 sequential held-out observations are compared with unchanged positioning by MSE. Nonpositive improvement suppresses the estimate. Positive gain is descriptive, not statistical proof. Partial-week application scales the intercept by elapsed calendar days / 7. The ±1.96 RMSE band is heuristic, bounded by current OI, not a calibrated confidence interval. Stale dates, insufficient training, singular regression, >30% OI scope differences and infeasible estimates suppress points.
- Option contribution = `(combined long − combined short) − (futures long − futures short)`. Its normalization uses futures-only OI consistently. Its own percentile is recalculated from that contribution series; independent futures/combined percentiles are never subtracted. Weekly changes require exactly seven days; mismatched latest reports are invalid.
- Conditional studies use rolling ranks available at each historical report date, then delay entry at least seven calendar days. Entry and 4/8/13-week exits use the first available close on or after the target (maximum four-day slippage). Only new extreme episodes qualify, with a 13-week cooldown across both sides. Missing forward horizons are excluded. Known publication interruptions in 2013, 2018–19, 2023 and 2025 are conservatively excluded, but no complete historical vintage calendar is available. Event dates and prices are auditable via CSV. Baselines include overlapping weekly starts and are labelled accordingly. Wilson hit intervals, sample sizes and 2020+ descriptive subsamples are shown. There is no threshold optimization or multiple-testing-adjusted significance claim.
- FX study prices are spot, excluding carry. Bitcoin uses spot. Other studies use adjusted ETF proxies (SPY/QQQ/IWM/IEF/TLT/USO/UNG/GLD/SLV/CPER), not raw continuous futures returns. The entire adjusted-close history is reloaded to avoid splicing inconsistent corporate-action adjustment bases. No execution, spread, cost or capacity assumptions are converted into a claimed strategy result.

### Research sources and validation

- [CME daily bulletin](https://www.cmegroup.com/market-data/daily-bulletin.html): dated preliminary/final FX OI and option strike records; PDF hash retained.
- [ICE annual COT CSVs](https://www.ice.com/cot-report-links) and [category notes](https://www.ice.com/publicdocs/futures/CoT_Notes.pdf).
- [ESMA register API documentation](https://registers.esma.europa.eu/publication/helpApp): `esma_registers_coder58`, MIC NDEX / product TFM.
- [JPX investor trading](https://www.jpx.co.jp/english/markets/statistics-equities/investor-type/index.html): source workbook links and thousand-yen-to-billion-yen conversion preserved.
- [Reuters survey methodology example](https://www.reuters.com/markets/asia/bears-fortify-bets-asian-fx-resilient-dollar-growth-fears-2022-10-06/): positive USD score means short local currency; this old article is methodology only, not a current reading.
- Yahoo Finance chart histories are public daily price proxies, not exchange settlements; each series links to its corresponding history page.
- [CFTC historical publication interruptions](https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalSpecialAnnouncements/index.htm).

Run `npm run test:research`, `python3 scripts/verify-research-feeds.py --archive`, the existing CFTC/spec checks, and `npm run build`. Tests exercise accounting differences, next-close switch identities, held-out-date gates, regression recovery, non-overlapping event timing, future-data independence, missing data, CSV score signs, strike total reconciliation and source unit/date invariants. The UI also requires deployed browser checks for navigation, sort direction, filters, mobile layout and CSV downloads.

## Original sources and reuse review

- [CFTC COT reports](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm)
- [CFTC explanatory notes](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ExplanatoryNotes/index.htm)
- [CFTC public reporting guide](https://publicreporting.cftc.gov/stories/s/COT-Help/p2fg-u73y/)
- [CME Micro E-mini specifications](https://www.cmegroup.com/articles/faqs/micro-e-mini-equity-index-futures-frequently-asked-questions.html)

Open-source projects evaluated as references: [cftc-cot-viewer](https://github.com/proprietary/cftc-cot-viewer), [cftc-cot](https://github.com/victorKariuki/cftc-cot), [cot_reports](https://github.com/NDelventhal/cot_reports) and [pycot](https://github.com/philsv/pycot). Application and analytics code here were independently implemented; no repository was copied wholesale.

Price proxies are mostly supplementary Yahoo daily closes, not official settlements. VIX uses a dated Cboe futures settlement; MSCI contracts use named-contract quotes, including an explicitly sourced secondary-market seed when the regular quote feed is unavailable. Quote failures retain the previous dated mark and the UI flags stale marks. Source URLs and observation dates are retained in `data/prices.json`; initial provenance is in `data/price-audit.json` and `data/extra-price-audit.json`. CFTC's current Micro Russell text appears to say $0.5; the vetted mapping uses CME's $5 per index point. Unsupported or uncertain conversions remain null.

## Verification

`npm test` reconciles both sides of OI, checks unique observation keys, all net/gross arithmetic, weekly differences and rank bounds across the retained rows. Additional fixtures cover inverse JPY valuation, cent-denominated grain prices, Treasury principal, future-dated price rejection, insufficient SOFR history, signed theme alignment and flow correlation.

No portfolio holdings, trades, credentials or user financial records are stored. Custom baskets, marks, theme appearance and watchlists are device-local preferences.
