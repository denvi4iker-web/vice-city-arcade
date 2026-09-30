(() => {
'use strict';
const frame=document.getElementById('leonidaFrame'),shell=document.getElementById('leonidaShell'),button=document.getElementById('leonidaExpand'),loading=document.getElementById('leonidaLoading');
if(!frame||!shell)return;
let expanded=false,opener=null,active=false,inertBefore=new Map();
const send=(action,extra={})=>frame.contentWindow?.postMessage({type:'leonida:host',action,...extra},location.origin);
function expand(value){if(value===expanded)return;expanded=value;shell.classList.toggle('expanded',value);document.body.classList.toggle('leonida-expanded',value);button.setAttribute('aria-expanded',String(value));button.innerHTML=value?'<span aria-hidden="true">×</span> Свернуть карту':'<span aria-hidden="true">⛶</span> Развернуть карту';
 if(value){opener=document.activeElement;for(const el of document.querySelectorAll('.wrap>header,.wrap>footer,main>:not(#leonida)')){inertBefore.set(el,el.inert);el.inert=true;}frame.focus();}else{for(const [el,inert]of inertBefore)el.inert=inert;inertBefore.clear();opener?.focus();}send('expanded',{value});}
button.addEventListener('click',()=>expand(!expanded));
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='leonida:map')return;const m=event.data;
 if(m.action==='ready'){loading.hidden=true;send('expanded',{value:expanded});send('active',{value:active});}
 if(m.action==='expand')expand(!expanded);if(m.action==='collapse')expand(false);
 if(m.action==='scroll'&&!expanded&&Number.isFinite(m.delta))window.scrollBy({top:Math.max(-800,Math.min(800,m.delta)),behavior:'instant'});
});
frame.addEventListener('load',()=>{send('expanded',{value:expanded});send('active',{value:active});});
document.addEventListener('keydown',event=>{if(expanded&&event.key==='Escape'){event.preventDefault();expand(false);}});
if('IntersectionObserver'in window)new IntersectionObserver(entries=>{active=entries[0].isIntersecting;send('active',{value:active});},{threshold:0}).observe(shell);else active=true;
})();
