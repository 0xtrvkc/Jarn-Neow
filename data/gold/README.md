# Gold data

1-minute OHLC bars of COMEX gold futures (GC, continuous front contract), 7 June 2010 to 13 November 2026: 5,701,465 bars in 198 monthly files, plus `index.json` (months, bar counts and the contract-roll table).

## Source

The bars were bought from a commercial market-data vendor by a trader and shared for free, for educational use in this project. The underlying market data comes from CME Group, which holds the rights to it.

The MIT licence in the repository root covers the app's code. It does not cover this data: rights to the data follow the original vendor's and CME Group's terms. If you hold rights in this data and object to it being here, please open an issue and it will be removed.

## Format

Each `YYYY-MM.bin` file is gzip-compressed LEB128 varints, prices in $0.10 ticks: bar count, first timestamp, first price, then per bar the time step, the open as a zigzag delta from the previous close, the distances from the bar's body up to the high and down to the low, and the close as a zigzag delta from the open. Prices are stored unadjusted; contract rolls are removed when a backtest runs. `tools/build_gold_data.py` documents the format in full and rebuilds the files from a parquet export.
