# CFTC Astra — Positioning Atlas

A research dashboard for CFTC futures positioning across foreign exchange, rates, commodities, equity indices and crypto. Built with Next.js and React for Vercel.

## Coverage

- All currently reporting contracts in TFF, Disaggregated and Legacy reports; futures-only and futures/options-combined stay separate.
- Retained history from 2006, with current-universe coverage disclosed (not a survivorship-free archive of every discontinued instrument).
- Long, short, spreading, gross sides, net contracts, open interest, weekly and four-week changes.
- Net/OI empirical percentiles over 6 months, 1/3/5/10 years and all retained history; incomplete windows remain blank.
- Z-scores, flow ranks, market drilldowns, comparisons, source tables, CSV exports and device-local watchlists.
- Indicative dollar notional using dated FX / nearby-futures marks; Treasury face and STIR reference principal are clearly differentiated. Unmapped values remain missing. Optional USD-per-contract overrides are stored only in the browser.
- Nine explicit macro baskets, custom signed baskets and correlations of weekly positioning changes.

## Run

Node 22+ and Python 3 (standard library only for data retrieval):

```sh
npm install
python3 scripts/refresh.py
npm run data:build
npm test
npm run dev
```

Production: `npm run build` then `npm start`. The first build downloads missing seed archives; subsequent builds reuse validated retained archives. Vercel settings are in `vercel.json`.

## Data and updates

The official CFTC public-reporting API supplies all positions. Six compressed raw archives in `data/` retain original numeric fields. `scripts/build-data.mjs` generates static snapshots and individual histories, avoiding an upstream dependency on every page load. `GET /api/snapshot?dataset=...` merges newly reported rows with retained history; `GET /api/history` provides live selected-market history. These routes are read-only public-data operations with one-hour caches and no credentials.

`.github/workflows/refresh.yml` runs Friday and Monday at 22:15 UTC, equivalent to Saturday and Tuesday 06:15 Asia/Singapore. It fetches the latest release, validates accounting, updates raw archives and dated price proxies, and commits changed data. Vercel's Git integration deploys the resulting commit. A workflow run must succeed to establish that unattended refresh is operational; its presence alone is not proof.

Initial historical downloads are revised history, not historical vintages. Git retains the vintages captured prospectively by this project. A backtest must use actual release timing and data available at that time. No performance backtest or washout probability is claimed.

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

## Sources and reuse review

- [CFTC COT reports](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm)
- [CFTC explanatory notes](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ExplanatoryNotes/index.htm)
- [CFTC public reporting guide](https://publicreporting.cftc.gov/stories/s/COT-Help/p2fg-u73y/)
- [CME Micro E-mini specifications](https://www.cmegroup.com/articles/faqs/micro-e-mini-equity-index-futures-frequently-asked-questions.html)

Open-source projects evaluated as references: [cftc-cot-viewer](https://github.com/proprietary/cftc-cot-viewer), [cftc-cot](https://github.com/victorKariuki/cftc-cot), [cot_reports](https://github.com/NDelventhal/cot_reports) and [pycot](https://github.com/philsv/pycot). Application and analytics code here were independently implemented; no repository was copied wholesale.

Price proxies are supplementary Yahoo daily closes, not official settlement values. Source URLs and observation dates are retained. Initial quote provenance is in `data/price-audit.json`. CFTC's current Micro Russell text appears to say $0.5; the vetted mapping uses CME's $5 per index point. Unsupported or uncertain conversions remain null.

## Verification

`npm test` reconciles both sides of OI, checks unique observation keys, all net/gross arithmetic, weekly differences and rank bounds across the retained rows. Additional fixtures cover inverse JPY valuation, cent-denominated grain prices, Treasury principal, future-dated price rejection, insufficient SOFR history, signed theme alignment and flow correlation.

No portfolio holdings, trades, credentials or user financial records are stored. Custom baskets, marks, theme appearance and watchlists are device-local preferences.
