(()=>{
 const nav=document.querySelector('.site-quick-nav');
 function language(){const he=document.documentElement.lang==='he';nav?.querySelectorAll('[data-en]').forEach(el=>{el.textContent=he?el.dataset.he:el.dataset.en;});}
 language();new MutationObserver(language).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 document.querySelectorAll('.site-inquiry').forEach(form=>form.addEventListener('submit',async e=>{
  e.preventDefault();const status=form.querySelector('.site-inquiry-status'),button=form.querySelector('button');
  if(document.documentElement.dataset.preview==='true'){status.textContent='Preview only — nothing was sent.';return;}
  if(!form.reportValidity())return;button.disabled=true;status.textContent='Sending your inquiry…';
  try{const data=new FormData(form);data.set('page',location.pathname);const r=await fetch(form.action,{method:'POST',body:data,headers:{Accept:'application/json'}});if(!r.ok)throw Error();status.textContent='Thank you. Your inquiry was sent to MLAIA.';form.reset();document.dispatchEvent(new CustomEvent('mlaia-inquiry-success',{detail:{practice:'general'}}));}
  catch{status.textContent='Your inquiry could not be sent. Please try again or email yochai@mlaia.com.';}finally{button.disabled=false;}
 }));
})();
