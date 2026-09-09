/* Shared navigation and consent-aware, non-PII inquiry measurement. */
(()=>{
  'use strict';
  const preview=document.documentElement.dataset.preview==='true';
  const allowed=['audio-ai','medical-ai','predictive-intelligence','ai-automation'];
  const requested=new URLSearchParams(location.search).get('practice');
  const practice=document.body.dataset.practice||(allowed.includes(requested)?requested:'general');
  const field=document.getElementById('inquiry-practice');
  if(field)field.value=practice;
  // Native radio controls retain keyboard behavior without custom tab handling.
  const choices=document.querySelectorAll('input[name="causal-example"]');
  const levels=document.querySelectorAll('input[name="causal-level"]');
  levels.forEach(level=>level.addEventListener('change',()=>{
    if(!level.checked)return;
    document.querySelectorAll('.causal-stage').forEach(stage=>{stage.hidden=stage.dataset.level!==level.value;});
    const status=document.getElementById('ladder-status');
    if(status)status.textContent=level.parentElement.textContent.trim()+': question and evidence updated.';
  }));
  if(choices.length){
    const panels=document.querySelectorAll('.causal-panel');
    const status=document.getElementById('ladder-status');
    function showExample(choice,announce){
      if(!choice.checked)return;
      const panelId=choice.getAttribute('aria-controls');
      panels.forEach(panel=>{panel.hidden=panel.id!==panelId;});
      if(announce&&status)status.textContent=choice.parentElement.textContent.trim()+': selected rung’s question and evidence updated.';
    }
    choices.forEach(choice=>{
      choice.addEventListener('change',()=>showExample(choice,true));
      if(choice.checked)showExample(choice,false);
    });
  }
  const menu=document.querySelector('.p-menu'),nav=document.querySelector('.p-nav-links');
  if(menu&&nav){
    const close=()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');};
    menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
    nav.addEventListener('click',e=>{if(e.target.closest('a'))close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();menu.focus();}});
  }
  function hasConsent(){try{return JSON.parse(localStorage.getItem('mlaia-cookie-consent')||'{}').analytics===true;}catch{return false;}}
  function track(event,p=practice){if(!preview&&hasConsent()&&typeof window.gtag==='function')window.gtag('event',event,{practice:allowed.includes(p)?p:'general'});}
  document.addEventListener('click',e=>{if(e.target.closest('a[href="#contact"]'))track('contact_cta_click');});
  document.addEventListener('mlaia-inquiry-success',e=>track('generate_lead',e.detail?.practice));
  // The existing homepage owns its own consent UI and analytics loader.
  if(document.body.classList.contains('practice-page')){
    const consent=document.querySelector('.p-consent');
    function loadAnalytics(){
      if(preview||!hasConsent()||window._gaLoaded)return;
      window._gaLoaded=true;window.dataLayer=window.dataLayer||[];
      window.gtag=function(){window.dataLayer.push(arguments);};
      window.gtag('js',new Date());window.gtag('config','G-1T3R1HL53V');
      const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id=G-1T3R1HL53V';document.head.append(script);
    }
    function choose(analytics){
      try{localStorage.setItem('mlaia-cookie-consent',JSON.stringify({necessary:true,analytics,timestamp:Date.now()}));}catch{}
      consent.hidden=true;
      if(!analytics&&window._gaLoaded){location.reload();return;}
      loadAnalytics();
    }
    if(consent){
      let saved=false;try{saved=!!localStorage.getItem('mlaia-cookie-consent');}catch{}
      consent.hidden=preview||saved;
      consent.querySelectorAll('[data-consent]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.consent==='yes')));
      document.querySelector('.p-cookie-settings')?.addEventListener('click',()=>{consent.hidden=false;consent.querySelector('button')?.focus();});
      loadAnalytics();
    }
    document.querySelector('.p-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget,status=form.querySelector('.p-form-status'),button=form.querySelector('button[type=submit]');
      if(preview){status.textContent='Preview only — nothing was sent.';return;}
      if(!form.reportValidity())return;
      button.disabled=true;status.textContent='Sending your inquiry…';
      try{
        const response=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error('Submission failed');
        track('generate_lead');form.reset();status.textContent='Thank you. Your inquiry was sent to MLAIA.';
      }catch{status.textContent='Your inquiry could not be sent. Please try again or email yochai@mlaia.com.';}
      finally{button.disabled=false;}
    });
  }
})();
