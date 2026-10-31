/* MLAIA design C: live instruments. Dependency-free, no build step.
   Hooks (see _tools/design-c/README.md):
     [data-c-scope]      hero oscilloscope with a draggable noise handle and filter readouts
     [data-c-waterfall]  scrolling spectrogram with a draggable tone handle
     canvas[data-c-trace="ear|drone|vib|anc|tone"]  small live trace for an application row
   Every instrument: draws a static frame under prefers-reduced-motion, pauses when off-screen
   or when the tab is hidden, and scales to devicePixelRatio (capped at 2). */
(()=>{
'use strict';
const mq=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
let reduce=mq.matches||/[?&]still\b/.test(location.search);
const insts=[];let raf=0,last=0;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const TAU=Math.PI*2;
function cssVar(el,name,fb){const v=getComputedStyle(el).getPropertyValue(name).trim();return v||fb;}
function fit(it){
  const r=it.cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);
  const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
  it.dpr=d;it.cssW=r.width;it.cssH=r.height;
  if(it.cv.width!==w||it.cv.height!==h){it.cv.width=w;it.cv.height=h;return true;}
  return false;
}
/* Deterministic noise table, read with linear interpolation at a continuous position,
   so noise scrolls with the signal instead of re-randomising every frame (no jitter). */
const NT=16384,noise=new Float32Array(NT);
(()=>{let s=20250417;const rnd=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
  for(let i=0;i<NT;i++)noise[i]=Math.sqrt(-2*Math.log(rnd()+1e-9))*Math.cos(TAU*rnd());})();
function nz(u){const i=Math.floor(u),f=u-i,a=noise[((i%NT)+NT)%NT],b=noise[(((i+1)%NT)+NT)%NT];return a+(b-a)*f;}
function colors(el){return{a:cssVar(el,'--c-amber','#ffb547'),b:cssVar(el,'--c-blue','#71d4ff'),bg:cssVar(el,'--c-bg-3','#070908'),grid:'#1d2220',fg:cssVar(el,'--c-fg','#eceee9')};}
/* In the light reading variant the instrument screens stay dark, so traces keep the bright data colours. */
function screenColors(el){const c=colors(el);if(document.body.classList.contains('c-reading')){c.a='#ffb547';c.b='#71d4ff';}return c;}

/* ---------- scheduler: one rAF loop for every visible instrument ---------- */
function tick(now){
  raf=0;const dt=last?Math.min(0.05,(now-last)/1000):1/60;last=now;let any=false;
  for(const it of insts){if(it.visible){it.step(dt);it.draw();it.frames++;any=true;}}
  if(any&&!document.hidden&&!reduce)raf=requestAnimationFrame(tick);else last=0;
}
function wake(){if(!raf&&!reduce&&!document.hidden&&insts.some(i=>i.visible)){last=0;raf=requestAnimationFrame(tick);}}
function sleep(){if(raf){cancelAnimationFrame(raf);raf=0;last=0;}}
const io='IntersectionObserver' in window?new IntersectionObserver(es=>{
  for(const e of es){const it=e.target.__cInst;if(!it)continue;it.visible=e.isIntersecting;if(it.visible&&reduce)it.draw();if(it.visible)it.onVisible&&it.onVisible();}
  wake();
},{rootMargin:'80px 0px'}):null;
const ro='ResizeObserver' in window?new ResizeObserver(es=>{for(const e of es){const it=e.target.__cInst;if(it&&fit(it)){it.resized&&it.resized();it.draw();}}}):null;
function register(it){
  insts.push(it);it.frames=0;it.visible=!io;it.cv.__cInst=it;fit(it);it.resized&&it.resized();it.draw();
  if(io)io.observe(it.cv);if(ro)ro.observe(it.cv);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)sleep();else wake();});
const onMotion=()=>{reduce=mq.matches;if(reduce){sleep();insts.forEach(i=>i.draw());}else wake();};
if(mq.addEventListener)mq.addEventListener('change',onMotion);else if(mq.addListener)mq.addListener(onMotion);

/* ---------- draggable handle: visible control, slider semantics, keyboard, touch ---------- */
function Handle(box,o){
  const axis=o.axis||'x';let v=clamp(o.value??0.5,o.lo??0,o.hi??1),drag=false,hintRaf=0;
  const el=document.createElement('div');
  el.className='c-handle c-handle--'+axis;el.tabIndex=0;el.setAttribute('role','slider');
  el.setAttribute('aria-orientation',axis==='x'?'horizontal':'vertical');el.setAttribute('aria-label',o.label);
  el.setAttribute('aria-valuemin',String(o.units(o.lo??0)));el.setAttribute('aria-valuemax',String(o.units(o.hi??1)));
  el.innerHTML='<span class="c-handle__line"></span><span class="c-handle__grip"></span><span class="c-handle__chip" aria-hidden="true"></span>';
  box.append(el);const chip=el.querySelector('.c-handle__chip');
  const api={get value(){return v;},interacted:false,set,stopHint,hint};
  function render(){
    if(axis==='x'){el.style.left=(v*100)+'%';chip.style.transform='translateX('+(-v*100)+'%)';}
    else el.style.top=((1-v)*100)+'%';
    const t=o.text(v);chip.textContent=t.chip;el.setAttribute('aria-valuenow',String(o.units(v)));el.setAttribute('aria-valuetext',t.valuetext);
  }
  function set(nv,fromUser){v=clamp(nv,o.lo??0,o.hi??1);render();o.onInput(v);if(fromUser){api.interacted=true;stopHint();}}
  function fromEvent(e){const r=box.getBoundingClientRect();return axis==='x'?(e.clientX-r.left)/r.width:1-(e.clientY-r.top)/r.height;}
  box.addEventListener('pointerdown',e=>{
    if(e.button>0)return;
    const onHandle=!!e.target.closest('.c-handle');
    // Vertical handles on touch: only the handle drags, so vertical page scroll still works on the screen.
    if(axis==='y'&&e.pointerType==='touch'&&!onHandle){set(fromEvent(e),true);return;}
    drag=true;try{box.setPointerCapture(e.pointerId);}catch{}set(fromEvent(e),true);if(e.pointerType!=='touch')el.focus({preventScroll:true});
  });
  box.addEventListener('pointermove',e=>{if(drag)set(fromEvent(e),true);});
  const end=()=>{drag=false;};
  box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);box.addEventListener('lostpointercapture',end);
  el.addEventListener('keydown',e=>{
    const s=o.step||0.02,map={ArrowRight:s,ArrowUp:s,ArrowLeft:-s,ArrowDown:-s,PageUp:s*5,PageDown:-s*5};
    if(e.key in map){set(v+map[e.key],true);e.preventDefault();}
    else if(e.key==='Home'){set(o.lo??0,true);e.preventDefault();}
    else if(e.key==='End'){set(o.hi??1,true);e.preventDefault();}
  });
  ['pointerdown','keydown','wheel'].forEach(t=>box.addEventListener(t,()=>{api.interacted=true;stopHint();},{passive:true}));
  /* One-time "show me": glide out and back once, slowly, then stop. */
  function hint(){
    if(reduce||api.interacted||hintRaf)return;
    const v0=v,amp=o.hintAmp||0.25,dur=2800;let t0=0;
    const step=now=>{
      if(api.interacted||reduce){hintRaf=0;return;}
      if(!t0)t0=now;const p=Math.min(1,(now-t0)/dur);
      // out to +amp, back through to -amp*0.5, then home: smooth sine path with eased ends
      const e=0.5-0.5*Math.cos(Math.PI*p),path=Math.sin(TAU*e)*(e<0.5?amp:amp*0.5);
      v=clamp(v0+path,o.lo??0,o.hi??1);render();o.onInput(v);
      hintRaf=p<1?requestAnimationFrame(step):0;
    };
    hintRaf=requestAnimationFrame(step);
  }
  function stopHint(){if(hintRaf){cancelAnimationFrame(hintRaf);hintRaf=0;}}
  render();
  return api;
}

/* ---------- hero oscilloscope ----------
   A tone plus white noise, sampled at 48 kHz, through a fixed 4th-order Butterworth low-pass
   (cutoff in data-cutoff, default 1 kHz). The drag handle sets the noise level; optional
   range inputs [data-c-ctl="tone|level|phase"] in the same [data-c-instrument] set the tone.
   Readouts are the exact expected values for this signal and filter, computed from the
   filter's response, so they never flicker and never flatter the filter:
     raw   = tone power / noise power
     out   = tone power x |H(f)|^2 / (noise power x sum h[n]^2)
     tgain = |H(f)| in dB, lag = -arg H(f) in degrees, delay = lag / (360 f). */
const DB_LO=-24,DB_HI=6,FS=48000;
function butterLP(fc){ // two biquads, Butterworth Q values for 4th order
  return [0.54119610,1.30656296].map(Q=>{const w=TAU*fc/FS,cw=Math.cos(w),al=Math.sin(w)/(2*Q),a0=1+al;
    return{b0:(1-cw)/2/a0,b1:(1-cw)/a0,b2:(1-cw)/2/a0,a1:-2*cw/a0,a2:(1-al)/a0};});
}
function response(st,f){ // magnitude and unwrapped phase of the cascade at f
  let mag=1,ph=0;const w=TAU*f/FS;
  for(const q of st){
    const zr=Math.cos(w),zi=-Math.sin(w),z2r=Math.cos(2*w),z2i=-Math.sin(2*w);
    const nr=q.b0+q.b1*zr+q.b2*z2r,ni=q.b1*zi+q.b2*z2i,dr=1+q.a1*zr+q.a2*z2r,di=q.a1*zi+q.a2*z2i;
    mag*=Math.hypot(nr,ni)/Math.hypot(dr,di);ph+=Math.atan2(ni,nr)-Math.atan2(di,dr);
  }
  return{mag,ph};
}
function Scope(box){
  const cv=box.querySelector('canvas'),ctx=cv.getContext('2d');
  const root=box.closest('[data-c-instrument]')||box.parentElement;
  const R={};root.querySelectorAll('[data-c-read]').forEach(n=>R[n.dataset.cRead]=n);
  const C={},O={};root.querySelectorAll('[data-c-ctl]').forEach(n=>C[n.dataset.cCtl]=n);
  root.querySelectorAll('[data-c-ctl-out]').forEach(n=>O[n.dataset.cCtlOut]=n);
  const span=0.02,N=Math.round(span*FS),warm=960,fc=+box.dataset.cutoff||1000;
  const stages=butterLP(fc);
  let neb=0;{const s=new Float64Array(8);for(let i=0;i<8192;i++){let x=i?0:1;stages.forEach((q,k)=>{const j=k*4,y=q.b0*x+q.b1*s[j]+q.b2*s[j+1]-q.a1*s[j+2]-q.a2*s[j+3];s[j+1]=s[j];s[j]=x;s[j+3]=s[j+2];s[j+2]=y;x=y;});neb+=x*x;}}
  // tone slider: semitones relative to 440 Hz (log scale), -25..+26 = 104 Hz to 1.98 kHz
  const toneOf=v=>440*Math.pow(2,v/12),sliderOf=f=>12*Math.log2(f/440);
  const cur={f:+box.dataset.tone||440,lvl:0,ph:0};
  const tgt={...cur};
  const it={cv,box,dpr:1,scroll:0,off:0,db:0,target:0,col:screenColors(box)};
  const toDb=v=>DB_LO+v*(DB_HI-DB_LO);
  const sign=x=>x<0?'−':x>0?'+':'';
  const handle=Handle(box,{axis:'x',value:+box.dataset.value||0.55,lo:0.04,hi:0.96,step:1/30,hintAmp:0.24,
    label:'Noise level',units:v=>Math.round(toDb(v)),
    text:v=>{const d=Math.round(toDb(v)),s=sign(d)+Math.abs(d);return{chip:'◀ drag ▶  noise '+s+' dB',valuetext:'noise '+s+' dB'};},
    onInput:v=>{it.target=toDb(v);if(reduce){it.db=it.target;it.draw();}}});
  it.target=it.db=toDb(handle.value);
  function readCtl(){
    if(C.tone)tgt.f=toneOf(+C.tone.value);
    if(C.level)tgt.lvl=+C.level.value;
    if(C.phase)tgt.ph=+C.phase.value;
    if(O.tone)O.tone.textContent=Math.round(tgt.f)+' Hz';
    if(O.level)O.level.textContent=sign(tgt.lvl)+Math.abs(tgt.lvl)+' dB';
    if(O.phase)O.phase.textContent=Math.round(tgt.ph)+'°';
    if(C.tone)C.tone.setAttribute('aria-valuetext',Math.round(tgt.f)+' hertz');
    if(C.level)C.level.setAttribute('aria-valuetext',sign(tgt.lvl)+Math.abs(tgt.lvl)+' decibels');
    if(C.phase)C.phase.setAttribute('aria-valuetext',Math.round(tgt.ph)+' degrees');
    if(reduce&&it.draw){Object.assign(cur,tgt);it.draw();}
  }
  if(C.tone)C.tone.value=String(Math.round(sliderOf(cur.f)));
  Object.values(C).forEach(n=>n.addEventListener('input',()=>{handle.interacted=true;handle.stopHint();readCtl();}));
  readCtl();Object.assign(cur,tgt);
  it.onVisible=()=>{if(!it.hinted&&box.hasAttribute('data-hint')){it.hinted=true;setTimeout(()=>{if(it.visible)handle.hint();},1500);}};
  it.resized=()=>{it.col=screenColors(box);};
  it.step=dt=>{
    const k=1-Math.exp(-dt/0.22);
    it.db+=(it.target-it.db)*k;
    cur.f*=Math.pow(tgt.f/cur.f,k);cur.lvl+=(tgt.lvl-cur.lvl)*k;
    let dp=((tgt.ph-cur.ph+540)%360)-180;cur.ph=(cur.ph+dp*k+360)%360;
    // Slow, smooth scroll: about one screen per second, capped so high tones never strobe.
    const cps=Math.min(10,0.9*cur.f*span);it.scroll+=TAU*cps*dt;it.off+=FS*(cps/cur.f)*dt;
  };
  let lastRead='';
  it.draw=()=>{
    const W=cv.width,H=cv.height,d=it.dpr,c=it.col,f=cur.f;
    ctx.clearRect(0,0,W,H);
    const A=0.78*Math.pow(10,cur.lvl/20),sigma=0.55*Math.pow(10,it.db/20),ph0=cur.ph*Math.PI/180;
    const st=new Float64Array(8),off=Math.floor(it.off);
    const raw=new Float32Array(N),out=new Float32Array(N);
    for(let i=-warm;i<N;i++){
      const v=A*Math.sin(TAU*f*i/FS+it.scroll+ph0)+sigma*noise[(((i+off)%NT)+NT)%NT];
      let x=v;for(let s=0;s<2;s++){const q=stages[s],j=s*4,y=q.b0*x+q.b1*st[j]+q.b2*st[j+1]-q.a1*st[j+2]-q.a2*st[j+3];st[j+1]=st[j];st[j]=x;st[j+3]=st[j+2];st[j+2]=y;x=y;}
      if(i>=0){raw[i]=v;out[i]=x;}
    }
    const yc=H*0.5,amp=H*0.3;
    const trace=(arr,col,lw,alpha)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=col;ctx.lineWidth=lw*d;ctx.lineJoin='round';ctx.beginPath();
      for(let i=0;i<arr.length;i++){const X=i/(arr.length-1)*W,Y=yc-arr[i]*amp;i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);}ctx.stroke();ctx.globalAlpha=1;};
    ctx.strokeStyle='rgba(236,238,233,.12)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,yc);ctx.lineTo(W,yc);ctx.stroke();
    trace(raw,c.a,4,.12);trace(raw,c.a,1.1,.85);
    trace(out,c.b,7,.14);trace(out,c.b,2.2,1);
    // exact expected readouts for the current settings
    const r=response(stages,f),ps=A*A/2,pn=sigma*sigma;
    const snrRaw=10*Math.log10(ps/pn),snrOut=10*Math.log10(ps*r.mag*r.mag/(pn*neb));
    const lag=-r.ph*180/Math.PI,fmt=x=>sign(+x.toFixed(1))+Math.abs(x).toFixed(1)+' dB';
    const vals={raw:fmt(snrRaw),out:fmt(snrOut),gain:fmt(snrOut-snrRaw),tgain:fmt(20*Math.log10(r.mag)),lag:Math.round(lag)+'°',delay:(1000*lag/(360*f)).toFixed(2)+' ms'};
    const key=JSON.stringify(vals);
    if(key!==lastRead){lastRead=key;for(const k in vals)if(R[k])R[k].textContent=vals[k];}
  };
  it.handle=handle;
  return it;
}

/* ---------- scrolling spectrogram (waterfall) ---------- */
function Waterfall(box){
  const cv=box.querySelector('canvas'),ctx=cv.getContext('2d');
  const it={cv,box,dpr:1,t:0,acc:0,base:null,tone:0.4};
  const FMAX=4000,toHz=v=>Math.round(v*FMAX/50)*50;
  const handle=Handle(box,{axis:'y',value:+box.dataset.value||0.4,lo:0.05,hi:0.95,step:0.025,
    label:'Frequency of the added tone',units:v=>toHz(v),
    text:v=>{const hz=toHz(v),s=hz>=1000?(hz/1000).toFixed(2).replace(/0$/,'')+' kHz':hz+' Hz';return{chip:'▲ drag ▼  tone '+s,valuetext:'tone at '+s};},
    onInput:v=>{it.tone=v;if(reduce)queueStill();}});
  it.tone=handle.value;
  let stillQ=0;function queueStill(){if(!stillQ)stillQ=requestAnimationFrame(()=>{stillQ=0;fill();});}
  function cmap(v){v=Math.pow(clamp(v),0.85);return v<.5?[20+v*120,22+v*100,20+v*80]:[80+(v-.5)*350,72+(v-.5)*222,60+(v-.5)*22];}
  it.resized=()=>{ // static part of the spectrum per row: low-frequency rumble and motor harmonics
    const H=cv.height;it.base=new Float32Array(H);
    for(let y=0;y<H;y++){const fq=(1-y/H)*FMAX;let e=0.05+0.2*Math.exp(-fq/500);
      for(let k=1;k<=10;k++){const dd=fq-k*190;e+=0.5/Math.sqrt(k)*Math.exp(-dd*dd/392);}it.base[y]=e;}
    fill();
  };
  let seed=7;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
  function column(img,c,cols,H){
    it.t+=0.04/it.dpr;const t=it.t;
    const f0=900+500*Math.sin(t*0.35),gust=Math.pow(Math.max(0,Math.sin(t*0.9)),6),ft=it.tone*FMAX,bw=16*16*2;
    const data=img.data;
    for(let y=0;y<H;y++){const fq=(1-y/H)*FMAX;let e=it.base[y]+0.06*rnd()+gust*0.35*Math.exp(-fq/1500);
      for(let k=1;k<=3;k++){const dd=fq-k*f0;e+=0.6/k*Math.exp(-dd*dd/800);}
      const i=(y*cols+c)*4,dt=fq-ft;
      if(Math.abs(dt)<22){data[i]=113;data[i+1]=212;data[i+2]=255;}
      else{e+=1.1*Math.exp(-dt*dt/bw);const [r,g,b]=cmap(Math.log10(1+9*e)/1.05);data[i]=r;data[i+1]=g;data[i+2]=b;}
      data[i+3]=255;}
  }
  function push(cols){
    const W=cv.width,H=cv.height;if(W<2||H<2||!it.base)return;cols=Math.min(cols,W);
    if(cols<W)ctx.drawImage(cv,cols,0,W-cols,H,0,0,W-cols,H);
    const img=ctx.createImageData(cols,H);for(let c=0;c<cols;c++)column(img,c,cols,H);
    ctx.putImageData(img,W-cols,0);
  }
  function fill(){const W=cv.width;it.t-=W*0.04/it.dpr;push(W);}
  it.step=dt=>{it.acc+=dt*90*it.dpr;const n=Math.floor(it.acc);if(n>0){it.acc-=n;push(n);}};
  it.draw=()=>{};// columns are painted in step(); the canvas keeps its pixels between frames
  it.handle=handle;
  return it;
}

/* ---------- small live traces for application rows ---------- */
function Trace(cv){
  const ctx=cv.getContext('2d'),kind=cv.dataset.cTrace;
  const it={cv,dpr:1,t:(cv.dataset.cOffset? +cv.dataset.cOffset:Math.random()*10),col:screenColors(cv)};
  it.resized=()=>{it.col=screenColors(cv);};
  it.step=dt=>{it.t+=dt*0.12;};// about half the speed of the approved mockup
  it.draw=()=>{
    const W=cv.width,H=cv.height,d=it.dpr,c=it.col,n=Math.round(clamp(it.cssW/1.5,120,240));
    ctx.fillStyle=c.bg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=c.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
    const A=new Float32Array(n),B=new Float32Array(n);let hasB=false;const r=300;
    for(let i=0;i<n;i++){const x=it.t+i/n,z=nz(x*r);let a=0,b=0;
      if(kind==='anc'){a=0.5*Math.sin(TAU*5*x)+0.3*Math.sin(TAU*11*x+1)+0.1*z;b=a*0.18;hasB=true;}
      else if(kind==='vib'){const p=1/3.3,ph=((x%p)+p)%p,imp=Math.exp(-ph/0.02)*Math.sin(TAU*90*x)*0.55;
        a=0.28*Math.sin(TAU*14*x)+imp+0.06*z;b=Math.exp(-ph/0.03)*0.6;hasB=true;}
      else if(kind==='drone'){a=0.4*Math.sin(TAU*24*x)+0.22*Math.sin(TAU*48*x)+(0.1+0.4*Math.pow(Math.max(0,Math.sin(TAU*0.4*x)),4))*z;}
      else if(kind==='ear'){const e=Math.pow(Math.max(0,Math.sin(TAU*1.3*x)),2),s=0.7*e*Math.sin(TAU*30*x);a=s+0.3*z;b=s;hasB=true;}
      else{const s=0.55*Math.sin(TAU*9*x)*(0.75+0.25*Math.sin(TAU*0.5*x));a=s+0.15*z;b=s;hasB=true;}
      A[i]=a;B[i]=b;}
    const tr=(arr,col,lw)=>{ctx.strokeStyle=col;ctx.lineWidth=lw*d;ctx.lineJoin='round';ctx.beginPath();
      for(let i=0;i<n;i++){const X=i/(n-1)*W,Y=H/2-arr[i]*H*0.42;i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);}ctx.stroke();};
    tr(A,c.a,1.2);if(hasB)tr(B,c.b,1.8);
  };
  return it;
}

function init(root=document){
  root.querySelectorAll('[data-c-scope]').forEach(b=>{if(!b.__cDone){b.__cDone=1;register(Scope(b));}});
  root.querySelectorAll('[data-c-waterfall]').forEach(b=>{if(!b.__cDone){b.__cDone=1;register(Waterfall(b));}});
  root.querySelectorAll('canvas[data-c-trace]').forEach(cv=>{if(!cv.__cDone){cv.__cDone=1;register(Trace(cv));}});
  wake();
}
window.MLAIAC={init,instruments:insts,get reducedMotion(){return reduce;},get running(){return !!raf;}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init());else init();
})();
