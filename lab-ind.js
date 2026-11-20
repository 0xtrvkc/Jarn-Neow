/* Jarn Neow gold playground: indicators and candlestick patterns.
   Formulas and start-up rules follow TA-Lib (ta-lib.org); each one is checked against TA-Lib's own output.
   Values before an indicator has enough candles are NaN. Shared by lab-worker.js (importScripts) and lab.js (a plain script). */
var LABIND=(function(){
'use strict';
const nan=n=>{const a=new Float64Array(n);a.fill(NaN);return a;};
const EPS=1e-14,isZero=v=>-EPS<v&&v<EPS;

/* ---------- moving averages ---------- */
function SMA(x,p,from){from=from||0;const n=x.length,o=nan(n);let s=0,k=0;
  for(let i=from;i<n;i++){s+=x[i];k++;if(k>p)s-=x[i-p];if(k>=p)o[i]=s/p;}return o;}
/* EMA seeded with the simple average of its first p values (TA-Lib's default) */
function EMA(x,p,from){from=from||0;const n=x.length,o=nan(n),a=2/(p+1);if(n-from<p)return o;
  let s=0;for(let i=from;i<from+p;i++)s+=x[i];let e=s/p;o[from+p-1]=e;
  for(let i=from+p;i<n;i++){e=(x[i]-e)*a+e;o[i]=e;}return o;}
const firstOk=x=>{for(let i=0;i<x.length;i++)if(x[i]===x[i])return i;return x.length;};
function WMA(x,p,from){from=from||0;const n=x.length,o=nan(n),d=p*(p+1)/2;
  for(let i=from+p-1;i<n;i++){let s=0;for(let k=0;k<p;k++)s+=x[i-k]*(p-k);o[i]=s/d;}return o;}
function DEMA(x,p){const e1=EMA(x,p),e2=EMA(e1,p,firstOk(e1)),o=nan(x.length);for(let i=0;i<x.length;i++)if(e2[i]===e2[i])o[i]=2*e1[i]-e2[i];return o;}
function TEMA(x,p){const e1=EMA(x,p),e2=EMA(e1,p,firstOk(e1)),e3=EMA(e2,p,firstOk(e2)),o=nan(x.length);for(let i=0;i<x.length;i++)if(e3[i]===e3[i])o[i]=3*e1[i]-3*e2[i]+e3[i];return o;}
/* triangular average: weights rise to the middle of the window and fall again */
function TRIMA(x,p){const n=x.length,o=nan(n),m=p>>1,w=[];
  if(p%2){for(let k=1;k<=m+1;k++)w.push(k);for(let k=m;k>=1;k--)w.push(k);}else{for(let k=1;k<=m;k++)w.push(k);for(let k=m;k>=1;k--)w.push(k);}
  const d=w.reduce((a,b)=>a+b,0);for(let i=p-1;i<n;i++){let s=0;for(let k=0;k<p;k++)s+=x[i-p+1+k]*w[k];o[i]=s/d;}return o;}
/* Kaufman adaptive moving average (fast 2, slow 30, as in TA-Lib) */
function KAMA(x,p){const n=x.length,o=nan(n);if(n<=p)return o;
  const cMax=2/31,cDiff=2/3-cMax;let sum=0,null_=0,today=0,trail=0;
  for(let i=0;i<p;i++){const d=x[today]-x[today+1];today++;sum+=Math.abs(d);null_=Math.abs(d)<=0?null_+1:0;}
  let prev=x[today-1],t=x[today],t2=x[trail++],roc=t-t2,tv=t2,r=sum<=0||sum<=roc?1:Math.min(1,Math.abs(roc/sum));
  r=r*cDiff+cMax;r*=r;prev=(x[today++]-prev)*r+prev;o[p]=prev;
  while(today<n){t=x[today];t2=x[trail++];roc=t-t2;sum-=Math.abs(tv-t2);const dd=Math.abs(t-x[today-1]);sum+=dd;null_=dd<=0?null_+1:0;
    if(null_>=p){null_=p;sum=0;r=1;}else if(sum<=0||sum<=roc)r=1;else r=Math.min(1,Math.abs(roc/sum));
    tv=t2;r=r*cDiff+cMax;r*=r;prev=(x[today]-prev)*r+prev;o[today]=prev;today++;}
  return o;}
/* Hull moving average: WMA(2·WMA(n/2) − WMA(n), √n), built from TA-Lib's WMA */
function HMA(x,p){const h=WMA(x,Math.max(1,Math.floor(p/2))),f=WMA(x,p),d=nan(x.length);for(let i=0;i<x.length;i++)if(f[i]===f[i])d[i]=2*h[i]-f[i];return WMA(d,Math.max(1,Math.floor(Math.sqrt(p))),firstOk(d));}
function LINREG(x,p,kind){const n=x.length,o=nan(n),SX=p*(p-1)*0.5,SXX=p*(p-1)*(2*p-1)/6,Dv=SX*SX-p*SXX;
  for(let i=p-1;i<n;i++){let SY=0,SXY=0;for(let k=p;k--!==0;){const v=x[i-k];SY+=v;SXY+=k*v;}const m=(p*SXY-SX*SY)/Dv,b=(SY-m*SX)/p;o[i]=kind==='slope'?m:b+m*(p-1);}return o;}
/* Parabolic SAR, started the way TA-Lib starts it */
function SAR(h,l,acc,max){const n=h.length,o=nan(n);if(n<2)return o;if(acc>max)acc=max;let af=acc;
  const dm=l[0]-l[1],dp=h[1]-h[0];let long=!(dm>0&&dp<dm),ep,sar,nh=h[0],nl=l[0];
  if(long){ep=h[1];sar=nl;}else{ep=l[1];sar=nh;}nl=l[1];nh=h[1];
  for(let i=1;i<n;i++){const pl=nl,ph=nh;nl=l[i];nh=h[i];
    if(long){if(nl<=sar){long=false;sar=ep;if(sar<ph)sar=ph;if(sar<nh)sar=nh;o[i]=sar;af=acc;ep=nl;sar=af*(ep-sar)+sar;if(sar<ph)sar=ph;if(sar<nh)sar=nh;}
      else{o[i]=sar;if(nh>ep){ep=nh;af+=acc;if(af>max)af=max;}sar=af*(ep-sar)+sar;if(sar>pl)sar=pl;if(sar>nl)sar=nl;}}
    else if(nh>=sar){long=true;sar=ep;if(sar>pl)sar=pl;if(sar>nl)sar=nl;o[i]=sar;af=acc;ep=nh;sar=af*(ep-sar)+sar;if(sar>pl)sar=pl;if(sar>nl)sar=nl;}
    else{o[i]=sar;if(nl<ep){ep=nl;af+=acc;if(af>max)af=max;}sar=af*(ep-sar)+sar;if(sar<ph)sar=ph;if(sar<nh)sar=nh;}}
  return o;}

/* ---------- oscillators ---------- */
function RSI(c,p){const n=c.length,o=nan(n);if(n<=p)return o;
  let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i]-c[i-1];if(d>0)g+=d;else l-=d;}g/=p;l/=p;o[p]=g+l?100*g/(g+l):0;
  for(let i=p+1;i<n;i++){const d=c[i]-c[i-1];g=(g*(p-1)+(d>0?d:0))/p;l=(l*(p-1)+(d<0?-d:0))/p;o[i]=g+l?100*g/(g+l):0;}return o;}
function CMO(c,p){const n=c.length,o=nan(n);if(n<=p)return o;let g=0,l=0;
  for(let i=1;i<=p;i++){const d=c[i]-c[i-1],gd=d>0?d:0;g+=gd;l+=gd-d;}g/=p;l/=p;o[p]=g+l>0?100*(g-l)/(g+l):0;const ip=1/p;
  for(let i=p+1;i<n;i++){const d=c[i]-c[i-1],gd=d>0?d:0;g+=gd*ip-g*ip;l+=(gd-d)*ip-l*ip;o[i]=g+l>0?100*(g-l)/(g+l):0;}return o;}
const TR=(h,l,c,i)=>Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1]));
function ATR(h,l,c,p){const n=c.length,o=nan(n);if(n<=p)return o;
  let s=0;for(let i=1;i<=p;i++)s+=TR(h,l,c,i);let a=s/p;o[p]=a;
  for(let i=p+1;i<n;i++){a=(a*(p-1)+TR(h,l,c,i))/p;o[i]=a;}return o;}
function NATR(h,l,c,p){const a=ATR(h,l,c,p);for(let i=0;i<a.length;i++)if(a[i]===a[i])a[i]=c[i]!==0?a[i]/c[i]*100:0;return a;}
/* population variance of each window, worked out around the window's mean so flat prices don't lose precision */
function VAR(c,p){const n=c.length,o=nan(n);for(let i=p-1;i<n;i++){let s=0;for(let j=i-p+1;j<=i;j++)s+=c[j];const mu=s/p;let v=0;for(let j=i-p+1;j<=i;j++){const d=c[j]-mu;v+=d*d;}o[i]=v/p;}return o;}
function BB(c,p,k){const n=c.length,m=SMA(c,p),v=VAR(c,p),up=nan(n),lo=nan(n);
  for(let i=p-1;i<n;i++){const sd=v[i]>0?Math.sqrt(v[i]):0;up[i]=m[i]+k*sd;lo[i]=m[i]-k*sd;}return{up,mid:m,lo};}
function STDDEV(c,p,k){const v=VAR(c,p);for(let i=0;i<v.length;i++)if(v[i]===v[i])v[i]=v[i]>0?Math.sqrt(v[i])*k:0;return v;}
/* MACD as TA-Lib computes it: both averages start on the slow average's first candle; the signal line is an EMA of MACD */
function MACD(c,f,s,g){const n=c.length;if(f>s){const x=f;f=s;s=x;}
  const slow=EMA(c,s),fast=EMA(c,f,s-f),line=nan(n);for(let i=s-1;i<n;i++)line[i]=fast[i]-slow[i];
  const sig=EMA(line,g,s-1),macd=nan(n),hist=nan(n);for(let i=s+g-2;i<n;i++){macd[i]=line[i];hist[i]=line[i]-sig[i];}return{macd,sig,hist};}
/* percentage price oscillator with EMAs (TA-Lib with MA type EMA) */
function PPO(c,f,s){const n=c.length;if(f>s){const x=f;f=s;s=x;}const slow=EMA(c,s),fast=EMA(c,f),o=nan(n);
  for(let i=s-1;i<n;i++)o[i]=isZero(slow[i])?0:(fast[i]-slow[i])/slow[i]*100;return o;}
function HHLL(h,l,c,i,k){let hh=-Infinity,ll=Infinity;for(let j=i-k+1;j<=i;j++){if(h[j]>hh)hh=h[j];if(l[j]<ll)ll=l[j];}return[hh,ll];}
/* slow stochastic: %K over k candles smoothed by a simple average of ks; %D = simple average of %K over d */
function STOCH(h,l,c,k,ks,d){const n=c.length,fk=nan(n);
  for(let i=k-1;i<n;i++){const[hh,ll]=HHLL(h,l,c,i,k);fk[i]=hh>ll?100*(c[i]-ll)/(hh-ll):0;}
  const sk=SMA(fk,ks,k-1),sd=SMA(sk,d,k+ks-2),K=nan(n);for(let i=k+ks+d-3;i<n;i++)K[i]=sk[i];return{k:K,d:sd};}
/* fast stochastic of RSI */
function STOCHRSI(c,p,fk,fd){const r=RSI(c,p),n=c.length,K=nan(n),f=nan(n);
  for(let i=p+fk-1;i<n;i++){let hh=-Infinity,ll=Infinity;for(let j=i-fk+1;j<=i;j++){if(r[j]>hh)hh=r[j];if(r[j]<ll)ll=r[j];}f[i]=hh>ll?100*(r[i]-ll)/(hh-ll):0;}
  const D=SMA(f,fd,p+fk-1);for(let i=p+fk+fd-2;i<n;i++)K[i]=f[i];return{k:K,d:D};}
function CCI(h,l,c,p){const n=c.length,o=nan(n),tp=new Float64Array(n);for(let i=0;i<n;i++)tp[i]=(h[i]+l[i]+c[i])/3;
  for(let i=p-1;i<n;i++){let s=0;for(let j=i-p+1;j<=i;j++)s+=tp[j];const av=s/p;let md=0;for(let j=i-p+1;j<=i;j++)md+=Math.abs(tp[j]-av);md/=p;
    const dv=tp[i]-av,sc=Math.abs(av);o[i]=Math.abs(dv)>EPS*sc&&Math.abs(md)>EPS*sc&&md!==0?dv/(0.015*md):0;}return o;}
function WILLR(h,l,c,p){const n=c.length,o=nan(n);for(let i=p-1;i<n;i++){const[hh,ll]=HHLL(h,l,c,i,p),d=hh-ll;o[i]=d!==0?-100*(hh-c[i])/d:0;}return o;}
function ROC(c,p){const n=c.length,o=nan(n);for(let i=p;i<n;i++)o[i]=c[i-p]!==0?(c[i]/c[i-p]-1)*100:0;return o;}
function MOM(c,p){const n=c.length,o=nan(n);for(let i=p;i<n;i++)o[i]=c[i]-c[i-p];return o;}
function BOP(o_,h,l,c){const n=c.length,o=nan(n);for(let i=0;i<n;i++){const r=h[i]-l[i];o[i]=r>0?(c[i]-o_[i])/r:0;}return o;}
function TRIX(c,p){const e1=EMA(c,p),e2=EMA(e1,p,firstOk(e1)),e3=EMA(e2,p,firstOk(e2)),n=c.length,o=nan(n);
  for(let i=firstOk(e3)+1;i<n;i++)o[i]=e3[i-1]!==0?(e3[i]/e3[i-1]-1)*100:0;return o;}
/* directional movement: +DI, −DI and ADX with Wilder's smoothing, started as in TA-Lib */
function DMI(h,l,c,p){const n=c.length,pdi=nan(n),mdi=nan(n),adx=nan(n);if(n<=p)return{adx,pdi,mdi};const ip=1/p;
  let pP=0,pM=0,pT=0,ph=h[0],pl=l[0],pc=c[0],sumDX=0,prevADX=0;
  const step=(i,smooth)=>{const dp=h[i]-ph,dm=pl-l[i];ph=h[i];pl=l[i];const p1=dp>0&&dp>dm?dp:0,m1=dm>0&&dm>dp?dm:0;
    const tr=Math.max(ph-pl,Math.abs(ph-pc),Math.abs(pl-pc));if(smooth){pP=pP-pP*ip+p1;pM=pM-pM*ip+m1;pT=pT-pT*ip+tr;}else{pP+=p1;pM+=m1;pT+=tr;}pc=c[i];};
  for(let i=1;i<p;i++)step(i,false);
  for(let i=p;i<n;i++){step(i,true);const P=pT>0?100*pP/pT:0,M=pT>0?100*pM/pT:0;pdi[i]=P;mdi[i]=M;
    const s=P+M,dx=pT>0&&!isZero(s)?100*Math.abs(M-P)/s:null;
    if(i<2*p){if(dx!==null)sumDX+=dx;if(i===2*p-1){prevADX=sumDX/p;adx[i]=prevADX;}}
    else{if(dx!==null)prevADX=prevADX-(prevADX-dx)*ip;adx[i]=prevADX;}}
  return{adx,pdi,mdi};}
function AROON(h,l,p){const n=h.length,up=nan(n),dn=nan(n),osc=nan(n),f=100/p;let li=-1,hi=-1,lo=0,hv=0;
  for(let t=p;t<n;t++){const tr=t-p;
    if(li<tr){li=tr;lo=l[li];for(let i=li+1;i<=t;i++)if(l[i]<=lo){li=i;lo=l[i];}}else if(l[t]<=lo){li=t;lo=l[t];}
    if(hi<tr){hi=tr;hv=h[hi];for(let i=hi+1;i<=t;i++)if(h[i]>=hv){hi=i;hv=h[i];}}else if(h[t]>=hv){hi=t;hv=h[t];}
    up[t]=f*(p-(t-hi));dn[t]=f*(p-(t-li));osc[t]=f*(hi-li);}
  return{up,dn,osc};}
function ULTOSC(h,l,c,a,b,d){const ps=[a,b,d].sort((x,y)=>x-y),[p1,p2,p3]=ps,n=c.length,o=nan(n);
  const bp=new Float64Array(n),tr=new Float64Array(n);for(let i=1;i<n;i++){bp[i]=c[i]-Math.min(l[i],c[i-1]);tr[i]=TR(h,l,c,i);}
  const av=(i,p)=>{let s=0,t=0;for(let j=i-p+1;j<=i;j++){s+=bp[j];t+=tr[j];}return t!==0?s/t:0;};
  for(let i=p3;i<n;i++)o[i]=100*(4*av(i,p1)+2*av(i,p2)+av(i,p3))/7;return o;}
/* highest high / lowest low of the n candles before this one (the current candle isn't included) */
function PREV(x,p,hi){const n=x.length,o=nan(n);for(let i=p;i<n;i++){let m=hi?-Infinity:Infinity;for(let j=i-p;j<i;j++)if(hi?x[j]>m:x[j]<m)m=x[j];o[i]=m;}return o;}


/* ---------- candlestick patterns (TA-Lib's rules and default candle settings) ----------
   Each returns +100 (bullish), −100 (bearish), ±80 for the weaker "equal price" forms TA-Lib reports, or 0. */
const CS={BodyLong:['b',10,1],BodyShort:['b',10,1],BodyDoji:['r',10,0.1],ShadowLong:['b',0,1],ShadowVeryShort:['r',10,0.1],Near:['r',5,0.2],Far:['r',5,0.6]};
function candles(F){const o=F.o,h=F.h,l=F.l,c=F.c,n=c.length;
  const body=i=>Math.abs(c[i]-o[i]),up=i=>h[i]-Math.max(c[i],o[i]),dn=i=>Math.min(c[i],o[i])-l[i],white=i=>c[i]>=o[i];
  const rng=(t,i)=>t==='b'?body(i):t==='r'?h[i]-l[i]:up(i)+dn(i);
  /* the average size of setting S for candle j, taken over the candles just before j */
  const avg=(S,j)=>{const[t,p,f]=CS[S];if(!p)return f*rng(t,j);let s=0;for(let k=j-p;k<j;k++)s+=rng(t,k);return f*s/p/(t==='s'?2:1);};
  return{o,h,l,c,n,body,up,dn,white,avg};}
function pat(F,lb,fn){const C=candles(F),out=new Float64Array(C.n);for(let i=lb;i<C.n;i++)out[i]=fn(C,i);return out;}
const CDL={
 engulfing:F=>pat(F,2,({o,c,white},i)=>{const w=white(i),pw=white(i-1);
   const bull=w&&!pw&&((c[i]>=o[i-1]&&o[i]<c[i-1])||(c[i]>o[i-1]&&o[i]<=c[i-1])),bear=!w&&pw&&((o[i]>=c[i-1]&&c[i]<o[i-1])||(o[i]>c[i-1]&&c[i]<=o[i-1]));
   if(!bull&&!bear)return 0;const col=w?1:-1;return o[i]!==c[i-1]&&c[i]!==o[i-1]?col*100:col*80;}),
 hammer:F=>pat(F,11,({o,c,l,body,up,dn,avg},i)=>body(i)<avg('BodyShort',i)&&dn(i)>avg('ShadowLong',i)&&up(i)<avg('ShadowVeryShort',i)&&(c[i]<=l[i-1]+avg('Near',i-1)||o[i]<=l[i-1]+avg('Near',i-1))?100:0),
 shootingstar:F=>pat(F,11,({o,c,body,up,dn,avg},i)=>o[i]>o[i-1]&&o[i]>c[i-1]&&c[i]>o[i-1]&&c[i]>c[i-1]&&body(i)<avg('BodyShort',i)&&up(i)>avg('ShadowLong',i)&&dn(i)<avg('ShadowVeryShort',i)?-100:0),
 doji:F=>pat(F,10,({body,avg},i)=>body(i)<=avg('BodyDoji',i)?100:0),
 morningstar:F=>pat(F,12,({o,c,white,body,avg},i)=>!white(i-2)&&white(i)&&o[i-1]<o[i-2]&&o[i-1]<c[i-2]&&c[i-1]<o[i-2]&&c[i-1]<c[i-2]&&
   c[i]>c[i-2]+body(i-2)*0.3&&body(i-2)>avg('BodyLong',i-2)&&body(i-1)<=avg('BodyShort',i-1)&&body(i)>avg('BodyShort',i)?100:0),
 eveningstar:F=>pat(F,12,({o,c,white,body,avg},i)=>white(i-2)&&!white(i)&&o[i-1]>o[i-2]&&o[i-1]>c[i-2]&&c[i-1]>o[i-2]&&c[i-1]>c[i-2]&&
   c[i]<c[i-2]-body(i-2)*0.3&&body(i-2)>avg('BodyLong',i-2)&&body(i-1)<=avg('BodyShort',i-1)&&body(i)>avg('BodyShort',i)?-100:0),
 soldiers:F=>pat(F,12,({o,c,white,body,up,avg},i)=>white(i-2)&&white(i-1)&&white(i)&&up(i-2)<avg('ShadowVeryShort',i-2)&&up(i-1)<avg('ShadowVeryShort',i-1)&&up(i)<avg('ShadowVeryShort',i)&&
   c[i]>c[i-1]&&c[i-1]>c[i-2]&&o[i-1]>o[i-2]&&o[i-1]<=c[i-2]+avg('Near',i-2)&&o[i]>o[i-1]&&o[i]<=c[i-1]+avg('Near',i-1)&&
   body(i-1)>body(i-2)-avg('Far',i-2)&&body(i)>body(i-1)-avg('Far',i-1)&&body(i)>avg('BodyShort',i)?100:0),
 crows:F=>pat(F,13,({o,h,c,white,dn,avg},i)=>white(i-3)&&!white(i-2)&&!white(i-1)&&!white(i)&&o[i-1]<o[i-2]&&o[i-1]>c[i-2]&&o[i]<o[i-1]&&o[i]>c[i-1]&&h[i-3]>c[i-2]&&c[i-2]>c[i-1]&&c[i-1]>c[i]&&
   dn(i-2)<avg('ShadowVeryShort',i-2)&&dn(i-1)<avg('ShadowVeryShort',i-1)&&dn(i)<avg('ShadowVeryShort',i)?-100:0),
 harami:F=>pat(F,11,({o,c,white,body,avg},i)=>{if(!(body(i-1)>avg('BodyLong',i-1)&&body(i)<=avg('BodyShort',i)))return 0;const s=white(i-1)?-1:1,
   hi1=Math.max(c[i-1],o[i-1]),lo1=Math.min(c[i-1],o[i-1]),hi=Math.max(c[i],o[i]),lo=Math.min(c[i],o[i]);
   if(hi<hi1&&lo>lo1)return s*100;if(hi<=hi1&&lo>=lo1)return s*80;return 0;}),
 piercing:F=>pat(F,11,({o,l,c,white,body,avg},i)=>!white(i-1)&&white(i)&&o[i]<l[i-1]&&body(i-1)>avg('BodyLong',i-1)&&body(i)>avg('BodyLong',i)&&c[i]<o[i-1]&&c[i]>c[i-1]+body(i-1)*0.5?100:0),
 darkcloud:F=>pat(F,11,({o,h,c,white,body,avg},i)=>white(i-1)&&!white(i)&&o[i]>h[i-1]&&body(i-1)>avg('BodyLong',i-1)&&c[i]>o[i-1]&&c[i]<c[i-1]-body(i-1)*0.5?-100:0)
};


/* ---------- rules ----------
   A condition is {a, op, b}: a and b are {id, p (settings), o (output)} or b is {num}. op: xa crosses above, xb crosses below,
   gt is above, lt is below; for patterns bull, bear or any. A rule fires when every condition is true on the closed candle.
   The mirrored sell rule reflects price: orders flip (crosses above → crosses below), levels reflect around the indicator's centre
   (RSI 30 → 70), upper and lower lines swap, +DI/−DI and Aroon up/down swap without flipping, and ADX, ATR and the like stay as they are. */
const MIROP={xa:'xb',xb:'xa',gt:'lt',lt:'gt',bull:'bear',bear:'bull',any:'any'};
const tyOf=x=>{const r=byId[x.id];return(r.oty&&r.oty[x.o])||r.ty||'refl';};
const mirX=x=>{const r=byId[x.id];return{id:r.mirId||x.id,p:x.p,o:(r.mir&&r.mir[x.o])||x.o};};
function mirCond(c){const r=byId[c.a.id];
  if(r.kind==='pat')return{a:mirX(c.a),op:MIROP[c.op]};
  const ty=tyOf(c.a),flip=ty==='refl';let b=c.b;
  if(b&&b.num!==undefined){if(ty==='refl'&&typeof r.mid==='number')b={num:2*r.mid-b.num};}else if(b)b=ty==='abs'?b:mirX(b);
  return{a:ty==='abs'?c.a:mirX(c.a),op:flip?MIROP[c.op]:c.op,b};}
const sellOf=R=>R.mode==='own'?R.sell:R.buy.map(mirCond);
function warmOf(R){let w=50;R.buy.concat(sellOf(R)).forEach(c=>[c.a,c.b].forEach(x=>{if(x&&x.id)w=Math.max(w,Math.ceil(byId[x.id].lb(x.p||{}))+20);}));return w;}
/* +1 buy, −1 sell, 0 nothing for each candle */
function signals(F,R,dir){
  const n=F.c.length,cache=new Map(),out=new Int8Array(n);
  const get=x=>{const k=x.id+JSON.stringify(x.p||{});let v=cache.get(k);if(!v){v=byId[x.id].run(F,x.p||{});cache.set(k,v);}return v[x.o];};
  const test=c=>{const a=get(c.a);
    if(c.op==='bull')return i=>a[i]>0;if(c.op==='bear')return i=>a[i]<0;if(c.op==='any')return i=>a[i]!==0;
    const num=c.b.num!==undefined,bv=num?c.b.num:0,b=num?null:get(c.b),B=num?()=>bv:i=>b[i];
    if(c.op==='xa')return i=>a[i-1]<=B(i-1)&&a[i]>B(i);if(c.op==='xb')return i=>a[i-1]>=B(i-1)&&a[i]<B(i);
    if(c.op==='gt')return i=>a[i]>B(i);return i=>a[i]<B(i);};
  const all=cs=>{const f=cs.map(test);return f.length?i=>{for(const g of f)if(!g(i))return false;return true;}:()=>false;};
  const buy=dir==='short'?()=>false:all(R.buy),sell=dir==='long'?()=>false:all(sellOf(R));
  for(let i=1;i<n;i++){const b=buy(i),s=sell(i);out[i]=b&&!s?1:s&&!b?-1:0;}
  return out;}

/* ---------- the menu ----------
   g: group; ps: [key, label, default, min, max, whole number]; outs: [key, label];
   kind: 'price' (drawn in price units), 'osc' (own scale, lv = default level, mid = centre for mirrored sell rules), 'pat' (candlestick pattern);
   mir: output swaps for the mirrored sell rule; lb: candles needed before values settle */
const P=(k,lab,d,mn,mx,w)=>[k,lab,d,mn,mx,w===undefined?1:w];
const nP=(d,mn,mx)=>P('n','Period',d,mn||2,mx||1000);
const REG=[
 {id:'price',g:'price',name:'Price',ps:[],outs:[['c','Close'],['o','Open'],['h','High'],['l','Low']],kind:'price',mir:{h:'l',l:'h'},run:F=>({c:F.c,o:F.o,h:F.h,l:F.l}),lb:()=>1},
 {id:'sma',g:'avg',name:'SMA',full:'Simple moving average',ps:[nP(50)],outs:[['v','']],kind:'price',run:(F,p)=>({v:SMA(F.c,p.n)}),lb:p=>p.n},
 {id:'ema',g:'avg',name:'EMA',full:'Exponential moving average',ps:[nP(50)],outs:[['v','']],kind:'price',run:(F,p)=>({v:EMA(F.c,p.n)}),lb:p=>3*p.n},
 {id:'wma',g:'avg',name:'WMA',full:'Weighted moving average',ps:[nP(50)],outs:[['v','']],kind:'price',run:(F,p)=>({v:WMA(F.c,p.n)}),lb:p=>p.n},
 {id:'dema',g:'avg',name:'DEMA',full:'Double exponential moving average',ps:[nP(50)],outs:[['v','']],kind:'price',run:(F,p)=>({v:DEMA(F.c,p.n)}),lb:p=>4*p.n},
 {id:'tema',g:'avg',name:'TEMA',full:'Triple exponential moving average',ps:[nP(50)],outs:[['v','']],kind:'price',run:(F,p)=>({v:TEMA(F.c,p.n)}),lb:p=>5*p.n},
 {id:'trima',g:'avg',name:'TRIMA',full:'Triangular moving average',ps:[nP(50)],outs:[['v','']],kind:'price',run:(F,p)=>({v:TRIMA(F.c,p.n)}),lb:p=>p.n},
 {id:'kama',g:'avg',name:'KAMA',full:'Kaufman adaptive moving average',ps:[nP(30)],outs:[['v','']],kind:'price',run:(F,p)=>({v:KAMA(F.c,p.n)}),lb:p=>p.n+60},
 {id:'hma',g:'avg',name:'HMA',full:'Hull moving average',ps:[nP(50,4)],outs:[['v','']],kind:'price',run:(F,p)=>({v:HMA(F.c,p.n)}),lb:p=>p.n+Math.sqrt(p.n)},
 {id:'linreg',g:'avg',name:'Linear regression',full:'Linear regression line (end point)',ps:[nP(50)],outs:[['v','']],kind:'price',run:(F,p)=>({v:LINREG(F.c,p.n)}),lb:p=>p.n},
 {id:'sar',g:'avg',name:'Parabolic SAR',ps:[P('acc','Step',0.02,0.001,1,0),P('max','Maximum',0.2,0.01,1,0)],outs:[['v','']],kind:'price',run:(F,p)=>({v:SAR(F.h,F.l,p.acc,p.max)}),lb:()=>60},
 {id:'bb',g:'band',name:'Bollinger Bands',ps:[nP(20),P('k','Width (std. dev.)',2,0.1,10,0)],outs:[['up','upper'],['mid','middle'],['lo','lower']],kind:'price',mir:{up:'lo',lo:'up'},run:(F,p)=>BB(F.c,p.n,p.k),lb:p=>p.n},
 {id:'don',g:'band',name:'Donchian channel',full:'Donchian channel (previous candles)',ps:[nP(20,1)],outs:[['up','upper'],['lo','lower']],kind:'price',mir:{up:'lo',lo:'up'},run:(F,p)=>({up:PREV(F.h,p.n,true),lo:PREV(F.l,p.n,false)}),lb:p=>p.n+1},
 {id:'kc',g:'band',name:'Keltner channel',full:'Keltner channel (EMA ± ATR)',ps:[nP(20),P('a','ATR period',10,2,500),P('k','Width (× ATR)',2,0.1,10,0)],outs:[['up','upper'],['mid','middle'],['lo','lower']],kind:'price',mir:{up:'lo',lo:'up'},
  run:(F,p)=>{const m=EMA(F.c,p.n),a=ATR(F.h,F.l,F.c,p.a),n=F.c.length,up=nan(n),lo=nan(n);for(let i=0;i<n;i++)if(m[i]===m[i]&&a[i]===a[i]){up[i]=m[i]+p.k*a[i];lo[i]=m[i]-p.k*a[i];}return{up,mid:m,lo};},lb:p=>3*Math.max(p.n,p.a)},
 {id:'rsi',g:'osc',name:'RSI',full:'Relative strength index',ps:[nP(14)],outs:[['v','']],kind:'osc',lv:30,mid:50,lo:0,hi:100,run:(F,p)=>({v:RSI(F.c,p.n)}),lb:p=>5*p.n},
 {id:'stoch',g:'osc',name:'Stochastic',ps:[P('k','%K period',14,2,500),P('ks','%K smoothing',3,1,100),P('d','%D period',3,1,100)],outs:[['k','%K'],['d','%D']],kind:'osc',lv:20,mid:50,lo:0,hi:100,run:(F,p)=>STOCH(F.h,F.l,F.c,p.k,p.ks,p.d),lb:p=>p.k+p.ks+p.d},
 {id:'srsi',g:'osc',name:'Stochastic RSI',ps:[nP(14),P('fk','%K period',14,1,500),P('fd','%D period',3,1,100)],outs:[['k','%K'],['d','%D']],kind:'osc',lv:20,mid:50,lo:0,hi:100,run:(F,p)=>STOCHRSI(F.c,p.n,p.fk,p.fd),lb:p=>5*p.n+p.fk+p.fd},
 {id:'macd',g:'osc',name:'MACD',ps:[P('f','Fast',12,2,500),P('s','Slow',26,3,1000),P('g','Signal',9,1,500)],outs:[['m','line'],['s','signal'],['h','histogram']],kind:'osc',lv:0,mid:0,run:(F,p)=>{const m=MACD(F.c,p.f,p.s,p.g);return{m:m.macd,s:m.sig,h:m.hist};},lb:p=>3*Math.max(p.f,p.s)+p.g},
 {id:'ppo',g:'osc',name:'PPO',full:'Percentage price oscillator',ps:[P('f','Fast',12,2,500),P('s','Slow',26,3,1000)],outs:[['v','']],kind:'osc',lv:0,mid:0,run:(F,p)=>({v:PPO(F.c,p.f,p.s)}),lb:p=>3*Math.max(p.f,p.s)},
 {id:'cci',g:'osc',name:'CCI',full:'Commodity channel index',ps:[nP(20)],outs:[['v','']],kind:'osc',lv:-100,mid:0,run:(F,p)=>({v:CCI(F.h,F.l,F.c,p.n)}),lb:p=>p.n},
 {id:'willr',g:'osc',name:'Williams %R',ps:[nP(14)],outs:[['v','']],kind:'osc',lv:-80,mid:-50,lo:-100,hi:0,run:(F,p)=>({v:WILLR(F.h,F.l,F.c,p.n)}),lb:p=>p.n},
 {id:'cmo',g:'osc',name:'CMO',full:'Chande momentum oscillator',ps:[nP(14)],outs:[['v','']],kind:'osc',lv:-50,mid:0,lo:-100,hi:100,run:(F,p)=>({v:CMO(F.c,p.n)}),lb:p=>5*p.n},
 {id:'roc',g:'osc',name:'ROC',full:'Rate of change (%)',ps:[nP(10,1)],outs:[['v','']],kind:'osc',lv:0,mid:0,run:(F,p)=>({v:ROC(F.c,p.n)}),lb:p=>p.n+1},
 {id:'mom',g:'osc',name:'Momentum',full:'Momentum (price change, pips)',ps:[nP(10,1)],outs:[['v','']],kind:'osc',lv:0,mid:0,run:(F,p)=>({v:MOM(F.c,p.n)}),lb:p=>p.n+1},
 {id:'trix',g:'osc',name:'TRIX',ps:[nP(15,1)],outs:[['v','']],kind:'osc',lv:0,mid:0,run:(F,p)=>({v:TRIX(F.c,p.n)}),lb:p=>9*p.n},
 {id:'ultosc',g:'osc',name:'Ultimate oscillator',ps:[P('a','Short',7,1,500),P('b','Medium',14,1,500),P('c','Long',28,1,500)],outs:[['v','']],kind:'osc',lv:30,mid:50,lo:0,hi:100,run:(F,p)=>({v:ULTOSC(F.h,F.l,F.c,p.a,p.b,p.c)}),lb:p=>Math.max(p.a,p.b,p.c)+1},
 {id:'bop',g:'osc',name:'Balance of power',ps:[],outs:[['v','']],kind:'osc',lv:0,mid:0,lo:-1,hi:1,run:F=>({v:BOP(F.o,F.h,F.l,F.c)}),lb:()=>1},
 {id:'dmi',g:'trend',name:'ADX / DMI',byOut:true,full:'Average directional index with +DI and −DI',ps:[nP(14)],outs:[['adx','ADX'],['p','+DI'],['m','−DI']],kind:'osc',lv:25,mid:null,lo:0,hi:100,ty:'swap',oty:{adx:'abs'},mir:{p:'m',m:'p'},run:(F,p)=>{const d=DMI(F.h,F.l,F.c,p.n);return{adx:d.adx,p:d.pdi,m:d.mdi};},lb:p=>7*p.n},
 {id:'aroon',g:'trend',name:'Aroon',ps:[nP(25)],outs:[['up','up'],['dn','down']],kind:'osc',lv:70,mid:null,lo:0,hi:100,ty:'swap',mir:{up:'dn',dn:'up'},run:(F,p)=>{const a=AROON(F.h,F.l,p.n);return{up:a.up,dn:a.dn};},lb:p=>p.n+1},
 {id:'aroonosc',g:'trend',name:'Aroon oscillator',ps:[nP(25)],outs:[['v','']],kind:'osc',lv:0,mid:0,lo:-100,hi:100,run:(F,p)=>({v:AROON(F.h,F.l,p.n).osc}),lb:p=>p.n+1},
 {id:'atr',g:'vol',name:'ATR',full:'Average true range (pips)',ps:[nP(14,1)],outs:[['v','']],kind:'osc',lv:0,mid:null,ty:'abs',run:(F,p)=>({v:ATR(F.h,F.l,F.c,p.n)}),lb:p=>5*p.n},
 {id:'natr',g:'vol',name:'NATR',full:'Normalised ATR (% of price)',ps:[nP(14,1)],outs:[['v','']],kind:'osc',lv:0,mid:null,ty:'abs',run:(F,p)=>({v:NATR(F.h,F.l,F.c,p.n)}),lb:p=>5*p.n},
 {id:'stddev',g:'vol',name:'Standard deviation',full:'Standard deviation of the close (pips)',ps:[nP(20),P('k','Multiplier',1,0.1,10,0)],outs:[['v','']],kind:'osc',lv:0,mid:null,ty:'abs',run:(F,p)=>({v:STDDEV(F.c,p.n,p.k)}),lb:p=>p.n},
 {id:'slope',g:'vol',name:'Regression slope',full:'Linear regression slope (pips per candle)',ps:[nP(14)],outs:[['v','']],kind:'osc',lv:0,mid:0,run:(F,p)=>({v:LINREG(F.c,p.n,'slope')}),lb:p=>p.n},
 {id:'p_engulf',g:'pat',ps:[],name:'Engulfing',outs:[['v','']],kind:'pat',dirs:['bull','bear'],run:F=>({v:CDL.engulfing(F)}),lb:()=>2},
 {id:'p_harami',g:'pat',ps:[],name:'Harami',outs:[['v','']],kind:'pat',dirs:['bull','bear'],run:F=>({v:CDL.harami(F)}),lb:()=>11},
 {id:'p_hammer',g:'pat',ps:[],name:'Hammer',outs:[['v','']],kind:'pat',dirs:['bull'],mirId:'p_star',run:F=>({v:CDL.hammer(F)}),lb:()=>11},
 {id:'p_star',g:'pat',ps:[],name:'Shooting star',outs:[['v','']],kind:'pat',dirs:['bear'],mirId:'p_hammer',run:F=>({v:CDL.shootingstar(F)}),lb:()=>11},
 {id:'p_morning',g:'pat',ps:[],name:'Morning star',outs:[['v','']],kind:'pat',dirs:['bull'],mirId:'p_evening',run:F=>({v:CDL.morningstar(F)}),lb:()=>12},
 {id:'p_evening',g:'pat',ps:[],name:'Evening star',outs:[['v','']],kind:'pat',dirs:['bear'],mirId:'p_morning',run:F=>({v:CDL.eveningstar(F)}),lb:()=>12},
 {id:'p_soldiers',g:'pat',ps:[],name:'Three white soldiers',outs:[['v','']],kind:'pat',dirs:['bull'],mirId:'p_crows',run:F=>({v:CDL.soldiers(F)}),lb:()=>12},
 {id:'p_crows',g:'pat',ps:[],name:'Three black crows',outs:[['v','']],kind:'pat',dirs:['bear'],mirId:'p_soldiers',run:F=>({v:CDL.crows(F)}),lb:()=>13},
 {id:'p_piercing',g:'pat',ps:[],name:'Piercing line',outs:[['v','']],kind:'pat',dirs:['bull'],mirId:'p_dark',run:F=>({v:CDL.piercing(F)}),lb:()=>11},
 {id:'p_dark',g:'pat',ps:[],name:'Dark cloud cover',outs:[['v','']],kind:'pat',dirs:['bear'],mirId:'p_piercing',run:F=>({v:CDL.darkcloud(F)}),lb:()=>11},
 {id:'p_doji',g:'pat',ps:[],name:'Doji',outs:[['v','']],kind:'pat',dirs:['any'],run:F=>({v:CDL.doji(F)}),lb:()=>10}
];
const byId={};REG.forEach(r=>{byId[r.id]=r;});
const API={REG,byId,CDL,MIROP,mirCond,sellOf,warmOf,signals,SMA,EMA,WMA,DEMA,TEMA,TRIMA,KAMA,HMA,LINREG,SAR,RSI,CMO,ATR,NATR,BB,STDDEV,MACD,PPO,STOCH,STOCHRSI,CCI,WILLR,ROC,MOM,BOP,TRIX,DMI,AROON,ULTOSC,PREV};
if(typeof module!=='undefined')module.exports=API;
return API;
})();
