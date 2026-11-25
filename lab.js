/* Jarn Neow, Gold playground (an Expert tab): build an entry rule from indicators, backtest it on real 1-minute gold,
   then run it once, unchanged, on the months right after (walk-forward). Loaded the first time the tab opens.
   The heavy work runs in lab-worker.js. After editing either file, change LAB_V in index.html. */
const LAB=(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=CH.esc;

/* ---------- text ---------- */
Object.assign(I18N.en,{
lab_lead:"Build an entry rule from indicators and test it on real 1-minute gold prices. Then run it once, unchanged, on the months straight after: if it still makes money on months you didn't tune it on, the edge may be real.",
lab_s1:"Pick a backtest period and tune the settings on it as much as you like.",
lab_s2:"Run the forward test once. It uses the same settings on the months right after the backtest.",
lab_s3:"Compare the two. A rule fitted to the past usually falls apart in the forward months.",
lp_chart:"Chart",lp_entry:"Entry signal",lp_exit:"Exit",lp_money:"Money and costs",
l_tf:"Timeframe",tf_1:"1 minute",tf_5:"5 minutes",tf_15:"15 minutes",tf_60:"1 hour",tf_240:"4 hours",tf_1440:"1 day",
l_dir:"Trade direction",dir_both:"Buy and sell",dir_long:"Buy only",dir_short:"Sell only",
l_preset:"Start from a preset",pre_pick:"Choose a preset…",pre_ma:"EMA 20 / 50 cross",pre_rsi:"RSI leaves 30 / 70",pre_bbrev:"Bollinger Bands reversal",pre_bbbrk:"Bollinger Bands breakout",pre_macd:"MACD crosses its signal line",
pre_stoch:"Stochastic cross from oversold",pre_don:"20-candle breakout (Donchian)",pre_pull:"Pullback in an uptrend (EMA 20 above EMA 200)",pre_adx:"+DI / −DI cross with ADX above 25",pre_engulf:"Engulfing candle with the EMA 200 trend",
r_buy:"Buy when all of these are true",r_sell:"Sell when all of these are true",r_add:"Add a condition",r_del:"Remove this condition",r_mode:"Sell rule",r_mirror:"Mirror of the buy rule",r_own:"Its own conditions",
r_num:"a number",r_value:"Value",r_out:"Line",r_none:"No conditions yet: this side never trades.",r_max:"Up to 4 conditions on each side.",
r_sum_buy:"Buys when {x}.",r_sum_sell:"Sells when {x}.",r_and:" and ",r_hint:"Signals are read when a candle closes. The mirrored sell rule flips each condition: crosses above becomes crosses below, RSI 30 becomes 70, lower band becomes upper band.",
op_xa:"crosses above",op_xb:"crosses below",op_gt:"is above",op_lt:"is below",op_bull:"appears (bullish)",op_bear:"appears (bearish)",op_any:"appears",
g_price:"Price",g_avg:"Moving averages",g_band:"Bands and channels",g_osc:"Oscillators",g_trend:"Trend strength",g_vol:"Volatility",g_pat:"Candlestick patterns",
d_bull:"a bullish {x} candle appears",d_bear:"a bearish {x} candle appears",d_any:"a {x} candle appears",
l_stop:"Stop loss",stop_pips:"Fixed pips",stop_atr:"ATR multiple",stop_none:"None",l_stopv_p:"Stop distance (pips)",l_stopv_a:"Stop distance (× ATR)",
l_tgt:"Take profit",tgt_none:"None",tgt_pips:"Fixed pips",tgt_atr:"ATR multiple",tgt_r:"R multiple",l_tgtv_p:"Target distance (pips)",l_tgtv_a:"Target distance (× ATR)",l_tgtv_r:"Target (× stop distance)",
l_opp:"On an opposite signal",opp_yes:"Reverse",opp_no:"Ignore",l_maxb:"Close after this many candles (0 = never)",l_atrn:"ATR period",
exit_hint:"1 pip = $0.10 of gold price, so a $1 move is 10 pips. ATR is measured on the timeframe you picked.",
l_bal:"Starting balance ($)",l_size:"Position size",size_risk:"% risk",size_lots:"Fixed lots",l_risk:"Risk per trade (%)",l_lots:"Lots per trade",l_spread:"Spread (pips)",l_comm:"Commission per lot, round trip ($)",
money_hint:"1 lot = 100 ounces, so 1 pip is worth $10 per lot. Risk-based sizing rounds down to 0.01 lots and skips a trade that can't afford 0.01.",
e_field:"Use a number from {min} to {max}.",e_order:"The fast period must be shorter than the slow one.",e_nostop:"Sizing by risk needs a stop loss. Pick a stop, or switch to fixed lots.",e_inputs:"Fix the inputs marked in red first.",
l_btlen:"Backtest length",l_fwlen:"Forward test length",l_start:"Backtest starts",mo_n:"{n} months",mo_1:"1 month",
per_rule:"The forward test starts the day after the backtest ends and is at least a quarter as long, so a lucky few weeks can't pass for proof.",
per_avail:"Gold data: {a} to {b}",per_bt:"Backtest: {a} to {b}",per_fw:"Forward test: {a} to {b}",per_warm:"{n} months before the start are loaded so the indicators have settled.",
run_bt:"Run backtest",rerun_bt:"Run backtest again",run_fw:"Run forward test",fw_need:"Run the backtest with these settings first, then the forward test.",
st_load:"Loading gold data: {done} of {total} months…",st_run:"Running the test…",loading_idx:"Loading the list of gold months…",
lock_on:"Forward test done for these months. If you change the settings now and run the forward test here again, the result is marked as not a fair test.",
lock_seen:"You've already seen these forward months with other settings, so another forward run here won't be a fair test. Move the start so the forward months are ones you haven't seen.",
stale_bt:"Settings changed since this backtest. Run it again to update the results.",
stale_fw:"You changed settings after seeing the forward test. The results below are for the old settings.",
unfair:"Not a fair test: these forward months had already been seen with different settings before this run.",
v_held:"Held up",v_weak:"Weakened",v_fail:"Failed",v_btlose:"No edge to confirm",v_thin:"Edge too thin to confirm",v_thin_p:"The backtest barely made money ({b} per trade, profit factor {pf}). That is too small to tell apart from luck, so the forward test can't confirm it either way. Forward months: {f} per trade.",v_bt_thin_p:"{n} trades, {w} won, {e} per trade on average, profit factor {pf}. That edge is too small to tell apart from luck. A stronger rule is worth finding before you spend the forward test.",v_few:"Too few trades to judge",
v_held_p:"The forward months made {f} per trade, against {b} in the backtest. The rule kept most of its edge on months it wasn't tuned on.",
v_weak_p:"The forward months still made money ({f} per trade), but less than half the backtest's {b}. Part of the backtest result was probably fitted to the past.",
v_fail_p:"The forward months averaged {f} per trade, against {b} in the backtest. The backtest result was most likely fitted to the past.",
v_btlose_p:"The backtest itself averaged {b} per trade, so there's nothing for the forward test to confirm. Change the rule, not just the numbers.",
v_few_p:"Only {n} trades in the forward months. Pick a longer forward test or a shorter timeframe before drawing a conclusion.",
v_dd:"Deepest fall: {f} in the forward months, {b} in the backtest.",
v_bt:"Backtest result",v_bt_p:"{n} trades, {w} won, {e} per trade on average. Next, run the forward test to see whether this holds on the months after.",
v_bt_lose_p:"{n} trades, {w} won, {e} per trade on average. The rule lost money in the backtest, so change the rule before spending the forward test.",
v_none:"No trades",v_none_p:"The signal never fired in this period. Try a shorter timeframe, a longer backtest or looser levels.",
v_dead:"The account ran out of money on {d}, and trading stopped there.",
t_net:"Net result",t_dd:"Deepest fall",t_won:"Trades won",t_pf:"Profit factor",
n_eq:"Account value at the end of each day, open trades included. The shaded band reaches down to the lowest point within the day.",
n_eq_fw:"The forward test starts at the dashed line and carries on from the backtest's balance.",
n_month:"Change in the account in each calendar month.",n_month_fw:"Months from {d} on belong to the forward test.",
n_trades:"The last {n} trades. Prices are real gold prices. Download every trade to check it in a spreadsheet.",csv:"Download all trades (.csv)",
n_cmp:"Per-trade numbers are the fairest comparison, because the two periods have different lengths. Gold's own move shows how much a buy-only rule could get from the trend alone.",
hw:["Candles are built from 1-minute COMEX gold futures bars. Daily and 4-hour candles close at 17:00 New York time, like most MT5 gold brokers (server time UTC+2 in winter, UTC+3 in summer), so indicator values should be close to what you see on your charts.",
 "Indicators use the same formulas and start-up rules as TA-Lib, and their values were checked against it.",
 "A signal is read when a candle closes. The trade opens at the open of the next minute, so the test never uses a price it couldn't have known.",
 "Stops and targets are checked on every 1-minute bar, whatever the timeframe. If a stop and a target are both inside the same minute, the stop counts. If price opens past the stop (after a weekend, say), the trade closes at that open, which can be worse than the stop.",
 "Targets fill exactly at the target, never better. The spread is charged once per trade, commission per lot. One trade is open at a time.",
 "Contract rolls are removed so prices run on without jumps. There's no swap, no slippage apart from gaps and no margin check."],
lim:["Futures, not spot: a broker's XAUUSD prices, hours and gaps differ slightly.",
 "One forward test that passes is one more sample, not proof. Try several periods: if only some pass, the edge is weak.",
 "Every time you look at the forward months and then change settings, the test gets less honest. That's why it locks.",
 "The data ends on {d} and isn't updated."],
e_file:"The playground needs the app opened from the web (https://), not as a file on your computer.",e_nodecomp:"This browser can't unpack the gold data. Use a recent Chrome, Edge, Firefox or Safari.",
e_idx:"Couldn't load the list of gold months: {msg}",e_net:"Couldn't download the gold data. Check your connection and try again.",e_http:"The gold data server answered {code} for {m}. Try again later.",
lg_bt:"Backtest",lg_fw:"Forward test",lg_low:"Lowest point in the day",lg_up:"Month up",lg_down:"Month down",
PL:{},
e_bad:"The gold file for {m} was damaged on the way. Try again.",e_busy:"Too many tests are running right now. Wait a minute and try again.",e_other:"The test stopped: {msg}"
});
Object.assign(I18N.th,{
lab_lead:"สร้างกฎเข้าเทรดจากอินดิเคเตอร์ แล้วทดสอบกับราคาทองจริงราย 1 นาที จากนั้นรันกฎเดิมโดยไม่แก้อะไรอีกหนึ่งครั้งกับเดือนถัดไปทันที ถ้ายังทำกำไรได้ในเดือนที่คุณไม่ได้จูน Edge นั้นอาจมีอยู่จริง",
lab_s1:"เลือกช่วง Backtest แล้วปรับค่าต่างๆ กับช่วงนี้ได้ตามต้องการ",
lab_s2:"รัน Forward test หนึ่งครั้ง ใช้ค่าชุดเดิมกับเดือนที่ต่อจาก Backtest ทันที",
lab_s3:"เทียบผลสองช่วง กฎที่จูนจนเข้ากับอดีตมักพังในช่วง Forward",
lp_chart:"กราฟ",lp_entry:"สัญญาณเข้า",lp_exit:"การออก",lp_money:"เงินและต้นทุน",
l_tf:"ไทม์เฟรม",tf_1:"1 นาที",tf_5:"5 นาที",tf_15:"15 นาที",tf_60:"1 ชั่วโมง",tf_240:"4 ชั่วโมง",tf_1440:"1 วัน",
l_dir:"ทิศทางการเทรด",dir_both:"ทั้งซื้อและขาย",dir_long:"ซื้ออย่างเดียว",dir_short:"ขายอย่างเดียว",
l_preset:"เริ่มจากชุดสำเร็จรูป",pre_pick:"เลือกชุดสำเร็จรูป…",pre_ma:"EMA 20 / 50 ตัดกัน",pre_rsi:"RSI ออกจาก 30 / 70",pre_bbrev:"Bollinger Bands กลับตัว",pre_bbbrk:"Bollinger Bands Breakout",pre_macd:"MACD ตัดเส้น Signal",
pre_stoch:"Stochastic ตัดกันจากโซน Oversold",pre_don:"Breakout 20 แท่ง (Donchian)",pre_pull:"ย่อตัวในขาขึ้น (EMA 20 อยู่เหนือ EMA 200)",pre_adx:"+DI / −DI ตัดกัน และ ADX เหนือ 25",pre_engulf:"แท่ง Engulfing ตามเทรนด์ EMA 200",
r_buy:"ซื้อเมื่อทุกข้อด้านล่างเป็นจริง",r_sell:"ขายเมื่อทุกข้อด้านล่างเป็นจริง",r_add:"เพิ่มเงื่อนไข",r_del:"ลบเงื่อนไขนี้",r_mode:"กฎขาย",r_mirror:"กลับด้านจากกฎซื้อ",r_own:"ตั้งเงื่อนไขเอง",
r_num:"ตัวเลข",r_value:"ค่า",r_out:"เส้น",r_none:"ยังไม่มีเงื่อนไข ฝั่งนี้จึงไม่เทรด",r_max:"ตั้งได้สูงสุดฝั่งละ 4 เงื่อนไข",
r_sum_buy:"ซื้อเมื่อ {x}",r_sum_sell:"ขายเมื่อ {x}",r_and:" และ ",r_hint:"อ่านสัญญาณตอนแท่งเทียนปิด กฎขายแบบกลับด้านจะพลิกทุกเงื่อนไข: ตัดขึ้นกลายเป็นตัดลง RSI 30 กลายเป็น 70 กรอบล่างกลายเป็นกรอบบน",
op_xa:"ตัดขึ้นเหนือ",op_xb:"ตัดลงใต้",op_gt:"อยู่เหนือ",op_lt:"อยู่ใต้",op_bull:"เกิดขึ้น (ขาขึ้น)",op_bear:"เกิดขึ้น (ขาลง)",op_any:"เกิดขึ้น",
g_price:"ราคา",g_avg:"เส้นค่าเฉลี่ย",g_band:"กรอบและช่องราคา",g_osc:"ออสซิลเลเตอร์",g_trend:"ความแรงของเทรนด์",g_vol:"ความผันผวน",g_pat:"รูปแบบแท่งเทียน",
d_bull:"เกิดแท่ง {x} ขาขึ้น",d_bear:"เกิดแท่ง {x} ขาลง",d_any:"เกิดแท่ง {x}",
l_stop:"Stop loss",stop_pips:"pips คงที่",stop_atr:"เท่าของ ATR",stop_none:"ไม่ตั้ง",l_stopv_p:"ระยะ Stop (pips)",l_stopv_a:"ระยะ Stop (× ATR)",
l_tgt:"Take profit",tgt_none:"ไม่ตั้ง",tgt_pips:"pips คงที่",tgt_atr:"เท่าของ ATR",tgt_r:"เท่าของ R",l_tgtv_p:"ระยะเป้ากำไร (pips)",l_tgtv_a:"ระยะเป้ากำไร (× ATR)",l_tgtv_r:"เป้ากำไร (× ระยะ Stop)",
l_opp:"เมื่อเกิดสัญญาณตรงข้าม",opp_yes:"กลับฝั่ง",opp_no:"ไม่สนใจ",l_maxb:"ปิดเมื่อครบจำนวนแท่งนี้ (0 = ไม่ปิด)",l_atrn:"คาบ ATR",
exit_hint:"1 pip = ราคาทอง $0.10 ราคาขยับ $1 จึงเท่ากับ 10 pips ATR วัดจากไทม์เฟรมที่เลือก",
l_bal:"ทุนเริ่มต้น ($)",l_size:"ขนาดไม้",size_risk:"% ความเสี่ยง",size_lots:"ล็อตคงที่",l_risk:"ความเสี่ยงต่อไม้ (%)",l_lots:"ล็อตต่อไม้",l_spread:"สเปรด (pips)",l_comm:"คอมมิชชั่นต่อล็อต ไป-กลับ ($)",
money_hint:"1 ล็อต = 100 ออนซ์ 1 pip จึงมีค่า $10 ต่อล็อต การคำนวณขนาดตามความเสี่ยงจะปัดลงเป็น 0.01 ล็อต และข้ามไม้ที่ทุนไม่พอสำหรับ 0.01 ล็อต",
e_field:"ใส่ตัวเลขตั้งแต่ {min} ถึง {max}",e_order:"คาบเส้นเร็วต้องสั้นกว่าเส้นช้า",e_nostop:"การคำนวณขนาดตามความเสี่ยงต้องมี Stop loss เลือก Stop หรือเปลี่ยนเป็นล็อตคงที่",e_inputs:"แก้ช่องที่เป็นสีแดงก่อน",
l_btlen:"ความยาว Backtest",l_fwlen:"ความยาว Forward test",l_start:"Backtest เริ่ม",mo_n:"{n} เดือน",mo_1:"1 เดือน",
per_rule:"Forward test เริ่มวันถัดจากที่ Backtest จบ และยาวอย่างน้อยหนึ่งในสี่ของ Backtest เพื่อไม่ให้ช่วงโชคดีไม่กี่สัปดาห์กลายเป็นหลักฐาน",
per_avail:"ข้อมูลทอง: {a} ถึง {b}",per_bt:"Backtest: {a} ถึง {b}",per_fw:"Forward test: {a} ถึง {b}",per_warm:"โหลดข้อมูลก่อนวันเริ่ม {n} เดือน เพื่อให้อินดิเคเตอร์นิ่งก่อน",
run_bt:"รัน Backtest",rerun_bt:"รัน Backtest อีกครั้ง",run_fw:"รัน Forward test",fw_need:"รัน Backtest ด้วยค่าชุดนี้ก่อน แล้วค่อยรัน Forward test",
st_load:"กำลังโหลดข้อมูลทอง: {done} จาก {total} เดือน…",st_run:"กำลังทดสอบ…",loading_idx:"กำลังโหลดรายการเดือนของข้อมูลทอง…",
lock_on:"รัน Forward test ของเดือนเหล่านี้แล้ว ถ้าเปลี่ยนค่าตอนนี้แล้วรัน Forward test ที่ช่วงนี้อีก ผลจะถูกระบุว่าไม่ใช่การทดสอบที่ยุติธรรม",
lock_seen:"คุณเคยเห็นเดือน Forward ช่วงนี้กับค่าชุดอื่นแล้ว การรัน Forward อีกครั้งที่นี่จึงไม่ยุติธรรม เลื่อนวันเริ่มให้เดือน Forward เป็นช่วงที่ยังไม่เคยเห็น",
stale_bt:"ค่าเปลี่ยนไปหลังจาก Backtest นี้ รันอีกครั้งเพื่ออัปเดตผล",
stale_fw:"คุณเปลี่ยนค่าหลังจากเห็นผล Forward test แล้ว ผลด้านล่างเป็นของค่าชุดเดิม",
unfair:"ไม่ใช่การทดสอบที่ยุติธรรม: เดือน Forward ช่วงนี้เคยถูกดูด้วยค่าชุดอื่นมาก่อนการรันครั้งนี้",
v_held:"ผ่าน",v_weak:"อ่อนลง",v_fail:"ไม่ผ่าน",v_btlose:"ไม่มี Edge ให้ยืนยัน",v_thin:"Edge บางเกินกว่าจะยืนยัน",v_thin_p:"Backtest แทบไม่ได้กำไร ({b} ต่อไม้ Profit factor {pf}) น้อยเกินกว่าจะแยกออกจากโชค Forward test จึงยืนยันอะไรไม่ได้ ช่วง Forward ได้ {f} ต่อไม้",v_bt_thin_p:"{n} ไม้ ชนะ {w} ไม้ เฉลี่ย {e} ต่อไม้ Profit factor {pf} Edge นี้น้อยเกินกว่าจะแยกออกจากโชค ควรหากฎที่แข็งแรงกว่านี้ก่อนใช้ Forward test",v_few:"ไม้น้อยเกินกว่าจะสรุป",
v_held_p:"ช่วง Forward ได้ {f} ต่อไม้ เทียบกับ {b} ใน Backtest กฎนี้รักษา Edge ส่วนใหญ่ไว้ได้ในเดือนที่ไม่ได้จูน",
v_weak_p:"ช่วง Forward ยังทำกำไร ({f} ต่อไม้) แต่ไม่ถึงครึ่งของ {b} ใน Backtest ผล Backtest บางส่วนน่าจะมาจากการจูนให้เข้ากับอดีต",
v_fail_p:"ช่วง Forward เฉลี่ย {f} ต่อไม้ เทียบกับ {b} ใน Backtest ผล Backtest น่าจะมาจากการจูนให้เข้ากับอดีต",
v_btlose_p:"Backtest เองเฉลี่ย {b} ต่อไม้ จึงไม่มีอะไรให้ Forward test ยืนยัน ให้เปลี่ยนกฎ ไม่ใช่แค่ปรับตัวเลข",
v_few_p:"ช่วง Forward มีแค่ {n} ไม้ เลือก Forward test ที่ยาวขึ้นหรือไทม์เฟรมที่สั้นลงก่อนสรุป",
v_dd:"ลดลงลึกสุด: {f} ในช่วง Forward และ {b} ใน Backtest",
v_bt:"ผล Backtest",v_bt_p:"{n} ไม้ ชนะ {w} ไม้ เฉลี่ย {e} ต่อไม้ ขั้นต่อไปให้รัน Forward test เพื่อดูว่ายังได้ผลในเดือนถัดไปหรือไม่",
v_bt_lose_p:"{n} ไม้ ชนะ {w} ไม้ เฉลี่ย {e} ต่อไม้ กฎนี้ขาดทุนใน Backtest ควรเปลี่ยนกฎก่อนใช้ Forward test",
v_none:"ไม่มีไม้เทรด",v_none_p:"สัญญาณไม่เกิดเลยในช่วงนี้ ลองไทม์เฟรมที่สั้นลง Backtest ที่ยาวขึ้น หรือระดับที่หลวมขึ้น",
v_dead:"ทุนหมดเมื่อ {d} และหยุดเทรดตรงนั้น",
t_net:"ผลสุทธิ",t_dd:"ลดลงลึกสุด",t_won:"ไม้ที่ชนะ",t_pf:"Profit factor",
n_eq:"มูลค่าพอร์ตตอนสิ้นวัน รวมไม้ที่ยังเปิดอยู่ แถบแรเงาลงไปถึงจุดต่ำสุดระหว่างวัน",
n_eq_fw:"Forward test เริ่มที่เส้นประ และต่อจากทุนตอนจบ Backtest",
n_month:"การเปลี่ยนแปลงของพอร์ตในแต่ละเดือน",n_month_fw:"ตั้งแต่ {d} เป็นต้นไปเป็นช่วง Forward test",
n_trades:"{n} ไม้ล่าสุด ราคาเป็นราคาทองจริง ดาวน์โหลดทุกไม้ไปตรวจในสเปรดชีตได้",csv:"ดาวน์โหลดทุกไม้ (.csv)",
n_cmp:"ตัวเลขต่อไม้เป็นการเทียบที่ยุติธรรมที่สุด เพราะสองช่วงยาวไม่เท่ากัน การขยับของราคาทองเองบอกว่ากฎที่ซื้ออย่างเดียวอาจได้กำไรจากเทรนด์ล้วนๆ มากแค่ไหน",
hw:["แท่งเทียนสร้างจากแท่ง 1 นาทีของฟิวเจอร์สทองคำ COMEX แท่งรายวันและ 4 ชั่วโมงปิดตอน 17:00 เวลานิวยอร์ก เหมือนโบรกเกอร์ทองส่วนใหญ่บน MT5 (เวลาเซิร์ฟเวอร์ UTC+2 ช่วงหน้าหนาว และ UTC+3 ช่วงหน้าร้อน) ค่าอินดิเคเตอร์จึงควรใกล้กับที่เห็นบนกราฟของคุณ",
 "อินดิเคเตอร์ใช้สูตรและการเริ่มคำนวณแบบเดียวกับ TA-Lib และตรวจค่าเทียบกับ TA-Lib แล้ว",
 "อ่านสัญญาณตอนแท่งเทียนปิด และเปิดไม้ที่ราคาเปิดของนาทีถัดไป การทดสอบจึงไม่ใช้ราคาที่ยังไม่มีทางรู้",
 "Stop และเป้ากำไรถูกตรวจทุกแท่ง 1 นาที ไม่ว่าจะเลือกไทม์เฟรมไหน ถ้า Stop และเป้ากำไรอยู่ในนาทีเดียวกัน จะนับเป็น Stop ถ้าราคาเปิดกระโดดข้าม Stop (เช่นหลังวันหยุดสุดสัปดาห์) ไม้จะปิดที่ราคาเปิดนั้น ซึ่งอาจแย่กว่า Stop",
 "เป้ากำไรได้ราคาตรงเป้าพอดี ไม่เคยดีกว่า สเปรดคิดครั้งเดียวต่อไม้ คอมมิชชั่นคิดต่อล็อต เปิดได้ครั้งละหนึ่งไม้",
 "ตัดส่วนต่างตรงรอยต่อสัญญาฟิวเจอร์สออก ราคาจึงต่อเนื่องไม่กระโดด ไม่มี Swap ไม่มี Slippage นอกจากช่วงราคากระโดด และไม่ตรวจมาร์จิ้น"],
lim:["เป็นฟิวเจอร์ส ไม่ใช่ Spot ราคา XAUUSD ของโบรกเกอร์ เวลาเทรด และช่องว่างราคาต่างกันเล็กน้อย",
 "Forward test ที่ผ่านหนึ่งครั้งคือตัวอย่างเพิ่มอีกหนึ่ง ไม่ใช่หลักฐาน ลองหลายช่วง ถ้าผ่านแค่บางช่วง Edge นั้นอ่อน",
 "ทุกครั้งที่ดูเดือน Forward แล้วกลับไปเปลี่ยนค่า การทดสอบจะซื่อตรงน้อยลง จึงต้องล็อกไว้",
 "ข้อมูลสิ้นสุดวันที่ {d} และไม่อัปเดต"],
e_file:"สนามทดลองต้องเปิดแอปจากเว็บ (https://) ไม่ใช่เปิดเป็นไฟล์ในเครื่อง",e_nodecomp:"เบราว์เซอร์นี้แตกไฟล์ข้อมูลทองไม่ได้ ใช้ Chrome, Edge, Firefox หรือ Safari รุ่นใหม่",
e_idx:"โหลดรายการเดือนของข้อมูลทองไม่สำเร็จ: {msg}",e_net:"ดาวน์โหลดข้อมูลทองไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่",e_http:"เซิร์ฟเวอร์ข้อมูลทองตอบกลับ {code} สำหรับ {m} ลองใหม่ภายหลัง",
lg_bt:"Backtest",lg_fw:"Forward test",lg_low:"จุดต่ำสุดระหว่างวัน",lg_up:"เดือนที่บวก",lg_down:"เดือนที่ลบ",
PL:{"Period":"คาบ","Fast":"เร็ว","Slow":"ช้า","Signal":"Signal","Step":"ขั้น","Maximum":"สูงสุด","Width (std. dev.)":"ความกว้าง (SD)","ATR period":"คาบ ATR","Width (× ATR)":"ความกว้าง (× ATR)","%K period":"คาบ %K","%K smoothing":"ทำให้ %K เรียบ","%D period":"คาบ %D","Short":"สั้น","Medium":"กลาง","Long":"ยาว","Multiplier":"ตัวคูณ","Close":"ราคาปิด","Open":"ราคาเปิด","High":"ราคาสูงสุด","Low":"ราคาต่ำสุด","upper":"กรอบบน","middle":"เส้นกลาง","lower":"กรอบล่าง","line":"เส้น MACD","signal":"เส้น Signal","histogram":"ฮิสโตแกรม","up":"ขึ้น","down":"ลง"},
e_bad:"ไฟล์ข้อมูลทองของ {m} เสียระหว่างดาวน์โหลด ลองใหม่",e_busy:"ตอนนี้มีการทดสอบมากเกินไป รอสักครู่แล้วลองใหม่",e_other:"การทดสอบหยุดลง: {msg}"
});
const tl=k=>(I18N[LANG]&&I18N[LANG][k])||I18N.en[k];

/* ---------- settings ---------- */
/* ready-made rules; each becomes ordinary conditions the user can edit */
const X=(id,p,o)=>({id,p:p||{},o:o||'v'}),N=v=>({num:v}),CL=()=>X('price',{},'c');
const PRESETS={ma:[{a:X('ema',{n:20}),op:'xa',b:X('ema',{n:50})}],rsi:[{a:X('rsi',{n:14}),op:'xa',b:N(30)}],bbrev:[{a:CL(),op:'xa',b:X('bb',{n:20,k:2},'lo')}],
  bbbrk:[{a:CL(),op:'xa',b:X('bb',{n:20,k:2},'up')}],macd:[{a:X('macd',{f:12,s:26,g:9},'m'),op:'xa',b:X('macd',{f:12,s:26,g:9},'s')}],
  stoch:[{a:X('stoch',{k:14,ks:3,d:3},'k'),op:'xa',b:X('stoch',{k:14,ks:3,d:3},'d')},{a:X('stoch',{k:14,ks:3,d:3},'k'),op:'lt',b:N(30)}],don:[{a:CL(),op:'xa',b:X('don',{n:20},'up')}],
  pull:[{a:CL(),op:'xa',b:X('ema',{n:20})},{a:X('ema',{n:20}),op:'gt',b:X('ema',{n:200})}],adx:[{a:X('dmi',{n:14},'p'),op:'xa',b:X('dmi',{n:14},'m')},{a:X('dmi',{n:14},'adx'),op:'gt',b:N(25)}],
  engulf:[{a:X('p_engulf'),op:'bull'},{a:CL(),op:'gt',b:X('ema',{n:200})}]};
const clone=x=>JSON.parse(JSON.stringify(x));
const preset=k=>({mode:'mirror',buy:clone(PRESETS[k]),sell:[]});
const DEF=()=>({tf:60,dir:'both',rule:preset('ma'),stop:'atr',stopV:{pips:100,atr:2},tgt:'r',tgtV:{pips:200,atr:4,r:2},opp:'yes',maxBars:0,atrN:14,
  size:'risk',risk:1,lots:0.1,bal:10000,spread:3,comm:7,btLen:12,fwLen:6,start:null});
let C=DEF();
const IR=LABIND;
/* a saved rule is used only if every indicator in it still exists */
const okX=x=>!!x&&(x.num!==undefined?isFinite(x.num):!!IR.byId[x.id]&&IR.byId[x.id].outs.some(o=>o[0]===x.o));
const okRule=R=>R&&Array.isArray(R.buy)&&Array.isArray(R.sell)&&R.buy.concat(R.sell).every(c=>okX(c.a)&&(IR.byId[c.a.id].kind==='pat'||okX(c.b)));
try{const s=JSON.parse(localStorage.getItem('jn_lab')||'null');if(s&&typeof s==='object'){C=Object.assign(DEF(),s);['sig','p','filt','filtN'].forEach(k=>delete C[k]);if(!okRule(C.rule))C.rule=preset('ma');C.stopV=Object.assign({pips:100,atr:2},C.stopV);C.tgtV=Object.assign({pips:200,atr:4,r:2},C.tgtV);}}catch(e){}
const save=()=>{try{localStorage.setItem('jn_lab',JSON.stringify(C));}catch(e){}};
const bad={};
const BTL=[3,6,9,12,18,24],FWL=[1,2,3,4,6,9,12,18,24];
const fwOpts=bt=>FWL.filter(v=>v>=Math.max(1,Math.ceil(bt/4))&&v<=bt);
const BPM={1:28000,5:5600,15:1870,60:470,240:122,1440:21};

/* the parameters the worker runs, and a signature of everything that changes a result except the dates */
function params(){
  return{tf:+C.tf,rule:C.rule,dir:C.dir,
    stop:{kind:C.stop,v:C.stop==='none'?0:C.stopV[C.stop]},tgt:{kind:C.tgt,v:C.tgt==='none'?0:C.tgtV[C.tgt]},opp:C.opp==='yes',maxBars:C.maxBars,atrN:C.atrN,
    size:{kind:C.size,v:C.size==='risk'?C.risk:C.lots},bal:C.bal,spread:C.spread,comm:C.comm,pv:10};}
const sigOf=()=>JSON.stringify(params());
const warmBars=P=>IR.warmOf(P.rule);
const warmMonths=()=>Math.ceil(warmBars(params())/BPM[C.tf])+1;

/* ---------- data and the worker ---------- */
const R={idx:null,idxErr:null,busy:false,prog:'',err:null,worker:null,id:0,bt:null,fw:null,root:null};
const BASE=()=>new URL('data/gold/',location.href).href;
const bases=()=>{const own=BASE(),tag=R.idx&&(R.idx.cdnRef||R.idx.cdnTag);return tag&&location.protocol==='https:'?['https://cdn.jsdelivr.net/gh/0xtrvkc/Jarn-Neow@'+tag+'/data/gold/',own]:[own];};
const isFile=()=>location.protocol==='file:';
const canRun=()=>typeof DecompressionStream!=='undefined'&&typeof Worker!=='undefined';
function loadIdx(){if(R.idx||R.idxErr||isFile())return;
  fetch(BASE()+'index.json').then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.json();}).then(j=>{R.idx=j;clampStart();drawMain();}).catch(e=>{R.idxErr=String(e.message||e);drawMain();});}
const months=()=>R.idx?R.idx.months.map(x=>x.m):[];
const m2min=k=>Date.UTC(+k.slice(0,4),+k.slice(5,7)-1,1)/60000;
function startRange(){const ms=months(),lo=Math.min(warmMonths(),ms.length-1),hi=ms.length-C.btLen-C.fwLen;return[lo,hi];}
function clampStart(){const ms=months();if(!ms.length)return;const[lo,hi]=startRange();let i=ms.indexOf(C.start);if(i<0)i=hi;C.start=ms[Math.max(lo,Math.min(hi,i))]||ms[lo];}
/* a = backtest start, s = forward start, b = forward end (exclusive), in minutes */
function win(){const ms=months(),i=ms.indexOf(C.start),j=i+C.btLen,k=j+C.fwLen;
  return{i,j,k,a:m2min(ms[i]),s:j<ms.length?m2min(ms[j]):R.idx.to+1,b:k<ms.length?m2min(ms[k]):R.idx.to+1};}
const wsigOf=()=>C.start+'|'+C.btLen+'|'+C.fwLen;
function seen(){try{const a=JSON.parse(localStorage.getItem('jn_lab_seen')||'[]');return Array.isArray(a)?a:[];}catch(e){return[];}}
function addSeen(w,sig){const a=seen();if(!a.some(x=>x.s===w.s&&x.b===w.b&&x.sig===sig))a.push({s:w.s,b:w.b,sig});try{localStorage.setItem('jn_lab_seen',JSON.stringify(a.slice(-200)));}catch(e){}}
function seenState(){if(!R.idx)return'';const w=win(),sig=sigOf(),hit=seen().filter(x=>x.s<w.b&&x.b>w.s);if(!hit.length)return'';return hit.some(x=>x.sig!==sig)?'seen':'on';}
function errText(m){const mo=m.month?lmon(m.month):'';
  if(m.kind==='http'&&m.code===429)return t('e_busy');if(m.kind==='http')return t('e_http',{code:m.code,m:mo});if(m.kind==='bad')return t('e_bad',{m:mo});if(m.kind==='net')return t('e_net');return t('e_other',{msg:m.msg});}
function go(mode){
  if(R.busy||!R.idx)return;if(Object.keys(bad).length){R.err=t('e_inputs');drawMain();return;}
  const w=win(),ms=months(),W=warmMonths(),last=mode==='fw'?w.k:w.j,list=ms.slice(Math.max(0,w.i-W),Math.min(ms.length,last));
  const sig=sigOf(),wsig=wsigOf(),unfair=mode==='fw'&&seenState()==='seen';
  if(!R.worker){R.worker=new Worker('lab-worker.js?v='+(typeof LAB_V!=='undefined'?LAB_V:'0'));
    R.worker.onmessage=e=>{const m=e.data;if(m.id!==R.id)return;
      if(m.type==='progress'){R.prog=m.stage==='run'?t('st_run'):t('st_load',{done:m.done,total:m.total});const el=$('lab-status');if(el)el.textContent=R.prog;return;}
      R.busy=false;const job=R.job;
      if(m.type==='error')R.err=errText(m);
      else{R.err=null;const rec={res:m.out,sig:job.sig,wsig:job.wsig,w:job.w,unfair:job.unfair};if(job.mode==='fw'){R.fw=rec;addSeen(job.w,job.sig);}else{R.bt=rec;R.fw=R.fw&&R.fw.wsig===job.wsig?R.fw:null;}R.view=job.mode;}
      drawMain();};}
  R.busy=true;R.err=null;R.id++;R.job={mode,sig,wsig,w,unfair};R.prog=t('st_load',{done:0,total:list.length});
  const counts={};R.idx.months.forEach(x=>{counts[x.m]=x.n;});
  R.worker.postMessage({id:R.id,bases:bases(),months:list,counts,rolls:R.idx.rolls,params:params(),win:{a:w.a,s:mode==='fw'?w.s:0,b:mode==='fw'?w.b:w.s}});
  drawMain();}

/* ---------- formatting ---------- */
const MINUS='−';
const usd=v=>{if(!isFinite(v))return'–';const a=Math.abs(v);return(v<0?MINUS:'')+'$'+a.toLocaleString('en-US',{minimumFractionDigits:a>=100?0:2,maximumFractionDigits:a>=100?0:2});};
const usdS=v=>(v>0?'+':'')+usd(v);
const pct=(v,d)=>isFinite(v)?(v<0?MINUS:v>0?'+':'')+Math.abs(v*100).toFixed(d===undefined?1:d)+'%':'–';
const pc0=v=>isFinite(v)?(v*100).toFixed(0)+'%':'–';
const num=(v,d)=>isFinite(v)?(v<0?MINUS:'')+Math.abs(v).toFixed(d):'–';
const dfmt=min=>new Date(min*60000).toISOString().slice(0,10);
const dtm=min=>new Date(min*60000).toISOString().slice(0,16).replace('T',' ');
const loc=()=>LANG==='th'?'th-TH-u-ca-gregory':'en-GB';
const lday=min=>new Date(min*60000).toLocaleDateString(loc(),{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const lmon=k=>new Date(Date.UTC(+k.slice(0,4),+k.slice(5,7)-1,1)).toLocaleDateString(loc(),{month:'short',year:'numeric',timeZone:'UTC'});
const hold=m=>m<120?Math.round(m)+' min':m<2880?(m/60).toFixed(1)+' h':(m/1440).toFixed(1)+' days';
const card=(title,body,cls)=>`<div class="card ${cls||''}"><h3>${esc(title)}</h3>${body}</div>`;
const kv=rows=>`<table class="kv"><tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td class="n">${r[1]}</td></tr>`).join('')}</tbody></table>`;
const tbl=(head,rows)=>`<div style="overflow-x:auto" tabindex="0" role="region" aria-label="${esc(head.join(', ')||'table')}"><table class="kv mt"><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i?' class="n"':''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const lg=items=>`<div class="legend">${items.map(i=>`<span><i style="background:${i[0]}"></i>${esc(i[1])}</span>`).join('')}</div>`;
const note=s=>`<p class="small muted" style="margin:.6rem 0 0">${esc(s)}</p>`;
const ch=svg=>`<div class="chart">${svg}</div>`;
const cmp=v=>{const a=Math.abs(v);return a>=1e6?(+(v/1e6).toPrecision(3))+'M':a>=1e4?(+(v/1e3).toPrecision(3))+'k':String(Math.round(v));};

/* ---------- inputs ---------- */
const opt=(v,cur,label)=>`<option value="${v}"${String(v)===String(cur)?' selected':''}>${esc(label)}</option>`;
const tk=id=>`lab:f:${id.replace(/^lb-/,'')}`;
const sel=(id,key,cur,opts)=>`<div class="formrow" data-tip="${tk(id)}"><label for="${id}">${esc(t(key))}</label><select id="${id}" class="txt" data-lk="${id}">${opts.map(o=>opt(o[0],cur,t(o[1]))).join('')}</select></div>`;
const fld=(id,key,val,min,max,step)=>`<div class="formrow" data-tip="${tk(id)}"><label for="${id}">${esc(t(key))}</label><input id="${id}" class="txt${bad[id]?' bad':''}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${val}" data-lk="${id}" data-min="${min}" data-max="${max}" aria-invalid="${!!bad[id]}"></div><p class="ferr" id="le-${id}"${bad[id]?'':' hidden'}>${esc(bad[id]||'')}</p>`;
/* ---------- explanations shown on hover or focus ---------- */
const LT={en:{
 use:"How it's used.",ops:"Crosses above means at or below on the previous candle and above on this one. Is above means above on this candle, whatever happened before.",
 f:{tf:["The candle size the rule reads. A signal is checked each time one of these candles closes.","Shorter candles give more trades and more noise; longer ones give fewer, slower signals. Stops and targets are still checked every minute.","1 hour: a signal can only appear on the hour."],
  dir:["Whether the test takes buys, sells or both.","Gold rose strongly over most of these years, so a buy-only rule can look good from the trend alone. Compare it with gold's own move in the results.","Buy only: sell signals are ignored completely."],
  preset:["Loads a ready-made rule into the conditions below.","A quick starting point. It replaces the current buy and sell conditions, and you can edit them afterwards.","RSI leaves 30 / 70: buy when RSI(14) crosses above 30."],
  rmode:["How sell signals are made.","Mirror flips every buy condition, so rallies and drops are treated the same way. Its own conditions lets you write a different rule for sells.","Buy when RSI crosses above 30; the mirror sells when RSI crosses below 70."],
  stop:["How far from the entry the stop loss sits.","A fixed distance stays the same in calm and wild markets; an ATR multiple widens when gold gets volatile. With no stop, a trade ends only at the target, an opposite signal or the time limit.","ATR multiple 2 with ATR at 80 pips: the stop is 160 pips away."],
  stopV_pips:["Stop distance from the entry in pips (1 pip = $0.10).","When you risk a % of the balance, this also sets the lot size: a wider stop means fewer lots.","100 pips = a $10 move in gold."],
  stopV_atr:["Stop distance as a multiple of ATR, measured on the signal candle.","It adapts to volatility: wider when gold is busy, tighter when it's quiet.","2 × ATR(14)."],
  tgt:["Where the take-profit sits, if anywhere.","A multiple of the stop (R) keeps reward and risk in a fixed ratio. With none, trades end at the stop, an opposite signal or the time limit.","R multiple 2 with a 100-pip stop: the target is 200 pips away."],
  tgtV_pips:["Target distance from the entry in pips.","Fills exactly at the target, never better.","200 pips = a $20 move in gold."],
  tgtV_atr:["Target distance as a multiple of ATR on the signal candle.","Wider targets in busy markets, tighter in quiet ones.","4 × ATR(14)."],
  tgtV_r:["Target distance as a multiple of the stop distance.","2 means a winning trade makes about twice what a losing one loses, before costs.","Stop 100 pips, R 2: target 200 pips."],
  opp:["What happens to an open trade when the opposite signal appears.","Reverse closes it and opens the other way at the next minute's open. Ignore leaves it to its stop, target or time limit.","A buy is open and a sell signal appears: Reverse closes the buy and opens a sell."],
  maxBars:["Closes a trade after this many candles of the chosen timeframe, unless something closed it earlier.","Useful for rules that should work quickly. 0 turns it off.","24 on 1-hour candles: closes after about a day."],
  atrN:["How many candles ATR averages over, for ATR-based stops and targets.","Shorter reacts faster to a change in volatility; longer is steadier.","14 is the usual setting."],
  bal:["The account at the start of the backtest.","Money results and trade sizes follow from it. The forward test carries on from the backtest's final balance.","10,000."],
  size:["How the lot size of each trade is chosen.","Risking a % keeps every stopped-out loss the same share of the account, and compounds. Fixed lots keep the size constant.","1% of 10,000 with a 100-pip stop: 0.10 lots."],
  risk:["Share of the current balance lost if the stop is hit, before costs.","Sets the lot size together with the stop distance, rounded down to 0.01 lots.","1%."],
  lots:["The same size for every trade.","Money results scale directly with it.","0.10 lots: $1 per pip."],
  spread:["The gap between the buy and sell price, in pips, charged once per trade.","Short timeframes trade often, so the spread weighs more there.","3 pips = $0.30, a typical gold spread."],
  comm:["Broker commission per 1.0 lot, opening and closing together.","Charged on every trade by its lot size.","$7 per lot."],
  btLen:["How many months the backtest covers.","This is the period you tune on. Longer covers more kinds of market.","12 months."],
  fwLen:["How many months the forward test covers, straight after the backtest.","It has to be at least a quarter of the backtest, so a short lucky stretch can't pass for proof.","6 months after a 12-month backtest."],
  start:["The month the backtest begins.","Only starts where both periods fit in the data are listed. For an honest test, pick forward months you haven't looked at.","Jun 2025: backtest Jun 2025 to May 2026, forward test from Jun 2026."]},
 ind:{price:["The candle's close, open, high or low.","Compare price with an average or a band, for example Close crosses above EMA(50)."],
  sma:["Average of the last N closes, each counted equally.","Price above it suggests an uptrend; two SMAs crossing is a classic trend signal."],
  ema:["Average of the closes that counts recent candles more, so it turns sooner than an SMA.","Common as a trend filter (EMA 200) and for crosses (EMA 20 and 50)."],
  wma:["Average with weights rising in a straight line, so the newest close counts most.","Between an SMA and an EMA in speed."],
  dema:["Double EMA: removes part of an EMA's delay.","Faster crosses, but more false signals."],
  tema:["Triple EMA: removes even more delay.","Very quick; works best with a trend filter."],
  trima:["An average of an average: weights peak in the middle of the window, so it's very smooth.","Slow; good for the main direction."],
  kama:["Kaufman's adaptive average: quick when price trends cleanly, almost flat when it chops.","Fewer false crosses in sideways markets than a plain EMA."],
  hma:["Hull moving average: smooth and quick, built from weighted averages.","Turns early; used for crosses with price."],
  linreg:["End point of the straight line that best fits the last N closes.","Works like an average with little delay."],
  sar:["Parabolic SAR: points that trail price and close in faster as a trend runs, then flip side when price crosses them.","Close crossing above SAR is a trend-change entry; it's also used as a trailing stop."],
  bb:["A middle SMA with bands a set number of standard deviations above and below.","Close back above the lower band for reversals; close above the upper band for breakouts."],
  don:["Highest high and lowest low of the previous N candles. The current candle isn't included.","Close crossing above the upper line is a classic breakout entry."],
  kc:["An EMA with bands a multiple of ATR above and below.","Like Bollinger Bands but steadier; used for breakouts and pullbacks."],
  rsi:["Relative Strength Index, 0 to 100: average gains against average losses (Wilder smoothing).","Below 30 is called oversold and above 70 overbought; crossing back out is a reversal signal."],
  stoch:["Where the close sits in the recent high-low range, 0 to 100. %D is a smoothed %K.","%K crossing %D below 20 or above 80."],
  srsi:["Stochastic worked out on RSI instead of price, 0 to 100. Very fast.","Same levels as Stochastic; many signals, so it's best with a filter."],
  macd:["Line: the 12 EMA minus the 26 EMA. Signal: a 9 EMA of the line. Histogram: the gap between them.","The line crossing its signal, or crossing 0."],
  ppo:["MACD as a percentage of the slow EMA.","Comparable across years even though gold's price level changed a lot."],
  cci:["How far the typical price is from its average, in units of average deviation.","Above +100 is strong, below −100 weak; crossing back is a reversal signal."],
  willr:["Williams %R, −100 to 0: the close measured against the recent high.","Below −80 is oversold, above −20 overbought."],
  cmo:["Chande momentum oscillator, −100 to +100: up moves against down moves.","Above +50 is strong, below −50 weak."],
  roc:["Percentage change from N candles ago.","Crossing 0 marks momentum turning."],
  mom:["Price change from N candles ago, in pips.","Crossing 0 marks momentum turning."],
  trix:["The one-candle percentage change of a triple-smoothed EMA.","Crossing 0; the smoothing filters out small swings."],
  ultosc:["Ultimate oscillator, 0 to 100: buying pressure over three windows, combined.","Below 30 is oversold, above 70 overbought."],
  bop:["Balance of power, −1 to +1: the close against the open, relative to the candle's range.","Positive means buyers controlled the candle."],
  dmi:["ADX measures how strong a trend is (0 to 100) but not its direction. +DI and −DI measure upward and downward movement.","+DI crossing above −DI while ADX is above 25 is a trend entry."],
  aroon:["Aroon up and down, 0 to 100: how recently the N-candle high and low were made.","Up crossing above down signals a new uptrend."],
  aroonosc:["Aroon up minus Aroon down, −100 to +100.","Above 0 leans up, below 0 leans down."],
  atr:["Average true range: the average candle range including gaps, in pips.","As a filter, for example only trade when ATR is above a level."],
  natr:["ATR as a percentage of price.","Compares volatility fairly across years."],
  stddev:["Standard deviation of the closes over N candles, in pips.","Rising values mean price is getting more volatile."],
  slope:["Slope of the best-fit line through the last N closes, in pips per candle.","Above 0 means price is rising on balance."],
  p_engulf:["A candle whose body completely covers the previous body, in the opposite colour.","Bullish after a down candle, bearish after an up candle."],
  p_harami:["A small body inside the previous long body.","A pause: bullish after a down candle, bearish after an up candle."],
  p_hammer:["Small body at the top, long lower shadow, at or near the previous low.","Buyers pushed back from lower prices; bullish."],
  p_star:["Shooting star: small body at the bottom, long upper shadow, opening above the previous candle.","Sellers pushed back from higher prices; bearish."],
  p_morning:["Three candles: a long down candle, a small one below it, then an up candle closing well into the first.","Bullish reversal."],
  p_evening:["Three candles: a long up candle, a small one above it, then a down candle closing well into the first.","Bearish reversal."],
  p_soldiers:["Three rising up candles, each opening inside the last body and closing near its high.","Strong buying."],
  p_crows:["Three falling down candles after an up candle, each closing near its low.","Strong selling."],
  p_piercing:["An up candle that opens below the previous low and closes above the middle of the previous down body.","Bullish reversal."],
  p_dark:["A down candle that opens above the previous high and closes below the middle of the previous up body.","Bearish reversal."],
  p_doji:["Open and close almost equal.","Indecision; it has no direction by itself."]}},
th:{
 use:"วิธีใช้",ops:"ตัดขึ้นเหนือ หมายถึงแท่งก่อนหน้าอยู่ต่ำกว่าหรือเท่ากัน และแท่งนี้อยู่เหนือ ส่วนอยู่เหนือ หมายถึงแท่งนี้อยู่เหนือ ไม่ว่าก่อนหน้าจะเป็นอย่างไร",
 f:{tf:["ขนาดแท่งเทียนที่กฎใช้อ่าน สัญญาณจะถูกตรวจทุกครั้งที่แท่งแบบนี้ปิด","แท่งสั้นได้ไม้เยอะและสัญญาณหลอกเยอะ แท่งยาวได้สัญญาณน้อยและช้ากว่า Stop และเป้ากำไรยังตรวจทุกนาทีเหมือนเดิม","1 ชั่วโมง: สัญญาณเกิดได้เฉพาะตอนต้นชั่วโมง"],
  dir:["ให้การทดสอบเปิดไม้ซื้อ ขาย หรือทั้งสองฝั่ง","ทองขึ้นแรงเกือบตลอดช่วงปีเหล่านี้ กฎที่ซื้ออย่างเดียวจึงอาจดูดีเพราะเทรนด์ล้วนๆ ให้เทียบกับการขยับของราคาทองในผลลัพธ์","ซื้ออย่างเดียว: สัญญาณขายถูกละไว้ทั้งหมด"],
  preset:["โหลดกฎสำเร็จรูปลงในเงื่อนไขด้านล่าง","เป็นจุดเริ่มต้นที่รวดเร็ว จะแทนที่เงื่อนไขซื้อและขายเดิม แล้วแก้ต่อได้","RSI ออกจาก 30 / 70: ซื้อเมื่อ RSI(14) ตัดขึ้นเหนือ 30"],
  rmode:["วิธีสร้างสัญญาณขาย","กลับด้านจะพลิกทุกเงื่อนไขของฝั่งซื้อ ขาขึ้นและขาลงจึงถูกปฏิบัติเหมือนกัน ตั้งเงื่อนไขเองใช้เมื่ออยากให้ฝั่งขายมีกฎต่างออกไป","ซื้อเมื่อ RSI ตัดขึ้นเหนือ 30 แบบกลับด้านจะขายเมื่อ RSI ตัดลงใต้ 70"],
  stop:["ระยะของ Stop loss จากจุดเข้า","ระยะคงที่เท่าเดิมทั้งตลาดเงียบและตลาดแรง ส่วนแบบเท่าของ ATR จะกว้างขึ้นเมื่อทองผันผวน ถ้าไม่ตั้ง Stop ไม้จะปิดเฉพาะที่เป้ากำไร สัญญาณตรงข้าม หรือครบเวลา","ATR 2 เท่า ขณะ ATR เท่ากับ 80 pips: Stop อยู่ห่าง 160 pips"],
  stopV_pips:["ระยะ Stop จากจุดเข้าเป็น pips (1 pip = $0.10)","ถ้าเสี่ยงเป็น % ของทุน ค่านี้กำหนดขนาดล็อตด้วย Stop กว้างขึ้นล็อตก็เล็กลง","100 pips = ราคาทองขยับ $10"],
  stopV_atr:["ระยะ Stop เป็นจำนวนเท่าของ ATR วัดที่แท่งสัญญาณ","ปรับตามความผันผวน กว้างเมื่อทองวิ่งแรง แคบเมื่อทองเงียบ","2 × ATR(14)"],
  tgt:["ตำแหน่งเป้ากำไร (ถ้ามี)","แบบเท่าของ Stop (R) รักษาอัตราส่วนกำไรต่อความเสี่ยงให้คงที่ ถ้าไม่ตั้ง ไม้จะปิดที่ Stop สัญญาณตรงข้าม หรือครบเวลา","R 2 เท่ากับ Stop 100 pips: เป้าอยู่ห่าง 200 pips"],
  tgtV_pips:["ระยะเป้ากำไรจากจุดเข้าเป็น pips","ได้ราคาตรงเป้าพอดี ไม่เคยดีกว่า","200 pips = ราคาทองขยับ $20"],
  tgtV_atr:["ระยะเป้ากำไรเป็นจำนวนเท่าของ ATR ที่แท่งสัญญาณ","เป้ากว้างเมื่อตลาดแรง แคบเมื่อตลาดเงียบ","4 × ATR(14)"],
  tgtV_r:["ระยะเป้ากำไรเป็นจำนวนเท่าของระยะ Stop","2 หมายถึงไม้ที่ชนะได้ประมาณสองเท่าของไม้ที่แพ้ ก่อนหักต้นทุน","Stop 100 pips และ R 2: เป้า 200 pips"],
  opp:["สิ่งที่เกิดกับไม้ที่เปิดอยู่เมื่อเกิดสัญญาณตรงข้าม","กลับฝั่งจะปิดไม้แล้วเปิดฝั่งตรงข้ามที่ราคาเปิดของนาทีถัดไป ไม่สนใจจะปล่อยให้ไม้ปิดเองที่ Stop เป้ากำไร หรือครบเวลา","มีไม้ซื้อเปิดอยู่แล้วเกิดสัญญาณขาย: กลับฝั่งจะปิดไม้ซื้อและเปิดไม้ขาย"],
  maxBars:["ปิดไม้เมื่อครบจำนวนแท่งของไทม์เฟรมที่เลือก ถ้ายังไม่มีอะไรปิดก่อน","เหมาะกับกฎที่ควรได้ผลเร็ว ใส่ 0 เพื่อปิดการทำงาน","24 บนแท่ง 1 ชั่วโมง: ปิดเมื่อผ่านไปราวหนึ่งวัน"],
  atrN:["จำนวนแท่งที่ ATR ใช้หาค่าเฉลี่ย สำหรับ Stop และเป้ากำไรแบบ ATR","สั้นจะตอบสนองต่อความผันผวนที่เปลี่ยนเร็วกว่า ยาวจะนิ่งกว่า","ค่าปกติคือ 14"],
  bal:["ทุนตอนเริ่ม Backtest","ผลเป็นเงินและขนาดไม้คำนวณจากค่านี้ Forward test ใช้ทุนต่อจากตอนจบ Backtest","10,000"],
  size:["วิธีเลือกขนาดล็อตของแต่ละไม้","เสี่ยงเป็น % ทำให้ทุกไม้ที่โดน Stop เสียเป็นสัดส่วนเท่ากันของทุน และทบต้น ล็อตคงที่ใช้ขนาดเดิมทุกไม้","1% ของ 10,000 กับ Stop 100 pips: 0.10 ล็อต"],
  risk:["สัดส่วนของทุนปัจจุบันที่เสียถ้าโดน Stop ก่อนหักต้นทุน","กำหนดขนาดล็อตร่วมกับระยะ Stop ปัดลงเป็น 0.01 ล็อต","1%"],
  lots:["ขนาดเท่ากันทุกไม้","ผลเป็นเงินเปลี่ยนตามค่านี้โดยตรง","0.10 ล็อต: $1 ต่อ pip"],
  spread:["ส่วนต่างราคาซื้อและขายเป็น pips คิดครั้งเดียวต่อไม้","ไทม์เฟรมสั้นเทรดบ่อย สเปรดจึงมีผลมากกว่า","3 pips = $0.30 สเปรดทองที่พบบ่อย"],
  comm:["คอมมิชชั่นของโบรกเกอร์ต่อ 1.0 ล็อต รวมเปิดและปิด","คิดทุกไม้ตามขนาดล็อต","$7 ต่อล็อต"],
  btLen:["จำนวนเดือนของ Backtest","ช่วงนี้คือช่วงที่คุณจูนค่า ยิ่งยาวยิ่งครอบคลุมสภาพตลาดหลายแบบ","12 เดือน"],
  fwLen:["จำนวนเดือนของ Forward test ที่ต่อจาก Backtest ทันที","ต้องยาวอย่างน้อยหนึ่งในสี่ของ Backtest เพื่อไม่ให้ช่วงโชคดีสั้นๆ กลายเป็นหลักฐาน","6 เดือน ต่อจาก Backtest 12 เดือน"],
  start:["เดือนที่ Backtest เริ่ม","แสดงเฉพาะวันเริ่มที่ทั้งสองช่วงอยู่ในข้อมูล ถ้าอยากได้การทดสอบที่ซื่อตรง ให้เลือกเดือน Forward ที่ยังไม่เคยดู","มิ.ย. 2025: Backtest มิ.ย. 2025 ถึง พ.ค. 2026 และ Forward test ตั้งแต่ มิ.ย. 2026"]},
 ind:{price:["ราคาปิด เปิด สูงสุด หรือต่ำสุดของแท่ง","ใช้เทียบราคากับเส้นค่าเฉลี่ยหรือกรอบ เช่น ราคาปิดตัดขึ้นเหนือ EMA(50)"],
  sma:["ค่าเฉลี่ยของราคาปิด N แท่งล่าสุด ทุกแท่งมีน้ำหนักเท่ากัน","ราคาอยู่เหนือเส้นบ่งบอกขาขึ้น SMA สองเส้นตัดกันเป็นสัญญาณเทรนด์แบบคลาสสิก"],
  ema:["ค่าเฉลี่ยที่ให้น้ำหนักแท่งล่าสุดมากกว่า จึงหักหัวเร็วกว่า SMA","นิยมใช้กรองเทรนด์ (EMA 200) และใช้ตัดกัน (EMA 20 กับ 50)"],
  wma:["ค่าเฉลี่ยที่น้ำหนักเพิ่มขึ้นเป็นเส้นตรง แท่งล่าสุดมีน้ำหนักมากที่สุด","ความเร็วอยู่ระหว่าง SMA กับ EMA"],
  dema:["Double EMA: ลดความหน่วงของ EMA ลงส่วนหนึ่ง","ตัดกันเร็วขึ้น แต่สัญญาณหลอกก็มากขึ้น"],
  tema:["Triple EMA: ลดความหน่วงได้มากกว่าอีก","เร็วมาก ใช้คู่กับตัวกรองเทรนด์จะดีที่สุด"],
  trima:["ค่าเฉลี่ยของค่าเฉลี่ย น้ำหนักสูงสุดอยู่กลางช่วง จึงเรียบมาก","ช้า เหมาะใช้ดูทิศทางหลัก"],
  kama:["ค่าเฉลี่ยปรับตัวของ Kaufman เร็วเมื่อราคาวิ่งเป็นเทรนด์ชัด เกือบนิ่งเมื่อราคาสวิงไปมา","ตัดกันหลอกในตลาดไซด์เวย์น้อยกว่า EMA ธรรมดา"],
  hma:["Hull moving average: เรียบและเร็ว สร้างจากค่าเฉลี่ยถ่วงน้ำหนัก","หักหัวเร็ว ใช้ตัดกับราคา"],
  linreg:["จุดปลายของเส้นตรงที่เข้ากับราคาปิด N แท่งล่าสุดได้ดีที่สุด","ทำงานเหมือนค่าเฉลี่ยที่หน่วงน้อย"],
  sar:["Parabolic SAR: จุดที่ตามหลังราคาและไล่เข้ามาเร็วขึ้นเมื่อเทรนด์วิ่งต่อ แล้วสลับฝั่งเมื่อราคาตัดผ่าน","ราคาปิดตัดขึ้นเหนือ SAR ใช้เป็นจุดเข้าเมื่อเทรนด์เปลี่ยน และใช้เป็น Trailing stop ได้"],
  bb:["เส้นกลาง SMA กับกรอบบนและล่างห่างออกไปตามจำนวนส่วนเบี่ยงเบนมาตรฐาน","ปิดกลับเหนือกรอบล่างใช้เล่นกลับตัว ปิดเหนือกรอบบนใช้เล่น Breakout"],
  don:["จุดสูงสุดและต่ำสุดของ N แท่งก่อนหน้า ไม่รวมแท่งปัจจุบัน","ราคาปิดตัดขึ้นเหนือเส้นบนเป็นจุดเข้า Breakout แบบคลาสสิก"],
  kc:["EMA กับกรอบบนและล่างห่างออกไปเป็นจำนวนเท่าของ ATR","คล้าย Bollinger Bands แต่นิ่งกว่า ใช้เล่น Breakout และย่อตัว"],
  rsi:["Relative Strength Index 0 ถึง 100: เทียบกำไรเฉลี่ยกับขาดทุนเฉลี่ย (Wilder smoothing)","ต่ำกว่า 30 เรียกว่า Oversold สูงกว่า 70 เรียกว่า Overbought การตัดกลับออกมาเป็นสัญญาณกลับตัว"],
  stoch:["ตำแหน่งของราคาปิดในกรอบสูงต่ำล่าสุด 0 ถึง 100 ส่วน %D คือ %K ที่ทำให้เรียบ","%K ตัด %D ใต้ 20 หรือเหนือ 80"],
  srsi:["Stochastic ที่คำนวณจาก RSI แทนราคา 0 ถึง 100 เร็วมาก","ใช้ระดับเดียวกับ Stochastic สัญญาณเยอะ จึงควรมีตัวกรอง"],
  macd:["เส้น: EMA 12 ลบ EMA 26 เส้น Signal: EMA 9 ของเส้น ฮิสโตแกรม: ระยะห่างระหว่างสองเส้น","เส้นตัดเส้น Signal หรือเส้นตัด 0"],
  ppo:["MACD ในรูปเปอร์เซ็นต์ของ EMA เส้นช้า","เทียบข้ามปีได้แม้ระดับราคาทองเปลี่ยนไปมาก"],
  cci:["ราคาเฉลี่ยของแท่งห่างจากค่าเฉลี่ยแค่ไหน วัดเป็นหน่วยของส่วนเบี่ยงเบนเฉลี่ย","เหนือ +100 แข็งแรง ใต้ −100 อ่อนแอ การตัดกลับเป็นสัญญาณกลับตัว"],
  willr:["Williams %R −100 ถึง 0: ราคาปิดเทียบกับจุดสูงสุดล่าสุด","ใต้ −80 คือ Oversold เหนือ −20 คือ Overbought"],
  cmo:["Chande momentum oscillator −100 ถึง +100: แรงขึ้นเทียบกับแรงลง","เหนือ +50 แข็งแรง ใต้ −50 อ่อนแอ"],
  roc:["เปอร์เซ็นต์การเปลี่ยนแปลงจาก N แท่งก่อน","ตัด 0 บ่งบอกว่าโมเมนตัมเปลี่ยนทิศ"],
  mom:["ราคาเปลี่ยนไปเท่าไรจาก N แท่งก่อน เป็น pips","ตัด 0 บ่งบอกว่าโมเมนตัมเปลี่ยนทิศ"],
  trix:["เปอร์เซ็นต์การเปลี่ยนแปลงต่อแท่งของ EMA ที่ทำให้เรียบสามชั้น","ใช้การตัด 0 การทำให้เรียบช่วยกรองการแกว่งเล็กๆ"],
  ultosc:["Ultimate oscillator 0 ถึง 100: แรงซื้อจากสามช่วงเวลารวมกัน","ใต้ 30 คือ Oversold เหนือ 70 คือ Overbought"],
  bop:["Balance of power −1 ถึง +1: ราคาปิดเทียบราคาเปิด หารด้วยช่วงของแท่ง","ค่าบวกหมายถึงฝั่งซื้อคุมแท่งนั้น"],
  dmi:["ADX วัดความแรงของเทรนด์ (0 ถึง 100) แต่ไม่บอกทิศ ส่วน +DI และ −DI วัดแรงขึ้นและแรงลง","+DI ตัดขึ้นเหนือ −DI ขณะ ADX เหนือ 25 เป็นจุดเข้าตามเทรนด์"],
  aroon:["Aroon up และ down 0 ถึง 100: จุดสูงสุดและต่ำสุดของ N แท่งเกิดขึ้นเมื่อไม่นานแค่ไหน","Up ตัดขึ้นเหนือ down บ่งบอกขาขึ้นใหม่"],
  aroonosc:["Aroon up ลบ Aroon down −100 ถึง +100","เหนือ 0 เอียงขึ้น ใต้ 0 เอียงลง"],
  atr:["Average true range: ช่วงเฉลี่ยของแท่งรวมช่องว่างราคา เป็น pips","ใช้เป็นตัวกรอง เช่น เทรดเฉพาะตอน ATR สูงกว่าระดับหนึ่ง"],
  natr:["ATR ในรูปเปอร์เซ็นต์ของราคา","เทียบความผันผวนข้ามปีได้อย่างยุติธรรม"],
  stddev:["ส่วนเบี่ยงเบนมาตรฐานของราคาปิด N แท่ง เป็น pips","ค่าสูงขึ้นแปลว่าราคาผันผวนมากขึ้น"],
  slope:["ความชันของเส้นตรงที่เข้ากับราคาปิด N แท่งล่าสุด เป็น pips ต่อแท่ง","มากกว่า 0 แปลว่าโดยรวมราคากำลังขึ้น"],
  p_engulf:["แท่งที่ตัวแท่งกลืนตัวแท่งก่อนหน้าทั้งหมด และสีตรงข้ามกัน","ขาขึ้นเมื่อเกิดหลังแท่งลง ขาลงเมื่อเกิดหลังแท่งขึ้น"],
  p_harami:["ตัวแท่งเล็กอยู่ภายในตัวแท่งยาวก่อนหน้า","จังหวะพัก ขาขึ้นหลังแท่งลง ขาลงหลังแท่งขึ้น"],
  p_hammer:["ตัวแท่งเล็กอยู่ด้านบน ไส้ล่างยาว เกิดที่หรือใกล้จุดต่ำของแท่งก่อน","ฝั่งซื้อดันราคากลับจากระดับต่ำ เป็นสัญญาณขาขึ้น"],
  p_star:["Shooting star: ตัวแท่งเล็กอยู่ด้านล่าง ไส้บนยาว เปิดเหนือแท่งก่อนหน้า","ฝั่งขายดันราคากลับจากระดับสูง เป็นสัญญาณขาลง"],
  p_morning:["สามแท่ง: แท่งลงยาว แท่งเล็กอยู่ต่ำกว่า แล้วแท่งขึ้นปิดลึกเข้าไปในแท่งแรก","สัญญาณกลับตัวขาขึ้น"],
  p_evening:["สามแท่ง: แท่งขึ้นยาว แท่งเล็กอยู่สูงกว่า แล้วแท่งลงปิดลึกเข้าไปในแท่งแรก","สัญญาณกลับตัวขาลง"],
  p_soldiers:["แท่งขึ้นสามแท่งเรียงสูงขึ้น แต่ละแท่งเปิดในตัวแท่งก่อนหน้าและปิดใกล้จุดสูงสุด","แรงซื้อแข็งแรง"],
  p_crows:["แท่งลงสามแท่งเรียงต่ำลงหลังแท่งขึ้น แต่ละแท่งปิดใกล้จุดต่ำสุด","แรงขายแข็งแรง"],
  p_piercing:["แท่งขึ้นที่เปิดต่ำกว่าจุดต่ำก่อนหน้า และปิดเหนือกึ่งกลางของแท่งลงก่อนหน้า","สัญญาณกลับตัวขาขึ้น"],
  p_dark:["แท่งลงที่เปิดสูงกว่าจุดสูงก่อนหน้า และปิดใต้กึ่งกลางของแท่งขึ้นก่อนหน้า","สัญญาณกลับตัวขาลง"],
  p_doji:["ราคาเปิดกับปิดแทบเท่ากัน","ตลาดลังเล ไม่มีทิศทางในตัวเอง"]}}};
const ltx=()=>LT[LANG]||LT.en;
/* the explanation for one row: a setting, or the indicators in a condition */
function tip(row){
  const k=row.dataset.tip.slice(4),L=ltx();
  if(k==='cond'){const box=row,side=box.dataset.side,c=C.rule[side]&&C.rule[side][+box.dataset.k];if(!c)return'';
    const block=x=>{const r=IR.byId[x.id],d=L.ind[x.id]||LT.en.ind[x.id];return`<p class="tth">${esc(r.full||r.name)}</p><p>${esc(d[0])}</p><p><b>${esc(L.use)}</b> ${esc(d[1])}</p>`;};
    let h=block(c.a);if(c.b&&c.b.id&&c.b.id!==c.a.id&&c.b.id!=='price')h+=block(c.b);
    if(IR.byId[c.a.id].kind!=='pat')h+=`<p class="tex">${esc(L.ops)}</p>`;return h;}
  let key=k.replace(/^f:/,'');if(key==='stopV')key='stopV_'+C.stop;if(key==='tgtV')key='tgtV_'+C.tgt;
  const d=L.f[key]||LT.en.f[key];if(!d)return'';const lab=row.querySelector('label,span');
  return`<p class="tth">${esc(lab?lab.textContent.trim():'')}</p><p>${esc(d[0])}</p><p><b>${esc(t('tip_why'))}</b> ${esc(d[1])}</p><p class="tex"><b>${esc(t('tip_ex'))}</b> ${esc(d[2])}</p>`;}

/* ---------- the rule builder ---------- */
const PL=k=>(LANG==='th'&&tl('PL')[k])||k;
const GROUPS=['price','avg','band','osc','trend','vol','pat'];
const PAIR={macd:1,stoch:1,srsi:1,aroon:1};
const defP=r=>{const o={};r.ps.forEach(p=>{o[p[0]]=p[2];});return o;};
const outName=(r,o)=>{const x=r.outs.find(z=>z[0]===o);return x?PL(x[1]):'';};
const nfmt=v=>(+v).toLocaleString('en-US',{maximumFractionDigits:4});
function xName(x){if(x.num!==undefined)return nfmt(x.num);const r=IR.byId[x.id];if(r.id==='price')return outName(r,x.o);
  const ps=r.ps.map(p=>nfmt(x.p[p[0]])).join(', ');if(r.byOut)return outName(r,x.o)+(ps?'('+ps+')':'');return r.name+(ps?'('+ps+')':'')+(r.outs.length>1?' '+outName(r,x.o):'');}
function cText(c){const r=IR.byId[c.a.id];if(r.kind==='pat')return t('d_'+c.op,{x:r.name});return xName(c.a)+' '+t('op_'+c.op)+' '+xName(c.b);}
const indOpts=(cur,pats)=>GROUPS.filter(g=>pats||g!=='pat').map(g=>`<optgroup label="${esc(t('g_'+g))}">`+IR.REG.filter(r=>r.g===g).map(r=>opt(r.id,cur,r.full&&r.full!==r.name?r.name+' – '+r.full:r.name)).join('')+'</optgroup>').join('');
/* a new left-hand side picks sensible partners: averages and bands are compared with the close, paired oscillators with their own second line */
function newCond(id){const r=IR.byId[id];
  if(r.kind==='pat')return{a:X(id,{},'v'),op:r.dirs[0]};
  if(r.kind==='price'&&id!=='price'){const o=r.outs.some(z=>z[0]==='lo')?'lo':r.outs[0][0];return{a:CL(),op:'xa',b:X(id,defP(r),o)};}
  if(id==='price')return{a:CL(),op:'xa',b:X('ema',{n:50})};
  const p=defP(r);if(PAIR[id])return{a:X(id,p,r.outs[0][0]),op:'xa',b:X(id,clone(p),r.outs[1][0])};
  return{a:X(id,p,r.outs[0][0]),op:r.id==='dmi'?'gt':'xa',b:N(r.lv)};}
function xParams(side,k,w,x,hide){const r=IR.byId[x.id],id=f=>`lc-${side}-${k}-${w}-${f}`;let h='';
  if(!hide&&r.ps.length)h+=`<div class="cps">`+r.ps.map(p=>`<label for="${id('p-'+p[0])}">${esc(PL(p[1]))}<input id="${id('p-'+p[0])}" class="txt${bad[id('p-'+p[0])]?' bad':''}" type="number" inputmode="decimal" step="${p[5]?1:'any'}" min="${p[3]}" max="${p[4]}" data-min="${p[3]}" data-max="${p[4]}" data-whole="${p[5]}" value="${x.p[p[0]]}" data-c="${w}.p.${p[0]}"></label>`).join('')+`</div>`+
    r.ps.map(p=>`<p class="ferr" id="le-${id('p-'+p[0])}"${bad[id('p-'+p[0])]?'':' hidden'}>${esc(bad[id('p-'+p[0])]||'')}</p>`).join('');
  if(r.outs.length>1)h+=`<select id="${id('o')}" class="txt" data-c="${w}.o" aria-label="${esc(t('r_out'))}">${r.outs.map(o=>opt(o[0],x.o,PL(o[1]))).join('')}</select>`;
  return h;}
function condHTML(side,k,c){
  const r=IR.byId[c.a.id],id=f=>`lc-${side}-${k}-${f}`;
  let h=`<div class="cond" data-tip="lab:cond" data-side="${side}" data-k="${k}"><div class="crow"><select id="${id('a-id')}" class="txt" data-c="a.id" aria-label="${esc(t('r_buy'))} ${k+1}">${indOpts(c.a.id,true)}</select>`+
    `<button type="button" class="cdel" data-cdel="1" aria-label="${esc(t('r_del'))}" title="${esc(t('r_del'))}">×</button></div>`+xParams(side,k,'a',c.a);
  const ops=r.kind==='pat'?r.dirs:['xa','xb','gt','lt'];
  h+=`<select id="${id('op')}" class="txt" data-c="op">${ops.map(o=>opt(o,c.op,t('op_'+o))).join('')}</select>`;
  if(r.kind!=='pat'){const num=c.b.num!==undefined;
    h+=`<select id="${id('b-t')}" class="txt" data-c="b.t">${opt('num',num?'num':'',t('r_num'))}${indOpts(num?'':c.b.id,false)}</select>`;
    if(num)h+=`<div class="cps"><label for="${id('b-num')}">${esc(t('r_value'))}<input id="${id('b-num')}" class="txt${bad[id('b-num')]?' bad':''}" type="number" inputmode="decimal" step="any" value="${c.b.num}" data-c="b.num" data-min="-1e12" data-max="1e12"></label></div>`;
    else h+=xParams(side,k,'b',c.b,c.b.id===c.a.id);}
  return h+`</div>`;}
function entryCard(){const R=C.rule,sellC=IR.sellOf(R),list=(side,cs)=>cs.map((c,k)=>condHTML(side,k,c)).join('')+(cs.length?'':`<p class="small muted" style="margin:.3rem 0">${esc(t('r_none'))}</p>`)+
    (cs.length<4?`<button type="button" class="btn alt cadd" data-cadd="${side}">+ ${esc(t('r_add'))}</button>`:`<p class="small muted" style="margin:.3rem 0">${esc(t('r_max'))}</p>`);
  const sum=cs=>cs.length?cs.map(cText).join(t('r_and')):'–';
  return`<div class="card"><h3>${esc(t('lp_entry'))}</h3>`+
    `<div class="formrow" data-tip="lab:f:preset"><label for="lb-preset">${esc(t('l_preset'))}</label><select id="lb-preset" class="txt">${opt('','',t('pre_pick'))}${Object.keys(PRESETS).map(k=>opt(k,'',t('pre_'+k))).join('')}</select></div>`+
    `<p class="rlab">${esc(t('r_buy'))}</p>`+list('buy',R.buy)+
    sel('lb-rmode','r_mode',R.mode,[['mirror','r_mirror'],['own','r_own']])+(R.mode==='own'?`<p class="rlab">${esc(t('r_sell'))}</p>`+list('sell',R.sell):'')+
    `<div class="rsum small"><p>${esc(t('r_sum_buy',{x:sum(R.buy)}))}</p><p>${esc(t('r_sum_sell',{x:sum(sellC)}))}</p></div><p class="small muted" style="margin:0">${esc(t('r_hint'))}</p></div>`;}
function condEvent(el,kind){
  const box=el.closest('.cond');if(!box)return false;const side=box.dataset.side,k=+box.dataset.k,list=C.rule[side],c=list[k],f=el.dataset.c;
  if(kind==='change'){
    if(f==='a.id')list[k]=newCond(el.value);
    else if(f==='op')c.op=el.value;
    else if(f==='a.o')c.a.o=el.value;
    else if(f==='b.o')c.b.o=el.value;
    else if(f==='b.t'){if(el.value==='num'){const r=IR.byId[c.a.id];c.b=N(typeof r.lv==='number'?r.lv:0);}else{const r=IR.byId[el.value];c.b=X(el.value,el.value===c.a.id?clone(c.a.p):defP(r),r.outs[el.value===c.a.id&&r.outs.length>1?1:0][0]);}}
    else return false;
    Object.keys(bad).filter(x=>x.startsWith('lc-')).forEach(x=>delete bad[x]);save();clampStart();drawAside();drawMain();return true;}
  /* number typed into an indicator setting or a level */
  const v=parseFloat(el.value),min=+el.dataset.min,max=+el.dataset.max,ok=el.value.trim()!==''&&isFinite(v)&&v>=min&&v<=max,msg=t('e_field',{min:nfmt(min),max:nfmt(max)});
  if(ok){if(f==='b.num')c.b.num=v;else{const[w,,key]=f.split('.'),val=el.dataset.whole==='1'?Math.round(v):v;c[w].p[key]=val;if(w==='a'&&c.b&&c.b.id===c.a.id)c.b.p=clone(c.a.p);}}
  if(ok)delete bad[el.id];else bad[el.id]=msg;el.classList.toggle('bad',!ok);el.setAttribute('aria-invalid',String(!ok));const p=$('le-'+el.id);if(p){p.hidden=ok;p.textContent=ok?'':msg;}
  if(ok){save();clampStart();const rs=document.querySelector('#lab-aside .rsum');if(rs){const tpl=document.createElement('template');tpl.innerHTML=entryCard();rs.replaceWith(tpl.content.querySelector('.rsum'));}}
  drawMain();return true;}
function aside(){
  let h=`<div class="card"><h3>${esc(t('lp_chart'))}</h3>`+sel('lb-tf','l_tf',C.tf,[[1,'tf_1'],[5,'tf_5'],[15,'tf_15'],[60,'tf_60'],[240,'tf_240'],[1440,'tf_1440']])+
    sel('lb-dir','l_dir',C.dir,[['both','dir_both'],['long','dir_long'],['short','dir_short']])+`</div>`;
  h+=entryCard();
  h+=`<div class="card"><h3>${esc(t('lp_exit'))}</h3>`+sel('lb-stop','l_stop',C.stop,[['pips','stop_pips'],['atr','stop_atr'],['none','stop_none']]);
  if(C.stop!=='none')h+=C.stop==='pips'?fld('lb-stopV','l_stopv_p',C.stopV.pips,1,100000,1):fld('lb-stopV','l_stopv_a',C.stopV.atr,0.1,50,0.1);
  h+=sel('lb-tgt','l_tgt',C.tgt,[['none','tgt_none'],['pips','tgt_pips'],['atr','tgt_atr']].concat(C.stop==='none'?[]:[['r','tgt_r']]));
  if(C.tgt!=='none')h+=C.tgt==='pips'?fld('lb-tgtV','l_tgtv_p',C.tgtV.pips,1,100000,1):C.tgt==='atr'?fld('lb-tgtV','l_tgtv_a',C.tgtV.atr,0.1,100,0.1):fld('lb-tgtV','l_tgtv_r',C.tgtV.r,0.1,50,0.1);
  h+=sel('lb-opp','l_opp',C.opp,[['yes','opp_yes'],['no','opp_no']])+fld('lb-maxBars','l_maxb',C.maxBars,0,10000,1);
  if(C.stop==='atr'||C.tgt==='atr')h+=fld('lb-atrN','l_atrn',C.atrN,2,200,1);
  h+=`<p class="small muted" style="margin:0">${esc(t('exit_hint'))}</p></div>`;
  h+=`<div class="card"><h3>${esc(t('lp_money'))}</h3>`+fld('lb-bal','l_bal',C.bal,100,1e9,'any')+sel('lb-size','l_size',C.size,[['risk','size_risk'],['lots','size_lots']])+
    (C.size==='risk'?fld('lb-risk','l_risk',C.risk,0.01,100,0.1):fld('lb-lots','l_lots',C.lots,0.01,1000,0.01))+fld('lb-spread','l_spread',C.spread,0,1000,'any')+fld('lb-comm','l_comm',C.comm,0,1000,'any');
  if(C.size==='risk'&&C.stop==='none')h+=`<p class="errnote" style="margin:.4rem 0">${esc(t('e_nostop'))}</p>`;
  h+=`<p class="small muted" style="margin:0">${esc(t('money_hint'))}</p></div>`;
  return h;}
/* where each input writes its value */
const SET={'lb-tf':v=>{C.tf=+v;},'lb-dir':v=>{C.dir=v;},'lb-preset':v=>{if(PRESETS[v])C.rule=preset(v);},'lb-rmode':v=>{if(v==='own'&&C.rule.mode!=='own')C.rule.sell=clone(IR.sellOf(C.rule));C.rule.mode=v;},
  'lb-stop':v=>{C.stop=v;if(v==='none'&&C.tgt==='r')C.tgt='pips';},'lb-tgt':v=>{C.tgt=v;},'lb-opp':v=>{C.opp=v;},'lb-size':v=>{C.size=v;}};
const NUM={'lb-maxBars':['maxBars',1],'lb-atrN':['atrN',1],'lb-bal':['bal'],'lb-risk':['risk'],'lb-lots':['lots'],'lb-spread':['spread'],'lb-comm':['comm']};
function numInput(el){
  const id=el.id,v=parseFloat(el.value),min=+el.dataset.min,max=+el.dataset.max;let ok=el.value.trim()!==''&&isFinite(v)&&v>=min&&v<=max,msg=t('e_field',{min:min.toLocaleString('en-US'),max:max.toLocaleString('en-US')});
  if(ok){
    if(id==='lb-stopV')C.stopV[C.stop]=v;else if(id==='lb-tgtV')C.tgtV[C.tgt]=v;
    else if(NUM[id]){const[k,w]=NUM[id];C[k]=w?Math.round(v):v;}}
  if(ok)delete bad[id];else bad[id]=msg;
  el.classList.toggle('bad',!ok);el.setAttribute('aria-invalid',String(!ok));const p=$('le-'+id);if(p){p.hidden=ok;p.textContent=ok?'':msg;}
  if(ok){save();clampStart();}drawMain();}
function drawAside(){const a=$('lab-aside');if(!a)return;const f=document.activeElement&&document.activeElement.id;a.innerHTML=aside();if(f&&$(f))$(f).focus();}

/* ---------- periods ---------- */
function avail(w){
  const I=R.idx,ms=months(),N=ms.length,W=1000,X=i=>8+i/N*(W-16),y0=+ms[0].slice(0,4),y1=+ms[N-1].slice(0,4);let ticks='';
  for(let y=y0;y<=y1;y++){const i=ms.indexOf(y+'-01');if(i<0)continue;ticks+=`<line x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="16" y2="34" class="tk"/>`+((y-y0)%2===0?`<text x="${X(i).toFixed(1)}" y="50" text-anchor="middle">${y}</text>`:'');}
  const wm=Math.max(0,w.i-warmMonths());
  const r=(a,b,cls)=>`<rect x="${X(a).toFixed(1)}" y="12" width="${Math.max(3,X(b)-X(a)).toFixed(1)}" height="26" rx="2" class="${cls}"/>`;
  const lab=t('per_bt',{a:lmon(ms[w.i]),b:lmon(ms[w.j-1])})+'. '+t('per_fw',{a:lmon(ms[w.j]),b:lmon(ms[w.k-1])})+'.';
  return`<div class="btavail labav"><div class="btav-t"><b>${esc(t('per_avail',{a:lday(I.from),b:lday(I.to)}))}</b></div>
    <svg viewBox="0 0 ${W} 56" role="img" aria-label="${esc(lab)}"><rect x="8" y="18" width="${W-16}" height="14" rx="2" class="all"/>${r(wm,w.i,'warm')}${r(w.i,w.j,'sel')}${r(w.j,w.k,'fw')}${ticks}</svg>
    <p class="labsel"><span class="k bt"></span>${esc(t('per_bt',{a:lmon(ms[w.i]),b:lmon(ms[w.j-1])}))}<span class="k fw"></span>${esc(t('per_fw',{a:lmon(ms[w.j]),b:lmon(ms[w.k-1])}))}</p></div>`;}
function periods(){
  const I=R.idx;
  if(isFile())return`<p class="warnnote" style="margin:0">${esc(t('e_file'))}</p>`;
  if(!canRun())return`<p class="warnnote" style="margin:0">${esc(t('e_nodecomp'))}</p>`;
  if(R.idxErr)return`<p class="errnote" style="margin:0">${esc(t('e_idx',{msg:R.idxErr}))}${window.__fbErr?window.__fbErr('gold-data'):''}</p>`;
  if(!I){loadIdx();return`<p class="small muted" style="margin:0">${esc(t('loading_idx'))}</p>`;}
  clampStart();const w=win(),ms=months(),[lo,hi]=startRange(),sig=sigOf(),wsig=wsigOf();
  const mo=n=>n===1?t('mo_1'):t('mo_n',{n});
  const starts=[];for(let i=hi;i>=lo;i--)starts.push([ms[i],lmon(ms[i])]);
  const btOk=R.bt&&R.bt.sig===sig&&R.bt.wsig===wsig,ss=seenState(),blocked=R.busy||Object.keys(bad).length>0||(C.size==='risk'&&C.stop==='none');
  return avail(w)+`<div class="btctl">
    <label data-tip="lab:f:btLen"><span>${esc(t('l_btlen'))}</span><select class="txt" data-lp="btLen">${BTL.map(v=>opt(v,C.btLen,mo(v))).join('')}</select></label>
    <label data-tip="lab:f:fwLen"><span>${esc(t('l_fwlen'))}</span><select class="txt" data-lp="fwLen">${fwOpts(C.btLen).map(v=>opt(v,C.fwLen,mo(v))).join('')}</select></label>
    <label data-tip="lab:f:start"><span>${esc(t('l_start'))}</span><select class="txt" data-lp="start">${starts.map(s=>opt(s[0],C.start,s[1])).join('')}</select></label></div>
    <p class="small muted" style="margin:.6rem 0 0">${esc(t('per_rule')+' '+t('per_warm',{n:warmMonths()}))}</p>
    <div class="labrun"><button type="button" class="btn${btOk?' alt':''}" data-lrun="bt"${blocked?' disabled':''}>${esc(t(R.bt&&R.bt.wsig===wsig?'rerun_bt':'run_bt'))}</button>
    <button type="button" class="btn${btOk?'':' alt'}" data-lrun="fw"${blocked||!btOk?' disabled':''}>${esc(t('run_fw'))}</button>
    <span class="small muted" id="lab-status" aria-live="polite">${R.busy?esc(R.prog):!btOk&&!R.busy?esc(t('fw_need')):''}</span></div>
    ${ss==='seen'?`<p class="warnnote" style="margin:.7rem 0 0">${esc(t('lock_seen'))}</p>`:ss==='on'?`<p class="small" style="margin:.7rem 0 0">🔒 ${esc(t('lock_on'))}</p>`:''}
    ${R.err?`<p class="errnote" style="margin:.7rem 0 0">${esc(R.err)}${R.err!==t('e_inputs')&&window.__fbErr?window.__fbErr('gold-run'):''}</p>`:''}`;}

/* ---------- results ---------- */
function stats(s){
  const n=s.n,mon=Math.max(1,(s.t1-s.t0)/43830);
  return{n,w:s.w,wr:n?s.w/n:NaN,pf:s.gl<0?s.gw/-s.gl:s.gw>0?Infinity:NaN,avgW:s.w?s.gw/s.w:NaN,avgL:n-s.w?s.gl/(n-s.w):NaN,exp:n?(s.gw+s.gl)/n:NaN,
    R:s.nR&&s.nR===n?s.R/s.nR:NaN,pips:n?s.pips/n:NaN,net:s.eq1-s.eq0,ret:s.eq0>0?s.eq1/s.eq0-1:NaN,mdd:Math.min(1,s.mdd),mddAt:s.mddAt,streak:s.maxStreak,hold:n?s.hold/n:NaN,
    perMo:n/mon,gold:s.px0>0?s.px1/s.px0-1:NaN,amb:s.amb,gap:s.gap,skip:s.skip,why:s.why,ln:s.ln,lw:s.lw,sn:s.sn,sw:s.sw,t0:s.t0,t1:s.t1,eq0:s.eq0,eq1:s.eq1};}
/* the measure the verdict compares: average R per trade when every trade had a stop, otherwise average pips */
const edge=x=>isFinite(x.R)?x.R:x.pips;
const edgeF=x=>isFinite(x.R)?(x.R<0?MINUS:'+')+Math.abs(x.R).toFixed(2)+'R':(x.pips<0?MINUS:'+')+Math.abs(x.pips).toFixed(1)+' pips';
const pfF=v=>v===Infinity?'∞':isFinite(v)?v.toFixed(2):'–';
function verdict(b,f){
  if(edge(b)<=0||!b.n)return['bad','v_btlose',t('v_btlose_p',{b:b.n?edgeF(b):'–'})];
  if(b.pf<1.1)return['warn','v_thin',t('v_thin_p',{b:edgeF(b),pf:pfF(b.pf),f:f.n?edgeF(f):'–'})];
  if(f.n<10)return['warn','v_few',t('v_few_p',{n:f.n})];
  const e=edge(f),eb=edge(b);
  if(e<=0)return['bad','v_fail',t('v_fail_p',{f:edgeF(f),b:edgeF(b)})];
  if(e>=0.5*eb)return['ok','v_held',t('v_held_p',{f:edgeF(f),b:edgeF(b)})];
  return['warn','v_weak',t('v_weak_p',{f:edgeF(f),b:edgeF(b)})];}
const ICON={ok:'✓',warn:'!',bad:'✕'};
function head(cls,title,text,extra){return`<div class="card"><div class="dverdict"><span class="light" data-v="${cls}" aria-hidden="true">${ICON[cls]}</span><div><h2>${esc(title)}</h2><p class="small" style="margin:0">${esc(text)}</p>${extra||''}</div></div>`;}
function tiles(x){const T=[['',t('t_net'),usdS(x.net),pct(x.ret)],['bad',t('t_dd'),'−'+(x.mdd*100).toFixed(1)+'%',x.mddAt?dfmt(x.mddAt):''],['',t('t_won'),pc0(x.wr),x.n.toLocaleString('en-US')+' trades'],[x.pf>=1?'ok':'bad',t('t_pf'),pfF(x.pf),edgeF(x)+' / trade']];
  return`<div class="gtile">${T.map(v=>`<div class="${v[0]}"><span>${esc(v[1])}</span><b>${esc(v[2])}</b>${v[3]?`<span>${esc(v[3])}</span>`:''}</div>`).join('')}</div>`;}
function cmpTable(cols){
  const H=[''].concat(cols.map(c=>c[0])),X=cols.map(c=>c[1]);
  const row=(name,f)=>[esc(name)].concat(X.map(x=>esc(f(x))));
  return tbl(H,[row('Period',x=>lmon(dfmt(x.t0).slice(0,7))+' – '+lmon(dfmt(x.t1).slice(0,7))),row('Trades',x=>x.n.toLocaleString('en-US')+' ('+x.perMo.toFixed(1)+' a month)'),row('Win rate',x=>pc0(x.wr)),row('Profit factor',x=>pfF(x.pf)),
    row('Average trade',x=>x.n?edgeF(x)+' ('+usdS(x.exp)+')':'–'),row('Average win / loss',x=>usd(x.avgW)+' / '+usd(x.avgL)),row('Net result',x=>usdS(x.net)+' ('+pct(x.ret)+')'),
    row('Deepest fall',x=>'−'+(x.mdd*100).toFixed(1)+'%'+(x.mddAt?' ('+dfmt(x.mddAt)+')':'')),row('Longest losing run',x=>x.streak+' trades'),row('Average time in a trade',x=>x.n?hold(x.hold):'–'),
    row('Buys (won)',x=>x.ln+' ('+x.lw+')'),row('Sells (won)',x=>x.sn+' ('+x.sw+')'),row('Gold\'s own move',x=>pct(x.gold)),
    row('Stop and target in the same minute',x=>String(x.amb)),row('Stops filled past the level (gaps)',x=>String(x.gap))].concat(X.some(x=>x.skip)?[row('Trades skipped (under 0.01 lots)',x=>String(x.skip))]:[]));}
function equity(res,split,bal){
  const d=res.days;if(d.length<2)return'';const cl=d.map(x=>[x[0],x[1]]),lo=d.map(x=>[x[0],Math.max(0,x[2])]);
  const a=split?cl.filter(p=>p[0]<split):cl,bpts=split?cl.filter(p=>p[0]>=split):[];if(bpts.length&&a.length)bpts.unshift(a[a.length-1]);
  const ymax=Math.max(bal*1.05,...cl.map(p=>p[1]))*1.04,ymin=Math.max(0,Math.min(bal*0.95,...lo.map(p=>p[1]))*0.96);
  const series=[{pts:a,color:'var(--accent)',w:2}].concat(bpts.length?[{pts:bpts,color:'var(--c1)',w:2}]:[]);
  return ch(CH.plot({w:860,h:260,m:{l:62,r:14},series,areas:[{upper:cl,lower:lo,color:'var(--bad)',op:0.12}],hlines:[{y:bal,color:'var(--muted)',label:'start'}],vlines:split?[{x:split,color:'var(--c1)'}]:[],
    xlo:d[0][0],xhi:d[d.length-1][0],ylo:ymin,yhi:ymax,xfmt:v=>new Date(v*60000).toISOString().slice(0,7),yfmt:v=>cmp(v),ylabel:'equity',label:'Equity'}))+
    lg([['var(--accent)',t('lg_bt')]].concat(bpts.length?[['var(--c1)',t('lg_fw')]]:[]).concat([['var(--bad)',t('lg_low')]]));}
function monthly(res,bal,split){
  const d=res.days,M=[];let prev=bal,cur=null;
  d.forEach(x=>{const k=new Date(x[0]*60000).toISOString().slice(0,7);if(!cur||cur.k!==k){if(cur){M.push(cur);prev=cur.end;}cur={k,start:prev,end:x[1],t:x[0]};}else cur.end=x[1];});if(cur)M.push(cur);
  if(!M.length)return'';const every=Math.ceil(M.length/14);
  const items=M.map((m,i)=>({label:i%every===0?m.k.slice(2):'',value:m.start>0?(m.end/m.start-1)*100:0,color:m.end>=m.start?'var(--ok)':'var(--bad)',faint:split&&m.t<split}));
  return ch(CH.bars({w:860,h:220,m:{l:56},items,yfmt:v=>Math.round(v)+'%',valFmt:M.length<=18?v=>(v<0?'−':'')+Math.abs(v).toFixed(1):null,ylabel:'month',label:'Monthly results'}));}
function tradeList(res){
  const T=res.trades,n=Math.min(15,T.length);if(!n)return'';const last=T.slice(-n).reverse();
  return tbl(['Opened (UTC)','Side','Entry','Closed (UTC)','Exit','Why','Lots','Pips','Result'],last.map(x=>[esc(dtm(x[0])),x[1]>0?'buy':'sell','$'+x[2].toFixed(2),esc(dtm(x[3])),'$'+x[4].toFixed(2),x[5]+(x[10]?'*':''),x[6].toFixed(2),num(x[7],1),usdS(x[8])]));}
function csv(rec){
  const rows=[['entry_time_utc','side','entry_price','exit_time_utc','exit_price','exit_reason','lots','pips','profit_usd','period','stop_and_target_same_minute']];
  rec.res.trades.forEach(x=>rows.push([dtm(x[0]),x[1]>0?'buy':'sell',x[2].toFixed(2),dtm(x[3]),x[4].toFixed(2),x[5],x[6].toFixed(2),x[7].toFixed(1),x[8].toFixed(2),x[9]?'forward':'backtest',x[10]]));
  const text=rows.map(r=>r.join(',')).join('\n')+'\n',url=URL.createObjectURL(new Blob([text],{type:'text/csv'})),a=document.createElement('a');
  a.href=url;a.download='jarn-neow-gold-'+(rec===R.fw?'forward':'backtest')+'-'+dfmt(rec.w.a)+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500);}
function exits(xs,names){
  const k=['stop','target','signal','time','end'],nm={stop:'Stop loss',target:'Take profit',signal:'Opposite signal',time:'Time limit',end:'Still open at the end'};
  return tbl(['Exit'].concat(names),k.filter(z=>xs.some(x=>x.why[z])).map(z=>[esc(nm[z])].concat(xs.map(x=>x.why[z]+' ('+pc0(x.n?x.why[z]/x.n:0)+')'))));}
function results(){
  const fwOn=R.view==='fw'&&R.fw&&R.fw.wsig===wsigOf(),rec=fwOn?R.fw:R.bt&&R.bt.wsig===wsigOf()?R.bt:null;if(!rec)return'';
  const res=rec.res,sig=sigOf(),stale=rec.sig!==sig,bal=params().bal,ss=res.seg.map(stats);let h='';
  if(stale)h+=`<p class="warnnote" style="margin:0 0 1rem">${esc(t(fwOn?'stale_fw':'stale_bt'))}</p>`;
  if(fwOn&&rec.unfair)h+=`<p class="errnote" style="margin:0 0 1rem">${esc(t('unfair'))}</p>`;
  const b=ss[0],f=ss[1],dead=res.dead&&res.days.length?`<p class="small" style="margin:.4rem 0 0;color:var(--bad)">${esc(t('v_dead',{d:dfmt(res.days[res.days.length-1][0])}))}</p>`:'';
  if(fwOn){const v=verdict(b,f);h+=head(v[0],t(v[1]),v[2]+' '+t('v_dd',{f:'−'+(f.mdd*100).toFixed(1)+'%',b:'−'+(b.mdd*100).toFixed(1)+'%'}),dead)+tiles(f)+`</div>`;}
  else if(!b.n)h+=head('warn',t('v_none'),t('v_none_p'))+`</div>`;
  else{const thin=edge(b)>0&&b.pf<1.1;h+=head(edge(b)<=0?'bad':thin?'warn':'ok',t('v_bt'),t(edge(b)<=0?'v_bt_lose_p':thin?'v_bt_thin_p':'v_bt_p',{n:b.n.toLocaleString('en-US'),w:b.w.toLocaleString('en-US'),e:edgeF(b),pf:pfF(b.pf)}),dead)+tiles(b)+`</div>`;}
  if(!b.n&&!(f&&f.n))return h;
  const split=fwOn?rec.w.s:0,cols=fwOn?[['Backtest',b],['Forward test',f]]:[['Backtest',b]];
  h+=`<div class="dgrid">
    <div class="s12">${card('Equity',equity(res,split,bal)+note(t('n_eq')+(split?' '+t('n_eq_fw'):'')))}</div>
    <div class="s12">${card(fwOn?'Backtest vs forward test':'Backtest numbers',cmpTable(cols)+(fwOn?note(t('n_cmp')):''))}</div>
    <div class="s12">${card('Monthly results',monthly(res,bal,split)+lg([['var(--ok)',t('lg_up')],['var(--bad)',t('lg_down')]])+note(t('n_month')+(split?' '+t('n_month_fw',{d:lmon(dfmt(split).slice(0,7))}):'')))}</div>
    <div class="s6">${card('How trades ended',exits(cols.map(c=>c[1]),cols.map(c=>c[0])))}</div>
    <div class="s12">${card('Latest trades',tradeList(res)+note(t('n_trades',{n:Math.min(15,res.trades.length)}))+`<button type="button" class="btn alt" data-lcsv="1" style="margin-top:.7rem">${esc(t('csv'))}</button>`)}</div>
  </div>`;
  return h;}
function about(){
  const I=R.idx;
  return`<div class="dgrid"><div class="s7">${card('How the test works',`<ul class="small labul">${tl('hw').map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`)}</div>
    <div class="s5">${card('What it can\'t tell you',`<ul class="small labul">${tl('lim').map(x=>`<li>${esc(x.replace('{d}',I?lday(I.to):'–'))}</li>`).join('')}</ul>`)}</div></div>`;}
function drawMain(){
  const m=$('lab-main');if(!m)return;
  m.innerHTML=`<div class="card"><p class="bt-lead" style="margin-top:0">${esc(t('lab_lead'))}</p><ol class="small labsteps"><li>${esc(t('lab_s1'))}</li><li>${esc(t('lab_s2'))}</li><li>${esc(t('lab_s3'))}</li></ol></div>
    <section class="dsec" id="lab-per"><h2>Test periods</h2><div class="card">${periods()}</div></section>
    <section class="dsec" id="lab-res" aria-live="polite">${R.busy?'':results()}</section>
    <section class="dsec" id="lab-about"><h2>About this test</h2>${about()}</section>`;}

/* ---------- wiring ---------- */
function init(root){
  R.root=root;
  root.innerHTML=`<div class="desk-layout"><aside class="d-aside" id="lab-aside" aria-label="Playground settings"></aside><div class="d-col" id="lab-main"></div></div>`;
  drawAside();drawMain();
  const a=$('lab-aside'),m=$('lab-main');
  a.addEventListener('change',e=>{const el=e.target;if(el.tagName!=='SELECT')return;if(el.dataset.c){condEvent(el,'change');return;}if(!SET[el.id])return;SET[el.id](el.value);
    if(el.id==='lb-preset'||el.id==='lb-rmode'||el.id==='lb-stop'||el.id==='lb-tgt'||el.id==='lb-size'){Object.keys(bad).forEach(k=>delete bad[k]);}
    save();clampStart();drawAside();drawMain();});
  a.addEventListener('input',e=>{const el=e.target;if(el.tagName!=='INPUT')return;if(el.dataset.c)condEvent(el,'input');else numInput(el);});
  a.addEventListener('click',e=>{const add=e.target.closest('[data-cadd]'),del=e.target.closest('[data-cdel]');
    if(add){const L=C.rule[add.dataset.cadd];if(L.length<4)L.push({a:CL(),op:'gt',b:X('ema',{n:200})});}
    else if(del){const box=del.closest('.cond');C.rule[box.dataset.side].splice(+box.dataset.k,1);}
    else return;Object.keys(bad).filter(x=>x.startsWith('lc-')).forEach(x=>delete bad[x]);save();clampStart();drawAside();drawMain();
    const nb=add?document.querySelector('#lab-aside [data-cadd="'+add.dataset.cadd+'"]'):null;if(nb)nb.focus();});
  m.addEventListener('change',e=>{const el=e.target.closest('[data-lp]');if(!el)return;const k=el.dataset.lp;
    if(k==='start')C.start=el.value;else{C[k]=+el.value;if(k==='btLen'){const o=fwOpts(C.btLen);if(!o.includes(C.fwLen))C.fwLen=o.reduce((p,v)=>Math.abs(v-C.btLen/2)<Math.abs(p-C.btLen/2)?v:p,o[0]);}}
    save();clampStart();drawMain();});
  m.addEventListener('click',e=>{const r=e.target.closest('[data-lrun]');if(r){go(r.dataset.lrun);return;}
    if(e.target.closest('[data-lcsv]')){const fwOn=R.view==='fw'&&R.fw&&R.fw.wsig===wsigOf();csv(fwOn?R.fw:R.bt);}});}
function refresh(){if(!R.root)return;drawAside();drawMain();}
return{init,refresh,tip};
})();
