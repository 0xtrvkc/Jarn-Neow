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
- **Myfxbook import limits:** closed trades only, the stop is estimated if unknown, it can't tell a grid history from a fixed-stop one, and strategies mixed on one account are blended together.
- **Not:** a profit predictor, a trading signal, a test of your discipline under pressure, or financial advice.

---

## Privacy

- No accounts, cookies, analytics or server.
- Your inputs and files stay in your browser.
- Only your language, layout and explanation settings are saved, in your browser's local storage.
- The only outside request is to Google Fonts for the typefaces.

---

## Project structure

```
index.html   the whole app: HTML, CSS and JavaScript in one file
README.md    this file
```

There is no build step and there are no dependencies. Edit `index.html` and refresh.
