/* MLAIA Medical AI Lab (/medical-ai/lab/): demo 16, a digital twin of one patient.
   A small mechanistic model of glucose regulation is fitted to one synthetic patient's first months of
   fasting glucose and HbA1c, checked on the months it did not see, then asked "what if" for the next
   12 months. A second patient shows what happens when a twin is used without refitting.

   The model. Fasting glucose sits where the liver's glucose output is balanced by insulin action, which
   is insulin sensitivity times beta-cell response, as in the HOMA model: glucose rises with a "glucose
   load" L = H / (S·B)^0.7. Beta-cell function declines slowly, so L drifts upward. HbA1c follows mean
   glucose (the ADAG relation) with a lag of about two months, plus a personal offset (the glycation gap).
   From fasting glucose and HbA1c alone, sensitivity, beta-cell function and liver output cannot be told
   apart; only their combined effect L can. So the twin fits three numbers: L at month 0, its yearly
   drift and the HbA1c offset. The what-if levers act through S and H with illustrative effect sizes,
   and how strongly this patient responds to them is unknown, which is most of the projection's range.
   All data is synthetic and deterministic (fixed seeds). Illustrative only; not a medical device. */
(function(){
'use strict';
const TAU=2*Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){let a=seed>>>0;const uni=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  const gauss=()=>{let u=0;while(u<1e-12)u=uni();return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*uni());};return{uni,gauss};}

const TW={
  HIST:12,END:24,LAG:2,DT:0.25,
  SG:9,SA:0.15,                          // measurement noise: fasting glucose mg/dL, HbA1c %
  A1C:[0,3,6,9,12],                      // months with an HbA1c test; fasting glucose is monthly
  PAT:{A:{lnL:Math.log(2.3),k:0.11,g:0.2,seed:2101},B:{lnL:Math.log(1.5),k:0.04,g:-0.35,seed:5113}},
  KG:0.025,                              // insulin sensitivity +2.5% per kg lost (illustrative)
  ACT:0.15,                              // +15% sensitivity per 150 min of activity a week (illustrative)
  DRUG:0.2,                              // liver glucose output −20% (illustrative)
  RAMP:3,                                // months for a change to take full effect
  RESP:0.45,                             // spread of this patient's response to each lever (SD, relative)
  DRAWS:400
};
const glu=L=>46.8+46.8*L;                               // fasting glucose, mg/dL
const a1cSS=(G,g)=>(1.1*G/18+2.59)/1.59+g;              // steady-state HbA1c %: ADAG, mean ≈ 1.1 × fasting
// The multiplier on L from the what-if levers at month t, for response factors rw, ra, rd.
function lever(t,w,act,drug,rw,ra,rd){
  if(t<=TW.HIST)return 1;const r=Math.min(1,(t-TW.HIST)/TW.RAMP);
  const S=Math.exp(-TW.KG*w*r*rw)*(1+TW.ACT*act/150*r*ra),H=1-(drug?TW.DRUG*r*rd:0);
  return Math.max(0.05,H)/Math.pow(Math.max(0.05,S),0.7);}
// Trajectory at whole months 0..end: fasting glucose and HbA1c for parameters p={lnL,k,g}.
function traj(p,end,mult){
  const G=[],A=[],L=t=>Math.exp(p.lnL+p.k*t/12)*(mult?mult(t):1),f=1-Math.exp(-TW.DT/TW.LAG);
  let a=a1cSS(glu(L(0)),p.g);
  for(let t=0,step=0;step<=end/TW.DT+1e-9;step++,t=step*TW.DT){
    const Gt=glu(L(t));if(step>0)a+=(a1cSS(Gt,p.g)-a)*f;
    if(Math.abs(t-Math.round(t))<1e-9){G[Math.round(t)]=Gt;A[Math.round(t)]=a;}}
  return{G,A};}
// One patient's measured history, months 0..12.
function patient(key){
  const P=TW.PAT[key],r=rng(P.seed),tr=traj(P,TW.HIST),glucose=[],a1c=[];
  for(let m=0;m<=TW.HIST;m++)glucose.push({m,v:Math.round(tr.G[m]+TW.SG*r.gauss())});
  for(const m of TW.A1C)a1c.push({m,v:Math.round((tr.A[m]+TW.SA*r.gauss())*10)/10});
  return{key,truth:P,glucose,a1c};}
const PATS={A:patient('A'),B:patient('B')};
// Weighted residuals of parameters x=[lnL,k,g] against the measurements before month nFit.
function resid(x,d,nFit){const p={lnL:x[0],k:x[1],g:x[2]},tr=traj(p,TW.HIST),r=[];
  for(const o of d.glucose)if(o.m<nFit)r.push((o.v-tr.G[o.m])/TW.SG);
  for(const o of d.a1c)if(o.m<nFit)r.push((o.v-tr.A[o.m])/TW.SA);return r;}
function solve3(M,b){const a=M.map((row,i)=>[...row,b[i]]);
  for(let i=0;i<3;i++){let mx=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[mx][i]))mx=j;[a[i],a[mx]]=[a[mx],a[i]];
    for(let j=0;j<3;j++)if(j!==i){const f=a[j][i]/a[i][i];for(let k=i;k<4;k++)a[j][k]-=f*a[i][k];}}
  return[a[0][3]/a[0][0],a[1][3]/a[1][1],a[2][3]/a[2][2]];}
function inv3(M){const c=[0,1,2].map(i=>solve3(M,[0,1,2].map(j=>i===j?1:0)));return[0,1,2].map(i=>[0,1,2].map(j=>c[j][i]));}
function jac(x,d,nFit){const r0=resid(x,d,nFit),J=r0.map(()=>[0,0,0]);
  for(let j=0;j<3;j++){const e=1e-5,y=x.slice();y[j]+=e;const r1=resid(y,d,nFit);for(let i=0;i<r0.length;i++)J[i][j]=(r1[i]-r0[i])/e;}return{r0,J};}
function normal(J,r){const M=[[0,0,0],[0,0,0],[0,0,0]],b=[0,0,0];
  for(let i=0;i<J.length;i++)for(let a=0;a<3;a++){b[a]-=J[i][a]*r[i];for(let c=0;c<3;c++)M[a][c]+=J[i][a]*J[i][c];}return{M,b};}
// Fit the twin to the months before nFit (Levenberg–Marquardt); return the estimate and its covariance.
function fit(d,nFit){
  const g0=d.glucose.filter(o=>o.m<nFit),mg=g0.reduce((s,o)=>s+o.v,0)/g0.length;
  let x=[Math.log(Math.max(0.2,(mg-46.8)/46.8)),0,0],lam=1e-3,cost=resid(x,d,nFit).reduce((s,v)=>s+v*v,0);
  for(let it=0;it<60;it++){const{r0,J}=jac(x,d,nFit),{M,b}=normal(J,r0);
    for(let a=0;a<3;a++)M[a][a]*=1+lam;M[2][2]+=1e-9;
    const dx=solve3(M,b),y=x.map((v,i)=>v+dx[i]),c=resid(y,d,nFit).reduce((s,v)=>s+v*v,0);
    if(c<cost){x=y;cost=c;lam=Math.max(1e-7,lam/3);if(Math.max(...dx.map(Math.abs))<1e-7)break;}else lam*=4;}
  const{J}=jac(x,d,nFit),cov=inv3(normal(J,[...J.map(()=>0)]).M);
  return{p:{lnL:x[0],k:x[1],g:x[2]},x,cov};}
function chol3(C){const L=[[0,0,0],[0,0,0],[0,0,0]];
  for(let i=0;i<3;i++)for(let j=0;j<=i;j++){let s=C[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];L[i][j]=i===j?Math.sqrt(Math.max(s,1e-12)):s/L[j][j];}return L;}
const Z=(()=>{const r=rng(9161),z=[];for(let i=0;i<TW.DRAWS;i++)z.push([r.gauss(),r.gauss(),r.gauss(),r.gauss(),r.gauss(),r.gauss()]);return z;})();
const q=(a,p)=>{const s=a.slice().sort((x,y)=>x-y),i=(s.length-1)*p,lo=Math.floor(i);return s[lo]+(s[Math.min(s.length-1,lo+1)]-s[lo])*(i-lo);};
// Held-out error of parameters p against the measurements from month `from` on (mean absolute error).
function heldOut(p,d,from){const tr=traj(p,TW.HIST),g=d.glucose.filter(o=>o.m>=from),a=d.a1c.filter(o=>o.m>=from);
  return{glu:g.reduce((s,o)=>s+Math.abs(o.v-tr.G[o.m]),0)/g.length,a1c:a.length?a.reduce((s,o)=>s+Math.abs(o.v-tr.A[o.m]),0)/a.length:NaN,nA:a.length,nG:g.length};}
// The whole demo for one setting: fit, held-out check, what-if projection with its range, and the trust check.
function twin(nFit,w,act,drug){
  const A=PATS.A,F=fit(A,nFit),L=chol3(F.cov),mult=t=>lever(t,w,act,drug,1,1,1);
  const base=traj(F.p,TW.END),what=traj(F.p,TW.END,mult),band={G:[],A:[]},none={G:[],A:[]};
  const draws=Z.map(z=>{const x=F.x.map((v,i)=>v+L[i][0]*z[0]+L[i][1]*z[1]+L[i][2]*z[2]),p={lnL:x[0],k:x[1],g:x[2]},
    rf=v=>Math.max(0,1+TW.RESP*v);
    return{w:traj(p,TW.END,t=>lever(t,w,act,drug,rf(z[3]),rf(z[4]),rf(z[5]))),f:traj(p,TW.END,mult),n:traj(p,TW.END)};});
  for(let m=TW.HIST;m<=TW.END;m++){
    band.G.push([m,q(draws.map(d=>d.w.G[m]),0.1),q(draws.map(d=>d.w.G[m]),0.9)]);
    band.A.push([m,q(draws.map(d=>d.w.A[m]),0.1),q(draws.map(d=>d.w.A[m]),0.9)]);
    none.A.push([m,q(draws.map(d=>d.n.A[m]),0.1),q(draws.map(d=>d.n.A[m]),0.9)]);}
  const ho=heldOut(F.p,A,nFit);
  // trust check: this twin on patient B as it is, and patient B's own twin fitted the same way
  const FB=fit(PATS.B,nFit),moved=heldOut(F.p,PATS.B,nFit),own=heldOut(FB.p,PATS.B,nFit);
  const end=band.A[band.A.length-1],endNone=none.A[none.A.length-1];
  return{nFit,F,base,what,band,none,ho,FB,moved,own,
    a1c24:what.A[TW.END],a1c24None:base.A[TW.END],lo24:end[1],hi24:end[2],loNone:endNone[1],hiNone:endNone[2],
    a1c12:base.A[TW.HIST],loFix:q(draws.map(d=>d.f.A[TW.END]),0.1),hiFix:q(draws.map(d=>d.f.A[TW.END]),0.9),
    loW:q(draws.map(d=>d.w.A[TW.HIST+3]),0.1),hiW:q(draws.map(d=>d.w.A[TW.HIST+3]),0.9),
    decline:1-Math.exp(-F.p.k/0.7),glu0:glu(Math.exp(F.p.lnL)),
    movedB:traj(F.p,TW.HIST),ownB:traj(FB.p,TW.HIST)};}
const Core={TW,traj,patient,PATS,fit,heldOut,twin,lever,glu,a1cSS};
if(typeof module!=='undefined'&&module.exports){module.exports=Core;return;}

/* ---------- page ---------- */
const $=id=>document.getElementById(id);
const COL={amber:'#66d9f0',blue:'#7aa2ff',fg:'#f4f6fb',muted:'#9fb0cc',rule:'#1f3560',red:'#ff6b6b',green:'#7be0a6'};
const MONO='font-family="&quot;Martian Mono&quot;,ui-monospace,Menlo,monospace"';
function scheduler(fn){let k=0;return()=>{if(k)return;k=requestAnimationFrame(()=>{k=0;fn();});};}
const X=m=>70+m/TW.END*530;
const area=(pts,Y)=>pts.map(p=>X(p[0]).toFixed(1)+','+Y(p[2]).toFixed(1)).join(' ')+' '+pts.slice().reverse().map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ');
const line=(arr,from,to,Y)=>{const s=[];for(let m=from;m<=to;m++)s.push(X(m).toFixed(1)+','+Y(arr[m]).toFixed(1));return s.join(' ');};
function axes(top,bot,lo,hi,ticks,unit,fmt){const Y=v=>bot-(clamp(v,lo,hi)-lo)/(hi-lo)*(bot-top);
  let s=`<g aria-hidden="true" ${MONO} fill="${COL.muted}">`;
  for(const v of ticks)s+=`<line x1="70" x2="600" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${COL.rule}"/><text class="ml-t" x="62" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
  s+=`<text class="ml-t" x="70" y="${top-8}" text-anchor="start">${unit}</text></g>`;return{Y,s};}
function months(y){let s=`<g aria-hidden="true" ${MONO} fill="${COL.muted}">`;for(const m of [0,3,6,9,12,15,18,21,24])s+=`<text class="ml-t" x="${X(m)}" y="${y}" text-anchor="middle">${m}</text>`;return s+'</g>';}
function shade(nFit,top,bot,x=X){return `<rect x="${x(-0.5).toFixed(1)}" y="${top}" width="${(x(nFit-0.5)-x(-0.5)).toFixed(1)}" height="${bot-top}" fill="${COL.fg}" opacity=".05"/>`;}
function dots(obs,nFit,Y,col){return obs.map(o=>o.m<nFit?`<circle cx="${X(o.m).toFixed(1)}" cy="${Y(o.v).toFixed(1)}" r="4" fill="${col}"/>`:`<circle cx="${X(o.m).toFixed(1)}" cy="${Y(o.v).toFixed(1)}" r="4.5" fill="#071122" stroke="${COL.fg}" stroke-width="2"/>`).join('');}
const one=v=>v.toFixed(1),mgdl=v=>Math.round(v)+' mg/dL';

function initTwin(){
  if(!$('twin'))return;
  const nf=$('tw-fit'),wt=$('tw-weight'),ac=$('tw-activity'),dr=$('tw-drug');
  const run=()=>{const nFit=+nf.value,w=+wt.value,act=+ac.value,drug=dr.checked,r=twin(nFit,w,act,drug),A=PATS.A,B=PATS.B;
    $('tw-fit-value').textContent='months 0–'+(nFit-1);
    $('tw-weight-value').textContent=w===0?'no change':(w<0?'lose ':'gain ')+Math.abs(w)+' kg';
    $('tw-activity-value').textContent=act===0?'none added':act+' min a week';
    // main chart: two panels, fasting glucose on top and HbA1c below
    const gA=axes(30,140,80,240,[100,150,200],'fasting glucose, mg/dL',v=>v),aA=axes(190,300,5.5,10,[6,7,8,9,10],'HbA1c, %',v=>v.toFixed(0));
    let s=`<title id="tw-plot-title">The twin fitted to months 0 to ${nFit-1} and projected to month 24</title><desc id="tw-plot-desc">Fasting glucose and HbA1c for one synthetic patient. The twin is fitted to months 0 to ${nFit-1} and checked on months ${nFit} to 12. At month 24 the projected HbA1c is ${one(r.a1c24)}%, with an 80% range of ${one(r.lo24)} to ${one(r.hi24)}%.</desc>`;
    s+=gA.s+aA.s+months(324)+`<text class="ml-t" ${MONO} fill="${COL.muted}" x="335" y="346" text-anchor="middle" aria-hidden="true">months</text>`;
    for(const [top,bot] of [[30,140],[190,300]])s+=shade(nFit,top,bot)+`<line x1="${X(12)}" x2="${X(12)}" y1="${top-6}" y2="${bot}" stroke="${COL.muted}" stroke-dasharray="2 4"/>`;
    s+=`<text class="ml-t" ${MONO} fill="${COL.muted}" x="${X(12)+6}" y="46" aria-hidden="true">today</text>`;
    s+=`<text class="ml-t" ${MONO} fill="${COL.muted}" x="${X(-0.5)+6}" y="134" aria-hidden="true">fitted</text>`;
    s+=`<polygon points="${area(r.band.G,gA.Y)}" fill="${COL.amber}" opacity=".16"/><polygon points="${area(r.band.A,aA.Y)}" fill="${COL.amber}" opacity=".16"/>`;
    for(const [arr,Y] of [[r.base.G,gA.Y],[r.base.A,aA.Y]]){
      s+=`<polyline points="${line(arr,0,nFit-1,Y)}" fill="none" stroke="${COL.blue}" stroke-width="2.5"/>`;
      s+=`<polyline points="${line(arr,nFit-1,12,Y)}" fill="none" stroke="${COL.blue}" stroke-width="2.5" stroke-dasharray="6 4"/>`;
      s+=`<polyline points="${line(arr,12,24,Y)}" fill="none" stroke="${COL.muted}" stroke-width="2" stroke-dasharray="6 4"/>`;}
    s+=`<polyline points="${line(r.what.G,12,24,gA.Y)}" fill="none" stroke="${COL.amber}" stroke-width="2.5"/><polyline points="${line(r.what.A,12,24,aA.Y)}" fill="none" stroke="${COL.amber}" stroke-width="2.5"/>`;
    s+=dots(A.glucose,nFit,gA.Y,COL.blue)+dots(A.a1c,nFit,aA.Y,COL.blue);
    $('tw-plot').innerHTML=s;
    // readouts
    const ho=r.ho;
    $('tw-err').textContent='±'+Math.round(ho.glu)+' mg/dL';
    $('tw-a1c').textContent=one(r.a1c24)+'%';
    $('tw-change').textContent=(Math.abs(r.a1c24-r.a1c24None)<0.05?'0.0':(r.a1c24<r.a1c24None?'−':'+')+one(Math.abs(r.a1c24-r.a1c24None)))+' pts';
    $('tw-range').textContent=one(r.lo24)+'–'+one(r.hi24)+'%';
    $('tw-detail').textContent='Fitted on months 0–'+(nFit-1)+', the twin puts fasting glucose at '+Math.round(r.glu0)+' mg/dL at month 0, rising as beta-cell function declines by about '+Math.round(r.decline*100)+'% a year. On the '+ho.nG+' held-out months it is off by '+Math.round(ho.glu)+' mg/dL on average'+(ho.nA?', and by '+ho.a1c.toFixed(2)+' points on '+(ho.nA===1?'the held-out HbA1c test':'the '+ho.nA+' held-out HbA1c tests'):'')+', close to the '+TW.SG+' mg/dL and '+TW.SA.toFixed(2)+' points of test-to-test noise. '+
      ((w||act||drug)?'With the changes you set, HbA1c at month 24 is '+one(r.a1c24)+'% against '+one(r.a1c24None)+'% with no change. The 80% range is '+one(r.lo24)+' to '+one(r.hi24)+'%. Part of it is how strongly this patient will respond, which the twin has never seen: with the population effect sizes taken as exact, the range would be '+one(r.loFix)+' to '+one(r.hiFix)+'%. The rest is the uncertainty in the twin itself.':
      'With no change, HbA1c is projected at '+one(r.a1c24None)+'% at month 24, 80% range '+one(r.lo24)+' to '+one(r.hi24)+'%. The range widens with the horizon.');
    // trust check: patient B
    const gB=axes(30,170,80,240,[100,150,200],'patient B, fasting glucose, mg/dL',v=>v);
    let t=`<title id="tw-trust-title">This twin on another patient</title><desc id="tw-trust-desc">Patient B's fasting glucose with the first patient's twin, not refitted, and patient B's own twin. Held-out error ${Math.round(r.moved.glu)} against ${Math.round(r.own.glu)} mg/dL.</desc>`;
    
    t+=`<g aria-hidden="true" ${MONO} fill="${COL.muted}">`;for(const m of [0,3,6,9,12])t+=`<text class="ml-t" x="${70+m/12*530}" y="194" text-anchor="middle">${m}</text>`;t+='</g>';
    const XB=m=>70+m/12*530,lineB=(arr,Y)=>arr.map((v,m)=>XB(m).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
    t+=gB.s+shade(nFit,30,170,XB);
    t+=`<polyline points="${lineB(r.movedB.G,gB.Y)}" fill="none" stroke="${COL.red}" stroke-width="2.5" stroke-dasharray="6 4"/>`;
    t+=`<polyline points="${lineB(r.ownB.G,gB.Y)}" fill="none" stroke="${COL.blue}" stroke-width="2.5"/>`;
    t+=B.glucose.map(o=>o.m<nFit?`<circle cx="${XB(o.m).toFixed(1)}" cy="${gB.Y(o.v).toFixed(1)}" r="4" fill="${COL.blue}"/>`:`<circle cx="${XB(o.m).toFixed(1)}" cy="${gB.Y(o.v).toFixed(1)}" r="4.5" fill="#071122" stroke="${COL.fg}" stroke-width="2"/>`).join('');
    $('tw-trust').innerHTML=t;
    $('tw-own').textContent='±'+Math.round(ho.glu)+' mg/dL';
    $('tw-moved').textContent='±'+Math.round(r.moved.glu)+' mg/dL';$('tw-moved').closest('div').classList.add('ml-bad');
    $('tw-refit').textContent='±'+Math.round(r.own.glu)+' mg/dL';
    $('tw-trust-detail').textContent='Used on patient B as it is, the twin is off by '+Math.round(r.moved.glu)+' mg/dL on months '+nFit+'–12, '+(r.moved.glu/Math.max(1,ho.glu)).toFixed(0)+' times its error on its own patient. Refitted to patient B’s own first '+nFit+' months, the error is '+Math.round(r.own.glu)+' mg/dL. A twin belongs to the patient it was fitted to.';};
  const go=scheduler(run);[nf,wt,ac].forEach(e=>e.addEventListener('input',go));dr.addEventListener('change',go);
  $('reset-twin').addEventListener('click',()=>{nf.value=9;wt.value=0;ac.value=0;dr.checked=false;run();});
  run();
}
window.MLAIAMedLabTwin=Core;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initTwin);else initTwin();
})();
