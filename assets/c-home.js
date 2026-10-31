/* MLAIA homepage, design C: the three-channel hero instrument.
   One small live trace per practice, all synthetic and labelled "illustrative":
     audio     a tone in noise (amber) and the same signal after a low-pass filter (blue)
     ecg       an ECG-like biosignal (amber) and the filtered trace with detected beats (blue)
     forecast  weekly demand observations (amber) and a fitted model, forecast and 80% band (blue)
   One visible control (a range input, "Noise in the data") adds noise to all three, and a
   Pause button stops the motion. Readouts are computed from the synthetic data on screen.
   Behaviour matches assets/mlaia-c.js: one rAF loop, slow time-based motion, no drawing when
   off-screen or in a hidden tab, a static frame under prefers-reduced-motion (or ?still, or the
   accessibility widget's "Stop Animations"), canvases sized to devicePixelRatio capped at 2. */
(()=>{
'use strict';
const root=document.querySelector('[data-hm-scope]');if(!root)return;
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mq=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
const forceStill=/[?&]still\b/.test(location.search);
const slider=document.getElementById('hm-noise'),output=document.getElementById('hm-noise-out'),pauseBtn=document.getElementById('hm-pause');
let level=slider?+slider.value/100:.35,paused=false,visible=true,raf=0,last=0,t=6,readT=1;
const he=()=>document.documentElement.lang==='he';
const still=()=>forceStill||mq.matches||document.body.classList.contains('a11y-no-anim');

/* Deterministic noise table (same idea as mlaia-c.js): noise moves with the signal, no jitter. */
const NT=16384,tab=new Float32Array(NT);
(()=>{let s=20251031;const r=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
  for(let i=0;i<NT;i++)tab[i]=Math.sqrt(-2*Math.log(r()+1e-9))*Math.cos(TAU*r());})();
const nz=u=>{const i=Math.floor(u),f=u-i,a=tab[((i%NT)+NT)%NT],b=tab[(((i+1)%NT)+NT)%NT];return a+(b-a)*f;};
const css=(n,f)=>getComputedStyle(root).getPropertyValue(n).trim()||f;
let col={};
const readColors=()=>{col={a:css('--c-amber','#ffb547'),b:css('--c-blue','#71d4ff'),bg:css('--c-bg-3','#070908'),fg:css('--c-fg','#eceee9')};};
readColors();

const chans=[...root.querySelectorAll('canvas[data-hm-ch]')].map(cv=>({cv,ctx:cv.getContext('2d'),kind:cv.dataset.hmCh,
  read:root.querySelector('[data-hm-read="'+cv.dataset.hmCh+'"]'),dpr:1,w:1,h:1,text:''}));
function fit(c){
  const r=c.cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);
  const W=Math.max(1,Math.round(r.width*d)),H=Math.max(1,Math.round(r.height*d));
  c.dpr=d;c.w=r.width;c.h=r.height;
  if(c.cv.width!==W||c.cv.height!==H){c.cv.width=W;c.cv.height=H;return true;}
  return false;
}
const minus=x=>(x<0?'−':x>0?'+':'')+Math.abs(x);
function line(ctx,xs,ys,n,color,lw,alpha,dash){
  ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.setLineDash(dash||[]);ctx.beginPath();
  let pen=false;for(let i=0;i<n;i++){const x=xs[i],y=ys[i];if(x!==x||y!==y){pen=false;continue;}pen?ctx.lineTo(x,y):ctx.moveTo(x,y);pen=true;}
  ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
}
function frame(ctx,W,H,d){
  ctx.fillStyle=col.bg;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(236,238,233,.07)';ctx.lineWidth=1;ctx.beginPath();
  for(let k=1;k<4;k++){const y=Math.round(H*k/4)+.5;ctx.moveTo(0,y);ctx.lineTo(W,y);}
  ctx.stroke();
}

/* ---------- CH 01: tone in noise, two cascaded 2nd-order low-pass stages ---------- */
function drawAudio(c){
  const {ctx}=c,W=c.cv.width,H=c.cv.height,d=c.dpr;frame(ctx,W,H,d);
  const SPC=60,CYC=4,N=SPC*CYC,warm=120,u0=t*0.35*SPC;// window start in samples; scrolls 0.35 cycles per second
  const w=TAU*3/SPC,cw=Math.cos(w),al=Math.sin(w)/Math.SQRT2,a0=1+al;
  const b0=(1-cw)/2/a0,b1=(1-cw)/a0,b2=b0,a1=-2*cw/a0,a2=(1-al)/a0;
  const st=new Float64Array(16);
  const run=(x,k)=>{const y=b0*x+b1*st[k]+b2*st[k+1]-a1*st[k+2]-a2*st[k+3];st[k+1]=st[k];st[k]=x;st[k+3]=st[k+2];st[k+2]=y;return y;};
  const amp=0.04+0.9*level,xs=new Float32Array(N),yr=new Float32Array(N),yo=new Float32Array(N);
  let ps=0,pn=0,pso=0,pno=0;const yc=H*.5,sc=H*.36;
  for(let i=-warm;i<N;i++){
    const u=(u0+i)/SPC,s=0.6*Math.sin(TAU*u)+0.22*Math.sin(2*TAU*u+0.6),n=amp*nz(u0+i);
    const o=run(run(s+n,0),4),so=run(run(s,8),12);
    if(i>=0){xs[i]=i/(N-1)*W;yr[i]=yc-(s+n)*sc;yo[i]=yc-o*sc;ps+=s*s;pn+=n*n;pso+=so*so;pno+=(o-so)*(o-so);}
  }
  line(ctx,xs,yr,N,col.a,1.1*d,.85);
  line(ctx,xs,yo,N,col.b,2.2*d,1);
  const r1=Math.round(10*Math.log10(ps/Math.max(pn,1e-9))),r2=Math.round(10*Math.log10(pso/Math.max(pno,1e-9)));
  c.text='SNR '+minus(r1)+' → '+minus(r2)+' dB';
}

/* ---------- CH 02: ECG-like biosignal, monitor-style sweep, filtered and beat-detected ---------- */
const FS=250,EW=4,RR=60/64;
const WAVES=[[-.17,.12,.025],[-.03,-.12,.01],[0,1,.012],[.03,-.25,.012],[.25,.3,.045]];
function ecg(tau){
  const k=Math.floor(tau/RR);let v=0;
  for(let j=k-1;j<=k+1;j++){const tb=j*RR+.012*Math.sin(j*1.7);
    for(const [c0,a,s] of WAVES){const x=tau-tb-c0;v+=a*Math.exp(-x*x/(2*s*s));}}
  return v;
}
function drawEcg(c){
  const {ctx}=c,W=c.cv.width,H=c.cv.height,d=c.dpr;frame(ctx,W,H,d);
  const now=t,kNow=Math.floor(now*FS),warmS=3*FS,N=EW*FS,gap=Math.round(.22*FS);
  const A=level*0.6,la=1-Math.exp(-TAU*25/FS),lb=1-Math.exp(-TAU*0.7/FS);
  let l1=0,l2=0,base=0;
  const xs=new Float32Array(N),yr=new Float32Array(N),yo=new Float32Array(N),val=new Float32Array(N),kk=new Int32Array(N);
  const yc=H*.62,sc=H*.5;let m=0;
  for(let k=kNow-N-warmS;k<=kNow;k++){
    const tau=k/FS,s=ecg(tau);
    const n=A*(0.5*nz(k+3000)+0.55*Math.sin(TAU*.31*tau+1)+0.22*Math.sin(TAU*.13*tau));
    const x=s+n;l1+=la*(x-l1);l2+=la*(l1-l2);base+=lb*(l2-base);
    const i=k-(kNow-N+1);
    if(i>=0&&i<N){const ph=((k%N)+N)%N,fresh=i>=gap;// the sweep erases a short gap ahead of the cursor
      xs[i]=fresh?ph/(N-1)*W:NaN;yr[i]=yc-x*sc;yo[i]=yc-(l2-base)*sc;val[i]=l2-base;kk[i]=k;if(fresh&&i>0&&ph===0){xs[i-1]=NaN;}
      if(fresh)m=Math.max(m,val[i]);}
  }
  // break the path where the sweep wraps
  for(let i=1;i<N;i++){if(xs[i]<xs[i-1])xs[i-1]=NaN;}
  line(ctx,xs,yr,N,col.a,1*d,.8);
  line(ctx,xs,yo,N,col.b,2*d,1);
  // beat detection on the filtered trace: local maxima above half the window maximum, 250 ms refractory
  const th=.5*m,peaks=[];
  for(let i=gap+2;i<N-2;i++){
    if(val[i]>th&&val[i]>=val[i-1]&&val[i]>=val[i+1]&&val[i]>=val[i-2]&&val[i]>=val[i+2]&&xs[i]===xs[i]){
      if(peaks.length&&kk[i]-kk[peaks[peaks.length-1]]<.25*FS){if(val[i]>val[peaks[peaks.length-1]])peaks[peaks.length-1]=i;}
      else peaks.push(i);
    }
  }
  ctx.fillStyle=col.b;
  for(const i of peaks){const x=xs[i],y=Math.max(4*d,yo[i]-10*d);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4*d,y-7*d);ctx.lineTo(x+4*d,y-7*d);ctx.closePath();ctx.fill();}
  // sweep cursor
  const cx=(((kNow%N)+N)%N)/(N-1)*W;ctx.fillStyle=col.fg;ctx.globalAlpha=.5;ctx.fillRect(cx,0,1.5*d,H);ctx.globalAlpha=1;
  let bpm=null;
  if(peaks.length>=2){const iv=[];for(let j=1;j<peaks.length;j++)iv.push((kk[peaks[j]]-kk[peaks[j-1]])/FS);
    iv.sort((a,b)=>a-b);bpm=Math.round(60/iv[Math.floor(iv.length/2)]);}
  c.text=bpm==null?'—':(he()?bpm+' פעימות לדקה':bpm+' bpm');
}

/* ---------- CH 03: weekly demand, seasonal regression, forecast with an 80% band ---------- */
const HIST=52,HOR=13,FITN=104;
function demand(w,sig){return 100+10*Math.sin(TAU*w/260)+16*Math.sin(TAU*w/52+.4)+7*Math.sin(TAU*w/13)+sig*nz(Math.round(w)*1+9000);}
const basis=w=>[1,w/52,Math.sin(TAU*w/52),Math.cos(TAU*w/52),Math.sin(TAU*w/13),Math.cos(TAU*w/13)];
function solve(A,b){const n=b.length;for(let i=0;i<n;i++){let p=i;for(let r=i+1;r<n;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;
  [A[i],A[p]]=[A[p],A[i]];[b[i],b[p]]=[b[p],b[i]];const piv=A[i][i]||1e-9;
  for(let r=i+1;r<n;r++){const f=A[r][i]/piv;for(let c=i;c<n;c++)A[r][c]-=f*A[i][c];b[r]-=f*b[i];}}
  const x=new Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=b[i];for(let c=i+1;c<n;c++)s-=A[i][c]*x[c];x[i]=s/(A[i][i]||1e-9);}return x;}
let fitKey='',fitCoef=null,fitSig=0,shown=null,shownSig=0;
function refit(lastW,sig){
  const key=lastW+'|'+sig.toFixed(3);if(key===fitKey)return;fitKey=key;
  const A=[...Array(6)].map(()=>new Array(6).fill(0)),b=new Array(6).fill(0),ws=[],ys=[];
  for(let w=lastW-FITN+1;w<=lastW;w++){const y=demand(w,sig),f=basis(w);ws.push(w);ys.push(y);
    for(let i=0;i<6;i++){b[i]+=f[i]*y;for(let j=0;j<6;j++)A[i][j]+=f[i]*f[j];}}
  fitCoef=solve(A,b);let ss=0;
  for(let i=0;i<ws.length;i++){const f=basis(ws[i]);let p=0;for(let j=0;j<6;j++)p+=fitCoef[j]*f[j];ss+=(ys[i]-p)**2;}
  fitSig=Math.sqrt(ss/(ws.length-6));
}
function drawForecast(c,dt){
  const {ctx}=c,W=c.cv.width,H=c.cv.height,d=c.dpr;frame(ctx,W,H,d);
  const nowW=200+t*0.5,lastW=Math.floor(nowW),sig=1.5+16*level;// one week every two seconds
  refit(lastW,sig);
  // ease the drawn model toward each new weekly fit so the line glides instead of jumping
  const k=(!shown||still()||!dt)?1:1-Math.exp(-dt/0.35);
  if(!shown){shown=fitCoef.slice();shownSig=fitSig;}
  for(let i=0;i<6;i++)shown[i]+=(fitCoef[i]-shown[i])*k;shownSig+=(fitSig-shownSig)*k;
  const left=nowW-HIST,span=HIST+HOR,X=w=>(w-left)/span*W,Y=v=>H*.5-(v-100)/72*H*.5;
  const pred=w=>{const f=basis(w);let p=0;for(let j=0;j<6;j++)p+=shown[j]*f[j];return p;};
  // "now" divider and a faint tint over the forecast region
  const xn=X(nowW);ctx.fillStyle='rgba(113,212,255,.04)';ctx.fillRect(xn,0,W-xn,H);
  ctx.strokeStyle='rgba(236,238,233,.35)';ctx.lineWidth=1*d;ctx.setLineDash([3*d,4*d]);ctx.beginPath();ctx.moveTo(xn,0);ctx.lineTo(xn,H);ctx.stroke();ctx.setLineDash([]);
  // 80% band from the residual spread, widening with the horizon
  const z=1.2816,steps=40,top=[],bot=[],wEnd=nowW+HOR+1;
  for(let i=0;i<=steps;i++){const w=lastW+(i/steps)*(wEnd-lastW),h=w-lastW,half=z*shownSig*Math.sqrt(1+h/HOR);
    top.push([X(w),Y(pred(w)+half)]);bot.push([X(w),Y(pred(w)-half)]);}
  ctx.fillStyle=col.b;ctx.globalAlpha=.2;ctx.beginPath();top.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  for(let i=bot.length-1;i>=0;i--)ctx.lineTo(bot[i][0],bot[i][1]);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
  // observations (amber); fitted model over the history and the dashed forecast (blue)
  const w0=Math.floor(left)-1,n=lastW-w0+1,ox=new Float32Array(n),oy=new Float32Array(n);
  for(let i=0;i<n;i++){const w=w0+i;ox[i]=X(w);oy[i]=Y(demand(w,sig));}
  line(ctx,ox,oy,n,col.a,1*d,.55);
  ctx.fillStyle=col.a;for(let i=0;i<n;i++){ctx.beginPath();ctx.arc(ox[i],oy[i],1.9*d,0,TAU);ctx.fill();}
  const M=90,fx=new Float32Array(M),fy=new Float32Array(M),gx=new Float32Array(M),gy=new Float32Array(M);
  for(let i=0;i<M;i++){const w=w0+(lastW-w0)*i/(M-1);fx[i]=X(w);fy[i]=Y(pred(w));
    const v=lastW+(wEnd-lastW)*i/(M-1);gx[i]=X(v);gy[i]=Y(pred(v));}
  line(ctx,fx,fy,M,col.b,1.8*d,.9);
  line(ctx,gx,gy,M,col.b,2.2*d,1,[6*d,4*d]);
  const pct=Math.round(z*fitSig);// the series is centred on 100, so units and percent coincide
  c.text=he()?'טווח 80%: \u2066\u00b1'+pct+'%\u2069':'80% band \u00b1'+pct+'%';
}

function drawAll(dt){
  for(const c of chans){
    if(c.kind==='audio')drawAudio(c);else if(c.kind==='ecg')drawEcg(c);else if(c.kind==='forecast')drawForecast(c,dt);
  }
  if(readT>=.25||!raf){readT=0;for(const c of chans)if(c.read&&c.read.textContent!==c.text)c.read.textContent=c.text;}
}

/* ---------- scheduler ---------- */
const moving=()=>visible&&!paused&&!still()&&!document.hidden;
function tick(now){
  raf=0;const dt=last?Math.min(.05,(now-last)/1000):1/60;last=now;
  t+=dt;readT+=dt;drawAll(dt);
  if(moving())raf=requestAnimationFrame(tick);else last=0;
}
function wake(){if(!raf&&moving()){last=0;raf=requestAnimationFrame(tick);}}
function sleep(){if(raf){cancelAnimationFrame(raf);raf=0;last=0;}}
function redraw(){readT=1;drawAll(0);}
function sync(){
  const s=still();
  if(pauseBtn){pauseBtn.hidden=s;}
  if(moving())wake();else{sleep();redraw();}
}

if('IntersectionObserver' in window){
  new IntersectionObserver(es=>{for(const e of es)visible=e.isIntersecting;if(visible)redraw();sync();},{rootMargin:'80px 0px'}).observe(root);
}
if('ResizeObserver' in window){
  const ro=new ResizeObserver(()=>{let any=false;for(const c of chans)any=fit(c)||any;if(any)redraw();});
  chans.forEach(c=>ro.observe(c.cv));
}
chans.forEach(fit);
document.addEventListener('visibilitychange',sync);
if(mq.addEventListener)mq.addEventListener('change',sync);else if(mq.addListener)mq.addListener(sync);
new MutationObserver(()=>{readColors();sync();redraw();}).observe(document.body,{attributes:true,attributeFilter:['class']});
new MutationObserver(()=>{readT=1;redraw();setPauseText();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

function setSlider(){
  level=+slider.value/100;const pct=slider.value+'%';
  if(output)output.textContent=pct;
  slider.setAttribute('aria-valuetext',pct);
  slider.style.setProperty('--hm-v',pct);
}
if(slider){setSlider();slider.addEventListener('input',()=>{setSlider();fitKey='';if(!raf)redraw();});}
function setPauseText(){
  if(!pauseBtn)return;
  pauseBtn.dataset.en=paused?'Play':'Pause';pauseBtn.dataset.he=paused?'הפעלה':'השהיה';
  pauseBtn.textContent=he()?pauseBtn.dataset.he:pauseBtn.dataset.en;
  pauseBtn.setAttribute('aria-pressed',String(paused));
}
if(pauseBtn)pauseBtn.addEventListener('click',()=>{paused=!paused;setPauseText();sync();});
setPauseText();
redraw();sync();
window.MLAIAHome={get running(){return !!raf;},get t(){return t;},get still(){return still();}};
})();
