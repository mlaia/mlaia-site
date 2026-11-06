/* MLAIA Causal Inference Lab (/predictive-intelligence/lab/): source for the inline scripts.
   build_causal_lab_pages.py cuts this file at the //@@ markers and inlines "common" plus the demo
   block(s) each page needs: the hub gets all five, each /predictive-intelligence/lab/<slug>/ page one.
   All data is synthetic and deterministic (fixed seeds), generated and analysed in the browser;
   nothing is uploaded. Each block has a pure model function (also run in node by the build script,
   to fill the numbers quoted in the page copy) and an init function that wires the controls.
   Illustrative only: constructed populations, not results from any real project. */
//@@common
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sig=x=>1/(1+Math.exp(-x));
function rng(seed){let a=seed>>>0;const uni=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  const gauss=()=>{let u=0;while(u<1e-12)u=uni();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*uni());};return{uni,gauss};}
const sgn=(r,d)=>(r<0?'−':'+')+Math.abs(r).toFixed(d);
const pts=v=>sgn(Math.round(v*1000)/10,1)+' pts';      // difference between two rates, in percentage points
const pct=v=>(v*100).toFixed(1)+'%';
const pct0=v=>Math.round(v*100)+'%';
const int=v=>Math.round(v).toLocaleString('en-US');
const sint=v=>{const r=Math.round(v);return(r<0?'−':'+')+Math.abs(r).toLocaleString('en-US');};
const snum=v=>sgn(Math.round(v*10)/10,1);
const API={},FACTS={};
const $=id=>document.getElementById(id);
const COL={amber:'#ffb547',blue:'#71d4ff',fg:'#eceee9',muted:'#9ca39d',rule:'#262b28',red:'#ff6b6b',green:'#7be0a6'};
const MONO='font-family="&quot;Martian Mono&quot;,ui-monospace,Menlo,monospace"';
// coalesce bursts of input events into one recompute per frame
function scheduler(fn){let q=0;return()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;fn();});};}
const bar=(label,frac,cls,val,cur)=>`<div class="ml-bar${cur===false?'':' is-current'}"><span>${label}</span><div class="ml-bar__track"><b class="${cls}" style="width:${(clamp(frac,0,1)*100).toFixed(1)}%"></b></div><strong>${val}</strong></div>`;
const group=(label,cur)=>`<p class="ml-bars__group${cur?' is-current':''}">${label}</p>`;
function frame(x0,x1,y0,y1,xt,yt,xl,yl){ // plot frame: horizontal grid lines, tick labels, axis titles
  let s=`<g aria-hidden="true" ${MONO} fill="${COL.muted}">`;
  for(const [y,l] of yt)s+=`<line x1="${x0}" x2="${x1}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${COL.rule}"/><text class="ml-t" x="${x0-8}" y="${(y+4).toFixed(1)}" text-anchor="end">${l}</text>`;
  for(const [x,l] of xt)s+=`<text class="ml-t" x="${x.toFixed(1)}" y="${y1+18}" text-anchor="middle">${l}</text>`;
  s+=`<line x1="${x0}" x2="${x0}" y1="${y0}" y2="${y1}" stroke="${COL.rule}"/>`;
  if(xl)s+=`<text class="ml-t" x="${(x0+x1)/2}" y="${y1+40}" text-anchor="middle">${xl}</text>`;
  if(yl)s+=`<text class="ml-t" x="${x0-8}" y="${y0-12}" text-anchor="start">${yl}</text>`;
  return s+'</g>';}
function niceStep(span,n){const raw=span/n,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p;}

//@@simpson
/* ---------- 01 Confounding and Simpson's paradox ----------
   20,000 synthetic accounts. Half are "at risk" (the hidden variable). A success-team call raises the
   chance of renewal by 8 points in both segments, but calls go mostly to at-risk accounts, which
   renew less whether called or not. Each account keeps the same three random draws for every
   slider position, so moving the slider changes who is called and nothing else. */
const SP=(()=>{const N=20000,r=rng(20261),uz=[],ut=[],uy=[];for(let i=0;i<N;i++){uz.push(r.uni());ut.push(r.uni());uy.push(r.uni());}return{N,uz,ut,uy,BASE:[0.80,0.40],EFFECT:0.08};})();
function simpsonModel(strength){
  const s=clamp(strength,0,1),{N,uz,ut,uy,BASE,EFFECT}=SP,n=[[0,0],[0,0]],k=[[0,0],[0,0]];let gain=0;
  for(let i=0;i<N;i++){
    const z=uz[i]<0.5?1:0,t=ut[i]<(z?0.5+0.4*s:0.5-0.4*s)?1:0,y0=uy[i]<BASE[z]?1:0,y1=uy[i]<BASE[z]+EFFECT?1:0;
    gain+=y1-y0;n[z][t]++;k[z][t]+=t?y1:y0;}
  const rate=(z,t)=>k[z][t]/n[z][t],nT=n[0][1]+n[1][1],nC=n[0][0]+n[1][0];
  const pooledT=(k[0][1]+k[1][1])/nT,pooledC=(k[0][0]+k[1][0])/nC;
  const dHealthy=rate(0,1)-rate(0,0),dRisk=rate(1,1)-rate(1,0);
  const adjusted=((n[0][0]+n[0][1])*dHealthy+(n[1][0]+n[1][1])*dRisk)/N;
  return{N,nT,nC,pooledT,pooledC,pooled:pooledT-pooledC,
    healthyT:rate(0,1),healthyC:rate(0,0),riskT:rate(1,1),riskC:rate(1,0),dHealthy,dRisk,adjusted,
    truth:gain/N,riskAmongT:n[1][1]/nT,riskAmongC:n[1][0]/nC,pRisk:0.5+0.4*s,pHealthy:0.5-0.4*s};}
API.simpsonModel=simpsonModel;
FACTS.simpson=()=>{const m=simpsonModel(0.75);let flip=null;for(let v=0;v<=100;v+=5){if(simpsonModel(v/100).pooled<0){flip=v;break;}}
  return{n:int(m.N),nT:int(m.nT),nC:int(m.nC),pooledT:pct(m.pooledT),pooledC:pct(m.pooledC),pooled:pts(m.pooled),
    healthyT:pct(m.healthyT),healthyC:pct(m.healthyC),riskT:pct(m.riskT),riskC:pct(m.riskC),dHealthy:pts(m.dHealthy),dRisk:pts(m.dRisk),
    adjusted:pts(m.adjusted),truth:pts(m.truth),riskAmongT:pct0(m.riskAmongT),riskAmongC:pct0(m.riskAmongC),
    pRisk:pct0(m.pRisk),pHealthy:pct0(m.pHealthy),flip:flip+'%',zero:pts(simpsonModel(0).pooled),_raw:{pooled:m.pooled,adjusted:m.adjusted,truth:m.truth,dRisk:m.dRisk,dHealthy:m.dHealthy,flip}};};
function initSimpson(){
  if(!$('simpson'))return;
  const st=$('sp-strength'),radios=[...document.querySelectorAll('input[name="sp-view"]')];
  const run=()=>{
    const m=simpsonModel(st.value/100),strat=radios.some(r=>r.checked&&r.value==='strat');
    $('sp-strength-value').textContent=st.value+'%';
    $('sp-bars').innerHTML=group('All accounts together',!strat)+bar('Called',m.pooledT,'ml-b-blue',pct(m.pooledT),!strat)+bar('Not called',m.pooledC,'ml-b-fg',pct(m.pooledC),!strat)+
      group('At-risk accounts only',strat)+bar('Called',m.riskT,'ml-b-blue',pct(m.riskT),strat)+bar('Not called',m.riskC,'ml-b-fg',pct(m.riskC),strat)+
      group('Healthy accounts only',strat)+bar('Called',m.healthyT,'ml-b-blue',pct(m.healthyT),strat)+bar('Not called',m.healthyC,'ml-b-fg',pct(m.healthyC),strat);
    $('sp-pooled').textContent=pts(m.pooled);$('sp-pooled').closest('div').classList.toggle('ml-bad',m.pooled<0);
    $('sp-risk').textContent=pts(m.dRisk);$('sp-healthy').textContent=pts(m.dHealthy);
    $('sp-adjusted').textContent=pts(m.adjusted);$('sp-truth').textContent=pts(m.truth);
    $('sp-mix').textContent=pct0(m.riskAmongT)+' / '+pct0(m.riskAmongC);
    $('sp-design').textContent=pct0(m.pRisk)+' of at-risk accounts and '+pct0(m.pHealthy)+' of healthy accounts are called: '+int(m.nT)+' called, '+int(m.nC)+' not called.';
    $('sp-verdict').textContent=m.pooled<0?'Pooled, the call looks harmful. Within each segment it helps. The pooled comparison has the wrong sign because called accounts are mostly at-risk accounts.':
      Math.abs(m.pooled-m.truth)>0.02?'The pooled comparison has the right sign but the wrong size: part of the call’s effect is hidden by who gets called.':
      'With calls spread almost evenly across segments, the pooled comparison and the within-segment comparison agree.';
  };
  const go=scheduler(run);st.addEventListener('input',go);radios.forEach(r=>r.addEventListener('change',go));
  $('reset-simpson').addEventListener('click',()=>{st.value=75;radios.forEach(r=>r.checked=r.value==='pooled');run();});
  run();
}

//@@abobs
/* ---------- 02 A/B test vs observational comparison ----------
   50,000 synthetic customers, each with a prior propensity to buy. The campaign adds the same lift to
   everyone's purchase probability. The same customers are measured twice: once with the campaign
   assigned by coin flip, once with the campaign sent preferentially to high-propensity customers. */
const AB=(()=>{const N=50000,r=rng(20262),z=[],uy=[],ur=[],uo=[];for(let i=0;i<N;i++){z.push(r.gauss());uy.push(r.uni());ur.push(r.uni());uo.push(r.uni());}
  const order=z.map((_,i)=>i).sort((a,b)=>z[a]-z[b]),band=new Array(N);order.forEach((idx,rank)=>{band[idx]=Math.min(9,Math.floor(rank*10/N));});
  return{N,z,uy,ur,uo,band,MIN_CELL:30};})();
function abobsModel(strength,liftPts){
  const k=3*clamp(strength,0,1),lift=clamp(liftPts,0,10)/100,{N,z,uy,ur,uo,band,MIN_CELL}=AB;
  const acc=()=>({n:0,y:0}),rT=acc(),rC=acc(),oT=acc(),oC=acc(),bT=[],bC=[];for(let b=0;b<10;b++){bT.push(acc());bC.push(acc());}
  let gain=0,base=0;
  for(let i=0;i<N;i++){
    const p0=sig(-1.4+0.9*z[i]),y0=uy[i]<p0?1:0,y1=uy[i]<Math.min(0.99,p0+lift)?1:0;gain+=y1-y0;base+=y0;
    if(ur[i]<0.5){rT.n++;rT.y+=y1;}else{rC.n++;rC.y+=y0;}
    if(uo[i]<sig(k*z[i])){oT.n++;oT.y+=y1;bT[band[i]].n++;bT[band[i]].y+=y1;}else{oC.n++;oC.y+=y0;bC[band[i]].n++;bC[band[i]].y+=y0;}}
  const pT=rT.y/rT.n,pC=rC.y/rC.n,ab=pT-pC,se=Math.sqrt(pT*(1-pT)/rT.n+pC*(1-pC)/rC.n);
  let w=0,sum=0,used=0;const share=[];
  for(let b=0;b<10;b++){const t=bT[b],c=bC[b];share.push(t.n/(t.n+c.n));
    if(t.n>=MIN_CELL&&c.n>=MIN_CELL){used++;w+=t.n+c.n;sum+=(t.n+c.n)*(t.y/t.n-c.y/c.n);}}
  return{N,truth:gain/N,baseRate:base/N,ab,abLo:ab-1.96*se,abHi:ab+1.96*se,nRT:rT.n,nRC:rC.n,
    obsT:oT.y/oT.n,obsC:oC.y/oC.n,obs:oT.y/oT.n-oC.y/oC.n,nOT:oT.n,nOC:oC.n,
    adjusted:used?sum/w:NaN,bandsUsed:used,share};}
API.abobsModel=abobsModel;
FACTS.abobs=()=>{const m=abobsModel(0.5,3),z0=abobsModel(0.5,0);
  return{n:int(m.N),truth:pts(m.truth),baseRate:pct(m.baseRate),ab:pts(m.ab),abLo:pts(m.abLo),abHi:pts(m.abHi),obs:pts(m.obs),obsT:pct(m.obsT),obsC:pct(m.obsC),
    adjusted:pts(m.adjusted),bandsUsed:String(m.bandsUsed),ratio:(m.obs/m.truth).toFixed(1),nOT:int(m.nOT),nOC:int(m.nOC),
    shareLow:pct0(m.share[0]),shareHigh:pct0(m.share[9]),zeroObs:pts(z0.obs),zeroAb:pts(z0.ab),_raw:{truth:m.truth,ab:m.ab,obs:m.obs,adjusted:m.adjusted,lo:m.abLo,hi:m.abHi}};};
function initAbobs(){
  if(!$('abobs'))return;
  const st=$('ab-strength'),lf=$('ab-lift');
  const run=()=>{
    const m=abobsModel(st.value/100,+lf.value);
    $('ab-strength-value').textContent=st.value+'%';$('ab-lift-value').textContent=(+lf.value).toFixed(1)+' pts';
    const adj=isNaN(m.adjusted)?0:m.adjusted,top=Math.max(0.01,m.truth,m.ab,m.obs,adj);
    $('ab-bars').innerHTML=bar('True effect',m.truth/top,'ml-b-fg',pts(m.truth))+bar('Randomised test',m.ab/top,'ml-b-blue',pts(m.ab))+
      bar('Observational',m.obs/top,'cl-b-amber',pts(m.obs))+bar('Observational, adjusted',adj/top,'cl-b-green',isNaN(m.adjusted)?'n/a':pts(m.adjusted));
    $('ab-true').textContent=pts(m.truth);$('ab-ab').textContent=pts(m.ab);$('ab-ci').textContent=pts(m.abLo).replace(' pts','')+' to '+pts(m.abHi).replace(' pts','');
    $('ab-obs').textContent=pts(m.obs);$('ab-obs').closest('div').classList.toggle('ml-bad',Math.abs(m.obs-m.truth)>0.02);
    $('ab-adj').textContent=isNaN(m.adjusted)?'n/a':pts(m.adjusted);$('ab-bands').textContent=m.bandsUsed+' of 10';
    $('ab-groups').textContent='Observational comparison: '+int(m.nOT)+' customers received the campaign and '+pct(m.obsT)+' of them bought; '+int(m.nOC)+' did not receive it and '+pct(m.obsC)+' of them bought.';
    $('ab-verdict').textContent=Math.abs(m.obs-m.truth)<=0.01?'With targeting this weakly tied to prior propensity, the observational comparison is close to the true effect.':
      m.truth<0.0005?'The campaign does nothing here, and the observational comparison still reports a positive effect: it is measuring who was targeted.':
      'The observational comparison reports '+(m.obs/m.truth).toFixed(1)+' times the true effect. The extra is the difference between the customers who were targeted and those who were not.';
    // share of each propensity band that received the campaign
    const X=b=>78+b*62,Y=v=>190-v*150;
    let s=`<title id="ab-plot-title">Share of customers who received the campaign, by prior propensity</title><desc id="ab-plot-desc">Lowest band ${pct0(m.share[0])}, highest band ${pct0(m.share[9])}. The randomised test gives every band 50%.</desc>`+
      frame(68,700,40,190,m.share.map((_,b)=>[X(b)+25,String(b+1)]),[[Y(0),'0'],[Y(.5),'50%'],[Y(1),'100%']],'prior propensity band (1 = lowest, 10 = highest)','share receiving the campaign');
    m.share.forEach((v,b)=>{s+=`<rect x="${X(b)}" y="${Y(v).toFixed(1)}" width="50" height="${(190-Y(v)).toFixed(1)}" fill="${COL.amber}"/>`;});
    s+=`<line x1="68" x2="700" y1="${Y(.5)}" y2="${Y(.5)}" stroke="${COL.blue}" stroke-width="2" stroke-dasharray="6 5"/>`;
    $('ab-plot').innerHTML=s;
  };
  const go=scheduler(run);st.addEventListener('input',go);lf.addEventListener('input',go);
  $('reset-abobs').addEventListener('click',()=>{st.value=50;lf.value=3;run();});
  run();
}

//@@uplift
/* ---------- 03 Uplift modelling: churn-risk ranking vs uplift ranking ----------
   40,000 synthetic customers with two observed features: usage decline (drives churn risk) and past
   response to offers (drives how much a retention offer helps). 20,000 took part in a randomised
   pilot; both scores are fitted on the pilot in a 5 x 5 grid of segments: the churn score is the
   churn rate without the offer, the uplift score is that rate minus the churn rate with the offer.
   The other 20,000 are ranked by each score. Their outcomes with and without the offer are both
   known, because the data is simulated, so the customers each ranking retains can be counted. */
const UP=(()=>{const N=40000,r=rng(20263),a=[],b=[],uy=[],ut=[];for(let i=0;i<N;i++){a.push(r.uni());b.push(r.uni());uy.push(r.uni());ut.push(r.uni());}return{N,a,b,uy,ut,cache:{}};})();
function upliftCurves(lost){
  const key=lost?'lost':'flat';if(UP.cache[key])return UP.cache[key];
  const {N,a,b,uy,ut}=UP,cT=[],cC=[];for(let c=0;c<25;c++){cT.push({n:0,y:0});cC.push({n:0,y:0});}
  const cell=i=>Math.min(4,Math.floor(a[i]*5))*5+Math.min(4,Math.floor(b[i]*5));
  const probs=i=>{const p0=sig(-2.2+4.4*a[i]),shape=lost?0.35+0.65*4*p0*(1-p0):p0,tau=Math.min(0.8*p0,0.30*b[i]*shape-0.04*(1-b[i]));return[p0,p0-tau];};
  for(let i=0;i<N;i+=2){const [p0,p1]=probs(i),c=cell(i);if(ut[i]<0.5){cT[c].n++;cT[c].y+=uy[i]<p1?1:0;}else{cC[c].n++;cC[c].y+=uy[i]<p0?1:0;}}
  const riskScore=cC.map(c=>c.y/c.n),upliftScore=cC.map((c,j)=>c.y/c.n-cT[j].y/cT[j].n);
  const idx=[],gain=[];let churners=0;
  for(let i=1;i<N;i+=2){const [p0,p1]=probs(i),y0=uy[i]<p0?1:0,y1=uy[i]<p1?1:0;idx.push(i);gain.push(y0-y1);churners+=y0;}
  const H=idx.length,curve=score=>{const ord=idx.map((_,j)=>j).sort((p,q)=>score[cell(idx[q])]-score[cell(idx[p])]||p-q),out=[0];let cum=0;
    for(let j=0;j<H;j++){cum+=gain[ord[j]];if((j+1)%(H/20)===0)out.push(cum);}return out;};
  const risk=curve(riskScore),uplift=curve(upliftScore),total=risk[20];
  return UP.cache[key]={H,churners,risk,uplift,total,random:risk.map((_,s)=>total*s/20)};}
function upliftModel(budgetPct,lost){
  const c=upliftCurves(lost!==false),s=clamp(Math.round(budgetPct/5),1,20),offers=c.H*s/20;let best=0;for(let j=1;j<=20;j++)if(c.uplift[j]>c.uplift[best])best=j;
  return{H:c.H,churners:c.churners,offers,risk:c.risk[s],uplift:c.uplift[s],random:c.random[s],total:c.total,
    per100Risk:c.risk[s]/offers*100,per100Uplift:c.uplift[s]/offers*100,bestPct:best*5,bestGain:c.uplift[best],curves:c};}
API.upliftModel=upliftModel;
FACTS.uplift=()=>{const m=upliftModel(20,true),f=upliftModel(20,false);
  return{h:int(m.H),churners:int(m.churners),offers:int(m.offers),risk:int(m.risk),uplift:int(m.uplift),random:int(m.random),total:int(m.total),diff:int(m.uplift-m.risk),
    per100Risk:m.per100Risk.toFixed(1),per100Uplift:m.per100Uplift.toFixed(1),ratio:(m.uplift/m.risk).toFixed(1),bestPct:m.bestPct+'%',bestGain:int(m.bestGain),
    flatRisk:int(f.risk),flatUplift:int(f.uplift),_raw:{risk:m.risk,uplift:m.uplift,random:m.random,total:m.total,bestGain:m.bestGain,bestPct:m.bestPct,flatRisk:f.risk,flatUplift:f.uplift}};};
function initUplift(){
  if(!$('uplift'))return;
  const bd=$('up-budget'),lost=$('up-lost');
  const run=()=>{
    const m=upliftModel(+bd.value,lost.checked),c=m.curves;
    $('up-budget-value').textContent=bd.value+'%';
    $('up-offers').textContent=int(m.offers);$('up-uplift').textContent=sint(m.uplift);$('up-risk').textContent=sint(m.risk);$('up-random').textContent=sint(m.random);
    $('up-per-uplift').textContent=m.per100Uplift.toFixed(1);$('up-per-risk').textContent=m.per100Risk.toFixed(1);
    $('up-risk').closest('div').classList.toggle('ml-warn',m.risk<m.uplift-0.5);
    const d=m.uplift-m.risk;
    $('up-verdict').textContent=+bd.value>=100?'With an offer for everyone the ranking no longer matters: every strategy retains the same '+int(m.total)+' customers.':
      d>0.5?'With '+int(m.offers)+' offers, ranking by uplift retains '+int(d)+' more customers than ranking by churn risk.':
      d<-0.5?'At this budget, ranking by churn risk retains '+int(-d)+' more customers than the uplift score fitted on the pilot.':'At this budget the two rankings retain the same number of customers.';
    $('up-best').textContent='The uplift ranking retains the most customers, '+int(m.bestGain)+', when '+m.bestPct+'% receive the offer'+(m.bestPct<100?'. Beyond that the offer reaches customers it makes more likely to leave.':'.');
    const all=c.risk.concat(c.uplift),hi=Math.max(10,...all),lo=Math.min(0,...all),step=niceStep(hi-lo,4),y1=Math.ceil(hi/step)*step,y0=Math.floor(lo/step)*step;
    const X=s=>80+s/20*620,Y=v=>230-(v-y0)/(y1-y0)*190,yt=[];for(let v=y0;v<=y1+1e-9;v+=step)yt.push([Y(v),int(v)]);
    const line=(arr,col,dash)=>`<polyline points="${arr.map((v,s)=>X(s).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5"${dash?' stroke-dasharray="6 5"':''}/>`;
    const sx=Math.round(bd.value/5);
    let s=`<title id="up-plot-title">Extra customers retained against share of customers who get the offer</title><desc id="up-plot-desc">At ${bd.value}% of customers: uplift ranking ${int(m.uplift)}, churn-risk ranking ${int(m.risk)}, random ${int(m.random)}.</desc>`+
      frame(80,700,40,230,[0,5,10,15,20].map(v=>[X(v),v*5+'%']),yt,'share of customers who get the offer','extra customers retained');
    s+=line(c.random,COL.muted,true)+line(c.risk,COL.amber)+line(c.uplift,COL.blue);
    s+=`<line x1="${X(sx)}" x2="${X(sx)}" y1="40" y2="230" stroke="${COL.fg}" stroke-dasharray="3 4" opacity=".7"/>`;
    s+=`<circle cx="${X(sx)}" cy="${Y(m.risk).toFixed(1)}" r="5" fill="${COL.amber}"/><circle cx="${X(sx)}" cy="${Y(m.uplift).toFixed(1)}" r="5" fill="${COL.blue}"/>`;
    $('up-plot').innerHTML=s;
  };
  const go=scheduler(run);bd.addEventListener('input',go);lost.addEventListener('change',go);
  $('reset-uplift').addEventListener('click',()=>{bd.value=20;lost.checked=true;run();});
  run();
}

//@@did
/* ---------- 04 Difference-in-differences and the parallel-trends assumption ----------
   Weekly orders in two synthetic regions for 36 weeks. A feature launches in one region after week
   24. Both regions share a trend of +0.5 orders a week; the slider gives the launch region an extra
   trend of its own, which breaks the assumption the estimate rests on. The noise is fixed by a seed. */
const DD=(()=>{const W=36,L=24,r=rng(20264),eT=[],eC=[];for(let t=0;t<W;t++){eT.push(r.gauss()*3);eC.push(r.gauss()*3);}return{W,L,eT,eC};})();
function didModel(extraTrend,effect){
  const {W,L,eT,eC}=DD,T=[],C=[];
  for(let t=0;t<W;t++){T.push(100+(0.5+extraTrend)*(t+1)+eT[t]+(t>=L?effect:0));C.push(80+0.5*(t+1)+eC[t]);}
  const avg=(arr,a,b)=>{let s=0;for(let t=a;t<b;t++)s+=arr[t];return s/(b-a);};
  const beforeAfter=avg(T,L,W)-avg(T,0,L),did=beforeAfter-(avg(C,L,W)-avg(C,0,L));
  const placebo=(avg(T,L/2,L)-avg(T,0,L/2))-(avg(C,L/2,L)-avg(C,0,L/2));
  let sx=0,sy=0,sxx=0,sxy=0;for(let t=0;t<L;t++){const g=T[t]-C[t];sx+=t;sy+=g;sxx+=t*t;sxy+=t*g;}
  const gapSlope=(L*sxy-sx*sy)/(L*sxx-sx*sx),gap=avg(T,0,L)-avg(C,0,L),cf=C.map(v=>v+gap);
  return{W,L,T,C,cf,truth:effect,did,beforeAfter,placebo,gapSlope,error:did-effect};}
API.didModel=didModel;
FACTS.did=()=>{const m=didModel(0,12);
  return{truth:snum(m.truth),did:snum(m.did),beforeAfter:snum(m.beforeAfter),placebo:snum(m.placebo),gapSlope:sgn(Math.round(m.gapSlope*100)/100,2),error:snum(m.error),
    _raw:{did:m.did,beforeAfter:m.beforeAfter,placebo:m.placebo,gapSlope:m.gapSlope}};};
function initDid(){
  if(!$('did'))return;
  const tr=$('dd-trend'),ef=$('dd-effect');
  const run=()=>{
    const d=+tr.value,m=didModel(d,+ef.value);
    $('dd-trend-value').textContent=sgn(d,1)+' / week';$('dd-effect-value').textContent=sgn(+ef.value,0)+' orders';
    $('dd-true').textContent=snum(m.truth);$('dd-did').textContent=snum(m.did);$('dd-did').closest('div').classList.toggle('ml-bad',Math.abs(m.error)>4);
    $('dd-ba').textContent=snum(m.beforeAfter);$('dd-placebo').textContent=snum(m.placebo);$('dd-placebo').closest('div').classList.toggle('ml-warn',Math.abs(m.placebo)>4);
    $('dd-slope').textContent=sgn(Math.round(m.gapSlope*100)/100,2);$('dd-error').textContent=snum(m.error);
    $('dd-verdict').textContent=Math.abs(m.error)<=4?'Difference-in-differences lands within 4 orders a week of the true effect. Compare it with the placebo estimate: a placebo far from zero means the regions were not moving in parallel before the launch.':
      'The launch region was already '+(d>0?'pulling away from':'falling behind')+' the comparison region before the launch. Difference-in-differences books that drift as launch effect and is off by '+snum(m.error)+' orders a week. The placebo estimate on pre-launch weeks shows the problem.';
    const all=m.T.concat(m.C,m.cf.slice(m.L)),hi=Math.max(...all),lo=Math.min(...all),step=niceStep(hi-lo,4),y0=Math.floor(lo/step)*step,y1=Math.ceil(hi/step)*step;
    const X=t=>80+t/(m.W-1)*620,Y=v=>230-(v-y0)/(y1-y0)*190,yt=[];for(let v=y0;v<=y1+1e-9;v+=step)yt.push([Y(v),int(v)]);
    const line=(arr,from,col,dash)=>`<polyline points="${arr.map((v,t)=>t<from?'':X(t).toFixed(1)+','+Y(v).toFixed(1)).join(' ').trim()}" fill="none" stroke="${col}" stroke-width="2.5"${dash?' stroke-dasharray="6 5"':''}/>`;
    const lx=(X(m.L-1)+X(m.L))/2;
    let s=`<title id="dd-plot-title">Weekly orders in the launch region and the comparison region</title><desc id="dd-plot-desc">Launch after week ${m.L}. Difference-in-differences estimate ${snum(m.did)} orders a week; true effect ${snum(m.truth)}.</desc>`+
      frame(80,700,40,230,[1,6,12,18,24,30,36].map(w=>[X(w-1),String(w)]),yt,'week','orders per week');
    s+=`<line x1="${lx.toFixed(1)}" x2="${lx.toFixed(1)}" y1="40" y2="230" stroke="${COL.muted}" stroke-dasharray="3 4"/><text class="ml-t" ${MONO} fill="${COL.muted}" x="${(lx+8).toFixed(1)}" y="52" aria-hidden="true">launch</text>`;
    s+=line(m.C,0,COL.amber)+line(m.cf,m.L,COL.fg,true)+line(m.T,0,COL.blue);
    $('dd-plot').innerHTML=s;
  };
  const go=scheduler(run);tr.addEventListener('input',go);ef.addEventListener('input',go);
  $('reset-did').addEventListener('click',()=>{tr.value=0;ef.value=12;run();});
  run();
}

//@@ladder
/* ---------- 05 The ladder of causality: one dataset, three questions ----------
   10,000 synthetic customers. 40% are at risk. A retention offer raises the chance of renewal by 25
   points for at-risk customers and 5 points for the rest, and goes mostly to at-risk customers.
   Each customer has both outcomes fixed in advance (renews without the offer, renews with it), so
   all three rungs can be answered exactly and compared with what the observed data alone supports. */
const LD=(()=>{const N=10000,r=rng(20265),uz=[],ut=[],uy=[];for(let i=0;i<N;i++){uz.push(r.uni());ut.push(r.uni());uy.push(r.uni());}return{N,uz,ut,uy,BASE:[0.80,0.35],EFFECT:[0.05,0.25],P_HEALTHY:0.15};})();
function ladderModel(targetRisk){
  const q=clamp(targetRisk,0.05,0.95),{N,uz,ut,uy,BASE,EFFECT,P_HEALTHY}=LD,n=[[0,0],[0,0]],k=[[0,0],[0,0]];let s0=0,s1=0,anyway=0;
  for(let i=0;i<N;i++){
    const z=uz[i]<0.4?1:0,x=ut[i]<(z?q:P_HEALTHY)?1:0,y0=uy[i]<BASE[z]?1:0,y1=uy[i]<BASE[z]+EFFECT[z]?1:0;
    s0+=y0;s1+=y1;n[z][x]++;k[z][x]+=x?y1:y0;if(x&&y1&&y0)anyway++;}
  const nX=n[0][1]+n[1][1],nNo=n[0][0]+n[1][0],kX=k[0][1]+k[1][1],seenX=kX/nX,seenNo=(k[0][0]+k[1][0])/nNo;
  let adj=0,estAnyway=0;
  for(let z=0;z<2;z++){const r1=k[z][1]/n[z][1],r0=k[z][0]/n[z][0];adj+=(n[z][0]+n[z][1])/N*(r1-r0);estAnyway+=k[z][1]*Math.min(1,r0/r1);}
  return{N,nX,nNo,seenX,seenNo,seeing:seenX-seenNo,doAll:s1/N,doNone:s0/N,doing:(s1-s0)/N,doingEst:adj,
    renewedOffered:kX,anyway:anyway/kX,because:1-anyway/kX,becauseEst:1-estAnyway/kX,riskAmongX:n[1][1]/nX,riskAmongNo:n[1][0]/nNo};}
API.ladderModel=ladderModel;
FACTS.ladder=()=>{const m=ladderModel(0.70),e=ladderModel(0.15);
  return{n:int(m.N),nX:int(m.nX),nNo:int(m.nNo),seenX:pct(m.seenX),seenNo:pct(m.seenNo),seeing:pts(m.seeing),doAll:pct(m.doAll),doNone:pct(m.doNone),doing:pts(m.doing),doingEst:pts(m.doingEst),
    renewedOffered:int(m.renewedOffered),anyway:pct(m.anyway),because:pct(m.because),becauseEst:pct(m.becauseEst),riskAmongX:pct0(m.riskAmongX),riskAmongNo:pct0(m.riskAmongNo),
    evenSeeing:pts(e.seeing),evenDoing:pts(e.doing),_raw:{seeing:m.seeing,doing:m.doing,doingEst:m.doingEst,because:m.because,becauseEst:m.becauseEst}};};
function initLadder(){
  if(!$('ladder'))return;
  const tg=$('ld-target'),radios=[...document.querySelectorAll('input[name="ld-rung"]')];
  const WHY={
    1:'Seeing compares the customers who happened to get the offer with those who did not. It is a correct description of the data, and a fair forecast for a customer you only observe. It is not the effect of the offer, because the two groups differ in more than the offer.',
    2:'Doing asks what the renewal rate would be if you set the offer for everyone, against setting it for no one. Who used to get the offer no longer matters. An experiment answers this directly; from observed data it needs the variable that drove both the offer and the outcome.',
    3:'Imagining looks back at customers who got the offer and renewed, and asks whether each would have renewed without it. No customer is ever seen both ways, so the data gives this only under an extra assumption about how individuals respond.'};
  const run=()=>{
    const m=ladderModel(tg.value/100),rung=+(radios.find(r=>r.checked)||{value:1}).value;
    $('ld-target-value').textContent=tg.value+'%';
    $('ld-bars').innerHTML=group('1 · Seeing: renewal rate in the data',rung===1)+bar('Got the offer',m.seenX,'ml-b-blue',pct(m.seenX),rung===1)+bar('No offer',m.seenNo,'ml-b-fg',pct(m.seenNo),rung===1)+
      group('2 · Doing: renewal rate if you set the offer',rung===2)+bar('Offer for everyone',m.doAll,'ml-b-blue',pct(m.doAll),rung===2)+bar('Offer for no one',m.doNone,'ml-b-fg',pct(m.doNone),rung===2)+
      group('3 · Imagining: customers who got the offer and renewed',rung===3)+bar('Because of the offer',m.because,'cl-b-green',pct(m.because),rung===3)+bar('Would have anyway',m.anyway,'ml-b-fg',pct(m.anyway),rung===3);
    $('ld-seeing').textContent=pts(m.seeing);$('ld-seeing').closest('div').classList.toggle('ml-bad',m.seeing<0);
    $('ld-doing').textContent=pts(m.doing);$('ld-because').textContent=pct(m.because);
    $('ld-doing-est').textContent=pts(m.doingEst);$('ld-because-est').textContent=pct(m.becauseEst);$('ld-mix').textContent=pct0(m.riskAmongX)+' / '+pct0(m.riskAmongNo);
    $('ld-counts').textContent=int(m.nX)+' customers got the offer and '+int(m.renewedOffered)+' of them renewed; '+int(m.nNo)+' did not get it.';
    $('ld-why').textContent=WHY[rung];
  };
  const go=scheduler(run);tg.addEventListener('input',go);radios.forEach(r=>r.addEventListener('change',go));
  $('reset-ladder').addEventListener('click',()=>{tg.value=70;radios.forEach(r=>r.checked=r.value==='1');run();});
  run();
}
//@@end
