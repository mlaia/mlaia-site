(function(){
  'use strict';
  const data=globalThis.MLAIA_DEMO;
  const sigmoid=z=>1/(1+Math.exp(-z));
  function explain(x){const contributions=x.map((v,i)=>data.coef[i]*(v-data.mean[i]));const logOdds=data.baseline+contributions.reduce((a,b)=>a+b,0);return{contributions,logOdds,p:sigmoid(logOdds)};}
  function evaluate(threshold){let tp=0,tn=0,fp=0,fn=0;for(const row of data.cases){const flag=explain(row.x).p>=threshold;if(flag&&row.y)tp++;else if(flag)fp++;else if(row.y)fn++;else tn++;}return{tp,tn,fp,fn};}
  if(typeof module!=='undefined'&&module.exports){module.exports={explain,evaluate};return;}
  const $=id=>document.getElementById(id),pct=p=>(100*p).toFixed(1)+'%',signed=n=>(n>=0?'+':'')+n.toFixed(2);
  let selected=0,x=[],threshold=.5;
  const sorted=data.cases.map((r,i)=>({i,p:explain(r.x).p})).sort((a,b)=>a.p-b.p);
  selected=sorted[Math.floor(sorted.length*.6)].i;
  $('customer').innerHTML=data.cases.map((r,i)=>`<option value="${i}">${r.id}</option>`).join('');
  $('feature-controls').innerHTML=data.features.map((f,i)=>`<div class="demo-control"><div class="demo-control-label"><label for="feature-${i}">${f.label}</label><output id="value-${i}" for="feature-${i}"></output></div><input type="range" id="feature-${i}" min="${f.min}" max="${f.max}" step="1"></div>`).join('');
  function prediction(){const result=explain(x),original=explain(data.cases[selected].x).p,changed=x.some((v,i)=>v!==data.cases[selected].x[i]);
    $('score').textContent=pct(result.p);$('original-score').textContent=pct(original);$('change').textContent=changed?`${signed((result.p-original)*100)} percentage points`:'No changes';
    $('decision').textContent=`${result.p>=threshold?'Flagged for review':'Below review threshold'} · threshold ${Math.round(threshold*100)}%${changed?' · edited scenario':''}`;
    $('observed').textContent=`Original observed outcome: ${data.cases[selected].y?'churned':'stayed'}.${changed?' Edited scenario: outcome unknown.':''}`;
    data.features.forEach((f,i)=>{$('value-'+i).textContent=x[i]+' '+f.unit;});
    const max=Math.max(...result.contributions.map(Math.abs),.01);
    $('contributions').innerHTML=result.contributions.map((v,i)=>({v,i})).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).map(({v,i})=>`<div class="demo-contribution"><span>${data.features[i].label}</span><span class="demo-bar-track" aria-hidden="true"><span class="demo-bar ${v<0?'lower':''}" style="left:${v<0?50-Math.abs(v)/max*48:50}%;width:${Math.abs(v)/max*48}%"></span></span><strong>${signed(v)}</strong></div>`).join('');
    $('score-equation').textContent=`Baseline ${data.baseline.toFixed(2)} + contributions ${signed(result.contributions.reduce((a,b)=>a+b,0))} = ${result.logOdds.toFixed(2)} log-odds → ${pct(result.p)} probability`;
  }
  function choose(){x=[...data.cases[selected].x];$('customer').value=String(selected);x.forEach((v,i)=>{$('feature-'+i).value=v;});prediction();}
  function performance(){const m=evaluate(threshold);for(const k of ['tp','tn','fp','fn'])$(k).textContent=m[k];const flagged=m.tp+m.fp;
    const precision=flagged?pct(m.tp/flagged):'N/A',recall=m.tp+m.fn?pct(m.tp/(m.tp+m.fn)):'N/A';
    $('metrics').innerHTML=[['Flagged for review',`${flagged} / 600`],['Precision · flagged who churned',precision],['Recall · churners found',recall],['Accuracy · correct classifications',pct((m.tp+m.tn)/600)]].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');
    $('threshold-value').textContent=Math.round(threshold*100)+'%';
  }
  $('customer').addEventListener('change',e=>{selected=Number(e.target.value);choose();});$('reset').addEventListener('click',choose);
  data.features.forEach((_,i)=>$('feature-'+i).addEventListener('input',e=>{x[i]=Number(e.target.value);prediction();}));
  $('threshold').addEventListener('input',e=>{threshold=Number(e.target.value)/100;performance();prediction();});
  const maxImp=Math.max(...data.importance);
  $('importance').innerHTML=data.importance.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v).map(({v,i})=>`<div class="demo-importance"><span>${data.features[i].label}</span><strong>${v.toFixed(2)}</strong><span class="demo-importance-bar" aria-hidden="true"><span style="width:${v/maxImp*100}%"></span></span></div>`).join('');
  choose();performance();
})();
