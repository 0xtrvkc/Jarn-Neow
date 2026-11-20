"""Check the playground's indicators (lab-ind.js) against TA-Lib on real gold candles.

Usage:  python3 tools/check_indicators.py [months] [timeframe minutes]
        python3 tools/check_indicators.py 2024-01,2024-02,2024-03 60

Needs Node.js and the TA-Lib Python package (pip install TA-Lib). Exits with status 1 if anything differs.
Moving averages and oscillators must match to a relative error of 1e-9; candlestick patterns must match exactly.
"""
import json, os, subprocess, sys
import numpy as np
import talib as T

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
months = sys.argv[1] if len(sys.argv) > 1 else '2024-01,2024-02,2024-03'
tf = sys.argv[2] if len(sys.argv) > 2 else '60'

NODE = r'''
const fs=require('fs'),zlib=require('zlib'),path=require('path'),root=process.argv[1];
const W=require(path.join(root,'lab-worker.js')),I=require(path.join(root,'lab-ind.js'));
const idx=JSON.parse(fs.readFileSync(path.join(root,'data/gold/index.json')));
const parts=process.argv[2].split(',').map(m=>{let b=fs.readFileSync(path.join(root,'data/gold',m+'.bin'));if(b[0]===0x1f)b=zlib.gunzipSync(b);return W.decode(new Uint8Array(b));});
const F=W.aggregate(W.join(parts,idx.rolls),+process.argv[3]),{o,h,l,c}=F,A=x=>Array.from(x,v=>v===v?v:null);
const out={o:A(o),h:A(h),l:A(l),c:A(c),
 SMA:I.SMA(c,20),EMA:I.EMA(c,50),WMA:I.WMA(c,30),DEMA:I.DEMA(c,30),TEMA:I.TEMA(c,30),TRIMA_even:I.TRIMA(c,30),TRIMA_odd:I.TRIMA(c,31),KAMA:I.KAMA(c,30),
 LINEARREG:I.LINREG(c,14),LINEARREG_SLOPE:I.LINREG(c,14,'slope'),SAR:I.SAR(h,l,0.02,0.2),HMA:I.HMA(c,20),
 BB_upper:I.BB(c,20,2).up,BB_lower:I.BB(c,20,2).lo,STDDEV:I.STDDEV(c,20,1),
 RSI:I.RSI(c,14),CMO:I.CMO(c,14),ATR:I.ATR(h,l,c,14),NATR:I.NATR(h,l,c,14),
 MACD:I.MACD(c,12,26,9).macd,MACD_signal:I.MACD(c,12,26,9).sig,MACD_hist:I.MACD(c,12,26,9).hist,PPO:I.PPO(c,12,26),
 STOCH_k:I.STOCH(h,l,c,14,3,3).k,STOCH_d:I.STOCH(h,l,c,14,3,3).d,STOCHRSI_k:I.STOCHRSI(c,14,14,3).k,STOCHRSI_d:I.STOCHRSI(c,14,14,3).d,
 CCI:I.CCI(h,l,c,20),WILLR:I.WILLR(h,l,c,14),ROC:I.ROC(c,10),MOM:I.MOM(c,10),BOP:I.BOP(o,h,l,c),TRIX:I.TRIX(c,15),
 ADX:I.DMI(h,l,c,14).adx,PLUS_DI:I.DMI(h,l,c,14).pdi,MINUS_DI:I.DMI(h,l,c,14).mdi,AROON_up:I.AROON(h,l,25).up,AROON_down:I.AROON(h,l,25).dn,AROONOSC:I.AROON(h,l,25).osc,
 ULTOSC:I.ULTOSC(h,l,c,7,14,28),DONCHIAN_upper:I.PREV(h,20,true),DONCHIAN_lower:I.PREV(l,20,false)};
for(const k in out)if(!['o','h','l','c'].includes(k))out[k]=A(out[k]);
for(const k in I.CDL)out['CDL_'+k]=Array.from(I.CDL[k](F));
process.stdout.write(JSON.stringify(out));
'''
d = json.loads(subprocess.run(['node', '-e', NODE, ROOT, months, tf], capture_output=True, text=True, check=True).stdout)
f = lambda k: np.array([np.nan if v is None else v for v in d[k]], dtype=float)
o, h, l, c = f('o'), f('h'), f('l'), f('c')
shift = lambda x: np.concatenate([[np.nan], x[:-1]])
macd, macds, macdh = T.MACD(c, 12, 26, 9)
sk, sd = T.STOCH(h, l, c, 14, 3, 0, 3, 0)
rk, rd = T.STOCHRSI(c, 14, 14, 3, 0)
adn, aup = T.AROON(h, l, 25)
bbu, _, bbl = T.BBANDS(c, 20, 2, 2, 0)
ref = dict(SMA=T.SMA(c, 20), EMA=T.EMA(c, 50), WMA=T.WMA(c, 30), DEMA=T.DEMA(c, 30), TEMA=T.TEMA(c, 30), TRIMA_even=T.TRIMA(c, 30), TRIMA_odd=T.TRIMA(c, 31),
           KAMA=T.KAMA(c, 30), LINEARREG=T.LINEARREG(c, 14), LINEARREG_SLOPE=T.LINEARREG_SLOPE(c, 14), SAR=T.SAR(h, l, 0.02, 0.2),
           HMA=T.WMA(2 * T.WMA(c, 10) - T.WMA(c, 20), 4), BB_upper=bbu, BB_lower=bbl, STDDEV=T.STDDEV(c, 20, 1),
           RSI=T.RSI(c, 14), CMO=T.CMO(c, 14), ATR=T.ATR(h, l, c, 14), NATR=T.NATR(h, l, c, 14),
           MACD=macd, MACD_signal=macds, MACD_hist=macdh, PPO=T.PPO(c, 12, 26, 1), STOCH_k=sk, STOCH_d=sd, STOCHRSI_k=rk, STOCHRSI_d=rd,
           CCI=T.CCI(h, l, c, 20), WILLR=T.WILLR(h, l, c, 14), ROC=T.ROC(c, 10), MOM=T.MOM(c, 10), BOP=T.BOP(o, h, l, c), TRIX=T.TRIX(c, 15),
           ADX=T.ADX(h, l, c, 14), PLUS_DI=T.PLUS_DI(h, l, c, 14), MINUS_DI=T.MINUS_DI(h, l, c, 14), AROON_up=aup, AROON_down=adn, AROONOSC=T.AROONOSC(h, l, 25),
           ULTOSC=T.ULTOSC(h, l, c, 7, 14, 28), DONCHIAN_upper=shift(T.MAX(h, 20)), DONCHIAN_lower=shift(T.MIN(l, 20)))
pat = dict(engulfing=T.CDLENGULFING, hammer=T.CDLHAMMER, shootingstar=T.CDLSHOOTINGSTAR, doji=T.CDLDOJI,
           morningstar=lambda *a: T.CDLMORNINGSTAR(*a, penetration=0.3), eveningstar=lambda *a: T.CDLEVENINGSTAR(*a, penetration=0.3),
           soldiers=T.CDL3WHITESOLDIERS, crows=T.CDL3BLACKCROWS, harami=T.CDLHARAMI, piercing=T.CDLPIERCING,
           darkcloud=lambda *a: T.CDLDARKCLOUDCOVER(*a, penetration=0.5))
bad = 0
print(f'{len(c)} candles, {months}, {tf}-minute')
for k, r in ref.items():
    j = f(k); nr, nj = np.isnan(r), np.isnan(j)
    err = np.where(nr | nj, 0, np.abs(r - j) / np.maximum(1, np.abs(r))).max()
    ok = (nr == nj).all() and err < 1e-9; bad += not ok
    print(f'  {"ok " if ok else "BAD"} {k:16s} first value at {np.argmax(~nr)}, max relative error {err:.1e}')
for k, fn in pat.items():
    r = fn(o, h, l, c).astype(float); j = f('CDL_' + k); n = int((r != j).sum()); bad += n > 0
    print(f'  {"ok " if not n else "BAD"} CDL {k:12s} {int(np.count_nonzero(r))} found, {n} differ')
print('All match TA-Lib.' if not bad else f'{bad} differ from TA-Lib.')
sys.exit(1 if bad else 0)
