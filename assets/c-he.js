/* MLAIA design C: Hebrew strings for the live instruments (mlaia-c.js, c-medical.js and
   c-prediction.js write English). Load after them on Hebrew pages. It only rewrites the text
   those scripts generate on drag handles and sliders: the handle's label, chip and value text,
   and the value text of the tone, level and phase sliders. Canvas labels come from the page
   (data-m-labels / data-p-labels). Numbers and units are wrapped in Unicode isolates so they
   stay left to right. */
(()=>{
'use strict';
if(document.documentElement.lang!=='he')return;
const LRI='⁦',PDI='⁩';
const rules={
  // handle chip, e.g. "◀ drag ▶  noise −7 dB"
  chip:[[/noise\s+([−+]?\d+)\s*dB/,m=>'▶ גררו ◀  רעש '+LRI+m[1]+' dB'+PDI],
        [/tone\s+(\S+\s*k?Hz)/,m=>'▲ גררו ▼  טון '+LRI+m[1]+PDI],
        // c-medical.js: "◀ drag ▶  motion artifact 0.24 mV"
        [/motion artifact\s+([\d.]+)\s*mV/,m=>'▶ גררו ◀  ארטיפקט תנועה '+LRI+m[1]+' mV'+PDI],
        // c-prediction.js: "◀ drag ▶  zero-demand weeks 50%"
        [/zero-demand weeks\s+(\d+)%/,m=>'▶ גררו ◀  שבועות ללא ביקוש '+LRI+m[1]+'%'+PDI]],
  // aria-valuetext on the handle and the range inputs
  value:[[/^noise\s+([−+]?\d+)\s*dB$/,m=>'רעש '+m[1]+' דציבל'],
         [/^tone at\s+(.+)$/,m=>'טון ב-'+m[1]],
         [/^(\S+)\s+hertz$/,m=>m[1]+' הרץ'],
         [/^(\S+)\s+decibels$/,m=>m[1]+' דציבל'],
         [/^(\S+)\s+degrees$/,m=>m[1]+' מעלות'],
         [/^motion artifact\s+(\S+)\s+millivolts$/,m=>'ארטיפקט תנועה '+m[1]+' מיליוולט'],
         [/^(\d+)% chance that a week has zero demand$/,m=>'סיכוי של '+m[1]+'% ששבוע יעבור ללא ביקוש']]
};
const labels={'Noise level':'עוצמת הרעש','Frequency of the added tone':'תדר הטון שנוסף',
  'Motion artifact added to the synthetic ECG':'ארטיפקט התנועה שנוסף ל-ECG הסינתטי',
  'Share of weeks with zero demand (intermittency)':'שיעור השבועות ללא ביקוש'};
const he=/[֐-׿]/;
function tr(text,list){if(!text||he.test(text))return null;for(const [re,f] of list){const m=text.match(re);if(m)return f(m);}return null;}
function fixChip(chip){const t=tr(chip.textContent,rules.chip);if(t!==null)chip.textContent=t;}
function fixValue(el){const t=tr(el.getAttribute('aria-valuetext'),rules.value);if(t!==null)el.setAttribute('aria-valuetext',t);}
function fixLabel(el){const l=labels[el.getAttribute('aria-label')];if(l)el.setAttribute('aria-label',l);}
const seen=new WeakSet();
function wire(root){
  root.querySelectorAll('.c-handle').forEach(h=>{
    if(seen.has(h))return;seen.add(h);
    fixLabel(h);fixValue(h);
    new MutationObserver(()=>fixValue(h)).observe(h,{attributes:true,attributeFilter:['aria-valuetext']});
    const chip=h.querySelector('.c-handle__chip');
    if(chip){chip.dir='rtl';fixChip(chip);new MutationObserver(()=>fixChip(chip)).observe(chip,{childList:true,characterData:true,subtree:true});}
  });
  root.querySelectorAll('input[data-c-ctl]').forEach(i=>{
    if(seen.has(i))return;seen.add(i);
    fixValue(i);new MutationObserver(()=>fixValue(i)).observe(i,{attributes:true,attributeFilter:['aria-valuetext']});
  });
}
function start(){
  wire(document);
  // Instruments injected later (MLAIAC.init on new markup) get their handles then.
  new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1&&(n.matches('.c-handle')||n.querySelector('.c-handle')))wire(n.closest('[data-c-instrument]')||document);})
    .observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
