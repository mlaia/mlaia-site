(()=>{
 // Valuable-traffic events for GA4. Loaded by site-shell.js only after analytics consent, so window.gtag exists
 // whenever GA does. Every event fires at most once per page view and carries no personal data and no query strings.
 if(window._mlaiaEventsRunning)return;window._mlaiaEventsRunning=true;
 const sent=new Set(),path=location.pathname;
 const ga=(name,params)=>{if(sent.has(name))return;sent.add(name);if(typeof window.gtag==='function')window.gtag('event',name,Object.assign({page_path:path},params));};
 // Outbound and contact links: WhatsApp, the GitHub organisation, LinkedIn.
 document.addEventListener('click',e=>{
  const a=e.target.closest('a[href]');if(!a)return;const href=a.getAttribute('href')||'';
  if(/^https?:\/\/(www\.)?wa\.me\//.test(href))ga('whatsapp_click');
  else if(/^https?:\/\/(www\.)?github\.com\/mlaia(\/|$)/i.test(href))ga('outbound_github_click');
  else if(/^https?:\/\/([a-z]+\.)?linkedin\.com\//i.test(href))ga('linkedin_click');
 },true);
 // Labs: the first touch of any control inside an experiment section (sliders, radios, selects, buttons, listen buttons).
 // lab = which lab from the path; demo = the page slug, or the experiment's section id on a lab hub page.
 const labs=[['/audio-ai/lab/','audio'],['/medical-ai/lab/','medical'],['/predictive-intelligence/lab/','causal']];
 const lab=(labs.find(([p])=>path.startsWith(p))||[])[1];
 if(lab){
  const slug=path.replace(/\/+$/,'').split('/').pop();
  const onControl=e=>{
   const box=e.target.closest('.lab-experiment,.lab-controls');if(!box)return;
   if(e.type==='click'&&!e.target.closest('button,[role="button"],input,select,label'))return;
   const section=e.target.closest('.lab-experiment');
   ga('lab_interaction',{lab,demo:slug==='lab'&&section&&section.id?section.id:slug});
  };
  ['input','change','click'].forEach(t=>document.addEventListener(t,onControl,true));
 }
 // Articles: read deeply = scrolled past 60% of the page and at least 45 seconds on it.
 if(document.querySelector('article')){
  let deep=false,long=false;
  const check=()=>{if(deep&&long){ga('article_read');window.removeEventListener('scroll',onScroll);}};
  const onScroll=()=>{if(deep)return;const h=document.documentElement.scrollHeight;if(h&&(window.scrollY+window.innerHeight)/h>=.6){deep=true;check();}};
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  setTimeout(()=>{long=true;onScroll();check();},45000);
 }
})();
