/* Jarn Neow, Expert mode: the dashboard and the gold backtest.
   Loaded by index.html only when Expert is opened, so Beginner visitors don't download or parse it.
   After editing this file, change EXPERT_V in index.html so browsers fetch the new copy. */
/* the gold backtest runs in a Web Worker built from this source */
const BTW_SRC="\n/* min/max over arrays of any length: Math.min(...arr) fails past ~100k items */\nconst amin=function(){let m=Infinity;for(let j=0;j<arguments.length;j++){const a=arguments[j];if(a!==null&&typeof a==='object'){for(let i=0;i<a.length;i++)if(a[i]<m)m=a[i];}else if(a<m)m=a;}return m;},amax=function(){let m=-Infinity;for(let j=0;j<arguments.length;j++){const a=arguments[j];if(a!==null&&typeof a==='object'){for(let i=0;i<a.length;i++)if(a[i]>m)m=a[i];}else if(a>m)m=a;}return m;};\n/* Jarn Neow backtest worker: loads monthly gold files, removes contract-roll jumps, replays the user's rules on 1-minute bars.\n   Prices are integers in ticks of $0.10, and 1 pip = 1 tick. */\n'use strict';\nconst cache=new Map();\nfunction mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}\nfunction decode(buf){\n  let p=0;const rv=()=>{let v=0,m=1,b;do{b=buf[p++];v+=(b&127)*m;m*=128;}while(b&128);return v;},zz=v=>(v%2?-(v+1)/2:v/2);\n  const n=rv(),t0=rv(),p0=zz(rv()),t=new Int32Array(n),o=new Int32Array(n),h=new Int32Array(n),l=new Int32Array(n),c=new Int32Array(n);\n  let tt=t0,pc=p0;\n  for(let i=0;i<n;i++){tt+=rv();const oo=pc+zz(rv()),hi=rv(),lo=rv(),cc=oo+zz(rv());t[i]=tt;o[i]=oo;c[i]=cc;h[i]=Math.max(oo,cc)+hi;l[i]=Math.min(oo,cc)-lo;pc=cc;}\n  return{n,t,o,h,l,c};}\n/* decoded months stay in memory between runs, up to CAP; a full 16-year run would otherwise keep ~115 MB */\nconst CAP=60;\nconst fail=(kind,m,code)=>{const e=new Error(kind+' '+m);e.kind=kind;e.month=m;e.code=code||0;return e;};\nasync function load(url,m,expect,retry){\n  let r;try{r=await fetch(url,retry?{cache:'reload'}:undefined);}catch(e){throw fail('net',m);}\n  if(!r.ok)throw fail('http',m,r.status);\n  let buf=new Uint8Array(await r.arrayBuffer()),d;\n  try{if(buf[0]===0x1f&&buf[1]===0x8b){const ds=new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));buf=new Uint8Array(await new Response(ds).arrayBuffer());}\n    d=decode(buf);}catch(e){throw fail('bad',m);}\n  /* a wrong or damaged file (an error page, a captive Wi-Fi page, a cut download) must not quietly become a missing month */\n  if(expect&&d.n!==expect)throw fail('bad',m);\n  for(let i=1;i<d.n;i++)if(d.t[i]<=d.t[i-1])throw fail('bad',m);\n  return d;}\n/* bases: a CDN first when there is one, then this site; a failure on one falls through to the next, then one retry */\nasync function getMonth(bases,m,expect){\n  if(cache.has(m)){const d=cache.get(m);cache.delete(m);cache.set(m,d);return d;}\n  let d=null,err=null;\n  for(const b of bases){try{d=await load(b+m+'.bin',m,expect,false);break;}catch(e){err=e;}}\n  if(!d){if(err.kind==='http'&&err.code===404)throw err;await new Promise(r=>setTimeout(r,err.code===429?1500:400));d=await load(bases[bases.length-1]+m+'.bin',m,expect,true);}\n  cache.set(m,d);while(cache.size>CAP)cache.delete(cache.keys().next().value);return d;}\n/* join months and remove roll jumps so the last contract in the range keeps its real prices */\nfunction join(parts,rolls){\n  const n=parts.reduce((a,x)=>a+x.n,0),B={n,t:new Int32Array(n),o:new Int32Array(n),h:new Int32Array(n),l:new Int32Array(n),c:new Int32Array(n)};\n  let k=0;for(const x of parts){B.t.set(x.t,k);B.o.set(x.o,k);B.h.set(x.h,k);B.l.set(x.l,k);B.c.set(x.c,k);k+=x.n;}\n  if(!n){B.adj=new Int32Array(0);return B;}\n  const t0=B.t[0],t1=B.t[n-1],rs=rolls.filter(r=>r.t>t0&&r.t<=t1).sort((a,b)=>b.t-a.t);\n  let off=0,j=0;B.adj=new Int32Array(n);\n  for(let i=n-1;i>=0;i--){while(j<rs.length&&B.t[i]<rs[j].t){off+=rs[j].d;j++;}if(off){B.o[i]+=off;B.h[i]+=off;B.l[i]+=off;B.c[i]+=off;B.adj[i]=off;}}\n  B.rolls=rs.length;return B;}\n\n/* ---------- shared bookkeeping ---------- */\nconst DAY=1440;\nfunction Book(bal0,ruin){\n  const b={bal0,floor:bal0*(1-ruin),peak:bal0,mdd:0,mddAt:0,ruinAt:-1,wipeAt:-1,dead:false,days:[],curDay:-1,dMin:Infinity,dEq:bal0,dPx:0,dPa:0,years:new Map(),months:[],mo:null};\n  b.mark=(eq,t)=>{if(eq>b.peak)b.peak=eq;const d=1-eq/b.peak;if(d>b.mdd){b.mdd=d;b.mddAt=t;}if(eq<b.dMin)b.dMin=eq;\n    const y=b.yr(t);if(eq<y.min)y.min=eq;if(eq>y.peak)y.peak=eq;const yd=1-eq/y.peak;if(yd>y.mdd)y.mdd=yd;\n    if(b.ruinAt<0&&eq<=b.floor)b.ruinAt=t;if(eq<=0&&!b.dead){b.dead=true;b.wipeAt=t;}};\n  let ys=1,ye=0,yc=null;\n  b.yr=t=>{if(t>=ys&&t<ye)return yc;const Y=new Date(t*60000).getUTCFullYear();ys=Date.UTC(Y,0,1)/60000;ye=Date.UTC(Y+1,0,1)/60000;\n    let y=b.years.get(Y);if(!y){y={y:Y,start:b.dEq,end:b.dEq,min:Infinity,peak:b.dEq,mdd:0,n:0,w:0};b.years.set(Y,y);}yc=y;return y;};\n  b.closeDay=()=>{b.days.push([b.curDay*DAY,b.dEq,Math.min(b.dMin,b.dEq),b.dPx]);\n    const k=new Date(b.curDay*DAY*60000).toISOString().slice(0,7);let m=b.mo;\n    if(!m||m.k!==k){if(m)b.months.push(m);m=b.mo={k,eq0:m?m.eq1:bal0,pa0:m?m.pa1:b.pa0,path:0,last:m?m.pa1:b.pa0,eq1:0,pa1:0};}\n    m.path+=Math.abs(b.dPa-m.last);m.last=b.dPa;m.eq1=b.dEq;m.pa1=b.dPa;};\n  b.day=(t,eq,px,pa)=>{const d=Math.floor(t/DAY);if(d!==b.curDay){if(b.curDay>=0)b.closeDay();b.curDay=d;b.dMin=Infinity;}b.dEq=eq;b.dPx=px;b.dPa=pa;b.yr(t).end=eq;};\n  b.finish=()=>{if(b.curDay>=0){b.closeDay();b.months.push(b.mo);}\n    const D=b.days,mx=1200;if(D.length>mx){const g=Math.ceil(D.length/mx),o=[];for(let i=0;i<D.length;i+=g){const s=D.slice(i,i+g);o.push([s[0][0],s[s.length-1][1],amin(s.map(x=>x[2])),s[s.length-1][3]]);}b.days=o;}};\n  return b;}\nfunction bars(B){let days=0,last=-1;for(let i=0;i<B.n;i++){const d=Math.floor(B.t[i]/DAY);if(d!==last){days++;last=d;}}return days;}\nfunction avgRange(B){let s=0,k=0,last=-1,hi=-Infinity,lo=Infinity;for(let i=0;i<B.n;i++){const d=Math.floor(B.t[i]/DAY);if(d!==last){if(last>=0){s+=hi-lo;k++;}last=d;hi=-Infinity;lo=Infinity;}if(B.h[i]>hi)hi=B.h[i];if(B.l[i]<lo)lo=B.l[i];}if(last>=0){s+=hi-lo;k++;}return k?s/k:0;}\n\n/* ---------- grid / martingale / no hard stop ---------- */\nfunction runGrid(B,P){\n  const M=P.maxN,pv=P.pv,lots=[];for(let k=0;k<M;k++)lots.push(P.lot0*Math.pow(P.mult,k));\n  const bk=Book(P.bal0,P.ruin);bk.pa0=B.n?B.o[0]:0;\n  let bal=P.bal0,open=false,s=1,n=0,Lt=0,S=0,A=0,y0=0,yLast=0,lf=1,cyc=0,cStart=0,cMae=0,cCost=0;\n  const st={cycles:0,wins:0,sumW:0,sumL:0,worst:0,worstAt:0,maeMax:0,maeAt:0,stops:0,longest:0,longestAt:0,reach:new Array(M).fill(0),worstList:[],cycR:0,cycW:0,dur:[],maeV:[],maeT:[],gapN:0,gapSum:0,gapWorst:0,gapWorstAt:0};let cMaeAt=0;\n  const fl=y=>open?Lt*(y-A)*pv:0;\n  function openCycle(price,t){s=P.dir==='sell'?-1:P.dir==='alt'?(cyc%2?-1:1):1;lf=P.scale?Math.max(bal,0)/P.bal0:1;y0=s*price;n=0;Lt=0;S=0;A=0;cCost=0;cMae=0;cStart=t;cyc++;open=true;fill(y0);}\n  function fill(y){const lot=lots[n]*lf,cost=lot*P.cpl;Lt+=lot;S+=lot*y;A=S/Lt;yLast=y;n++;bal-=cost;cCost+=cost;}\n  function close(y,t,kind){const g=Lt*(y-A)*pv;bal+=g;open=false;const net=g-cCost,yr=bk.yr(t);\n    st.cycles++;yr.n++;st.reach[n-1]++;if(net>0){st.wins++;st.sumW+=net;yr.w++;}else st.sumL+=net;if(kind==='stop')st.stops++;\n    if(cMae>=P.bal0*P.ruin)st.cycR++;if(cMae>=P.bal0)st.cycW++;if(st.dur.length<200000){st.dur.push(t-cStart);if(cMae>0){st.maeV.push(cMae);st.maeT.push(cMaeAt);}}\n    if(net<st.worst){st.worst=net;st.worstAt=t;}const dur=t-cStart;if(dur>st.longest){st.longest=dur;st.longestAt=cStart;}\n    if(cMae>0){const L=st.worstList;if(L.length<5||cMae>L[L.length-1].mae){L.push({start:cStart,end:t,mae:cMae,net,orders:n,side:s});L.sort((a,b)=>b.mae-a.mae);if(L.length>5)L.pop();}}\n    bk.mark(bal,t);}\n  function mark(y,t){const f=fl(y);if(-f>cMae){cMae=-f;cMaeAt=t;}if(-f>st.maeMax){st.maeMax=-f;st.maeAt=t;}bk.mark(bal+f,t);}\n  function move(p1,p2,gap,t){\n    let p=p1;\n    for(let guard=0;guard<100000;guard++){\n      if(bk.dead)return;if(!open)openCycle(p,t);\n      const y=s*p,yE=s*p2,lv=n<M?y0-n*P.step:-Infinity,sp=(n===M&&P.sl>0)?yLast-P.sl:-Infinity;\n      if(yE<y||(yE===y&&Math.max(lv,sp)>=yE&&gap)){const ev=Math.max(lv,sp);\n        if(ev<yE){mark(yE,t);return;}\n        const at=gap?yE:ev;mark(at,t);if(bk.dead)return;\n        if(sp>=lv){close(at,t,'stop');p=s===1?at:-at;if(gap)p=p2;continue;}\n        fill(at);p=s===1?at:-at;continue;}\n      if(yE>y){const T=A+P.tp;if(yE<T){mark(yE,t);return;}const at=gap?yE:T;const ps=s;close(at,t,'tp');p=ps===1?at:-at;if(gap)p=p2;continue;}\n      return;}}\n  for(let i=0;i<B.n;i++){\n    const t=B.t[i],o=B.o[i],h=B.h[i],l=B.l[i],c=B.c[i];\n    if(i===0)openCycle(o,t);else if(t-B.t[i-1]>=1440&&open){const e0=bal+fl(s*B.c[i-1]);move(B.c[i-1],o,true,t);const d=(bk.dead?0:bal+fl(s*o))-e0;st.gapN++;st.gapSum+=d;if(d<st.gapWorst){st.gapWorst=d;st.gapWorstAt=t;}}else move(B.c[i-1],o,true,t);\n    if(c>=o){move(o,l,false,t);move(l,h,false,t);move(h,c,false,t);}else{move(o,h,false,t);move(h,l,false,t);move(l,c,false,t);}\n    bk.day(t,bk.dead?0:bal+fl(s*c),c-B.adj[i],c);if(bk.dead){break;}}\n  const lastC=B.n?B.c[B.n-1]:0,floatEnd=bk.dead?0:fl(s*lastC),final=bk.dead?0:bal+floatEnd;\n  if(open&&cMae>0){if(cMae>=P.bal0*P.ruin)st.cycR++;if(cMae>=P.bal0)st.cycW++;st.maeV.push(cMae);st.maeT.push(cMaeAt);const L=st.worstList;L.push({start:cStart,end:bk.dead?bk.wipeAt:B.t[B.n-1],mae:cMae,net:null,state:bk.dead?'wiped':'open',orders:n,side:s});L.sort((a,b)=>b.mae-a.mae);if(L.length>5)L.pop();}\n  bk.finish();\n  return{kind:'grid',final,floatEnd,openOrders:open&&!bk.dead?n:0,book:pack(bk),st};}\n\n/* ---------- fixed stop with random entries ---------- */\nfunction runFixed(B,P){\n  const SL=P.sl,TP=P.sl*P.rr,cR=P.costR,rnd=mulberry32(P.seed||7),days=bars(B),q=Math.min(0.5,P.tpd*days/Math.max(1,B.n));\n  const bk=Book(P.bal0,P.ruin);bk.pa0=B.n?B.o[0]:0;let eq=P.bal0,inT=false,s=1,e=0,stopY=0,tgtY=0,rm=0,ls=0,ent=0;\n  const st={trades:0,wins:0,sumR:0,worstR:0,worstAt:0,gaps:0,R:[],runs:[],run:0,maxRun:0,gapN:0,gapSum:0,gapWorst:0,gapWorstAt:0};\n  const fixedBase=P.bal0;\n  function enter(px,t){s=rnd()<0.5?1:-1;e=s*px;stopY=e-SL;tgtY=e+TP;const rk=P.dAfter&&ls>=P.dAfter?P.risk*(1-P.dCut):P.risk;rm=(P.fixed?fixedBase:eq)*rk;inT=true;ent=t;}\n  function exit(y,t){const R=(y-e)/SL-cR;eq+=rm*R;inT=false;st.trades++;st.sumR+=R;if(R>0){st.wins++;ls=0;if(st.run){st.runs[st.run]=(st.runs[st.run]||0)+1;st.run=0;}}else{ls++;st.run++;if(st.run>st.maxRun)st.maxRun=st.run;}if(R<st.worstR){st.worstR=R;st.worstAt=t;}if(R<-1-cR-1e-9)st.gaps++;\n    const yr=bk.yr(t);yr.n++;if(R>0)yr.w++;if(st.R.length<20000)st.R.push(R);if(eq<0)eq=0;bk.mark(eq,t);}\n  function move(p1,p2,gap,t){if(!inT||bk.dead)return;const yE=s*p2;\n    if(yE<=stopY){exit(gap?yE:stopY,t);return;}if(yE>=tgtY){exit(gap?yE:tgtY,t);return;}bk.mark(eq+rm*(yE-e)/SL,t);}\n  for(let i=0;i<B.n;i++){\n    const t=B.t[i],o=B.o[i],h=B.h[i],l=B.l[i],c=B.c[i];\n    if(i>0){if(t-B.t[i-1]>=1440&&inT){const e0=eq+rm*(s*B.c[i-1]-e)/SL;move(B.c[i-1],o,true,t);const d=(inT?eq+rm*(s*o-e)/SL:eq)-e0;st.gapN++;st.gapSum+=d;if(d<st.gapWorst){st.gapWorst=d;st.gapWorstAt=t;}}else move(B.c[i-1],o,true,t);}\n    if(!inT&&!bk.dead&&rnd()<q)enter(o,t);\n    if(c>=o){move(o,l,false,t);move(l,h,false,t);move(h,c,false,t);}else{move(o,h,false,t);move(h,l,false,t);move(l,c,false,t);}\n    const f=inT?rm*(s*c-e)/SL:0;bk.day(t,eq+f,c-B.adj[i],c);if(bk.dead)break;}\n  if(st.run)st.runs[st.run]=(st.runs[st.run]||0)+1;\n  bk.finish();\n  if(P.noSample)return{kind:'fixed',final:bk.dead?0:eq,book:{ruinAt:bk.ruinAt,wipeAt:bk.wipeAt,mdd:bk.mdd}};\n  /* independent random entries across the whole range: the no-skill baseline for this stop and target */\n  const K=Math.min(4000,Math.max(200,Math.floor(B.n/20))),rs=mulberry32((P.seed||7)+101),smp=[],dur=[],hrN=new Array(24).fill(0),hrW=new Array(24).fill(0);let hit=0,gapL=0,sumLoss=0,nLoss=0;\n  for(let k=0;k<K;k++){const i0=Math.floor(rs()*(B.n-1)),sd=rs()<0.5?1:-1,en=sd*B.o[i0],sY=en-SL,tY=en+TP,lim=B.t[i0]+30*DAY;let R=null,tEnd=0;\n    for(let i=i0;i<B.n&&B.t[i]<=lim;i++){const pts=i===i0?[]:[B.o[i]];const o=B.o[i],h=B.h[i],l=B.l[i],c=B.c[i];if(c>=o)pts.push(l,h,c);else pts.push(h,l,c);\n      for(let j=0;j<pts.length;j++){const y=sd*pts[j],g=(i>i0&&j===0);if(y<=sY){R=((g?y:sY)-en)/SL;break;}if(y>=tY){R=((g?y:tY)-en)/SL;break;}}\n      if(R!==null){tEnd=B.t[i];break;}}\n    if(R===null)continue;R-=cR;smp.push(R);dur.push(tEnd-B.t[i0]);if(R>0)hit++;else{sumLoss+=R;nLoss++;}if(R<-1-cR-1e-9)gapL++;const hr=Math.floor(B.t[i0]/60)%24;hrN[hr]++;if(R>0)hrW[hr]++;}\n  return{kind:'fixed',final:bk.dead?0:eq,book:pack(bk),st:{trades:st.trades,wins:st.wins,sumR:st.sumR,worstR:st.worstR,worstAt:st.worstAt,gaps:st.gaps,runs:Array.from(st.runs,x=>x||0),maxRun:st.maxRun,gapN:st.gapN,gapSum:st.gapSum,gapWorst:st.gapWorst,gapWorstAt:st.gapWorstAt},\n    sample:{n:smp.length,wins:hit,meanR:smp.reduce((a,x)=>a+x,0)/Math.max(1,smp.length),worstR:amin(0,smp),gapLoss:gapL,medMin:dur.sort((a,b)=>a-b)[Math.floor(dur.length/2)]||0,q,hrN,hrW,avgLoss:nLoss?sumLoss/nLoss:0}};}\nfunction yearAdr(B){const Y=new Map();let last=-1,hi=-Infinity,lo=Infinity,yr=0;const push=()=>{if(last<0)return;let y=Y.get(yr);if(!y){y={y:yr,s:0,n:0};Y.set(yr,y);}y.s+=hi-lo;y.n++;};\n  for(let i=0;i<B.n;i++){const d=Math.floor(B.t[i]/DAY);if(d!==last){push();last=d;hi=-Infinity;lo=Infinity;yr=new Date(d*DAY*60000).getUTCFullYear();}if(B.h[i]>hi)hi=B.h[i];if(B.l[i]<lo)lo=B.l[i];}push();\n  return[...Y.values()].map(y=>({y:y.y,adr:y.s/y.n,days:y.n}));}\nfunction sub(B,a,b){return{n:b-a,t:B.t.subarray(a,b),o:B.o.subarray(a,b),h:B.h.subarray(a,b),l:B.l.subarray(a,b),c:B.c.subarray(a,b),adj:B.adj.subarray(a,b)};}\n/* the same rules started at the beginning of different months, each run for the same length */\nfunction startRuns(B,P,progress){\n  const firsts=[];let last='',ld=-1;for(let i=0;i<B.n;i++){const d=Math.floor(B.t[i]/DAY);if(d===ld)continue;ld=d;const k=new Date(d*DAY*60000).toISOString().slice(0,7);if(k!==last){firsts.push({k,i});last=k;}}\n  const nm=firsts.length;if(nm<3)return null;const W=nm<=24?Math.max(1,Math.floor(nm/2)):12,cand=firsts.slice(0,nm-W+1);\n  const pick=cand.length<=36?cand:Array.from({length:36},(_,j)=>cand[Math.round(j*(cand.length-1)/35)]);\n  const out=[];pick.forEach((f,j)=>{const endIdx=f.k===firsts[nm-1].k?B.n:(firsts[firsts.indexOf(f)+W]||{i:B.n}).i,S=sub(B,f.i,endIdx);\n    const r=P.kind==='fixed'?runFixed(S,Object.assign({},P,{noSample:true})):runGrid(S,P);\n    out.push({k:f.k,ret:r.final/P.bal0-1,ruin:r.book.ruinAt>0,wipe:r.book.wipeAt>0,wipeAt:r.book.wipeAt,mdd:Math.min(1,r.book.mdd)});if(progress)progress(j+1,pick.length);});\n  return{W,runs:out};}\nfunction slim(r){if(r.kind!=='grid')return r;const st=r.st,v=st.maeV,tt=st.maeT,ix=v.map((x,i)=>i).sort((a,b)=>v[b]-v[a]),top=ix.slice(0,Math.max(10,Math.min(300,Math.ceil(ix.length*0.1))));\n  const hr=new Array(24).fill(0),dw=new Array(7).fill(0);top.forEach(i=>{const d=new Date(tt[i]*60000);hr[d.getUTCHours()]++;dw[d.getUTCDay()]++;});\n  const du=st.dur.slice().sort((a,b)=>a-b);st.durMed=du.length?du[Math.floor(du.length/2)]:0;st.troubleN=top.length;st.troubleHr=hr;st.troubleDw=dw;delete st.maeV;delete st.maeT;delete st.dur;return r;}\nfunction pack(b){return{months:b.months.map(m=>({m:m.k,eq0:m.eq0,eq1:m.eq1,move:m.pa1-m.pa0,path:m.path})),days:b.days,mdd:b.mdd,mddAt:b.mddAt,ruinAt:b.ruinAt,wipeAt:b.wipeAt,dead:b.dead,peak:b.peak,years:[...b.years.values()].sort((a,c)=>a.y-c.y)};}\n\nconst API={decode,join,runGrid,runFixed,avgRange,bars,yearAdr,startRuns,slim,sub};\nif(typeof self!=='undefined'&&typeof window==='undefined'&&typeof importScripts==='function'){\n  self.onmessage=async ev=>{const m=ev.data;\n    try{const parts=[];let done=0;\n      const list=m.months,conc=6;let next=0;const res=new Array(list.length);\n      await Promise.all(Array.from({length:Math.min(conc,list.length)},async()=>{while(next<list.length){const i=next++;res[i]=await getMonth(m.bases||[m.base],list[i],m.counts&&m.counts[list[i]]);done++;self.postMessage({type:'progress',done,total:list.length});}}));\n      for(const r of res)parts.push(r);\n      self.postMessage({type:'progress',done:list.length,total:list.length,stage:'run'});\n      const B=join(parts,m.rolls),P=m.params;\n      const out=slim(P.kind==='fixed'?runFixed(B,P):runGrid(B,P));\n      out.yAdr=yearAdr(B);\n      self.postMessage({type:'progress',stage:'starts',done:0,total:1});\n      out.starts=startRuns(B,P,(d,n)=>{if(d%4===0||d===n)self.postMessage({type:'progress',stage:'starts',done:d,total:n});});\n      out.n=B.n;out.from=B.n?B.t[0]:0;out.to=B.n?B.t[B.n-1]:0;out.rolls=B.rolls||0;out.adr=avgRange(B);out.days=bars(B);\n      out.px0=B.n?B.o[0]:0;out.px1=B.n?B.c[B.n-1]:0;\n      self.postMessage({type:'done',out,id:m.id});\n    }catch(e){self.postMessage({type:'error',kind:e&&e.kind||'other',month:e&&e.month||'',code:e&&e.code||0,msg:String(e&&e.message||e),id:m.id});}};}\nif(typeof module!=='undefined')module.exports=API;\n";
/* ---------- Desk (expert) ---------- */
const DESK=(function(){
'use strict';
const D={parsed:null,fileName:'',symbol:'',sl:0,risk:1,ruin:50,hor:200,sims:10000,explain:true,net:'net',layout:'full',reached:1,res:null,err:null,
  wr:45,rr:1.5,n:40,tpd:2,sizing:'comp',dAfter:0,dCut:50,bal:10000,spread:0,comm:0,pv:0,model:null,histMsg:()=>'',fileId:0,
  stype:'fixed',gLot:0.01,gStep:20,gMult:1.5,gMax:8,gTp:15,gSl:0,gVol:80,gAuto:'fixed',gMkt:'real',gm:null};
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
    if(!p.ok){D.parsed=null;D.fileId++;D.res=null;showErr(t('err_'+p.error));$('symwrap').hidden=true;analyze();return;}
    D.parsed=p;D.fileId++;D.fileName=file.name;showErr(null);
    const syms=Object.keys(p.symbols).sort((a,b)=>p.symbols[b]-p.symbols[a]);D.symbol=syms[0];
    const sel=$('symsel');sel.innerHTML=syms.map(s=>`<option value="${esc(s)}">${esc(s)} (${p.symbols[s]})</option>`).join('');sel.value=D.symbol;
    $('symwrap').hidden=syms.length<2;if(!(D.pv>0)){const v=SFX.toR(p.trades.filter(x=>x.symbol===D.symbol),1,true).vpp;if(isFinite(v)&&v>0){D.pv=+v.toPrecision(4);$('d-pv').value=D.pv;}}autoFill();statusLine();hint();analyze();},30);
  fr.onerror=()=>showErr(t('err_read'));fr.readAsText(file);}
function autoFill(){
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
function curTrades(){return D.parsed?D.parsed.trades.filter(x=>x.symbol===D.symbol):[];}
function statusLine(){
  if(!D.parsed)return;const tr=curTrades(),p=D.parsed;
  $('file-status').innerHTML=`<div class="small">${esc(t('file_ok',{n:tr.length,sym:D.symbol,from:dstr(tr[0].open),to:dstr(tr[tr.length-1].close),skipped:p.skipped}))}</div>`+
    (Object.keys(p.symbols).length>1?`<div class="small muted">${esc(t('file_multi',{k:Object.keys(p.symbols).length}))}</div>`:'')+
    (D.filled?`<div class="warnnote" style="margin:.5rem 0">${esc(t('file_applied',{sl:D.filled.sl,n:D.filled.n,wr:D.filled.wr===undefined?'\u2013':D.filled.wr,rr:D.filled.rr===undefined?'\u2013':D.filled.rr,risk:D.filled.risk===undefined?'\u2013':D.filled.risk,tpd:D.filled.tpd===undefined?'\u2013':D.filled.tpd,bal:D.filled.bal===undefined?'\u2013':D.filled.bal}))}</div>`:'');}
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
const SIGG=['stype','gLot','gStep','gMult','gMax','gTp','gSl','gVol','gAuto','gMkt','bal','spread','comm','pv','hor','ruin'];
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
function gParams(){const ns=D.stype==='nostop',pv=D.pv>0?D.pv:10;return{ns,pv,pvSet:D.pv>0,M:ns?1:D.gMax,mult:ns?1:D.gMult,step:ns?0:D.gStep,cpl:(D.spread>0?D.spread*pv:0)+(D.comm>0?D.comm:0)};}
function gLadder(G){
  const L=[];let Lt=0,S=0,cost=0;
  for(let k=0;k<G.M;k++){const lot=D.gLot*Math.pow(G.mult,k),d=k*G.step;Lt+=lot;S+=lot*d;cost+=lot*G.cpl;const a=S/Lt;L.push({k:k+1,lot,Lt,d,a,cost,loss:Lt*(d-a)*G.pv+cost});}
  const lossAt=d=>{let i=0;while(i+1<L.length&&L[i+1].d<=d)i++;const r=L[i];return r.Lt*(d-r.a)*G.pv+r.cost;};
  const distTo=target=>{for(let i=0;i<L.length;i++){const r=L[i],end=i+1<L.length?L[i+1].d:Infinity,d=r.a+(target-r.cost)/(r.Lt*G.pv);if(d>=r.d&&d<end)return Math.max(0,d);if(d<r.d&&r.loss>=target)return r.d;}return Infinity;};
  const last=L[L.length-1],stopD=D.gSl>0?last.d+D.gSl:null,stopLoss=stopD!==null?lossAt(stopD):null;
  return{L,lossAt,wipeD:distTo(D.bal),ruinD:distTo(D.bal*D.ruin/100),stopD,stopLoss,last};}
function computeGrid(){
  const G=gParams(),lad=gLadder(G),sigD=D.gVol/1.596,mk=k=>({lot0:D.gLot*k,step:G.step,mult:G.mult,maxN:G.M,tp:D.gTp,sl:D.gSl,sigD,fat:D.gMkt==='real',cpl:G.cpl,pv:G.pv,lossCap:D.bal*40,N:4000,capDays:120,seed:31});
  const pool=SFX.gridPool(mk(1)),po={B0:D.bal,H:D.hor,ruin:D.ruin/100,scale:D.gAuto==='scale'};
  const sim=SFX.gridPaths(pool,Object.assign({sims:2000,seed:41,keep:50,bands:true},po));
  const pn=Array.from(pool.pnl),N=pn.length,w=pn.filter(x=>x>0),l=pn.filter(x=>x<=0),sum=a=>a.reduce((x,y)=>x+y,0);
  const E=sum(pn)/N,se=SFX.sd(pn)/Math.sqrt(N),avgW=w.length?sum(w)/w.length:0,avgL=l.length?sum(l)/l.length:0,worst=amin(pn);
  const mae=Array.from(pool.mae),pWipe1=mae.filter(x=>x>=D.bal).length/N,pRuin1=mae.filter(x=>x>=D.bal*D.ruin/100).length/N;
  const days=Array.from(pool.days).sort((a,b)=>a-b),dMean=SFX.mean(days),kinds=[0,1,2,3].map(k=>Array.from(pool.kind).filter(x=>x===k).length/N);
  const reach=[];for(let k=1;k<=G.M;k++)reach.push(Array.from(pool.lev).filter(x=>x>=k).length/N);
  const ks=[0.1,0.2,0.3,0.5,0.75,1,1.5,2,3],sweep=ks.map(k=>{const r=k===1?sim:SFX.gridPaths(pool,Object.assign({sims:800,seed:43,k},po));return{k,lot:D.gLot*k,ruin:r.ruinProb,wipe:r.wipeProb};});
  let safe=null;sweep.forEach(x=>{if(x.ruin<=0.05&&(safe===null||x.lot>safe))safe=x.lot;});
  const ruinP=sim.ruinProb,neg=E+2*se<0;let v;if(ruinP>=0.30)v='bad';else if(ruinP>0.05||neg||pWipe1>0.001)v='warn';else v='ok';
  D.gm={G,lad,pool,sim,N,E,se,avgW,avgL,worst,win:w.length/N,pWipe1,pRuin1,days,dMean,kinds,reach,sweep,safe,v,neg,sumW:sum(w),sumL:sum(l)};}
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
  return`<section class="dsec" data-step="1">${gHead('Summary')}
  <div class="card"><div class="dverdict"><span class="light" data-v="${g.v}" aria-hidden="true">${ICON[g.v]}</span><div><h2>${esc(t('gv_'+g.v))}</h2><p class="small" style="margin:0">${esc(line)}</p></div></div>
  <div class="gtile">${tiles.map(x=>`<div class="${x[0]}"><span>${esc(x[1])}</span><b>${esc(x[2])}</b></div>`).join('')}</div>
  ${notes.map(n=>`<p class="warnnote small" style="margin:.8rem 0 0">${esc(n)}</p>`).join('')}</div>
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
function drawGrid(){
  const g=D.gm;if(!g)return;EXPL=gExpl(g);
  $('d-main').innerHTML=gSummary(g)+gExposure(g)+gOutcomes(g)+gSurvival(g)+btSection();rowAlign();applyLayout();}

/* ---------- backtest on real gold (1-minute COMEX futures, loaded month by month in a worker) ---------- */
function btErrText(m){
  const mo=m.month?dfmtM(m.month):'';
  if(m.kind==='http'&&m.code===429)return t('bt_err_busy');
  if(m.kind==='http')return t('bt_err_http',{code:m.code,m:mo});
  if(m.kind==='bad')return t('bt_err_bad',{m:mo});
  if(m.kind==='net')return t('bt_err_net');
  return t('bt_err',{msg:m.msg});}
const dfmtM=k=>{const d=new Date(Date.UTC(+k.slice(0,4),+k.slice(5,7)-1,1));return d.toLocaleDateString(LANG==='th'?'th-TH-u-ca-gregory':'en-GB',{month:'short',year:'numeric',timeZone:'UTC'});};
const BT={idx:null,idxErr:null,from:null,to:null,dir:'buy',res:null,sig:null,kind:null,busy:false,prog:'',err:null,worker:null,id:0};
const btBase=()=>new URL('data/gold/',location.href).href;
/* month files never change, so on the live site they come from jsDelivr pinned to a commit (cached forever, no GitHub Pages bandwidth); this site is the fallback */
const BT_REPO='0xtrvkc/Jarn-Neow';
const btBases=()=>{const own=btBase(),tag=BT.idx&&(BT.idx.cdnRef||BT.idx.cdnTag);return tag&&location.protocol==='https:'?['https://cdn.jsdelivr.net/gh/'+BT_REPO+'@'+tag+'/data/gold/',own]:[own];};
const btFile=()=>location.protocol==='file:';
const btCan=()=>typeof DecompressionStream!=='undefined'&&typeof Worker!=='undefined';
const ymOf=min=>new Date(min*60000).toISOString().slice(0,7);
const dfmt=min=>new Date(min*60000).toISOString().slice(0,10);
function btIndex(){
  if(BT.idx||BT.idxErr||btFile())return;
  fetch(btBase()+'index.json').then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.json();}).then(j=>{BT.idx=j;const ms=j.months.map(x=>x.m);BT.to=ms[ms.length-1];BT.from=ms[Math.max(0,ms.length-12)];btRedraw();})
    .catch(e=>{BT.idxErr=String(e.message||e);btRedraw();});}
function btSig(){return D.stype==='fixed'?'f'+sigOf(SIGF)+BT.from+BT.to:'g'+sigOf(SIGG)+BT.from+BT.to+BT.dir;}
function btParams(){
  if(D.stype==='fixed')return{kind:'fixed',sl:D.sl,rr:D.rr,costR:costR(),risk:D.risk/100,fixed:D.sizing==='fixed',dAfter:D.dAfter,dCut:D.dCut/100,bal0:D.bal,ruin:D.ruin/100,tpd:D.tpd,seed:7};
  const G=gParams();return{kind:'grid',lot0:D.gLot,mult:G.mult,maxN:G.M,step:G.step,tp:D.gTp,sl:D.gSl,pv:G.pv,cpl:G.cpl,bal0:D.bal,scale:D.gAuto==='scale',ruin:D.ruin/100,dir:BT.dir};}
function btRun(){
  if(BT.busy||!BT.idx)return;if(D.stype==='fixed'&&!(D.sl>0))return;
  const ms=BT.idx.months.map(x=>x.m).filter(m=>m>=BT.from&&m<=BT.to);if(!ms.length){BT.err=t('bt_range_bad');btRedraw();return;}
  if(!BT.worker){BT.worker=new Worker(URL.createObjectURL(new Blob([BTW_SRC],{type:'text/javascript'})));
    BT.worker.onmessage=e=>{const m=e.data;if(m.id!==undefined&&m.id!==BT.id)return;
      if(m.type==='progress'){BT.prog=m.stage==='run'?t('bt_running'):m.stage==='starts'?t('bt_starts',{done:m.done,total:m.total}):t('bt_load',{done:m.done,total:m.total});const el=$('bt-status');if(el)el.textContent=BT.prog;return;}
      BT.busy=false;if(m.type==='error'){BT.err=btErrText(m);}else{BT.res=m.out;BT.err=null;}btRedraw();};}
  BT.busy=true;BT.err=null;BT.res=null;BT.prog=t('bt_load',{done:0,total:ms.length});BT.sig=btSig();BT.kind=D.stype;BT.id++;
  const counts={};BT.idx.months.forEach(x=>{counts[x.m]=x.n;});BT.worker.postMessage({id:BT.id,bases:btBases(),months:ms,counts,rolls:BT.idx.rolls,params:btParams()});btRedraw();}
function btRedraw(){const el=$('bt-sec');if(!el)return;const tpl=document.createElement('template');tpl.innerHTML=btSection();el.replaceWith(tpl.content.firstElementChild);rowAlign();}
function btControls(){
  const ms=BT.idx?BT.idx.months.map(x=>x.m):[],a=ms[0],b=ms[ms.length-1],g=D.stype!=='fixed';
  const sel=(id,v,opts)=>`<select class="txt" data-bt="${id}">${opts.map(o=>`<option value="${o[0]}"${o[0]===v?' selected':''}>${esc(o[1])}</option>`).join('')}</select>`;
  const pre=[['12',t('bt_p12')],['60',t('bt_p5')],['all',t('bt_pall')]];
  return`<div class="btctl">
    <label><span>${esc(t('bt_from'))}</span><input type="month" class="txt" data-bt="from" min="${a}" max="${b}" value="${BT.from}"></label>
    <label><span>${esc(t('bt_to'))}</span><input type="month" class="txt" data-bt="to" min="${a}" max="${b}" value="${BT.to}"></label>
    ${g?`<label><span>${esc(t('bt_dir'))}</span>${sel('dir',BT.dir,[['buy',t('bt_dir_buy')],['sell',t('bt_dir_sell')],['alt',t('bt_dir_alt')]])}</label>`:''}
    <div class="btpre">${pre.map(p=>`<button type="button" class="btn alt" data-bt-pre="${p[0]}">${esc(p[1])}</button>`).join('')}</div>
    <button type="button" class="btn" data-bt-run="1"${BT.busy?' disabled':''}>${esc(t(BT.res&&BT.sig!==btSig()?'bt_rerun':'bt_run'))}</button>
    <span class="small muted" id="bt-status" aria-live="polite">${BT.busy?esc(BT.prog):''}</span></div>`;}
function btSection(){
  const g=D.stype!=='fixed',I=BT.idx;let body='';
  const head=`<h2>${D.stype==='fixed'?'Your stop and target on real gold':'Test on real gold'}<small>${esc(I?t('bt_src',{a:dfmt(I.from),b:dfmt(I.to)}):t('bt_src0'))}</small></h2>`;
  if(btFile())body=`<div class="card"><p class="warnnote" style="margin:0">${esc(t('bt_file'))}</p></div>`;
  else if(!btCan())body=`<div class="card"><p class="warnnote" style="margin:0">${esc(t('bt_nodecomp'))}</p></div>`;
  else if(BT.idxErr)body=`<div class="card"><p class="errnote" style="margin:0">${esc(t('bt_err',{msg:BT.idxErr}))}</p></div>`;
  else if(!I){btIndex();body=`<div class="card"><p class="small muted" style="margin:0">${esc(t('bt_idx'))}</p></div>`;}
  else{
    const need=D.stype==='fixed'&&!(D.sl>0);
    body=`<div class="card">${btAvail()}<p class="bt-lead">${esc(t(D.stype==='fixed'?'bt_lead_f':'bt_lead_g'))}</p><p class="small" style="margin:0 0 .4rem">${esc(t('bt_intro'))}</p><p class="small muted" style="margin:0 0 .8rem">${esc(t(D.stype==='fixed'?'bt_uses_fixed':D.stype==='grid'?'bt_uses_grid':'bt_uses_ns'))}</p>
      ${need?`<p class="warnnote" style="margin:0">${esc(t('bt_need_sl'))}</p>`:btControls()}
      ${BT.err?`<p class="errnote" style="margin:.7rem 0 0">${esc(BT.err)}</p>`:''}
      ${BT.res&&BT.kind===D.stype&&BT.sig!==btSig()&&!BT.busy?`<p class="warnnote" style="margin:.7rem 0 0">${esc(t('bt_stale'))}</p>`:''}</div>`;
    if(BT.res&&BT.kind===D.stype)body+=BT.res.kind==='fixed'?btFixed(BT.res):btGrid(BT.res);}
  return`<section class="dsec" data-step="0" id="bt-sec">${head}${body}</section>`;}
const xDate=v=>{const d=new Date(v*60000);return d.toISOString().slice(0,7);};
function btEquity(r){
  const d=r.book.days,b0=D.bal,cl=d.map(x=>[x[0],x[1]]),lo=d.map(x=>[x[0],Math.max(0,x[2])]),ymax=amax(b0*1.1,cl.map(x=>x[1]))*1.05;
  const vl=[];if(r.book.wipeAt>0)vl.push({x:r.book.wipeAt,color:'var(--bad)'});
  return CH.plot({w:860,h:260,m:{l:62,r:14},series:[{pts:lo,color:'var(--bad)',w:1,op:0.8},{pts:cl,color:'var(--accent)',w:2}],areas:[{upper:cl,lower:lo,color:'var(--bad)',op:0.12}],
    hlines:[{y:b0,color:'var(--muted)',label:t('bt_start')},{y:b0*(1-D.ruin/100),color:'var(--warn)',label:t('d_ruin_line',{x:D.ruin})}],vlines:vl,xlo:d[0][0],xhi:d[d.length-1][0],ylo:0,yhi:ymax,xfmt:xDate,yfmt:v=>cmpNum(v),ylabel:'equity',label:'Equity on real gold'});}
function btYears(r){return tbl(['Year','Start','End','Return','Deepest fall',r.kind==='fixed'?'Trades (won)':'Cycles (won)'],r.book.years.map(y=>[String(y.y),money(y.start),money(y.end),y.start>0?sgn((y.end/y.start-1)*100,1)+'%':'–','−'+pc(Math.min(1,y.mdd)),y.n+' ('+y.w+')']));}
function btOutcome(r){const b=r.book;return b.wipeAt>0?['bad',t('bt_out_wipe'),dfmt(b.wipeAt)]:b.ruinAt>0?['bad',t('bt_out_ruin',{x:D.ruin}),dfmt(b.ruinAt)]:['ok',t('bt_out_ok'),''];}
function btVerdict(r){const b=r.book,days=Math.round((b.wipeAt-r.from)/1440),dd='−'+pc(Math.min(1,b.mdd));
  return b.wipeAt>0?t('bt_v_wiped',{date:dfmt(b.wipeAt),days}):b.ruinAt>0?t('bt_v_ruin',{dd,date:dfmt(b.mddAt),x:D.ruin,rdate:dfmt(b.ruinAt)}):t('bt_v_ok',{dd,date:dfmt(b.mddAt)});}
function btGrid(r){
  const st=r.st,b=r.book,o=btOutcome(r),ret=D.bal>0?sgn((r.final/D.bal-1)*100,1)+'%':'–';
  const tiles=[['',t('bt_t_final'),money(r.final),ret],['bad',t('bt_t_dd'),'−'+pc(Math.min(1,b.mdd)),dfmt(b.mddAt)],['',t('bt_t_cyc'),st.cycles?pc(st.wins/st.cycles):'–',st.cycles.toLocaleString('en-US')+' cycles'],[o[0],t('bt_t_out'),o[1],o[2]]];
  const rows=[['Range',dfmt(r.from)+' → '+dfmt(r.to)],['1-minute bars',r.n.toLocaleString('en-US')],['Contract rolls removed',String(r.rolls)],['Gold average daily range',Math.round(r.adr).toLocaleString('en-US')+' pips'],
    ['Cycles completed (won)',st.cycles.toLocaleString('en-US')+' ('+st.wins.toLocaleString('en-US')+')'],['Average win / loss',(st.wins?money(st.sumW/st.wins):'–')+' / '+(st.cycles-st.wins?money(st.sumL/(st.cycles-st.wins)):'–')],
    ['Worst closed cycle',st.worst<0?money(st.worst)+' ('+dfmt(st.worstAt)+')':'–'],['Deepest floating loss',money(-st.maeMax)+' ('+dfmt(st.maeAt)+')'],['Cycles ending at the final stop',String(st.stops)],
    ['Longest cycle',(st.longest/1440).toFixed(1)+' days (from '+dfmt(st.longestAt)+')'],['Open at the end',r.openOrders?r.openOrders+' orders, floating '+money(r.floatEnd):'none']];
  const d=b.days,px=d.map(x=>[x[0],x[3]/10]),wl=st.worstList||[];
  const pc2=CH.plot({w:520,h:240,series:[{pts:px,color:'var(--c1)',w:1.6}],dots:wl.map(w=>{const k=d.findIndex(x=>x[0]>=Math.floor(w.start/1440)*1440);return{x:w.start,y:(k>=0?d[k][3]:d[d.length-1][3])/10,r:4,color:'var(--bad)',op:1};}),xlo:d[0][0],xhi:d[d.length-1][0],xfmt:xDate,yfmt:v=>'$'+cmpNum(v),ylabel:'gold',label:'Gold price over the backtest'});
  const wt=wl.length?tbl(['#','Started','Ended','Side','Orders','Deepest float','Result'],wl.map((w,i)=>[String(i+1),dfmt(w.start),w.state?'–':dfmt(w.end),w.side>0?'buy':'sell',String(w.orders),money(-w.mae),w.state==='wiped'?'<b>wiped out</b>':w.state==='open'?'still open':money(w.net)])):`<p class="small muted">–</p>`;
  const reach=G=>st.reach.map((x,i)=>({label:String(i+1),value:st.cycles?x/st.cycles*100:0,color:i===st.reach.length-1?'var(--bad)':'var(--c2)'}));
  return`<div class="card"><div class="dverdict"><span class="light" data-v="${o[0]==='ok'?'ok':'bad'}" aria-hidden="true">${ICON[o[0]==='ok'?'ok':'bad']}</span><div><h2>${esc(o[0]==='ok'?t('bt_out_ok'):o[1])}</h2><p class="small" style="margin:0">${esc(btVerdict(r)+' '+t('bt_v_grid',{cyc:st.cycles.toLocaleString('en-US'),win:st.wins.toLocaleString('en-US'),fin:money(r.final),ret}))}</p></div></div>
    <div class="gtile">${tiles.map(x=>`<div class="${x[0]}"><span>${esc(x[1])}</span><b>${esc(x[2])}</b>${x[3]?`<span>${esc(x[3])}</span>`:''}</div>`).join('')}</div>
    ${D.stype==='grid'&&r.adr>0?`<p class="small muted" style="margin:.7rem 0 0">${esc(t('bt_adr',{x:Math.round(r.adr).toLocaleString('en-US'),y:D.gVol,step:D.gStep}))}</p>`:''}</div>
  <div class="dgrid"><div class="s12">${card('Equity on real gold',ch(btEquity(r))+lg([['var(--accent)',t('lg_bt_close')],['var(--bad)',t('lg_bt_low')]])+note('bn_eq'))}</div>
  <div class="s5">${card('Backtest statistics',kv(rows)+note('bn_stats'))}</div>
  <div class="s7">${card('Gold price',ch(pc2)+lg([['var(--c1)',t('lg_bt_px')],['var(--bad)',t('lg_bt_worst')]])+note('bn_price'))}</div>
  <div class="s7">${card('Deepest cycles',wt+note('bn_worst'))}</div>
  <div class="s5">${card('Orders reached',D.stype==='grid'?ch(CH.bars({w:420,h:200,items:reach(),ymax:100,yfmt:v=>v+'%',valFmt:v=>v<1?(v<0.1?'<.1':v.toFixed(1)):Math.round(v)+'',xlabel:'order number',ylabel:'cycles reaching it',label:'Orders reached in the backtest'}))+note('gn_reach_bt'):kv([['Stops hit',String(st.stops)]])+note('gn_reach_bt'))}</div>
  <div class="s12">${card('By year',btYears(r)+note('bn_years'))}</div>
  ${btDeeper(r)}</div>`;}
function btFixed(r){
  const st=r.st,sm=r.sample,b=r.book,o=btOutcome(r),wr=sm.n?sm.wins/sm.n:0,ci=SFX.wilson(wr,sm.n),you=D.wr/100,c=costR(),be=(1+c)/(D.rr+1),ret=D.bal>0?sgn((r.final/D.bal-1)*100,1)+'%':'–';
  const cmp=you>ci[1]?'bt_fx_above':you>=ci[0]?'bt_fx_within':'bt_fx_below';
  const tiles=[['',t('bt_t_wr'),pc(wr),t('bt_t_wr_you',{x:pc(you,0)})],['',t('bt_t_exp'),rfmt(sm.meanR,3),t('bt_t_be',{x:pc(be)})],['',t('bt_t_final'),money(r.final),ret],[o[0],t('bt_t_out'),o[1],o[2]||'−'+pc(Math.min(1,b.mdd))]];
  const rows=[['Range',dfmt(r.from)+' → '+dfmt(r.to)],['1-minute bars',r.n.toLocaleString('en-US')],['Contract rolls removed',String(r.rolls)],['Gold average daily range',Math.round(r.adr).toLocaleString('en-US')+' pips'],
    ['Stop / target',D.sl+' / '+(+(D.sl*D.rr).toFixed(1))+' pips'],['Random entries sampled',sm.n.toLocaleString('en-US')],['Win rate [95% CI]',`<b>${pc(wr)}</b> [${pc(ci[0])}–${pc(ci[1])}]`],['Your stated win rate',pc(you,1)],['Break-even win rate (with costs)',pc(be)],
    ['Average result per trade',rfmt(sm.meanR,3)],['Worst loss',rfmt(sm.worstR,2)],['Losses beyond the stop (gaps)',sm.gapLoss+' of '+sm.n],['Median time in a trade',sm.medMin<120?Math.round(sm.medMin)+' min':(sm.medMin/60).toFixed(1)+' h']];
  const runRows=[['Trades taken (won)',st.trades.toLocaleString('en-US')+' ('+st.wins.toLocaleString('en-US')+')'],['Final balance',money(r.final)+' ('+ret+')'],['Deepest fall','−'+pc(Math.min(1,b.mdd))+' ('+dfmt(b.mddAt)+')'],['Worst single trade',rfmt(st.worstR,2)+(st.worstAt?' ('+dfmt(st.worstAt)+')':'')],['Gap losses beyond the stop',String(st.gaps)]];
  return`<div class="card"><div class="dverdict"><span class="light" data-v="${cmp==='bt_fx_above'?'warn':'bad'}" aria-hidden="true">${ICON[cmp==='bt_fx_above'?'warn':'bad']}</span><div><h2>${esc(t(cmp+'_t'))}</h2><p class="small" style="margin:0">${esc(t('bt_v_fixed',{wr:pc(wr),lo:pc(ci[0]),hi:pc(ci[1]),you:pc(you,0),be:pc(be)})+' '+t(cmp))}</p></div></div>
    <div class="gtile">${tiles.map(x=>`<div class="${x[0]}"><span>${esc(x[1])}</span><b>${esc(x[2])}</b>${x[3]?`<span>${esc(x[3])}</span>`:''}</div>`).join('')}</div></div>
  <div class="dgrid"><div class="s5">${card('No-skill win rate',kv(rows)+note('bn_rand'))}</div>
  <div class="s7">${card('Equity: one random-entry run',ch(btEquity(r))+lg([['var(--accent)',t('lg_bt_close')],['var(--bad)',t('lg_bt_low')]])+kv(runRows)+note('bn_eqf'))}</div>
  <div class="s12">${card('By year',btYears(r)+note('bn_years_f'))}</div>
  ${btDeeper(r)}</div>`;}
/* ---------- backtest: deeper analysis (only what real prices can show) ---------- */
const lday=min=>new Date(min*60000).toLocaleDateString(LANG==='th'?'th-TH-u-ca-gregory':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const lmon=ym=>new Date(ym+'-01T00:00:00Z').toLocaleDateString(LANG==='th'?'th-TH-u-ca-gregory':'en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
function btAvail(){
  const I=BT.idx,ms=I.months.map(x=>x.m),a=ms.indexOf(BT.from),b=ms.indexOf(BT.to),N=ms.length,W=1000,X=i=>8+i/N*(W-16);
  const y0=+ms[0].slice(0,4),y1=+ms[N-1].slice(0,4),yrs=((I.to-I.from)/525960).toFixed(1);let ticks='';
  for(let y=y0;y<=y1;y++){const i=ms.indexOf(y+'-01');if(i<0)continue;ticks+=`<line x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="16" y2="34" class="tk"/>`+((y-y0)%2===0||N<40?`<text x="${X(i).toFixed(1)}" y="50" text-anchor="middle">${y}</text>`:'');}
  const sel=a>=0&&b>=a?`<rect x="${X(a).toFixed(1)}" y="12" width="${Math.max(3,X(b+1)-X(a)).toFixed(1)}" height="26" rx="2" class="sel"/>`:'';
  return`<div class="btavail"><div class="btav-t"><b>${esc(t('bt_avail',{a:lday(I.from),b:lday(I.to)}))}</b><span>${esc(t('bt_avail2',{y:yrs,n:(I.bars/1e6).toFixed(1)}))}</span></div>
    <svg viewBox="0 0 ${W} 56" role="img" aria-label="${esc(t('bt_sel',{a:lmon(BT.from),b:lmon(BT.to),n:b-a+1}))}"><rect x="8" y="18" width="${W-16}" height="14" rx="2" class="all"/>${sel}${ticks}</svg>
    <p class="btav-s">${esc(t('bt_sel',{a:lmon(BT.from),b:lmon(BT.to),n:b-a+1}))}</p></div>`;}
const hourOff=()=>Math.round(-new Date().getTimezoneOffset()/60);
const tzLab=()=>{const o=hourOff();return'UTC'+(o>=0?'+':'−')+Math.abs(o);};
const rot=a=>{const o=hourOff();return a.map((_,i)=>a[((i-o)%24+24)%24]);};
const pctS=v=>(v<0?'−':'+')+Math.abs(v*100).toFixed(Math.abs(v)<0.1?1:0)+'%';
function btStarts(r){
  const S=r.starts;if(!S||!S.runs.length)return'';const R=S.runs,n=R.length,ok=R.filter(x=>!x.ruin).length,wp=R.filter(x=>x.wipe).length;
  const srt=R.slice().sort((a,b)=>a.ret-b.ret||(a.wipeAt||0)-(b.wipeAt||0)),worst=srt[0],best=srt[n-1],med=srt[Math.floor(n/2)];
  const every=Math.ceil(n/12),items=R.map((x,i)=>({label:i%every===0?x.k.slice(2):'',value:Math.max(-100,x.ret*100),color:x.wipe?'var(--bad)':x.ruin?'var(--warn)':'var(--ok)'}));
  const chv=CH.bars({w:860,h:230,m:{l:56},items,yfmt:v=>Math.round(v)+'%',ylabel:t('bs_y',{W:S.W}),label:'Result by start month'});
  const rows=[['Start dates tested',String(n)],['Length of each run',S.W+' months'],['Stayed above the ruin line',ok+' of '+n+' ('+pc(ok/n,0)+')'],['Wiped out',wp+' of '+n],['Median result',pctS(med.ret)],
    ['Best start',lmon(best.k)+' ('+pctS(best.ret)+')'],['Worst start',lmon(worst.k)+' ('+(worst.wipe?t('bt_out_wipe'):pctS(worst.ret))+')']];
  return`<div class="s12">${card('Start-date luck',`<div class="split">${ch(chv)}<div>${kv(rows)}</div></div>`+lg([['var(--ok)',t('lg_bs_ok')],['var(--warn)',t('lg_bs_ruin',{x:D.ruin})],['var(--bad)',t('lg_bs_wipe')]])+
    `<p class="small" style="margin:.6rem 0 0">${esc(t('bs_now',{ok,n,W:S.W,wp,worst:lmon(worst.k),best:lmon(best.k)}))}</p>`+note('bs_note'))}</div>`;}
function btSimReal(r){
  let rows=[],line='',btn='';
  if(r.kind==='grid'){const g=D.gm;if(!g)return'';const st=r.st,c=Math.max(1,st.cycles),M=st.reach.length,rl=st.reach[M-1]/c,sl=g.reach[g.G.M-1]||0;
    const f=(a,b)=>[a,b];rows=[['Average daily range',D.gVol+' pips (your input)',Math.round(r.adr)+' pips'],['Cycles won',pc(g.win),pc(st.wins/c)],['Average win',money(g.avgW),st.wins?money(st.sumW/st.wins):'–'],['Average loss',money(g.avgL),st.cycles-st.wins?money(st.sumL/(st.cycles-st.wins)):'–'],
      [D.stype==='grid'?'Cycles that fill every order':'—',D.stype==='grid'?pc(sl,1):'–',D.stype==='grid'?pc(rl,1):'–'],['Cycles that dip to the ruin line',pc(g.pRuin1,2),pc(st.cycR/c,2)],['Cycles that dip past the whole balance',pc(g.pWipe1,2),pc(st.cycW/c,2)],['Median cycle length',SFX.quantile(g.days,0.5).toFixed(1)+' days',(st.durMed/1440).toFixed(1)+' days']].filter(x=>x[0]!=='—');
    const a=g.pRuin1,b=st.cycR/c;line=st.cycles<30?t('bsv_few'):b>0&&a===0?t('bsv_worse0',{x:pc(b,2)}):b>a*1.5&&b>0?t('bsv_worse',{x:(b/a).toFixed(1)}):a>b*1.5&&a>0?t('bsv_better'):t('bsv_close');
    if(Math.abs(r.adr-D.gVol)/r.adr>0.15)btn=`<button type="button" class="btn alt" data-bt-adr="${Math.round(r.adr)}" style="margin-top:.6rem">${esc(t('bsv_btn',{x:Math.round(r.adr)}))}</button>`;}
  else{const m=D.model;if(!m)return'';const sm=r.sample,wr=sm.n?sm.wins/sm.n:0,aw=wr>0?(sm.meanR-(1-wr)*sm.avgLoss)/wr:0,N=Math.max(1,r.st.trades);
    rows=[['Win rate',pc(m.p),pc(wr)],['Average win',rfmt(m.W,2),rfmt(aw,2)],['Average loss',rfmt(-m.L,2),rfmt(sm.avgLoss,2)],['Losses beyond the stop',pc(0,0),pc(sm.gapLoss/Math.max(1,sm.n),1)],['Average result per trade',rfmt(m.En,3),rfmt(sm.meanR,3)],
      ['Longest losing streak in '+N+' trades',t('bsv_typ',{k:SFX.typicalStreak(1-m.p,N)}),String(r.st.maxRun)]];
    line=m.p>wr+0.03?t('bsv_fx_hi',{d:((m.p-wr)*100).toFixed(1)}):t('bsv_fx_ok');}
  return`<div class="s6">${card('Simulation vs real gold',tbl(['',r.kind==='grid'?'Simulation':'Your inputs','Real gold'],rows)+`<p class="small" style="margin:.6rem 0 0">${esc(line)}</p>`+btn+note(r.kind==='grid'?'bsv_note':'bsv_note_f'))}</div>`;}
function btVol(r){
  const Y=r.yAdr||[];if(!Y.length)return'';const G=r.kind==='grid'?gParams():null;let refs=[];
  if(r.kind==='fixed')refs=[[D.sl,'var(--bad)',t('bv_ref_sl')],[D.sl*D.rr,'var(--ok)',t('bv_ref_tp')]];
  else if(D.stype==='grid')refs=[[D.gStep,'var(--warn)',t('bv_ref_step')],[(G.M-1)*D.gStep,'var(--bad)',t('bv_ref_full')]];
  else{const w=gLadder(G).wipeD;refs=[[D.gTp,'var(--ok)',t('bv_ref_tp')]].concat(isFinite(w)?[[w,'var(--bad)',t('bv_ref_wipe')]]:[]);}
  const mx=amax(Y.map(y=>y.adr)),shown=refs.filter(x=>x[0]>0&&x[0]<=mx*2.5);
  const chv=CH.bars({w:420,h:220,items:Y.map(y=>({label:String(y.y).slice(2),value:y.adr,color:'var(--c1)'})),ymax:amax(mx,shown.map(x=>x[0]))*1.12,hlines:shown.map(x=>({y:x[0],color:x[1]})),yfmt:v=>cmpNum(v),valFmt:v=>Math.round(v)+'',ylabel:'pips a day',label:'Average daily range by year'});
  const f=Y[0],l=Y[Y.length-1],ref=refs[0];
  const line=t('bv_now',{y0:f.y,a:Math.round(f.adr),y1:l.y,b:Math.round(l.adr),x:(l.adr/f.adr).toFixed(1),name:ref[2],v:+ref[0].toFixed(1),r0:(ref[0]/f.adr*100).toFixed(0),r1:(ref[0]/l.adr*100).toFixed(0)});
  return`<div class="s6">${card('Gold volatility by year',ch(chv)+lg([['var(--c1)',t('bv_lg_adr')]].concat(refs.map(x=>[x[1],x[2]+' ('+(+x[0].toFixed(1)).toLocaleString('en-US')+')'])))+`<p class="small" style="margin:.6rem 0 0">${esc(line)}</p>`+note('bv_note'))}</div>`;}
function btTrend(r){
  const M=(r.book.months||[]).filter(m=>m.eq0>0&&m.path>0);if(M.length<3)return'';
  const cls=m=>{const e=Math.abs(m.move)/m.path;return e<0.15?'range':e>=0.35?(m.move>0?'up':'down'):'mixed';};
  const col={range:'var(--c1)',mixed:'var(--muted)',up:'var(--ok)',down:'var(--bad)'},pts=M.map(m=>({x:m.move,y:Math.max(-100,(m.eq1/m.eq0-1)*100),c:cls(m),m}));
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),xm=amax(xs.map(Math.abs))*1.08,ylo=amin(0,ys),yhi=amax(0,ys);
  const chv=CH.plot({w:520,h:250,series:[],dots:pts.map(p=>({x:p.x,y:p.y,r:3.4,color:col[p.c],op:0.9})),hlines:[{y:0,color:'var(--muted)',dash:false}],vlines:[{x:0,color:'var(--muted)'}],xlo:-xm,xhi:xm,ylo:ylo-(yhi-ylo)*0.08,yhi:yhi+(yhi-ylo)*0.08,xfmt:v=>cmpNum(Math.abs(v))===''?'0':(v<0?'−':'+')+cmpNum(Math.abs(v)),yfmt:v=>Math.round(v)+'%',xlabel:t('btr_x'),ylabel:t('btr_y'),label:'Monthly result by gold move'});
  const order=['range','mixed','up','down'],rows=order.map(k=>{const a=pts.filter(p=>p.c===k);if(!a.length)return[t('btr_'+k),'0','–','–','–'];const avg=a.reduce((s,p)=>s+p.y,0)/a.length,w=a.reduce((x,p)=>p.y<x.y?p:x,a[0]);
    return[t('btr_'+k),String(a.length),(avg>=0?'+':'−')+Math.abs(avg).toFixed(1)+'%',pc(a.filter(p=>p.y<0).length/a.length,0),lmon(w.m.m)+' '+(w.y>=0?'+':'−')+Math.abs(w.y).toFixed(1)+'%'];});
  const by=order.map(k=>{const a=pts.filter(p=>p.c===k);return{k,avg:a.length?a.reduce((s,p)=>s+p.y,0)/a.length:null,n:a.length};}).filter(x=>x.n>=2),best=by.slice().sort((a,b)=>b.avg-a.avg)[0],worst=by.slice().sort((a,b)=>a.avg-b.avg)[0];
  const line=best&&worst&&best.k!==worst.k?t('btr_now',{best:t('btr_'+best.k).toLowerCase(),b:(best.avg>=0?'+':'−')+Math.abs(best.avg).toFixed(1)+'%',worst:t('btr_'+worst.k).toLowerCase(),w:(worst.avg>=0?'+':'−')+Math.abs(worst.avg).toFixed(1)+'%'}):'';
  return`<div class="s12">${card('Trend months vs range months',`<div class="split">${ch(chv)}<div>${tbl(['Month type','Months','Average','Losing','Worst month'],rows)}</div></div>`+lg(order.map(k=>[col[k],t('btr_'+k)]))+(line?`<p class="small" style="margin:.6rem 0 0">${esc(line)}</p>`:'')+note('btr_note'))}</div>`;}
function btTrouble(r){
  const st=r.st,dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],tz=tzLab();let left,right,line;
  const gapRows=[['Weekend and holiday gaps held',String(st.gapN)],['Total effect of those gaps',money(st.gapSum)],['Worst single gap',st.gapWorst<0?money(st.gapWorst)+' ('+dfmt(st.gapWorstAt)+')':'–']];
  if(r.kind==='grid'){const hr=rot(st.troubleHr),mxh=hr.indexOf(amax(hr));
    left=ch(CH.bars({w:600,h:230,items:hr.map((v,i)=>({label:i%3===0?String(i):'',value:v,color:i===mxh?'var(--bad)':'var(--c2)'})),xlabel:t('bq_hour',{tz}),ylabel:t('bq_count'),label:'Hour of the deepest moments'}));
    const dw=[1,2,3,4,5,6,0].map(i=>st.troubleDw[i]);
    right=ch(CH.bars({w:420,h:200,items:dw.map((v,i)=>({label:dn[[1,2,3,4,5,6,0][i]],value:v,color:'var(--c2)'})),ylabel:t('bq_count'),label:'Weekday of the deepest moments'}));
    line=t('bq_now',{n:st.troubleN,h0:mxh,h1:(mxh+1)%24,tz,k:hr[mxh]});}
  else{const sm=r.sample,hr=rot(sm.hrW.map((w,i)=>sm.hrN[i]?w/sm.hrN[i]*100:0)),hn=rot(sm.hrN),c=costR(),be=(1+c)/(D.rr+1)*100;
    const lo=hr.reduce((a,v,i)=>hn[i]>=20&&v<hr[a]?i:a,0),hi=hr.reduce((a,v,i)=>hn[i]>=20&&v>hr[a]?i:a,0);
    left=ch(CH.bars({w:420,h:200,items:hr.map((v,i)=>({label:i%3===0?String(i):'',value:v,color:v>=be?'var(--ok)':'var(--c2)',faint:hn[i]<20})),ymax:100,hlines:[{y:be,color:'var(--muted)'}],xlabel:t('bq_hour',{tz}),ylabel:t('bq_wr'),label:'Random-entry win rate by hour'}));
    right='';line=t('bq_now_f',{lo,hi,tz,wlo:hr[lo].toFixed(0),whi:hr[hi].toFixed(0),be:be.toFixed(0)});}
  return`<div class="s12">${card(r.kind==='grid'?'When the trouble starts':'Win rate by time of day',(r.kind==='grid'?`<div class="split">${left}<div>${right}${kv(gapRows)}</div></div>`:left+kv(gapRows))+`<p class="small" style="margin:.6rem 0 0">${esc(line)}</p>`+note(r.kind==='grid'?'bq_note':'bq_note_f'))}</div>`;}
function btStreaks(r){
  const st=r.st,N=st.trades;if(N<20)return'';const p=st.wins/N,q=1-p,cnt=k=>st.runs.slice(k).reduce((a,x)=>a+(x||0),0),exp=k=>Math.pow(q,k)+(N-k)*p*Math.pow(q,k);
  const rows=[3,4,5,6,7,8,10,12].filter(k=>k<=Math.max(8,st.maxRun+1)).map(k=>[k+'+',String(cnt(k)),exp(k).toFixed(1),exp(k)>0.5?(cnt(k)/exp(k)).toFixed(2)+'×':'–']);
  const k5=cnt(5),e5=exp(5),line=e5<2?t('bk_few'):k5>e5*1.4?t('bk_more',{x:(k5/e5).toFixed(1)}):k5<e5*0.7?t('bk_less'):t('bk_same');
  return`<div class="s6">${card('Real losing streaks',tbl(['Streak length','Real','Expected if independent','Ratio'],rows)+kv([['Longest losing streak',String(st.maxRun)],['Typical longest, if independent',String(SFX.typicalStreak(q,N))]])+`<p class="small" style="margin:.6rem 0 0">${esc(line)}</p>`+note('bk_note'))}</div>`;}
function btDeeper(r){
  return r.kind==='grid'?btStarts(r)+btSimReal(r)+btVol(r)+btTrend(r)+btTrouble(r):btStarts(r)+btSimReal(r)+btStreaks(r)+btVol(r)+btTrouble(r).replace('class="s12"','class="s6"')+btTrend(r);}

function btEvents(){
  const main=$('d-main');
  main.addEventListener('click',e=>{const r=e.target.closest('[data-bt-run]');if(r){btRun();return;}
    const ad=e.target.closest('[data-bt-adr]');if(ad){const v=+ad.dataset.btAdr;D.gVol=v;$('g-vol').value=v;dtouch.gVol=1;revalidate();analyze();return;}
    const p=e.target.closest('[data-bt-pre]');if(p&&BT.idx){const ms=BT.idx.months.map(x=>x.m),k=p.dataset.btPre;BT.to=ms[ms.length-1];BT.from=k==='all'?ms[0]:ms[Math.max(0,ms.length-(+k))];btRedraw();}});
  main.addEventListener('change',e=>{const el=e.target.closest('[data-bt]');if(!el)return;const k=el.dataset.bt,ms=BT.idx?BT.idx.months.map(x=>x.m):[];
    if(k==='dir')BT.dir=el.value;else if(el.value){let v=el.value;if(ms.length){if(v<ms[0])v=ms[0];if(v>ms[ms.length-1])v=ms[ms.length-1];}BT[k]=v;if(BT.from>BT.to){if(k==='from')BT.to=BT.from;else BT.from=BT.to;}}
    btRedraw();});}

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
  if(BT.res&&BT.kind===st){const r=BT.res;
    if(title==='Equity on real gold'||title==='Equity: one random-entry run')return mdMonthly(r);
    if(title==='Orders reached'&&st==='grid'){const s=r.st,c=Math.max(1,s.cycles);return cap('Orders reached in the backtest')+MD.table(['Order','Cycles reaching it','Share',''],s.reach.map((x,i)=>[String(i+1),x.toLocaleString('en-US'),pc(x/c,1),MD.bar(x,c)]))+'\n';}
    if(title==='Start-date luck'&&r.starts){const S=r.starts;return cap(tx('Every start month tested (each run lasts '+S.W+' months)','ทุกเดือนเริ่มที่ทดสอบ (แต่ละรอบยาว '+S.W+' เดือน)'))+
      MD.table(['Start','Result','Outcome',''],S.runs.map(x=>[x.k,pctS(x.ret),x.wipe?'wiped out':x.ruin?'hit −'+D.ruin+'%':'survived',MD.bar(Math.max(0,x.ret+1),amax(S.runs.map(y=>y.ret+1)))]))+'\n';}
    if(title==='Gold volatility by year'){const Y=r.yAdr||[],ref=fixed?D.sl:st==='grid'?D.gStep:D.gTp,nm=fixed?'Your stop':st==='grid'?'Your spacing':'Your take-profit',mx=amax(Y.map(y=>y.adr));
      return MD.table(['Year','Average daily range (pips)',nm+' as % of a day',''],Y.map(y=>[String(y.y),Math.round(y.adr).toLocaleString('en-US'),ref>0?(ref/y.adr*100).toFixed(0)+'%':'–',MD.bar(y.adr,mx)]))+'\n';}
    if(title==='When the trouble starts'){const s=r.st,hr=rot(s.troubleHr),mx=amax(hr,1),dn=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],dw=[1,2,3,4,5,6,0].map(i=>s.troubleDw[i]),mw=amax(dw,1);
      return cap('Deepest moments by hour ('+tzLab()+')')+MD.table(['Hour','Count',''],hr.map((v,i)=>[String(i).padStart(2,'0')+':00',String(v),MD.bar(v,mx)]))+'\n'+cap('By weekday')+MD.table(['Day','Count',''],dw.map((v,i)=>[dn[i],String(v),MD.bar(v,mw)]))+'\n';}
    if(title==='Win rate by time of day'){const sm=r.sample,hr=rot(sm.hrW.map((w,i)=>sm.hrN[i]?w/sm.hrN[i]:0)),hn=rot(sm.hrN),be=(1+costR())/(D.rr+1);
      return cap('Random-entry win rate by entry hour ('+tzLab()+'); break-even '+pc(be)+'. Hours with fewer than 20 entries are marked *.')+MD.table(['Hour','Entries','Win rate','vs break-even',''],hr.map((v,i)=>[String(i).padStart(2,'0')+':00'+(hn[i]<20?' *':''),String(hn[i]),hn[i]?pc(v):'–',hn[i]?sgn((v-be)*100,1)+' pts':'–',MD.bar(v,1)]))+'\n';}}
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
function mdMonthly(r){
  const M=(r.book.months||[]).filter(m=>m.eq0>0);if(!M.length)return'';const by=new Map();M.forEach(m=>{const y=m.k?m.k.slice(0,4):m.m.slice(0,4);if(!by.has(y))by.set(y,{});by.get(y)[+(m.m||m.k).slice(5,7)]=m.eq1/m.eq0-1;});
  const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],f=v=>v===undefined?'':(v<=-1?'−100%':(v<0?'−':'+')+Math.abs(v*100).toFixed(1)+'%');
  const yr=new Map(r.book.years.map(y=>[String(y.y),y]));
  return cap(tx('Monthly returns (account change in each calendar month)','ผลตอบแทนรายเดือน (การเปลี่ยนแปลงของทุนในแต่ละเดือน)'))+MD.table(['Year'].concat(mn).concat(['Year']),[...by.entries()].map(([y,o])=>{const Y=yr.get(y);return[y].concat(mn.map((_,i)=>f(o[i+1]))).concat([Y&&Y.start>0?f(Y.end/Y.start-1):'']);}))+'\n';}
function mdInputs(){
  const fixed=D.stype==='fixed',ns=D.stype==='nostop',F=D.filled||{};
  const rows=fixed?[['Strategy','d-wr','wr'],['Strategy','d-rr','rr'],['Strategy','d-n','n'],['Strategy','d-tpd','tpd'],['Risk rules','d-risk','risk'],['Risk rules','d-sizing','sizing'],['Risk rules','d-dafter','dAfter'],['Risk rules','d-dcut','dCut'],
      ['Account and costs','d-bal','bal'],['Account and costs','d-sl','sl'],['Account and costs','d-spread','spread'],['Account and costs','d-comm','comm'],['Account and costs','d-pv','pv'],['Simulation','d-hor','hor'],['Simulation','d-ruin','ruin']]
    :[['Grid','g-lot','gLot']].concat(ns?[]:[['Grid','g-step','gStep'],['Grid','g-mult','gMult'],['Grid','g-max','gMax']]).concat([['Grid','g-tp','gTp'],['Grid','g-sl','gSl'],['Grid','g-vol','gVol'],['Grid','g-auto','gAuto'],['Grid','g-mkt','gMkt'],
      ['Account and costs','d-bal','bal'],['Account and costs','d-spread','spread'],['Account and costs','d-comm','comm'],['Account and costs','d-pv','pv'],['Simulation','d-hor','hor'],['Simulation','d-ruin','ruin']]);
  const sel={sizing:'d-sizing',gAuto:'g-auto',gMkt:'g-mkt'},unsetKeys=UNSET.map(x=>x[1]),blankOk={sl:1,pv:1,gSl:1};
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
  if(BT.res&&BT.kind===st){const r=BT.res,b=r.book,o=btOutcome(r);rows.push(['Gold backtest '+dfmt(r.from)+' → '+dfmt(r.to),o[1]+(o[2]?' ('+o[2]+')':'')+', final '+money(r.final)+', deepest fall −'+pc(Math.min(1,b.mdd))+(BT.sig!==btSig()?' [stale: inputs changed]':'')]);
    if(r.starts&&r.starts.runs.length){const R=r.starts.runs;rows.push(['Start-date luck',R.filter(x=>!x.ruin).length+' of '+R.length+' start months survived, '+R.filter(x=>x.wipe).length+' wiped out']);}}
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
    if(!ns)R.push(tx(`Never add orders beyond the ${g.G.M} planned, and never widen the spacing (${D.gStep} pips) or raise the multiplier (${D.gMult}) mid-cycle.`,`ห้ามเปิดออเดอร์เกิน ${g.G.M} ไม้ที่วางแผนไว้ ห้ามขยายระยะห่าง (${D.gStep} pips) หรือเพิ่มตัวคูณ (${D.gMult}) ระหว่างรอบ`));
    if(isFinite(lad.ruinD))R.push(tx(`Set a price alert ${pip(lad.ruinD)} pips against the first entry: that is the ruin line (−${D.ruin}%). The account is wiped out at ${pip(lad.wipeD)} pips.`,`ตั้งแจ้งเตือนราคาที่ ${pip(lad.ruinD)} pips สวนจากออเดอร์แรก นั่นคือเส้นพอร์ตแตก (−${D.ruin}%) และพอร์ตจะหมดที่ ${pip(lad.wipeD)} pips`));
    R.push(D.gSl>0?tx(`Keep the final stop at ${D.gSl} pips after the last order, and let it fire.`,`คง Stop สุดท้ายไว้ที่ ${D.gSl} pips หลังออเดอร์สุดท้าย และปล่อยให้มันทำงาน`):tx('There is no final stop, so one long trend can take the whole account. Decide in advance where you will close everything.','ไม่มี Stop สุดท้าย เทรนด์ยาวครั้งเดียวอาจกินทั้งพอร์ต กำหนดล่วงหน้าว่าจะปิดทั้งหมดที่ไหน'));
    R.push(tx(`Re-check the pair's average daily range every month. This analysis assumes ${D.gVol} pips; if the market gets wider, every distance above shrinks in real terms.`,`ตรวจช่วงราคาเฉลี่ยต่อวันของคู่เงินทุกเดือน การวิเคราะห์นี้ใช้ ${D.gVol} pips ถ้าตลาดผันผวนขึ้น ทุกระยะด้านบนจะแคบลงในทางปฏิบัติ`));
    if(BT.res&&BT.kind===D.stype&&BT.res.st.gapN>0&&BT.res.st.gapSum<0)R.push(tx(`Weekend gaps cost ${money(BT.res.st.gapSum)} in the gold backtest. Consider closing or hedging before the weekend.`,`Gap ช่วงสุดสัปดาห์ทำให้เสีย ${money(BT.res.st.gapSum)} ใน Backtest ทองคำ พิจารณาปิดหรือป้องกันก่อนสุดสัปดาห์`));
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
  if(BT.res&&BT.kind===st)rows.push(['Gold backtest','COMEX gold futures, 1-minute bars, contract rolls removed, 1 pip = $0.10. Inside each minute: open → low → high → close if it closed up, open → high → low → close if down. Fills at the level, or at the open when price gaps past it.'+(st==='fixed'?' Entries are random, not yours.':'')]);
  let s=MD.table(['Piece','How it works'],rows,['l','l'])+'\n';
  if(st==='fixed')s+='```\nE[R]          = p·W − q·L\nbreak-even p  = L ÷ (W + L)\nKelly f*      = p/L − q/W\ngrowth g(f)   = p·ln(1 + f·W) + q·ln(1 − f·L)\nlots          = balance × risk ÷ (SL × value per unit)\n```\n\n';
  return s+MD.p(tx('Every simulation uses a fixed seed, so the same inputs always give the same numbers. Re-enter the inputs above to reproduce this report.','ทุกการจำลองใช้ Seed คงที่ ค่าที่ใส่เหมือนเดิมจะได้ตัวเลขเหมือนเดิมเสมอ ใส่ค่าตามตารางด้านบนเพื่อสร้างรายงานนี้ซ้ำ'));}
function mdLimits(withBt){
  const tl=k=>(I18N[LANG]&&I18N[LANG][k])||I18N.en[k],li=a=>a.map(x=>'- **'+x[0]+'.** '+x[1]).join('\n')+'\n\n';let s='';
  tl('sc_cant').forEach(g=>{s+=MD.h(3,g[0])+li(g[1]);});
  if(withBt){const b=tl('sc_bt_cant');s+=MD.h(3,b[0])+li(b[1]);}
  return s;}
function mdReport(){
  clearTimeout(timer);analyze();
  const st=D.stype,fixed=st==='fixed';if(fixed?!D.model:!D.gm)return null;
  const S=MD.stamp(),name={fixed:'Fixed stop',grid:'Grid / martingale',nostop:'No hard stop'}[st];let html;
  if(fixed){const m=D.model,r=D.res;EXPL=Object.assign({},buildModelExpl(m),r?buildHistExpl(r):{});
    html=mSummary(m)+mEdge(m)+mSurvival(m)+mSizing(m)+mStreaks(m)+mCosts(m)+(r?secSummary(r)+secEdge(r)+secSurvival(r)+secBehavior(r)+secCosts(r):`<section>${mHead(6)}<div class="card"><p>${esc(D.histMsg())}</p></div></section>`);}
  else{const g=D.gm;EXPL=gExpl(g);html=gSummary(g)+gExposure(g)+gOutcomes(g)+gSurvival(g);}
  const btOn=!!(BT.res&&BT.kind===st&&!BT.busy);if(btOn)html+=btSection();
  const tpl=document.createElement('template');tpl.innerHTML=html;
  const gk=window.__sfxGate,errs=!$('desk-err').hidden?$('desk-err').textContent:'';
  let md='# Jarn Neow risk report: '+name+'\n\n';
  md+=MD.quote(tx('A risk report for one trading strategy: how likely the account is to survive, how deep the falls can get and what size keeps the risk acceptable. It is not a profit forecast and not financial advice.','รายงานความเสี่ยงของกลยุทธ์เทรดหนึ่งระบบ: โอกาสที่พอร์ตจะรอด การย่อตัวลึกได้แค่ไหน และขนาดไม้ที่ทำให้ความเสี่ยงอยู่ในระดับรับได้ ไม่ใช่การทำนายกำไร และไม่ใช่คำแนะนำทางการเงิน'));
  md+=MD.kv([['Generated',S.local],['App','Jarn Neow, Expert mode ('+MD.appUrl()+')'],['Strategy type',name+' ('+t(st==='fixed'?'st_fixed_d':st==='grid'?'st_grid_d':'st_nostop_d')+')'],['Language',LANG==='th'?'ไทย':'English'],
    ['Testing done',gk?t('gate_'+gk+'_t'):'not answered'],['Gold backtest',btOn?dfmt(BT.res.from)+' → '+dfmt(BT.res.to):tx('not run for these inputs','ยังไม่ได้รันสำหรับค่าชุดนี้')]],['Report','Detail']);
  if(errs)md+=MD.quote('⚠ '+errs+' '+tx('The last valid values were used.','ใช้ค่าล่าสุดที่ถูกต้องแทน'));
  md+=MD.h(2,tx('At a glance','สรุปสั้น'))+mdGlance();
  md+=MD.h(2,tx('Inputs','ค่าที่ใส่'))+mdInputs()+'\n';
  if(gk)md+=MD.h(2,tx('Testing status','สถานะการทดสอบ'))+MD.p('**'+t('gate_'+gk+'_t')+'** '+t('gate_'+gk+'_p'))+(gk!=='ok'?MD.list([1,2,3].map(i=>t('gate_'+gk+'_'+i))):'');
  md+=mdWalk(tpl.content,false);
  if(!btOn)md+=MD.h(2,D.stype==='fixed'?'Your stop and target on real gold':'Test on real gold')+MD.p(tx('Not included: the gold test hasn\'t been run for these inputs. Run it at the bottom of the Expert page (any range from 7 Jun 2010 to 13 Nov 2026), then export again.','ไม่ได้รวมไว้: ยังไม่ได้รันการทดสอบกับทองจริง สำหรับค่าชุดนี้ รันได้ที่ท้ายหน้าโหมดผู้เชี่ยวชาญ (ช่วงใดก็ได้ตั้งแต่ 7 มิ.ย. 2010 ถึง 13 พ.ย. 2026) แล้วออกรายงานใหม่'));
  md+=MD.h(2,tx('Trading rules to commit to','กฎการเทรดที่ตั้งใจจะทำตาม'))+MD.p(tx('Derived from the numbers above. Print it, sign it, keep it next to the screen.','สรุปจากตัวเลขด้านบน พิมพ์ออกมา เซ็นชื่อ แล้ววางไว้ข้างจอ'))+mdRules();
  md+=MD.h(2,tx('Method and reproducibility','วิธีคำนวณและการทำซ้ำ'))+mdMethod();
  md+=MD.h(2,tx('What this report can\'t tell you','สิ่งที่รายงานนี้บอกไม่ได้'))+mdLimits(btOn);
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
  main.innerHTML=mSummary(m)+mEdge(m)+mSurvival(m)+mSizing(m)+mStreaks(m)+mCosts(m)+hist+btSection();wiInit();rowAlign();applyLayout();}
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
const UNSET=[['d-wr','wr'],['d-rr','rr'],['d-n','n'],['d-tpd','tpd'],['d-risk','risk'],['g-lot','gLot'],['g-step','gStep'],['g-mult','gMult'],['g-max','gMax'],['g-tp','gTp'],['g-vol','gVol'],['d-bal','bal'],['d-sl','sl'],['d-spread','spread'],['d-comm','comm'],['d-pv','pv']];
const shown=id=>{const el=$(id);if(!el)return false;const g=D.stype!=='fixed';if(el.closest('.st-f'))return!g;if(el.closest('.st-g'))return g&&!(el.closest('.g-only')&&D.stype==='nostop');return true;};
const DF=[['d-wr','wr',1,100],['d-rr','rr',0.05,100],['d-n','n',5,100000],['d-tpd','tpd',0.05,200],['d-risk','risk',0.05,100],['d-dafter','dAfter',0,20,0],['d-dcut','dCut',5,95],
   ['g-lot','gLot',0.01,100],['g-step','gStep',1,10000],['g-mult','gMult',1,5],['g-max','gMax',1,30],['g-tp','gTp',1,10000],['g-sl','gSl',0,100000,0],['g-vol','gVol',1,10000],
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
  $('csvfile').addEventListener('change',e=>{readFile(e.target.files[0]);e.target.value='';});
  const dz=$('dropzone');
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragover');}));
  dz.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files[0])readFile(e.dataTransfer.files[0]);});
  $('symsel').addEventListener('change',e=>{D.symbol=e.target.value;autoFill();statusLine();hint();analyze();});
  /* [id, key, min, max, valueWhenBlank] */
  DF.forEach(([id,key,min,max,blank])=>{const el=$(id),er=document.createElement('p');er.className='ferr';er.id='e-'+id;er.hidden=true;el.closest('.formrow').after(er);
    el.addEventListener('input',()=>{dtouch[key]=1;const st=checkField(id);if(st==='ok'){const v=parseFloat(el.value);D[key]=key==='hor'||key==='n'||key==='dAfter'||key==='gMax'?Math.round(v):v;schedule();}else if(st==='blank'){D[key]=blank;schedule();}renderErr();});});
  $('d-net').addEventListener('change',e=>{D.net=e.target.value;analyze();});
  $('d-sizing').addEventListener('change',e=>{D.sizing=e.target.value;analyze();});
  $('g-auto').addEventListener('change',e=>{D.gAuto=e.target.value;analyze();});
  $('g-mkt').addEventListener('change',e=>{D.gMkt=e.target.value;analyze();});
  document.querySelectorAll('.stypes button').forEach(b=>b.addEventListener('click',()=>setType(b.dataset.st)));
  $('p-type').querySelector('.stypes').addEventListener('keydown',e=>{const bs=[...document.querySelectorAll('.stypes button')],i=bs.findIndex(b=>b.dataset.st===D.stype);
    if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();const j=(i+(e.key==='ArrowDown'||e.key==='ArrowRight'?1:bs.length-1))%bs.length;setType(bs[j].dataset.st);bs[j].focus();}});
  $('desk-unset').addEventListener('click',e=>{const g=e.target.closest('[data-unset-go]'),h=e.target.closest('[data-unset-hide]');
    if(h){unsetHidden=true;renderUnset();return;}
    if(g){const el=$(g.dataset.unsetGo);el.scrollIntoView({block:'center',behavior:'smooth'});setTimeout(()=>el.focus({preventScroll:true}),250);}});
  $('d-apply').addEventListener('click',()=>{autoFill();statusLine();analyze();window.scrollTo(0,0);});
  $('d-jump').addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;e.preventDefault();const sec=$(a.getAttribute('href').slice(1));if(!sec)return;sec.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});const h=sec.querySelector('h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}});
  btEvents();
  const mdGo=cp=>{const b=$(cp?'md-desk-copy':'md-desk');let r=null;try{r=mdReport();}catch(e){console.error('report',e);}if(!r)return;if(cp)MD.copy(r.text,b);else{MD.download(r.file,r.text);MD.flash(b,'md_saved');}};
  $('md-desk').addEventListener('click',()=>mdGo(false));$('md-desk-copy').addEventListener('click',()=>mdGo(true));
  $('d-main').addEventListener('input',e=>{const inp=e.target.closest('.wi input[type=range]');if(!inp)return;const box=inp.closest('.wi'),r=wiRange(inp.dataset.k);
    inp.nextElementSibling.textContent=r.f(inp.dataset.k==='n'||inp.dataset.k==='hor'?Math.round(+inp.value):+inp.value);wiLive(box);clearTimeout(wiTimer);wiTimer=setTimeout(()=>wiApply(box),350);});
  $('d-main').addEventListener('change',e=>{const inp=e.target.closest('.wi input[type=range]');if(!inp)return;clearTimeout(wiTimer);const box=inp.closest('.wi');requestAnimationFrame(()=>wiApply(box));});
  $('d-main').addEventListener('click',e=>{const rb=e.target.closest('.wireset');if(rb){const box=rb.closest('.wi');box.querySelectorAll('input[type=range]').forEach(i=>{i.value=i.dataset.base;});wiApply(box);return;}
    const b=e.target.closest('[data-next]');if(!b)return;D.reached=Math.max(D.reached,+b.dataset.next+1);applyLayout();
    const s=$('d-main').querySelector('.dsec[data-step="'+D.reached+'"]');if(s)s.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});});
}
function typeLabels(){const k=D.stype==='grid'?'gi':D.stype==='nostop'?'ni':'fi';
  document.querySelectorAll('#desk label[data-gi]').forEach(l=>{const key=l.dataset[k]||l.dataset.gi;l.dataset.i18n=key;l.textContent=t(key);});}
function setType(st,quiet){
  const prev=D.stype;D.stype=st;document.documentElement.dataset.st=st;
  document.querySelectorAll('.stypes button').forEach(b=>{const on=b.dataset.st===st;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;});
  if(st!=='fixed'&&st!==prev){const d=GDEF[st];[['g-lot','gLot'],['g-tp','gTp'],['g-sl','gSl']].forEach(([id,key])=>{if(!dtouch[key]){D[key]=d[key];$(id).value=key==='gSl'&&!d[key]?'':d[key];}});}
  if(window.__sfxTip)window.__sfxTip.hide();typeLabels();revalidate();if(!quiet)requestAnimationFrame(()=>setTimeout(analyze,0));}
function refreshText(){typeLabels();hint();if(D.parsed)statusLine();else if(D.err)$('file-status').innerHTML='';renderErr();analyze();}
function seed(st,tc){if(tc)['wr','rr','risk','n'].forEach(k=>{dtouch[k]=tc[k]?1:0;});D.wr=st.wr;D.rr=st.rr;D.risk=st.risk;D.n=Math.round(st.n);$('d-wr').value=D.wr;$('d-rr').value=D.rr;$('d-risk').value=D.risk;$('d-n').value=D.n;revalidate();}
return{init,setLayout,setExplain,refreshText,analyze,mdReport,state:()=>D,seed,touched:()=>({wr:dtouch.wr,rr:dtouch.rr,risk:dtouch.risk,n:dtouch.n})};
})();
