/* MLAIA Medical AI Lab (/medical-ai/lab/): demos 01-06.
   01 (heart rate from a noisy ECG) is drawn by assets/c-medical.js, the same file as the live demo at the
   top of /medical-ai/. This file only adds a range slider and presets that drive its drag handle.
   02-06 are below. All data is synthetic and deterministic (fixed seeds), generated and scored in the
   browser; nothing is uploaded. Each demo wires up only if its section is on the page: the hub has all
   six, each /medical-ai/lab/<slug>/ page has one.
   02-06 do not animate: they recompute and redraw on input, so they have no loop to pause. The ECG's
   loop (c-medical.js) pauses off-screen and in hidden tabs, and draws a static frame under
   prefers-reduced-motion or ?still. Illustrative only; not a medical device. */
(function(){
'use strict';
const TAU=2*Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sig=x=>1/(1+Math.exp(-x));
function rng(seed){let a=seed>>>0;const uni=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  const gauss=()=>{let u=0;while(u<1e-12)u=uni();return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*uni());};return{uni,gauss};}
function hash(n){n=(n|0)^0x9e3779b9;n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);n^=n>>>16;return(n>>>0)/4294967296;}
// Mann-Whitney AUC, ties count half
function auc(s,y){const idx=s.map((_,i)=>i).sort((a,b)=>s[a]-s[b]);let rs=0,np=0,i=0;
  while(i<idx.length){let j=i;while(j+1<idx.length&&s[idx[j+1]]===s[idx[i]])j++;const r=(i+j)/2+1;for(let k=i;k<=j;k++)if(y[idx[k]]){rs+=r;np++;}i=j+1;}
  const nn=idx.length-np;return np&&nn?(rs-np*(np+1)/2)/(np*nn):NaN;}

/* ---------- 02 Patient-level leakage: one k-NN model, two ways to split the same records ---------- */
// Each synthetic patient has a stable "fingerprint" (8 features) and one outcome; disease shifts 3 of
// the features a little. Visits are the fingerprint plus small visit-to-visit noise.
const LK={P:300,D:8,SIG:3,SHIFT:0.8,NOISE:0.3,K:7,TEST:0.25,NEW:240};
function lkPatient(id){const r=rng(9001+id*7919),y=r.uni()<0.3?1:0,base=new Float64Array(LK.D);
  for(let d=0;d<LK.D;d++)base[d]=r.gauss()+(y&&d<LK.SIG?LK.SHIFT:0);return{y,base};}
function lkVisit(p,id,v){const r=rng(424242+id*131+v*17),x=new Float64Array(LK.D);for(let d=0;d<LK.D;d++)x[d]=p.base[d]+LK.NOISE*r.gauss();return x;}
function knn(x,train){const K=LK.K,bd=new Float64Array(K).fill(Infinity),by=new Float64Array(K);
  for(const t of train){let d=0;for(let j=0;j<LK.D;j++){const u=x[j]-t.x[j];d+=u*u;}
    if(d<bd[K-1]){let k=K-1;while(k>0&&bd[k-1]>d){bd[k]=bd[k-1];by[k]=by[k-1];k--;}bd[k]=d;by[k]=t.y;}}
  let w=0,s=0;for(let k=0;k<K;k++){const wk=1/(Math.sqrt(bd[k])+0.05);w+=wk;s+=wk*by[k];}return s/w;}
const lkTest={record:r=>hash(r.pid*977+r.v*31+5)<LK.TEST,patient:r=>hash(r.pid*613+11)<LK.TEST};
function leakage(V){
  const pts=[],recs=[],fresh=[];for(let i=0;i<LK.P;i++)pts.push(lkPatient(i));
  for(let i=0;i<LK.P;i++)for(let v=0;v<V;v++)recs.push({pid:i,v,x:lkVisit(pts[i],i,v),y:pts[i].y});
  for(let i=0;i<LK.NEW;i++){const id=100000+i,p=lkPatient(id);fresh.push({x:lkVisit(p,id,0),y:p.y});}
  const out={};
  for(const split of ['record','patient']){
    const tr=[],te=[];for(const r of recs)(lkTest[split](r)?te:tr).push(r);
    const inTrain=new Set(tr.map(r=>r.pid));
    out[split]={auc:auc(te.map(r=>knn(r.x,tr)),te.map(r=>r.y)),aucNew:auc(fresh.map(r=>knn(r.x,tr)),fresh.map(r=>r.y)),
      shared:te.filter(r=>inTrain.has(r.pid)).length/te.length,nTrain:tr.length,nTest:te.length};
  }
  return out;
}

/* ---------- 03 Calibration, thresholds and net benefit ---------- */
// 4,000 synthetic patients with a risk score x. True risk = sigmoid(a + x), with a set by the
// prevalence. The model was fitted where prevalence was 10%; the miscalibrated variant adds a constant to
// its log-odds and shrinks them (risks too high for most patients, too low for the highest), a monotone
// change, so its ranking (AUC) is identical.
const CAL={N:4000,S:1.6,REF:0.10};
const calX=(()=>{const r=rng(31337),x=new Float64Array(CAL.N);for(let i=0;i<CAL.N;i++)x[i]=CAL.S*r.gauss();return x.sort();})();
function calIntercept(prev){let lo=-15,hi=8;for(let it=0;it<60;it++){const m=(lo+hi)/2;let s=0;for(const x of calX)s+=sig(m+x);s/=CAL.N;if(s<prev)lo=m;else hi=m;}return(lo+hi)/2;}
const CAL_A0=calIntercept(CAL.REF);
function calModel(prev,mis){
  const a=calIntercept(prev),N=CAL.N,p=new Float64Array(N),q=new Float64Array(N);
  for(let i=0;i<N;i++){p[i]=sig(a+calX[i]);const lp=CAL_A0+calX[i];q[i]=mis?sig(0.6*lp+1.0):sig(lp);}
  // weighted AUC: x is sorted, q is increasing in x, so this order is the ranking
  let w0=0,num=0,sp=0,sn=0;for(let i=0;i<N;i++){num+=p[i]*w0;w0+=1-p[i];sp+=p[i];sn+=1-p[i];}
  const bins=[];for(let b=0;b<10;b++){let mq=0,mp=0;const i0=b*N/10,i1=(b+1)*N/10;for(let i=i0;i<i1;i++){mq+=q[i];mp+=p[i];}bins.push([mq/(i1-i0),mp/(i1-i0)]);}
  let mq=0;for(const v of q)mq+=v;
  return{p,q,auc:num/(sp*sn),prev:sp/N,meanQ:mq/N,bins};
}
function calAt(m,t){let tp=0,fp=0,fn=0,fl=0;for(let i=0;i<CAL.N;i++){if(m.q[i]>=t){tp+=m.p[i];fp+=1-m.p[i];fl++;}else fn+=m.p[i];}
  const N=CAL.N;tp/=N;fp/=N;fn/=N;return{tp,fp,fn,flagged:fl/N,nb:tp-fp*t/(1-t),all:m.prev-(1-m.prev)*t/(1-t)};}

/* ---------- 04 Scanner shift: an intensity-window segmenter tuned on scanner A ---------- */
const SW=128;
const scan=(()=>{
  const img=new Float32Array(SW*SW),gt=new Uint8Array(SW*SW);
  for(let y=0;y<SW;y++)for(let x=0;x<SW;x++){
    const i=y*SW+x;let v=0.04;
    if(((x-64)/54)**2+((y-66)/46)**2<1)v=0.32+0.03*Math.sin(x/7)*Math.cos(y/9);
    if(((x-40)/17)**2+((y-62)/24)**2<1)v=0.55;
    if(((x-89)/15)**2+((y-74)/12)**2<1)v=0.5;
    if(((x-64)/7)**2+((y-100)/6)**2<1)v=0.88;
    if(((x-64)/30)**2+((y-34)/5)**2<1)v=0.62*(0.6+0.4*Math.cos((x-64)/30*Math.PI));
    const th=Math.atan2(y-55,x-44),rr=Math.hypot(x-44,y-55),R=7.5*(1+0.18*Math.sin(3*th)+0.1*Math.cos(5*th+1));
    if(rr<R){v=0.82-0.16*rr/R;gt[i]=1;}
    img[i]=v;
  }
  // a little blur so edges look scanned, not drawn
  const b=new Float32Array(SW*SW);for(let y=0;y<SW;y++)for(let x=0;x<SW;x++){let s=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const yy=y+dy,xx=x+dx;if(yy>=0&&yy<SW&&xx>=0&&xx<SW){s+=img[yy*SW+xx]*(dx||dy?1:2);n+=dx||dy?1:2;}}b[y*SW+x]=s/n;}
  let m=0;for(const v of b)m+=v;m/=b.length;
  const nA=new Float32Array(SW*SW),nB=new Float32Array(SW*SW),ra=rng(777),rb=rng(4242);for(let i=0;i<SW*SW;i++){nA[i]=ra.gauss();nB[i]=rb.gauss();}
  return{clean:b,gt,mean:m,nA,nB};
})();
const SA_NOISE=0.03;
function scanImage(contrast,noise,noiseField){const o=new Float32Array(SW*SW);for(let i=0;i<o.length;i++)o[i]=scan.mean+contrast*(scan.clean[i]-scan.mean)+noise*noiseField[i];return o;}
function smooth3(img){const o=new Float32Array(SW*SW);for(let y=0;y<SW;y++)for(let x=0;x<SW;x++){let s=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const yy=y+dy,xx=x+dx;if(yy>=0&&yy<SW&&xx>=0&&xx<SW){s+=img[yy*SW+xx];n++;}}o[y*SW+x]=s/n;}return o;}
function zscore(img){let m=0,s=0;for(const v of img)m+=v;m/=img.length;for(const v of img)s+=(v-m)**2;s=Math.sqrt(s/img.length);return img.map(v=>(v-m)/s);}
function dice(pred,gt){let a=0,b=0,c=0;for(let i=0;i<gt.length;i++){if(pred[i]&&gt[i])a++;if(pred[i])b++;if(gt[i])c++;}return b+c?2*a/(b+c):1;}
function windowSeg(f,lo,hi){const o=new Uint8Array(f.length);for(let i=0;i<f.length;i++)o[i]=f[i]>=lo&&f[i]<=hi?1:0;return o;}
function prep(img,norm){const s=smooth3(img);return norm?zscore(s):s;}
const scanModels={};
function scanModel(norm){ // grid-search the window that gives the best Dice on scanner A
  if(scanModels[norm])return scanModels[norm];
  const f=prep(scanImage(1,SA_NOISE,scan.nA),norm);let lo0=Infinity,hi0=-Infinity;for(const v of f){lo0=Math.min(lo0,v);hi0=Math.max(hi0,v);}
  let best={d:-1};const st=(hi0-lo0)/80;
  for(let lo=lo0;lo<hi0;lo+=st)for(let hi=lo+st;hi<=hi0+st;hi+=st){const d=dice(windowSeg(f,lo,hi),scan.gt);if(d>best.d)best={d,lo,hi};}
  best.fA=f;best.predA=windowSeg(f,best.lo,best.hi);return scanModels[norm]=best;
}
function scanShift(contrast,noise,norm){const M=scanModel(norm),fB=prep(scanImage(contrast,noise,scan.nB),norm),predB=windowSeg(fB,M.lo,M.hi);
  let fp=0,fn=0;for(let i=0;i<predB.length;i++){if(predB[i]&&!scan.gt[i])fp++;if(!predB[i]&&scan.gt[i])fn++;}
  return{M,fB,predB,diceA:M.d,diceB:dice(predB,scan.gt),fp,fn,imgA:scanImage(1,SA_NOISE,scan.nA),imgB:scanImage(contrast,noise,scan.nB)};}

/* ---------- 05 Dice vs clinical error: a large and a small lesion ---------- */
const DW=160;// pixels; 1 pixel = 1 mm
const LG={x:66,y:84,r:34},SM={x:124,y:42};
function lesionMasks(rough,smallD,missSmall){
  const gt=new Uint8Array(DW*DW),pr=new Uint8Array(DW*DW),rs=smallD/2;
  for(let y=0;y<DW;y++)for(let x=0;x<DW;x++){
    const i=y*DW+x,th=Math.atan2(y-LG.y,x-LG.x),r=Math.hypot(x-LG.x,y-LG.y);
    const R=LG.r*(1+0.05*Math.sin(3*th)+0.03*Math.sin(5*th+1));
    const wob=Math.sin(7*th+0.5)*0.55+Math.sin(11*th+2.1)*0.35+Math.sin(17*th+4)*0.3+Math.sin(23*th+1.3)*0.2;
    if(r<=R)gt[i]=1;
    if(r<=R+rough*wob)pr[i]=1;
    const rsm=Math.hypot(x-SM.x+0.5,y-SM.y+0.5);
    if(rsm<=rs){gt[i]=1;if(!missSmall)pr[i]=1;}
  }
  return{gt,pr};
}
function boundary(m){const b=[];for(let y=0;y<DW;y++)for(let x=0;x<DW;x++){const i=y*DW+x;if(!m[i])continue;
  if(x===0||y===0||x===DW-1||y===DW-1||!m[i-1]||!m[i+1]||!m[i-DW]||!m[i+DW])b.push(x,y);}return b;}
function directed(a,b){const d=new Float64Array(a.length/2);for(let i=0;i<a.length;i+=2){let best=Infinity;for(let j=0;j<b.length;j+=2){const dx=a[i]-b[j],dy=a[i+1]-b[j+1],q=dx*dx+dy*dy;if(q<best)best=q;}d[i/2]=Math.sqrt(best);}return d;}
function pct(arr,p){const a=Float64Array.from(arr).sort();if(!a.length)return 0;const k=(a.length-1)*p,lo=Math.floor(k),hi=Math.ceil(k);return a[lo]+(a[hi]-a[lo])*(k-lo);}
function lesionMetrics(rough,smallD,missSmall){
  const {gt,pr}=lesionMasks(rough,smallD,missSmall),bg=boundary(gt),bp=boundary(pr);
  // HD95 = the larger of the two directed 95th-percentile boundary distances (as in MONAI)
  const dGP=directed(bg,bp),dPG=directed(bp,bg),all=[...dGP,...dPG];
  // lesions: the small one is everything within 20 px of its centre, the large one the rest
  const isSmall=i=>Math.hypot(i%DW-SM.x,Math.floor(i/DW)-SM.y)<20;
  let sI=0,sG=0,sP=0,lI=0,lG=0,lP=0;for(let i=0;i<gt.length;i++){if(isSmall(i)){if(gt[i])sG++;if(pr[i])sP++;if(gt[i]&&pr[i])sI++;}else{if(gt[i])lG++;if(pr[i])lP++;if(gt[i]&&pr[i])lI++;}}
  return{gt,pr,dice:dice(pr,gt),hd95:Math.max(pct(dGP,0.95),pct(dPG,0.95)),hd:all.length?Math.max(...all):0,
    detected:(lI>0?1:0)+(sI>0?1:0),diceLarge:2*lI/(lG+lP),diceSmall:sG+sP?2*sI/(sG+sP):1,smallShare:sG/(sG+lG),
    smallBoundaryShare:dGP.filter((_,k)=>Math.hypot(bg[2*k]-SM.x,bg[2*k+1]-SM.y)<20).length/(bg.length/2)};
}

/* ---------- 06 De-identifying a clinical note: rule-based detector vs a ground-truth annotation ---------- */
// Fully fictional notes. {{type|text}} marks a ground-truth identifier. ID and phone are all zeros.
const NOTES={
  en:{dir:'ltr',lang:'en',text:'Discharge summary. Patient: Mr. {{name|Daniel Orvanto}}, ID {{id|000000000}}, age 47. Admitted on {{date|14/03/2024}} with chest pain. Lives at {{place|12 Almond Street}}, {{place|Haifa}}, with his wife {{name|Noa}}. Phone: {{phone|000-000-0000}}. Works as a {{rare|lighthouse keeper}} and was {{rare|the only passenger rescued from the ferry fire last winter}}. Treated with aspirin 300 mg and Atorvastatin 40 mg. Troponin peaked at 52 ng/L. Seen by Dr. {{name|Lior Kelmarin}} in the Emergency Department. Follow-up on {{date|2 May 2024}} at the {{place|Netanya}} clinic. His brother {{name|Ido}} will drive him home.'},
  he:{dir:'rtl',lang:'he',text:'סיכום אשפוז. המטופל: מר {{name|דניאל אורבנטו}}, ת.ז. {{id|000000000}}, גיל: 47. אושפז ב-{{date|14/03/2024}} בשל כאבים בחזה. מתגורר ב{{place|רחוב השקד 12}}, {{place|חיפה}}, עם אשתו {{name|נועה}}. טלפון: {{phone|000-000-0000}}. עובד כ{{rare|שומר מגדלור}}, והיה {{rare|הנוסע היחיד שחולץ משריפת המעבורת בחורף שעבר}}. טופל באספירין 300 מ״ג ובאטורבסטטין 40 מ״ג. טרופונין הגיע ל-52 ננוגרם לליטר. נבדק על ידי ד״ר {{name|ליאור קלמרין}} במחלקה לרפואה דחופה. ביקורת ב-{{date|2 במאי 2024}} במרפאה ב{{place|נתניה}}. אחיו {{name|עידו}} יסיע אותו הביתה.'},
  mix:{dir:'rtl',lang:'he',text:'סיכום אשפוז. מר {{name|דניאל אורבנטו}}, ת.ז. {{id|000000000}}, גיל: 47. Admitted ב-{{date|14/03/2024}} with chest pain. גר ב{{place|רחוב השקד 12}}, {{place|Haifa}}, עם אשתו {{name|Noa}}. טל׳ {{phone|000-000-0000}}. עובד כ{{rare|שומר מגדלור}}; {{rare|הנוסע היחיד שחולץ משריפת המעבורת בחורף שעבר}}. Rx: Aspirin 300 mg, Atorvastatin 40 mg. Troponin 52 ng/L. נבדק ע״י Dr. {{name|Lior Kelmarin}}, ED. F/U ב-{{date|2 May 2024}}, מרפאת {{place|נתניה}}. אחיו {{name|עידו}} יסיע אותו.'}
};
function parseNote(src){let text='';const gold=[];let i=0;const re=/\{\{(\w+)\|([^}]*)\}\}/g;let m;
  while((m=re.exec(src))){text+=src.slice(i,m.index);gold.push({s:text.length,e:text.length+m[2].length,type:m[1]});text+=m[2];i=re.lastIndex;}
  return{text:text+src.slice(i),gold};}
const HE='\\u05D0-\\u05EA',PRE=`(?<=(?:^|[^${HE}])[ובלמהכש]?)`,NOT_HE=`(?![${HE}])`;
const MONTHS='January|February|March|April|May|June|July|August|September|October|November|December';
const HMONTHS='ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר';
// [strictness level, tag, label, pattern]. Each level adds rules to the ones below it.
const RULES=[
  [1,'id','Nine-digit ID numbers','(?<!\\d)\\d{9}(?!\\d)'],
  [1,'name','Names after a title (Mr, Dr and the Hebrew titles)',`(?<=\\b(?:Mr|Mrs|Ms|Dr)\\.? )[A-Z][a-z]+(?: [A-Z][a-z]+)?|(?<=(?:^|[^${HE}])(?:מר|גב['׳]|ד["״]ר) )[${HE}]+(?: [${HE}]+)?`],
  [2,'phone','Phone numbers','(?<!\\d)(?:\\+972-?|0)\\d{1,2}-?\\d{3}-?\\d{4}(?!\\d)'],
  [2,'date','Numeric dates','(?<![\\d/.])\\d{1,2}[./]\\d{1,2}[./]\\d{2,4}(?![\\d/.])'],
  [2,'name','Short list of first names',`\\b(?:Daniel|Noa|Lior|Dana)\\b|${PRE}(?:דניאל|נועה|ליאור|דנה)${NOT_HE}`],
  [3,'date','Dates with a month name',`(?<!\\d)\\d{1,2} (?:${MONTHS})(?: \\d{4})?\\b|(?<!\\d)\\d{1,2} ב?(?:${HMONTHS})(?: \\d{4})?`],
  [3,'place','Street addresses',`\\b\\d{1,4} [A-Z][a-z]+ (?:Street|St\\.|Road|Rd\\.|Avenue)|${PRE}(?:רחוב|רח['׳]) [${HE}"״]+(?: [${HE}"״]+)? \\d{1,4}`],
  [3,'place','List of towns',`\\b(?:Haifa|Netanya|Hadera|Ashkelon|Eilat)\\b|${PRE}(?:חיפה|נתניה|חדרה|אשקלון|אילת)${NOT_HE}`],
  [3,'name','Capitalised words mid-sentence (English only)','(?<=[^.!?:\\n] )(?!(?:Mr|Mrs|Ms|Dr)\\b)[A-Z][a-z]+(?: [A-Z][a-z]+)*'],
  [4,'num','Any number of two or more digits','(?<![\\d./-])\\d{2,}(?![\\d./-])'],
  [4,'name','Long list of first names',`\\b(?:Ido|Gil|Tal|Chen|Shira|Or)\\b|${PRE}(?:עידו|גיל|טל|חן|שירה|אור)${NOT_HE}`],
  [5,'job','Profession after “works as” (or the Hebrew phrase)',`(?<=\\b[Ww]orks as an? )[a-z]+(?: [a-z]+)?|(?<=(?:עובד|עובדת) כ)[${HE}]+(?: [${HE}]+)?`],
  [5,'word','Every capitalised word (English)','\\b[A-Z][a-z]{2,}\\b']
].map(([level,tag,label,src])=>({level,tag,label,re:new RegExp(src,'g')}));
function detect(text,level){const spans=[];for(const r of RULES){if(r.level>level)continue;r.re.lastIndex=0;let m;
  while((m=r.re.exec(text))){if(!m[0].length){r.re.lastIndex++;continue;}spans.push({s:m.index,e:m.index+m[0].length,tag:r.tag});}}
  spans.sort((a,b)=>a.s-b.s||b.e-a.e);const merged=[];
  for(const s of spans){const last=merged[merged.length-1];if(last&&s.s<=last.e){if(s.e>last.e)last.e=s.e;}else merged.push({...s});}
  return merged;}
function deid(key,level){const {text,gold}=parseNote(NOTES[key].text),pred=detect(text,level);
  const covered=g=>{let c=0;for(const p of pred)c+=Math.max(0,Math.min(p.e,g.e)-Math.max(p.s,g.s));return c/(g.e-g.s);};
  for(const g of gold)g.caught=covered(g)>=0.5;
  for(const p of pred)p.fp=!gold.some(g=>Math.min(p.e,g.e)>Math.max(p.s,g.s));
  return{text,gold,pred,caught:gold.filter(g=>g.caught).length,missed:gold.filter(g=>!g.caught).length,fp:pred.filter(p=>p.fp).length};}

const Core={auc,leakage,calModel,calAt,scanShift,lesionMetrics,deid,RULES,NOTES,parseNote};
if(typeof module==='object'&&module.exports){module.exports=Core;return;}

/* ================= browser ================= */
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const COL={amber:'#ffb547',blue:'#71d4ff',fg:'#eceee9',muted:'#9ca39d',rule:'#262b28',red:'#ff6b6b',green:'#7be0a6'};
const MONO='font-family="&quot;Martian Mono&quot;,ui-monospace,Menlo,monospace"';
const f1=v=>v.toFixed(1),f2=v=>v.toFixed(2),pc=v=>(v*100).toFixed(v<0.1?1:0)+'%';
// coalesce bursts of input events into one recompute per frame
function scheduler(fn){let q=0;return()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;fn();});};}
function fitCanvas(cv){const r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}return{w,h,d};}
function onResize(el,fn){if('ResizeObserver' in window)new ResizeObserver(()=>fn()).observe(el);else window.addEventListener('resize',fn);}
function axes(x0,x1,y0,y1,xt,yt,xl,yl){ // plot frame for the small (300-wide) charts
  let s=`<g aria-hidden="true" ${MONO} fill="${COL.muted}">`;
  for(const [y,l] of yt)s+=`<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${COL.rule}"/><text class="ml-t" x="${x0-6}" y="${y+4}" text-anchor="end">${l}</text>`;
  for(const [x,l] of xt)s+=`<text class="ml-t" x="${x}" y="${y1+16}" text-anchor="middle">${l}</text>`;
  s+=`<line x1="${x0}" x2="${x0}" y1="${y0}" y2="${y1}" stroke="${COL.rule}"/>`;
  if(xl)s+=`<text class="ml-t" x="${(x0+x1)/2}" y="${y1+34}" text-anchor="middle">${xl}</text>`;
  if(yl)s+=`<text class="ml-t" x="${x0-6}" y="${y0-14}" text-anchor="start">${yl}</text>`;
  return s+'</g>';}

/* ----- 01 ECG: a range slider and presets that drive the c-medical.js handle ----- */
function initEcg(){
  const box=document.querySelector('#ecg [data-m-ecg]'),range=$('ecg-artifact');if(!box||!range)return;
  const inst=()=>{const cv=box.querySelector('canvas');return cv&&cv.__mInst;};
  const show=a=>{$('ecg-artifact-value').textContent=a.toFixed(2)+' mV';};
  const fromHandle=()=>{const it=inst();if(!it)return;const a=it.handle.value*2;range.value=a;show(a);};
  const toHandle=a=>{const it=inst();if(!it)return;it.handle.set(a/2,true);range.value=a;show(a);};
  range.addEventListener('input',()=>toHandle(+range.value));
  ['pointerdown','pointermove','keydown'].forEach(t=>box.addEventListener(t,fromHandle));
  document.querySelectorAll('[data-ecg-preset]').forEach(b=>b.addEventListener('click',()=>toHandle(+b.dataset.ecgPreset)));
  $('reset-ecg').addEventListener('click',()=>toHandle(0.2));
  // c-medical.js initialises first (it is loaded before this file); poll briefly in case it has not
  let tries=0;(function wait(){if(inst())fromHandle();else if(tries++<40)setTimeout(wait,50);})();
}

/* ----- 02 Leakage ----- */
function initLeakage(){
  if(!$('leakage'))return;
  const visits=$('lk-visits'),radios=document.querySelectorAll('input[name="lk-split"]');
  const split=()=>[...radios].find(r=>r.checked).value;
  const run=()=>{
    const V=+visits.value,res=leakage(V),s=split(),r=res[s];
    $('lk-visits-value').textContent=V+(V===1?' visit':' visits');
    $('lk-auc').textContent=f2(r.auc);$('lk-auc-new').textContent=f2(r.aucNew);
    const opt=r.auc-r.aucNew;$('lk-opt').textContent=(opt>=0?'+':'−')+f2(Math.abs(opt));$('lk-opt').closest('div').classList.toggle('ml-bad',opt>0.05);
    $('lk-shared').textContent=Math.round(r.shared*100)+'% of test records belong to a patient who also has records in training. '+r.nTrain.toLocaleString()+' training and '+r.nTest.toLocaleString()+' test records.';
    // split map: the first 12 patients, one square per visit
    let map='';for(let pid=0;pid<12;pid++){let cells='';for(let v=0;v<V;v++){const t=lkTest[s]({pid,v});cells+=`<i class="${t?'ml-te':'ml-tr'}"></i>`;}
      map+=`<div class="ml-row"><span>P${String(pid+1).padStart(2,'0')}</span><div>${cells}</div></div>`;}
    $('lk-map').innerHTML=map;
    const bar=(label,v,cls,cur)=>`<div class="ml-bar${cur?' is-current':''}"><span>${label}</span><div class="ml-bar__track"><b class="${cls}" style="width:${clamp((v-0.5)/0.5,0,1)*100}%"></b></div><strong>${f2(v)}</strong></div>`;
    $('lk-bars').innerHTML=
      `<p class="ml-bars__group${s==='record'?' is-current':''}">Split by record</p>`+bar('Reported test AUC',res.record.auc,'ml-b-blue',s==='record')+bar('AUC on new patients',res.record.aucNew,'ml-b-fg',s==='record')+
      `<p class="ml-bars__group${s==='patient'?' is-current':''}">Split by patient</p>`+bar('Reported test AUC',res.patient.auc,'ml-b-blue',s==='patient')+bar('AUC on new patients',res.patient.aucNew,'ml-b-fg',s==='patient');
  };
  const go=scheduler(run);visits.addEventListener('input',go);radios.forEach(r=>r.addEventListener('change',go));
  $('reset-leakage').addEventListener('click',()=>{visits.value=4;radios.forEach(r=>r.checked=r.value==='record');run();});
  run();
}

/* ----- 03 Calibration ----- */
function initCalibration(){
  if(!$('calibration'))return;
  const th=$('cal-threshold'),pv=$('cal-prevalence'),mis=$('cal-mis');
  const run=()=>{
    const t=th.value/100,prev=pv.value/100,m=calModel(prev,mis.checked),r=calAt(m,t);
    $('cal-threshold-value').textContent=th.value+'%';$('cal-prevalence-value').textContent=pv.value+'%';
    $('cal-auc').textContent=m.auc.toFixed(3);$('cal-mean').textContent=pc(m.meanQ)+' / '+pc(m.prev);
    $('cal-nb').textContent=(r.nb*1000).toFixed(1);$('cal-nb').closest('div').classList.toggle('ml-bad',r.nb<Math.max(0,r.all));
    $('cal-missed').textContent=Math.round(r.fn*1000);$('cal-fa').textContent=Math.round(r.fp*1000);$('cal-flag').textContent=Math.round(r.flagged*1000);
    $('cal-verdict').textContent=r.nb<=0?'At this threshold the model does no better than treating no one.':r.nb<r.all?'At this threshold, treating everyone would give more net benefit than using the model.':'The model gives more net benefit than treating everyone or no one at this threshold.';
    // calibration plot
    const X=v=>44+v*244,Y=v=>206-v*176;
    let c=`<title id="cal-plot-title">Calibration plot</title><desc id="cal-plot-desc">Ten risk groups. Mean predicted risk ${pc(m.meanQ)}; observed ${pc(m.prev)}.</desc>`+
      axes(44,288,30,206,[[X(0),'0'],[X(.5),'50%'],[X(1),'100%']],[[Y(0),'0'],[Y(.5),'50%'],[Y(1),'100%']],'predicted risk','observed rate');
    c+=`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="${COL.fg}" stroke-dasharray="5 5" opacity=".6"/>`;
    c+=`<polyline points="${m.bins.map(([q,p])=>X(q).toFixed(1)+','+Y(p).toFixed(1)).join(' ')}" fill="none" stroke="${COL.blue}" stroke-width="2.5"/>`;
    for(const [q,p] of m.bins)c+=`<circle cx="${X(q).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="4" fill="${COL.blue}"/>`;
    c+=`<line x1="${X(t)}" x2="${X(t)}" y1="30" y2="206" stroke="${COL.amber}" stroke-dasharray="3 4"/>`;
    $('cal-plot').innerHTML=c;
    // decision curve, net benefit per 1,000 patients
    const TMAX=0.6,ymax=Math.max(20,m.prev*1000*1.08),ymin=-ymax*0.25,DX=v=>44+v/TMAX*244,DY=v=>206-(v-ymin)/(ymax-ymin)*176;
    const step=v=>Math.round(v/10)*10||10,yt=[0,step(ymax/2),step(ymax*0.95)].filter((v,i,a)=>a.indexOf(v)===i&&v<=ymax);
    let d=`<title id="cal-dca-title">Decision curve</title><desc id="cal-dca-desc">Net benefit per 1,000 patients at threshold ${th.value} percent: model ${(r.nb*1000).toFixed(1)}, treat all ${(r.all*1000).toFixed(1)}, treat none 0.</desc>`+
      axes(44,288,30,206,[[DX(0),'0'],[DX(.2),'20%'],[DX(.4),'40%'],[DX(.6),'60%']],yt.map(v=>[DY(v),String(v)]),'risk threshold','net benefit per 1,000');
    const curve=fn=>{const pts=[];for(let k=0;k<=120;k++){const tt=0.005+k/120*(TMAX-0.005),v=fn(tt)*1000;pts.push(DX(tt).toFixed(1)+','+DY(clamp(v,ymin,ymax)).toFixed(1));}return pts.join(' ');};
    d+=`<polyline points="${curve(tt=>calAt(m,tt).all)}" fill="none" stroke="${COL.amber}" stroke-width="2"/>`;
    d+=`<line x1="${DX(0)}" x2="${DX(TMAX)}" y1="${DY(0)}" y2="${DY(0)}" stroke="${COL.muted}" stroke-width="2"/>`;
    d+=`<polyline points="${curve(tt=>calAt(m,tt).nb)}" fill="none" stroke="${COL.blue}" stroke-width="2.5"/>`;
    d+=`<line x1="${DX(t)}" x2="${DX(t)}" y1="30" y2="206" stroke="${COL.fg}" stroke-dasharray="3 4" opacity=".7"/><circle cx="${DX(t)}" cy="${DY(clamp(r.nb*1000,ymin,ymax))}" r="5" fill="${COL.blue}" stroke="#070908" stroke-width="2"/>`;
    $('cal-dca').innerHTML=d;
  };
  const go=scheduler(run);[th,pv].forEach(e=>e.addEventListener('input',go));mis.addEventListener('change',go);
  $('reset-calibration').addEventListener('click',()=>{th.value=10;pv.value=10;mis.checked=false;run();});
  run();
}

/* ----- 04 Scanner shift ----- */
function drawScan(cv,img,pred,lo,hi){
  const {w,h}=fitCanvas(cv),ctx=cv.getContext('2d'),off=document.createElement('canvas');off.width=off.height=SW;
  const oc=off.getContext('2d'),id=oc.createImageData(SW,SW);
  for(let i=0;i<SW*SW;i++){const g=clamp(img[i],0,1)*255;let r=g,gg=g,b=g;
    if(pred){const t=scan.gt[i],p=pred[i];
      if(p&&t){r=r*.35+0x71*.65;gg=gg*.35+0xd4*.65;b=b*.35+0xff*.65;}
      else if(p){r=r*.3+0xff*.7;gg=gg*.3+0x6b*.7;b=b*.3+0x6b*.7;}
      else if(t){r=r*.3+0xff*.7;gg=gg*.3+0xb5*.7;b=b*.3+0x47*.7;}}
    id.data[4*i]=r;id.data[4*i+1]=gg;id.data[4*i+2]=b;id.data[4*i+3]=255;}
  oc.putImageData(id,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);ctx.drawImage(off,0,0,w,h);
}
function initScanner(){
  if(!$('scanner'))return;
  const con=$('sc-contrast'),noi=$('sc-noise'),norm=$('sc-norm'),ov=$('sc-overlay');
  const run=()=>{
    const c=con.value/100,n=noi.value/1000,res=scanShift(c,n,norm.checked);
    $('sc-contrast-value').textContent=c.toFixed(2)+'×';$('sc-noise-value').textContent=n.toFixed(3);
    $('sc-dice-a').textContent=f2(res.diceA);$('sc-dice-b').textContent=f2(res.diceB);$('sc-dice-b').closest('div').classList.toggle('ml-bad',res.diceB<res.diceA-0.1);
    $('sc-errors').textContent=res.fp+' · '+res.fn;
    drawScan($('sc-a'),res.imgA,ov.checked?res.M.predA:null);drawScan($('sc-b'),res.imgB,ov.checked?res.predB:null);
    // histogram of scanner B after the model's smoothing (and normalisation, if on)
    const f=res.fB;let lo=Infinity,hi=-Infinity;for(const v of f){lo=Math.min(lo,v);hi=Math.max(hi,v);}
    lo=Math.min(lo,res.M.lo);hi=Math.max(hi,res.M.hi);const B=60,hl=new Float64Array(B),ht=new Float64Array(B),bin=v=>clamp(Math.floor((v-lo)/(hi-lo)*B),0,B-1);
    for(let i=0;i<f.length;i++){if(scan.gt[i])hl[bin(f[i])]++;else if(scan.clean[i]>0.2)ht[bin(f[i])]++;}
    const ml=Math.max(...hl),mt=Math.max(...ht),X=v=>20+(v-lo)/(hi-lo)*580,bw=580/B;
    let s=`<title id="sc-hist-title">Scanner B intensity histogram</title><desc id="sc-hist-desc">Lesion and other tissue intensities on scanner B, and the intensity window the model learned on scanner A.</desc>`;
    s+=`<rect x="${X(res.M.lo).toFixed(1)}" y="8" width="${(X(res.M.hi)-X(res.M.lo)).toFixed(1)}" height="104" fill="${COL.fg}" opacity=".08"/>`;
    for(let k=0;k<B;k++){const x=20+k*bw;if(ht[k])s+=`<rect x="${x.toFixed(1)}" y="${(112-ht[k]/mt*100).toFixed(1)}" width="${(bw-1).toFixed(1)}" height="${(ht[k]/mt*100).toFixed(1)}" fill="${COL.amber}" opacity=".55"/>`;
      if(hl[k])s+=`<rect x="${x.toFixed(1)}" y="${(112-hl[k]/ml*100).toFixed(1)}" width="${(bw-1).toFixed(1)}" height="${(hl[k]/ml*100).toFixed(1)}" fill="${COL.blue}" opacity=".85"/>`;}
    for(const v of [res.M.lo,res.M.hi])s+=`<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="4" y2="116" stroke="${COL.fg}" stroke-dasharray="5 4"/>`;
    s+=`<line x1="20" x2="600" y1="112.5" y2="112.5" stroke="${COL.rule}"/><text class="ml-t" ${MONO} fill="${COL.muted}" x="20" y="138">darker</text><text class="ml-t" ${MONO} fill="${COL.muted}" x="600" y="138" text-anchor="end">brighter</text><text class="ml-t" ${MONO} fill="${COL.fg}" x="${clamp((X(res.M.lo)+X(res.M.hi))/2,90,530).toFixed(1)}" y="168" text-anchor="middle">window learned on A</text>`;
    $('sc-hist').innerHTML=s;
  };
  const go=scheduler(run);[con,noi].forEach(e=>e.addEventListener('input',go));[norm,ov].forEach(e=>e.addEventListener('change',go));
  $('reset-scanner').addEventListener('click',()=>{con.value=100;noi.value=30;norm.checked=false;ov.checked=true;run();});
  for(const [id,c,n] of [['sc-preset-low',70,30],['sc-preset-high',140,30],['sc-preset-noisy',100,110]])$(id).addEventListener('click',()=>{con.value=c;noi.value=n;run();});
  onResize($('sc-a'),go);run();
}

/* ----- 05 Dice vs clinical error ----- */
function initDice(){
  if(!$('dice'))return;
  const miss=$('dc-miss'),rough=$('dc-rough'),size=$('dc-size'),cv=$('dc-canvas');
  const run=()=>{
    const r=+rough.value/2,sd=+size.value,m=lesionMetrics(r,sd,miss.checked);
    $('dc-rough-value').textContent=r.toFixed(1)+' mm';$('dc-size-value').textContent=sd+' mm';
    $('dc-dice').textContent=f2(m.dice);$('dc-hd95').textContent=f1(m.hd95)+' mm';$('dc-hd').textContent=f1(m.hd)+' mm';
    $('dc-found').textContent=m.detected+' of 2';$('dc-found').closest('div').classList.toggle('ml-bad',m.detected<2);
    $('dc-hd95').closest('div').classList.toggle('ml-bad',m.hd95>10);
    $('dc-detail').textContent='Per lesion: large '+f2(m.diceLarge)+', small '+f2(m.diceSmall)+'. The small lesion is '+(m.smallShare*100).toFixed(1)+'% of the true lesion area and '+(m.smallBoundaryShare*100).toFixed(0)+'% of its boundary.';
    // draw: true outline white, prediction blue fill, missed area amber, extra area red
    const {w,h,d}=fitCanvas(cv),ctx=cv.getContext('2d'),off=document.createElement('canvas');off.width=off.height=DW;const oc=off.getContext('2d'),id=oc.createImageData(DW,DW);
    for(let i=0;i<DW*DW;i++){const g=m.gt[i],p=m.pr[i];let c=[13,16,15];
      if(g&&p)c=[0x71*.75,0xd4*.75,0xff*.75];else if(p)c=[0xff*.8,0x6b*.8,0x6b*.8];else if(g)c=[0xff,0xb5,0x47];
      const o=4*i;id.data[o]=c[0];id.data[o+1]=c[1];id.data[o+2]=c[2];id.data[o+3]=255;}
    oc.putImageData(id,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);ctx.drawImage(off,0,0,w,h);
    const s=w/DW;ctx.font=(11*d)+'px "Martian Mono",ui-monospace,monospace';ctx.textBaseline='middle';
    // ring the small lesion so it can be found, and label it
    const R=Math.max(sd/2+6,9)*s;ctx.strokeStyle=miss.checked?COL.red:COL.fg;ctx.lineWidth=1.5*d;ctx.setLineDash([4*d,4*d]);ctx.beginPath();ctx.arc(SM.x*s,SM.y*s,R,0,TAU);ctx.stroke();ctx.setLineDash([]);
    const lab=miss.checked?'small lesion: missed':'small lesion: found';ctx.fillStyle='rgba(7,9,8,.85)';const tw=ctx.measureText(lab).width+10*d,lx=Math.max(4*d,Math.min(w-tw-4*d,SM.x*s-tw/2)),ly=Math.max(4*d,SM.y*s-R-22*d);ctx.fillRect(lx,ly,tw,16*d);ctx.fillStyle=miss.checked?COL.red:COL.fg;ctx.fillText(lab,lx+5*d,ly+8*d);
    ctx.fillStyle='rgba(7,9,8,.85)';const l2='10 mm';ctx.fillRect(8*d,h-26*d,10*s+ctx.measureText(l2).width+20*d,20*d);ctx.strokeStyle=COL.fg;ctx.beginPath();ctx.moveTo(12*d,h-16*d);ctx.lineTo(12*d+10*s,h-16*d);ctx.stroke();ctx.fillStyle=COL.fg;ctx.fillText(l2,18*d+10*s,h-16*d);
  };
  const go=scheduler(run);[rough,size].forEach(e=>e.addEventListener('input',go));miss.addEventListener('change',go);
  $('reset-dice').addEventListener('click',()=>{miss.checked=true;rough.value=2;size.value=8;run();});
  onResize(cv,go);run();
}

/* ----- 06 De-identification ----- */
const TAGS={en:{name:'NAME',id:'ID',phone:'PHONE',date:'DATE',place:'PLACE',num:'NUMBER',job:'JOB',word:'WORD'},
  he:{name:'שם',id:'ת.ז.',phone:'טלפון',date:'תאריך',place:'מקום',num:'מספר',job:'מקצוע',word:'מילה'}};
const TYPES=[['name','Names'],['date','Dates'],['id','ID & phone'],['place','Address & towns'],['rare','Rare details']];
function initDeid(){
  if(!$('deid'))return;
  const lv=$('di-level'),langs=document.querySelectorAll('input[name="di-lang"]'),views=document.querySelectorAll('input[name="di-view"]'),box=$('di-note');
  const LEVELS=['','Minimal','Basic','Standard','Aggressive','Maximum'];
  const run=()=>{
    const key=[...langs].find(r=>r.checked).value,view=[...views].find(r=>r.checked).value,L=+lv.value,res=deid(key,L),note=NOTES[key];
    $('di-level-value').textContent=L+' · '+LEVELS[L];
    box.dir=note.dir;box.lang=note.lang;
    // character-level classes: gold caught / gold missed / over-redacted
    const txt=res.text,n=txt.length,gold=new Int8Array(n),pred=new Int32Array(n).fill(-1);
    res.gold.forEach(g=>{for(let i=g.s;i<g.e;i++)gold[i]=g.caught?1:2;});res.pred.forEach((p,k)=>{for(let i=p.s;i<p.e;i++)pred[i]=k;});
    let html='';
    if(view==='highlight'){let i=0;while(i<n){const cls=gold[i]===1?'ml-hit':gold[i]===2?'ml-miss':pred[i]>=0?'ml-fp':'';let j=i+1;
        const same=k=>(gold[k]===1?'ml-hit':gold[k]===2?'ml-miss':pred[k]>=0?'ml-fp':'')===cls;while(j<n&&same(j))j++;
        html+=cls?`<mark class="${cls}">${esc(txt.slice(i,j))}</mark>`:esc(txt.slice(i,j));i=j;}}
    else{const tags=TAGS[note.lang==='he'?'he':'en'];let i=0;
      while(i<n){if(pred[i]>=0){const p=res.pred[pred[i]];html+=`<mark class="ml-red${p.fp?' is-fp':''}">[${esc(tags[p.tag])}]</mark>`;i=p.e;continue;}
        let j=i+1;while(j<n&&pred[j]<0&&gold[j]===gold[i])j++;html+=gold[i]===2?`<mark class="ml-miss">${esc(txt.slice(i,j))}</mark>`:esc(txt.slice(i,j));i=j;}}
    box.innerHTML=html;
    $('di-caught').textContent=res.caught+' of '+res.gold.length;$('di-missed').textContent=res.missed;$('di-fp').textContent=res.fp;
    $('di-missed').closest('div').classList.toggle('ml-bad',res.missed>0);$('di-fp').closest('div').classList.toggle('ml-warn',res.fp>0);
    $('di-types').innerHTML=TYPES.map(([t,label])=>{const g=res.gold.filter(x=>x.type===t||(t==='id'&&x.type==='phone'));const c=g.filter(x=>x.caught).length;
      return `<tr><th scope="row">${label}</th><td>${c} / ${g.length}</td><td><span class="ml-meter"><b style="width:${g.length?c/g.length*100:0}%"></b></span></td></tr>`;}).join('');
    $('di-rules').innerHTML=RULES.map(r=>`<li class="${r.level<=L?'is-on':''}"><span>${r.level}</span><span class="ml-rule">${r.label}</span></li>`).join('');
  };
  const go=scheduler(run);lv.addEventListener('input',go);[...langs,...views].forEach(r=>r.addEventListener('change',go));
  $('reset-deid').addEventListener('click',()=>{lv.value=2;langs.forEach(r=>r.checked=r.value==='en');views.forEach(r=>r.checked=r.value==='highlight');run();});
  run();
}

function init(){initEcg();initLeakage();initCalibration();initScanner();initDice();initDeid();
  // the lesion canvas labels use the web font: redraw once it has loaded
  const r=$('dc-rough');if(r&&document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>r.dispatchEvent(new Event('input')));}
window.MLAIAMedLab=Core;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
