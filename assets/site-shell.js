(()=>{
 // Analytics consent for pages without their own banner (the homepage and practice pages have one).
 // Same storage key and event as those banners, so the inline GA loader reacts to either.
 const KEY='mlaia-cookie-consent',preview=document.documentElement.dataset.preview==='true';
 let consent=null;
 if(!document.getElementById('cookie-banner')&&!document.querySelector('.p-consent')){
  consent=document.createElement('div');consent.className='site-consent';consent.hidden=true;
  consent.setAttribute('role','region');consent.setAttribute('aria-label','Cookie preferences');
  consent.innerHTML='<p><span data-en="Optional analytics help us understand how the website is used. You can decline and still use every feature." data-he="אנליטיקה אופציונלית עוזרת לנו להבין כיצד משתמשים באתר. ניתן לסרב ולהמשיך להשתמש בכל תכונות האתר."></span> <a href="/privacy.html" data-en="Privacy Policy" data-he="מדיניות הפרטיות"></a></p><div class="site-consent-actions"><button type="button" data-consent="yes" data-en="Accept analytics" data-he="אישור אנליטיקה"></button><button type="button" class="secondary" data-consent="no" data-en="Decline" data-he="סירוב"></button></div>';
  document.body.append(consent);
  const choose=analytics=>{
   try{localStorage.setItem(KEY,JSON.stringify({necessary:true,essential:true,analytics,marketing:false,timestamp:Date.now()}));}catch{}
   consent.hidden=true;
   if(!analytics&&window._gaLoaded){location.reload();return;}
   document.dispatchEvent(new CustomEvent('mlaia-cookie-consent',{detail:{analytics}}));
  };
  consent.querySelectorAll('[data-consent]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.consent==='yes')));
  consent.addEventListener('keydown',e=>{if(e.key==='Escape')choose(false);});
  document.querySelectorAll('[data-cookie-settings]').forEach(b=>b.addEventListener('click',()=>{consent.hidden=false;consent.querySelector('button').focus();}));
  let saved=false;try{saved=!!localStorage.getItem(KEY);}catch{}
  consent.hidden=preview||saved;
 }
 // Contact tracking for pages without practice.js (which tracks these itself). Fires only when GA was loaded with consent.
 if(!document.querySelector('script[src*="practice.js"]')){
  const ga=(name,params)=>{if(typeof window.gtag==='function')window.gtag('event',name,params);};
  document.addEventListener('click',e=>{if(e.target.closest('a[href="#contact"],a[href$="/#contact"]'))ga('contact_cta_click',{page_path:location.pathname});else if(e.target.closest('a[href^="https://talk.mlaia.com"]'))ga('demo_click',{page_path:location.pathname});});
  document.addEventListener('mlaia-inquiry-success',()=>ga('generate_lead',{page_path:location.pathname}));
 }
 function language(){const he=document.documentElement.lang==='he';document.querySelectorAll('.site-quick-nav [data-en],.site-consent [data-en]').forEach(el=>{el.textContent=he?el.dataset.he:el.dataset.en;});if(consent)consent.dir=he?'rtl':'ltr';}
 language();new MutationObserver(language).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 document.querySelectorAll('.site-inquiry').forEach(form=>form.addEventListener('submit',async e=>{
  e.preventDefault();const status=form.querySelector('.site-inquiry-status'),button=form.querySelector('button');
  if(document.documentElement.dataset.preview==='true'){status.textContent='Preview only — nothing was sent.';return;}
  if(!form.reportValidity())return;button.disabled=true;status.textContent='Sending your inquiry…';
  try{const data=new FormData(form);data.set('page',location.pathname);const r=await fetch(form.action,{method:'POST',body:data,headers:{Accept:'application/json'}});if(!r.ok)throw Error();status.textContent='Thank you. Your inquiry was sent to MLAIA.';form.reset();document.dispatchEvent(new CustomEvent('mlaia-inquiry-success',{detail:{practice:'general'}}));}
  catch{status.textContent='Your inquiry could not be sent. Please try again or email yochai@mlaia.com.';}finally{button.disabled=false;}
 }));
})();
