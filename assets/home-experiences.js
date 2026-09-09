(function(){
  'use strict';
  function evaluate(data,threshold){
    const result={tp:0,tn:0,fp:0,fn:0};
    for(const row of data.cases){
      const logOdds=data.intercept+row.x.reduce((s,v,i)=>s+v*data.coef[i],0);
      const flag=1/(1+Math.exp(-logOdds))>=threshold;
      result[flag?(row.y?'tp':'fp'):(row.y?'fn':'tn')]++;
    }
    return result;
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={evaluate};return;}
  const $=id=>document.getElementById(id),slider=$('quick-threshold'),data=globalThis.MLAIA_DEMO;
  if(!slider||!data)return;
  function update(announce){
    const m=evaluate(data,Number(slider.value)/100),flagged=m.tp+m.fp;
    ['tp','tn','fp','fn'].forEach(k=>{$('quick-'+k).textContent=m[k];});
    $('quick-threshold-value').textContent=slider.value+'%';
    const ratio=(n,d)=>d?(100*n/d).toFixed(1)+'%':'—';
    $('quick-precision').textContent=ratio(m.tp,flagged);
    $('quick-recall').textContent=ratio(m.tp,m.tp+m.fn);
    $('quick-flagged').textContent=flagged+' / '+data.cases.length;
    if(announce)$('quick-summary').textContent=document.documentElement.lang==='he'?`סף ${slider.value}%. ${m.fp} התרעות שווא. ${m.fn} מקרי נטישה שהוחמצו.`:`Threshold ${slider.value}%. ${m.fp} false alarms; ${m.fn} missed churn cases.`;
  }
  slider.addEventListener('input',()=>update(false));slider.addEventListener('change',()=>update(true));update(false);
})();
