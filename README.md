# Jarn Neow (จารย์เหนียว)

**Will your forex strategy survive?** → **[Open the app](https://0xtrvkc.github.io/Jarn-Neow/)**

Jarn Neow is a free risk-management tool for forex traders. It doesn't look for profits. It asks a different question: *if your numbers are true, how likely is your account to survive, how deep can the falls get, and what position size keeps the risk acceptable?*

Everything runs in your browser from one HTML page plus one script for Expert mode. There is no account, no server and no tracking.

> Jarn Neow is an educational tool, not financial advice. Results come from simulations built on the numbers you provide, and past results do not guarantee future results. Trading leveraged products carries a high risk of loss.

---

## Use it

- **Online:** **[0xtrvkc.github.io/Jarn-Neow](https://0xtrvkc.github.io/Jarn-Neow/)**
- **Offline:** after one visit to the online version, the app keeps working without a connection, including any gold months you already tested. You can also download `index.html` and `expert.js` into the same folder and open the page from disk: everything works except the gold playground, and system fonts replace the app's fonts. With `index.html` alone, Beginner mode works and Expert mode says it can't load.

The interface is in **English and Thai (ไทย)**. Switch with the EN / ไทย buttons at the top.

---

## Two modes

### Beginner

Built for phones and first-time users, with a Thai spirit-night look: Jarn Neow the shaman, ghosts and charms as animated pixel sprites.

- A cheeky opening screen when the site loads ("So you know how to trade? Then why does the margin call keep calling you?"), then a 7-step start-up check on your first visit (it's remembered after that; the footer link runs it again): two quick questions about testing, and a short quiz on common trading illusions (high win rate, "10% a day", lucky streaks, one great month, risk per trade).
- Four inputs: **win rate**, **reward : risk**, **risk per trade** and **number of trades tested**.
- A plain-language verdict ("+13 for every 100 you risk"), an equity fan of possible futures, and a step-by-step plan to fix what's wrong. Until all four numbers are yours, the result is labelled as an example.
- The animations follow your numbers: the shaman cheers, frowns, thinks or sobs with the verdict, a charm or a ghost pops up when the verdict changes, and on wide screens more ghosts gather in the margins the riskier it gets. The decorations keep changing: the 12 charms shuffle on every visit, two charms on screen swap places every 2.5 seconds, and the ghosts are picked at random, while the shaman's moods and the risk signs always mean the same thing. Expert mode has no animations. An **Animations** switch in the header (and in the start-up popup) freezes every sprite and stops the swaps; the choice is remembered. With reduced motion turned on in your device settings, animations start switched off.
- A shareable link that carries your numbers, and a downloadable report (see below).

### Expert

Built for desktop: a dense "quant desk" with detailed statistics, charts, what-if sliders on every chart, and an explanation under every card. Choose a **Full dashboard** or a **Step by step** layout. Phones start in Step by step. The full dashboard has a **Jump to** menu of its sections, and inputs still on example or default values are listed as buttons that take you to each field. Expert opens with a full **"what it can and can't do"** briefing, which you can reopen at any time from the Strategy type panel. A **Full report** bar above the results downloads everything as one Markdown file.

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

Inputs: first order size, distance between orders, how lots grow (a multiplier, or a fixed number of lots added per order), maximum orders, take-profit from the average price, an optional stop after the last order, the pair's average daily range, fixed or balance-scaled lots, and the market model (*random walk* or *fat tails + trends*).

**Finding the daily range.** "How to find this" under the field explains reading ATR(14) from a daily chart in MT4, MT5 or TradingView, with a converter from the ATR price value to pips (most pairs, JPY pairs, gold at $0.10 or $0.01 per pip) and a link to Investing.com's Forex Volatility Calculator. The summary also shows how much the result depends on this guess: the chance of ruin at 1.5× the daily range next to the current one. Gold imported from a Myfxbook file is converted from $0.01 pips to the app's $0.10 pips.

---

## Gold playground (Expert)

Expert mode has two tabs: **Risk calculator** (everything above) and **Gold playground**. The playground tests entry rules built from indicators on real **COMEX gold futures, 1-minute bars, 7 June 2010 to 13 November 2026** (5.7 million bars). The data is historical and doesn't update. The risk calculator no longer uses the gold data.

**Build a rule**
- **Timeframe:** 1 minute, 5 minutes, 15 minutes, 1 hour, 4 hours or 1 day. Candles are built from the 1-minute bars. Daily and 4-hour candles close at 17:00 New York time, like most MT5 gold brokers (server time UTC+2 in winter, UTC+3 in summer).
- **Entry rule builder:** "Buy when all of these are true", with up to 4 conditions. Each condition compares an indicator with another indicator or a number: *crosses above*, *crosses below*, *is above* or *is below*; candlestick patterns use *appears*. The sell rule is either the mirror of the buy rule (crosses above becomes crosses below, RSI 30 becomes 70, the lower band becomes the upper band, +DI and −DI swap, while ADX and ATR levels stay as they are) or its own set of conditions. A plain-language summary under the builder shows exactly what will trade. Ten presets cover the common setups (EMA cross, RSI 30/70, Bollinger reversal and breakout, MACD, Stochastic, Donchian breakout, pullback in a trend, +DI/−DI with ADX, engulfing with the trend), and buy-only, sell-only or both.
- **Indicators (33), plus price (close, open, high, low):** SMA, EMA, WMA, DEMA, TEMA, TRIMA, KAMA, Hull MA, linear regression, Parabolic SAR; Bollinger Bands, Donchian and Keltner channels; RSI, Stochastic, Stochastic RSI, MACD, PPO, CCI, Williams %R, CMO, ROC, Momentum, TRIX, Ultimate oscillator, Balance of power; ADX with +DI and −DI, Aroon, Aroon oscillator; ATR, NATR, standard deviation and regression slope.
- **Candlestick patterns (11):** engulfing, harami, hammer, shooting star, morning star, evening star, three white soldiers, three black crows, piercing line, dark cloud cover and doji.
- **Exit:** stop in pips, as an ATR multiple or none; target in pips, as an ATR multiple, as a multiple of the stop (R) or none; close and reverse on an opposite signal or ignore it; an optional time limit in candles.
- **Money:** starting balance, risk % per trade (rounded down to 0.01 lots) or fixed lots, spread and commission. 1 pip = $0.10, and 1 pip is worth $10 per lot.
- **Indicators** use TA-Lib's formulas, start-up rules and default candle settings. `tools/check_indicators.py` compares every one with TA-Lib on real gold candles; they match to rounding error on 1-minute, 5-minute, 1-hour, 4-hour and daily candles, and the patterns match exactly. Hull MA and Keltner channel aren't TA-Lib functions, so they're built from TA-Lib's WMA, EMA and ATR. Volume indicators aren't offered because the gold files hold prices only. Enough months before the start are loaded for the indicators to settle.

**Walk-forward test against over-fitting**
1. Pick a backtest length (3 to 24 months) and a start month, then tune the settings on the backtest as often as you like.
2. Run the forward test. It uses the same settings on the months straight after the backtest. Its length is limited to between a quarter of the backtest and the full backtest length, so a lucky few weeks can't pass for proof.
3. The verdict compares the average trade (in R when every trade had a stop, otherwise in pips): **held up**, **weakened**, **failed**, **edge too thin to confirm** (backtest profit factor under 1.1), **no edge to confirm** (the backtest lost) or **too few trades**.

The forward months lock once they've been seen. If you change the settings and run the forward test on months you've already seen with other settings, the result is marked **not a fair test**. The record of seen periods stays in your browser.

**Results:** verdict, net result, deepest fall, win rate and profit factor; equity by day with the forward part marked; a backtest-vs-forward table (trades a month, win rate, profit factor, average trade, average win and loss, deepest fall, losing run, time in trade, buys and sells, gold's own move, same-minute and gap fills); monthly results; how trades ended; the latest trades; and a CSV download of every trade.

**How fills work**
- A signal is read when a candle closes, and the trade opens at the next minute's open, so the test never uses a price it couldn't have known.
- Stops and targets are checked on every 1-minute bar, whatever the timeframe. A stop and a target inside the same minute count as the stop. Price opening past the stop fills at that open. Targets fill exactly at the target, never better.
- Spread is charged once per trade, commission per lot. One trade is open at a time. Contract-roll jumps are removed; there's no swap or margin check.
- Only the months needed are downloaded (about 50 KB each), and the test runs in the background. On the live site the month files come from the jsDelivr CDN, pinned to a commit, with this site as the fallback. Each file is checked against its expected bar count.

---

## Myfxbook import (optional, Expert, every strategy type)

1. On Myfxbook, open your account page.
2. Click **Export** at the top right of the chart and choose **CSV**.
3. Drop the file into the **Trade history** panel.

The file is read locally and never uploaded. Jarn Neow converts closed trades into R multiples using your stop distance, fills in the inputs, resamples your real trades, and checks behaviour: losses larger than the stop, lot-size consistency, and hour and weekday patterns. Only Myfxbook CSV files are accepted.

**Strategy detection.** After upload, the app says which type made the history and switches to it, with the evidence in one line and buttons to pick another type:
- **Fixed stop:** most trades carry a stop loss, or trades close one at a time with losses near a typical size.
- **Grid / martingale:** no stops, many trades close together in the same minute (one cycle), and lots grow inside a cycle.
- **No hard stop:** no stops, trades close one at a time, and the worst losses are far bigger than a typical one.

**Grid and no-stop import.** For the chosen symbol the app rebuilds the settings from the cycles and says where each value came from: first order size, how lots grow (multiplied or a fixed amount added), the average spacing across the ladder (single gaps can vary), the most orders seen, take-profit from the average price, commission, value per pip and balance. The daily range isn't in a Myfxbook file and stays as entered. A **Your history vs the simulation** section then puts the real cycles next to the simulated ones (cycles won, average win and loss, worst cycle, deepest floating loss, how often cycles reached deeper orders), with money rescaled to the same first order size. If the account ran grids on several pairs, a warning says how many had cycles open at once and suggests entering one pair's share of the balance, since the page analyses one pair at a time.

---

## Export a report (.md)

Both modes can save the analysis as a Markdown file: **Download report (.md)**, or **Copy as text** to paste it straight into Notion, Obsidian, a notes app, GitHub or an AI chat. The file is built in your browser and nothing is uploaded. It's written in the language the app is set to.

**Expert report** (bar above the results). Every card on the page, converted to text, plus the data behind each chart:
- **Cover and at a glance:** date, strategy type, testing status, verdict, and the headline numbers (expectancy with its confidence interval, chance of ruin, drawdowns, Kelly, suggested risk or safest first-order size).
- **Inputs:** every field with its value and whether you entered it, left the default, or it came from the Myfxbook file.
- **Every section of the page:** verdict, written report, action plan as a checklist, all statistics tables and every explanation ("what this shows", "what your numbers say", "what to do").
- **Chart data as tables**, with text bars: equity percentiles along the way, final-equity and drawdown percentiles, ruin by trade or cycle, ruin by risk level, Kelly growth, streak odds, equity after k losses, spread sensitivity; for grids, the floating loss at multiples of the daily range, how deep cycles go and how cycles ended.
- **Trade history** (if loaded): summary, R distribution, losing runs, model vs real trades, stop discipline, results by weekday and hour, costs. The trade list itself isn't included, only summaries and the few ticket numbers the action plan points to.
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
| Gold playground | Indicator signals (TA-Lib formulas) on candles built from 1-minute gold futures, filled on the 1-minute bars, with a backtest followed by a locked forward test |
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
- **Gold playground limits:** gold futures rather than broker spot, a stop and target in the same minute count as the stop, rolls partly estimated, one trade at a time, no swap or margin, and the data ends on 13 November 2026. One passing forward test is one more sample, not proof.
- **Myfxbook import limits:** closed trades only, the stop is estimated if unknown, strategy detection is a best guess, grid spacing becomes one average, one pair is analysed at a time, and strategies mixed on one account are blended together.
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
index.html                   the app: HTML, CSS and the JavaScript for Beginner mode, the start-up check and the shared engine
expert.js                    Expert mode's risk calculator, loaded the first time Expert opens
lab.js                       the gold playground tab, loaded the first time it opens
lab-worker.js                the playground's background worker: gold data, candles and fills
lab-ind.js                   the playground's indicators, candlestick patterns and rule engine (shared by the page and the worker)
sw.js                        service worker: offline use and instant return visits
fonts/                       the app's fonts (SIL Open Font License; licences included)
sprites/                     animated pixel sprites for Beginner mode (16 frames each, 90 ms per frame)
icon.svg, icon-180.png       site icons
og.png                       link-preview image (1200 × 630)
data/gold/index.json         available months, bar counts and the contract-roll table
data/gold/YYYY-MM.bin        1-minute gold bars, one compressed file per month
tools/build_gold_data.py     rebuilds data/gold from a 1-minute OHLC parquet file
tools/check_indicators.py    checks every playground indicator against TA-Lib
README.md                    this file
LICENSE                      MIT licence for the code
data/gold/README.md          where the gold data comes from and its terms
```

The app itself has no build step and no dependencies. Edit `index.html` or `expert.js` and refresh. After changing `expert.js`, update `EXPERT_V` in `index.html` (any new value, for example the first 8 characters of the file's SHA-1) so browsers fetch the new copy. After changing `lab.js`, `lab-ind.js` or `lab-worker.js`, update `LAB_V` the same way.

To rebuild or extend the gold data (needs Python with `pyarrow` and `numpy`):

```
python3 tools/build_gold_data.py GC_v_0_ohlcv-1m.parquet data/gold
git add data/gold && git commit -m "Update gold data" && git push
python3 tools/build_gold_data.py GC_v_0_ohlcv-1m.parquet data/gold $(git rev-parse HEAD)
git add data/gold/index.json && git commit -m "Pin gold data on jsDelivr" && git push
```

The second build writes that commit's ID into `index.json`, and the live site then loads the month files from jsDelivr at that commit, which never changes, so they're cached permanently. A tag pointing at the data commit works too. Without a ref, the site serves the files itself.

Prices are stored unadjusted in $0.10 ticks. Each month is a gzip-compressed file of variable-length integers (time step, open, high, low, close). The format is documented at the top of the script.
