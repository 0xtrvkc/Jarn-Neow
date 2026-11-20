/* Jarn Neow, Expert mode: the risk dashboard.
   Loaded by index.html only when Expert is opened, so Beginner visitors don't download or parse it.
   After editing this file, change EXPERT_V in index.html so browsers fetch the new copy. */
/* ---------- Desk (expert) ---------- */
const DESK=(function(){
'use strict';
const D={parsed:null,fileName:'',symbol:'',sl:0,risk:1,ruin:50,hor:200,sims:10000,explain:true,net:'net',layout:'full',reached:1,res:null,err:null,
  wr:45,rr:1.5,n:40,tpd:2,sizing:'comp',dAfter:0,dCut:50,bal:10000,spread:0,comm:0,pv:0,model:null,histMsg:()=>'',fileId:0,
  stype:'fixed',gLot:0.01,gStep:20,gMult:1.5,gGrow:'mult',gAdd:0.01,gMax:8,gTp:15,gSl:0,gVol:80,gAuto:'fixed',gMkt:'real',gm:null};
const GDEF={grid:{gLot:0.01,gTp:15,gSl:0},nostop:{gLot:0.5,gTp:30,gSl:0}};
const STEPS=['sum','edge','surv','size','streak','cost','hist'];
const SEC={sum:'Summary',edge:'Edge and confidence',surv:'Survival',size:'Position sizing',streak:'Streaks and recovery',cost:'Costs and lot size',hist:'Trade history (Myfxbook)'};
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const ICON={ok:'✓',warn:'!',bad:'✕',none:'…'};
let timer=null;
const dstr=ms=>new Date(ms).toISOString().slice(0,10);
const kv=rows=>`<table class="kv"><tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td class="n">${r[1]}</td></tr>`).join('')}</tbody></table>`;
const card=(title,body,cls)=>`<div class="card ${cls||''}"><h3>${esc(title)}</h3>${body}</div>`;
let EXPL={};
const note=(k,v)=>exBlock(k,v);
const ch=svg=>`<div class="chart">${svg}</div>`;

/* ---------- file handling ---------- */
function showErr(msg){D.err=msg;$('file-status').innerHTML=msg?`<div class="errnote">${esc(msg)}</div>`:'';}
function readFile(file){
  if(!file)return;if(file.size>25*1024*1024){showErr(t('err_big'));return;}
  const fr=new FileReader();
  $('file-status').innerHTML=`<div class="small">${esc(t('file_reading'))}</div>`;
  fr.onload=()=>setTimeout(()=>{
    const p=SFX.parseMyfxbook(String(fr.result));
    if(!p.ok){D.parsed=null;D.det=null;D.fit=null;D.filled=null;D.fileId++;D.res=null;showErr(t('err_'+p.error));$('symwrap').hidden=true;analyze();return;}
    D.parsed=p;D.fileId++;D.fileName=file.name;showErr(null);D.det=detectType(p);
    const syms=Object.keys(p.symbols).sort((a,b)=>p.symbols[b]-p.symbols[a]);D.symbol=syms[0];
    const sel=$('symsel');sel.innerHTML=syms.map(s=>`<option value="${esc(s)}">${esc(s)} (${p.symbols[s]})</option>`).join('');sel.value=D.symbol;
    $('symwrap').hidden=syms.length<2;if(D.det.type!==D.stype)setType(D.det.type,true);if(!(D.pv>0)){const v=SFX.toR(p.trades.filter(x=>x.symbol===D.symbol),1,true).vpp;if(isFinite(v)&&v>0){D.pv=+v.toPrecision(4);$('d-pv').value=D.pv;}}autoFill();statusLine();hint();analyze();},30);
  fr.onerror=()=>showErr(t('err_read'));fr.readAsText(file);}
function autoFill(){D.fit=null;if(!D.parsed)return;if(D.stype==='fixed')fixedFill();else gridFill();}
function fixedFill(){
  const tr=curTrades();D.filled=null;if(tr.length<5)return;
  const lp=tr.filter(x=>x.pips<0).map(x=>-x.pips);if(!lp.length)return;
  const sl=+SFX.median(lp).toPrecision(4);if(!(sl>0))return;
  D.sl=sl;$('d-sl').value=sl;
  const st=SFX.tradeStats(SFX.toR(tr,sl,D.net==='net').R),f={sl,n:st.n};
  D.n=Math.max(5,st.n);$('d-n').value=D.n;
  if(st.avgWin>0&&st.avgLoss<0){D.wr=SFX.clamp(Math.round(st.winRate*1000)/10,1,100);D.rr=SFX.clamp(+(st.avgWin/-st.avgLoss).toFixed(2),0.05,100);$('d-wr').value=D.wr;$('d-rr').value=D.rr;f.wr=D.wr;f.rr=D.rr;}
  const lg=tr.filter(x=>x.profit<0&&isFinite(x.gain)&&x.gain<0).map(x=>-x.gain);
  if(lg.length>=3){const r=SFX.clamp(+SFX.median(lg).toFixed(2),0.05,100);D.risk=r;$('d-risk').value=r;f.risk=r;}
  const days=(tr[tr.length-1].close-tr[0].open)/864e5*5/7;if(days>=1){const d=SFX.clamp(+(tr.length/days).toFixed(1),0.1,200);D.tpd=d;$('d-tpd').value=d;f.tpd=d;}
  D.spread=0;D.comm=0;$('d-spread').value=0;$('d-comm').value=0;
  if(D.net==='gross'){D.net='net';$('d-net').value='net';}
  const bal=D.parsed.balance;if(isFinite(bal)&&bal>0){D.bal=Math.round(bal*100)/100;$('d-bal').value=D.bal;f.bal=D.bal.toLocaleString('en-US');}
  ['wr','rr','n','risk','tpd','sl','pv','spread','comm'].forEach(k=>{if(k in f||k==='spread'||k==='comm'||k==='pv'||k==='sl')dtouch[k]=1;});if(f.bal)dtouch.bal=1;
  D.filled=f;revalidate();}
function gridFill(){
  const tr=curTrades();D.filled=null;if(tr.length<5)return;const f=gridFit(tr);if(!f)return;D.fit=f;const F={},g=D.stype==='grid';
  /* gold files often count $0.01 as a pip; the app's gold pip is $0.10 (as in the daily-range converter and the gold playground) */
  f.goldConv=/XAU|GOLD/i.test(D.symbol)&&f.pipSz>0&&f.pipSz<0.05;if(f.goldConv){const k=f.pipSz/0.1;['step','tp'].forEach(x=>{if(isFinite(f[x]))f[x]=Math.max(1,Math.round(f[x]*k));});f.gLo*=k;f.gHi*=k;f.pvK=1/k;}
  const set=(id,key,v,lo,hi)=>{if(!isFinite(v))return;v=SFX.clamp(v,lo,hi);D[key]=v;$(id).value=v;dtouch[key]=1;F[key]=v;};
  if(g){set('g-lot','gLot',f.lot0,0.01,100);if(f.maxN>=2&&isFinite(f.step)){set('g-step','gStep',f.step,1,10000);setGrow(f.grow);F.gGrow=f.grow;
    if(f.grow==='add')set('g-add','gAdd',f.gAdd,0.01,100);else set('g-mult','gMult',f.gMult,1,5);set('g-max','gMax',f.maxN,1,30);}}
  else set('g-lot','gLot',Math.max(0.01,r2(mdn(tr.map(x=>x.lots).filter(x=>x>0)))),0.01,100);
  set('g-tp','gTp',f.tp,1,10000);set('d-comm','comm',f.comm,0,1e9);
  const v=SFX.toR(tr,1,true).vpp*(f.pvK||1);if(isFinite(v)&&v>0)set('d-pv','pv',+v.toPrecision(4),0,1e9);
  const bal=D.parsed.balance;if(isFinite(bal)&&bal>0)set('d-bal','bal',Math.round(bal*100)/100,1,1e12);
  D.filled=F;revalidate();}
function curTrades(){return D.parsed?D.parsed.trades.filter(x=>x.symbol===D.symbol):[];}
/* ---------- strategy detection from a Myfxbook file ----------
   A grid closes all its orders together, so a cycle = trades of one symbol, side and magic number whose close times are within 2 minutes. */
function baskets(tr){
  const g=new Map();tr.forEach(x=>{const k=x.symbol+'|'+x.side+'|'+(x.magic||'');if(!g.has(k))g.set(k,[]);g.get(k).push(x);});
  const out=[];g.forEach(v=>{v.sort((a,b)=>a.close-b.close);let cur=[v[0]];for(let i=1;i<v.length;i++){if(v[i].close-cur[cur.length-1].close<=120000)cur.push(v[i]);else{out.push(cur);cur=[v[i]];}}out.push(cur);});
  out.forEach(b=>b.sort((a,c)=>a.open-c.open||a.lots-c.lots));out.sort((a,b)=>a[a.length-1].close-b[b.length-1].close);return out;}
function detectType(p){
  const tr=p.trades,N=tr.length,withSL=tr.filter(x=>x.slPx>0).length,B=baskets(tr),multi=B.filter(b=>b.length>=2),inMulti=multi.reduce((a,b)=>a+b.length,0)/N;
  const grow=multi.length?multi.filter(b=>b[b.length-1].lots>b[0].lots*1.01).length/multi.length:0;
  const lp=tr.filter(x=>x.pips<0).map(x=>-x.pips).sort((a,b)=>a-b),med=lp.length?lp[Math.floor(lp.length/2)]:0,q95=lp.length?lp[Math.floor(lp.length*0.95)]:0;
  let type;if(withSL/N>=0.5)type='fixed';else if(inMulti>=0.3)type='grid';else type=lp.length>=5&&med>0&&q95/med>4?'nostop':'fixed';
  /* how many symbols had a cycle open at the same moment */
  const ev=[];B.forEach(b=>{ev.push([b[0].open,1,b[0].symbol]);ev.push([b[b.length-1].close,-1,b[0].symbol]);});ev.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const open=new Map();let conc=0;ev.forEach(([,d,s])=>{const v=(open.get(s)||0)+d;if(v>0)open.set(s,v);else open.delete(s);if(open.size>conc)conc=open.size;});
  return{type,N,withSL,cycles:B.length,inMulti,grow,pairs:Object.keys(p.symbols).length,conc};}
const mdn=a=>{if(!a.length)return NaN;const s=a.slice().sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const r2=x=>Math.round(x*100)/100;
/* rebuild a grid / no-stop setup from one symbol's trades */
function gridFit(tr){
  const ps=tr.filter(x=>Math.abs(x.pips)>=5&&isFinite(x.openPrice)&&isFinite(x.closePrice)).map(x=>Math.abs(x.closePrice-x.openPrice)/Math.abs(x.pips)),pipSz=mdn(ps);
  if(!(pipSz>0)||tr.length<5)return null;
  const B=baskets(tr),sizes=B.map(b=>b.length),first=B.map(b=>b[0].lots).filter(x=>x>0),lot0=Math.max(0.01,r2(mdn(first)));
  const dist=(b,k)=>(b[0].side==='buy'?1:-1)*(b[0].openPrice-b[k].openPrice)/pipSz;
  const g1=[],gl=[],avgSp=[];B.forEach(b=>{for(let k=1;k<b.length;k++){const d=dist(b,k)-dist(b,k-1);(k===1?g1:gl).push(d);}if(b.length>=3)avgSp.push(dist(b,b.length-1)/(b.length-1));});
  const step=avgSp.length?mdn(avgSp):g1.length?mdn(g1):NaN,allG=g1.concat(gl).filter(x=>x>0).sort((a,b)=>a-b),gLo=allG.length?allG[Math.floor(allG.length*0.1)]:NaN,gHi=allG.length?allG[Math.floor(allG.length*0.9)]:NaN;
  /* lot growth: compare "first × (1 + a·k)" with "first × m^k" on cycles of 3+ orders */
  const deep=B.filter(b=>b.length>=3&&b[0].lots>0),pool=deep.length?deep:B.filter(b=>b.length>=2&&b[0].lots>0),as=[],ms=[];
  pool.forEach(b=>{for(let k=1;k<b.length;k++){const r=b[k].lots/b[0].lots;as.push((r-1)/k);ms.push(Math.pow(r,1/k));}});
  let grow='mult',gMult=1,gAdd=0.01;
  if(as.length){const a=mdn(as),m=mdn(ms);let eA=0,eM=0;pool.forEach(b=>{for(let k=1;k<b.length;k++){const r=b[k].lots/b[0].lots;eA+=Math.abs(r-(1+a*k));eM+=Math.abs(r-Math.pow(m,k));}});
    if(a>0.01&&eA<eM){grow='add';gAdd=Math.max(0.01,r2(lot0*a));}else gMult=SFX.clamp(Math.round(m*20)/20,1,5);}
  const tps=[];B.forEach(b=>{const L=b.reduce((s,x)=>s+x.lots,0);if(!(L>0))return;const net=b.reduce((s,x)=>s+x.profit,0);if(net<=0)return;const avg=b.reduce((s,x)=>s+x.lots*x.openPrice,0)/L,c=b[b.length-1].closePrice,d=(b[0].side==='buy'?1:-1)*(c-avg)/pipSz;if(d>0)tps.push(d);});
  const cm=tr.filter(x=>x.lots>0&&x.commission<0).map(x=>-x.commission/x.lots),comm=cm.length?r2(mdn(cm)):0;
  /* real cycles, money rescaled to the fitted first order so they compare with the simulation */
  const cyc=B.map(b=>{const k=b[0].lots>0?lot0/b[0].lots:1,net=b.reduce((s,x)=>s+x.profit,0)*k,fl=b.every(x=>isFinite(x.minUSD))?-b.reduce((s,x)=>s+Math.min(0,x.minUSD),0)*k:NaN;
    return{n:b.length,net,fl,start:b[0].open,end:b[b.length-1].close};});
  const w=cyc.filter(c=>c.net>0),l=cyc.filter(c=>c.net<=0),sum=a=>a.reduce((x,y)=>x+y.net,0),worst=cyc.reduce((a,c)=>c.net<a.net?c:a,cyc[0]),fls=cyc.filter(c=>isFinite(c.fl)),deepest=fls.length?fls.reduce((a,c)=>c.fl>a.fl?c:a,fls[0]):null;
  const maxN=Math.max.apply(null,sizes),reach=[];for(let k=1;k<=maxN;k++)reach.push(cyc.filter(c=>c.n>=k).length/cyc.length);
  return{pipSz,lot0,grow,gMult,gAdd,step:isFinite(step)?Math.max(1,Math.round(step)):NaN,g1:mdn(g1),gl:mdn(gl),gLo,gHi,maxN:SFX.clamp(maxN,1,30),
    tp:tps.length?Math.max(1,Math.round(mdn(tps))):NaN,comm,firstLo:Math.min.apply(null,first),firstHi:Math.max.apply(null,first),
    real:{cycles:cyc.length,from:B[0][0].open,to:B[B.length-1][B[B.length-1].length-1].close,win:w.length/cyc.length,avgW:w.length?sum(w)/w.length:0,avgL:l.length?sum(l)/l.length:0,losses:l.length,
      worst:worst.net,worstAt:worst.end,deep:deepest?deepest.fl:NaN,deepAt:deepest?deepest.start:0,reach,maxN,days:mdn(cyc.map(c=>(c.end-c.start)/864e5))}};}
function statusLine(){
  if(!D.parsed)return;const tr=curTrades(),p=D.parsed,det=D.det,F=D.filled,f=D.fit,nk=Object.keys(p.symbols).length,fx=D.stype==='fixed';
  const nf=x=>(+x).toLocaleString('en-US'),dd=ms=>dstr(ms);
  let h=`<div class="small">${esc(t('file_ok',{n:tr.length,sym:D.symbol,from:dd(tr[0].open),to:dd(tr[tr.length-1].close),skipped:p.skipped}))}</div>`;
  if(det){const why=det.type==='grid'?t('det_why_grid',{sl:nf(det.withSL),n:nf(det.N),multi:Math.round(det.inMulti*100),c:nf(det.cycles),grow:Math.round(det.grow*100)})
      :det.type==='nostop'?t('det_why_nostop',{n:nf(det.N),k:nf(det.N-det.withSL)}):det.withSL/det.N>=0.5?t('det_why_fixed',{sl:nf(det.withSL),n:nf(det.N)}):t('det_why_fixed2',{sl:nf(det.withSL),n:nf(det.N)});
    const others=['fixed','grid','nostop'].filter(s=>s!==D.stype);
    h+=`<div class="detline"><p><b>${esc(t('det_line',{type:t('st_'+det.type)}))}</b> ${esc(why)}${D.stype!==det.type?' '+esc(t('det_now',{type:t('st_'+D.stype)})):''}</p>
      <div class="detbtns">${others.map(s=>`<button type="button" class="btn alt" data-det-use="${s}">${esc(t('det_use',{type:t('st_'+s)}))}</button>`).join('')}</div></div>`;}
  if(nk>1)h+=fx?`<div class="small muted">${esc(t('file_multi',{k:nk}))}</div>`
    :`<div class="warnnote" style="margin:.5rem 0">${esc(t('file_multi_g',{k:nk,c:det?det.conc:nk,sym:D.symbol,bal:money(D.bal),share:money(D.bal/nk)}))}</div>`;
  if(fx){if(F)h+=`<div class="warnnote" style="margin:.5rem 0">${esc(t('file_applied',{sl:F.sl,n:F.n,wr:F.wr===undefined?'–':F.wr,rr:F.rr===undefined?'–':F.rr,risk:F.risk===undefined?'–':F.risk,tpd:F.tpd===undefined?'–':F.tpd,bal:F.bal===undefined?'–':F.bal}))}</div>`;}
  else if(F&&f){const r=f.real,o={sym:D.symbol,c:nf(r.cycles),n:nf(tr.length),from:dd(r.from),to:dd(r.to),lot:F.gLot,lo:f.firstLo,hi:f.firstHi,step:F.gStep,glo:pip(f.gLo),ghi:pip(f.gHi),max:F.gMax,tp:F.gTp===undefined?'–':F.gTp,comm:F.comm,pv:F.pv===undefined?'–':F.pv,bal:F.bal===undefined?'–':money(F.bal),
      grow:F.gGrow==='add'?t('grow_add',{x:F.gAdd}):t('grow_mult',{x:F.gMult})};
    h+=`<div class="warnnote" style="margin:.5rem 0">${esc(t(D.stype==='grid'?(f.maxN>=2&&isFinite(F.gStep)?'file_applied_g':'file_applied_g1'):'file_applied_ns',o)+(f.goldConv?' '+t('file_gold_unit'):''))}</div>`;}
  else if(!fx)h+=`<div class="warnnote" style="margin:.5rem 0">${esc(t('file_nofit'))}</div>`;
  $('file-status').innerHTML=h;}
function hint(){
  const el=$('sl-hint');if(!D.parsed){el.textContent=t('d_sl_hint0');return;}
  const tr=curTrades(),last=tr[tr.length-1];el.textContent=t('d_sl_hint',{sym:D.symbol,pips:Math.abs(last.pips)});}

/* ---------- computation ---------- */
function schedule(){clearTimeout(timer);timer=setTimeout(analyze,220);}
const pc=(x,d)=>(x*100).toFixed(d===undefined?1:d)+'%';
function cmpNum(v){return v>=1e12?v.toExponential(0).replace('+',''):v>=1e9?(+(v/1e9).toPrecision(3))+'B':v>=1e6?(+(v/1e6).toPrecision(3))+'M':v>=1e4?(+(v/1e3).toPrecision(3))+'k':(+v.toPrecision(3))+'';}
const eqFmt=x=>x>=100?'×'+cmpNum(x):Math.round(x*100)+'%';
function erf(x){const s=x<0?-1:1;x=Math.abs(x);const tt=1/(1+0.3275911*x);return s*(1-(((((1.061405429*tt-1.453152027)*tt)+1.421413741)*tt-0.284496736)*tt+0.254829592)*tt*Math.exp(-x*x));}
const Phi=x=>0.5*(1+erf(x/Math.SQRT2));
function costR(){if(!(D.sl>0))return 0;let c=D.spread>0?D.spread/D.sl:0;if(D.comm>0&&D.pv>0)c+=D.comm/D.pv/D.sl;return c;}
function runSim(p,riskPct,extra){if(!extra&&D._memo){const k=p+'|'+riskPct,c=D._memo.get(k);if(c)return c;const r=runSimRaw(p,riskPct);D._memo.set(k,r);return r;}return runSimRaw(p,riskPct,extra);}
function runSimRaw(p,riskPct,extra){const m=D._pay;return SFX.simulate(Object.assign({sampler:SFX.binPay(p,m.W,-m.L),risk:riskPct/100,n:D.hor,sims:D._sub||1000,ruin:D.ruin/100,seed:21,fixed:D.sizing==='fixed',deriskAfter:D.dAfter,deriskCut:D.dCut/100},extra||{}));}
function computeModel(){
  const p=D.wr/100,b=D.rr,c=costR(),W=b-c,L=1+c,q=1-p,H=D.hor;D._pay={W,L};D._memo=new Map();
  const Eg=SFX.expectancy(p,b),En=p*W-q*L,ci=SFX.wilson(p,D.n),eAt=x=>x*W-(1-x)*L,Elo=eAt(ci[0]),Ehi=eAt(ci[1]);
  const kf=pp=>W>0?Math.max(0,Math.min(0.999/L,pp/L-(1-pp)/W)):0,K=kf(p),Klo=kf(ci[0]);
  const g=f=>{if(f<=0)return 0;const d=1-f*L;if(d<=0)return q>0?-Infinity:p*Math.log(1+f*W);return p*Math.log(1+f*W)+(q>0?q*Math.log(d):0);};
  let Z=0;if(K>0){let lo=K,hi=0.999/L;if(g(hi)>0)Z=hi;else{for(let i=0;i<60;i++){const m=(lo+hi)/2;if(g(m)>0)lo=m;else hi=m;}Z=(lo+hi)/2;}}
  const sim=runSim(p,D.risk,{sims:D.sims,keep:50,bands:true});
  const grid=[0.25,0.5,1,1.5,2,3,4,5,7.5,10,15,20],row=(r,pp)=>{const s=runSim(pp===undefined?p:pp,r);return{risk:r,ruin:s.ruinProb,med:SFX.quantile(s.fin,0.5),dd95:SFX.quantile(s.dd,0.95)};};
  const sweep=grid.map(r=>row(r));
  const scen=[];const add=(name,r)=>{if(r>0)scen.push(Object.assign({name},row(+r.toFixed(3))));};
  add('Current',D.risk);add('1/8 Kelly',K*12.5);add('1/4 Kelly',K*25);add('1/2 Kelly',K*50);add('Full Kelly',K*100);add('Kelly at CI low',Klo*100);
  const stress=[{label:'Low end '+pc(ci[0],0),p:ci[0]},{label:'Your input '+pc(p,0),p},{label:'High end '+pc(ci[1],0),p:ci[1]}].map(s=>Object.assign(s,{ruin:s.p===p?sim.ruinProb:runSim(s.p,D.risk).ruinProb}));
  const be=L/(W+L),sdR=Math.sqrt(Math.max(0,p*W*W+q*L*L-En*En));
  let nNeed=null;if(En>0){for(let n=10;n<=20000;n+=(n<500?5:50)){if(eAt(SFX.wilson(p,n)[0])>0){nNeed=n;break;}}}
  const ruinP=sim.ruinProb;let v;if(En<=0||ruinP>=0.30)v='bad';else if(ruinP>0.05||Elo<=0||D.n<30||p>=1)v='warn';else v='ok';
  D._memo=null;D.model={p,b,c,W,L,q,H,Eg,En,ci,Elo,Ehi,K,Klo,Z,g,sim,sweep,scen,stress,be,sdR,nNeed,v,eAt};}
function computeHistory(){
  D.res=null;D.histMsg=()=>'';
  if(!D.parsed){D.histMsg=()=>t('h_none');return;}
  if(!(D.sl>0)){D.histMsg=()=>t('d_need_sl');return;}
  const trades=curTrades();
  if(trades.length<5){const n=trades.length;D.histMsg=()=>t('d_few',{n});return;}
  const conv=SFX.toR(trades,D.sl,D.net==='net'),R=conv.R,n=R.length,H=D.hor;
  const stats=SFX.tradeStats(R),boot=SFX.bootstrapMean(R,4000,5),cum=SFX.cumulative(R),uw=SFX.underwater(cum);
  const sim=SFX.simulate({sampler:SFX.resampler(R),risk:D.risk/100,n:H,sims:D.sims,ruin:D.ruin/100,seed:11,keep:50,bands:true});
  const optF=SFX.optimalF(R),beh=SFX.behavior(trades,R),gcum=SFX.cumulative(conv.gross);
  const verdict=SFX.deskVerdict(stats,boot,sim.ruinProb);
  D.res={trades,conv,R,n,H,stats,boot,cum,uw,sim,optF,beh,gcum,verdict,wl:SFX.wilson(stats.winRate,n)};}
/* results are cached per input set: switching language or mode only redraws the text */
const SIGF=['wr','rr','n','tpd','sizing','dAfter','dCut','bal','spread','comm','pv','sl','hor','ruin','sims','risk','net','symbol','fileId'];
const SIGG=['stype','gLot','gStep','gMult','gGrow','gAdd','gMax','gTp','gSl','gVol','gAuto','gMkt','bal','spread','comm','pv','hor','ruin'];
let lastF=null,lastG=null;const sigOf=keys=>JSON.stringify(keys.map(k=>D[k]));
function analyze(){
  if(D.stype!=='fixed'){const k=sigOf(SIGG);if(k!==lastG||!D.gm){computeGrid();lastG=k;}drawGrid();return;}
  const k=sigOf(SIGF);if(k!==lastF||!D.model){computeModel();computeHistory();lastF=k;}$('d-apply').hidden=!D.res;draw();}

/* ---------- model sections ---------- */
const tbl=(head,rows)=>`<div style="overflow-x:auto" tabindex="0" role="region" aria-label="${esc(head.join(', '))}"><table class="kv mt"><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i?'n':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const lg=items=>`<div class="legend">${items.map(i=>`<span><i style="background:${i[0]}"></i>${esc(i[1])}</span>`).join('')}</div>`;
function mHead(i,extra){return`<h2>${esc(SEC[STEPS[i]])}${extra?`<small>${esc(extra)}</small>`:''}</h2>`;}
function nextBar(i){return i<STEPS.length-1?`<div class="nextbar" hidden><button type="button" class="btn" data-next="${i+1}">${esc(t('next_to',{name:SEC[STEPS[i+1]]}))}</button></div>`:'';}
function hHead(name,extra){return`<h2>${esc('History: '+name)}${extra?`<small>${esc(extra)}</small>`:''}</h2>`;}
function mVerdictLine(m){
  const o={E:rfmt(m.En),lo:rfmt(m.Elo),hi:rfmt(m.Ehi),n:D.n,ruin:blowFmt(m.sim.ruinProb),dd:D.ruin,risk:D.risk,H:D.hor};
  const why=m.p>=1?t('why_perfect'):(m.v==='warn'&&m.Elo>0&&m.sim.ruinProb<=0.05?t('dvx_small'):t('dvx_'+m.v));
  return t('dvm',o)+' '+why;}
function mSummary(m){
  const H=D.hor,gNow=m.g(D.risk/100),dbl=gNow>0&&isFinite(gNow)?Math.ceil(Math.log(2)/gNow):null,pfv=m.q>0?(m.p*m.W)/(m.q*m.L):Infinity;
  const days=x=>D.tpd>0?' ≈ '+cmpNum(Math.ceil(x/D.tpd))+' days':'';
  const rows=[['Win rate [95% CI]',`${pc(m.p,0)} [${pc(m.ci[0],0)}–${pc(m.ci[1],0)}]`],['Reward : risk',D.rr+'R'],['Break-even win rate',pc(m.be)],
    ['E[R] gross',rfmt(m.Eg,3)],['E[R] net of costs',`<b>${rfmt(m.En,3)}</b>`],['95% CI of E[R]',`[${sgn(m.Elo)}, ${sgn(m.Ehi)}]`],['σ(R) per trade',m.sdR.toFixed(2)],
    ['Profit factor (model)',isFinite(pfv)?pfv.toFixed(2):'∞'],['Trades until CI excludes 0',m.En>0?(m.nNeed?m.nNeed.toLocaleString('en-US'):'>20,000'):t('na_neg')],
    ['Log growth per trade at '+D.risk+'%',isFinite(gNow)?(gNow*100).toFixed(3)+'%':'−∞'],['Trades to double',dbl?dbl.toLocaleString('en-US')+days(dbl):'–'],['Horizon',H+' trades'+days(H)]];
  const fanSvg=CH.fan(m.sim,{w:520,h:280,floorLabel:t('d_ruin_line',{x:D.ruin}),xlabel:t('x_next',{H}),medColor:'var(--accent)',label:'Monte Carlo equity fan'});
  return`<section class="dsec" data-step="1">${mHead(0)}
  <div class="card"><div class="dverdict"><span class="light" data-v="${m.v}" aria-hidden="true">${ICON[m.v]}</span><div><h2>${esc(t('dv_'+m.v))}</h2><p class="small" style="margin:0">${esc(mVerdictLine(m))}</p></div></div>${D._wi?'':modelReport(m)}</div>
  ${D._wi?'':planCard(m)}
  <div class="dgrid"><div class="s5">${card('Model statistics',kv(rows)+note('mn_stats'))}</div>
  <div class="s7">${card('Monte Carlo: '+D.sims.toLocaleString('en-US')+' paths, '+H+' trades',ch(fanSvg)+note('mn_fan'))}</div></div>${nextBar(0)}</section>`;}
function mEdge(m){
  const p=m.p,lo=Math.max(0,p-0.25),hi=Math.min(1,p+0.25),xs=[];for(let i=0;i<=40;i++)xs.push(lo+(hi-lo)*i/40);
  const line=xs.map(x=>[x*100,m.eAt(x)]),ymin=amin(line.map(a=>a[1]),0),ymax=amax(line.map(a=>a[1]),0),c0=Math.max(lo,m.ci[0])*100,c1=Math.min(hi,m.ci[1])*100;
  const c1v=CH.plot({w:420,h:230,series:[{pts:line,color:'var(--c1)',w:2}],areas:[{upper:[[c0,ymax],[c1,ymax]],lower:[[c0,ymin],[c1,ymin]],color:'var(--c2)',op:0.14}],hlines:[{y:0,color:'var(--bad)'}],vlines:m.be>=lo&&m.be<=hi?[{x:m.be*100,color:'var(--muted)',label:'break-even'}]:[],markers:[{x:p*100,y:m.En,color:'var(--accent)',r:5}],xfmt:v=>v+'%',yfmt:v=>(+v.toFixed(2))+'',xlabel:'win rate',ylabel:'E[R] net',label:'Expectancy by win rate'});
  const bmax=Math.max(5,m.b*1.6),fr=[];for(let i=0;i<=60;i++){const bb=0.2+(bmax-0.2)*i/60,W=bb-m.c;fr.push([bb,W>0?m.L/(W+m.L)*100:100]);}
  const c2v=CH.plot({w:420,h:230,series:[{pts:fr,color:'var(--bad)',w:2}],areas:[{upper:fr.map(a=>[a[0],100]),lower:fr,color:'var(--ok)',op:0.1}],markers:[{x:Math.min(m.b,bmax),y:p*100,color:'var(--accent)',r:5,label:'you'}],ylo:0,yhi:100,xfmt:v=>v+'R',yfmt:v=>v+'%',xlabel:'reward : risk',ylabel:'win rate',label:'Break-even frontier'});
  const sb=CH.bars({w:420,h:220,items:m.stress.map(s=>({label:s.label,value:s.ruin*100,color:s.p===p?'var(--accent)':'var(--c1)'})),ymax:Math.max(10,Math.min(100,amax(m.stress.map(s=>s.ruin*100))*1.2)),yfmt:v=>v+'%',valFmt:v=>v.toFixed(1)+'%',ylabel:'P(ruin)',label:'Ruin probability across the win-rate confidence interval'});
  return`<section class="dsec" data-step="2">${mHead(1)}<div class="dgrid">
  <div class="s4">${card('Expectancy vs win rate',ch(c1v)+note('mn_evswr',{lo:pc(m.ci[0],0),hi:pc(m.ci[1],0),n:D.n}))}</div>
  <div class="s4">${card('Break-even frontier',ch(c2v)+note('mn_frontier'))}</div>
  <div class="s4">${card('P(ruin) if the true win rate differs',ch(sb)+lg([['var(--c1)',t('lg_ci_ends',{n:D.n})],['var(--accent)',t('lg_ci_you')]])+note('mn_stress'))}</div></div>${nextBar(1)}</section>`;}
function mSurvival(m){
  const sim=m.sim,H=m.H,fq=x=>eqFmt(SFX.quantile(sim.fin,x)),dq=x=>'−'+(SFX.quantile(sim.dd,x)*100).toFixed(1)+'%',ddA=Array.from(sim.dd),N=ddA.length;
  const ra=Array.from(sim.ruinAt).filter(x=>x>0).sort((a,b)=>a-b),medRuin=ra.length?ra[Math.floor(ra.length/2)]:null;
  const rows=[['Risk per trade',D.risk+'% ('+(D.sizing==='fixed'?'fixed':'compounding')+')'],['De-risk rule',D.dAfter>0?'after '+D.dAfter+' losses: −'+D.dCut+'%':'off'],['Ruin threshold','−'+D.ruin+'% from start'],
    ['P(ruin)','<b>'+pc(sim.ruinProb)+'</b>'],['Median trade # of ruin',medRuin?medRuin:'–'],['Equity p5 / p50 / p95',`${fq(0.05)} / ${fq(0.5)} / ${fq(0.95)}`],['Max DD p50 / p95 / p99',`${dq(0.5)} / ${dq(0.95)} / ${dq(0.99)}`]];
  const dds=ddA.map(x=>x*100),ddh=CH.histo({w:560,h:230,bins:SFX.hist(dds,24,0,Math.max(20,Math.ceil(amax(dds)/5)*5)),vlines:[{x:SFX.quantile(ddA,0.5)*100,color:'var(--ink)',label:'p50'},{x:SFX.quantile(ddA,0.95)*100,color:'var(--bad)',label:'p95',anchor:'end'}],xfmt:v=>v+'%',xlabel:t('x_maxdd'),ylabel:t('y_count'),label:'Max drawdown distribution'});
  const step=Math.max(1,Math.round(H/120)),rc=[];let k=0;for(let i=0;i<=H;i+=step){while(k<ra.length&&ra[k]<=i)k++;rc.push([i,k/N*100]);}
  if(rc[rc.length-1][0]!==H)rc.push([H,ra.length/N*100]);
  const none=!ra.length,half=ra.length?ra[Math.floor(ra.length/2)]:null;
  const rcv=CH.plot({w:860,h:250,m:{l:58,r:14},series:[{pts:rc,color:'var(--bad)',w:none?3:2.2}],areas:none?[]:[{upper:rc,lower:rc.map(a=>[a[0],0]),color:'var(--bad)',op:0.12}],hlines:[{y:5,color:'var(--warn)',label:'5%'}].concat(none?[{y:0,color:'var(--bad)',dash:false,label:t('rc_none',{N:N.toLocaleString('en-US'),H})}]:[]),vlines:half?[{x:half,color:'var(--muted)',label:t('rc_half',{x:half})}]:[],markers:none?[]:[{x:H,y:sim.ruinProb*100,color:'var(--bad)',r:4,label:pc(sim.ruinProb),anchor:'end',dx:-6}],xlo:0,xhi:H,ylo:0,yhi:Math.max(10,Math.min(100,sim.ruinProb*125)),yfmt:v=>(+v.toFixed(1))+'%',xlabel:t('x_trades'),ylabel:'cumulative P(ruin)',label:'Cumulative ruin probability over time'});
  const ddRows=[10,20,30,50,75].map(x=>['\u2212'+x+'%',pc(ddA.filter(d=>d>=x/100).length/N)]);
  const finA=Array.from(sim.fin),p95=SFX.quantile(sim.fin,0.95),useLog=p95>20;
  const fv=useLog?finA.map(x=>Math.log10(Math.max(x,1e-3))):finA.filter(x=>x<=p95*1.2).map(x=>x*100);
  const fh=CH.histo({w:420,h:220,bins:SFX.hist(fv,26),colorFn:b=>(useLog?Math.pow(10,b.x1)<=1:b.x1<=100)?'var(--c2)':'var(--c1)',vlines:[{x:useLog?0:100,color:'var(--ink)',dash:true,label:'start'}],xfmt:v=>useLog?eqFmt(Math.pow(10,v)):Math.round(v)+'%',xlabel:'final equity'+(useLog?' (log scale)':''),ylabel:t('y_count'),label:'Final equity distribution'});
  return`<section class="dsec" data-step="3">${mHead(2)}<div class="dgrid">
  <div class="s6">${card('Survival metrics',kv(rows)+note('mn_survt'))}</div>
  <div class="s6">${card('Final equity distribution',ch(fh)+note('mn_fin'))}</div>
  <div class="s12">${card('Max drawdown distribution',`<div class="split">${ch(ddh)}<div>${tbl(['Fall of at least','Share of futures'],ddRows)}</div></div>`+note('mn_ddhist'))}</div>
  <div class="s12">${card('Cumulative P(ruin) by trade',ch(rcv)+note('mn_ruincurve'))}</div></div>${nextBar(2)}</section>`;}
function mSizing(m){
  const sw=m.sweep,cur={x:D.risk,ruin:m.sim.ruinProb*100,med:SFX.quantile(m.sim.fin,0.5)},xmax=Math.max(20,D.risk);
  const sr=CH.plot({w:420,h:220,series:[{pts:sw.map(x=>[x.risk,x.ruin*100]),color:'var(--c1)',w:2}],dots:sw.map(x=>({x:x.risk,y:x.ruin*100,r:3,color:'var(--c1)',op:1})),hlines:[{y:5,color:'var(--warn)',label:'5%'}],markers:D.risk<=xmax?[{x:cur.x,y:cur.ruin,color:'var(--accent)',r:5}]:[],ylo:0,yfmt:v=>v+'%',xfmt:v=>v+'%',xlabel:t('x_risk'),ylabel:'P(ruin)',label:'Ruin probability by risk per trade'});
  let kc='';
  if(m.K>0){const fmax=Math.min(0.98/m.L,Math.max(m.Z*1.2,D.risk/100*1.15,0.05)),cv=[];for(let i=0;i<=80;i++){const f=fmax*i/80;cv.push([f*100,m.g(f)*100]);}
    const gK=m.g(m.K)*100,ylo=-Math.max(gK*2,0.05),youF=Math.min(D.risk/100,fmax),youG=Math.max(m.g(youF)*100,ylo);
    kc=ch(CH.plot({w:420,h:220,ylo,series:[{pts:cv.filter(a=>isFinite(a[1])),color:'var(--c1)',w:2}],hlines:[{y:0,color:'var(--muted)',dash:false}],vlines:[{x:m.K*50,color:'var(--muted)',label:'½'}],markers:[{x:m.K*100,y:gK,color:'var(--c4)',label:'f*',r:5},{x:youF*100,y:youG,color:'var(--accent)',label:'you',r:5,dy:16}],xfmt:v=>(+v.toFixed(1))+'%',yfmt:v=>(+v.toFixed(2))+'%',xlabel:t('x_risk'),ylabel:t('y_growth'),label:'Log growth rate by risk per trade'}));}
  const scRows=m.scen.map(s=>[esc(s.name),s.risk.toFixed(2)+'%',pc(s.ruin),eqFmt(s.med),'−'+pc(s.dd95)]);
  let lot;
  if(D.sl>0&&D.pv>0&&D.bal>0){const money=D.bal*D.risk/100,lots=money/(D.sl*D.pv),hk=m.K>0?D.bal*m.K/2/(D.sl*D.pv):0;
    lot=kv([['Account balance',D.bal.toLocaleString('en-US')],['Risk per trade',D.risk+'% = '+money.toLocaleString('en-US',{maximumFractionDigits:2})],['SL distance',D.sl],['Position size','<b>'+(Math.floor(lots*100)/100).toFixed(2)+' lots</b>'],['Size at half Kelly',hk>0?(Math.floor(hk*100)/100).toFixed(2)+' lots':'–'],['Loss if SL is hit, with costs',(money*m.L).toLocaleString('en-US',{maximumFractionDigits:2})]])+note('mn_lot');}
  else lot=note('mn_lot_need');
  return`<section class="dsec" data-step="4">${mHead(3)}<div class="dgrid">
  <div class="s6">${card('P(ruin) vs risk per trade',ch(sr)+note('mn_sweep'))}</div>
  <div class="s6">${card('Kelly growth curve',(kc||'')+note(m.K>0?'mn_kelly':'n_kelly0'))}</div>
  <div class="s6">${card('Sizing scenarios ('+m.H+' trades)',tbl(['Plan','Risk','P(ruin)','Median equity','DD p95'],scRows)+note('mn_scen'))}</div>
  <div class="s6">${card('Lot size',lot)}</div></div>${nextBar(3)}</section>`;}
function mStreaks(m){
  const q=m.q,H=m.H,ks=[2,3,4,5,6,7,8,9,10,12,15],items=ks.map(k=>({label:String(k),value:SFX.probStreak(q,k,H)*100,color:'var(--c2)'}));
  const sb=CH.bars({w:420,h:220,items,ymax:100,yfmt:v=>v+'%',valFmt:v=>v<1?'<1':Math.round(v)+'',xlabel:t('dp_streak_x'),ylabel:'P(at least one)',label:'Probability of a losing streak'});
  const r=D.risk/100*m.L,after=(rr,k)=>D.sizing==='fixed'?Math.max(0,1-k*rr):Math.pow(Math.max(0,1-rr),k),s1=[],s2=[];for(let k=0;k<=15;k++){s1.push([k,after(r,k)*100]);s2.push([k,after(r/2,k)*100]);}
  const ac=CH.plot({w:420,h:220,series:[{pts:s2,color:'var(--c3)',w:1.6},{pts:s1,color:'var(--accent)',w:2}],hlines:[{y:100-D.ruin,color:'var(--bad)',label:t('d_ruin_line',{x:D.ruin})}],ylo:0,yhi:100,yfmt:v=>v+'%',xlabel:t('dp_streak_x'),ylabel:'equity',label:'Equity after consecutive losses'});
  const typ=SFX.typicalStreak(q,H);
  const gN=m.g(Math.min(D.risk/100,0.98/m.L)),rec=[10,20,30,40,50,60,75].map(d=>['\u2212'+d+'%','+'+(d/(100-d)*100).toFixed(0)+'%',D.sizing!=='fixed'&&gN>0&&isFinite(gN)?Math.ceil(Math.log(1/(1-d/100))/gN).toLocaleString('en-US'):'\u2013']);
  return`<section class="dsec" data-step="5">${mHead(4)}<div class="dgrid">
  <div class="s4">${card('P(losing streak ≥ k) in '+H+' trades',ch(sb)+note('mn_streak',{q:pc(q,0),k:typ}))}</div>
  <div class="s4">${card('Equity after k straight losses',ch(ac)+lg([['var(--accent)','at '+D.risk+'%'],['var(--c3)','at '+(D.risk/2)+'%']])+note('mn_after'))}</div>
  <div class="s4">${card('Recovery maths',tbl(['Drawdown','Gain needed','Median trades to recover'],rec.map(x=>[x[0],x[1],x[2]]))+note('mn_recover'))}</div></div>${nextBar(4)}</section>`;}
function mCosts(m){
  if(!(D.sl>0))return`<section class="dsec" data-step="6">${mHead(5)}<div class="card">${note('mn_cost_need')}</div>${nextBar(5)}</section>`;
  const sprR=D.spread>0?D.spread/D.sl:0,comR=m.c-sprR,share=m.Eg>0?m.c/m.Eg:null,beSpread=(m.Eg-comR)*D.sl;
  const rows=[['Spread cost',rfmt(-sprR,3)],['Commission cost',D.comm>0&&!(D.pv>0)?'needs value per unit':rfmt(-comR,3)],['Total cost per trade',`<b>${rfmt(-m.c,3)}</b>`],['E[R] gross',rfmt(m.Eg,3)],['E[R] net',rfmt(m.En,3)],
    ['Costs as share of gross edge',share===null?'–':pc(share)],['Break-even spread',m.Eg>0?(+beSpread.toFixed(2))+' (same unit as SL)':'–'],['Break-even win rate, gross → net',pc(1/(1+m.b))+' → '+pc(m.be)]];
  const smax=Math.max(D.spread*2.5,beSpread>0?beSpread*1.3:0,D.sl*0.1),ln=[];for(let i=0;i<=40;i++){const s=smax*i/40;ln.push([s,m.Eg-comR-s/D.sl]);}
  const cc=CH.plot({w:520,h:230,series:[{pts:ln,color:'var(--c1)',w:2}],hlines:[{y:0,color:'var(--bad)'}],markers:[{x:D.spread,y:m.En,color:'var(--accent)',r:5,label:'you'}],xfmt:v=>(+v.toFixed(1))+'',yfmt:v=>(+v.toFixed(2))+'',xlabel:'spread (same unit as SL)',ylabel:'E[R] net',label:'Net expectancy by spread'});
  return`<section class="dsec" data-step="6">${mHead(5)}<div class="dgrid">
  <div class="s5">${card('Cost breakdown (per trade)',kv(rows)+note('mn_cost'))}</div>
  <div class="s7">${card('Net expectancy vs spread',ch(cc)+note('mn_spread'))}</div></div>${nextBar(5)}</section>`;}

/* ---------- grid / martingale / no-stop ---------- */
const money=v=>{if(!isFinite(v))return v<0?'−∞':'∞';const a=Math.abs(v);return(v<0?'−':'')+a.toLocaleString('en-US',{minimumFractionDigits:a>=1000?0:2,maximumFractionDigits:a>=1000?0:2});};
const lf=x=>String(+x.toPrecision(2));const negp=v=>v>0.05?'−'+pip(v):'0';
const pip=v=>isFinite(v)?(+v.toFixed(v>=100?0:1)).toLocaleString('en-US'):'∞';
function gParams(){const ns=D.stype==='nostop',pv=D.pv>0?D.pv:10;return{ns,pv,pvSet:D.pv>0,M:ns?1:D.gMax,mult:ns||D.gGrow==='add'?1:D.gMult,add:!ns&&D.gGrow==='add'?D.gAdd:0,step:ns?0:D.gStep,cpl:(D.spread>0?D.spread*pv:0)+(D.comm>0?D.comm:0)};}
function gLadder(G){
  const L=[];let Lt=0,S=0,cost=0;
  for(let k=0;k<G.M;k++){const lot=G.add>0?D.gLot+k*G.add:D.gLot*Math.pow(G.mult,k),d=k*G.step;Lt+=lot;S+=lot*d;cost+=lot*G.cpl;const a=S/Lt;L.push({k:k+1,lot,Lt,d,a,cost,loss:Lt*(d-a)*G.pv+cost});}
  const lossAt=d=>{let i=0;while(i+1<L.length&&L[i+1].d<=d)i++;const r=L[i];return r.Lt*(d-r.a)*G.pv+r.cost;};
  const distTo=target=>{for(let i=0;i<L.length;i++){const r=L[i],end=i+1<L.length?L[i+1].d:Infinity,d=r.a+(target-r.cost)/(r.Lt*G.pv);if(d>=r.d&&d<end)return Math.max(0,d);if(d<r.d&&r.loss>=target)return r.d;}return Infinity;};
  const last=L[L.length-1],stopD=D.gSl>0?last.d+D.gSl:null,stopLoss=stopD!==null?lossAt(stopD):null;
  return{L,lossAt,wipeD:distTo(D.bal),ruinD:distTo(D.bal*D.ruin/100),stopD,stopLoss,last};}
function computeGrid(){
  const G=gParams(),lad=gLadder(G),sigD=D.gVol/1.596,mk=k=>({lot0:D.gLot*k,add:G.add*k,step:G.step,mult:G.mult,maxN:G.M,tp:D.gTp,sl:D.gSl,sigD,fat:D.gMkt==='real',cpl:G.cpl,pv:G.pv,lossCap:D.bal*40,N:4000,capDays:120,seed:31});
  const pool=SFX.gridPool(mk(1)),po={B0:D.bal,H:D.hor,ruin:D.ruin/100,scale:D.gAuto==='scale'};
  const sim=SFX.gridPaths(pool,Object.assign({sims:2000,seed:41,keep:50,bands:true},po));
  const pn=Array.from(pool.pnl),N=pn.length,w=pn.filter(x=>x>0),l=pn.filter(x=>x<=0),sum=a=>a.reduce((x,y)=>x+y,0);
  const E=sum(pn)/N,se=SFX.sd(pn)/Math.sqrt(N),avgW=w.length?sum(w)/w.length:0,avgL=l.length?sum(l)/l.length:0,worst=amin(pn);
  const mae=Array.from(pool.mae),pWipe1=mae.filter(x=>x>=D.bal).length/N,pRuin1=mae.filter(x=>x>=D.bal*D.ruin/100).length/N;
  const days=Array.from(pool.days).sort((a,b)=>a-b),dMean=SFX.mean(days),kinds=[0,1,2,3].map(k=>Array.from(pool.kind).filter(x=>x===k).length/N);
  const reach=[];for(let k=1;k<=G.M;k++)reach.push(Array.from(pool.lev).filter(x=>x>=k).length/N);
  const ks=[0.1,0.2,0.3,0.5,0.75,1,1.5,2,3],sweep=ks.map(k=>{const r=k===1?sim:SFX.gridPaths(pool,Object.assign({sims:800,seed:43,k},po));return{k,lot:D.gLot*k,ruin:r.ruinProb,wipe:r.wipeProb};});
  let safe=null;sweep.forEach(x=>{if(x.ruin<=0.05&&(safe===null||x.lot>safe))safe=x.lot;});
  /* how much the result leans on the daily range guess: same rules at 1.5x the range */
  const hiPool=SFX.gridPool(Object.assign(mk(1),{sigD:sigD*1.5})),sens={v2:Math.round(D.gVol*1.5),ruin:SFX.gridPaths(hiPool,Object.assign({sims:2000,seed:41},po)).ruinProb};
  const ruinP=sim.ruinProb,neg=E+2*se<0;let v;if(ruinP>=0.30)v='bad';else if(ruinP>0.05||neg||pWipe1>0.001)v='warn';else v='ok';
  D.gm={sens,G,lad,pool,sim,N,E,se,avgW,avgL,worst,win:w.length/N,pWipe1,pRuin1,days,dMean,kinds,reach,sweep,safe,v,neg,sumW:sum(w),sumL:sum(l)};}
function gHead(name,i){return`<h2>${esc(name)}<small>${esc(t(D.stype==='grid'?'st_grid':'st_nostop'))}</small></h2>`;}
function gExpl(g){
  const X={},H=D.hor,F=simFacts(g.sim),lad=g.lad,ratio=g.avgW>0?Math.abs(g.avgL)/g.avgW:0;
  X.gn_stats={now:t('ge_stats',{win:pc(g.win),aw:money(g.avgW),al:money(g.avgL),x:ratio>=1?Math.round(ratio).toLocaleString('en-US'):'–',E:money(g.E),se:money(2*g.se)})+(g.neg?' '+t('ge_stats_neg'):' '+t('ge_stats_zero'))};
  X.gn_fan={now:t('ge_fan',{H,med:eqFmt(F.med),p5:eqFmt(F.p5),p95:eqFmt(F.p95),ruin:pc(g.sim.ruinProb),wipe:pc(g.sim.wipeProb)}),todo:g.v==='ok'?t('ga_ok'):g.safe!==null&&g.safe<D.gLot?t('ga_reduce',{x:lf(g.safe)}):g.safe!==null&&g.neg?t('ga_neg'):t('ga_redesign')};
  X.gn_ladder={now:D.stype==='grid'?t('ge_ladder',{n:g.G.M,lots:lad.last.Lt.toFixed(2),d:pip(lad.last.d),loss:money(lad.last.loss),pct:pc(lad.last.loss/D.bal),need:pip(lad.last.d-lad.last.a+D.gTp)}):t('ge_ladder_ns',{lots:D.gLot,v:money(D.gLot*g.G.pv)})};
  X.gn_curve={now:t('ge_curve',{ruin:pip(lad.ruinD),dd:D.ruin,wipe:pip(lad.wipeD),days:isFinite(lad.wipeD)?(lad.wipeD/D.gVol).toFixed(1):'∞'})+(lad.stopD!==null?' '+t(lad.stopD<lad.wipeD?'ge_curve_stop':'ge_curve_stop_late',{d:pip(lad.stopD),loss:money(lad.stopLoss),pct:pc(lad.stopLoss/D.bal)}):'')};
  if(D.stype==='grid'){const r=g.reach,M=g.G.M;X.gn_reach={now:t('ge_reach',{p3:pc(r[Math.min(2,M-1)]),M,pM:pc(r[M-1])})};}
  X.gn_money={now:t('ge_money',{w:money(g.sumW/g.N*1000),l:money(g.sumL/g.N*1000),net:money(g.E*1000)})};
  X.gn_surv={now:t('ge_surv',{ruin:pc(g.sim.ruinProb),dd:D.ruin,wipe:pc(g.sim.wipeProb),H,dd95:dpc(F.dd95)})};
  X.gn_sweep={now:g.safe!==null?t('ge_sweep',{x:lf(g.safe),cur:D.gLot})+(g.safe<0.01?' '+t('g_minlot'):''):t('ge_sweep_none',{x:lf(D.gLot*0.1)}),todo:g.safe!==null&&g.safe<D.gLot?t('ga_reduce',{x:lf(g.safe)}):g.safe===null?t('ga_redesign'):null};
  return X;}
function gSummary(g){
  const H=D.hor,sim=g.sim,lad=g.lad,ratio=g.avgW>0?Math.abs(g.avgL)/g.avgW:0,F=simFacts(sim);
  const line=t('gvl',{win:pc(g.win),aw:money(g.avgW),lose:pc(1-g.win),al:money(g.avgL),x:ratio>=1?Math.round(ratio).toLocaleString('en-US'):'–',E:money(g.E),H,dd:D.ruin,ruin:pc(sim.ruinProb),wipe:pc(sim.wipeProb)});
  const tiles=[['ok',t('gt_win'),pc(g.win)],['',t('gt_avgw'),money(g.avgW)],['bad',t('gt_avgl'),money(g.avgL)],['bad',t('gt_wipe'),isFinite(lad.wipeD)?pip(lad.wipeD)+' pips':'—']];
  const rows=[['Cycles simulated',g.N.toLocaleString('en-US')],['Cycles won',pc(g.win)],['Average win / loss',money(g.avgW)+' / '+money(g.avgL)],['Worst cycle',money(g.worst)],
    ['Expected result per cycle',`<b>${money(g.E)}</b> ± ${money(2*g.se)}`],['Cycles ending at the final stop',pc(g.kinds[1])],['Cycles still open after 120 days',pc(g.kinds[2])],
    ['Cycle length median / p95',(SFX.quantile(g.days,0.5)).toFixed(1)+' / '+(SFX.quantile(g.days,0.95)).toFixed(1)+' days'],['One cycle wipes out the start balance',pc(g.pWipe1,2)],['Horizon',H+' cycles ≈ '+cmpNum(Math.ceil(H*g.dMean))+' trading days']];
  const fan=CH.fan(sim,{w:520,h:280,floorLabel:t('d_ruin_line',{x:D.ruin}),xlabel:t('gx_next',{H}),medColor:'var(--accent)',label:'Monte Carlo equity fan'});
  const notes=[t('g_model_'+D.gMkt)];if(!g.G.pvSet)notes.push(t('g_pv_assumed'));
  const sensP=`<p class="small" style="margin:.8rem 0 0">${esc(t('g_sens',{v:D.gVol,v2:g.sens.v2,dd:D.ruin,H,a:pc(sim.ruinProb),b:pc(g.sens.ruin)}))}</p>`;
  return`<section class="dsec" data-step="1">${gHead('Summary')}
  <div class="card"><div class="dverdict"><span class="light" data-v="${g.v}" aria-hidden="true">${ICON[g.v]}</span><div><h2>${esc(t('gv_'+g.v))}</h2><p class="small" style="margin:0">${esc(line)}</p></div></div>
  <div class="gtile">${tiles.map(x=>`<div class="${x[0]}"><span>${esc(x[1])}</span><b>${esc(x[2])}</b></div>`).join('')}</div>
  ${sensP}${notes.map(n=>`<p class="warnnote small" style="margin:.8rem 0 0">${esc(n)}</p>`).join('')}</div>
  <div class="dgrid"><div class="s5">${card('Cycle statistics',kv(rows)+note('gn_stats'))}</div>
  <div class="s7">${card('Monte Carlo: '+sim.fin.length.toLocaleString('en-US')+' paths, '+H+' cycles',ch(fan)+note('gn_fan'))}</div></div></section>`;}
function gExposure(g){
  const lad=g.lad,G=g.G,last=lad.last,dmax0=Math.max(last.d*1.5,D.gTp*4,D.gVol*3),xmax=isFinite(lad.wipeD)?Math.min(lad.wipeD*1.12,Math.max(dmax0,lad.stopD||0,Math.min(lad.wipeD*1.12,40*D.gVol))):Math.max(dmax0,40*D.gVol);
  const pts=[];for(let i=0;i<=240;i++){const d=xmax*i/240;pts.push([d,lad.lossAt(d)/D.bal*100]);}
  const ymax=Math.max(110,Math.min(400,pts[pts.length-1][1]*1.05));
  const vl=[];if(isFinite(lad.wipeD)&&lad.wipeD<=xmax)vl.push({x:lad.wipeD,color:'var(--bad)'});if(lad.stopD!==null&&lad.stopD<=xmax)vl.push({x:lad.stopD,color:'var(--warn)',label:'final stop'});
  const cv=CH.plot({w:520,h:250,series:[{pts,color:'var(--c1)',w:2}],dots:G.ns?[]:lad.L.filter(r=>r.d<=xmax).map(r=>({x:r.d,y:r.loss/D.bal*100,r:3,color:'var(--accent)',op:1})),hlines:[{y:D.ruin,color:'var(--warn)',label:t('d_ruin_line',{x:D.ruin})},{y:100,color:'var(--bad)',label:'100% = wiped out'}],vlines:vl,xlo:0,xhi:xmax,ylo:0,yhi:ymax,xfmt:v=>pip(v),yfmt:v=>v+'%',xlabel:'pips against the first entry',ylabel:'floating loss',label:'Floating loss by adverse move'});
  let left;
  if(!G.ns){left=tbl(['Order','Lots','Total lots','Opens at','Avg entry','Floating loss','Bounce to TP'],lad.L.map(r=>[String(r.k),r.lot.toFixed(2),r.Lt.toFixed(2),negp(r.d),negp(r.a),money(r.loss)+' ('+pc(r.loss/D.bal)+')',pip(r.d-r.a+D.gTp)]));}
  else left=kv([['Position size',D.gLot+' lots'],['Value per pip',money(D.gLot*G.pv)],['Take-profit',D.gTp+' pips = '+money(D.gLot*G.pv*D.gTp-D.gLot*G.cpl)],['Exit if down',D.gSl>0?D.gSl+' pips = '+money(-(lad.stopLoss||0)):'none']]);
  left+=kv([['Move to the ruin line (−'+D.ruin+'%)',pip(lad.ruinD)+' pips'],['Move that wipes out the account',`<b>${pip(lad.wipeD)} pips</b>`],['… in average daily ranges',isFinite(lad.wipeD)?(lad.wipeD/D.gVol).toFixed(1)+'×':'–']]);
  return`<section class="dsec" data-step="2">${gHead('Exposure')}<div class="dgrid">
  <div class="${G.ns?'s5':'s7'}">${card(G.ns?'Position':'Exposure ladder',left+note('gn_ladder'))}</div>
  <div class="${G.ns?'s7':'s5'}">${card('Floating loss vs adverse move',ch(cv)+lg([['var(--c1)',t('lg_float')]].concat(G.ns?[]:[['var(--accent)',t('lg_fill')]]))+note('gn_curve'))}</div></div></section>`;}
function gOutcomes(g){
  const G=g.G,M=G.M,mae=Array.from(g.pool.mae),lv=[1,5,10,25,D.ruin,100].filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a-b);
  const mh=CH.bars({w:420,h:220,items:lv.map(x=>({label:'≥'+x+'%',value:mae.filter(m=>m>=D.bal*x/100).length/g.N*100,color:x>=D.ruin?'var(--bad)':'var(--c1)'})),ymax:100,yfmt:v=>v+'%',valFmt:v=>v===0?'0':v<0.1?'<0.1':v<10?v.toFixed(1):Math.round(v)+'',xlabel:'worst floating loss, % of balance',ylabel:'share of cycles',label:'How deep the floating loss gets'});
  const mb=CH.bars({w:420,h:220,items:[{label:'wins',value:g.sumW/g.N*1000,color:'var(--ok)'},{label:'losses',value:g.sumL/g.N*1000,color:'var(--bad)'},{label:'net',value:g.E*1000,color:'var(--accent)'}],yfmt:v=>(v<0?'−':'')+cmpNum(Math.abs(v)),valFmt:v=>money(v),label:'Money from wins and losses per 1,000 cycles'});
  let reach='';
  if(!G.ns){const it=g.reach.map((p,i)=>({label:String(i+1),value:p*100,color:i===M-1?'var(--bad)':'var(--c2)'}));
    reach=`<div class="s4">${card('How deep cycles go',ch(CH.bars({w:420,h:220,items:it,ymax:100,yfmt:v=>v+'%',valFmt:v=>v<1?(v<0.1?'<.1':v.toFixed(1)):Math.round(v)+'',xlabel:'order number',ylabel:'cycles reaching it',label:'Share of cycles that reach each order'}))+note('gn_reach'))}</div>`;}
  const w=G.ns?'s6':'s4';
  return`<section class="dsec" data-step="3">${gHead('Cycle outcomes')}<div class="dgrid">${reach}
  <div class="${w}">${card('How deep the floating loss gets',ch(mh)+note('gn_mae'))}</div>
  <div class="${w}">${card('Where the money goes (per 1,000 cycles)',ch(mb)+note('gn_money'))}</div></div></section>`;}
function gSurvival(g){
  const sim=g.sim,H=D.hor,N=sim.fin.length,fq=x=>eqFmt(SFX.quantile(sim.fin,x)),dq=x=>'−'+(SFX.quantile(sim.dd,x)*100).toFixed(1)+'%';
  const ra=Array.from(sim.ruinAt).filter(x=>x>0).sort((a,b)=>a-b),wa=Array.from(sim.wipeAt).filter(x=>x>0).sort((a,b)=>a-b);
  const rows=[['First order size',D.gLot+' lots ('+(D.gAuto==='scale'?'grows with balance':'fixed')+')'],['Ruin threshold','−'+D.ruin+'% from start'],['P(ruin)','<b>'+pc(sim.ruinProb)+'</b>'],['P(account wiped out)','<b>'+pc(sim.wipeProb)+'</b>'],
    ['Median cycle # of ruin',ra.length?ra[Math.floor(ra.length/2)]:'–'],['Equity p5 / p50 / p95',`${fq(0.05)} / ${fq(0.5)} / ${fq(0.95)}`],['Max DD p50 / p95 / p99',`${dq(0.5)} / ${dq(0.95)} / ${dq(0.99)}`]];
  const step=Math.max(1,Math.round(H/120)),rc=[],wc=[];let a=0,b=0;for(let i=0;i<=H;i+=step){while(a<ra.length&&ra[a]<=i)a++;while(b<wa.length&&wa[b]<=i)b++;rc.push([i,a/N*100]);wc.push([i,b/N*100]);}
  if(rc[rc.length-1][0]!==H){rc.push([H,ra.length/N*100]);wc.push([H,wa.length/N*100]);}
  const rcv=CH.plot({w:520,h:230,series:[{pts:rc,color:'var(--warn)',w:2.2},{pts:wc,color:'var(--bad)',w:2.2}],hlines:[{y:5,color:'var(--muted)',label:'5%'}],xlo:0,xhi:H,ylo:0,yhi:Math.max(10,Math.min(100,sim.ruinProb*125)),yfmt:v=>(+v.toFixed(1))+'%',xlabel:'cycles',ylabel:'cumulative probability',label:'Cumulative ruin and wipe-out probability'});
  const sw=g.sweep,sv=CH.plot({w:520,h:230,series:[{pts:sw.map(x=>[x.lot,x.ruin*100]),color:'var(--warn)',w:2},{pts:sw.map(x=>[x.lot,x.wipe*100]),color:'var(--bad)',w:2}],dots:sw.map(x=>({x:x.lot,y:x.ruin*100,r:3,color:'var(--warn)',op:1})),hlines:[{y:5,color:'var(--muted)',label:'5%'}],markers:[{x:D.gLot,y:sim.ruinProb*100,color:'var(--accent)',r:5,label:'you'}],xlo:0,ylo:0,yhi:100,xfmt:v=>(+v.toFixed(3))+'',yfmt:v=>v+'%',xlabel:'first order size (lots)',ylabel:'probability over '+H+' cycles',label:'Ruin probability by first order size'});
  const swRows=sw.map(x=>[lf(x.lot)+(Math.abs(x.lot-D.gLot)<1e-9?' (you)':''),pc(x.ruin),pc(x.wipe)]);
  return`<section class="dsec" data-step="4">${gHead('Survival and sizing')}<div class="dgrid">
  <div class="s5">${card('Survival metrics',kv(rows)+note('gn_surv'))}</div>
  <div class="s7">${card('Cumulative P(ruin) by cycle',ch(rcv)+lg([['var(--warn)',t('lg_g_ruin',{x:D.ruin})],['var(--bad)',t('lg_g_wipe')]])+note('gn_ruincurve'))}</div>
  <div class="s7">${card('P(ruin) vs first order size',ch(sv)+lg([['var(--warn)',t('lg_g_ruin',{x:D.ruin})],['var(--bad)',t('lg_g_wipe')]])+note('gn_sweep'))}</div>
  <div class="s5">${card('Size table ('+H+' cycles)',tbl(['First order','P(ruin)','P(wiped out)'],swRows)+note('gn_sizetab'))}</div></div></section>`;}
/* real history from the file next to the simulation (money rescaled to the fitted first order) */
function gReal(g){
  const f=D.fit;if(!f||!D.parsed)return'';const r=f.real,M=g.G.M,days=Array.from(g.days),mae=amax(Array.from(g.pool.mae));
  const rr=k=>k<=r.reach.length?r.reach[k-1]:0,ks=[...new Set([2,3,Math.ceil((M+1)/2),M].filter(k=>k>=2&&k<=M))].sort((x,y)=>x-y);
  const rows=[['Cycles','4,000',r.cycles.toLocaleString('en-US')],['Cycles won',pc(g.win),pc(r.win)],['Average win',money(g.avgW),money(r.avgW)],
    ['Average loss',money(g.avgL),r.losses?money(r.avgL):'none'],['Losing cycles',pc(1-g.win,1),pc(r.losses/r.cycles,1)],['Worst cycle',money(g.worst),money(r.worst)],
    ['Deepest floating loss in one cycle',money(-mae),isFinite(r.deep)?'≤ '+money(-r.deep):'–']]
    .concat(D.stype==='grid'?ks.map(k=>['Cycles reaching order '+k,pc(g.reach[k-1],1),pc(rr(k),1)]):[])
    .concat([['Median cycle length',SFX.quantile(days,0.5).toFixed(1)+' days',r.days.toFixed(1)+' days']]);
  let line='';
  if(D.stype==='grid'&&M>=3){const k=Math.min(M,3),a=g.reach[k-1],b=rr(k);line=b>a*1.5+0.01?t('gr_worse',{k,a:pc(a,1),b:pc(b,1)}):a>b*1.5+0.01?t('gr_harsher',{k,a:pc(a,1),b:pc(b,1)}):t('gr_close',{k,a:pc(a,1),b:pc(b,1)});}
  else{const a=g.win,b=r.win;line=Math.abs(a-b)<0.05?t('gr_close_ns'):t(b<a?'gr_worse_ns':'gr_harsher_ns',{a:pc(a),b:pc(b)});}
  return`<section class="dsec" data-step="0" id="real-sec"><h2>Your history vs the simulation<small>${esc(D.symbol+' · '+t('gr_scaled',{lot:D.gLot}))}</small></h2><div class="dgrid">
  <div class="s12">${card('Real cycles next to simulated cycles',tbl(['','Simulation','Your history'],rows)+`<p class="small" style="margin:.6rem 0 0">${esc(t('gr_when',{from:dfmt0(r.from),to:dfmt0(r.to),w:dfmt0(r.worstAt),d:isFinite(r.deep)?dfmt0(r.deepAt):'–'})+' '+line+' '+t('gr_tail',{c:r.cycles.toLocaleString('en-US'),d:Math.max(1,Math.round((r.to-r.from)/864e5)).toLocaleString('en-US')}))}</p>`+note('gn_real'))}</div></div></section>`;}
const dfmt0=ms=>new Date(ms).toISOString().slice(0,10);
function drawGrid(){
  const g=D.gm;if(!g)return;EXPL=gExpl(g);
  $('d-main').innerHTML=gSummary(g)+gExposure(g)+gOutcomes(g)+gSurvival(g)+gReal(g);rowAlign();applyLayout();}


/* ---------- drawing ---------- */
function verdictLine(r){
  const s=r.stats,o={E:rfmt(s.expectancy),lo:rfmt(r.boot.ci[0]),hi:rfmt(r.boot.ci[1]),t:s.t.toFixed(2),n:r.n,ruin:blowFmt(r.sim.ruinProb),dd:D.ruin,risk:D.risk,H:r.H,basis:t(r.conv.usedNet?'basis_net':'basis_gross')};
  return t('dvl',o)+' '+t('dvx_'+r.verdict,o);}
function warnings(r){
  const w=[];
  if(r.n<30)w.push(t('w_small',{n:r.n}));
  if(D.net==='net'&&!r.conv.usedNet)w.push(t('w_nonet'));
  const med=SFX.median(r.R.map(Math.abs));if(med<0.15||med>6)w.push(t('w_units',{m:med.toFixed(2)}));
  return w.length?`<div class="warnnote" style="margin-bottom:1rem">${w.map(x=>esc(x)).join('<br>')}</div>`:'';}
function secSummary(r){
  const s=r.stats,n=r.n,tr=r.trades;
  const eq=CH.plot({w:520,h:230,series:[{pts:r.cum.map((v,i)=>[i,v]),color:'var(--c1)',w:1.8}],hlines:[{y:0,color:'var(--muted)'}],xlabel:t('x_trades'),ylabel:'ΣR',yfmt:v=>(+v.toFixed(1))+'',label:'Equity curve in R'});
  const uwc=CH.plot({w:520,h:170,series:[{pts:r.uw.map((v,i)=>[i,v]),color:'var(--bad)',w:1.2}],areas:[{upper:r.uw.map((v,i)=>[i,0]),lower:r.uw.map((v,i)=>[i,v]),color:'var(--bad)',op:0.22}],xlabel:t('x_trades'),ylabel:'R',yfmt:v=>(+v.toFixed(1))+'',yhi:0,label:'Drawdown in R'});
  const needTxt=s.nNeeded===null?t('na_neg'):(s.nNeeded>100000?'>100,000':s.nNeeded.toLocaleString('en-US'));
  const rows=[['Trades',`${n}${s.scratch?` (${s.scratch} flat)`:''}`],['Period',`${dstr(tr[0].open)} → ${dstr(tr[n-1].close)}`],
    ['Win rate',`${(s.winRate*100).toFixed(1)}% [${(r.wl[0]*100).toFixed(0)}–${(r.wl[1]*100).toFixed(0)}]`],
    ['Avg win',rfmt(s.avgWin)],['Avg loss',rfmt(s.avgLoss)],[`E[R] (${t(r.conv.usedNet?'basis_net':'basis_gross')})`,`<b>${rfmt(s.expectancy,3)}</b>`],
    ['95% CI (bootstrap)',`[${sgn(r.boot.ci[0],2)}, ${sgn(r.boot.ci[1],2)}]`],['P(E[R] > 0)',(r.boot.probPos*100).toFixed(0)+'%'],['t-stat',s.t.toFixed(2)],
    ['Profit factor',isFinite(s.pf)?s.pf.toFixed(2):'∞'],['σ(R)',s.sd.toFixed(2)],['Best / worst',`${rfmt(s.best)} / ${rfmt(s.worst)}`],
    ['Max losing / winning run',`${s.maxLoseStreak} / ${s.maxWinStreak}`],['Trades for t ≥ 1.96',needTxt]];
  return`<section class="dsec" data-step="7">${hHead('summary',D.symbol)}${warnings(r)}
  <div class="card"><div class="dverdict"><span class="light" data-v="${r.verdict}" aria-hidden="true">${ICON[r.verdict]}</span><div><h2>${esc(t('dv_'+r.verdict))}</h2><p class="small" style="margin:0">${esc(verdictLine(r))}</p></div></div></div>
  <div class="dgrid"><div class="s5">${card('Summary statistics',kv(rows)+note('n_hstats'))}</div>
  <div class="s7">${card('Equity curve (cumulative R)',ch(eq)+note('n_equity'))}${card('Underwater (R below peak)',ch(uwc)+note('n_uw'))}</div></div></section>`;}
function secEdge(r){
  const s=r.stats,R=r.R,lo=Math.floor(amin(R)*2)/2,hi=Math.ceil(amax(R)*2)/2;
  const h1=CH.histo({w:420,h:230,bins:SFX.hist(R,Math.max(8,Math.min(24,Math.round(Math.sqrt(r.n)*2))),lo,hi),colorFn:b=>b.x1<=0?'var(--c2)':(b.x0>=0?'var(--c1)':'var(--c3)'),vlines:[{x:s.expectancy,color:'var(--ink)',label:'E[R]'}],xfmt:v=>(+v.toFixed(1))+'',xlabel:'R',ylabel:t('y_count'),label:'R distribution'});
  const bm=Array.from(r.boot.means),h2=CH.histo({w:420,h:230,bins:SFX.hist(bm,30),colorFn:b=>b.x1<=0?'var(--c2)':'var(--c1)',vlines:[{x:0,color:'var(--bad)',dash:true,label:'0'},{x:r.boot.ci[0],color:'var(--muted)',dash:true},{x:r.boot.ci[1],color:'var(--muted)',dash:true}],xfmt:v=>(+v.toFixed(2))+'',xlabel:'E[R]',label:'Bootstrap distribution of expectancy'});
  const w=Math.max(10,Math.min(30,Math.floor(r.n/3))),roll=r.n>=w+5?SFX.rolling(R,w):null;
  const rl=roll?CH.plot({w:420,h:230,series:[{pts:roll.map((v,i)=>[i+w,v]),color:'var(--c1)',w:1.8}],hlines:[{y:0,color:'var(--bad)'},{y:s.expectancy,color:'var(--c2)',label:'mean'}],xlabel:t('x_trades'),ylabel:'E[R]',yfmt:v=>(+v.toFixed(2))+'',label:'Rolling expectancy'}):null;
  const ls=s.streaks.loss,maxL=ls.length?amax(ls):0,cnt=[];for(let k=1;k<=Math.max(maxL,4);k++)cnt.push({label:String(k),value:ls.filter(x=>x===k).length,color:'var(--c2)'});
  const q=s.losses/r.n,sb=CH.bars({w:420,h:200,items:cnt,yfmt:v=>Number.isInteger(v)?v:'',xlabel:t('x_runlen'),label:'Losing run lengths'});
  const pk=[3,5,7,10].map(k=>['P(≥ '+k+' losses in a row, '+r.H+' trades)',(SFX.probStreak(q,k,r.H)*100).toFixed(1)+'%']);
  return`<section class="dsec" data-step="7">${hHead('edge')}<div class="dgrid">
  <div class="s6">${card('R-multiple distribution',ch(h1)+note('n_rdist'))}</div>
  <div class="s6">${card('Expectancy: bootstrap (4,000 resamples)',ch(h2)+note('n_boot',{p:(r.boot.probPos*100).toFixed(0)}))}</div>
  <div class="s6">${card('Rolling expectancy ('+w+' trades)',rl?ch(rl)+note('n_roll'):note('n_roll_none'))}</div>
  <div class="s6">${card('Losing runs',ch(sb)+kv(pk)+note('n_runs',{q:(q*100).toFixed(0)}))}</div></div></section>`;}
function secSurvival(r){
  const m=D.model,s=r.stats,a=m.sim,b=r.sim,q=(x,p)=>SFX.quantile(x.fin,p),d=(x,p)=>dpc(SFX.quantile(x.dd,p));
  const rows=[['Win rate',pc(m.p,0),pc(s.winRate,0)],['Average win (R)',rfmt(m.W),rfmt(s.avgWin)],['Average loss (R)',rfmt(-m.L),rfmt(s.avgLoss)],['Worst single trade (R)',rfmt(-m.L),rfmt(s.worst)],
    ['Average per trade (expectancy)',rfmt(m.En,3),rfmt(s.expectancy,3)],['Swing per trade (\u03c3)',m.sdR.toFixed(2)+'R',s.sd.toFixed(2)+'R'],
    ['Chance of ruin','<b>'+pc(a.ruinProb)+'</b>','<b>'+pc(b.ruinProb)+'</b>'],['Typical final balance (median)',eqFmt(q(a,0.5)),eqFmt(q(b,0.5))],['Bad case final balance (1 in 20)',eqFmt(q(a,0.05)),eqFmt(q(b,0.05))],
    ['Typical deepest fall (median drawdown)',d(a,0.5),d(b,0.5)],['Bad-case fall (1 in 20)','<b>'+d(a,0.95)+'</b>','<b>'+d(b,0.95)+'</b>'],['Fastest-growth risk (Kelly)',pc(m.K),pc(r.optF.f)]];
  return`<section class="dsec" data-step="7">${hHead('survival')}<div class="dgrid">
  <div class="s12">${card('Model vs your real trades ('+D.risk+'% risk, '+r.H+' trades)',tbl(['Measure','Model (your inputs)','Your real trades'],rows)+note('n_cmp'))}</div></div></section>`;}
function secBehavior(r){
  const b=r.beh,R=r.R,d=b.disc,tr=r.trades;
  const sideRow=sd=>{const a=b.side[sd],s=a.length?SFX.tradeStats(a):null;return s?[sd==='buy'?'Long':'Short',`${a.length} · ${(s.winRate*100).toFixed(0)}% · ${rfmt(s.expectancy)}`]:[sd==='buy'?'Long':'Short','–'];};
  const dp=x=>d.n?Math.round(x/d.n*100)+'%':'–';
  const dis=[['Losing trades',d.n],['Within ±15% of 1 SL',`${d.onStop} (${dp(d.onStop)})`],['Worse than 1.15 SL',`${d.worse} (${dp(d.worse)})`],['Better than 0.85 SL',`${d.early} (${dp(d.early)})`]];
  const dayItems=[1,2,3,4,5,0,6].filter(i=>b.dw[i].n>0||(i>0&&i<6)).map(i=>({label:DAYS[i],value:b.dw[i].n?b.dw[i].s/b.dw[i].n:0,faint:b.dw[i].n<5}));
  const hrItems=b.hr.map((h,i)=>({label:String(i),value:h.n?h.s/h.n:0,faint:h.n<5}));
  const dayC=CH.bars({w:420,h:210,items:dayItems,yfmt:v=>(+v.toFixed(1))+'',valFmt:null,ylabel:'avg R',label:'Average R by weekday'}),hrC=CH.bars({w:420,h:210,items:hrItems,every:3,yfmt:v=>(+v.toFixed(1))+'',xlabel:t('x_hour'),ylabel:'avg R',label:'Average R by hour'});
  const durPts=tr.map((x,i)=>({x:Math.log10(Math.max(1,b.dur[i])),y:R[i],color:R[i]>=0?'var(--c1)':'var(--c2)',op:0.8,r:3}));
  const durC=CH.plot({w:420,h:220,dots:durPts,hlines:[{y:0,color:'var(--muted)'}],xfmt:v=>{const m=Math.pow(10,v);return m>=60?Math.round(m/60)+'h':Math.round(m)+'m';},xticks:5,xlabel:t('x_duration'),ylabel:'R',yfmt:v=>(+v.toFixed(1))+'',label:'Trade duration vs result'});
  const have=r.conv.mae.filter(isFinite).length>=r.n*0.5;let mae='',mfe='',maeRows='';
  if(have){
    const pm=[],pf=[];tr.forEach((x,i)=>{if(isFinite(r.conv.mae[i]))pm.push({x:r.conv.mae[i],y:R[i],color:R[i]>=0?'var(--c1)':'var(--c2)',op:0.8,r:3});if(isFinite(r.conv.mfe[i]))pf.push({x:r.conv.mfe[i],y:R[i],color:R[i]>=0?'var(--c1)':'var(--c2)',op:0.8,r:3});});
    mae=CH.plot({w:420,h:230,dots:pm,hlines:[{y:0,color:'var(--muted)'}],vlines:[{x:-1,color:'var(--bad)',label:'−1R'}],xfmt:v=>(+v.toFixed(1))+'',xlabel:'MAE (R)',ylabel:'final R',yfmt:v=>(+v.toFixed(1))+'',label:'Max adverse excursion vs result'});
    mfe=CH.plot({w:420,h:230,dots:pf,hlines:[{y:0,color:'var(--muted)'}],vlines:[{x:1,color:'var(--ok)',label:'+1R'}],xfmt:v=>(+v.toFixed(1))+'',xlabel:'MFE (R)',ylabel:'final R',yfmt:v=>(+v.toFixed(1))+'',label:'Max favourable excursion vs result'});
    const wm=[];tr.forEach((x,i)=>{if(R[i]>0&&isFinite(r.conv.mae[i]))wm.push(r.conv.mae[i]);});
    if(wm.length)maeRows=kv([['Winners with MAE data',wm.length],['Median MAE of winners',rfmt(SFX.median(wm))],['Winners with MAE worse than −0.5R',Math.round(wm.filter(x=>x<-0.5).length/wm.length*100)+'%']]);}
  const lots=[['Distinct lot sizes',b.distinctLots],['Lot size CV',b.lotCV.toFixed(2)]];
  return`<section class="dsec" data-step="7">${hHead('behaviour')}<div class="dgrid">
  <div class="s4">${card('Stop discipline',kv(dis)+note(d.n&&d.worse/d.n>0.2?'n_disc_bad':'n_disc'))}</div>
  <div class="s4">${card('Side split (n · win% · E[R])',kv([sideRow('buy'),sideRow('sell')]))}</div>
  <div class="s4">${card('Position sizing',kv(lots)+note(b.distinctLots>1?'n_lots_var':'n_lots_fixed'))}</div>
  <div class="s6">${card('Average R by weekday (open, server time)',ch(dayC)+note('n_faint'))}</div>
  <div class="s6">${card('Average R by hour (open, server time)',ch(hrC))}</div>
  <div class="s6">${card('Duration vs result',ch(durC)+note('n_dur'))}</div>
  ${have?`<div class="s6">${card('MAE vs final R',ch(mae)+maeRows+note('n_mae'))}</div><div class="s6">${card('MFE vs final R',ch(mfe)+note('n_mfe'))}</div>`:`<div class="s6">${card('MAE / MFE',note('n_nomae'))}</div>`}
  </div></section>`;}
function secCosts(r){
  const gs=SFX.mean(r.conv.gross),ns=r.stats.expectancy,drag=gs-ns,used=r.conv.usedNet;
  const swap=r.trades.reduce((a,x)=>a+x.swap,0),com=r.trades.reduce((a,x)=>a+x.commission,0);
  const ser=[{pts:r.gcum.map((v,i)=>[i,v]),color:'var(--c3)',w:1.6}];if(used)ser.push({pts:r.cum.map((v,i)=>[i,v]),color:'var(--c1)',w:2});
  const cc=CH.plot({w:520,h:230,series:ser,hlines:[{y:0,color:'var(--muted)'}],xlabel:t('x_trades'),ylabel:'ΣR',yfmt:v=>(+v.toFixed(1))+'',label:'Gross vs net cumulative R'});
  const rows=[['E[R] gross (pips only)',rfmt(gs,3)],['E[R] net (incl. swap, commission)',used?rfmt(ns,3):'–'],['Cost drag per trade',used?rfmt(-drag,3):'–'],['Total swap',swap.toFixed(2)],['Total commission',com.toFixed(2)],
    ['Drag as share of avg win',used&&r.stats.avgWin>0?(drag/r.stats.avgWin*100).toFixed(1)+'%':'–']];
  return`<section class="dsec" data-step="7">${hHead('costs')}<div class="dgrid">
  <div class="s8">${card('Gross vs net, cumulative R',ch(cc)+legendHtml(used))}</div>
  <div class="s4">${card('Cost breakdown',kv(rows)+note('n_cost'))}</div></div></section>`;}
function legendHtml(used){return`<div class="legend"><span><i style="background:var(--c3)"></i>gross</span>${used?'<span><i style="background:var(--c1)"></i>net</span>':''}</div>`;}
/* ---------- explanations and report ---------- */
function exBlock(k,v){
  const e=EXPL[k],show=t(k,v);
  if(!e)return`<p class="small muted" style="margin:.55rem 0 0">${esc(show)}</p>`;
  return`<details class="ex"${D.explain?' open':''}><summary>${esc(t('ex_toggle'))}</summary><p><b>${esc(t('ex_show'))}</b> ${esc(show)}</p>`+
    (e.now?`<p><b>${esc(t('ex_now'))}</b> ${esc(e.now)}</p>`:'')+(e.todo?`<p><b>${esc(t('ex_do'))}</b> ${esc(e.todo)}</p>`:'')+`</details>`;}
function simFacts(sim){
  const fin=sim.fin,N=fin.length;let up=0,dbl=0;for(let i=0;i<N;i++){if(fin[i]>1)up++;if(fin[i]>=2)dbl++;}
  const dd=Array.from(sim.dd),ge=x=>dd.filter(d=>d>=x).length/N,qd=x=>SFX.quantile(sim.dd,x),qf=x=>SFX.quantile(fin,x);
  return{N,up:up/N,down:1-up/N,dbl:dbl/N,ruin:sim.ruinProb,ge,dd50:qd(0.5),dd95:qd(0.95),dd99:qd(0.99),ddmax:dd[dd.length-1],med:qf(0.5),p5:qf(0.05),p95:qf(0.95)};}
function sizeFacts(L,q){
  const r=D.risk/100*L,after=(rr,k)=>D.sizing==='fixed'?Math.max(0,1-k*rr):Math.pow(Math.max(0,1-rr),k),typ=SFX.typicalStreak(q,D.hor);
  const kr=rr=>rr<=0?Infinity:(D.sizing==='fixed'?Math.ceil(D.ruin/100/rr):(rr>=1?1:Math.ceil(Math.log(1-D.ruin/100)/Math.log(1-rr))));
  return{r,after,typ,kr:kr(r),kr2:kr(r/2),drop:1-after(r,Math.max(1,typ))};}
function safeFrom(sweep){let s=null;sweep.forEach(x=>{if(x.ruin<=0.05&&(s===null||x.risk>s))s=x.risk;});return s;}
const dpc=x=>'−'+pc(x);
function capK(K,sweep){const s=safeFrom(sweep);return pc(s===null?K/2:Math.min(K/2,s/100));}
function fixesFor(o,F){
  const a=[],risk=D.risk/100,safe=safeFrom(o.sweep);
  if(o.E<=0){a.push(t('a_noedge'));if(o.need)a.push(o.need);}
  else{
    if(F.ruin>0.05||(o.K>0&&risk>o.K))a.push(safe!==null&&safe<D.risk?t('a_reduce',{x:safe}):t('a_reduce_min',{x:pc(o.K/2)}));
    else if(o.K>0&&risk>o.K/2)a.push(t('a_halfkelly',{x:capK(o.K,o.sweep)}));
    if(o.lo<=0)a.push(o.nNeed?t('a_collect',{x:o.nNeed.toLocaleString('en-US')}):t('a_collect_many'));
    if(o.costShare>0.2)a.push(t('a_costs',{x:pc(o.costShare,0)}));
    if(!a.length)a.push(t('a_none',{x:capK(o.K,o.sweep)}));
  }
  a.push(t('a_review',{x:dpc(F.dd95)}));return a;}
function rpParts(o){
  const F=simFacts(o.sim),S=sizeFacts(o.L,o.q),kx=o.K>0?(D.risk/100)/o.K:null,H=D.hor,n100=x=>Math.round(x*100);
  const edge=t('rp_edge',{E:rfmt(o.E),E100:rfmt(o.E*100,0),wr:pc(o.wr,0),be:pc(o.be),margin:sgn((o.wr-o.be)*100,1),pf:isFinite(o.pf)?o.pf.toFixed(2):'∞',n:o.n,lo:rfmt(o.lo),hi:rfmt(o.hi),ppos:pc(o.ppos,0)});
  const out=[t('rp_out1',{up:n100(F.up),down:n100(F.down),ruin:n100(F.ruin)}),t('rp_out2',{odds:F.down>0?(F.up/F.down).toFixed(1):'∞'}),t('rp_out3',{med:eqFmt(F.med),p5:eqFmt(F.p5),p95:eqFmt(F.p95)}),t('rp_out4',{dbl:pc(F.dbl,0),dd20:pc(F.ge(0.2),0)})];
  const risk=[o.K>0?t('rp_risk1',{risk:D.risk,kx:kx===null?'–':kx.toFixed(2),K:pc(o.K)}):t('rp_risk1z',{risk:D.risk}),t('rp_risk2',{dd50:dpc(F.dd50),dd95:dpc(F.dd95),dd99:dpc(F.dd99)}),t('rp_risk3',{k:S.typ,drop:dpc(S.drop),kr:isFinite(S.kr)?S.kr:'–'})];
  return{edge,out,risk,H};}
function report(o){
  const r=rpParts(o),li=a=>`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  return`<div class="rp"><div><h3>${esc(t('rp_edge_t'))}</h3><p>${esc(r.edge)}</p></div><div><h3>${esc(t('rp_out_t',{H:r.H}))}</h3>${li(r.out)}</div><div><h3>${esc(t('rp_risk_t'))}</h3>${li(r.risk)}</div></div>`;}
function modelRpo(m){
  const se=Math.sqrt(Math.max(1e-12,m.p*(1-m.p)/D.n)),need=t('a_noedge_need',{be:pc(m.be),rr:(m.p>0?((m.q*m.L)/m.p+m.c):0).toFixed(2)});
  return{E:m.En,wr:m.p,be:m.be,pf:m.q>0?(m.p*m.W)/(m.q*m.L):Infinity,n:D.n,lo:m.Elo,hi:m.Ehi,ppos:Phi((m.p-m.be)/se),K:m.K,L:m.L,q:m.q,sim:m.sim,sweep:m.sweep,nNeed:m.nNeed,costShare:m.Eg>0?m.c/m.Eg:0,need};}
function modelReport(m){return report(modelRpo(m));}
function mainTodo(o,F){
  const safe=safeFrom(o.sweep);
  if(o.E<=0)return t('a_noedge');if(F.ruin>0.05)return safe!==null&&safe<D.risk?t('a_reduce',{x:safe}):t('a_reduce_min',{x:pc(o.K/2)});
  if(o.lo<=0)return o.nNeed?t('a_collect',{x:o.nNeed.toLocaleString('en-US')}):t('a_collect_many');
  if(o.K>0&&D.risk/100>o.K/2)return t('a_halfkelly',{x:capK(o.K,o.sweep)});return t('a_keep');}
function simExpl(X,keys,sim,o){
  const F=simFacts(sim),H=D.hor,ra=Array.from(sim.ruinAt||[]).filter(x=>x>0).sort((a,b)=>a-b);
  X[keys.fan]={now:t('e_fan',{med:eqFmt(F.med),H,p5:eqFmt(F.p5),p95:eqFmt(F.p95),ruin:pc(F.ruin),nr:Math.round(F.ruin*F.N).toLocaleString('en-US'),N:F.N.toLocaleString('en-US')}),todo:mainTodo(o,F)};
  X[keys.survt]={};
  X[keys.ddhist]={now:t('e_ddhist',{dd50:dpc(F.dd50),dd95:dpc(F.dd95),ddmax:dpc(F.ddmax),p10:pc(F.ge(0.1)),p20:pc(F.ge(0.2)),p30:pc(F.ge(0.3)),p50:pc(F.ge(0.5))}),todo:t('a_dd',{x:dpc(F.dd95)})};
  const safe=safeFrom(o.sweep),nx=o.sweep.find(x=>x.ruin>0.05);
  X[keys.sweep]={now:t('e_sweep',{risk:D.risk,ruin:pc(F.ruin),safe:safe===null?'<'+o.sweep[0].risk:safe})+(nx?' '+t('e_sweep2',{next:nx.risk,nr:pc(nx.ruin)}):''),todo:F.ruin>0.05?(safe!==null&&safe<D.risk?t('a_reduce',{x:safe}):t('a_reduce_min',{x:pc(o.K/2)})):t('a_inside')};
  return{F,ra};}
function buildModelExpl(m){
  const X={},H=D.hor,o={E:m.En,lo:m.Elo,K:m.K,sweep:m.sweep,nNeed:m.nNeed},S=sizeFacts(m.L,m.q),risk=D.risk/100;
  const {F,ra}=simExpl(X,{fan:'mn_fan',survt:'mn_survt',ddhist:'mn_ddhist',sweep:'mn_sweep'},m.sim,o),kx=m.K>0?risk/m.K:null,gNow=m.g(risk),gK=m.g(m.K);
  const collect=m.En>0&&m.Elo<=0?(m.nNeed?t('a_collect',{x:m.nNeed.toLocaleString('en-US')}):t('a_collect_many')):null;
  {const dbl=gNow>0&&isFinite(gNow)?Math.ceil(Math.log(2)/gNow):null;X.mn_stats={now:t('e_stats',{sd:m.sdR.toFixed(2)})+(m.En>0&&m.Elo<=0&&m.nNeed?' '+t('e_stats_need',{x:m.nNeed.toLocaleString('en-US')}):'')+(dbl?' '+t('e_stats_dbl',{risk:D.risk,x:dbl.toLocaleString('en-US'),days:D.tpd>0?' (\u2248 '+cmpNum(Math.ceil(dbl/D.tpd))+' days)':''}):'')};}
  X.mn_evswr={now:t('e_evswr',{E:rfmt(m.En),lo:pc(m.ci[0],0),Elo:rfmt(m.Elo),hi:pc(m.ci[1],0),Ehi:rfmt(m.Ehi),slope:((m.W+m.L)/100).toFixed(3)}),todo:m.En<=0?t('a_noedge'):(collect||t('a_edge_ok'))};
  X.mn_frontier={now:t('e_frontier',{rr:D.rr,be:pc(m.be),wr:pc(m.p,0),margin:sgn((m.p-m.be)*100,1),rrNeed:(m.p>0?((m.q*m.L)/m.p+m.c):0).toFixed(2)}),todo:m.En<=0?t('a_noedge'):null};
  X.mn_stress={now:t('e_stress',{r0:pc(m.stress[1].ruin),lo:pc(m.ci[0],0),rlo:pc(m.stress[0].ruin),hi:pc(m.ci[1],0),rhi:pc(m.stress[2].ruin)}),todo:m.stress[0].ruin>0.05?t('a_stress',{x:pc(m.Klo)}):t('a_stress_ok')};
  const mu=H*m.En,sg=Math.sqrt(H)*m.sdR;
  X.mn_ruincurve={now:ra.length?t('e_ruincurve',{med:ra[Math.floor(ra.length/2)],first:ra[0],ruin:pc(F.ruin)}):t('e_ruincurve0',{H})};
  X.mn_fin={now:t('e_fin',{up:pc(F.up,0),down:pc(F.down,0),dbl:pc(F.dbl,0),med:eqFmt(F.med)})+(sg>0?' '+t('e_fin_r',{H,a:rfmt(mu-1.645*sg,1),b:rfmt(mu+1.645*sg,1),pneg:pc(Phi(-mu/sg))}):'')};
  let best=m.sweep[0];m.sweep.forEach(x=>{if(x.med>best.med)best=x;});
  X.mn_kelly={now:t('e_kelly',{K:pc(m.K),risk:D.risk,kx:kx===null?'–':kx.toFixed(2),gNow:isFinite(gNow)?(gNow*100).toFixed(3)+'%':'−∞',gK:(gK*100).toFixed(3)+'%',Z:pc(m.Z)}),todo:risk>m.K?t('a_overkelly'):(risk>m.K/2?t('a_halfkelly',{x:capK(m.K,m.sweep)}):t('a_underkelly'))};
  const sc=n=>m.scen.find(x=>x.name===n),hk=sc('1/2 Kelly'),fk=sc('Full Kelly');
  if(hk&&fk)X.mn_scen={now:t('e_scen',{hk:hk.risk.toFixed(2),hkMed:eqFmt(hk.med),hkRuin:pc(hk.ruin),fk:fk.risk.toFixed(2),fkMed:eqFmt(fk.med),fkRuin:pc(fk.ruin),fkDD:dpc(fk.dd95)})};
  if(D.sl>0&&D.pv>0)X.mn_lot={now:t('e_lot',{bal:D.bal.toLocaleString('en-US'),risk:D.risk,money:(D.bal*risk).toLocaleString('en-US',{maximumFractionDigits:2}),sl:D.sl,lots:(Math.floor(D.bal*risk/(D.sl*D.pv)*100)/100).toFixed(2)})};
  X.mn_streak={now:t('e_streak',{q:pc(m.q,0),k:S.typ,pk:pc(SFX.probStreak(m.q,Math.max(1,S.typ),H),0),k2:S.typ+3,pk2:pc(SFX.probStreak(m.q,S.typ+3,H),0),H}),todo:t('a_streak',{k:S.typ,risk:D.risk,drop:dpc(S.drop)})};
  X.mn_after={now:t('e_after',{k:S.typ,drop:dpc(S.drop),kr:isFinite(S.kr)?S.kr:'–',kr2:isFinite(S.kr2)?S.kr2:'–'})};
  X.mn_recover={now:t('e_recover',{dd:dpc(F.dd95),gain:'+'+pc(F.dd95/(1-Math.min(0.99,F.dd95)),0)})};
  if(D.sl>0){const share=m.Eg>0?m.c/m.Eg:null,e={now:t('e_cost',{c:rfmt(-m.c,3),share:share===null?'–':pc(share,0),En:rfmt(m.En,3),Eg:rfmt(m.Eg,3)}),todo:share!==null&&share>0.2?t('a_costs',{x:pc(share,0)}):(m.c>0?t('a_costs_ok'):t('a_costs_none'))};X.mn_cost=e;X.mn_spread=e;}
  return X;}
function buildHistExpl(r){
  const X={},s=r.stats,o={E:s.expectancy,lo:r.boot.ci[0],K:r.optF.f,sweep:r.sweep,nNeed:s.nNeeded&&s.nNeeded<100000?s.nNeeded:null};
  {const m=D.model,a=m.sim,b=r.sim,md=SFX.quantile(a.dd,0.95),rd=SFX.quantile(b.dd,0.95),v={md:dpc(md),rd:dpc(rd),mr:pc(a.ruinProb),rr:pc(b.ruinProb),w:rfmt(r.stats.worst)};
   const worse=rd>md*1.15+0.005||b.ruinProb>a.ruinProb+0.02,better=!worse&&rd<md*0.85;
   X.n_cmp={now:t(worse?'e_cmp_worse':better?'e_cmp_better':'e_cmp_same',v),todo:worse?t('a_cmp_worse'):null};}
  const minU=amin(r.uw),curU=r.uw[r.uw.length-1],tot=r.cum[r.cum.length-1];
  X.n_hstats={now:t('e_hstats',{wr:pc(s.winRate,0),aw:rfmt(s.avgWin),al:rfmt(s.avgLoss),E:rfmt(s.expectancy,3),t:s.t.toFixed(2)})+' '+t(Math.abs(s.t)>=1.96?'e_hsig':'e_hnosig')};
  X.n_equity={now:t('e_hequity',{tot:rfmt(tot,1),n:r.n,maxdd:rfmt(minU,1),cur:rfmt(curU,1)})};X.n_uw=X.n_equity;
  X.n_rdist={now:t('e_hrdist',{nw:s.wins,aw:rfmt(s.avgWin),nl:s.losses,al:rfmt(s.avgLoss),worst:rfmt(s.worst),best:rfmt(s.best)})};
  X.n_boot={now:t('e_hboot',{p:pc(r.boot.probPos,0),lo:rfmt(r.boot.ci[0]),hi:rfmt(r.boot.ci[1])}),todo:r.boot.ci[0]<=0?(o.nNeed?t('a_collect',{x:o.nNeed.toLocaleString('en-US')}):t('a_collect_many')):t('a_edge_ok')};
  const w=Math.max(10,Math.min(30,Math.floor(r.n/3)));if(r.n>=w+5){const ro=SFX.rolling(r.R,w);X.n_roll={now:t('e_hroll',{w,last:rfmt(ro[ro.length-1]),mean:rfmt(s.expectancy),min:rfmt(amin(ro)),max:rfmt(amax(ro))})};}
  const q=s.losses/r.n,typ=SFX.typicalStreak(q,r.H);X.n_runs={now:t('e_hruns',{maxL:s.maxLoseStreak,k:typ,H:r.H})};
  X.n_kelly={now:t('e_hkelly',{f:pc(r.optF.f,2),hf:pc(r.optF.f/2,2),risk:D.risk}),todo:D.risk/100>r.optF.f?t('a_overkelly'):null};
  const d=r.beh.disc,e={now:t('e_hdisc',{n:d.n,on:d.onStop,worse:d.worse,early:d.early})};X.n_disc=e;X.n_disc_bad=e;
  const dw=r.beh.dw.map((x,i)=>({i,n:x.n,v:x.n?x.s/x.n:0})).filter(x=>x.n>=3).sort((a,b)=>b.v-a.v);
  if(dw.length>=2)X.n_faint={now:t('e_hday',{d1:DAYS[dw[0].i],v1:rfmt(dw[0].v),n1:dw[0].n,d2:DAYS[dw[dw.length-1].i],v2:rfmt(dw[dw.length-1].v),n2:dw[dw.length-1].n})};
  const fm=x=>x>=60?(x/60).toFixed(1)+'h':Math.round(x)+'m',dW=[],dL=[];r.R.forEach((v,i)=>(v>0?dW:dL).push(r.beh.dur[i]));
  if(dW.length&&dL.length)X.n_dur={now:t('e_hdur',{w:fm(SFX.median(dW)),l:fm(SFX.median(dL))})};
  const gs=SFX.mean(r.conv.gross);if(r.conv.usedNet)X.n_cost={now:t('e_hcost',{g:rfmt(gs,3),n:rfmt(s.expectancy,3),drag:rfmt(s.expectancy-gs,3)})};
  return X;}
/* ---------- action plan ---------- */
function buildPlan(m,r){
  const P=[],add=(lvl,key,v,res,body)=>{const it={lvl,key,v:v||{},title:t('pl2_'+key+'_t',v),body:body||t('pl2_'+key+'_p',v),res,c:{}};P.push(it);return it;};
  const risk=D.risk,sw=m.sweep,safe=safeFrom(sw),F=simFacts(m.sim),kx=m.K>0?risk/100/m.K:null,gate=window.__sfxGate;
  let dd20=null;sw.forEach(x=>{if(x.dd95<=0.25&&(dd20===null||x.risk>dd20))dd20=x.risk;});
  const dd95=sim=>SFX.quantile(sim.dd,0.95),rnd=x=>x>=1?Math.floor(x*4)/4:Math.max(0.05,Math.floor(x*100)/100);
  const days=n=>D.tpd>0?t('pl2_days',{d:cmpNum(Math.ceil(n/D.tpd)),tpd:D.tpd}):'';
  /* testing */
  if(gate==='nn')add('must','gate_nn');else if(gate==='bt')add('should','gate_bt');else if(gate==='ft')add('should','gate_ft');
  /* edge */
  if(m.p>=1)add('must','perfect',{},null,t('why_perfect'));
  else if(m.En<=0){
    add('must','noedge',{E:rfmt(m.En),be:pc(m.be),wr:pc(m.p,0),Eg:rfmt(m.Eg)},null,m.Eg>0?t('pl2_noedgec_p',{E:rfmt(m.En),Eg:rfmt(m.Eg)}):null);
    add('must','need',{be:pc(m.be),rr:(m.p>0?(m.q*m.L)/m.p+m.c:0).toFixed(2)});
  }
  /* real trades */
  if(r){const a=m.sim,b=r.sim,md=dd95(a),rd=dd95(b);
    if(rd>md*1.15+0.005||b.ruinProb>a.ruinProb+0.02)add('must','real',{rd:dpc(rd),md:dpc(md),rr:pc(b.ruinProb),mr:pc(a.ruinProb)});}
  /* sizing */
  let useRisk=risk;
  if(m.En>0&&m.p<1){
    const targ=[],why=[];
    if(m.sim.ruinProb>0.05){targ.push(safe!==null?safe:sw[0].risk);why.push(t('pl2_r_ruin',{a:pc(m.sim.ruinProb)}));}
    if(m.K>0&&risk/100>m.K/2){targ.push(m.K*50);why.push(t('pl2_r_kelly',{kx:kx.toFixed(1)}));}
    if(F.dd95>0.3){targ.push(dd20!==null?dd20:sw[0].risk);why.push(t('pl2_r_dd',{dd:dpc(F.dd95)}));}
    if(m.stress[0].ruin>0.05&&m.Klo>0){targ.push(m.Klo*50);why.push(t('pl2_r_stress',{lo:pc(m.ci[0],0),sr:pc(m.stress[0].ruin)}));}
    if(targ.length){const x=rnd(amin(targ));
      if(x<risk*0.97){const s2=runSim(m.p,x);useRisk=x;
        add(m.sim.ruinProb>0.05||(m.K>0&&risk/100>m.K)?'must':'should','lower',{x,risk,reasons:why.join('; ')},t('pl2_res_risk',{a:pc(m.sim.ruinProb),b:pc(s2.ruinProb),c:dpc(F.dd95),d:dpc(dd95(s2))})).c={newRuin:s2.ruinProb};}}
    if(useRisk===risk&&m.Elo>0){const cap=Math.min(safe===null?0:safe,dd20===null?0:dd20,m.K*50);if(cap>risk*2)add('info','room',{x:rnd(cap)});}
  }
  /* history checks */
  if(r){const s=r.stats,d=r.beh.disc;
    if(s.worst<-1.5)add('should','worst',{w:rfmt(s.worst)});
    if(d.n>=5&&d.worse/d.n>0.2)add('should','discw',{x:d.worse,n:d.n});
    if(d.n>=5&&d.early/d.n>0.4)add('should','disce',{x:d.early,n:d.n});
    if(r.beh.distinctLots>1&&r.beh.lotCV>0.25)add('should','lots');
    const w=Math.max(10,Math.min(30,Math.floor(r.n/3)));
    if(r.n>=w+5&&s.expectancy>0){const ro=SFX.rolling(r.R,w),last=ro[ro.length-1];if(last<0)add('should','decay',{w,last:rfmt(last),mean:rfmt(s.expectancy)});}
  }
  /* sample */
  if(m.En>0&&m.p<1&&(D.n<30||m.Elo<=0)){const x=Math.max(30,m.Elo<=0&&m.nNeed?m.nNeed:30),more=Math.max(0,x-D.n);
    if(more>0)add('should','collect',{x:x.toLocaleString('en-US'),n:D.n,more:more.toLocaleString('en-US'),days:days(more)});}
  if(m.En>0&&m.p<1&&m.p-m.be<0.03)add('should','thin',{wr:pc(m.p,0),be:pc(m.be),m:((m.p-m.be)*100).toFixed(1)});
  /* costs */
  if(!(D.sl>0))add('info','nocosts');
  else if(m.Eg>0){const sh=m.c/m.Eg;if(sh>0.2)add(m.En<=0?'must':'should','costs',{c:rfmt(-m.c,3),s:pc(sh,0)});else if(sh>0.1)add('info','costsw',{s:pc(sh,0)});}
  /* rules that soften bad runs */
  if(m.En>0&&m.p<1){
    const ruinNow=runSim(m.p,useRisk);
    if(D.sizing==='fixed'&&ruinNow.ruinProb>0.01){const c=runSim(m.p,useRisk,{fixed:false});if(c.ruinProb<ruinNow.ruinProb*0.8)add('should','compound',{},t('pl2_res_dd',{a:dpc(dd95(ruinNow)),b:dpc(dd95(c)),c:pc(ruinNow.ruinProb),d:pc(c.ruinProb)})).c={ddA:dd95(ruinNow),ddB:dd95(c)};}
    if(D.dAfter===0&&(ruinNow.ruinProb>0.005||dd95(ruinNow)>0.15)){const k=Math.max(2,Math.round(SFX.typicalStreak(m.q,D.hor)/2)),c=runSim(m.p,useRisk,{deriskAfter:k,deriskCut:0.5});
      if(dd95(c)<dd95(ruinNow)*0.9)add('info','derisk',{k},t('pl2_res_dd',{a:dpc(dd95(ruinNow)),b:dpc(dd95(c)),c:pc(ruinNow.ruinProb),d:pc(c.ruinProb)})).c={ddA:dd95(ruinNow),ddB:dd95(c)};}
  }
  /* improve the edge */
  if(m.p<1){const a=0.05*(m.W+m.L),b=m.p*0.25;add(m.En<=0?'must':'info','levers',{a:rfmt(a,3),b:rfmt(b,3),which:t(a>=b?'pl2_lv_wr':'pl2_lv_rr')});}
  if(r){const dw=r.beh.dw.map((x,i)=>({i,n:x.n,v:x.n?x.s/x.n:0})).filter(x=>x.n>=5).sort((a,b)=>a.v-b.v);
    if(dw.length>=2&&dw[0].v<-0.3)add('info','day',{d:DAYS[dw[0].i],v:rfmt(dw[0].v),n:dw[0].n});
    const L=r.beh.side.buy,S=r.beh.side.sell;
    if(L.length>=10&&S.length>=10){const el=SFX.mean(L),es=SFX.mean(S);if(el*es<0){const bad=el<0?'long':'short';add('info','side',{side:t('pl2_'+bad),v:rfmt(Math.min(el,es)),n:(bad==='long'?L:S).length});}}
  }
  /* habits */
  if(m.En>0&&m.p<1){
    if(D.sl>0&&D.pv>0&&D.bal>0){const money=D.bal*useRisk/100;add('info','lot',{lots:(Math.floor(money/(D.sl*D.pv)*100)/100).toFixed(2),bal:D.bal.toLocaleString('en-US'),risk:useRisk,sl:D.sl,money:money.toLocaleString('en-US',{maximumFractionDigits:2})});}
    else add('info','lotneed');
    const k=SFX.typicalStreak(m.q,D.hor),rr=useRisk/100*m.L,drop=1-(D.sizing==='fixed'?Math.max(0,1-k*rr):Math.pow(Math.max(0,1-rr),k));
    if(k>0)add('info','streak',{k,H:D.hor,drop:dpc(drop),risk:useRisk}).c={useRisk};
    {const rs=useRisk===risk?m.sim:runSim(m.p,useRisk),rd=dd95(rs);add('info','review',{dd:dpc(rd)}).c={revSim:rs,revDD:rd};}
  }
  add('info','rerun');
  const ord={must:0,should:1,info:2};return P.map((x,i)=>Object.assign(x,{i})).sort((a,b)=>ord[a.lvl]-ord[b.lvl]||a.i-b.i);}
/* ---------- action plan: visuals + personal examples ---------- */
const nf=v=>(+v).toLocaleString('en-US',{maximumFractionDigits:2});
const pdate=days=>{const d=new Date(Date.now()+days*864e5);return d.toLocaleDateString(LANG==='th'?'th-TH':'en-GB',{day:'numeric',month:'short',year:'numeric'});};
function hb(rows,max){ /* rows: [label, value, text, tone] */
  const mx=max||amax(rows.map(r=>Math.abs(r[1])),1e-9);
  return`<div class="pvh">${rows.map(([l,v,txt,tone])=>`<div class="pvr"><span class="pvl">${esc(l)}</span><span class="pvt"><i class="${tone||''}" style="width:${Math.max(2,Math.abs(v)/mx*100)}%"></i></span><b>${esc(txt)}</b></div>`).join('')}</div>`;}
function stack(parts){const tot=parts.reduce((a,p)=>a+p[1],0)||1;
  return`<div class="pvs">${parts.map(([l,v,tone])=>v?`<i class="${tone}" style="width:${v/tot*100}%" title="${esc(l)}"></i>`:'').join('')}</div><div class="legend">${parts.map(([l,v,tone])=>`<span><i class="pvdot ${tone}"></i>${esc(l)}: ${v}</span>`).join('')}</div>`;}
function rangeRows(rows,lo,hi){const X=v=>(v-lo)/(hi-lo)*100;
  return`<div class="pvh">${rows.map(([l,a,b])=>`<div class="pvr"><span class="pvl">${esc(l)}</span><span class="pvt pvrange"><em style="left:${X(0)}%"></em><i class="${a>0?'ok':'warn'}" style="left:${X(a)}%;width:${Math.max(1.5,X(b)-X(a))}%"></i></span><b>${rfmt(a)} … ${rfmt(b)}</b></div>`).join('')}</div>`;}
const pv=svg=>`<div class="chart pvc">${svg}</div>`;
function sweepVis(m,marks){
  return pv(CH.plot({w:420,h:170,m:{l:40,b:26},series:[{pts:m.sweep.map(x=>[x.risk,x.ruin*100]),color:'var(--c1)',w:2}],hlines:[{y:5,color:'var(--warn)',label:'5%'}],
    markers:marks.map(([x,y,lab,c])=>({x,y,color:c,r:5,label:lab,dy:-9})),ylo:0,yfmt:v=>v+'%',xfmt:v=>v+'%',xlabel:t('x_risk'),label:'P(ruin) by risk'}));}
function rerunVis(m){
  const W=440,H=196,l=44,rt=10,tp=14,bt=48,cols=[0,50,100,150,200].map(k=>D.n+k),iw=W-l-rt,ih=H-tp-bt;
  const rows=cols.map(n=>{const ci=SFX.wilson(m.p,n);return{n,lo:m.eAt(ci[0]),hi:m.eAt(ci[1])};});
  let mn=amin(-0.1,rows.map(r=>r.lo)),mx=amax(0.1,rows.map(r=>r.hi));const pad=(mx-mn)*0.08;mn-=pad;mx+=pad;
  const y=v=>tp+(mx-v)/(mx-mn)*ih,x=i=>l+iw*(i+0.5)/cols.length,E=m.En,f=v=>(v>=0?'+':'\u2212')+Math.abs(v).toFixed(2)+'R';
  let g=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="expectancy range at each check">`;
  [mn+pad,0,mx-pad].filter(v=>v===0||Math.abs(y(v)-y(0))>14).forEach(v=>{g+=`<text x="${l-6}" y="${y(v)+3}" text-anchor="end">${f(v)}</text>`;});
  g+=`<line x1="${l}" x2="${W-rt}" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)" stroke-dasharray="4 3"/><line x1="${l}" x2="${W-rt}" y1="${y(E)}" y2="${y(E)}" stroke="var(--c1)" stroke-opacity=".35"/>`;
  rows.forEach((r,i)=>{const tone=r.hi<0?'var(--bad)':r.lo>0?'var(--ok)':'var(--warn)',cx=x(i),bw=Math.min(26,iw/cols.length*0.4);
    g+=`<rect x="${cx-bw/2}" y="${y(r.hi)}" width="${bw}" height="${Math.max(2,y(r.lo)-y(r.hi))}" fill="${tone}" fill-opacity="${i?0.55:0.9}" rx="2"/><circle cx="${cx}" cy="${y(E)}" r="3.2" fill="var(--ink)"/>`;
    g+=`<text x="${cx}" y="${H-bt+16}" text-anchor="middle" style="fill:var(--ink)">${i?r.n:esc(t('pv_now'))+' '+r.n}</text>`;
    if(D.tpd>0&&i){const d=new Date(Date.now()+Math.ceil((r.n-D.n)/D.tpd*7/5)*864e5);g+=`<text x="${cx}" y="${H-bt+29}" text-anchor="middle">${esc(d.toLocaleDateString(LANG==='th'?'th-TH':'en-GB',{day:'numeric',month:'short',year:'2-digit'}))}</text>`;}});
  return g+`<text x="${l+iw/2}" y="${H-3}" text-anchor="middle">${esc(t('pv_rr_x'))}</text></svg>`;}
function planExtras(it,m,r,c){
  const k=it.key,R=x=>rfmt(x),bal=D.bal;let vis='',ex='';
  const tr=r?r.trades:null;
  switch(k){
  case'gate_nn':case'gate_bt':case'gate_ft':{const bt=k!=='gate_nn'&&k!=='gate_ft',ft=k==='gate_ft';
    vis=`<div class="pvchips"><span data-ok="${bt}">${bt?'✓':'✕'} ${esc(t('pv_bt'))}</span><span data-ok="${ft}">${ft?'✓':'✕'} ${esc(t('pv_ft'))}</span></div>`;break;}
  case'noedge':case'thin':vis=pv(CH.wrGauge({p:m.p,be:m.be,beLabel:t('g_be',{x:pc(m.be)}),pLabel:t('g_you',{x:(m.p*100).toFixed(1)}),label:'win rate vs break-even',w:420}));
    ex=k==='noedge'?t('pl2_noedge_x',{tot:Math.abs(m.En*100).toFixed(0)+'R',money:nf(Math.abs(m.En*100*bal*D.risk/100))}):t('pl2_thin_x',{m:((m.p-m.be)*100).toFixed(1),be:pc(m.be)});break;
  case'need':{const rrNeed=m.p>0?(m.q*m.L)/m.p+m.c:0;
    vis=hb([[t('pv_wr')+' · '+t('pv_now'),m.p*100,pc(m.p),'warn'],[t('pv_wr')+' · '+t('pv_need'),m.be*100,pc(m.be),'ok']],100)+hb([[t('pv_rr')+' · '+t('pv_now'),D.rr,D.rr+'R','warn'],[t('pv_rr')+' · '+t('pv_need'),rrNeed,rrNeed.toFixed(2)+'R','ok']]);
    ex=t('pl2_need_x',{w:Math.ceil(m.be*100),wn:Math.round(m.p*100)});break;}
  case'real':{const a=m.sim,b=r.sim,md=SFX.quantile(a.dd,0.95),rd=SFX.quantile(b.dd,0.95);
    vis=hb([[t('pv_ddbad')+' · '+t('pv_model'),md*100,dpc(md),'c1'],[t('pv_ddbad')+' · '+t('pv_real'),rd*100,dpc(rd),'bad']])+hb([[t('pv_ruin')+' · '+t('pv_model'),a.ruinProb*100,pc(a.ruinProb),'c1'],[t('pv_ruin')+' · '+t('pv_real'),b.ruinProb*100,pc(b.ruinProb),'bad']]);
    ex=t('pl2_real_x',{w:R(r.stats.worst),L:R(-m.L)});break;}
  case'lower':vis=sweepVis(m,[[D.risk,m.sim.ruinProb*100,t('pv_you'),'var(--bad)'],[it.v.x,c.newRuin*100,t('pv_target'),'var(--ok)']]);
    ex=t('pl2_lower_x',{bal:nf(bal),r1:D.risk,m1:nf(bal*D.risk/100),r2:it.v.x,m2:nf(bal*it.v.x/100)});break;
  case'room':vis=sweepVis(m,[[D.risk,m.sim.ruinProb*100,t('pv_you'),'var(--accent)']]);ex=t('pl2_room_x',{bal:nf(bal),x:it.v.x,m:nf(bal*it.v.x/100),r:D.risk,m0:nf(bal*D.risk/100)});break;
  case'worst':{const i=r.R.indexOf(r.stats.worst),x=tr[i],lo=Math.floor(amin(r.R)*2)/2,hi=Math.ceil(amax(r.R)*2)/2;
    vis=pv(CH.histo({w:420,h:150,m:{l:30,b:24},bins:SFX.hist(r.R,16,lo,hi),colorFn:b=>r.stats.worst>=b.x0&&r.stats.worst<=b.x1?'var(--bad)':b.x1<=0?'var(--c2)':'var(--c1)',vlines:[{x:-1,color:'var(--muted)',dash:true,label:'−1R'}],xfmt:v=>(+v.toFixed(1))+'',xlabel:'R',label:'R distribution'}));
    ex=t('pl2_worst_x',{tk:x.ticket||'–',d:new Date(x.close).toISOString().slice(0,10),sym:x.symbol,pips:nf(Math.abs(x.pips)),sl:nf(D.sl),w:R(r.stats.worst)});break;}
  case'discw':case'disce':{const d=r.beh.disc;vis=stack([[t('pv_on'),d.onStop,'ok'],[t('pv_worse'),d.worse,'bad'],[t('pv_early'),d.early,'warn']]);
    const L=tr.map((x,i)=>({x,r:r.R[i]})).filter(o=>k==='discw'?o.r<-1.15:(o.r<0&&o.r>-0.85)).sort((a,b)=>k==='discw'?a.r-b.r:b.r-a.r).slice(0,3);
    ex=t('pl2_'+k+'_x',{list:L.map(o=>'#'+(o.x.ticket||'?')+' ('+R(o.r)+')').join(', ')});break;}
  case'lots':{const ls=tr.map(x=>x.lots),tgt=D.sl>0&&D.pv>0?D.bal*D.risk/100/(D.sl*D.pv):null;
    vis=pv(CH.plot({w:420,h:150,m:{l:36,b:24},dots:ls.map((v,i)=>({x:i+1,y:v,r:3,color:'var(--c1)',op:.9})),hlines:tgt?[{y:tgt,color:'var(--ok)',label:t('pv_target')}]:[],ylo:0,yfmt:v=>(+v.toFixed(2))+'',xlabel:t('x_trades'),ylabel:t('pv_lots'),label:'lot size per trade'}));
    ex=t('pl2_lots_x',{min:amin(ls),max:amax(ls),risk:D.risk,sl:nf(D.sl),lots:tgt?(Math.floor(tgt*100)/100).toFixed(2):'–'});break;}
  case'decay':{const w=it.v.w,ro=SFX.rolling(r.R,w),last=r.R.slice(-w);
    vis=pv(CH.plot({w:420,h:150,m:{l:40,b:24},series:[{pts:ro.map((v,i)=>[i+w,v]),color:'var(--c1)',w:2}],hlines:[{y:0,color:'var(--bad)'},{y:r.stats.expectancy,color:'var(--ok)',label:t('pv_avg')}],yfmt:v=>(+v.toFixed(2))+'',xlabel:t('x_trades'),label:'rolling average'}));
    ex=t('pl2_decay_x',{w,wins:last.filter(x=>x>0).length,losses:last.filter(x=>x<0).length});break;}
  case'collect':{const x=+String(it.v.x).replace(/,/g,''),ci2=SFX.wilson(m.p,x),a2=m.eAt(ci2[0]),b2=m.eAt(ci2[1]),lo=Math.min(m.Elo,-0.1),hi=Math.max(m.Ehi,0.1);
    vis=rangeRows([[t('pv_nowtr',{n:D.n}),m.Elo,m.Ehi],[t('pv_attr',{n:it.v.x}),a2,b2]],lo,hi);
    const more=x-D.n;ex=D.tpd>0?t('pl2_collect_x',{d:pdate(Math.ceil(more/D.tpd*7/5)),more:it.v.more}):'';break;}
  case'costs':case'costsw':vis=hb([[t('pv_gross'),m.Eg,rfmt(m.Eg,3),'c1'],[t('pv_net'),Math.max(0,m.En),rfmt(m.En,3),m.En>0?'ok':'bad']]);
    ex=t('pl2_costs_x',{c:(m.c*100).toFixed(1)+'R',money:nf(m.c*100*bal*D.risk/100)});break;
  case'compound':case'derisk':vis=hb([[t(k==='compound'?'pv_fixed':'pv_without'),c.ddA*100,dpc(c.ddA),'bad'],[t(k==='compound'?'pv_comp':'pv_with'),c.ddB*100,dpc(c.ddB),'ok']]);
    ex=t('pl2_'+k+'_x',{bal:nf(bal),a:nf(bal*(1-c.ddA)),b:nf(bal*(1-c.ddB))});break;
  case'levers':{const a=0.05*(m.W+m.L),b=m.p*0.25;vis=hb([[t('pv_wr5'),a,'+'+rfmt(a,3).slice(1),'c1'],[t('pv_rr25'),b,'+'+rfmt(b,3).slice(1),'c3']]);
    ex=t('pl2_levers_x',{wr:pc(m.p,0),wr5:pc(m.p+0.05,0),rr:D.rr,rr2:(D.rr+0.25).toFixed(2)});break;}
  case'day':{const dw=r.beh.dw,ord=[1,2,3,4,5,0,6].filter(i=>dw[i].n>0),worst=DAYS.indexOf(it.v.d);
    vis=pv(CH.bars({w:420,h:150,items:ord.map(i=>({label:DAYS[i],value:dw[i].n?dw[i].s/dw[i].n:0,color:i===worst?'var(--bad)':'var(--c1)',faint:dw[i].n<5})),yfmt:v=>(+v.toFixed(1))+'',ylabel:'avg R',label:'average R by weekday'}));
    ex=t('pl2_day_x',{d:it.v.d,n:dw[worst].n,sum:rfmt(dw[worst].s,1)});break;}
  case'side':{const L=r.beh.side.buy,S=r.beh.side.sell,el=SFX.mean(L),es=SFX.mean(S),mx=Math.max(Math.abs(el),Math.abs(es));
    vis=hb([[t('pv_long')+' ('+L.length+')',el,rfmt(el),el<0?'bad':'ok'],[t('pv_short')+' ('+S.length+')',es,rfmt(es),es<0?'bad':'ok']],mx);
    ex=t('pl2_side_x',{tl:rfmt(el*L.length,1),ts:rfmt(es*S.length,1)});break;}
  case'lot':vis=`<div class="pvf"><span><small>${esc(t('pv_bal'))}</small>${nf(bal)}</span>×<span><small>${esc(t('pv_riskp'))}</small>${it.v.risk}%</span>=<span><small>${esc(t('pv_money'))}</small>${it.v.money}</span>÷<span><small>${esc(t('pv_sl'))} × ${esc(t('pv_val'))}</small>${nf(D.sl)} × ${nf(D.pv)}</span>=<span class="ok"><small>${esc(t('pv_lots'))}</small>${it.v.lots}</span></div>`;
    ex=t('pl2_lot_x',{b2:nf(bal*1.2),l2:(Math.floor(bal*1.2*it.v.risk/100/(D.sl*D.pv)*100)/100).toFixed(2),b3:nf(bal*0.8),l3:(Math.floor(bal*0.8*it.v.risk/100/(D.sl*D.pv)*100)/100).toFixed(2)});break;
  case'streak':{const kk=it.v.k,rr=c.useRisk/100*m.L,f=j=>D.sizing==='fixed'?Math.max(0,1-j*rr):Math.pow(Math.max(0,1-rr),j),pts=[];for(let j=0;j<=kk+3;j++)pts.push([j,f(j)*100]);
    vis=pv(CH.plot({w:420,h:150,m:{l:40,b:24},series:[{pts,color:'var(--accent)',w:2}],hlines:[{y:100-D.ruin,color:'var(--bad)',label:t('d_ruin_line',{x:D.ruin})}],markers:[{x:kk,y:f(kk)*100,color:'var(--bad)',r:5,label:it.v.drop,dy:-9}],ylo:0,yhi:100,yfmt:v=>v+'%',xlabel:t('dp_streak_x'),label:'equity after losses'}));
    ex=t('pl2_streak_x',{bal:nf(bal),k:kk,money:nf(bal*(1-f(kk))),left:nf(bal*f(kk))});break;}
  case'review':{const dd=c.revDD;vis=pv(CH.histo({w:420,h:150,m:{l:30,b:24},bins:SFX.hist(Array.from(c.revSim.dd,x=>x*100),20,0,Math.max(20,Math.ceil(dd*100*1.6/5)*5)),colorFn:b=>b.x0>=dd*100?'var(--bad)':'var(--c1)',vlines:[{x:dd*100,color:'var(--bad)',label:dpc(dd),anchor:'end'}],xfmt:v=>v+'%',xlabel:t('x_maxdd'),label:'drawdown distribution'}));
    ex=t('pl2_review_x',{bal:nf(bal),lvl:nf(bal*(1-dd))});break;}
  case'nocosts':{const a=m.Eg,b2=a-0.04,c2=a-0.075;
    vis=hb([[t('pv_free'),Math.max(0,a),rfmt(a,3),'c1'],[t('pv_spr'),Math.max(0,b2),rfmt(b2,3),b2>0?'warn':'bad'],[t('pv_sprc'),Math.max(0,c2),rfmt(c2,3),c2>0?'warn':'bad']])+`<p class="pvnote">${esc(t('pv_costeg'))}</p>`;}
    ex=t('pl2_nocosts_x',{c100:(0.8/20*100).toFixed(0)+'R',money:nf(0.04*100*bal*D.risk/100)});break;
  case'lotneed':{const money=bal*D.risk/100,eg=Math.floor(money/(20*10)*100)/100;
    vis=`<div class="pvf"><span><small>${esc(t('pv_bal'))}</small>${nf(bal)}</span>×<span><small>${esc(t('pv_riskp'))}</small>${D.risk}%</span>=<span><small>${esc(t('pv_money'))}</small>${nf(money)}</span>÷<span class="pvq"><small>${esc(t('pv_sl'))} × ${esc(t('pv_val'))}</small>? × ?</span>=<span class="pvq"><small>${esc(t('pv_lots'))}</small>?</span></div><p class="pvnote">${esc(t('pv_loteg',{money:nf(money),lots:eg.toFixed(2)}))}</p>`;}
    ex=t('pl2_lotneed_x',{bal:nf(bal),risk:D.risk,money:nf(bal*D.risk/100)});break;
  case'rerun':vis=pv(rerunVis(m))+`<p class="pvnote">${esc(t('pv_rr_note',{wr:pc(m.p,0)}))}</p>`+`<div class="pvleg"><span><i class="bad"></i>${esc(t('pv_rr_bad'))}</span><span><i class="warn"></i>${esc(t('pv_rr_unsure'))}</span><span><i class="ok"></i>${esc(t('pv_rr_ok'))}</span></div>`;
    ex=D.tpd>0?t('pl2_rerun_x',{n:D.n+50,d:pdate(Math.ceil(50/D.tpd*7/5))}):'';break;
  }
  return{vis,ex};}
function planCard(m){
  const P=buildPlan(m,D.res),urgent=P.filter(x=>x.lvl!=='info').length,cnt=l=>P.filter(x=>x.lvl===l).length;
  const sum=['must','should','info'].filter(l=>cnt(l)).map(l=>`<span class="pb" data-l="${l}">${cnt(l)} · ${esc(t('pl2_'+l))}</span>`).join('');
  return`<div class="card plan"><div class="planh"><h2>${esc(t('pl2_title'))}</h2><div class="pbs">${sum}</div></div>
  <p class="small" style="margin:.2rem 0 .9rem">${esc(t(urgent?'pl2_intro':'pl2_intro_ok',{n:P.length}))}</p>
  <ol class="plan-list">${P.map((x,i)=>`<li class="pi" data-l="${x.lvl}" data-k="${x.key}"><span class="pn">${i+1}</span><div class="pic"><div class="pih"><span class="pb" data-l="${x.lvl}">${esc(t('pl2_'+x.lvl))}</span><b>${esc(x.title)}</b></div><div class="ptext"><p class="pbody">${esc(x.body)}</p>${x.res?`<p class="pres"><span>${esc(t('pl2_res'))}</span> ${esc(x.res)}</p>`:''}</div>${(()=>{let e={vis:'',ex:''};try{e=planExtras(x,m,D.res,x.c);}catch(err){console.error('plan extras',x.key,err);}return(e.vis?`<div class="pv">${e.vis}</div>`:'<i class="pnone"></i>')+(e.ex?`<p class="pfor"><span>${esc(t('pl2_for'))}</span> ${esc(e.ex)}</p>`:'<i class="pnone"></i>');})()}</div></li>`).join('')}</ol></div>`;}
/* ---------- Markdown report (Expert): the page's own cards turned into text, plus the data behind every chart ---------- */
const tx=MD.tx,tt=n=>n?n.textContent.replace(/\s+/g,' ').trim():'';
const labeled=el=>{if(!el)return'';const b=el.querySelector('b,span'),lab=b?tt(b):'',all=tt(el),rest=lab&&all.startsWith(lab)?all.slice(lab.length).trim():all;return lab&&rest!==all?'*'+lab.replace(/[.:：]+$/,'')+':* '+rest:all;};
function mdTable(tb){
  const th=[...tb.querySelectorAll('thead th')].map(tt),rows=[...tb.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(tt));
  return MD.table(th.length?th:['Measure','Value'],rows)+'\n';}
function mdPlan(ol){
  return[...ol.children].map((li,i)=>{const q=s=>li.querySelector(s);
    let o='- [ ] **'+(i+1)+'. '+tt(q('.pih b'))+'** ('+tt(q('.pih .pb'))+')\n  '+tt(q('.pbody'));
    if(q('.pres'))o+='\n  '+labeled(q('.pres'));if(q('.pfor'))o+='\n  '+labeled(q('.pfor'));return o;}).join('\n')+'\n\n';}
function mdWalk(el,inCard){
  let s='';
  for(const n of el.children){
    if(n.matches('svg,.chart,.legend,.nextbar,.btctl,.wi,button,input,select,.pv,.pnone,.pvchips,.pbs,template,script,style'))continue;
    const tg=n.tagName,cl=n.classList;
    if(tg==='H2'){const sm=n.querySelector('small'),main=[...n.childNodes].filter(x=>x!==sm).map(x=>x.textContent).join('').trim();s+=MD.h(inCard?3:2,main+(sm?' ('+tt(sm)+')':''));}
    else if(tg==='H3'){s+=MD.h(3,tt(n));}
    else if(tg==='H4')s+=MD.h(4,tt(n));
    else if(tg==='TABLE')s+=mdTable(n);
    else if(cl.contains('dverdict')){const p=n.querySelector('p');s+=MD.quote('**'+tt(n.querySelector('.light'))+' '+tt(n.querySelector('h2'))+'**\n'+tt(p));}
    else if(cl.contains('gtile')){const rows=[...n.children].map(d=>{const sp=d.querySelectorAll('span');return[tt(sp[0]),tt(d.querySelector('b')),sp[1]?tt(sp[1]):''];}),det=rows.some(r=>r[2]);s+=MD.table(det?['Headline','Value','Detail']:['Headline','Value'],det?rows:rows.map(r=>r.slice(0,2)));}
    else if(cl.contains('btavail'))s+=MD.quote('**'+tt(n.querySelector('.btav-t b'))+'** ('+tt(n.querySelector('.btav-t span'))+')\n'+tt(n.querySelector('.btav-s')));
    else if(tg==='DETAILS')n.querySelectorAll('p').forEach(p=>{s+=MD.p(labeled(p));});
    else if(tg==='OL'&&cl.contains('plan-list'))s+=mdPlan(n);
    else if(tg==='P'){const x=tt(n);if(x)s+=n.matches('.warnnote,.errnote')?MD.quote('⚠ '+x):MD.p(x);}
    else if(tg==='UL'||tg==='OL')s+=MD.list([...n.children].map(tt));
    else if(cl.contains('card')){s+=mdWalk(n,true);const h3=n.querySelector(':scope > h3');if(h3){let f='';try{f=mdExtra(tt(h3));}catch(e){console.error('md extra',tt(h3),e);}if(f)s+=f;}}
    else s+=mdWalk(n,inCard);}
  return s;}
const cap=x=>MD.p('*'+x+'*');
const cps=(N,fr)=>(fr||[0,0.1,0.25,0.5,0.75,1]).map(f=>Math.round(f*N)).filter((x,i,a)=>a.indexOf(x)===i);
function mdFan(sim,unit){const b=sim.bands;if(!b)return'';const N=b.q50.length-1;
  const fin=sim.fin,all=fin.length.toLocaleString('en-US');
  return cap(tx('Equity at points along the way, start = 100%. Points along the way use '+Math.min(fin.length,300)+' sample paths; the final row uses all '+all+'.','ทุนระหว่างทาง ทุนเริ่มต้น = 100% จุดระหว่างทางใช้ '+Math.min(fin.length,300)+' เส้นตัวอย่าง แถวสุดท้ายใช้ทั้งหมด '+all+' เส้น'))+
    MD.table([unit,'p5 (bad)','p50 (typical)','p95 (good)'],cps(N).map(i=>i===N?[i+' (all paths)',eqFmt(SFX.quantile(fin,0.05)),eqFmt(SFX.quantile(fin,0.5)),eqFmt(SFX.quantile(fin,0.95))]:[String(i),eqFmt(b.q05[i]),eqFmt(b.q50[i]),eqFmt(b.q95[i])]));}
function mdQuant(sorted,qs,f){return qs.map(q=>f(SFX.quantile(sorted,q)));}
function mdRuinCurve(sim,unit,wipe){const N=sim.fin.length,H=D.hor,ra=Array.from(sim.ruinAt).filter(x=>x>0),wa=wipe?Array.from(sim.wipeAt).filter(x=>x>0):null;
  return cap(tx('Share of futures that have hit the line by each point','สัดส่วนอนาคตที่แตะเส้นแล้ว ณ แต่ละจุด'))+MD.table([unit,'Hit −'+D.ruin+'%'].concat(wipe?['Wiped out']:[]).concat(['']),cps(H,[0.1,0.25,0.5,0.75,1]).map(i=>{const r=ra.filter(x=>x<=i).length/N;return[String(i),pc(r)].concat(wipe?[pc(wa.filter(x=>x<=i).length/N)]:[]).concat([MD.bar(r,Math.max(0.05,sim.ruinProb))]);}))+'\n';}
function mdExtra(title){
  const st=D.stype,fixed=st==='fixed';
  if(fixed&&D.model){const m=D.model;
    if(title.startsWith('Monte Carlo'))return mdFan(m.sim,'Trade');
    if(title==='Expectancy vs win rate'){const ws=[m.p-0.1,m.p-0.05,m.ci[0],m.be,m.p,m.ci[1],m.p+0.05,m.p+0.1].filter(x=>x>0&&x<1).sort((a,b)=>a-b).filter((x,i,a)=>!i||x-a[i-1]>1e-4);
      return MD.table(['Win rate','E[R] net','Per 100 trades','Note'],ws.map(x=>[pc(x),rfmt(m.eAt(x),3),rfmt(m.eAt(x)*100,1),Math.abs(x-m.p)<1e-9?'your input':Math.abs(x-m.be)<1e-9?'break-even':Math.abs(x-m.ci[0])<1e-9?'95% CI low':Math.abs(x-m.ci[1])<1e-9?'95% CI high':'']))+'\n';}
    if(title==='Break-even frontier'){const rs=[0.5,0.75,1,1.25,1.5,2,2.5,3,4,5,D.rr].filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a-b);
      return cap('Win rate needed to break even, after your costs')+MD.table(['Reward : risk','Break-even win rate','Your win rate clears it?'],rs.map(b=>{const W=b-m.c,be=W>0?m.L/(W+m.L):1;return[b+'R'+(b===D.rr?' (yours)':''),W>0?pc(be):'never',m.p>be?'yes, by '+((m.p-be)*100).toFixed(1)+' pts':'no'];}))+'\n';}
    if(title==='P(ruin) if the true win rate differs')return MD.table(['If the true win rate is','P(ruin) at '+D.risk+'% risk',''],m.stress.map(s=>[s.label,pc(s.ruin),MD.bar(s.ruin,amax(0.05,m.stress.map(x=>x.ruin)))]))+'\n';
    if(title==='Final equity distribution'){const F=simFacts(m.sim),qs=[0.01,0.05,0.1,0.25,0.5,0.75,0.9,0.95,0.99];
      return MD.table(['Percentile'].concat(qs.map(q=>'p'+Math.round(q*100))),[['Final equity'].concat(mdQuant(m.sim.fin,qs,eqFmt))])+'\n'+MD.kv([['Finish above the start',pc(F.up)],['At least double',pc(F.dbl)],['Lose 20% or more at some point',pc(F.ge(0.2))]],['Probability','Value'])+'\n';}
    if(title==='Max drawdown distribution'){const qs=[0.25,0.5,0.75,0.9,0.95,0.99];return MD.table(['Percentile'].concat(qs.map(q=>'p'+Math.round(q*100))).concat(['worst']),[['Max drawdown'].concat(mdQuant(m.sim.dd,qs,dpc)).concat([dpc(m.sim.dd[m.sim.dd.length-1])])])+'\n';}
    if(title==='Cumulative P(ruin) by trade')return mdRuinCurve(m.sim,'By trade',false);
    if(title==='P(ruin) vs risk per trade'){const rows=m.sweep.map(x=>[x.risk,x.ruin,x.med,x.dd95,false]);if(!m.sweep.some(x=>Math.abs(x.risk-D.risk)<1e-9))rows.push([D.risk,m.sim.ruinProb,SFX.quantile(m.sim.fin,0.5),SFX.quantile(m.sim.dd,0.95),true]);rows.sort((a,b)=>a[0]-b[0]);
      const mx=amax(0.05,rows.map(x=>x[1]));return MD.table(['Risk per trade','P(ruin)','Median equity','DD p95',''],rows.map(x=>[x[0]+'%'+(Math.abs(x[0]-D.risk)<1e-9?' (you)':''),pc(x[1]),eqFmt(x[2]),dpc(x[3]),MD.bar(x[1],mx)]));}
    if(title==='Kelly growth curve'&&m.K>0){const fs=[[m.K/4,'¼ Kelly'],[m.K/2,'½ Kelly'],[m.K,'Full Kelly'],[m.K*1.5,'1.5× Kelly'],[m.K*2,'2× Kelly'],[m.Z,'Zero-growth point'],[D.risk/100,'Your risk']].filter(x=>x[0]>0&&x[0]*m.L<0.999).sort((a,b)=>a[0]-b[0]);
      return MD.table(['Sizing','Risk per trade','Log growth per trade','Trades to double'],fs.map(([f,n])=>{const g=m.g(f);return[n,pc(f,2),isFinite(g)?sgn(g*100,3).replace('+','')+'%':'−∞',g>1e-6&&isFinite(g)?Math.ceil(Math.log(2)/g).toLocaleString('en-US'):'never'];}))+'\n';}
    if(title.startsWith('P(losing streak')){const ks=[2,3,4,5,6,7,8,9,10,12,15];return MD.table(['Losses in a row (k)','P(at least one run ≥ k in '+D.hor+' trades)',''],ks.map(k=>{const v=SFX.probStreak(m.q,k,D.hor);return[String(k),pc(v),MD.bar(v,1)];}))+'\n';}
    if(title==='Equity after k straight losses'){const r=D.risk/100*m.L,f=(rr,k)=>D.sizing==='fixed'?Math.max(0,1-k*rr):Math.pow(Math.max(0,1-rr),k);
      return MD.table(['k losses','Equity at '+D.risk+'%','Equity at '+(D.risk/2)+'%','Money lost at '+D.risk+'% (from '+money(D.bal)+')'],[1,2,3,4,5,6,7,8,10,12,15].map(k=>[String(k),pc(f(r,k)),pc(f(r/2,k)),money(D.bal*(1-f(r,k)))]))+'\n';}
    if(title==='Net expectancy vs spread'&&D.sl>0){const comR=m.c-(D.spread>0?D.spread/D.sl:0),be=(m.Eg-comR)*D.sl,ss=[0,D.spread*0.5,D.spread,D.spread*1.5,D.spread*2,be>0?be:null].filter(x=>x!==null&&x>=0).filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a-b);
      return MD.table(['Spread','E[R] net','Per 100 trades'],ss.map(s=>[(+s.toFixed(2))+(s===D.spread?' (yours)':Math.abs(s-be)<1e-9?' (break-even)':''),rfmt(m.Eg-comR-s/D.sl,3),rfmt((m.Eg-comR-s/D.sl)*100,1)]))+'\n';}
    const r=D.res;if(r){
      if(title==='R-multiple distribution'){const R=r.R.slice().sort((a,b)=>a-b),qs=[0,0.1,0.25,0.5,0.75,0.9,1],bins=[[-Infinity,-1.5,'worse than −1.5R'],[-1.5,-0.85,'−1.5R to −0.85R (about a full stop)'],[-0.85,0,'small loss (−0.85R to 0)'],[0,1,'0 to +1R'],[1,2,'+1R to +2R'],[2,Infinity,'+2R or more']];
        return MD.table(['Percentile'].concat(qs.map(q=>q===0?'min':q===1?'max':'p'+Math.round(q*100))),[['R'].concat(qs.map(q=>rfmt(SFX.quantile(R,q))))])+'\n'+MD.table(['Result band','Trades','Share',''],bins.map(b=>{const c=R.filter(x=>x>b[0]&&x<=b[1]).length;return[b[2],String(c),pc(c/R.length),MD.bar(c,R.length)];}))+'\n';}
      if(title==='Losing runs'){const ls=r.stats.streaks.loss,mx=amax(4,ls);const rows=[];for(let k=1;k<=mx;k++){const c=ls.filter(x=>x===k).length;rows.push([String(k),String(c)]);}return MD.table(['Run length','Times it happened'],rows)+'\n';}
      if(title.startsWith('Average R by weekday')){const dw=r.beh.dw;return MD.table(['Day','Trades','Average R','Total R'],[1,2,3,4,5,6,0].filter(i=>dw[i].n>0).map(i=>[DAYS[i],String(dw[i].n),rfmt(dw[i].s/dw[i].n),rfmt(dw[i].s,1)]))+'\n';}
      if(title.startsWith('Average R by hour')){const hr=r.beh.hr;return MD.table(['Hour (server)','Trades','Average R','Total R'],hr.map((h,i)=>[i,h]).filter(x=>x[1].n>0).map(([i,h])=>[String(i).padStart(2,'0')+':00',String(h.n),rfmt(h.s/h.n),rfmt(h.s,1)]))+'\n';}}}
  if(!fixed&&D.gm){const g=D.gm,G=g.G,lad=g.lad;
    if(title.startsWith('Monte Carlo'))return mdFan(g.sim,'Cycle');
    if(title==='Cycle statistics')return cap('How cycles ended')+MD.table(['End','Share of cycles'],[['Take-profit',pc(g.kinds[0],2)],['Final stop',pc(g.kinds[1],2)],['Still open after 120 days',pc(g.kinds[2],2)],['Loss larger than 40× the balance (simulation cut off)',pc(g.kinds[3],2)]])+'\n'+
      cap('Cycle length in days')+MD.table(['p10','p25','p50','p75','p90','p95','p99'],[mdQuant(g.days,[0.1,0.25,0.5,0.75,0.9,0.95,0.99],x=>x.toFixed(1))])+'\n';
    if(title==='Floating loss vs adverse move'){const ms=[0.25,0.5,1,1.5,2,3,5,8,12].map(k=>k*D.gVol),extra=[lad.ruinD,lad.wipeD,lad.stopD].filter(x=>x!==null&&isFinite(x));
      const all=ms.concat(extra).filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a-b);
      return cap('Floating loss after price moves against the first entry (no bounce)')+MD.table(['Adverse move (pips)','Daily ranges','Floating loss','% of balance','',''],all.map(d=>{const l=lad.lossAt(d);return[pip(d),(d/D.gVol).toFixed(2)+'×',money(-l),pc(l/D.bal),MD.bar(Math.min(l,D.bal),D.bal),Math.abs(d-lad.wipeD)<1e-9?'wiped out':Math.abs(d-lad.ruinD)<1e-9?'ruin line':d===lad.stopD?'final stop':''];}))+'\n';}
    if(title==='How deep cycles go')return MD.table(['Order','Opens at (pips)','Cycles reaching it',''],g.reach.map((x,i)=>[String(i+1),negp(lad.L[i].d),pc(x,2),MD.bar(x,1)]))+'\n';
    if(title==='How deep the floating loss gets'){const mae=Array.from(g.pool.mae),lv=[1,2,5,10,25,D.ruin,50,75,100].filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a-b);
      return MD.table(['Worst floating loss of at least','Share of cycles','About 1 cycle in',''],lv.map(x=>{const v=mae.filter(m=>m>=D.bal*x/100).length/g.N;return[x+'% of balance'+(x===D.ruin?' (ruin line)':''),pc(v,2),v>0?Math.round(1/v).toLocaleString('en-US'):'none in '+g.N.toLocaleString('en-US'),MD.bar(v,1)];}))+'\n';}
    if(title.startsWith('Where the money goes'))return MD.table(['Per 1,000 cycles','Money'],[['From winning cycles',money(g.sumW/g.N*1000)],['From losing cycles',money(g.sumL/g.N*1000)],['Net',money(g.E*1000)]])+'\n';
    if(title==='Cumulative P(ruin) by cycle')return mdRuinCurve(g.sim,'By cycle',true);}
  return'';}
function mdInputs(){
  const fixed=D.stype==='fixed',ns=D.stype==='nostop',F=D.filled||{};
  const rows=fixed?[['Strategy','d-wr','wr'],['Strategy','d-rr','rr'],['Strategy','d-n','n'],['Strategy','d-tpd','tpd'],['Risk rules','d-risk','risk'],['Risk rules','d-sizing','sizing'],['Risk rules','d-dafter','dAfter'],['Risk rules','d-dcut','dCut'],
      ['Account and costs','d-bal','bal'],['Account and costs','d-sl','sl'],['Account and costs','d-spread','spread'],['Account and costs','d-comm','comm'],['Account and costs','d-pv','pv'],['Simulation','d-hor','hor'],['Simulation','d-ruin','ruin']]
    :[['Grid','g-lot','gLot']].concat(ns?[]:[['Grid','g-step','gStep'],['Grid','g-grow','gGrow']].concat(D.gGrow==='add'?[['Grid','g-add','gAdd']]:[['Grid','g-mult','gMult']]).concat([['Grid','g-max','gMax']])).concat([['Grid','g-tp','gTp'],['Grid','g-sl','gSl'],['Grid','g-vol','gVol'],['Grid','g-auto','gAuto'],['Grid','g-mkt','gMkt'],
      ['Account and costs','d-bal','bal'],['Account and costs','d-spread','spread'],['Account and costs','d-comm','comm'],['Account and costs','d-pv','pv'],['Simulation','d-hor','hor'],['Simulation','d-ruin','ruin']]);
  const sel={sizing:'d-sizing',gAuto:'g-auto',gMkt:'g-mkt',gGrow:'g-grow'},unsetKeys=UNSET.map(x=>x[1]),blankOk={sl:1,pv:1,gSl:1};
  const out=rows.map(([grp,id,k])=>{const v=sel[k]?MD.optText(id):blankOk[k]&&!(D[k]>0)?tx('not set','ไม่ได้ใส่'):String(D[k]);
    const src=k in F?tx('from Myfxbook file','จากไฟล์ Myfxbook'):unsetKeys.includes(k)?(isUnset(k)?tx('default, not entered','ค่าเริ่มต้น ไม่ได้ใส่เอง'):tx('entered','ใส่เอง')):tx('setting','การตั้งค่า');
    return[grp,MD.label(id),v,src];});
  out.push(['Simulation',tx('Simulated paths','จำนวนเส้นจำลอง'),fixed?D.sims.toLocaleString('en-US'):'4,000 cycles → 2,000 paths',tx('fixed','ค่าคงที่')]);
  if(fixed&&D.parsed)out.push(['Trade history',tx('Myfxbook file','ไฟล์ Myfxbook'),D.fileName+' · '+D.symbol+' · '+(D.net==='net'?'net':'gross'),tx('loaded','โหลดแล้ว')]);
  return MD.table(['Group','Input','Value','Source'],out,['l','l','r','l']);}
function mdGlance(){
  const st=D.stype,rows=[];let pri=[];
  if(st==='fixed'){const m=D.model,F=simFacts(m.sim),safe=safeFrom(m.sweep),P=buildPlan(m,D.res),low=P.find(x=>x.key==='lower');
    rows.push(['Verdict',ICON[m.v]+' '+t('dv_'+m.v)],['Net expectancy per trade',rfmt(m.En,3)+' (95% CI '+sgn(m.Elo)+' to '+sgn(m.Ehi)+')'],['Per 100 trades',rfmt(m.En*100,1)],['Break-even win rate vs yours',pc(m.be)+' vs '+pc(m.p,1)],
      ['P(falling '+D.ruin+'% within '+D.hor+' trades)',pc(m.sim.ruinProb)],['Max drawdown, typical / 1 in 20',dpc(F.dd50)+' / '+dpc(F.dd95)],['Median final equity',eqFmt(F.med)],
      ['Full Kelly / your risk',m.K>0?pc(m.K)+' / '+D.risk+'% ('+(D.risk/100/m.K).toFixed(2)+'× Kelly)':'no edge, Kelly = 0'],['Highest tested risk with P(ruin) ≤ 5%',safe===null?'none of the tested levels':safe+'%'],
      ['Suggested risk per trade',low?low.v.x+'% (now '+D.risk+'%)':m.En>0?D.risk+'% (keep)':'don\'t trade it yet']);
    pri=P.filter(x=>x.lvl!=='info').slice(0,4).map(x=>'**'+t('pl2_'+x.lvl)+':** '+x.title);}
  else{const g=D.gm,lad=g.lad,sim=g.sim,X=gExpl(g);
    rows.push(['Verdict',ICON[g.v]+' '+t('gv_'+g.v)],['Cycles won',pc(g.win)],['Average win / average loss',money(g.avgW)+' / '+money(g.avgL)],['Expected result per cycle',money(g.E)+' ± '+money(2*g.se)],
      ['P(falling '+D.ruin+'% within '+D.hor+' cycles)',pc(sim.ruinProb)],['P(account wiped out)',pc(sim.wipeProb)],['Move that wipes the account',isFinite(lad.wipeD)?pip(lad.wipeD)+' pips ('+(lad.wipeD/D.gVol).toFixed(1)+' daily ranges)':'none'],
      ['Largest tested first order with P(ruin) ≤ 5%',g.safe===null?'none of the tested sizes':lf(g.safe)+' lots (now '+D.gLot+')']);
    pri=[X.gn_fan&&X.gn_fan.todo,X.gn_sweep&&X.gn_sweep.todo].filter((x,i,a)=>x&&a.indexOf(x)===i);}
  return MD.kv(rows,['Headline','Value'])+'\n'+(pri.length?MD.h(3,tx('First things to fix','สิ่งที่ต้องแก้ก่อน'))+MD.list(pri):MD.p(tx('Nothing urgent. Keep following the rules below and re-run as trades come in.','ไม่มีเรื่องเร่งด่วน ทำตามกฎด้านล่างต่อไป และกลับมาวิเคราะห์ใหม่เมื่อมีไม้เพิ่ม')));}
function mdRules(){
  const st=D.stype,R=[];
  if(st==='fixed'){const m=D.model;if(m.En<=0||m.p>=1)return MD.p(tx('No trading rules yet: the numbers you entered don\'t show an edge to protect. Fix the edge first (see the action plan), then export again.','ยังไม่มีกฎการเทรด เพราะตัวเลขที่ใส่ยังไม่มี Edge ให้ปกป้อง แก้เรื่อง Edge ก่อน (ดูแผนสิ่งที่ต้องทำ) แล้วค่อยออกรายงานใหม่'));
    const P=buildPlan(m,D.res),low=P.find(x=>x.key==='lower'),risk=low?low.v.x:D.risk,F=simFacts(risk===D.risk?m.sim:runSim(m.p,risk)),k=SFX.typicalStreak(m.q,D.hor),rr=risk/100*m.L,drop=1-(D.sizing==='fixed'?Math.max(0,1-k*rr):Math.pow(1-rr,k));
    R.push(tx(`Risk ${risk}% of the account per trade, never more.`,`เสี่ยง ${risk}% ของทุนต่อไม้ ห้ามเกิน`));
    if(D.sl>0&&D.pv>0)R.push(tx(`Size each trade with lots = balance × ${risk}% ÷ (SL × ${D.pv}). At ${money(D.bal)} and a ${D.sl} stop that is ${(Math.floor(D.bal*risk/100/(D.sl*D.pv)*100)/100).toFixed(2)} lots.`,`คำนวณล็อตทุกไม้: ล็อต = ทุน × ${risk}% ÷ (SL × ${D.pv}) ที่ทุน ${money(D.bal)} และ SL ${D.sl} คือ ${(Math.floor(D.bal*risk/100/(D.sl*D.pv)*100)/100).toFixed(2)} ล็อต`));
    else R.push(tx(`Size each trade with lots = balance × ${risk}% ÷ (SL distance × value per unit per lot).`,`คำนวณล็อตทุกไม้: ล็อต = ทุน × ${risk}% ÷ (ระยะ SL × มูลค่าต่อหน่วยต่อล็อต)`));
    if(k>0)R.push(tx(`Expect ${k} losses in a row at some point in ${D.hor} trades. That costs about ${dpc(drop)} and is normal, not a reason to change the system.`,`คาดไว้เลยว่าจะแพ้ติดกัน ${k} ไม้สักครั้งใน ${D.hor} ไม้ ซึ่งทำให้ทุนลดลงประมาณ ${dpc(drop)} เป็นเรื่องปกติ ไม่ใช่เหตุผลให้เปลี่ยนระบบ`));
    R.push(D.dAfter>0?tx(`After ${D.dAfter} losses in a row, cut risk by ${D.dCut}% until the next win.`,`หลังแพ้ติดกัน ${D.dAfter} ไม้ ลดความเสี่ยงลง ${D.dCut}% จนกว่าจะชนะ`):tx(`Consider halving risk after ${Math.max(2,Math.round(k/2))} losses in a row (test it with the de-risk setting).`,`พิจารณาลดความเสี่ยงครึ่งหนึ่งหลังแพ้ติดกัน ${Math.max(2,Math.round(k/2))} ไม้ (ทดลองได้ที่ช่องลดความเสี่ยง)`));
    R.push(tx(`If the account falls more than ${dpc(F.dd95)} from its peak, stop and review. Only 1 simulated future in 20 falls that far.`,`ถ้าทุนลดลงเกิน ${dpc(F.dd95)} จากจุดสูงสุด ให้หยุดและทบทวน มีเพียง 1 ใน 20 อนาคตจำลองที่ลงลึกขนาดนี้`));
    R.push(tx(`Hard stop: at −${D.ruin}% from the start, stop trading this strategy.`,`จุดหยุดเด็ดขาด: ติดลบ ${D.ruin}% จากทุนเริ่มต้น เลิกเทรดกลยุทธ์นี้`));
    R.push(tx(`Track the real win rate. If it settles below ${pc(m.be)} (break-even with your R:R and costs), the edge is gone.`,`ติดตามอัตราชนะจริง ถ้านิ่งอยู่ต่ำกว่า ${pc(m.be)} (จุดคุ้มทุนตาม R:R และต้นทุนของคุณ) แปลว่า Edge หายไปแล้ว`));
    R.push(tx(`Re-run this report after ${D.n+50} trades, or monthly, whichever comes first.`,`กลับมาออกรายงานใหม่เมื่อครบ ${D.n+50} ไม้ หรือทุกเดือน แล้วแต่อย่างไหนถึงก่อน`));}
  else{const g=D.gm,lad=g.lad,ns=D.stype==='nostop',size=g.safe!==null?Math.min(g.safe,D.gLot):null;
    R.push(size!==null?tx(`First order no bigger than ${lf(size)} lots at a ${money(D.bal)} balance${D.gAuto==='scale'?', scaled with the balance':''}.`,`ออเดอร์แรกไม่เกิน ${lf(size)} ล็อต ที่ทุน ${money(D.bal)}${D.gAuto==='scale'?' และปรับตามทุน':''}`):tx('No tested first-order size keeps P(ruin) under 5%. Redesign the grid before trading it.','ไม่มีขนาดออเดอร์แรกที่ทดสอบแล้วทำให้โอกาสพอร์ตแตกต่ำกว่า 5% ควรออกแบบกริดใหม่ก่อนเทรด'));
    if(!ns)R.push(tx(`Never add orders beyond the ${g.G.M} planned, and never widen the spacing (${D.gStep} pips) or raise the ${D.gGrow==='add'?'lot increment ('+D.gAdd+')':'multiplier ('+D.gMult+')'} mid-cycle.`,`ห้ามเปิดออเดอร์เกิน ${g.G.M} ไม้ที่วางแผนไว้ ห้ามขยายระยะห่าง (${D.gStep} pips) หรือเพิ่ม${D.gGrow==='add'?'ล็อตที่บวกต่อไม้ ('+D.gAdd+')':'ตัวคูณ ('+D.gMult+')'} ระหว่างรอบ`));
    if(isFinite(lad.ruinD))R.push(tx(`Set a price alert ${pip(lad.ruinD)} pips against the first entry: that is the ruin line (−${D.ruin}%). The account is wiped out at ${pip(lad.wipeD)} pips.`,`ตั้งแจ้งเตือนราคาที่ ${pip(lad.ruinD)} pips สวนจากออเดอร์แรก นั่นคือเส้นพอร์ตแตก (−${D.ruin}%) และพอร์ตจะหมดที่ ${pip(lad.wipeD)} pips`));
    R.push(D.gSl>0?tx(`Keep the final stop at ${D.gSl} pips after the last order, and let it fire.`,`คง Stop สุดท้ายไว้ที่ ${D.gSl} pips หลังออเดอร์สุดท้าย และปล่อยให้มันทำงาน`):tx('There is no final stop, so one long trend can take the whole account. Decide in advance where you will close everything.','ไม่มี Stop สุดท้าย เทรนด์ยาวครั้งเดียวอาจกินทั้งพอร์ต กำหนดล่วงหน้าว่าจะปิดทั้งหมดที่ไหน'));
    R.push(tx(`Re-check the pair's average daily range every month. This analysis assumes ${D.gVol} pips; if the market gets wider, every distance above shrinks in real terms.`,`ตรวจช่วงราคาเฉลี่ยต่อวันของคู่เงินทุกเดือน การวิเคราะห์นี้ใช้ ${D.gVol} pips ถ้าตลาดผันผวนขึ้น ทุกระยะด้านบนจะแคบลงในทางปฏิบัติ`));
    R.push(tx('Expect the rare big loss. The winning streak is the normal part; the loss in the tables above is the price of it.','เตรียมใจรับการขาดทุนก้อนใหญ่ที่นาน ๆ เกิดครั้ง ช่วงที่ชนะต่อเนื่องคือส่วนปกติ ส่วนการขาดทุนในตารางด้านบนคือราคาที่ต้องจ่าย'));}
  return MD.check(R)+'\n'+tx('Signed: ____________________   Date: ____________','ลงชื่อ: ____________________   วันที่: ____________')+'\n';}
function mdMethod(){
  const st=D.stype,rows=[];
  if(st==='fixed'){rows.push(['Trade model','Each trade wins +W R or loses −L R. W = reward : risk − cost, L = 1 + cost, cost = (spread + commission ÷ value per unit) ÷ SL.'],
      ['Win-rate uncertainty','Wilson score interval, 95%, on '+D.n+' trades. Expectancy CI = the payoff evaluated at both ends.'],
      ['Monte Carlo',D.sims.toLocaleString('en-US')+' paths × '+D.hor+' trades, '+(D.sizing==='fixed'?'fixed risk on the starting balance':'compounding risk on the current balance')+(D.dAfter>0?', risk cut '+D.dCut+'% after '+D.dAfter+' losses in a row':'')+'. Ruin = equity at or below '+(100-D.ruin)+'% of the start. Seed 21.'],
      ['Sizing sweeps','1,000 paths per risk level, same seed, so levels differ only by size.'],
      ['Kelly','f* = p/L − q/W. Zero-growth point found by bisection on g(f) = p·ln(1 + fW) + q·ln(1 − fL).'],
      ['Streaks','Exact probability of at least one run of k losses in N trades (recursion on run length).'],
      ['Sample size','Smallest n where the Wilson lower bound still gives positive expectancy.']);
    if(D.res)rows.push(['Trade history','R = pips ÷ SL ('+(D.res.conv.usedNet?'net of swap and commission':'gross')+'). Bootstrap of the mean, 4,000 resamples'+(D.res.n>10000?' (normal approximation, exact at this sample size)':'')+'. Monte Carlo resamples your real R values, '+D.sims.toLocaleString('en-US')+' paths, seed 11.']);}
  else rows.push(['Price model','48 steps a day. Daily σ = average daily range ÷ 1.596. '+(D.gMkt==='real'?'Fat tails + trends: Student-t(3) steps, AR(1) log-volatility and AR(1) drift.':'Random walk: Gaussian steps.')],
      ['Cycles','4,000 simulated cycles, fills at the simulated price, cut off after 120 days or a loss of 40× the balance. Seed 31.'],
      ['Account paths','2,000 paths × '+D.hor+' cycles, built by resampling whole cycles, '+(D.gAuto==='scale'?'lots scaled with the balance':'fixed lots')+'. Seed 41.'],
      ['Size sweep','800 paths per first-order size, seed 43.'],
      ['Exposure maths','Floating loss = total lots × (distance − average entry) × value per pip + spread and commission on every order.']);
  let s=MD.table(['Piece','How it works'],rows,['l','l'])+'\n';
  if(st==='fixed')s+='```\nE[R]          = p·W − q·L\nbreak-even p  = L ÷ (W + L)\nKelly f*      = p/L − q/W\ngrowth g(f)   = p·ln(1 + f·W) + q·ln(1 − f·L)\nlots          = balance × risk ÷ (SL × value per unit)\n```\n\n';
  return s+MD.p(tx('Every simulation uses a fixed seed, so the same inputs always give the same numbers. Re-enter the inputs above to reproduce this report.','ทุกการจำลองใช้ Seed คงที่ ค่าที่ใส่เหมือนเดิมจะได้ตัวเลขเหมือนเดิมเสมอ ใส่ค่าตามตารางด้านบนเพื่อสร้างรายงานนี้ซ้ำ'));}
function mdLimits(){
  const tl=k=>(I18N[LANG]&&I18N[LANG][k])||I18N.en[k],li=a=>a.map(x=>'- **'+x[0]+'.** '+x[1]).join('\n')+'\n\n';let s='';
  tl('sc_cant').forEach(g=>{s+=MD.h(3,g[0])+li(g[1]);});
  return s;}
function mdReport(){
  clearTimeout(timer);analyze();
  const st=D.stype,fixed=st==='fixed';if(fixed?!D.model:!D.gm)return null;
  const S=MD.stamp(),name={fixed:'Fixed stop',grid:'Grid / martingale',nostop:'No hard stop'}[st];let html;
  if(fixed){const m=D.model,r=D.res;EXPL=Object.assign({},buildModelExpl(m),r?buildHistExpl(r):{});
    html=mSummary(m)+mEdge(m)+mSurvival(m)+mSizing(m)+mStreaks(m)+mCosts(m)+(r?secSummary(r)+secEdge(r)+secSurvival(r)+secBehavior(r)+secCosts(r):`<section>${mHead(6)}<div class="card"><p>${esc(D.histMsg())}</p></div></section>`);}
  else{const g=D.gm;EXPL=gExpl(g);html=gSummary(g)+gExposure(g)+gOutcomes(g)+gSurvival(g)+gReal(g);}
  const tpl=document.createElement('template');tpl.innerHTML=html;
  const gk=window.__sfxGate,errs=!$('desk-err').hidden?$('desk-err').textContent:'';
  let md='# Jarn Neow risk report: '+name+'\n\n';
  md+=MD.quote(tx('A risk report for one trading strategy: how likely the account is to survive, how deep the falls can get and what size keeps the risk acceptable. It is not a profit forecast and not financial advice.','รายงานความเสี่ยงของกลยุทธ์เทรดหนึ่งระบบ: โอกาสที่พอร์ตจะรอด การย่อตัวลึกได้แค่ไหน และขนาดไม้ที่ทำให้ความเสี่ยงอยู่ในระดับรับได้ ไม่ใช่การทำนายกำไร และไม่ใช่คำแนะนำทางการเงิน'));
  md+=MD.kv([['Generated',S.local],['App','Jarn Neow, Expert mode ('+MD.appUrl()+')'],['Strategy type',name+' ('+t(st==='fixed'?'st_fixed_d':st==='grid'?'st_grid_d':'st_nostop_d')+')'],['Language',LANG==='th'?'ไทย':'English'],
    ['Testing done',gk?t('gate_'+gk+'_t'):'not answered']],['Report','Detail']);
  if(errs)md+=MD.quote('⚠ '+errs+' '+tx('The last valid values were used.','ใช้ค่าล่าสุดที่ถูกต้องแทน'));
  md+=MD.h(2,tx('At a glance','สรุปสั้น'))+mdGlance();
  md+=MD.h(2,tx('Inputs','ค่าที่ใส่'))+mdInputs()+'\n';
  if(gk)md+=MD.h(2,tx('Testing status','สถานะการทดสอบ'))+MD.p('**'+t('gate_'+gk+'_t')+'** '+t('gate_'+gk+'_p'))+(gk!=='ok'?MD.list([1,2,3].map(i=>t('gate_'+gk+'_'+i))):'');
  md+=mdWalk(tpl.content,false);
  md+=MD.h(2,tx('Trading rules to commit to','กฎการเทรดที่ตั้งใจจะทำตาม'))+MD.p(tx('Derived from the numbers above. Print it, sign it, keep it next to the screen.','สรุปจากตัวเลขด้านบน พิมพ์ออกมา เซ็นชื่อ แล้ววางไว้ข้างจอ'))+mdRules();
  md+=MD.h(2,tx('Method and reproducibility','วิธีคำนวณและการทำซ้ำ'))+mdMethod();
  md+=MD.h(2,tx('What this report can\'t tell you','สิ่งที่รายงานนี้บอกไม่ได้'))+mdLimits();
  md+=MD.h(2,tx('Glossary','อภิธานศัพท์'))+MD.glossary().map(g=>'- **'+g[0]+'**: '+g[1]).join('\n')+'\n';
  md+=MD.h(2,tx('Disclaimer','ข้อจำกัดความรับผิดชอบ'))+MD.p(t('disclaimer'))+'---\n\n'+MD.p(tx('Made with Jarn Neow, free and open. Everything was calculated in your browser; nothing was uploaded.','สร้างด้วย Jarn Neow ใช้ฟรี ทุกอย่างคำนวณในเบราว์เซอร์ของคุณ ไม่มีข้อมูลถูกอัปโหลด'));
  draw0();
  return{text:md.replace(/\n{3,}/g,'\n\n'),file:'jarn-neow-'+st+'-'+S.file+'.md'};}
function draw0(){if(D.stype==='fixed'){const m=D.model,r=D.res;EXPL=Object.assign({},buildModelExpl(m),r?buildHistExpl(r):{});}else EXPL=gExpl(D.gm);}

/* ---------- what-if sliders on Expert charts ---------- */
const WI_CFG=[['Monte Carlo',['wr','rr','risk','hor']],['Model statistics',['wr','rr','n']],['Expectancy vs win rate',['rr','n']],['Break-even frontier',['wr','rr']],
  ['P(ruin) if the true win rate differs',['n','risk']],['Survival metrics',['risk','wr']],['Final equity distribution',['risk','hor']],['Max drawdown distribution',['risk','wr']],
  ['Cumulative P(ruin) by trade',['risk','ruin']],['P(ruin) vs risk per trade',['wr','rr']],['Kelly growth curve',['wr','rr','risk']],['Sizing scenarios',['wr','rr']],['Lot size',['risk']],
  ['P(losing streak',['wr','hor']],['Equity after k straight losses',['risk']],['Recovery maths',['risk']],['Cost breakdown',['spread','comm']],['Net expectancy vs spread',['spread','wr']]];
const WI_SEC=[null,mSummary,mEdge,mSurvival,mSizing,mStreaks,mCosts];
function wiRange(k){const b=D[k];switch(k){
  case'wr':return{min:1,max:99,step:0.5,f:v=>v+'%'};
  case'rr':return{min:0.2,max:Math.max(6,Math.ceil(b*2)),step:0.05,f:v=>v+'R'};
  case'risk':return{min:b<0.5?0.05:0.1,max:Math.max(20,Math.ceil(b*2)),step:b<0.5?0.05:0.1,f:v=>v+'%'};
  case'n':return{min:10,max:Math.max(2000,Math.ceil(b*2/10)*10),step:10,f:v=>String(v)};
  case'hor':return{min:50,max:1000,step:10,f:v=>v+' trades'};
  case'ruin':return{min:10,max:90,step:5,f:v=>'−'+v+'%'};
  case'spread':{const mx=Math.max(D.sl*0.2,b*3,1),st=+(Math.pow(10,Math.floor(Math.log10(mx/200)))).toPrecision(1);return{min:0,max:+(Math.ceil(mx/st)*st).toFixed(6),step:st,f:v=>String(+(+v).toFixed(4))};}
  case'comm':return{min:0,max:Math.max(20,Math.ceil(b*3)),step:0.5,f:v=>String(v)};}}
const WI_LAB={wr:'d_wr',rr:'d_rr',risk:'d_risk',n:'d_n',hor:'d_hor',ruin:'d_ruin',spread:'d_spread',comm:'d_comm'};
let wiTimer=null,wiBusy=null,wiPend=null;
function wiLive(box){wiPend=box;if(wiBusy)return;const loop=()=>{const b=wiPend;wiPend=null;if(!b){wiBusy=null;return;}wiApply(b,true);wiBusy=requestAnimationFrame(loop);};wiBusy=requestAnimationFrame(loop);}
function wiFind(root,prefix){return Array.from(root.querySelectorAll('.card')).find(c=>{const h=c.querySelector(':scope>h3');return h&&h.textContent.startsWith(prefix);});}
function wiInit(){
  document.querySelectorAll('#d-main .dsec').forEach(sec=>{const step=+sec.dataset.step;if(!WI_SEC[step])return;
    WI_CFG.forEach(([pre,keys])=>{const c=wiFind(sec,pre);if(!c)return;if(keys.includes('comm')&&!(D.pv>0))keys=keys.filter(k=>k!=='comm');if(!keys.length)return;
      const h=c.querySelector(':scope>h3');
      const box=document.createElement('div');box.className='wi';box.dataset.pre=pre;box.dataset.step=step;
      box.innerHTML=`<div class="wih"><span>${esc(t('wi_title'))}</span><button type="button" class="link wireset" hidden>${esc(t('wi_reset'))}</button></div>`+
        keys.map(k=>{const r=wiRange(k),v=D[k];return`<label class="wis"><span>${esc(t(WI_LAB[k]))}</span><input type="range" data-k="${k}" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}" data-base="${v}"><b>${esc(r.f(v))}</b></label>`;}).join('')+
        `<p class="winote" hidden></p>`;
      h.after(box);});});}
function rowAlign(){
  document.querySelectorAll('#d-main .dgrid>div>.card').forEach(c=>{if(c.dataset.al)return;c.dataset.al=1;
    const kids=[...c.children],h=kids[0]&&kids[0].tagName==='H3'?kids.shift():null;
    let wi=kids[0]&&kids[0].classList.contains('wi')?kids.shift():null;
    const last=kids[kids.length-1];let ft=last&&(last.matches('details.ex')||last.matches('p.small.muted'))&&kids.length>1?kids.pop():null;
    const viz=document.createElement('div');viz.className='cviz';kids.forEach(k=>viz.appendChild(k));
    if(!wi){wi=document.createElement('div');wi.className='wi-none';}if(!ft){ft=document.createElement('div');ft.className='ex-none';}
    if(!h){const e=document.createElement('div');c.prepend(e);}c.append(wi,viz,ft);});}
function wiApply(box,fast){
  const step=+box.dataset.step,pre=box.dataset.pre,over={},diff=[];
  box.querySelectorAll('input[type=range]').forEach(inp=>{const k=inp.dataset.k,v=parseFloat(inp.value),b=parseFloat(inp.dataset.base);over[k]=k==='n'||k==='hor'?Math.round(v):v;
    inp.nextElementSibling.textContent=wiRange(k).f(over[k]);if(Math.abs(v-b)>1e-9)diff.push(t('wi_item',{name:t(WI_LAB[k]),v:wiRange(k).f(over[k]),b:wiRange(k).f(b)}));});
  const keys=Object.keys(over),save={},sv={model:D.model,pay:D._pay,sims:D.sims,ex:EXPL};let m2=D.model;
  keys.forEach(k=>{save[k]=D[k];D[k]=over[k];});D._wi=true;
  try{if(diff.length){D.sims=fast?400:2000;D._sub=fast?200:0;computeModel();m2=D.model;EXPL=Object.assign({},sv.ex,buildModelExpl(m2));}
    const tpl=document.createElement('template');tpl.innerHTML=WI_SEC[step](m2);const src=wiFind(tpl.content,pre),dst=box.closest('.card');
    if(src&&dst){['.chart','table','.legend'].forEach(sel=>{const a=src.querySelectorAll(sel),b=dst.querySelectorAll(sel);b.forEach((el,i)=>{if(a[i])el.replaceWith(a[i].cloneNode(true));});});
      const h1=src.querySelector(':scope>h3'),h2=dst.querySelector(':scope>h3');if(h1&&h2)h2.textContent=h1.textContent;
      const e1=src.querySelector('details.ex'),e2=dst.querySelector('details.ex');if(e1&&e2){const sm=e2.querySelector('summary');e2.querySelectorAll(':scope>p').forEach(x=>x.remove());e1.querySelectorAll(':scope>p').forEach(x=>e2.appendChild(x.cloneNode(true)));e2.classList.toggle('wiex',!!diff.length);if(sm)sm.textContent=diff.length?t('wi_ex'):t('ex_toggle');}}
  }finally{D.model=sv.model;D._pay=sv.pay;D.sims=sv.sims;D._sub=0;EXPL=sv.ex;keys.forEach(k=>{D[k]=save[k];});D._wi=false;}
  const n=box.querySelector('.winote'),rs=box.querySelector('.wireset');n.hidden=!diff.length;rs.hidden=!diff.length;box.classList.toggle('on',!!diff.length);box.closest('.card').classList.toggle('wion',!!diff.length);
  if(diff.length)n.textContent=t('wi_note',{list:diff.join(', ')});}
function draw(){
  const m=D.model,r=D.res,main=$('d-main');if(!m)return;
  EXPL=Object.assign({},buildModelExpl(m),r?buildHistExpl(r):{});
  const hist=r?(secSummary(r)+secEdge(r)+secSurvival(r)+secBehavior(r)+secCosts(r)):`<section class="dsec" data-step="7">${mHead(6)}<div class="card empty">${esc(D.histMsg())}</div></section>`;
  main.innerHTML=mSummary(m)+mEdge(m)+mSurvival(m)+mSizing(m)+mStreaks(m)+mCosts(m)+hist;wiInit();rowAlign();applyLayout();}
function applyLayout(){
  const secs=Array.from($('d-main').querySelectorAll('.dsec'));
  secs.forEach(s=>{const step=+s.dataset.step,vis=D.layout==='full'||D.stype!=='fixed'||step<=D.reached;s.hidden=!vis;const nb=s.querySelector('.nextbar');if(nb)nb.hidden=!(D.layout==='guided'&&step===D.reached);});
  jumpMenu();}
/* a plain list of the sections on the page, so people can go straight to the card they want */
function jumpMenu(){
  const nav=$('d-jump');if(!nav)return;
  const all=Array.from($('d-main').querySelectorAll(':scope>section')).filter(s=>!s.hidden&&s.querySelector('h2'));
  const show=all.length>2&&(D.layout==='full'||D.stype!=='fixed');nav.hidden=!show;if(!show){nav.innerHTML='';return;}
  nav.innerHTML=`<span>${esc(t('jump_t'))}</span>`+all.map((s,i)=>{if(!s.id)s.id='dsec-'+i;const h=s.querySelector('h2'),name=(h.firstChild&&h.firstChild.nodeType===3?h.firstChild.textContent:h.textContent).trim();return`<a href="#${s.id}">${esc(name)}</a>`;}).join('');}
function setLayout(l){D.layout=l;if(D.model||D.gm)applyLayout();}
function setExplain(on){D.explain=!!on;document.querySelectorAll('#d-main details.ex').forEach(d=>{d.open=D.explain;});}

/* ---------- events ---------- */
const dtouch={};let unsetHidden=false;
const UNSET=[['d-wr','wr'],['d-rr','rr'],['d-n','n'],['d-tpd','tpd'],['d-risk','risk'],['g-lot','gLot'],['g-step','gStep'],['g-mult','gMult'],['g-add','gAdd'],['g-max','gMax'],['g-tp','gTp'],['g-vol','gVol'],['d-bal','bal'],['d-sl','sl'],['d-spread','spread'],['d-comm','comm'],['d-pv','pv']];
const shown=id=>{const el=$(id);if(!el)return false;const g=D.stype!=='fixed';if(el.closest('.st-f'))return!g;if(el.closest('.st-g'))return g&&!(el.closest('.g-only')&&D.stype==='nostop')&&!(el.closest('.g-mul')&&D.gGrow==='add')&&!(el.closest('.g-addr')&&D.gGrow!=='add');return true;};
const DF=[['d-wr','wr',1,100],['d-rr','rr',0.05,100],['d-n','n',5,100000],['d-tpd','tpd',0.05,200],['d-risk','risk',0.05,100],['d-dafter','dAfter',0,20,0],['d-dcut','dCut',5,95],
   ['g-lot','gLot',0.01,100],['g-step','gStep',1,10000],['g-mult','gMult',1,5],['g-add','gAdd',0.01,100],['g-max','gMax',1,30],['g-tp','gTp',1,10000],['g-sl','gSl',0,100000,0],['g-vol','gVol',1,10000],
   ['d-bal','bal',1,1e12],['d-sl','sl',0,1e9,0],['d-spread','spread',0,1e9,0],['d-comm','comm',0,1e9,0],['d-pv','pv',0,1e9,0],['d-hor','hor',20,2000],['d-ruin','ruin',5,95]];
const derrs={};
function checkField(id){
  const f=DF.find(x=>x[0]===id),el=$(id),raw=el.value.trim(),v=parseFloat(raw),[,,min,max,blank]=f;
  if(raw===''&&blank!==undefined){delete derrs[id];return'blank';}
  if(raw!==''&&isFinite(v)&&v>=min&&v<=max){delete derrs[id];return blank!==undefined&&v===0?'blank':'ok';}
  derrs[id]=blank!==undefined?'opt':(max>=1e12?'min':'range');return'bad';}
function revalidate(){DF.forEach(f=>checkField(f[0]));renderErr();}
function renderErr(){
  const names=[];
  DF.forEach(([id,,min,max])=>{const k=shown(id)?derrs[id]:null,el=$(id),e=$('e-'+id);if(!e)return;el.classList.toggle('bad',!!k);el.setAttribute('aria-invalid',String(!!k));e.hidden=!k;
    e.textContent=k==='opt'?t('err_field_opt'):k==='min'?t('err_field_min',{min}):k?t('err_field',{min,max}):'';
    if(k)names.push(document.querySelector('label[for='+id+']').textContent.trim());});
  const b=$('desk-err');b.hidden=!names.length;b.textContent=names.length?t('err_banner',{list:names.join(', ')}):'';renderUnset();}
function isUnset(key){return key==='pv'?!(D[key]>0):key==='sl'?D.stype==='fixed'&&!(D[key]>0):!dtouch[key];}
function renderUnset(){
  const un=UNSET.filter(([id,key])=>shown(id)&&isUnset(key));UNSET.forEach(([id,key])=>$(id).classList.toggle('unset',isUnset(key)));
  const b=$('desk-unset');b.hidden=!un.length||unsetHidden;
  if(un.length)b.innerHTML=`<div class="uhead"><b>${esc(t('unset_desk_t',{n:un.length}))}</b><button type="button" class="btn alt" data-unset-hide="1">${esc(t('unset_hide'))}</button></div><div class="uchips">${un.map(([id])=>`<button type="button" class="uchip" data-unset-go="${id}">${esc(document.querySelector('label[for='+id+']').textContent.trim())}</button>`).join('')}</div>`;}
function init(){
  document.documentElement.dataset.grow=D.gGrow;
  $('csvfile').addEventListener('change',e=>{readFile(e.target.files[0]);e.target.value='';});
  const dz=$('dropzone');
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragover');}));
  dz.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files[0])readFile(e.dataTransfer.files[0]);});
  $('file-status').addEventListener('click',e=>{const b=e.target.closest('[data-det-use]');if(b)setType(b.dataset.detUse);});
  $('symsel').addEventListener('change',e=>{D.symbol=e.target.value;autoFill();statusLine();hint();analyze();});
  /* [id, key, min, max, valueWhenBlank] */
  DF.forEach(([id,key,min,max,blank])=>{const el=$(id),er=document.createElement('p');er.className='ferr';er.id='e-'+id;er.hidden=true;el.closest('.formrow').after(er);
    el.addEventListener('input',()=>{dtouch[key]=1;const st=checkField(id);if(st==='ok'){const v=parseFloat(el.value);D[key]=key==='hor'||key==='n'||key==='dAfter'||key==='gMax'?Math.round(v):v;schedule();}else if(st==='blank'){D[key]=blank;schedule();}renderErr();});});
  $('d-net').addEventListener('change',e=>{D.net=e.target.value;analyze();});
  $('d-sizing').addEventListener('change',e=>{D.sizing=e.target.value;analyze();});
  $('g-auto').addEventListener('change',e=>{D.gAuto=e.target.value;analyze();});
  $('g-mkt').addEventListener('change',e=>{D.gMkt=e.target.value;analyze();});
  $('g-grow').addEventListener('change',e=>{setGrow(e.target.value);analyze();});
  const vc=()=>{const a=parseFloat($('vc-atr').value),k=+$('vc-kind').value,o=$('vc-out'),b=$('vc-use');if(!(a>0)){o.textContent='';b.hidden=true;return;}
    const p=Math.round(a*k*10)/10,v=p>=10?Math.round(p):p;o.textContent=t('vc_out',{p:v.toLocaleString('en-US')});b.textContent=t('vc_use',{p:v.toLocaleString('en-US')});b.dataset.v=v;b.hidden=!(v>=1&&v<=10000);};
  $('vc-atr').addEventListener('input',vc);$('vc-kind').addEventListener('change',vc);
  $('vc-use').addEventListener('click',()=>{const el=$('g-vol');el.value=$('vc-use').dataset.v;el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();});
  document.querySelectorAll('.stypes button').forEach(b=>b.addEventListener('click',()=>setType(b.dataset.st)));
  $('p-type').querySelector('.stypes').addEventListener('keydown',e=>{const bs=[...document.querySelectorAll('.stypes button')],i=bs.findIndex(b=>b.dataset.st===D.stype);
    if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();const j=(i+(e.key==='ArrowDown'||e.key==='ArrowRight'?1:bs.length-1))%bs.length;setType(bs[j].dataset.st);bs[j].focus();}});
  $('desk-unset').addEventListener('click',e=>{const g=e.target.closest('[data-unset-go]'),h=e.target.closest('[data-unset-hide]');
    if(h){unsetHidden=true;renderUnset();return;}
    if(g){const el=$(g.dataset.unsetGo);el.scrollIntoView({block:'center',behavior:'smooth'});setTimeout(()=>el.focus({preventScroll:true}),250);}});
  $('d-apply').addEventListener('click',()=>{autoFill();statusLine();analyze();window.scrollTo(0,0);});
  $('d-jump').addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;e.preventDefault();const sec=$(a.getAttribute('href').slice(1));if(!sec)return;sec.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});const h=sec.querySelector('h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}});
  const mdGo=cp=>{const b=$(cp?'md-desk-copy':'md-desk');let r=null;try{r=mdReport();}catch(e){console.error('report',e);}if(!r)return;if(cp)MD.copy(r.text,b);else{MD.download(r.file,r.text);MD.flash(b,'md_saved');}};
  $('md-desk').addEventListener('click',()=>mdGo(false));$('md-desk-copy').addEventListener('click',()=>mdGo(true));
  $('d-main').addEventListener('input',e=>{const inp=e.target.closest('.wi input[type=range]');if(!inp)return;const box=inp.closest('.wi'),r=wiRange(inp.dataset.k);
    inp.nextElementSibling.textContent=r.f(inp.dataset.k==='n'||inp.dataset.k==='hor'?Math.round(+inp.value):+inp.value);wiLive(box);clearTimeout(wiTimer);wiTimer=setTimeout(()=>wiApply(box),350);});
  $('d-main').addEventListener('change',e=>{const inp=e.target.closest('.wi input[type=range]');if(!inp)return;clearTimeout(wiTimer);const box=inp.closest('.wi');requestAnimationFrame(()=>wiApply(box));});
  $('d-main').addEventListener('click',e=>{const rb=e.target.closest('.wireset');if(rb){const box=rb.closest('.wi');box.querySelectorAll('input[type=range]').forEach(i=>{i.value=i.dataset.base;});wiApply(box);return;}
    const b=e.target.closest('[data-next]');if(!b)return;D.reached=Math.max(D.reached,+b.dataset.next+1);applyLayout();
    const s=$('d-main').querySelector('.dsec[data-step="'+D.reached+'"]');if(s)s.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});});
}
function setGrow(v){D.gGrow=v==='add'?'add':'mult';$('g-grow').value=D.gGrow;document.documentElement.dataset.grow=D.gGrow;revalidate();}
function typeLabels(){const k=D.stype==='grid'?'gi':D.stype==='nostop'?'ni':'fi';
  document.querySelectorAll('#desk label[data-gi]').forEach(l=>{const key=l.dataset[k]||l.dataset.gi;l.dataset.i18n=key;l.textContent=t(key);});}
function setType(st,quiet){
  const prev=D.stype;D.stype=st;document.documentElement.dataset.st=st;
  document.querySelectorAll('.stypes button').forEach(b=>{const on=b.dataset.st===st;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;});
  if(st!=='fixed'&&st!==prev){const d=GDEF[st];[['g-lot','gLot'],['g-tp','gTp'],['g-sl','gSl']].forEach(([id,key])=>{if(!dtouch[key]){D[key]=d[key];$(id).value=key==='gSl'&&!d[key]?'':d[key];}});}
  if(D.parsed&&st!==prev){autoFill();statusLine();hint();}
  if(window.__sfxTip)window.__sfxTip.hide();typeLabels();revalidate();if(!quiet)requestAnimationFrame(()=>setTimeout(analyze,0));}
function refreshText(){typeLabels();hint();if(D.parsed)statusLine();else if(D.err)$('file-status').innerHTML='';renderErr();analyze();}
function seed(st,tc){if(tc)['wr','rr','risk','n'].forEach(k=>{dtouch[k]=tc[k]?1:0;});D.wr=st.wr;D.rr=st.rr;D.risk=st.risk;D.n=Math.round(st.n);$('d-wr').value=D.wr;$('d-rr').value=D.rr;$('d-risk').value=D.risk;$('d-n').value=D.n;revalidate();}
return{init,setLayout,setExplain,refreshText,analyze,mdReport,state:()=>D,seed,touched:()=>({wr:dtouch.wr,rr:dtouch.rr,risk:dtouch.risk,n:dtouch.n})};
})();
