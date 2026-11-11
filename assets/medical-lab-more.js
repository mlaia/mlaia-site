/* MLAIA Medical AI Lab (/medical-ai/lab/): demos 07-14. Demos 01-06 are in assets/medical-lab.js.
   07 Nodule volume and slice thickness: a 3D view of one synthetic nodule and the stack of slices a CT
      segmentation would keep. Drawn on a 2D canvas with its own projection and painter's ordering, so
      it needs no WebGL and no library.
   08 Sample size: the confidence interval around a measured sensitivity.
   09 Hidden subgroup failure: one model, a good overall score, a weak subgroup.
   10 Slice-by-slice segmentation: a 3D lesion that a 2D model breaks into pieces (3D view).
   11 Predictive value: positive predictive value over prevalence and specificity (3D surface).
   12 Shortcut learning: a model that reads the hospital tag instead of the disease.
   13 Drift over time: a monthly AUC and a monitoring alarm.
   14 Alert burden: a threshold counted in alerts per nurse per shift.
   All data is synthetic and deterministic (fixed seeds), generated and scored in the browser; nothing
   is uploaded. Each demo wires up only if its section is on the page. The 3D views (07, 10, 11) turn
   slowly while on screen; each stops for good once you drag it, pauses off-screen and in hidden tabs,
   and draws a still frame under prefers-reduced-motion or ?still. The others recompute on input and do
   not animate.
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

/* ---------- shared by 10-14: normal distribution and AUC ---------- */
function erf(x){const s=x<0?-1:1;x=Math.abs(x);const t=1/(1+0.3275911*x);return s*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x));}
const Phi=x=>0.5*(1+erf(x/Math.SQRT2));
function PhiInv(p){ // Acklam's rational approximation
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00],
    b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01],
    c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00],
    d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
  p=clamp(p,1e-9,1-1e-9);let q,r;
  if(p<0.02425){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  if(p>1-0.02425){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
function aucOf(s,y){return rocOf(s,y).auc;}

/* ---------- 10 Slice-by-slice segmentation of a 3D lesion ---------- */
// One elongated synthetic lesion cut into 2 mm slices. A 2D model segments each slice on its own: it
// follows the outline with a little slice-to-slice inconsistency and finds nothing in a few slices.
const SL={T:2,A:9,ANG:40,ORDER:[0.36,0.68,0.52,0.2,0.84,0.6]};
function slRadius(th,z,c){return SL.A*Math.sqrt(Math.max(0,1-(z/c)*(z/c)))*(1+0.1*Math.sin(3*th+z/5)+0.05*Math.cos(2*th-z/7));}
function slicewise(L,drops,jit){
  const T=SL.T,A=SL.ANG,c=L/2,n=Math.round(L/T),zs=-n*T/2,dth=TAU/A,miss=new Set();
  for(let i=0;i<drops;i++){let k=clamp(Math.round(SL.ORDER[i]*(n-1)),1,n-2);while(miss.has(k))k=k+1>n-2?1:k+1;miss.add(k);}
  const slices=[];let sa=0,sb=0,si=0,dsum=0,dkept=0,nkept=0;
  for(let k=0;k<n;k++){const z=zs+(k+.5)*T,tr=new Float32Array(A),pr=new Float32Array(A),u=Math.sin(k*12.9898+4.1)*43758.5453,f=miss.has(k)?0:1+jit*(2*(u-Math.floor(u))-1);
    let a=0,b=0,it=0,dia=0,diaP=0;
    for(let q=0;q<A;q++){tr[q]=slRadius(q*dth,z,c);pr[q]=tr[q]*f;a+=tr[q]*tr[q];b+=pr[q]*pr[q];const m=Math.min(tr[q],pr[q]);it+=m*m;}
    for(let q=0;q<A/2;q++){dia=Math.max(dia,tr[q]+tr[q+A/2]);diaP=Math.max(diaP,pr[q]+pr[q+A/2]);}
    a*=dth/2;b*=dth/2;it*=dth/2;const dk=a+b?2*it/(a+b):1;sa+=a;sb+=b;si+=it;dsum+=dk;if(f){dkept+=dk;nkept++;}
    slices.push({z0:zs+k*T,z1:zs+(k+1)*T,tr,pr,found:f>0,dia,diaP});}
  // fragments: runs of consecutive slices where the model found the lesion
  const frags=[];let cur=null;for(let k=0;k<n;k++){if(slices[k].found){if(!cur){cur={len:0,dia:0};frags.push(cur);}cur.len++;cur.dia=Math.max(cur.dia,slices[k].diaP);}else cur=null;}
  let longT=n*T,longP=0;for(const s of slices)longT=Math.max(longT,s.dia);for(const f of frags)longP=Math.max(longP,f.len*T,f.dia);
  return{slices,n,missed:miss.size,dice:2*si/(sa+sb),diceFound:nkept?dkept/nkept:0,diceMean:dsum/n,lesions:frags.length,longTrue:longT,longPred:longP,
    volTrue:sa*T,volPred:sb*T,volErr:sb/sa-1};
}

/* ---------- 11 Predictive value and prevalence ---------- */
function predictive(prev,sens,spec){const tp=prev*sens,fp=(1-prev)*(1-spec),fn=prev*(1-sens),tn=(1-prev)*spec;
  return{ppv:tp+fp?tp/(tp+fp):NaN,npv:tn+fn?tn/(tn+fn):NaN,flagged:tp+fp,tp,fp,fn,tn};}

/* ---------- 12 Shortcut learning ---------- */
// Each synthetic image has a disease signal (one number, weak) and may carry a hospital tag in the
// corner (present or absent). In the training hospitals the tag goes with disease; in a new hospital
// it does not. The model is a logistic regression on the two inputs.
const SC={N:3000};
const scBase=(()=>{const mk=seed=>{const r=rng(seed),uy=new Float32Array(SC.N),z=new Float32Array(SC.N),um=new Float32Array(SC.N);for(let i=0;i<SC.N;i++){uy[i]=r.uni();z[i]=r.gauss();um[i]=r.uni();}return{uy,z,um};};
  return{train:mk(1201),inner:mk(1202),outer:mk(1203)};})();
function scData(b,d,c){const N=SC.N,y=new Uint8Array(N),x=new Float32Array(N),m=new Uint8Array(N);
  for(let i=0;i<N;i++){y[i]=b.uy[i]<0.5?1:0;x[i]=b.z[i]+(y[i]?d:0);m[i]=b.um[i]<(y[i]?c:1-c)?1:0;}return{y,x,m};}
function scFit(D,useTag){ // Newton's method with a small ridge penalty on the two weights
  const w=[0,0,0],N=SC.N;
  for(let it=0;it<40;it++){const g=[0,0,0],H=[[1e-6,0,0],[0,1,0],[0,0,1]];g[1]=-w[1];g[2]=-w[2];
    for(let i=0;i<N;i++){const f=[1,D.x[i],useTag?D.m[i]:0],p=1/(1+Math.exp(-(w[0]+w[1]*f[1]+w[2]*f[2]))),e=D.y[i]-p,v=p*(1-p);
      for(let a=0;a<3;a++){g[a]+=e*f[a];for(let b=0;b<3;b++)H[a][b]+=v*f[a]*f[b];}}
    if(!useTag){H[2][2]+=1e6;}
    // solve H s = g (3x3, Gaussian elimination)
    const M=H.map((r,i)=>r.concat(g[i]));
    for(let i=0;i<3;i++){let p=i;for(let r=i+1;r<3;r++)if(Math.abs(M[r][i])>Math.abs(M[p][i]))p=r;[M[i],M[p]]=[M[p],M[i]];
      for(let r=i+1;r<3;r++){const q=M[r][i]/M[i][i];for(let k=i;k<4;k++)M[r][k]-=q*M[i][k];}}
    const s=[0,0,0];for(let i=2;i>=0;i--){let v=M[i][3];for(let k=i+1;k<3;k++)v-=M[i][k]*s[k];s[i]=v/M[i][i];}
    let step=0;for(let a=0;a<3;a++){w[a]+=s[a];step+=Math.abs(s[a]);}if(step<1e-7)break;}
  return w;}
function shortcut(d,c){
  const tr=scData(scBase.train,d,c),inn=scData(scBase.inner,d,c),out=scData(scBase.outer,d,0.5),w=scFit(tr,true),w0=scFit(tr,false);
  const score=(D,ww)=>{const s=new Float32Array(SC.N);for(let i=0;i<SC.N;i++)s[i]=ww[1]*D.x[i]+ww[2]*D.m[i];return s;};
  const sd=a=>{let m=0,v=0;for(const q of a)m+=q;m/=a.length;for(const q of a)v+=(q-m)*(q-m);return Math.sqrt(v/a.length);};
  const s1=Math.abs(w[1])*sd(tr.x),s2=Math.abs(w[2])*sd(tr.m);
  let tagPos=0,pos=0;for(let i=0;i<SC.N;i++)if(tr.y[i]){pos++;tagPos+=tr.m[i];}
  return{w,aucIn:aucOf(score(inn,w),inn.y),aucOut:aucOf(score(out,w),out.y),aucClean:aucOf(score(out,w0),out.y),share:s2/(s1+s2),tagInDisease:tagPos/pos};
}

/* ---------- 13 Drift over time and a monitoring rule ---------- */
// 24 months after deployment. The model's true AUC is DR.BASE for DR.START months, then falls by a
// fixed amount each month. Each month a sample of labelled cases gives a measured AUC. The alarm
// fires when the measured AUC is below (baseline - margin) two months in a row.
const DR={T:24,START:6,BASE:0.85,PREV:0.2};
function drift(n,rate,margin){
  const months=[],thr=DR.BASE-margin;let alarm=0;
  for(let m=1;m<=DR.T;m++){const tru=m<=DR.START?DR.BASE:Math.max(0.5,DR.BASE-rate*(m-DR.START)),d=Math.SQRT2*PhiInv(tru),r=rng(5150+m*97),s=new Float32Array(n),y=new Uint8Array(n);let pos=0;
    for(let i=0;i<n;i++){y[i]=r.uni()<DR.PREV?1:0;pos+=y[i];s[i]=r.gauss()+(y[i]?d:0);}
    const meas=pos&&pos<n?aucOf(s,y):NaN;months.push({m,tru,meas,pos});
    if(!alarm&&m>1&&meas<thr&&months[m-2].meas<thr)alarm=m;}
  const last=months[DR.T-1];
  return{months,thr,alarm,falseAlarm:alarm>0&&alarm<=DR.START,delay:alarm>DR.START?alarm-DR.START:null,truAtAlarm:alarm?months[alarm-1].tru:null,truEnd:last.tru,posPerMonth:Math.round(n*DR.PREV)};
}

/* ---------- 14 Alert burden ---------- */
// An early-warning score with a given AUC, used at the threshold that reaches the target sensitivity.
// Each patient is scored k times in a 12-hour shift; 2% of patient-shifts contain a real event, which
// is present at one of those scores.
const AL={EVENT:0.02,HOURS:12,SHIFTS:7};
function alerts(aucv,sens,P,k){
  const d=Math.SQRT2*PhiInv(aucv),t=d-PhiInv(sens),fpr=1-Phi(t),p=AL.EVENT/k,per=P*k*(p*sens+(1-p)*fpr),real=P*AL.EVENT*sens;
  // one nurse, seven shifts: every score of every patient
  const r=rng(4242),ticks=[];for(let s=0;s<AL.SHIFTS;s++)for(let q=0;q<P;q++)for(let j=0;j<k;j++){const ev=r.uni()<p,al=r.uni()<(ev?sens:fpr),h=(j+r.uni())*AL.HOURS/k;if(al)ticks.push({s,h,real:ev});}
  return{perShift:per,realPerShift:real,oneIn:per/real,minutes:AL.HOURS*60/per,fpr,ppv:real/per,missed:1-sens,ticks};
}

const Core={nodule,nvScan,nvRadius,wilson,positivesFor,sampleSize,subgroup,Phi,PhiInv,slicewise,predictive,shortcut,drift,alerts};
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

/* ----- shared 3D helpers for 10 and 11: an orbit camera on a 2D canvas ----- */
// Drag or arrow keys rotate. The view turns slowly until the first drag, pauses off-screen and in
// hidden tabs, and stays still under prefers-reduced-motion or ?still.
function orbit(cv,draw,az0,el0){
  const st={az:az0,el:el0};let auto=!(mq.matches||STILL),visible=true,raf=0,last=0,drag=null;const redraw=scheduler(draw);
  const tick=t=>{raf=0;if(!auto||!visible||document.hidden)return;if(last)st.az+=Math.min(0.05,(t-last)/1000)*0.3;last=t;draw();raf=requestAnimationFrame(tick);};
  const wake=()=>{if(auto&&visible&&!document.hidden&&!raf){last=0;raf=requestAnimationFrame(tick);}};
  cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};auto=false;cv.classList.add('is-dragging');try{cv.setPointerCapture(e.pointerId);}catch(_){}});
  cv.addEventListener('pointermove',e=>{if(!drag)return;st.az+=(e.clientX-drag.x)*0.012;st.el=clamp(st.el+(e.clientY-drag.y)*0.01,-1.25,1.25);drag={x:e.clientX,y:e.clientY};redraw();});
  const end=()=>{drag=null;cv.classList.remove('is-dragging');};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  cv.addEventListener('keydown',e=>{const k={ArrowLeft:[-0.12,0],ArrowRight:[0.12,0],ArrowUp:[0,0.1],ArrowDown:[0,-0.1]}[e.key];if(!k)return;e.preventDefault();auto=false;st.az+=k[0];st.el=clamp(st.el+k[1],-1.25,1.25);redraw();});
  if('IntersectionObserver' in window)new IntersectionObserver(en=>{visible=en[0].isIntersecting;wake();}).observe(cv);
  document.addEventListener('visibilitychange',wake);onResize(cv,redraw);
  return{st,redraw,wake,reset(){st.az=az0;st.el=el0;auto=!(mq.matches||STILL);wake();}};
}
// rotate about the vertical (z) axis, then tilt; returns [screen x, screen y, depth towards the viewer]
function camera(st,cx,cy,sc){const ca=Math.cos(st.az),sa=Math.sin(st.az),ce=Math.cos(st.el),se=Math.sin(st.el);
  const pr=(x,y,z)=>{const x1=x*ca-y*sa,y1=x*sa+y*ca;return[cx+x1*sc,cy-(y1*se+z*ce)*sc,-(y1*ce-z*se)];};
  pr.light=(nx,ny,nz)=>{const x1=nx*ca-ny*sa,y1=nx*sa+ny*ca,y2=y1*ce-nz*se,z2=y1*se+nz*ce;return clamp(0.34+0.66*Math.max(0,-0.45*x1-0.6*y2+0.66*z2),0,1);};return pr;}
// one horizontal prism: outline radii rad[] at ANG angles, from z0 to z1
function prism(ctx,pr,el,rad,z0,z1,rgb,d){const A=rad.length,quads=[],col=l=>`rgb(${Math.round(rgb[0]*l)},${Math.round(rgb[1]*l)},${Math.round(rgb[2]*l)})`;
  for(let a=0;a<A;a++){const b=(a+1)%A,t0=a*TAU/A,t1=(a+1)*TAU/A,xa=rad[a]*Math.cos(t0),ya=rad[a]*Math.sin(t0),xb=rad[b]*Math.cos(t1),yb=rad[b]*Math.sin(t1),p=[pr(xa,ya,z0),pr(xb,yb,z0),pr(xb,yb,z1),pr(xa,ya,z1)],tm=(t0+t1)/2;
    quads.push({p,z:(p[0][2]+p[1][2])/2,c:col(pr.light(Math.cos(tm),Math.sin(tm),0)*0.86)});}
  quads.sort((u,v)=>u.z-v.z);ctx.lineJoin='round';ctx.lineWidth=1*d;ctx.strokeStyle='rgba(7,9,8,.55)';
  for(const q of quads){ctx.fillStyle=q.c;ctx.beginPath();ctx.moveTo(q.p[0][0],q.p[0][1]);for(let i=1;i<4;i++)ctx.lineTo(q.p[i][0],q.p[i][1]);ctx.closePath();ctx.fill();}
  const zc=el>=0?z1:z0;ctx.fillStyle=col(pr.light(0,0,el>=0?1:-1));ctx.beginPath();
  for(let a=0;a<A;a++){const t=a*TAU/A,p=pr(rad[a]*Math.cos(t),rad[a]*Math.sin(t),zc);if(a)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);}
  ctx.closePath();ctx.fill();ctx.stroke();}

/* ----- 10 Slice-by-slice segmentation: 3D view ----- */
function initSlicewise(){
  if(!$('slicewise'))return;
  const len=$('sl-length'),dr=$('sl-drops'),jt=$('sl-jitter'),cv=$('sl-canvas');let res=null;
  const draw=()=>{if(!res)return;const {w,h,d}=fitCanvas(cv),ctx=cv.getContext('2d'),L=+len.value;ctx.clearRect(0,0,w,h);
    const sc=Math.min(w,h)*0.44/Math.max(L/2+1,13),pr=camera(o.st,w/2,h/2,sc),order=res.slices.slice();if(o.st.el<0)order.reverse();
    for(const s of order)prism(ctx,pr,o.st.el,s.found?s.pr:s.tr,s.z0,s.z1,s.found?[0x71,0xd4,0xff]:[0xff,0xb5,0x47],d);
    ctx.font=(11*d)+'px "Martian Mono",ui-monospace,monospace';ctx.textBaseline='middle';ctx.fillStyle=COL.fg;ctx.strokeStyle=COL.fg;ctx.lineWidth=1.5*d;
    ctx.beginPath();ctx.moveTo(12*d,h-16*d);ctx.lineTo(12*d+10*sc,h-16*d);ctx.stroke();ctx.fillText('10 mm',18*d+10*sc,h-16*d);
    ctx.fillStyle=COL.muted;ctx.textAlign='right';ctx.fillText(res.n+' slices · 2 mm each',w-12*d,h-16*d);ctx.textAlign='left';};
  const o=orbit(cv,draw,0.6,0.3);
  const run=()=>{const L=+len.value,J=+jt.value/100;res=slicewise(L,+dr.value,J);
    $('sl-length-value').textContent=L+' mm';$('sl-drops-value').textContent=dr.value+(dr.value==='1'?' slice':' slices');$('sl-jitter-value').textContent=jt.value+'%';
    $('sl-found').textContent=res.diceFound.toFixed(2);$('sl-dice').textContent=res.dice.toFixed(2);
    $('sl-lesions').textContent=res.lesions+' for 1';$('sl-lesions').closest('div').classList.toggle('ml-bad',res.lesions!==1);
    $('sl-long').textContent=Math.round(res.longPred)+' of '+Math.round(res.longTrue)+' mm';$('sl-long').closest('div').classList.toggle('ml-bad',res.longPred<res.longTrue*0.9);
    $('sl-detail').textContent='The model finds the lesion in '+(res.n-res.missed)+' of '+res.n+' slices. Measured volume is '+Math.round(res.volPred/1000*10)/10+' cm³ against a true '+Math.round(res.volTrue/1000*10)/10+' cm³ ('+sgn(res.volErr)+'). Mean Dice over all '+res.n+' slices, counting the missed ones as zero, is '+res.diceMean.toFixed(2)+'.';
    cv.setAttribute('aria-label','3D view of a synthetic lesion '+L+' mm long in '+res.n+' slices. The model finds it in '+(res.n-res.missed)+' slices and reports '+res.lesions+(res.lesions===1?' lesion.':' separate lesions.'));draw();};
  const go=scheduler(run);[len,dr,jt].forEach(e=>e.addEventListener('input',go));
  $('reset-slicewise').addEventListener('click',()=>{len.value=30;dr.value=2;jt.value=5;o.reset();run();});
  run();o.wake();
}

/* ----- 11 Predictive value: 3D surface ----- */
const PV_PREV=[0.1,0.2,0.5,1,2,5,10,20,30,50];
function initPredictive(){
  if(!$('ppv'))return;
  const pv=$('pv-prev'),se=$('pv-sens'),sp=$('pv-spec'),cv=$('pv-canvas'),G=18,LO=Math.log10(0.001),HI=Math.log10(0.5);
  const xOf=p=>-1+2*(Math.log10(p)-LO)/(HI-LO),yOf=s=>-1+2*(s-0.5)/0.49,ZS=1.25,zOf=v=>(v-0.5)*ZS;
  const draw=()=>{const {w,h,d}=fitCanvas(cv),ctx=cv.getContext('2d'),prev=PV_PREV[+pv.value]/100,sens=se.value/100,spec=sp.value/100;ctx.clearRect(0,0,w,h);
    const pr=camera(o.st,w/2,h/2+10*d,Math.min(w,h)*0.3);
    ctx.font=(11*d)+'px "Martian Mono",ui-monospace,monospace';ctx.textBaseline='middle';ctx.textAlign='center';
    // floor and the vertical axis
    ctx.strokeStyle=COL.rule;ctx.lineWidth=1*d;ctx.beginPath();const fl=[[-1,-1],[1,-1],[1,1],[-1,1]];
    fl.forEach((q,i)=>{const p=pr(q[0],q[1],zOf(0));if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();ctx.stroke();
    ctx.beginPath();for(const q of fl){const a=pr(q[0],q[1],zOf(0)),b=pr(q[0],q[1],zOf(1));ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}ctx.stroke();
    // surface: PPV over prevalence (log scale) and specificity, at the chosen sensitivity
    const quads=[];for(let i=0;i<G;i++)for(let j=0;j<G;j++){const c=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>{const x=-1+2*a/G,y=-1+2*b/G,p=Math.pow(10,LO+(x+1)/2*(HI-LO)),s=0.5+(y+1)/2*0.49,v=predictive(p,sens,s).ppv;return{q:pr(x,y,zOf(v)),v};});
      quads.push({c,z:(c[0].q[2]+c[1].q[2]+c[2].q[2]+c[3].q[2])/4,v:(c[0].v+c[1].v+c[2].v+c[3].v)/4});}
    quads.sort((a,b)=>a.z-b.z);ctx.lineWidth=0.75*d;ctx.strokeStyle='rgba(7,9,8,.6)';
    for(const q of quads){const l=0.22+0.78*q.v;ctx.fillStyle=`rgb(${Math.round(0x71*l)},${Math.round(0xd4*l)},${Math.round(0xff*l)})`;ctx.beginPath();q.c.forEach((p,i)=>{if(i)ctx.lineTo(p.q[0],p.q[1]);else ctx.moveTo(p.q[0],p.q[1]);});ctx.closePath();ctx.fill();ctx.stroke();}
    // the chosen point
    const v=predictive(prev,sens,spec).ppv,a=pr(xOf(prev),yOf(spec),zOf(0)),b=pr(xOf(prev),yOf(spec),zOf(v));
    ctx.strokeStyle=COL.amber;ctx.lineWidth=1.5*d;ctx.setLineDash([3*d,3*d]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=COL.amber;ctx.strokeStyle='#070908';ctx.lineWidth=2*d;ctx.beginPath();ctx.arc(b[0],b[1],6*d,0,TAU);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(a[0],a[1],3*d,0,TAU);ctx.fill();
    // axis labels
    const lab=(t,x,y,z,c)=>{const p=pr(x,y,z);ctx.fillStyle=c||COL.muted;ctx.fillText(t,clamp(p[0],40*d,w-40*d),clamp(p[1],10*d,h-10*d));};
    lab('0.1%',-1,-1.22,zOf(0));lab('50%',1,-1.22,zOf(0));lab('prevalence',0,-1.5,zOf(0),COL.fg);
    lab('50%',1.22,-1,zOf(0));lab('99%',1.22,1,zOf(0));lab('specificity',1.5,0,zOf(0),COL.fg);
    lab('PPV 100%',-1,1,zOf(1.1),COL.fg);ctx.textAlign='left';};
  const o=orbit(cv,draw,-0.62,0.5);
  const run=()=>{const prev=PV_PREV[+pv.value]/100,sens=se.value/100,spec=sp.value/100,r=predictive(prev,sens,spec),n=v=>{const q=v*1000;return q>=10?Math.round(q).toLocaleString('en-US'):String(Math.round(q*10)/10);};
    $('pv-prev-value').textContent=PV_PREV[+pv.value]+'%';$('pv-sens-value').textContent=se.value+'%';$('pv-spec-value').textContent=sp.value+'%';
    $('pv-ppv').textContent=r.ppv<0.1?pct1(r.ppv):pct0(r.ppv);$('pv-ppv').closest('div').classList.toggle('ml-bad',r.ppv<0.5);
    $('pv-npv').textContent=r.npv>0.995?(r.npv*100).toFixed(2)+'%':pct1(r.npv);
    $('pv-flag').textContent=n(r.flagged);$('pv-ratio').textContent=r.fp/r.tp>=10?Math.round(r.fp/r.tp):(r.fp/r.tp).toFixed(1);
    $('pv-detail').textContent='Of 1,000 people tested, '+n(r.flagged)+' test positive and '+n(r.tp)+' of them have the condition. '+n(r.fn)+' with the condition test negative.';
    cv.setAttribute('aria-label','3D surface of positive predictive value over prevalence and specificity at '+se.value+' percent sensitivity. At '+PV_PREV[+pv.value]+' percent prevalence and '+sp.value+' percent specificity the positive predictive value is '+(r.ppv*100).toFixed(1)+' percent.');draw();};
  const go=scheduler(run);[pv,se,sp].forEach(e=>e.addEventListener('input',go));
  $('reset-ppv').addEventListener('click',()=>{pv.value=3;se.value=90;sp.value=90;o.reset();run();});
  run();o.wake();
}

/* ----- 12 Shortcut learning ----- */
function initShortcut(){
  if(!$('shortcut'))return;
  const co=$('sc2-corr'),sg=$('sc2-signal'),cv=$('sc2-canvas');let res=null;
  const draw=()=>{if(!res)return;const {w,h,d}=fitCanvas(cv),ctx=cv.getContext('2d'),s=w/120,vis=+sg.value/100;ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
    // a schematic scan: body, two lung fields, a faint lesion, and a hospital tag in the corner
    ctx.fillStyle='#2a2e2c';ctx.beginPath();ctx.ellipse(60*s,66*s,48*s,46*s,0,0,TAU);ctx.fill();
    ctx.fillStyle='#121514';for(const x of [42,78]){ctx.beginPath();ctx.ellipse(x*s,64*s,15*s,30*s,0,0,TAU);ctx.fill();}
    const g=ctx.createRadialGradient(80*s,74*s,0,80*s,74*s,9*s);g.addColorStop(0,`rgba(236,238,233,${clamp(0.18+0.3*vis,0,0.9)})`);g.addColorStop(1,'rgba(236,238,233,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(80*s,74*s,9*s,0,TAU);ctx.fill();
    ctx.fillStyle=COL.fg;ctx.fillRect(7*s,7*s,22*s,11*s);ctx.fillStyle='#000';ctx.font=`700 ${8*s}px "Martian Mono",ui-monospace,monospace`;ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText('PORT',18*s,12.8*s);
    // where the model's weight is
    const heat=(x,y,r,a)=>{const q=ctx.createRadialGradient(x*s,y*s,0,x*s,y*s,r*s);q.addColorStop(0,`rgba(255,107,107,${0.85*a})`);q.addColorStop(1,'rgba(255,107,107,0)');ctx.fillStyle=q;ctx.beginPath();ctx.arc(x*s,y*s,r*s,0,TAU);ctx.fill();};
    heat(18,12.5,26,res.share);heat(80,74,22,1-res.share);
    ctx.font=(11*d)+'px "Martian Mono",ui-monospace,monospace';ctx.textAlign='left';
    const tag=(t,x,y)=>{const tw=ctx.measureText(t).width+10*d;ctx.fillStyle='rgba(7,9,8,.85)';ctx.fillRect(x,y,tw,18*d);ctx.fillStyle=COL.fg;ctx.fillText(t,x+5*d,y+9*d);};
    tag('tag: '+pct0(res.share)+' of the weight',6*s,22*s);tag('disease signal: '+pct0(1-res.share),Math.min(52*s,w-170*d),90*s);};
  const run=()=>{const c=co.value/100,dv=sg.value/100;res=shortcut(dv,c);
    $('sc2-corr-value').textContent=co.value+'%';$('sc2-signal-value').textContent=dv.toFixed(1);
    $('sc2-in').textContent=res.aucIn.toFixed(2);$('sc2-out').textContent=res.aucOut.toFixed(2);$('sc2-out').closest('div').classList.toggle('ml-bad',res.aucOut<res.aucIn-0.05);
    $('sc2-share').textContent=pct0(res.share);$('sc2-clean').textContent=res.aucClean.toFixed(2);
    const row=(l,v,txt,cls)=>`<div class="ml-bar is-current"><span>${l}</span><div class="ml-bar__track"><b class="${cls}" style="width:${(clamp((v-0.5)/0.5,0,1)*100).toFixed(1)}%"></b></div><strong>${txt}</strong></div>`;
    $('sc2-bars').innerHTML='<p class="ml-bars__group">AUC, bars start at 0.5</p>'+row('Same hospitals',res.aucIn,res.aucIn.toFixed(2),'ml-b-blue')+row('New hospital',res.aucOut,res.aucOut.toFixed(2),'ml-b-amber')+row('No-tag model',res.aucClean,res.aucClean.toFixed(2),'ml-b-fg');
    $('sc2-detail').textContent=res.aucOut<res.aucClean-0.005?'At a new hospital the model scores '+res.aucOut.toFixed(2)+', below the '+res.aucClean.toFixed(2)+' of a model that never saw the tag: the shortcut now works against it.':'At a new hospital the model scores '+res.aucOut.toFixed(2)+', about the same as a model that never saw the tag ('+res.aucClean.toFixed(2)+').';
    cv.setAttribute('aria-label','Schematic scan with a hospital tag in the corner. '+pct0(res.share)+' of the model’s weight is on the tag and '+pct0(1-res.share)+' on the disease signal.');draw();};
  const go=scheduler(run);[co,sg].forEach(e=>e.addEventListener('input',go));
  $('reset-shortcut').addEventListener('click',()=>{co.value=90;sg.value=100;run();});
  onResize(cv,scheduler(draw));run();
}

/* ----- 13 Drift over time ----- */
const DR_N=[20,50,100,200,500,1000];
function initDrift(){
  if(!$('drift'))return;
  const n=$('dr-n'),rt=$('dr-rate'),mg=$('dr-margin');
  const run=()=>{const N=DR_N[+n.value],rate=rt.value/1000,margin=mg.value/100,r=drift(N,rate,margin);
    $('dr-n-value').textContent=N.toLocaleString('en-US')+' cases';$('dr-rate-value').textContent=rate.toFixed(3);$('dr-margin-value').textContent=margin.toFixed(2);
    $('dr-end').textContent=r.truEnd.toFixed(2);$('dr-end').closest('div').classList.toggle('ml-bad',r.truEnd<DR.BASE-0.05);
    $('dr-alarm').textContent=r.alarm?'month '+r.alarm:'never';$('dr-alarm').closest('div').classList.toggle('ml-bad',!r.alarm&&rate>0||r.falseAlarm);
    $('dr-delay').textContent=r.falseAlarm?'false alarm':r.delay?r.delay+' months':rate>0?'24+ months':'no drift';
    $('dr-at').textContent=r.alarm?r.truAtAlarm.toFixed(2):'—';
    $('dr-detail').textContent=(r.falseAlarm?'The alarm fires in month '+r.alarm+', before any drift: with '+r.posPerMonth+' positive cases a month the measured AUC swings below the alarm line by chance.':
      r.alarm?'The model starts to drift after month '+DR.START+'. The alarm fires in month '+r.alarm+', '+r.delay+' months later, when the true AUC has fallen from '+DR.BASE.toFixed(2)+' to '+r.truAtAlarm.toFixed(2)+'.':
      rate>0?'The model drifts from month '+(DR.START+1)+' and the alarm never fires in 24 months. True AUC ends at '+r.truEnd.toFixed(2)+'.':'There is no drift and the alarm never fires.')+' Each month has about '+r.posPerMonth+' positive cases.';
    const X=m=>70+(m-1)/23*530,Y=v=>190-(clamp(v,0.5,1)-0.5)/0.5*160;
    let s=`<title id="dr-plot-title">AUC by month</title><desc id="dr-plot-desc">True AUC falls from ${DR.BASE.toFixed(2)} to ${r.truEnd.toFixed(2)} over 24 months. ${r.alarm?'The alarm fires in month '+r.alarm+'.':'The alarm never fires.'}</desc><g aria-hidden="true" ${MONO} fill="${COL.muted}">`;
    for(const v of [0.5,0.6,0.7,0.8,0.9,1])s+=`<line x1="70" x2="600" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.rule}"/>`+(Math.round(v*10)%2?`<text class="ml-t" x="62" y="${Y(v)+4}" text-anchor="end">${v.toFixed(1)}</text>`:'');
    for(const m of [1,6,12,18,24])s+=`<text class="ml-t" x="${X(m)}" y="214" text-anchor="middle">${m}</text>`;
    s+=`<text class="ml-t" x="335" y="246" text-anchor="middle">months after deployment</text><text class="ml-t" x="62" y="16" text-anchor="start">AUC</text></g>`;
    s+=`<rect x="${X(1)}" y="30" width="${X(DR.START+0.5)-X(1)}" height="160" fill="${COL.fg}" opacity=".04"/>`;
    s+=`<line x1="70" x2="600" y1="${Y(r.thr)}" y2="${Y(r.thr)}" stroke="${COL.amber}" stroke-width="2" stroke-dasharray="5 5"/>`;
    s+=`<polyline points="${r.months.map(q=>X(q.m).toFixed(1)+','+Y(q.tru).toFixed(1)).join(' ')}" fill="none" stroke="${COL.fg}" stroke-width="2" stroke-dasharray="6 4"/>`;
    const ok=r.months.filter(q=>isFinite(q.meas));
    s+=`<polyline points="${ok.map(q=>X(q.m).toFixed(1)+','+Y(q.meas).toFixed(1)).join(' ')}" fill="none" stroke="${COL.blue}" stroke-width="1.5" opacity=".7"/>`;
    for(const q of ok)s+=`<circle cx="${X(q.m).toFixed(1)}" cy="${Y(q.meas).toFixed(1)}" r="4" fill="${COL.blue}"/>`;
    if(r.alarm)s+=`<line x1="${X(r.alarm)}" x2="${X(r.alarm)}" y1="30" y2="190" stroke="${COL.red}" stroke-width="2"/><circle cx="${X(r.alarm)}" cy="${Y(r.months[r.alarm-1].meas)}" r="7" fill="none" stroke="${COL.red}" stroke-width="2.5"/>`;
    $('dr-plot').innerHTML=s;};
  const go=scheduler(run);[n,rt,mg].forEach(e=>e.addEventListener('input',go));
  $('reset-drift').addEventListener('click',()=>{n.value=2;rt.value=10;mg.value=5;run();});
  run();
}

/* ----- 14 Alert burden ----- */
const AL_K=[1,2,3,4,6,12];
function initAlerts(){
  if(!$('alerts'))return;
  const au=$('al-auc'),se=$('al-sens'),pt=$('al-patients'),sc=$('al-scores');
  const run=()=>{const k=AL_K[+sc.value],r=alerts(au.value/100,se.value/100,+pt.value,k);
    $('al-auc-value').textContent=(au.value/100).toFixed(2);$('al-sens-value').textContent=se.value+'%';$('al-patients-value').textContent=pt.value+' patients';$('al-scores-value').textContent=k===12?'every hour':k===1?'once a shift':'every '+(12/k)+' hours';
    $('al-per').textContent=r.perShift>=10?Math.round(r.perShift):r.perShift.toFixed(1);$('al-per').closest('div').classList.toggle('ml-bad',r.perShift>=12);
    $('al-real').textContent='1 in '+Math.round(r.oneIn);
    $('al-gap').textContent=r.minutes>=120?(r.minutes/60).toFixed(1)+' h':Math.round(r.minutes)+' min';
    $('al-missed').textContent=pct0(r.missed);
    const real=r.ticks.filter(q=>q.real).length;
    $('al-detail').textContent='In the simulated week shown, this nurse receives '+r.ticks.length+' alerts, of which '+real+(real===1?' is':' are')+' real. A real event is expected about once every '+Math.round(1/r.realPerShift)+' shifts.';
    let s=`<title id="al-plot-title">Alerts over seven shifts</title><desc id="al-plot-desc">${r.ticks.length} alerts for one nurse over seven twelve-hour shifts, ${real} of them real.</desc><g aria-hidden="true" ${MONO} fill="${COL.muted}">`;
    const X=h=>112+h/12*488,Y=i=>30+i*28;
    for(let i=0;i<AL.SHIFTS;i++)s+=`<line x1="112" x2="600" y1="${Y(i)}" y2="${Y(i)}" stroke="${COL.rule}"/><text class="ml-t" x="102" y="${Y(i)+4}" text-anchor="end">shift ${i+1}</text>`;
    for(const h of [0,3,6,9,12])s+=`<text class="ml-t" x="${X(h)}" y="${Y(6)+30}" text-anchor="middle">${h} h</text>`;
    s+='</g>';
    for(const q of r.ticks)if(!q.real)s+=`<line x1="${X(q.h).toFixed(1)}" x2="${X(q.h).toFixed(1)}" y1="${Y(q.s)-8}" y2="${Y(q.s)+8}" stroke="${COL.amber}" stroke-width="2" opacity=".8"/>`;
    for(const q of r.ticks)if(q.real)s+=`<line x1="${X(q.h).toFixed(1)}" x2="${X(q.h).toFixed(1)}" y1="${Y(q.s)-10}" y2="${Y(q.s)+10}" stroke="${COL.green}" stroke-width="4"/>`;
    $('al-plot').innerHTML=s;};
  const go=scheduler(run);[au,se,pt,sc].forEach(e=>e.addEventListener('input',go));
  $('reset-alerts').addEventListener('click',()=>{au.value=90;se.value=90;pt.value=6;sc.value=5;run();});
  run();
}

function init(){initNodule();initSample();initSubgroup();initSlicewise();initPredictive();initShortcut();initDrift();initAlerts();
  // canvas labels use the web font: redraw once it has loaded
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>['nv-position','sl-jitter','pv-spec','sc2-signal'].forEach(id=>{const e=$(id);if(e)e.dispatchEvent(new Event('input'));}));}
window.MLAIAMedLabMore=Core;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
