/* MLAIA Medical AI Lab (/medical-ai/lab/): demos 07-09. Demos 01-06 are in assets/medical-lab.js.
   07 Nodule volume and slice thickness: a 3D view of one synthetic nodule and the stack of slices a CT
      segmentation would keep. Drawn on a 2D canvas with its own projection and painter's ordering, so
      it needs no WebGL and no library.
   08 Sample size: the confidence interval around a measured sensitivity.
   09 Hidden subgroup failure: one model, a good overall score, a weak subgroup.
   All data is synthetic and deterministic (fixed seeds), generated and scored in the browser; nothing
   is uploaded. Each demo wires up only if its section is on the page. 08 and 09 recompute on input and
   do not animate. 07 rotates slowly while it is on screen; it stops for good once you drag it, pauses
   off-screen and in hidden tabs, and draws a still frame under prefers-reduced-motion or ?still.
   Illustrative only; not a medical device. */
(function(){
'use strict';
const TAU=2*Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){let a=seed>>>0;const uni=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  const gauss=()=>{let u=0;while(u<1e-12)u=uni();return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*uni());};return{uni,gauss};}

/* ---------- 07 Nodule volume and slice thickness ---------- */
// One slightly lobulated nodule, the same shape at every size. A CT voxel holds the share of the nodule
// inside it (partial volume); the segmentation keeps voxels that are at least half nodule. In-plane
// pixels are fixed at 0.7 mm; the slice thickness and where the slices fall are the controls.
const NV={G:96,SPAN:1.3,PX:0.7,PXOFF:0.3,ANG:40};
// radius of the nodule surface in direction (x,y,z)/|.|, as a multiple of the nominal radius
function nvRadius(x,y,z){const rho=Math.hypot(x,y),r=Math.hypot(rho,z)||1,az=Math.atan2(y,x),st=rho/r,ct=z/r;
  return 1+0.09*Math.sin(3*az+0.6)*st*st+0.07*(2*ct*ct-1)*Math.cos(0.4)-0.07*2*ct*st*Math.sin(0.4)*Math.cos(az);}
// fine occupancy grid of the unit nodule (nominal radius 1), built once: the cells that are inside
const nvCells=(()=>{const G=NV.G,h=2*NV.SPAN/G,xs=[],ys=[],zs=[];
  for(let k=0;k<G;k++){const z=-NV.SPAN+(k+.5)*h;for(let j=0;j<G;j++){const y=-NV.SPAN+(j+.5)*h;for(let i=0;i<G;i++){const x=-NV.SPAN+(i+.5)*h;
    if(Math.hypot(x,y,z)<=nvRadius(x,y,z)){xs.push(x);ys.push(y);zs.push(z);}}}}
  return{x:Float32Array.from(xs),y:Float32Array.from(ys),z:Float32Array.from(zs),h,n:xs.length};})();
// diameter D mm, slice thickness T mm, pos in [0,1): how far the slice grid is shifted, as a share of T
function nvScan(D,T,pos){
  const R=D/2,h=nvCells.h*R,cell=h*h*h,px=NV.PX,L=NV.SPAN*R;
  const nx=Math.ceil((2*L+px)/px)+2,x0=-L-px*(1+NV.PXOFF);
  // slice boundaries: at pos = 0 the nodule centre is in the middle of a slice
  const zStart=-T/2-T*Math.ceil(L/T)-T*(pos%1),nz=Math.ceil((L-zStart)/T)+1;
  const acc=new Float32Array(nx*nx*nz);
  for(let c=0;c<nvCells.n;c++){const ix=Math.floor((nvCells.x[c]*R-x0)/px),iy=Math.floor((nvCells.y[c]*R-x0)/px),iz=Math.floor((nvCells.z[c]*R-zStart)/T);
    if(iz>=0&&iz<nz&&ix>=0&&ix<nx&&iy>=0&&iy<nx)acc[(iz*nx+iy)*nx+ix]+=cell;}
  const vox=px*px*T,half=vox/2;let kept=0;const slabs=[];
  for(let iz=0;iz<nz;iz++){let any=0;const base=iz*nx*nx;for(let q=0;q<nx*nx;q++)if(acc[base+q]>=half){kept++;any=1;}
    if(!any)continue;
    // outline of the kept pixels in this slice, by radial search from the scan axis
    const rad=new Float32Array(NV.ANG);
    for(let a=0;a<NV.ANG;a++){const ca=Math.cos(a*TAU/NV.ANG),sa=Math.sin(a*TAU/NV.ANG);let best=0;
      for(let r=px/4;r<=L*1.2;r+=px/4){const ix=Math.floor((r*ca-x0)/px),iy=Math.floor((r*sa-x0)/px);if(ix>=0&&ix<nx&&iy>=0&&iy<nx&&acc[base+iy*nx+ix]>=half)best=r;}
      rad[a]=best;}
    slabs.push({z0:zStart+iz*T,z1:zStart+(iz+1)*T,rad});}
  return{trueVol:nvCells.n*cell,vol:kept*vox,slabs,slices:slabs.length};
}
const nvCache={};
// measured volume at every slice position, for the range a repeat scan could report
function nvRange(D,T){const key=D+'|'+T;if(nvCache[key])return nvCache[key];let lo=Infinity,hi=-Infinity;
  for(let s=0;s<20;s++){const v=nvScan(D,T,s/20).vol;lo=Math.min(lo,v);hi=Math.max(hi,v);}
  return nvCache[key]={lo,hi};}
function nodule(D,T,pos){const s=nvScan(D,T,pos),r=nvRange(D,T);
  return{trueVol:s.trueVol,vol:s.vol,err:s.vol/s.trueVol-1,slices:s.slices,slabs:s.slabs,
    errLo:r.lo/s.trueVol-1,errHi:r.hi/s.trueVol-1,swing:r.lo>0?r.hi/r.lo-1:Infinity};}

/* ---------- 08 Sample size: the interval around a measured sensitivity ---------- */
// Wilson score interval for k successes out of n
function wilson(k,n,z){z=z||1.96;if(!n)return[0,1];const p=k/n,z2=z*z,den=1+z2/n,c=(p+z2/(2*n))/den,w=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/den;return[Math.max(0,c-w),Math.min(1,c+w)];}
function positivesFor(p,half){for(let n=5;n<=200000;n++){const ci=wilson(p*n,n);if((ci[1]-ci[0])/2<=half)return n;}return Infinity;}
function sampleSize(N,prev,sens){
  const pos=Math.max(1,Math.round(N*prev)),neg=N-pos,tp=Math.round(pos*sens),tn=Math.round(neg*sens);
  const need=positivesFor(sens,0.05);
  // 60 repeats of the same study with a model whose true sensitivity is the value entered
  const r=rng(777+pos*13+Math.round(sens*1000)),reps=[];for(let s=0;s<60;s++){let k=0;for(let i=0;i<pos;i++)if(r.uni()<sens)k++;reps.push(k/pos);}
  return{pos,neg,tp,tn,sens:tp/pos,spec:neg?tn/neg:NaN,ci:wilson(tp,pos),ciNeg:neg?wilson(tn,neg):[0,1],needPos:need,needN:Math.ceil(need/prev),reps};
}

/* ---------- 09 Hidden subgroup failure ---------- */
// 6,000 synthetic patients, 20% with the outcome. The model's score separates cases from non-cases by
// SG.D standard deviations in the main group and by a share of that in the subgroup. One threshold for
// everyone, set to reach the target sensitivity on the whole test set.
const SG={N:6000,PREV:0.2,D:2.0};
const sgBase=(()=>{const r=rng(20261),ug=new Float32Array(SG.N),y=new Uint8Array(SG.N),z=new Float32Array(SG.N);
  for(let i=0;i<SG.N;i++){ug[i]=r.uni();y[i]=r.uni()<SG.PREV?1:0;z[i]=r.gauss();}return{ug,y,z};})();
function rocOf(s,y){ // points from (0,0) to (1,1), and the AUC
  const idx=Array.from(s.keys()).sort((a,b)=>s[b]-s[a]);let P=0;for(const v of y)P+=v;const Nn=y.length-P,pts=[[0,0]];let tp=0,fp=0,area=0;
  for(const i of idx){if(y[i]){tp++;}else{fp++;area+=tp;}pts.push([Nn?fp/Nn:0,P?tp/P:0]);}
  return{pts,auc:P&&Nn?area/(P*Nn):NaN,P,Nn};}
function subgroup(share,strength,target){
  const N=SG.N,s=new Float32Array(N),g=new Uint8Array(N);
  for(let i=0;i<N;i++){g[i]=sgBase.ug[i]<share?1:0;s[i]=sgBase.z[i]+(sgBase.y[i]?SG.D*(g[i]?strength:1):0);}
  // threshold: the highest score cut-off that still reaches the target sensitivity overall
  const posScores=[];for(let i=0;i<N;i++)if(sgBase.y[i])posScores.push(s[i]);posScores.sort((a,b)=>b-a);
  const thr=posScores[Math.min(posScores.length-1,Math.ceil(target*posScores.length)-1)];
  const part=sel=>{const ss=[],yy=[];let tp=0,fn=0,fp=0,tn=0;for(let i=0;i<N;i++){if(!sel(i))continue;ss.push(s[i]);yy.push(sgBase.y[i]);const f=s[i]>=thr;if(sgBase.y[i]){if(f)tp++;else fn++;}else{if(f)fp++;else tn++;}}
    const roc=rocOf(Float32Array.from(ss),yy);return{n:ss.length,pos:tp+fn,tp,fn,fp,tn,sens:tp+fn?tp/(tp+fn):NaN,spec:fp+tn?tn/(fp+tn):NaN,auc:roc.auc,roc:roc.pts,ci:wilson(tp,tp+fn)};};
  return{all:part(()=>true),main:part(i=>!g[i]),sub:part(i=>g[i]===1),thr};
}

const Core={nodule,nvScan,nvRadius,wilson,positivesFor,sampleSize,subgroup};
if(typeof module==='object'&&module.exports){module.exports=Core;return;}

/* ================= browser ================= */
const $=id=>document.getElementById(id);
const COL={amber:'#ffb547',blue:'#71d4ff',fg:'#eceee9',muted:'#9ca39d',rule:'#262b28',red:'#ff6b6b',green:'#7be0a6'};
const MONO='font-family="&quot;Martian Mono&quot;,ui-monospace,Menlo,monospace"';
const pct0=v=>Math.round(v*100)+'%',pct1=v=>(v*100).toFixed(1)+'%',sgn=v=>(v>=0?'+':'−')+Math.abs(Math.round(v*100))+'%';
const mm3=v=>v>=100?Math.round(v).toLocaleString('en-US'):v.toFixed(1);
function scheduler(fn){let q=0;return()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;fn();});};}
function fitCanvas(cv){const r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}return{w,h,d};}
function onResize(el,fn){if('ResizeObserver' in window)new ResizeObserver(()=>fn()).observe(el);else window.addEventListener('resize',fn);}
const mq=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
const STILL=/[?&]still\b/.test(location.search);

/* ----- 07 Nodule volume: 3D view ----- */
function initNodule(){
  if(!$('nodule'))return;
  const dia=$('nv-diameter'),thk=$('nv-thickness'),pos=$('nv-position'),cv=$('nv-canvas');
  let az=0.7,el=0.42,res=null,auto=!(mq.matches||STILL),visible=true,raf=0,last=0;
  // unit wireframe of the true surface: rings of latitude and lines of longitude
  const wire=(()=>{const lines=[];const P=(th,ph)=>{const x=Math.sin(th)*Math.cos(ph),y=Math.sin(th)*Math.sin(ph),z=Math.cos(th),r=nvRadius(x,y,z);return[x*r,y*r,z*r];};
    for(let a=1;a<8;a++){const l=[];for(let b=0;b<=48;b++)l.push(P(a*Math.PI/8,b*TAU/48));lines.push(l);}
    for(let b=0;b<12;b++){const l=[];for(let a=0;a<=24;a++)l.push(P(a*Math.PI/24,b*TAU/12));lines.push(l);}return lines;})();
  function draw(){
    if(!res)return;
    const {w,h,d}=fitCanvas(cv),ctx=cv.getContext('2d'),D=+dia.value,R=D/2,T=+thk.value;
    ctx.clearRect(0,0,w,h);
    const ext=Math.max(R*1.35,0.5*(res.slabs.length?res.slabs[res.slabs.length-1].z1-res.slabs[0].z0:0)+0.6),sc=Math.min(w,h)*0.43/ext,cx=w/2,cy=h/2;
    const ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
    // rotate about the scan axis (z), then tilt; returns screen x, screen y and depth towards the viewer
    const pr=(x,y,z)=>{const x1=x*ca-y*sa,y1=x*sa+y*ca,y2=y1*ce-z*se,z2=y1*se+z*ce;return[cx+x1*sc,cy-z2*sc,-y2];};
    const strokeWire=front=>{ctx.lineWidth=1*d;ctx.setLineDash([3*d,4*d]);ctx.strokeStyle=front?'rgba(236,238,233,.62)':'rgba(236,238,233,.2)';ctx.beginPath();
      for(const l of wire)for(let i=1;i<l.length;i++){const a=pr(l[i-1][0]*R,l[i-1][1]*R,l[i-1][2]*R),b=pr(l[i][0]*R,l[i][1]*R,l[i][2]*R);if(((a[2]+b[2])/2>0)!==front)continue;ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
      ctx.stroke();ctx.setLineDash([]);};
    strokeWire(false);
    // slabs: one prism per kept slice. Seen from above, draw from the bottom up; from below, top down.
    const order=res.slabs.slice();if(el<0)order.reverse();const A=NV.ANG,light=[-0.45,-0.6,0.66];
    const shade=(nx,ny,nz,k)=>{const x1=nx*ca-ny*sa,y1=nx*sa+ny*ca,y2=y1*ce-nz*se,z2=y1*se+nz*ce,l=clamp(0.34+0.66*Math.max(0,x1*light[0]+y2*light[1]+z2*light[2]),0,1)*k;
      return`rgb(${Math.round(0x71*l)},${Math.round(0xd4*l)},${Math.round(0xff*l)})`;};
    ctx.lineJoin='round';ctx.lineWidth=1*d;ctx.strokeStyle='rgba(7,9,8,.55)';
    for(const s of order){
      const quads=[];
      for(let a=0;a<A;a++){const b=(a+1)%A,t0=a*TAU/A,t1=b*TAU/A,xa=s.rad[a]*Math.cos(t0),ya=s.rad[a]*Math.sin(t0),xb=s.rad[b]*Math.cos(t1),yb=s.rad[b]*Math.sin(t1);
        const p=[pr(xa,ya,s.z0),pr(xb,yb,s.z0),pr(xb,yb,s.z1),pr(xa,ya,s.z1)],tm=(t0+t1)/2+(t1<t0?Math.PI:0);
        quads.push({p,z:(p[0][2]+p[1][2])/2,c:shade(Math.cos(tm),Math.sin(tm),0,0.86)});}
      quads.sort((u,v)=>u.z-v.z);
      for(const q of quads){ctx.fillStyle=q.c;ctx.beginPath();ctx.moveTo(q.p[0][0],q.p[0][1]);for(let i=1;i<4;i++)ctx.lineTo(q.p[i][0],q.p[i][1]);ctx.closePath();ctx.fill();}
      const zc=el>=0?s.z1:s.z0;ctx.fillStyle=shade(0,0,el>=0?1:-1,1);ctx.beginPath();
      for(let a=0;a<A;a++){const t=a*TAU/A,p=pr(s.rad[a]*Math.cos(t),s.rad[a]*Math.sin(t),zc);if(a)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);}
      ctx.closePath();ctx.fill();ctx.stroke();
    }
    strokeWire(true);
    // scale bar and slice-thickness label
    ctx.font=(11*d)+'px "Martian Mono",ui-monospace,monospace';ctx.textBaseline='middle';ctx.fillStyle=COL.fg;ctx.strokeStyle=COL.fg;ctx.lineWidth=1.5*d;
    const bar=D>=10?5:2;ctx.beginPath();ctx.moveTo(12*d,h-16*d);ctx.lineTo(12*d+bar*sc,h-16*d);ctx.stroke();ctx.fillText(bar+' mm',18*d+bar*sc,h-16*d);
    ctx.fillStyle=COL.muted;ctx.textAlign='right';ctx.fillText(res.slices+(res.slices===1?' slice':' slices')+' · '+T.toFixed(1)+' mm each',w-12*d,h-16*d);ctx.textAlign='left';
  }
  const run=()=>{
    const D=+dia.value,T=+thk.value,p=+pos.value/100;res=nodule(D,T,p);
    $('nv-diameter-value').textContent=D+' mm';$('nv-thickness-value').textContent=T.toFixed(1)+' mm';$('nv-position-value').textContent=pos.value+'%';
    $('nv-true').textContent=mm3(res.trueVol)+' mm³';$('nv-vol').textContent=mm3(res.vol)+' mm³';
    $('nv-err').textContent=sgn(res.err);$('nv-err').closest('div').classList.toggle('ml-bad',Math.abs(res.err)>=0.25);
    $('nv-swing').textContent=isFinite(res.swing)?'+'+Math.round(res.swing*100)+'%':'not found';$('nv-swing').closest('div').classList.toggle('ml-bad',!(res.swing<0.25));
    $('nv-detail').textContent='Across all slice positions the measured volume runs from '+sgn(res.errLo)+' to '+sgn(res.errHi)+' of the true volume. '+
      (!isFinite(res.swing)?'At some positions no voxel is at least half nodule, and the nodule is not segmented at all.':res.swing>=0.25?'Two scans of this unchanged nodule can differ by '+Math.round(res.swing*100)+'%, more than the 25% change commonly used to call growth.':'Two scans of this unchanged nodule differ by at most '+Math.round(res.swing*100)+'%, inside the 25% change commonly used to call growth.');
    cv.setAttribute('aria-label','3D view of a synthetic '+D+' mm nodule and the '+res.slices+' slices kept by the segmentation at '+T.toFixed(1)+' mm slice thickness. Measured volume '+mm3(res.vol)+' cubic mm against a true '+mm3(res.trueVol)+'.');
    draw();
  };
  const go=scheduler(run),redraw=scheduler(draw);
  [dia,thk,pos].forEach(e=>e.addEventListener('input',go));
  const preset=(id,T)=>{const b=$(id);if(b)b.addEventListener('click',()=>{thk.value=T;run();});};
  preset('nv-preset-thin',1);preset('nv-preset-mid',2.5);preset('nv-preset-thick',5);
  // rotation: drag, arrow keys, and a slow turn until the first drag
  const tick=t=>{raf=0;if(!auto||!visible||document.hidden)return;if(last)az+=Math.min(0.05,(t-last)/1000)*0.35;last=t;draw();raf=requestAnimationFrame(tick);};
  const wake=()=>{if(auto&&visible&&!document.hidden&&!raf){last=0;raf=requestAnimationFrame(tick);}};
  let drag=null;
  cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};auto=false;cv.classList.add('is-dragging');try{cv.setPointerCapture(e.pointerId);}catch(_){}});
  cv.addEventListener('pointermove',e=>{if(!drag)return;az+=(e.clientX-drag.x)*0.012;el=clamp(el+(e.clientY-drag.y)*0.01,-1.25,1.25);drag={x:e.clientX,y:e.clientY};redraw();});
  const end=()=>{drag=null;cv.classList.remove('is-dragging');};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  cv.addEventListener('keydown',e=>{const k={ArrowLeft:[-0.12,0],ArrowRight:[0.12,0],ArrowUp:[0,0.1],ArrowDown:[0,-0.1]}[e.key];if(!k)return;e.preventDefault();auto=false;az+=k[0];el=clamp(el+k[1],-1.25,1.25);redraw();});
  if('IntersectionObserver' in window)new IntersectionObserver(en=>{visible=en[0].isIntersecting;wake();}).observe(cv);
  document.addEventListener('visibilitychange',wake);
  $('reset-nodule').addEventListener('click',()=>{dia.value=8;thk.value=5;pos.value=0;az=0.7;el=0.42;auto=!(mq.matches||STILL);run();wake();});
  onResize(cv,redraw);run();wake();
}

/* ----- 08 Sample size ----- */
const SS_N=[50,100,150,200,300,400,500,750,1000,1500,2000,3000,5000];
function initSample(){
  if(!$('samplesize'))return;
  const n=$('ss-n'),pv=$('ss-prev'),se=$('ss-sens'),mn=$('ss-min');
  const run=()=>{
    const N=SS_N[+n.value],prev=pv.value/100,sens=se.value/100,min=mn.value/100,r=sampleSize(N,prev,sens);
    $('ss-n-value').textContent=N.toLocaleString('en-US')+' patients';$('ss-prev-value').textContent=pv.value+'%';$('ss-sens-value').textContent=se.value+'%';$('ss-min-value').textContent=mn.value+'%';
    $('ss-pos').textContent=r.pos.toLocaleString('en-US');
    $('ss-ci').textContent=pct0(r.ci[0])+' to '+pct0(r.ci[1]);$('ss-ci').closest('div').classList.toggle('ml-bad',r.ci[0]<min);
    $('ss-neg').textContent=pct0(r.ciNeg[0])+' to '+pct0(r.ciNeg[1]);
    $('ss-need').textContent=isFinite(r.needN)?r.needN.toLocaleString('en-US'):'—';
    $('ss-verdict').textContent=r.sens<min?'The measured sensitivity, '+pct0(r.sens)+', is already below the '+mn.value+'% you require.':
      r.ci[0]<min?'Measured sensitivity is '+pct0(r.sens)+' ('+r.tp+' of '+r.pos+'), but the interval reaches down to '+(Math.round(r.ci[0]*100)===Math.round(min*100)?pct1(r.ci[0]):pct0(r.ci[0]))+', below the '+mn.value+'% you require. This study cannot show the model is good enough.':
      'Measured sensitivity is '+pct0(r.sens)+' ('+r.tp+' of '+r.pos+') and the whole interval is above the '+mn.value+'% you require.';
    $('ss-detail').textContent='A margin of ±5 points at this sensitivity needs about '+r.needPos.toLocaleString('en-US')+' positive cases, which at '+pv.value+'% prevalence is about '+r.needN.toLocaleString('en-US')+' patients. The same measured value on the '+r.neg.toLocaleString('en-US')+' negatives has an interval of '+pct0(r.ciNeg[0])+' to '+pct0(r.ciNeg[1])+'.';
    // chart: 40% to 100%
    const X=v=>150+(clamp(v,0.4,1)-0.4)/0.6*450,rows=[58,104,150];
    let s=`<title id="ss-plot-title">Confidence intervals</title><desc id="ss-plot-desc">Sensitivity ${pct0(r.sens)} measured on ${r.pos} positives, 95 percent interval ${pct0(r.ci[0])} to ${pct0(r.ci[1])}. Required minimum ${mn.value} percent.</desc><g aria-hidden="true" ${MONO} fill="${COL.muted}">`;
    for(let v=0.4;v<=1.0001;v+=0.1)s+=`<line x1="${X(v)}" x2="${X(v)}" y1="30" y2="176" stroke="${COL.rule}"/><text class="ml-t" x="${X(v)}" y="194" text-anchor="middle">${Math.round(v*100)}%</text>`;
    s+=`<text class="ml-t" x="140" y="${rows[0]+4}" text-anchor="end">positives</text><text class="ml-t" x="140" y="${rows[1]+4}" text-anchor="end">negatives</text><text class="ml-t" x="140" y="${rows[2]+4}" text-anchor="end">60 repeats</text></g>`;
    const bar=(y,ci,p,c)=>`<line x1="${X(ci[0])}" x2="${X(ci[1])}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="5"/><line x1="${X(ci[0])}" x2="${X(ci[0])}" y1="${y-9}" y2="${y+9}" stroke="${c}" stroke-width="2"/><line x1="${X(ci[1])}" x2="${X(ci[1])}" y1="${y-9}" y2="${y+9}" stroke="${c}" stroke-width="2"/><circle cx="${X(p)}" cy="${y}" r="6" fill="${c}" stroke="#070908" stroke-width="2"/>`;
    s+=bar(rows[0],r.ci,r.sens,r.ci[0]<min?COL.red:COL.blue)+bar(rows[1],r.ciNeg,r.spec,COL.muted);
    // repeats: a dot per repeated study, stacked where they coincide
    const cnt={};for(const v of r.reps){const k=Math.round(X(v));cnt[k]=(cnt[k]||0)+1;}const gap=Math.min(5,40/Math.max(1,...Object.values(cnt))),seen={};
    for(const v of r.reps){const k=Math.round(X(v));seen[k]=(seen[k]||0)+1;const j=seen[k]-1;s+=`<circle cx="${k}" cy="${(rows[2]+(j%2?1:-1)*Math.ceil(j/2)*gap).toFixed(1)}" r="${Math.min(2.6,gap*0.6+0.6).toFixed(1)}" fill="${COL.fg}" opacity=".75"/>`;}
    s+=`<line x1="${X(min)}" x2="${X(min)}" y1="30" y2="176" stroke="${COL.amber}" stroke-width="2" stroke-dasharray="5 5"/>`;
    $('ss-plot').innerHTML=s;
  };
  const go=scheduler(run);[n,pv,se,mn].forEach(e=>e.addEventListener('input',go));
  $('reset-samplesize').addEventListener('click',()=>{n.value=3;pv.value=10;se.value=90;mn.value=80;run();});
  run();
}

/* ----- 09 Hidden subgroup failure ----- */
function initSubgroup(){
  if(!$('subgroup'))return;
  const sh=$('sg-share'),st=$('sg-strength'),tg=$('sg-target');
  const run=()=>{
    const r=subgroup(sh.value/100,st.value/100,tg.value/100);
    $('sg-share-value').textContent=sh.value+'%';$('sg-strength-value').textContent=st.value+'%';$('sg-target-value').textContent=tg.value+'%';
    $('sg-auc').textContent=r.all.auc.toFixed(2);$('sg-auc-sub').textContent=r.sub.auc.toFixed(2);$('sg-auc-sub').closest('div').classList.toggle('ml-bad',r.sub.auc<r.all.auc-0.1);
    $('sg-sens').textContent=pct0(r.all.sens);$('sg-sens-sub').textContent=pct0(r.sub.sens);$('sg-sens-sub').closest('div').classList.toggle('ml-bad',r.sub.sens<r.all.sens-0.1);
    $('sg-detail').textContent='In the subgroup the model misses '+r.sub.fn+' of '+r.sub.pos+' cases; in the main group it misses '+r.main.fn+' of '+r.main.pos.toLocaleString('en-US')+'. The 95% interval for subgroup sensitivity is '+pct0(r.sub.ci[0])+' to '+pct0(r.sub.ci[1])+'. The subgroup is '+r.sub.n.toLocaleString('en-US')+' of the '+SG.N.toLocaleString('en-US')+' patients. AUC in the main group is '+r.main.auc.toFixed(2)+'.';
    // bars: sensitivity and AUC per group
    const row=(l,v,txt,cls)=>`<div class="ml-bar is-current"><span>${l}</span><div class="ml-bar__track"><b class="${cls}" style="width:${(clamp(v,0,1)*100).toFixed(1)}%"></b></div><strong>${txt}</strong></div>`;
    $('sg-bars').innerHTML='<p class="ml-bars__group">Sensitivity at the shared threshold</p>'+row('Whole test set',r.all.sens,pct0(r.all.sens),'ml-b-fg')+row('Main group',r.main.sens,pct0(r.main.sens),'ml-b-blue')+row('Subgroup',r.sub.sens,pct0(r.sub.sens),'ml-b-amber')+
      '<p class="ml-bars__group">Specificity at the shared threshold</p>'+row('Whole test set',r.all.spec,pct0(r.all.spec),'ml-b-fg')+row('Main group',r.main.spec,pct0(r.main.spec),'ml-b-blue')+row('Subgroup',r.sub.spec,pct0(r.sub.spec),'ml-b-amber');
    // ROC curves
    const X=v=>44+v*244,Y=v=>206-v*176,thin=p=>{const o=[],stp=Math.max(1,Math.floor(p.length/160));for(let i=0;i<p.length;i+=stp)o.push(p[i]);o.push(p[p.length-1]);return o.map(q=>X(q[0]).toFixed(1)+','+Y(q[1]).toFixed(1)).join(' ');};
    let c=`<title id="sg-roc-title">ROC curves</title><desc id="sg-roc-desc">AUC ${r.all.auc.toFixed(2)} on the whole test set, ${r.main.auc.toFixed(2)} in the main group and ${r.sub.auc.toFixed(2)} in the subgroup.</desc><g aria-hidden="true" ${MONO} fill="${COL.muted}">`;
    for(const v of [0,0.5,1]){c+=`<line x1="44" x2="288" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.rule}"/><text class="ml-t" x="38" y="${Y(v)+4}" text-anchor="end">${v*100}%</text><text class="ml-t" x="${X(v)}" y="222" text-anchor="middle">${v*100}%</text>`;}
    c+=`<line x1="44" x2="44" y1="30" y2="206" stroke="${COL.rule}"/><text class="ml-t" x="166" y="240" text-anchor="middle">false positive rate</text><text class="ml-t" x="38" y="16" text-anchor="start">sensitivity</text></g>`;
    c+=`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="${COL.muted}" stroke-dasharray="4 5" opacity=".6"/>`;
    c+=`<polyline points="${thin(r.sub.roc)}" fill="none" stroke="${COL.amber}" stroke-width="2.5"/><polyline points="${thin(r.main.roc)}" fill="none" stroke="${COL.blue}" stroke-width="2.5"/><polyline points="${thin(r.all.roc)}" fill="none" stroke="${COL.fg}" stroke-width="2" stroke-dasharray="6 4"/>`;
    const dot=(p,col)=>`<circle cx="${X(1-p.spec).toFixed(1)}" cy="${Y(p.sens).toFixed(1)}" r="5" fill="${col}" stroke="#070908" stroke-width="2"/>`;
    c+=dot(r.main,COL.blue)+dot(r.sub,COL.amber)+dot(r.all,COL.fg);
    $('sg-roc').innerHTML=c;
  };
  const go=scheduler(run);[sh,st,tg].forEach(e=>e.addEventListener('input',go));
  $('reset-subgroup').addEventListener('click',()=>{sh.value=15;st.value=30;tg.value=90;run();});
  run();
}

function init(){initNodule();initSample();initSubgroup();
  const c=$('nv-canvas');if(c&&document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>$('nv-position').dispatchEvent(new Event('input')));}
window.MLAIAMedLabMore=Core;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
