/* Jarn Neow gold playground worker.
   Loads monthly 1-minute gold files, builds the chosen timeframe, computes indicators (same formulas and start-up rules as TA-Lib),
   finds signals on closed bars and fills them on the 1-minute bars that follow.
   Prices are integers in ticks of $0.10, and 1 pip = 1 tick. Times are minutes since 1970-01-01 UTC. */
'use strict';
if(typeof importScripts==='function'&&typeof window==='undefined')importScripts('lab-ind.js'+(self.location&&self.location.search||''));

/* ---------- data files ---------- */
const cache=new Map(),CAP=60;
function decode(buf){
  let p=0;const rv=()=>{let v=0,m=1,b;do{b=buf[p++];v+=(b&127)*m;m*=128;}while(b&128);return v;},zz=v=>(v%2?-(v+1)/2:v/2);
  const n=rv(),t0=rv(),p0=zz(rv()),t=new Int32Array(n),o=new Int32Array(n),h=new Int32Array(n),l=new Int32Array(n),c=new Int32Array(n);
  let tt=t0,pc=p0;
  for(let i=0;i<n;i++){tt+=rv();const oo=pc+zz(rv()),hi=rv(),lo=rv(),cc=oo+zz(rv());t[i]=tt;o[i]=oo;c[i]=cc;h[i]=Math.max(oo,cc)+hi;l[i]=Math.min(oo,cc)-lo;pc=cc;}
  return{n,t,o,h,l,c};}
const fail=(kind,m,code)=>{const e=new Error(kind+' '+m);e.kind=kind;e.month=m;e.code=code||0;return e;};
async function load(url,m,expect,retry){
  let r;try{r=await fetch(url,retry?{cache:'reload'}:undefined);}catch(e){throw fail('net',m);}
  if(!r.ok)throw fail('http',m,r.status);
  let buf=new Uint8Array(await r.arrayBuffer()),d;
  try{if(buf[0]===0x1f&&buf[1]===0x8b){const ds=new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));buf=new Uint8Array(await new Response(ds).arrayBuffer());}
    d=decode(buf);}catch(e){throw fail('bad',m);}
  /* an error page, a captive Wi-Fi page or a cut download must not quietly become a missing month */
  if(expect&&d.n!==expect)throw fail('bad',m);
  for(let i=1;i<d.n;i++)if(d.t[i]<=d.t[i-1])throw fail('bad',m);
  return d;}
async function getMonth(bases,m,expect){
  if(cache.has(m)){const d=cache.get(m);cache.delete(m);cache.set(m,d);return d;}
  let d=null,err=null;
  for(const b of bases){try{d=await load(b+m+'.bin',m,expect,false);break;}catch(e){err=e;}}
  if(!d){if(err.kind==='http'&&err.code===404)throw err;await new Promise(r=>setTimeout(r,err.code===429?1500:400));d=await load(bases[bases.length-1]+m+'.bin',m,expect,true);}
  cache.set(m,d);while(cache.size>CAP)cache.delete(cache.keys().next().value);return d;}
/* join months and remove contract-roll jumps; the last contract in the range keeps its real prices, adj holds the shift */
function join(parts,rolls){
  const n=parts.reduce((a,x)=>a+x.n,0),B={n,t:new Int32Array(n),o:new Int32Array(n),h:new Int32Array(n),l:new Int32Array(n),c:new Int32Array(n),adj:new Int32Array(n),rolls:0};
  let k=0;for(const x of parts){B.t.set(x.t,k);B.o.set(x.o,k);B.h.set(x.h,k);B.l.set(x.l,k);B.c.set(x.c,k);k+=x.n;}
  if(!n)return B;
  const t0=B.t[0],t1=B.t[n-1],rs=rolls.filter(r=>r.t>t0&&r.t<=t1).sort((a,b)=>b.t-a.t);
  let off=0,j=0;
  for(let i=n-1;i>=0;i--){while(j<rs.length&&B.t[i]<rs[j].t){off+=rs[j].d;j++;}if(off){B.o[i]+=off;B.h[i]+=off;B.l[i]+=off;B.c[i]+=off;B.adj[i]=off;}}
  B.rolls=rs.length;return B;}

/* ---------- timeframes ----------
   Most MT5 gold brokers run their server clock at UTC+2 in the northern winter and UTC+3 in summer, so the day closes at 17:00 New York time,
   which is also when the COMEX session ends. Daily and 4-hour candles use that clock; shorter candles line up with UTC hours either way. */
const dstC=new Map();
function dstRange(Y){
  const m1=new Date(Date.UTC(Y,2,1)).getUTCDay(),n1=new Date(Date.UTC(Y,10,1)).getUTCDay();
  return[Date.UTC(Y,2,1+(7-m1)%7+7,7)/60000,Date.UTC(Y,10,1+(7-n1)%7,6)/60000];}
function srvOff(t){const Y=new Date(t*60000).getUTCFullYear();let r=dstC.get(Y);if(!r){r=dstRange(Y);dstC.set(Y,r);}return t>=r[0]&&t<r[1]?180:120;}
function aggregate(B,tf){
  const n=B.n,T=new Int32Array(n),O=new Float64Array(n),H=new Float64Array(n),L=new Float64Array(n),C=new Float64Array(n),I0=new Int32Array(n),I1=new Int32Array(n);
  let K=-1,key=NaN;
  for(let i=0;i<n;i++){
    const t=B.t[i],k=tf>=240?Math.floor((t+srvOff(t))/tf):Math.floor(t/tf);
    if(k!==key){K++;key=k;T[K]=t;O[K]=B.o[i];H[K]=B.h[i];L[K]=B.l[i];C[K]=B.c[i];I0[K]=i;I1[K]=i;}
    else{if(B.h[i]>H[K])H[K]=B.h[i];if(B.l[i]<L[K])L[K]=B.l[i];C[K]=B.c[i];I1[K]=i;}}
  K++;return{n:K,t:T.subarray(0,K),o:O.subarray(0,K),h:H.subarray(0,K),l:L.subarray(0,K),c:C.subarray(0,K),i0:I0.subarray(0,K),i1:I1.subarray(0,K)};}

/* ---------- indicators and rules live in lab-ind.js (shared with the page) ---------- */
const IND=typeof LABIND!=='undefined'?LABIND:require('./lab-ind.js');
const signals=(F,P)=>IND.signals(F,P.rule,P.dir);

/* ---------- the trading run ----------
   win.a: first minute an entry may happen; win.s: first minute of the forward period (0 = none); win.b: end of the test (exclusive).
   Entries happen at the open of the first minute after the signal bar closes. Stops and targets are checked on every 1-minute bar:
   price opening past the stop fills at that open; a stop and target inside the same minute count as the stop. */
function newSeg(){return{n:0,w:0,gw:0,gl:0,pips:0,R:0,nR:0,hold:0,streak:0,maxStreak:0,ln:0,lw:0,sn:0,sw:0,amb:0,gap:0,skip:0,why:{stop:0,target:0,signal:0,time:0,end:0},
  eq0:NaN,eq1:NaN,peak:NaN,mdd:0,mddAt:0,t0:0,t1:0,px0:NaN,px1:NaN,best:0,worst:0,worstAt:0};}
function run(B,F,sig,atr,P,win){
  const pv=P.pv,spread=P.spread,comm=P.comm,trades=[],days=[],seg=[newSeg(),newSeg()];
  let bal=P.bal,pos=null,pend=0,pendAtr=NaN,dead=false,cur=-1,dEq=0,dMin=0,dPx=0,adjNow=0;
  const segOf=t=>win.s&&t>=win.s?1:0;
  function open(side,j,k,atrv){
    if(dead||bal<=0)return;const t=B.t[j],o=B.o[j],sg=seg[segOf(t)];
    let sd=P.stop.kind==='pips'?P.stop.v:P.stop.kind==='atr'?P.stop.v*atrv:0;
    if(P.stop.kind!=='none'&&!(sd>0))return;
    let td=P.tgt.kind==='pips'?P.tgt.v:P.tgt.kind==='atr'?P.tgt.v*atrv:P.tgt.kind==='r'&&sd>0?P.tgt.v*sd:0;
    if(P.tgt.kind!=='none'&&!(td>0))return;
    let lots=P.size.kind==='risk'?Math.floor(bal*P.size.v/100/(sd*pv)*100+1e-9)/100:P.size.v;
    if(!(lots>=0.01)){sg.skip++;return;}
    pos={side,e:o,t,k,lots,sd,adj:B.adj[j],st:sd>0?o-side*sd:null,tg:td>0?o+side*td:null,risk:sd>0?sd*pv*lots:0};}
  function close(px,t,why,amb,gap){
    const p=pos,pips=p.side*(px-p.e)-spread,usd=pips*pv*p.lots-comm*p.lots,sg=seg[segOf(p.t)];bal+=usd;
    sg.n++;if(usd>0){sg.w++;sg.gw+=usd;sg.streak=0;}else{sg.gl+=usd;sg.streak++;if(sg.streak>sg.maxStreak)sg.maxStreak=sg.streak;}
    sg.pips+=pips;if(p.risk>0){sg.R+=usd/p.risk;sg.nR++;}sg.hold+=t-p.t;sg.why[why]++;if(amb)sg.amb++;if(gap)sg.gap++;
    if(p.side>0){sg.ln++;if(usd>0)sg.lw++;}else{sg.sn++;if(usd>0)sg.sw++;}
    if(usd>sg.best)sg.best=usd;if(usd<sg.worst){sg.worst=usd;sg.worstAt=t;}
    if(trades.length<50000)trades.push([p.t,p.side,(p.e-p.adj)/10,t,(px-adjNow)/10,why,p.lots,pips,usd,segOf(p.t),amb?1:0]);
    pos=null;if(bal<=0)dead=true;}
  function exitCheck(j){
    const p=pos,o=B.o[j],h=B.h[j],l=B.l[j],t=B.t[j];
    if(p.side>0){
      if(p.st!==null&&o<=p.st)return close(o,t,'stop',false,o<p.st);
      if(p.tg!==null&&o>=p.tg)return close(p.tg,t,'target');
      const hs=p.st!==null&&l<=p.st,ht=p.tg!==null&&h>=p.tg;
      if(hs)return close(p.st,t,'stop',ht);if(ht)return close(p.tg,t,'target');}
    else{
      if(p.st!==null&&o>=p.st)return close(o,t,'stop',false,o>p.st);
      if(p.tg!==null&&o<=p.tg)return close(p.tg,t,'target');
      const hs=p.st!==null&&h>=p.st,ht=p.tg!==null&&l<=p.tg;
      if(hs)return close(p.st,t,'stop',ht);if(ht)return close(p.tg,t,'target');}}
  function mark(j){
    const t=B.t[j],c=B.c[j],fl=pos?(pos.side*(c-pos.e)-spread)*pv*pos.lots-comm*pos.lots:0,eq=dead?0:bal+fl,sg=seg[segOf(t)];
    if(!(sg.eq0===sg.eq0)){sg.eq0=eq;sg.peak=eq;sg.t0=t;sg.px0=B.o[j]-B.adj[j];}
    if(eq>sg.peak)sg.peak=eq;const dd=sg.peak>0?1-eq/sg.peak:1;if(dd>sg.mdd){sg.mdd=dd;sg.mddAt=t;}
    sg.eq1=eq;sg.t1=t;sg.px1=c-B.adj[j];
    const d=Math.floor(t/1440);if(d!==cur){if(cur>=0)days.push([cur*1440,dEq,dMin,dPx]);cur=d;dMin=eq;}
    dEq=eq;if(eq<dMin)dMin=eq;dPx=(c-B.adj[j])/10;}
  let k0=0;while(k0<F.n&&F.t[k0]<win.a)k0++;
  let lastJ=-1;
  for(let k=k0;k<F.n;k++){
    if(F.t[k]>=win.b||dead)break;
    const j0=F.i0[k];adjNow=B.adj[j0];
    if(pos&&P.maxBars>0&&k-pos.k>=P.maxBars)close(B.o[j0],B.t[j0],'time');
    if(pend){if(pos&&pos.side!==pend&&P.opp)close(B.o[j0],B.t[j0],'signal');if(!pos)open(pend,j0,k,pendAtr);pend=0;}
    for(let j=j0;j<=F.i1[k];j++){adjNow=B.adj[j];if(pos)exitCheck(j);mark(j);lastJ=j;if(dead)break;}
    const s=sig[k];if(s&&!dead&&(!pos||(pos.side!==s&&P.opp))){pend=s;pendAtr=atr[k];}}
  if(lastJ>=0)adjNow=B.adj[lastJ];
  if(pos&&lastJ>=0)close(B.c[lastJ],B.t[lastJ],'end');
  if(lastJ>=0){mark(lastJ);days.push([cur*1440,dEq,dMin,dPx]);}
  return{seg:win.s?seg:[seg[0]],days,trades,dead,final:bal};}

/* start-up length: candles needed before the first trade so indicators have settled */
const warmBars=P=>IND.warmOf(P.rule);

function backtest(B,P,win){
  const F=aggregate(B,P.tf),sig=signals(F,P),atr=IND.ATR(F.h,F.l,F.c,P.atrN);
  let k0=0;while(k0<F.n&&F.t[k0]<win.a)k0++;
  const r=run(B,F,sig,atr,P,win);r.warm=k0;r.need=warmBars(P);r.bars=F.n;return r;}

const API={decode,join,aggregate,srvOff,signals,run,backtest,warmBars};
if(typeof self!=='undefined'&&typeof window==='undefined'&&typeof importScripts==='function'){
  self.onmessage=async ev=>{const m=ev.data;
    try{const list=m.months,res=new Array(list.length);let next=0,done=0;
      await Promise.all(Array.from({length:Math.min(6,list.length)},async()=>{while(next<list.length){const i=next++;res[i]=await getMonth(m.bases,list[i],m.counts&&m.counts[list[i]]);done++;self.postMessage({type:'progress',done,total:list.length,id:m.id});}}));
      self.postMessage({type:'progress',stage:'run',id:m.id});
      const B=join(res,m.rolls),out=backtest(B,m.params,m.win);out.rolls=B.rolls;out.from=B.n?B.t[0]:0;out.to=B.n?B.t[B.n-1]:0;
      self.postMessage({type:'done',out,id:m.id});
    }catch(e){self.postMessage({type:'error',kind:e&&e.kind||'other',month:e&&e.month||'',code:e&&e.code||0,msg:String(e&&e.message||e),id:m.id});}};}
if(typeof module!=='undefined')module.exports=API;
