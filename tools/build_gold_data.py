"""Convert a continuous gold-futures 1-minute OHLC parquet file into compact monthly files for Jarn Neow.

Usage:  python3 tools/build_gold_data.py GC_v_0_ohlcv-1m.parquet data/gold [cdn-tag]

cdn-ref (optional): a git tag or full commit ID that holds exactly these month files.
The live site then loads the month files from jsDelivr at that ref and falls back to its own copy.
Usual flow: build without a ref, commit and push the data, then build again with that commit's ID
(git rev-parse HEAD) or a tag pointing at it, and commit index.json. Without a ref the site serves the files itself.

Output
  data/gold/index.json      months, bar counts, date range and contract-roll table
  data/gold/YYYY-MM.bin     one gzip-compressed file per calendar month (UTC)

Prices are stored as real (unadjusted) prices in ticks of $0.10.
Contract rolls are listed separately; the app removes the roll jumps for the range a user selects.

Bar encoding (inside gzip), all integers as LEB128 varints, signed ones zig-zag encoded:
  header: n, t0 (minutes since 1970-01-01 UTC), p0 (first open, ticks)
  per bar: dt (minutes since previous bar, 0 for the first), open - previous close (signed),
           high - max(open, close), min(open, close) - low, close - open (signed)
"""
import gzip, json, sys, os
import numpy as np
import pyarrow.parquet as pq


def varints(vals):
    out = bytearray()
    for v in vals:
        v = int(v)
        while True:
            b = v & 0x7F
            v >>= 7
            if v:
                out.append(b | 0x80)
            else:
                out.append(b)
                break
    return out


def zz(a):
    a = np.asarray(a, dtype=np.int64)
    return (a << 1) ^ (a >> 63)


def main(src, dst, cdn_ref=None):
    t = pq.read_table(src, columns=['ts_event', 'open', 'high', 'low', 'close', 'instrument_id']).to_pandas()
    t = t.sort_values('ts_event').drop_duplicates('ts_event')
    ts = t.ts_event.values.astype('datetime64[m]').astype(np.int64)
    o, h, l, c = (np.rint(t[k].values * 10).astype(np.int64) for k in ('open', 'high', 'low', 'close'))
    ins = t.instrument_id.values
    assert (h >= np.maximum(o, c)).all() and (l <= np.minimum(o, c)).all()

    # contract rolls: jump between last close of the old contract and first open of the new one.
    # When the two bars are more than an hour apart (weekends), the gap includes a real market move,
    # so the jump is estimated from the median relative jump of the neighbouring rolls instead.
    ch = np.nonzero(ins[1:] != ins[:-1])[0] + 1
    gap = ts[ch] - ts[ch - 1]
    rel = (o[ch] - c[ch - 1]) / c[ch - 1]
    rolls = []
    for k, i in enumerate(ch):
        if gap[k] <= 60:
            d = int(o[i] - c[i - 1])
            how = 'observed'
        else:
            near = [rel[j] for j in range(max(0, k - 4), min(len(ch), k + 5)) if j != k and gap[j] <= 60]
            d = int(round(float(np.median(near)) * c[i - 1]))
            how = 'estimated'
        rolls.append({'t': int(ts[i]), 'd': d, 'how': how})

    os.makedirs(dst, exist_ok=True)
    months = (ts.astype('datetime64[m]').astype('datetime64[M]'))
    keys = np.unique(months)
    index = []
    total = 0
    for m in keys:
        sel = np.nonzero(months == m)[0]
        a, b = sel[0], sel[-1] + 1
        tt, oo, hh, ll, cc = ts[a:b], o[a:b], h[a:b], l[a:b], c[a:b]
        n = len(tt)
        dt = np.diff(tt, prepend=tt[0])
        prevc = np.concatenate([[oo[0]], cc[:-1]])
        cols = np.stack([dt, zz(oo - prevc), hh - np.maximum(oo, cc), np.minimum(oo, cc) - ll, zz(cc - oo)], axis=1).ravel()
        raw = varints([n, tt[0], int(zz([oo[0]])[0])]) + varints(cols)
        name = str(m)  # YYYY-MM
        data = gzip.compress(bytes(raw), 9, mtime=0)
        with open(os.path.join(dst, name + '.bin'), 'wb') as f:
            f.write(data)
        total += len(data)
        index.append({'m': name, 'n': int(n), 'from': int(tt[0]), 'to': int(tt[-1]), 'bytes': len(data)})

    meta = {
        'symbol': 'GC (COMEX gold futures, continuous front contract)',
        'tick': 0.1,
        **({'cdnRef': cdn_ref} if cdn_ref else {}),
        'bars': int(len(ts)),
        'from': int(ts[0]),
        'to': int(ts[-1]),
        'months': index,
        'rolls': rolls,
    }
    with open(os.path.join(dst, 'index.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    print(f'{len(ts):,} bars, {len(index)} months, {len(rolls)} rolls '
          f'({sum(r["how"] == "estimated" for r in rolls)} estimated), {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
