# Jarn Neow (จารย์เหนียว)

**Will your forex strategy survive?**

Jarn Neow is a free risk-management tool for forex traders. It doesn't look for profits. It asks a different question: *if your numbers are true, how likely is your account to survive, how deep can the falls get, and what position size keeps the risk acceptable?*

Everything runs in your browser from a single HTML file. There is no account, no server and no tracking.

> Jarn Neow is an educational tool, not financial advice. Results come from simulations built on the numbers you provide, and past results do not guarantee future results. Trading leveraged products carries a high risk of loss.

---

## Use it

- **Online:** turn on GitHub Pages for this repository (Settings → Pages → deploy from the `main` branch, root folder), then open the published link.
- **Offline:** download `index.html` and open it in any modern browser. It works with no internet connection; only the fonts need one, and system fonts are used otherwise.

The interface is in **English and Thai (ไทย)**. Switch with the EN / ไทย buttons at the top.

---

## Two modes

### Beginner

Built for phones and first-time users.

- A 7-step start-up check on every visit: two quick questions about testing, and a short quiz on common trading illusions (high win rate, "10% a day", lucky streaks, one great month, risk per trade).
- Four inputs: **win rate**, **reward : risk**, **risk per trade** and **number of trades tested**.
- A plain-language verdict, an equity fan of possible futures, and a step-by-step plan to fix what's wrong.
- A shareable link that carries your numbers.

### Expert

Built for desktop: a dense "quant desk" with detailed statistics, charts, what-if sliders on every chart, and an explanation under every card. Choose a **Full dashboard** or a **Step by step** layout. Expert opens with a full **"what it can and can't do"** briefing, which you can reopen at any time from the Strategy type panel.

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
- Only the months in your range are downloaded (about 50 KB per month), and the backtest runs in the background, so the page stays responsive. A full 16-year run takes about 1–2 seconds.

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

## How it works

| Piece | Method |
|---|---|
| Win-rate uncertainty | Wilson score interval, 95% |
| Edge | Expectancy in R, net of spread and commission |
| Survival | Monte Carlo: 10,000 simulated paths, with compounding or fixed risk and an optional de-risk rule after a losing streak |
| Sizing | Kelly criterion and log-growth curve, plus a ruin-probability sweep across risk levels |
| Streaks | Exact probability of a run of *k* losses in *N* trades |
| History | Bootstrap of your own R multiples |
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

- No accounts, cookies, analytics or server.
- Your inputs and files stay in your browser.
- Only your language, layout and explanation settings are saved, in your browser's local storage.
- The gold backtest downloads data files from the same site; nothing is sent anywhere.
- The only outside request is to Google Fonts for the typefaces.

---

## Project structure

```
index.html                   the whole app: HTML, CSS and JavaScript in one file
data/gold/index.json         available months, bar counts and the contract-roll table
data/gold/YYYY-MM.bin        1-minute gold bars, one compressed file per month
tools/build_gold_data.py     rebuilds data/gold from a 1-minute OHLC parquet file
README.md                    this file
```

The app itself has no build step and no dependencies. Edit `index.html` and refresh.

To rebuild or extend the gold data (needs Python with `pyarrow` and `numpy`):

```
python3 tools/build_gold_data.py GC_v_0_ohlcv-1m.parquet data/gold
```

Prices are stored unadjusted in $0.10 ticks. Each month is a gzip-compressed file of variable-length integers (time step, open, high, low, close). The format is documented at the top of the script.
