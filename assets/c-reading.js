/* MLAIA design C, reading pages (blog, wiki, legal): mobile menu toggle.
   Only buttons marked data-c-menu are wired here; pages whose own inline script
   already toggles .hamburger / .nav-links leave the attribute off. */
(()=>{
 document.querySelectorAll('[data-c-menu]').forEach(btn=>{
  const menu=document.getElementById(btn.getAttribute('aria-controls'));
  if(!menu)return;
  const set=open=>{menu.classList.toggle('open',open);btn.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));};
  btn.addEventListener('click',()=>set(!menu.classList.contains('open')));
  menu.addEventListener('click',e=>{if(e.target.closest('a'))set(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.classList.contains('open')){set(false);btn.focus();}});
 });
})();
