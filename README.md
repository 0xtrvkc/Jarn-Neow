# Jarn Neow (จารย์เหนียว)

**Will your forex strategy survive?** → **[Open the app](https://0xtrvkc.github.io/Jarn-Neow/)**

Jarn Neow is a free risk-management tool for forex traders. It doesn't look for profits. It asks a different question: *if your numbers are true, how likely is your account to survive, how deep can the falls get, and what position size keeps the risk acceptable?*

Everything runs in your browser from a single HTML file. There is no account, no server and no tracking.

> Jarn Neow is an educational tool, not financial advice. Results come from simulations built on the numbers you provide, and past results do not guarantee future results. Trading leveraged products carries a high risk of loss.

---

## Use it

- **Online:** **[0xtrvkc.github.io/Jarn-Neow](https://0xtrvkc.github.io/Jarn-Neow/)**
- **Offline:** after one visit to the online version, the app keeps working without a connection, including any gold months you already backtested. You can also download `index.html` and open it from disk: everything works except the gold backtest, and system fonts replace the app's fonts.

The interface is in **English and Thai (ไทย)**. Switch with the EN / ไทย buttons at the top.

---

## Two modes

### Beginner

Built for phones and first-time users.

- A 7-step start-up check on every visit: two quick questions about testing, and a short quiz on common trading illusions (high win rate, "10% a day", lucky streaks, one great month, risk per trade).
- Four inputs: **win rate**, **reward : risk**, **risk per trade** and **number of trades tested**.
- A plain-language verdict, an equity fan of possible futures, and a step-by-step plan to fix what's wrong.
- A shareable link that carries your numbers, and a downloadable report (see below).

### Expert

Built for desktop: a dense "quant desk" with detailed statistics, charts, what-if sliders on every chart, and an explanation under every card. Choose a **Full dashboard** or a **Step by step** layout. Expert opens with a full **"what it can and can't do"** briefing, which you can reopen at any time from the Strategy type panel. A **Full report** bar above the results downloads everything as one Markdown file.

---

## Strategy types (Expert)

Pick the type that matches how you really trade. An EA isn't a type by itself; what matters is how it trades.

| Type | For | What it shows |
|---|---|---|
| **Fixed stop** | One trade at a time, a stop loss on every trade, about the same % risk each time | Expectancy with a 95% confidence interval, chance of ruin, drawdown ranges, losing-streak odds, Kelly-based sizing, cost impact, lot size |
| **Grid / martingale** | Adding orders as price moves against you (same or bigger size) and closing them together at a target | How often cycles win, the size of the rare big loss, the adverse move that wipes out the account, chance of ruin and wipe-out, and the safest first-order size |
| **No hard stop** | One position held without a stop until price comes back | How far price can go against you before the account is gone, and how often that happens at your size |

### Fixed stop: what's inside

- **Summary:** verdict, written report, an action plan, model statistics and a 10,000-path Monte Carlo equity fan.
- **Edge and confidence:** expectancy across win rates, the break-even frontier, and ruin risk if your true win rate is at the low or high end of its 95% confidence interval.
- **Survival:** final-equity and max-drawdown distributions, and cumulative ruin probability by trade.
- **Position sizing:** ruin probability against risk per trade, the Kelly growth curve, sizing scenarios (⅛, ¼, ½ and full Kelly) and a lot-size calculator.
- **Streaks and recovery:** losing-streak probabilities, equity after consecutive losses, and the gain needed to recover from a drawdown.
- **Costs and lot size:** spread and commission per trade, and the break-even spread.
- **Trade history (Myfxbook):** optional; see below.

### Grid / martingale and no hard stop: what's inside

- **Summary:** verdict, cycle win rate, average win against the rare average loss, and an equity fan over cycles.
- **Exposure:** an order-by-order ladder (lots, average entry, floating loss, bounce needed to reach take-profit) and a floating-loss chart showing the ruin and wipe-out points.
- **Cycle outcomes:** how often each order gets filled, how deep floating losses go, and where the money goes per 1,000 cycles.
- **Survival and sizing:** cumulative ruin and wipe-out by cycle, and ruin probability against first-order size.

Inputs: first order size, distance between orders, lot multiplier, maximum orders, take-profit from the average price, an optional stop after the last order, the pair's average daily range, fixed or balance-scaled lots, and the market model (*random walk* or *fat tails + trends*).

---

## Backtest on real gold (Expert)

Every Expert strategy type ends with a **Backtest on real gold** section. It replays your exact inputs on real **COMEX gold futures, 1-minute bars, 7 June 2010 to 13 November 2026** (5.7 million bars) for any range of months you pick. The data is historical and doesn't update.

- **1 pip = $0.10**, so a $1 move in gold is 10 pips.
- **Grid / martingale and no hard stop** use every grid setting, balance, spread, commission and value per pip, plus a direction (buy, sell or alternate each cycle). You get:
  - equity day by day, including the lowest point each day with open losses;
  - the date the account fell to the ruin line or was wiped out;
  - the 5 deepest cycles, how many orders each cycle reached, and results by year.
- **Fixed stop** uses your SL, reward:risk, risk rules, trades per day and costs with **random entries**. It measures the win rate your stop and target produce on real gold with no skill, and compares it with the win rate you claim. You also get one chronological run and results by year.
- **Deeper analysis**, only what real prices can show, so none of it repeats the simulation sections above:
  - **Start-date luck:** the same rules rerun from up to 36 different start months, each for the same length. It shows how many starts survived, how many were wiped out, and the best and worst start.
  - **Simulation vs real gold:** what the simulation predicted next to what gold actually did, plus a one-click button to use gold's real daily range in the simulation.
  - **Gold volatility by year:** the average daily range per year against your grid spacing, stop or take-profit.
  - **Trend vs range months:** each month classed as ranging, mixed, trending up or trending down, with your results in each.
  - **When trouble starts (grid / no stop):** the hour and weekday when the deepest floating losses happened (in your time zone), and what weekend gaps did to open positions.
  - **Win rate by time of day (fixed stop):** random-entry win rate by entry hour, plus weekend gaps.
  - **Real losing streaks (fixed stop):** real streaks against what independent trades would produce, which checks whether losses cluster.
- The available date range is shown as a timeline, with your selected months highlighted.
- Only the months in your range are downloaded (about 50 KB per month), and the backtest runs in the background, so the page stays responsive. A full 16-year run takes about 2–4 seconds.
- On the live site the month files come from the jsDelivr CDN, pinned to a commit, with this site as the automatic fallback. Each file is checked against its expected bar count; a damaged or missing month stops the run with a clear message instead of being skipped.

**How the replay works:**
- Contract-roll jumps between futures months are removed.
- Inside each minute, price is assumed to go open → low → high → close when the minute closed up, and open → high → low → close when it closed down.
- Orders fill exactly at their level, or at the gap price when price jumps past it.
- It doesn't include swap, slippage beyond gaps, lot rounding or margin checks.

The backtest needs the site to be served (GitHub Pages or any web server). Browsers block the data files when `index.html` is opened straight from disk.

---

## Myfxbook import (optional, Expert, fixed-stop type)

1. On Myfxbook, open your account page.
2. Click **Export** at the top right of the chart and choose **CSV**.
3. Drop the file into the **Trade history** panel.

The file is read locally and never uploaded. Jarn Neow converts closed trades into R multiples using your stop distance, fills in the inputs, resamples your real trades, and checks behaviour: losses larger than the stop, lot-size consistency, and hour and weekday patterns. Only Myfxbook CSV files are accepted.

---

## Export a report (.md)

Both modes can save the analysis as a Markdown file: **Download report (.md)**, or **Copy as text** to paste it straight into Notion, Obsidian, a notes app, GitHub or an AI chat. The file is built in your browser and nothing is uploaded. It's written in the language the app is set to.

**Expert report** (bar above the results). Every card on the page, converted to text, plus the data behind each chart:
- **Cover and at a glance:** date, strategy type, testing status, verdict, and the headline numbers (expectancy with its confidence interval, chance of ruin, drawdowns, Kelly, suggested risk or safest first-order size, backtest outcome).
- **Inputs:** every field with its value and whether you entered it, left the default, or it came from the Myfxbook file.
- **Every section of the page:** verdict, written report, action plan as a checklist, all statistics tables and every explanation ("what this shows", "what your numbers say", "what to do").
- **Chart data as tables**, with text bars: equity percentiles along the way, final-equity and drawdown percentiles, ruin by trade or cycle, ruin by risk level, Kelly growth, streak odds, equity after k losses, spread sensitivity; for grids, the floating loss at multiples of the daily range, how deep cycles go and how cycles ended.
- **Trade history** (if loaded): summary, R distribution, losing runs, model vs real trades, stop discipline, results by weekday and hour, costs. The trade list itself isn't included, only summaries and the few ticket numbers the action plan points to.
- **Gold backtest** (if run for the current inputs): every card, plus a monthly returns table (year × month), every start month from the start-date luck test, volatility by year against your distances, and hour-by-hour tables.
- **Trading rules to commit to**, a signed checklist derived from the numbers; **method and reproducibility** (models, path counts, seeds, formulas); the full **limitations** list; a **glossary**; and the disclaimer.

**Beginner report** (under the inputs). In plain words: the verdict, your four numbers and what they mean, a money example on a 10,000 account, why the result looks the way it does, the fix plan as a checklist, the spread of 200-trade futures, the same strategy at different risk levels, losing-streak odds, how sure you can be at more trades, Kelly sizing, recovery maths, a rules checklist, what Beginner leaves out, a glossary and a link that reopens your numbers.

---

## How it works

| Piece | Method |
|---|---|
| Win-rate uncertainty | Wilson score interval, 95% |
| Edge | Expectancy in R, net of spread and commission |
| Survival | Monte Carlo: 10,000 simulated paths, with compounding or fixed risk and an optional de-risk rule after a losing streak |
| Sizing | Kelly criterion and log-growth curve, plus a ruin-probability sweep across risk levels |
| Streaks | Exact probability of a run of *k* losses in *N* trades |
| History | Bootstrap of your own R multiples (above 10,000 trades, its normal approximation, which gives the same result much faster) |
| Gold backtest | Minute-by-minute replay of your rules on real 1-minute gold futures, with contract rolls removed |
| Grid / no stop | 4,000 simulated cycles on 30-minute price steps scaled from the daily range (Gaussian random walk, or Student-t(3) jumps with volatility clustering and short trends), then account paths built by resampling whole cycles |

All simulations use a fixed random seed, so the same inputs always give the same results.

---

## What it can't do

The in-app briefing has the full list. In short:

- **Strategies not modelled:** trailing stops and partial take-profits (only approximated), several positions open at once (baskets, hedging, correlated pairs, pyramiding), size that changes with results, two-way or multi-pair grids, speed-sensitive strategies (HFT, arbitrage), and options, futures rollovers or crypto funding.
- **Costs left out:** swap and overnight financing, slippage and gaps in the fixed-stop type, margin and broker stop-out levels, deposits, withdrawals, taxes and fees.
- **Statistical limits:**
  - It assumes your numbers stay true, and that fixed-stop trades are independent.
  - Small samples are very uncertain.
  - It can't detect a flawed backtest.
  - The grid price model isn't fitted to real history and has no edge in either direction.
  - Rare events may not appear in the simulation.
- **Gold backtest limits:** gold futures rather than broker spot, order inside each minute assumed, rolls partly estimated, no swap or margin, fixed-stop entries are random rather than yours, and the data ends on 13 November 2026.
- **Myfxbook import limits:** closed trades only, the stop is estimated if unknown, it can't tell a grid history from a fixed-stop one, and strategies mixed on one account are blended together.
- **Not:** a profit predictor, a trading signal, a test of your discipline under pressure, or financial advice.

---

## Privacy

- No accounts, cookies or server.
- Your inputs and files stay in your browser.
- Only your language, layout and explanation settings are saved, in your browser's local storage.
- Fonts are served from this site, so no visitor data goes to a font service.
- Gold data comes from this site or from the jsDelivr CDN (a copy of this repository's files); nothing is sent anywhere.
- A service worker keeps copies of the page, fonts and downloaded gold months in your browser, so the app loads instantly and works offline. Clearing site data removes them.
- Reports are generated in the browser and saved straight to your device. They hold summaries of a Myfxbook file, not the trade list (the action plan may name a few ticket numbers).
- **Optional visit counter:** a cookie-free [GoatCounter](https://www.goatcounter.com) pixel, off by default. It is switched on by putting a GoatCounter site code in `COUNTER` near the end of `index.html`. When on, it sends only the page path, and it respects the browser's Do Not Track setting.

---

## Licence

The code is released under the [MIT License](LICENSE). The gold data in `data/gold/` is not covered by it; see [data/gold/README.md](data/gold/README.md) for its source and terms.

---

## Project structure

```
index.html                   the whole app: HTML, CSS and JavaScript in one file
sw.js                        service worker: offline use and instant return visits
fonts/                       the app's fonts (SIL Open Font License; licences included)
icon.svg, icon-180.png       site icons
og.png                       link-preview image (1200 × 630)
data/gold/index.json         available months, bar counts and the contract-roll table
data/gold/YYYY-MM.bin        1-minute gold bars, one compressed file per month
tools/build_gold_data.py     rebuilds data/gold from a 1-minute OHLC parquet file
README.md                    this file
LICENSE                      MIT licence for the code
data/gold/README.md          where the gold data comes from and its terms
```

The app itself has no build step and no dependencies. Edit `index.html` and refresh.

To rebuild or extend the gold data (needs Python with `pyarrow` and `numpy`):

```
python3 tools/build_gold_data.py GC_v_0_ohlcv-1m.parquet data/gold
git add data/gold && git commit -m "Update gold data" && git push
python3 tools/build_gold_data.py GC_v_0_ohlcv-1m.parquet data/gold $(git rev-parse HEAD)
git add data/gold/index.json && git commit -m "Pin gold data on jsDelivr" && git push
```

The second build writes that commit's ID into `index.json`, and the live site then loads the month files from jsDelivr at that commit, which never changes, so they're cached permanently. A tag pointing at the data commit works too. Without a ref, the site serves the files itself.

Prices are stored unadjusted in $0.10 ticks. Each month is a gzip-compressed file of variable-length integers (time step, open, high, low, close). The format is documented at the top of the script.
