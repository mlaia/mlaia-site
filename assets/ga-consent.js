/* Google Analytics 4 with Consent Mode v2 (advanced). Loaded synchronously in <head> on every page, before anything
   else calls gtag. Everything starts denied: until a visitor accepts, Google receives only cookieless pings and sets no
   cookies. The stored choice (localStorage 'mlaia-cookie-consent') is applied straight after the default, and every
   banner on the site announces a new choice with the 'mlaia-cookie-consent' event, which updates consent here.
   Contact clicks (WhatsApp, phone, email) are sent as contact_click; form success (generate_lead) is sent by
   practice.js, site-shell.js and the homepage. */
(function(){
  'use strict';
  var GA='G-1T3R1HL53V',KEY='mlaia-cookie-consent';
  if(window._gaLoaded)return;
  if(document.documentElement.getAttribute('data-preview')==='true')return;
  window._gaLoaded=true;
  window.dataLayer=window.dataLayer||[];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag=gtag;
  var DENIED={ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'};
  // Accepting the banner grants analytics only; the ad signals stay denied until the banner also asks about ads.
  var GRANTED={ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'};
  gtag('consent','default',Object.assign({wait_for_update:500},DENIED));
  var stored=null;
  try{stored=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
  if(stored&&stored.analytics===true)gtag('consent','update',GRANTED);
  gtag('js',new Date());
  gtag('config',GA);
  var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+GA;
  document.head.appendChild(s);
  document.addEventListener('mlaia-cookie-consent',function(e){
    var ok=!!(e&&e.detail&&e.detail.analytics);
    gtag('consent','update',ok?GRANTED:DENIED);
  });
  // Contact actions, as one GA4 event that can be marked as a key event.
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;
    var h=a.getAttribute('href')||'',m=null;
    if(/^https?:\/\/(www\.)?(wa\.me|api\.whatsapp\.com)\//i.test(h))m='whatsapp';
    else if(/^tel:/i.test(h))m='phone';
    else if(/^mailto:/i.test(h))m='email';
    if(m)gtag('event','contact_click',{method:m,page_path:location.pathname});
  },true);
})();
