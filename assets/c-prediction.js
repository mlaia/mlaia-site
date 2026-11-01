/* MLAIA design C, Prediction & Causal Analysis page: the hero forecasting instrument.
   Hook: .c-screen[data-p-forecast] (with a <canvas>) inside [data-c-instrument];
   readouts are [data-p-read="maeN|maeT|cov|maseT|zero|next"] inside the same instrument.

   What it computes (all on synthetic data, deterministic, in the browser):
   - a weekly demand series: a week is zero with probability "intermittency" (the handle),
     otherwise a positive size around a slow yearly level, with lognormal noise;
   - a TSB forecast (Teunter-Syntetos-Babai, a Croston-type method): smoothed demand
     probability times smoothed demand size, one step ahead;
   - a naive forecast: next week = this week;
   - a backtest on the last 26 weeks: MAE for both, MASE for TSB (scaled by the in-sample
     naive error), and how often the actual fell inside TSB's 80% band. The band comes from
     the 10th and 90th percentiles of TSB's errors in the earlier training weeks only.
   Time advances one week every few seconds with a slow slide. Under prefers-reduced-motion
   (or ?still in the URL) it draws one static frame and redraws only when the handle moves.
   It pauses when off-screen or when the tab is hidden. */
(()=>{
'use strict';
const box=document.querySelector('[data-p-forecast]');
if(!box)return;
const cv=box.querySelector('canvas');if(!cv||!cv.getContext)return;
const ctx=cv.getContext('2d');
const root=box.closest('[data-c-instrument]')||box.parentElement;
const R={};root.querySelectorAll('[data-p-read]').forEach(n=>{R[n.dataset.pRead]=n;});
const mq=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
let reduce=mq.matches||/[?&]still\b/.test(location.search);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const TAU=Math.PI*2;

/* ---------- model constants ---------- */
const TRAIN=104,BT=26,HZ=12,WARM=13,AZ=0.2,AP=0.1,QLO=0.1,QHI=0.9;
const STEP_S=2.8,SLIDE_S=1.1;

/* Deterministic per-week random numbers: the same week always gets the same draws,
   so moving the handle changes which weeks are zero smoothly instead of reshuffling. */
function hash(t,k){let x=(Math.imul(t|0,374761393)+Math.imul(k,668265263))|0;
  x=Math.imul(x^(x>>>13),1274126177);x^=x>>>16;return (x>>>0)/4294967296;}
function gauss(t){const u1=hash(t,1)+1e-9,u2=hash(t,2);return Math.sqrt(-2*Math.log(u1))*Math.cos(TAU*u2);}
function demand(t,pz){
  if(hash(t,3)<pz)return 0;
  const level=7*(1+0.3*Math.sin(TAU*t/52));
  return Math.max(1,Math.round(level*Math.exp(0.45*gauss(t)-0.1)));
}
function quantile(sorted,q){if(!sorted.length)return 0;const p=(sorted.length-1)*q,i=Math.floor(p),f=p-i;
  return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*f;}

function compute(T,pz){
  const n=TRAIN+BT,s=T-n,y=new Float64Array(n),f=new Float64Array(n);
  for(let i=0;i<n;i++)y[i]=demand(s+i,pz);
  let k=0,sum=0;for(let i=0;i<WARM;i++)if(y[i]>0){k++;sum+=y[i];}
  let p=Math.max(0.05,k/WARM),z=k?sum/k:1;
  for(let i=0;i<WARM;i++)f[i]=NaN;
  for(let i=WARM;i<n;i++){f[i]=p*z;const v=y[i];if(v>0){z+=AZ*(v-z);p+=AP*(1-p);}else p+=AP*(0-p);}
  const res=[];for(let i=WARM;i<TRAIN;i++)res.push(y[i]-f[i]);res.sort((a,b)=>a-b);
  const qlo=quantile(res,QLO),qhi=quantile(res,QHI);
  let sc=0;for(let i=1;i<TRAIN;i++)sc+=Math.abs(y[i]-y[i-1]);sc/=TRAIN-1;
  let eN=0,eT=0,cov=0;
  for(let i=TRAIN;i<n;i++){
    eN+=Math.abs(y[i]-y[i-1]);eT+=Math.abs(y[i]-f[i]);
    const lo=Math.max(0,f[i]+qlo),hi=f[i]+qhi;if(y[i]>=lo-1e-9&&y[i]<=hi+1e-9)cov++;
  }
  let zeros=0;for(let i=0;i<n;i++)if(y[i]===0)zeros++;
  const next=p*z;
  return{s,n,y,f,qlo,qhi,next,lo:Math.max(0,next+qlo),hi:next+qhi,last:y[n-1],
    maeN:eN/BT,maeT:eT/BT,maseT:sc>0?(eT/BT)/sc:NaN,cov:cov/BT,zero:zeros/n};
}

/* ---------- state ---------- */
const it={T:1000,pz:0.5,m:null,shift:0,slideT:1,acc:0,frames:0,visible:!('IntersectionObserver' in window),
  dpr:1,cssW:0,cssH:0,disp:new Map(),band:null,ymax:null};
function recompute(){it.m=compute(it.T,it.pz);readouts();}
const fmt2=x=>isFinite(x)?x.toFixed(2):'–';
function readouts(){
  const m=it.m;
  if(R.maeN)R.maeN.textContent=fmt2(m.maeN);
  if(R.maeT)R.maeT.textContent=fmt2(m.maeT);
  if(R.cov)R.cov.textContent=Math.round(m.cov*100)+'%';
  if(R.maseT)R.maseT.textContent=fmt2(m.maseT);
  if(R.zero)R.zero.textContent=Math.round(m.zero*100)+'%';
  if(R.next)R.next.textContent=m.next.toFixed(1);
}

/* ---------- handle: same look and slider semantics as the shared design-C handles ---------- */
const LO=0.05,HI=0.9;
let hv=clamp(+box.dataset.value||0.5,LO,HI),drag=false,hintRaf=0,interacted=false;
const h=document.createElement('div');
h.className='c-handle c-handle--x';h.tabIndex=0;h.setAttribute('role','slider');
h.setAttribute('aria-orientation','horizontal');
h.setAttribute('aria-label','Share of weeks with zero demand (intermittency)');
h.setAttribute('aria-valuemin',String(Math.round(LO*100)));h.setAttribute('aria-valuemax',String(Math.round(HI*100)));
h.innerHTML='<span class="c-handle__line"></span><span class="c-handle__grip"></span><span class="c-handle__chip" aria-hidden="true"></span>';
box.append(h);const chip=h.querySelector('.c-handle__chip');
function renderHandle(){
  h.style.left=(hv*100)+'%';chip.style.transform='translateX('+(-hv*100)+'%)';
  const pc=Math.round(hv*100);
  chip.textContent='◀ drag ▶  zero-demand weeks '+pc+'%';
  h.setAttribute('aria-valuenow',String(pc));
  h.setAttribute('aria-valuetext',pc+'% chance that a week has zero demand');
}
function setHandle(v,user){
  hv=clamp(v,LO,HI);renderHandle();it.pz=hv;recompute();
  if(user){interacted=true;stopHint();}
  if(reduce||!loopOn())draw(true);
}
const xOf=e=>{const r=box.getBoundingClientRect();return (e.clientX-r.left)/r.width;};
box.addEventListener('pointerdown',e=>{
  if(e.button>0)return;drag=true;try{box.setPointerCapture(e.pointerId);}catch{}
  setHandle(xOf(e),true);if(e.pointerType!=='touch')h.focus({preventScroll:true});
});
box.addEventListener('pointermove',e=>{if(drag)setHandle(xOf(e),true);});
const end=()=>{drag=false;};
box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);box.addEventListener('lostpointercapture',end);
h.addEventListener('keydown',e=>{
  const s=0.05,map={ArrowRight:s,ArrowUp:s,ArrowLeft:-s,ArrowDown:-s,PageUp:s*3,PageDown:-s*3};
  if(e.key in map){setHandle(hv+map[e.key],true);e.preventDefault();}
  else if(e.key==='Home'){setHandle(LO,true);e.preventDefault();}
  else if(e.key==='End'){setHandle(HI,true);e.preventDefault();}
});
/* One-time slow "show me" glide, as on the other design-C instruments. */
function hint(){
  if(reduce||interacted||hintRaf)return;
  const v0=hv,amp=0.22,dur=3200;let t0=0;
  const stepH=now=>{
    if(interacted||reduce){hintRaf=0;return;}
    if(!t0)t0=now;const p=Math.min(1,(now-t0)/dur);
    const e=0.5-0.5*Math.cos(Math.PI*p),path=Math.sin(TAU*e)*(e<0.5?amp:amp*0.5);
    hv=clamp(v0+path,LO,HI);renderHandle();it.pz=hv;recompute();
    hintRaf=p<1?requestAnimationFrame(stepH):0;
  };
  hintRaf=requestAnimationFrame(stepH);
}
function stopHint(){if(hintRaf){cancelAnimationFrame(hintRaf);hintRaf=0;}}

/* ---------- drawing ---------- */
function cssVar(name,fb){const v=getComputedStyle(box).getPropertyValue(name).trim();return v||fb;}
let C={};
function readColors(){C={a:cssVar('--c-amber','#ffb547'),b:cssVar('--c-blue','#71d4ff'),fg:cssVar('--c-fg','#eceee9'),
  muted:cssVar('--c-muted','#9ca39d'),mono:cssVar('--c-mono','monospace')};}
function fit(){
  const r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);
  it.dpr=d;it.cssW=r.width;it.cssH=r.height;
  const w=Math.max(1,Math.round(r.width*d)),hh=Math.max(1,Math.round(r.height*d));
  if(cv.width!==w||cv.height!==hh){cv.width=w;cv.height=hh;}
}
const ease=(cur,target,k)=>cur==null||!isFinite(cur)?target:cur+(target-cur)*k;
function draw(snap,dt=0){
  const m=it.m;if(!m)return;
  const W=cv.width,H=cv.height,d=it.dpr;if(W<4||H<4)return;
  const k=snap||reduce?1:1-Math.exp(-dt/0.28);
  const narrow=it.cssW<640,VH=narrow?44:78,cols=VH+HZ;
  const top=16*d,bot=30*d,ph=H-top-bot,cw=W/cols;
  const T=it.T,first=T-VH-1;
  const col=t=>(t-first-1)+it.shift; // column index (can be fractional while sliding)
  // targets per absolute week
  const tgt=t=>{const i=t-m.s;if(i<0||i>=m.n)return null;
    const f=m.f[i];return{y:m.y[i],f,lo:isFinite(f)?Math.max(0,f+m.qlo):NaN,hi:isFinite(f)?f+m.qhi:NaN,nv:i>0?m.y[i-1]:m.y[i]};};
  const disp=it.disp;
  for(const key of disp.keys())if(key<first-2||key>=T)disp.delete(key);
  for(let t=first-1;t<T;t++){const g=tgt(t);if(!g)continue;let o=disp.get(t);
    if(!o){o={...g};disp.set(t,o);}else{o.y=ease(o.y,g.y,k);o.f=ease(o.f,g.f,k);o.lo=ease(o.lo,g.lo,k);o.hi=ease(o.hi,g.hi,k);o.nv=ease(o.nv,g.nv,k);}}
  const b=it.band||{};it.band={f:ease(b.f,m.next,k),lo:ease(b.lo,m.lo,k),hi:ease(b.hi,m.hi,k),nv:ease(b.nv,m.last,k)};
  let ymx=4;for(let t=first;t<T;t++){const o=disp.get(t);if(o){ymx=Math.max(ymx,o.y,isFinite(o.hi)?o.hi:0);}}
  ymx=Math.max(ymx,it.band.hi);it.ymax=ease(it.ymax,ymx*1.08,snap||reduce?1:1-Math.exp(-dt/0.6));
  const Y=v=>top+ph-(v/it.ymax)*ph;
  ctx.clearRect(0,0,W,H);
  // regions
  const xBt=col(T-BT)*cw,xNow=col(T)*cw;
  ctx.fillStyle='rgba(236,238,233,.035)';ctx.fillRect(xBt,0,xNow-xBt,H);
  ctx.fillStyle='rgba(113,212,255,.045)';ctx.fillRect(xNow,0,W-xNow,H);
  // baseline and gridlines
  ctx.strokeStyle='rgba(236,238,233,.08)';ctx.lineWidth=1;ctx.beginPath();
  for(let g=1;g<=3;g++){const yy=Math.round(top+ph*g/4)+.5;ctx.moveTo(0,yy);ctx.lineTo(W,yy);}ctx.stroke();
  ctx.strokeStyle='rgba(236,238,233,.3)';ctx.beginPath();ctx.moveTo(0,Math.round(top+ph)+.5);ctx.lineTo(W,Math.round(top+ph)+.5);ctx.stroke();
  // dividers
  ctx.setLineDash([3*d,4*d]);ctx.strokeStyle='rgba(236,238,233,.35)';ctx.beginPath();
  ctx.moveTo(Math.round(xBt)+.5,0);ctx.lineTo(Math.round(xBt)+.5,top+ph+bot);
  ctx.moveTo(Math.round(xNow)+.5,0);ctx.lineTo(Math.round(xNow)+.5,top+ph+bot);ctx.stroke();ctx.setLineDash([]);
  // region labels along the time axis
  ctx.font=(11*d)+'px '+C.mono;ctx.textBaseline='alphabetic';ctx.fillStyle=C.muted;ctx.textAlign='left';
  const ly=top+ph+19*d;
  if(!narrow){const tw=ctx.measureText('← history').width;ctx.fillText('← history',Math.max(6*d,xBt-10*d-tw),ly);}
  ctx.fillText(narrow?'backtest 26 wk':'backtest · last 26 wk',xBt+6*d,ly);
  ctx.fillStyle=C.b;ctx.fillText(narrow?'forecast':'forecast · 12 wk →',xNow+6*d,ly);
  // band: backtest (week by week) and forecast (flat)
  ctx.fillStyle='rgba(113,212,255,.17)';
  for(let t=T-BT;t<T;t++){const o=disp.get(t);if(!o||!isFinite(o.lo))continue;const x0=col(t)*cw;
    ctx.fillRect(x0,Y(o.hi),cw+0.5,Y(o.lo)-Y(o.hi));}
  const bd=it.band;ctx.fillRect(xNow,Y(bd.hi),W-xNow,Y(bd.lo)-Y(bd.hi));
  // demand bars (observed)
  ctx.fillStyle=C.a;const bw=Math.max(1.5*d,cw*0.58);
  for(let t=first;t<T;t++){const o=disp.get(t);if(!o)continue;const x=col(t)*cw+(cw-bw)/2;
    if(x+bw<0||x>W)continue;const yv=Y(o.y);if(o.y>0.02)ctx.fillRect(x,yv,bw,top+ph-yv);}
  // naive forecast: dashed grey steps across backtest, then flat
  ctx.strokeStyle=C.muted;ctx.lineWidth=1.4*d;ctx.setLineDash([5*d,4*d]);ctx.beginPath();
  for(let t=T-BT;t<T;t++){const o=disp.get(t);if(!o)continue;const x0=col(t)*cw,yy=Y(o.nv);
    t===T-BT?ctx.moveTo(x0,yy):ctx.lineTo(x0,yy);ctx.lineTo(x0+cw,yy);}
  ctx.lineTo(xNow,Y(bd.nv));ctx.lineTo(W,Y(bd.nv));ctx.stroke();ctx.setLineDash([]);
  // TSB forecast: blue line through the backtest, then flat ahead
  ctx.strokeStyle=C.b;ctx.lineJoin='round';
  const tsb=lw=>{ctx.lineWidth=lw*d;ctx.beginPath();let started=false;
    for(let t=first;t<T;t++){const o=disp.get(t);if(!o||!isFinite(o.f))continue;const x=col(t)*cw+cw/2,yy=Y(o.f);
      started?ctx.lineTo(x,yy):ctx.moveTo(x,yy);started=true;}
    ctx.lineTo(xNow,Y(bd.f));ctx.lineTo(W,Y(bd.f));ctx.stroke();};
  ctx.globalAlpha=.18;tsb(7);ctx.globalAlpha=1;tsb(2.2);
  it.frames++;
}

/* ---------- loop ---------- */
let raf=0,last=0,hinted=false;
const loopOn=()=>!!raf;
function tick(now){
  raf=0;const dt=last?Math.min(0.05,(now-last)/1000):1/60;last=now;
  it.acc+=dt;
  if(it.acc>=STEP_S){it.acc=0;it.T++;recompute();it.shift=1;it.slideT=0;}
  if(it.slideT<1){it.slideT=Math.min(1,it.slideT+dt/SLIDE_S);const e=0.5-0.5*Math.cos(Math.PI*it.slideT);it.shift=1-e;}
  draw(false,dt);
  if(it.visible&&!document.hidden&&!reduce)raf=requestAnimationFrame(tick);else last=0;
}
function wake(){if(!raf&&!reduce&&!document.hidden&&it.visible){last=0;raf=requestAnimationFrame(tick);}}
function sleep(){if(raf){cancelAnimationFrame(raf);raf=0;last=0;}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)sleep();else wake();});
const onMotion=()=>{reduce=mq.matches||/[?&]still\b/.test(location.search);if(reduce){sleep();stopHint();it.shift=0;it.slideT=1;draw(true);}else wake();};
if(mq.addEventListener)mq.addEventListener('change',onMotion);else if(mq.addListener)mq.addListener(onMotion);
if('IntersectionObserver' in window){
  new IntersectionObserver(es=>{for(const e of es){it.visible=e.isIntersecting;}
    if(it.visible){draw(true);if(!hinted&&box.hasAttribute('data-hint')){hinted=true;setTimeout(()=>{if(it.visible)hint();},1500);}wake();}
    else sleep();
  },{rootMargin:'80px 0px'}).observe(cv);
}
if('ResizeObserver' in window)new ResizeObserver(()=>{fit();readColors();it.disp.clear();it.band=null;it.ymax=null;draw(true);}).observe(cv);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>draw(true));

readColors();fit();it.pz=hv;renderHandle();recompute();draw(true);wake();
window.MLAIAPred={get running(){return !!raf;},get frames(){return it.frames;},get week(){return it.T;},
  get metrics(){return it.m;},get reducedMotion(){return reduce;}};
})();
