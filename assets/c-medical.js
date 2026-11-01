/* MLAIA design C, Medical AI page: live heart-rate validation demo.
   A synthetic ECG with a known true heart rate, plus a draggable amount of motion artifact.
   A simple QRS detector (zero-phase 5-15 Hz band-pass, derivative, squaring, 150 ms moving
   window, local adaptive threshold, 250 ms refractory) runs on the noisy signal; its beats are
   matched to the true beats (within 100 ms) and its heart rate is compared with the true one.
   The check fails if the rate is off by more than 5 bpm, or if more than one beat is false or
   missed: with heavy artifact the errors can cancel and the average looks right by luck.
   Synthetic signal, illustrative; not a medical device.
   Hook: <div class="c-screen" data-m-ecg> with a canvas, inside [data-c-instrument] that holds
   [data-m-read="true|est|err|beats|fpfn|check"] readouts. Self-contained (does not depend on
   mlaia-c.js), same behaviour contract: one rAF loop, pauses off-screen and in hidden tabs,
   a static frame under prefers-reduced-motion (or ?still) that redraws on input. */
(()=>{
'use strict';
const TAU=Math.PI*2,FS=250,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

/* ---------- the synthetic signal: deterministic in absolute time ---------- */
function hash(n){n=(n|0)^0x9e3779b9;n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);n^=n>>>16;return (n>>>0)/4294967296;}
function gauss(n){const u=hash(2*n)+1e-9,v=hash(2*n+1);return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v);}
// true heart rate (bpm) drifts slowly between about 64 and 80
const HR=t=>72+6*Math.sin(TAU*t/37)+2*Math.sin(TAU*t/11);
const phi=t=>72/60*t+6/60*37/TAU*(1-Math.cos(TAU*t/37))+2/60*11/TAU*(1-Math.cos(TAU*t/11));
function beatTime(k){let t=k/1.2;for(let i=0;i<4;i++)t-=(phi(t)-k)/(HR(t)/60);return t;}
// P, Q, R, S, T as Gaussians around the R peak: [centre s, amplitude mV, width s]
const WAVES=[[-0.17,0.11,0.022],[-0.028,-0.13,0.009],[0,1.05,0.010],[0.026,-0.28,0.010],[0.25,0.32,0.04]];
function tpl(d){let v=0;for(const [c,a,w] of WAVES){const z=(d-c)/w;if(z>-6&&z<6)v+=a*Math.exp(-0.5*z*z);}return v;}
function ecg(t){const p=phi(t),k=Math.floor(p),f=p-k,r=HR(t)/60;return tpl(f/r)+tpl(-(1-f)/r);}
// motion artifact of size a (mV): baseline wander, muscle noise and movement bursts.
// Each burst slot has a fixed random draw, so more artifact only ever adds bursts.
const SLOT=1.1;
function artifact(n,a){
  if(a<=0)return 0;
  const t=n/FS;let v=a*0.3*(Math.sin(TAU*0.22*t)+0.6*Math.sin(TAU*0.47*t+1.3))+a*0.06*gauss(n);
  const p=Math.min(0.9,a*0.6),k=Math.floor(t/SLOT);
  for(let j=k-1;j<=k;j++){
    const h=j*7+11;if(hash(h)>=p)continue;
    const s=j*SLOT+hash(h+1)*SLOT*0.7,tau=t-s;if(tau<0||tau>0.7)continue;
    const f=4+5*hash(h+2),amp=a*(0.7+0.8*hash(h+3))*(hash(h+4)<0.5?-1:1);
    v+=amp*Math.exp(-tau/0.13)*Math.sin(TAU*f*tau)*(1-Math.exp(-tau/0.01));
  }
  return v;
}

/* ---------- the detector ---------- */
function biquad(type,fc){const w=TAU*fc/FS,cw=Math.cos(w),al=Math.sin(w)/Math.SQRT2,a0=1+al;
  const b=type==='lp'?[(1-cw)/2,1-cw,(1-cw)/2]:[(1+cw)/2,-(1+cw),(1+cw)/2];
  return [b[0]/a0,b[1]/a0,b[2]/a0,-2*cw/a0,(1-al)/a0];}
const HP=biquad('hp',5),LP=biquad('lp',15);
function filt(q,x,rev){const n=x.length,y=new Float64Array(n);let x1=0,x2=0,y1=0,y2=0;
  for(let k=0;k<n;k++){const i=rev?n-1-k:k,v=x[i],o=q[0]*v+q[1]*x1+q[2]*x2-q[3]*y1-q[4]*y2;x2=x1;x1=v;y2=y1;y1=o;y[i]=o;}return y;}
function winMax(x,K){ // max over [i-K, i+K]
  const n=x.length,out=new Float64Array(n),dq=new Int32Array(n);let h=0,t=0;
  for(let j=0;j<n+K;j++){
    if(j<n){while(t>h&&x[dq[t-1]]<=x[j])t--;dq[t++]=j;}
    const i=j-K;if(i<0)continue;while(dq[h]<i-K)h++;out[i]=x[dq[h]];
  }
  return out;
}
const BACK=2.5,AHEAD=2.5,TOL=0.1,REFR=Math.round(0.25*FS),CTX=Math.round(1.5*FS),MWI=Math.round(0.15*FS)|1;
/* Analyse the W seconds ending at tEnd with artifact a. Everything is a local function of the
   signal around each sample, so a beat is detected the same way in every frame (no flicker). */
function analyze(tEnd,a,W){
  const n0=Math.floor((tEnd-W-BACK)*FS),n1=Math.ceil((tEnd+AHEAD)*FS),N=n1-n0+1;
  const x=new Float64Array(N);
  for(let i=0;i<N;i++){const n=n0+i;x[i]=ecg(n/FS)+artifact(n,a);}
  // zero-phase band-pass: high-pass then low-pass, forward and backward
  let y=filt(HP,x,false);y=filt(LP,y,false);y=filt(LP,y,true);y=filt(HP,y,true);
  const e=new Float64Array(N);for(let i=1;i<N-1;i++){const d=(y[i+1]-y[i-1])*FS/2;e[i]=d*d;}
  const m=new Float64Array(N),hw=MWI>>1;let acc=0;
  for(let i=0;i<N+hw;i++){if(i<N)acc+=e[i];if(i-MWI>=0)acc-=e[i-MWI];const c=i-hw;if(c>=0&&c<N)m[c]=acc/MWI;}
  const big=winMax(m,CTX),loc=winMax(m,REFR),thr=new Float64Array(N);
  for(let i=0;i<N;i++)thr[i]=0.3*big[i];
  const det=[],lo=Math.round(1.2*FS),hi=N-Math.round(1.6*FS);
  for(let i=lo;i<hi;i++){
    if(m[i]>=thr[i]&&m[i]===loc[i]&&m[i]>m[i-1]&&m[i]>1e-6){
      let b=i,bv=-1;for(let j=i-15;j<=i+15;j++){const v=Math.abs(y[j]);if(v>bv){bv=v;b=j;}}
      det.push({t:(n0+b)/FS,ok:false});
    }
  }
  const beats=[];for(let k=Math.ceil(phi(tEnd-W-1));k<=Math.floor(phi(tEnd+1));k++)beats.push({t:beatTime(k),hit:null});
  for(const bt of beats){let best=null,bd=TOL;for(const d of det){if(d.ok)continue;const dd=Math.abs(d.t-bt.t);if(dd<=bd){bd=dd;best=d;}}
    if(best){best.ok=true;best.of=bt;bt.hit=best;}}
  const t0=tEnd-W,inWin=t=>t>=t0&&t<tEnd;
  const tb=beats.filter(b=>inWin(b.t)),td=det.filter(d=>inWin(d.ok?d.of.t:d.t));
  const rate=ts=>ts.length<2?null:60*(ts.length-1)/(ts[ts.length-1]-ts[0]);
  const trueHR=rate(tb.map(b=>b.t)),estHR=rate(td.map(d=>d.t));
  return {n0,x,m,thr,det,beats,trueHR,estHR,
    actual:tb.length,detected:td.length,fp:td.filter(d=>!d.ok).length,fn:tb.filter(b=>!b.hit).length};
}
const Core={FS,HR,ecg,artifact,analyze,beatTime};
if(typeof module==='object'&&module.exports)module.exports=Core;
if(typeof window==='undefined')return;

/* ---------- browser: scheduler, handle, drawing ---------- */
const mq=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
let reduce=mq.matches||/[?&]still\b/.test(location.search);
const A_MAX=2,TOLBPM=5,SPEED=0.6;// signal seconds per second of wall time
const fmt1=v=>v==null?'–':v.toFixed(1),sgn=v=>(v>0.05?'+':v<-0.05?'−':'±')+Math.abs(v).toFixed(1);

function Ecg(box){
  const cv=box.querySelector('canvas'),ctx=cv.getContext('2d');
  const root=box.closest('[data-c-instrument]')||box.parentElement,R={};
  root.querySelectorAll('[data-m-read]').forEach(n=>R[n.dataset.mRead]=n);
  const cs=getComputedStyle(box),col={a:cs.getPropertyValue('--c-amber').trim()||'#ffb547',b:cs.getPropertyValue('--c-blue').trim()||'#71d4ff',fg:cs.getPropertyValue('--c-fg').trim()||'#eceee9',mu:cs.getPropertyValue('--c-muted').trim()||'#9ca39d'};
  const it={cv,box,t:20,a:0,target:0,readT:9,frames:0,visible:!('IntersectionObserver' in window),dpr:1,cssW:0,cssH:0,last:null};
  /* visible handle with slider semantics (same markup and styling as mlaia-c.js handles) */
  let v=clamp(+box.dataset.value||0.2),drag=false,hintRaf=0,interacted=false;
  const el=document.createElement('div');
  el.className='c-handle c-handle--x';el.tabIndex=0;el.setAttribute('role','slider');el.setAttribute('aria-orientation','horizontal');
  el.setAttribute('aria-label','Motion artifact added to the synthetic ECG');el.setAttribute('aria-valuemin','0');el.setAttribute('aria-valuemax',String(A_MAX));
  el.innerHTML='<span class="c-handle__line"></span><span class="c-handle__grip"></span><span class="c-handle__chip" aria-hidden="true"></span>';
  box.append(el);const chip=el.querySelector('.c-handle__chip');
  const toA=v=>Math.round(v*A_MAX*20)/20;
  function render(){el.style.left=(v*100)+'%';chip.style.transform='translateX('+(-v*100)+'%)';
    const s=toA(v).toFixed(2);chip.textContent='◀ drag ▶  motion artifact '+s+' mV';
    el.setAttribute('aria-valuenow',s);el.setAttribute('aria-valuetext','motion artifact '+s+' millivolts');}
  function set(nv,user){v=clamp(nv);render();it.target=v*A_MAX;it.readT=9;
    if(user){interacted=true;stopHint();}
    if(reduce||!raf){it.a=it.target;it.draw();}if(!reduce)wake();}
  const fromEvent=e=>{const r=box.getBoundingClientRect();return (e.clientX-r.left)/r.width;};
  box.addEventListener('pointerdown',e=>{if(e.button>0)return;drag=true;try{box.setPointerCapture(e.pointerId);}catch{}set(fromEvent(e),true);if(e.pointerType!=='touch')el.focus({preventScroll:true});});
  box.addEventListener('pointermove',e=>{if(drag)set(fromEvent(e),true);});
  const end=()=>{drag=false;};['pointerup','pointercancel','lostpointercapture'].forEach(t=>box.addEventListener(t,end));
  el.addEventListener('keydown',e=>{const s=0.025,map={ArrowRight:s,ArrowUp:s,ArrowLeft:-s,ArrowDown:-s,PageUp:s*5,PageDown:-s*5};
    if(e.key in map){set(v+map[e.key],true);e.preventDefault();}
    else if(e.key==='Home'){set(0,true);e.preventDefault();}else if(e.key==='End'){set(1,true);e.preventDefault();}});
  function hint(){ // one slow glide out to heavy artifact and back, once, unless the visitor got there first
    if(reduce||interacted||hintRaf)return;const v0=v,amp=0.5,dur=4200;let t0=0;
    const step=now=>{if(interacted||reduce){hintRaf=0;return;}if(!t0)t0=now;const p=Math.min(1,(now-t0)/dur);
      v=clamp(v0+amp*Math.sin(Math.PI*(0.5-0.5*Math.cos(Math.PI*p))));render();it.target=v*A_MAX;it.readT=Math.max(it.readT,0.3);
      hintRaf=p<1?requestAnimationFrame(step):0;};
    hintRaf=requestAnimationFrame(step);}
  function stopHint(){if(hintRaf){cancelAnimationFrame(hintRaf);hintRaf=0;}}
  render();it.target=it.a=v*A_MAX;
  it.onVisible=()=>{if(!it.hinted&&box.hasAttribute('data-hint')){it.hinted=true;setTimeout(()=>{if(it.visible)hint();},1500);}};

  it.step=dt=>{it.t+=dt*SPEED;it.a+=(it.target-it.a)*(1-Math.exp(-dt/0.2));it.readT+=dt;};
  it.draw=()=>{
    const W=cv.width,H=cv.height,d=it.dpr,cw=it.cssW;if(W<4||H<4)return;
    const span=cw<700?6:8,res=analyze(it.t,it.a,span);it.last=res;
    const t0=it.t-span,X=t=>(t-t0)/span*W;
    ctx.clearRect(0,0,W,H);
    const yc=H*0.39,mv=H*0.19,top=H*0.08,bot=H*0.62,yT=H*0.695,yD=H*0.775,eT=H*0.84,eB=H*0.965;
    ctx.font=(10*d)+'px "Martian Mono",ui-monospace,monospace';ctx.textBaseline='middle';
    // ECG lane: 1 mV scale bar and baseline
    ctx.strokeStyle='rgba(236,238,233,.10)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,yc);ctx.lineTo(W,yc);ctx.stroke();
    // detections as faint vertical guides through the ECG
    for(const q of res.det){const x=X(q.t);if(x<-4||x>W+4)continue;ctx.strokeStyle=col.b;ctx.globalAlpha=q.ok?.22:.5;ctx.lineWidth=(q.ok?1:1.5)*d;
      ctx.setLineDash(q.ok?[]:[4*d,4*d]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,yD+6*d);ctx.stroke();}
    ctx.setLineDash([]);ctx.globalAlpha=1;
    // raw noisy ECG in amber, clipped to its lane
    ctx.save();ctx.beginPath();ctx.rect(0,top,W,bot-top);ctx.clip();
    const s0=Math.floor(t0*FS)-1,s1=Math.ceil(it.t*FS)+1;
    const line=(lw,al)=>{ctx.globalAlpha=al;ctx.strokeStyle=col.a;ctx.lineWidth=lw*d;ctx.lineJoin='round';ctx.beginPath();
      for(let n=s0;n<=s1;n++){const i=n-res.n0,xx=X(n/FS),yy=yc-res.x[i]*mv;n===s0?ctx.moveTo(xx,yy):ctx.lineTo(xx,yy);}ctx.stroke();};
    line(4,.12);line(1.4,.95);ctx.globalAlpha=1;ctx.restore();
    // beat lanes: true beats (white) and detected beats (blue); misses and false beats labelled
    const tick=(x,y,c,hollow)=>{ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=1.5*d;
      if(hollow){ctx.setLineDash([2*d,2*d]);ctx.strokeRect(x-4*d,y-6*d,8*d,12*d);ctx.setLineDash([]);}else ctx.fillRect(x-1.5*d,y-6*d,3*d,12*d);};
    let lastLab=-1e9;const lab=(x,y,txt,c)=>{if(x-lastLab<58*d||x>W-110*d)return;lastLab=x;ctx.fillStyle=c;ctx.fillText(txt,x+7*d,y);};
    const marks=[];
    for(const b of res.beats){const x=X(b.t);if(x<-4||x>W+4)continue;tick(x,yT,col.fg,false);if(!b.hit)marks.push([x,'missed',col.fg,true]);}
    for(const q of res.det){const x=X(q.t);if(x<-4||x>W+4)continue;if(q.ok)tick(x,yD,col.b,false);else marks.push([x,'false',col.b,false]);}
    marks.sort((p,q)=>p[0]-q[0]);
    for(const [x,txt,c,miss] of marks){tick(x,yD,c,miss);if(!miss){ctx.beginPath();ctx.arc(x,yD-11*d,3*d,0,TAU);ctx.fill();}lab(x,yD,txt,c);}
    // detector energy and its threshold, compressed so a clean beat reaches about two thirds
    const ref=170,cmp=v=>clamp(Math.sqrt(v/ref)*0.66,0,1.15),Y=v=>eB-cmp(v)*(eB-eT);
    ctx.strokeStyle=col.b;ctx.globalAlpha=.85;ctx.lineWidth=1.2*d;ctx.beginPath();
    for(let n=s0;n<=s1;n+=2){const i=n-res.n0,xx=X(n/FS),yy=Y(res.m[i]);n===s0?ctx.moveTo(xx,yy):ctx.lineTo(xx,yy);}ctx.stroke();
    ctx.strokeStyle=col.fg;ctx.globalAlpha=.55;ctx.setLineDash([5*d,4*d]);ctx.beginPath();
    for(let n=s0;n<=s1;n+=4){const i=n-res.n0,xx=X(n/FS),yy=Y(res.thr[i]);n===s0?ctx.moveTo(xx,yy):ctx.lineTo(xx,yy);}ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;
    // lane labels, on a dark chip so the trace never hides them
    // (right-aligned, so they stay clear of the handle at its usual low-artifact positions)
    const tag=(y,txt,c)=>{const w=ctx.measureText(txt).width+10*d,x=W-8*d-w;ctx.fillStyle='rgba(7,9,8,.82)';ctx.fillRect(x,y-8*d,w,16*d);ctx.fillStyle=c;ctx.fillText(txt,x+5*d,y);};
    tag(yT,'true beats',col.fg);tag(yD,'detected',col.b);tag(eT+2*d,'detector energy · threshold',col.mu);
    // one-second scale under the ECG lane
    ctx.strokeStyle=col.mu;ctx.lineWidth=1*d;ctx.beginPath();ctx.moveTo(W-12*d-W/span,bot-6*d);ctx.lineTo(W-12*d,bot-6*d);ctx.stroke();
    ctx.fillStyle=col.mu;ctx.textAlign='right';ctx.fillText('1 s',W-12*d,bot-16*d);ctx.textAlign='left';
    if(it.readT>=0.5||reduce){it.readT=0;readouts(res);}
  };
  function readouts(r){
    const err=r.estHR==null||r.trueHR==null?null:r.estHR-r.trueHR,rateOk=err!=null&&Math.abs(err)<=TOLBPM,beatsOk=r.fp+r.fn<=1,ok=rateOk&&beatsOk;
    if(R.true)R.true.textContent=fmt1(r.trueHR);
    if(R.est)R.est.textContent=fmt1(r.estHR);
    if(R.err)R.err.textContent=err==null?'–':sgn(err)+' bpm';
    if(R.beats)R.beats.textContent=r.detected+' / '+r.actual;
    if(R.fpfn)R.fpfn.textContent=r.fp+' · '+r.fn;
    if(R.check){R.check.textContent=ok?'pass':rateOk?'fail: beats':'fail: rate';R.check.closest('div').classList.toggle('m-fail',!ok);}
  }
  it.handle={get value(){return v;},set,hint};
  return it;
}

/* scheduler */
const insts=[];let raf=0,lastNow=0;
function fit(it){const r=it.cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
  it.dpr=d;it.cssW=r.width;it.cssH=r.height;if(it.cv.width!==w||it.cv.height!==h){it.cv.width=w;it.cv.height=h;return true;}return false;}
function tick(now){raf=0;const dt=lastNow?Math.min(0.05,(now-lastNow)/1000):1/60;lastNow=now;let any=false;
  for(const it of insts)if(it.visible){it.step(dt);it.draw();it.frames++;any=true;}
  if(any&&!document.hidden&&!reduce)raf=requestAnimationFrame(tick);else lastNow=0;}
function wake(){if(!raf&&!reduce&&!document.hidden&&insts.some(i=>i.visible)){lastNow=0;raf=requestAnimationFrame(tick);}}
function sleep(){if(raf){cancelAnimationFrame(raf);raf=0;lastNow=0;}}
const io='IntersectionObserver' in window?new IntersectionObserver(es=>{for(const e of es){const it=e.target.__mInst;if(!it)continue;it.visible=e.isIntersecting;
  if(it.visible){if(reduce)it.draw();it.onVisible();}}wake();},{rootMargin:'80px 0px'}):null;
const ro='ResizeObserver' in window?new ResizeObserver(es=>{for(const e of es){const it=e.target.__mInst;if(it&&fit(it))it.draw();}}):null;
document.addEventListener('visibilitychange',()=>{if(document.hidden)sleep();else wake();});
const onMotion=()=>{reduce=mq.matches;if(reduce){sleep();insts.forEach(i=>{i.a=i.target;i.draw();});}else wake();};
if(mq.addEventListener)mq.addEventListener('change',onMotion);else if(mq.addListener)mq.addListener(onMotion);
function init(){
  document.querySelectorAll('[data-m-ecg]').forEach(b=>{if(b.__mDone)return;b.__mDone=1;const it=Ecg(b);it.cv.__mInst=it;insts.push(it);fit(it);it.draw();
    if(io)io.observe(it.cv);if(ro)ro.observe(it.cv);});
  wake();
  // redraw once the web font arrives so canvas labels use it
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>insts.forEach(i=>i.draw()));
}
window.MLAIAMED={core:Core,instruments:insts,wake,get running(){return !!raf;},get reducedMotion(){return reduce;}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
