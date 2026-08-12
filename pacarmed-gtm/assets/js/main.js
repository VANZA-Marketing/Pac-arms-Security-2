'use strict';
var t=document.getElementById('menuToggle'), nav=document.getElementById('mainNav');
if(t&&nav){
 t.addEventListener('click',function(){
  var o=nav.classList.toggle('mobile-open');
  t.setAttribute('aria-expanded',o?'true':'false');
  if(!o){nav.querySelectorAll('.has-dropdown.open').forEach(function(li){li.classList.remove('open');var la=li.querySelector('a');if(la)la.setAttribute('aria-expanded','false');});}
 });
 /* Mobile: tap a parent item (Services / Industries) to expand its submenu,
    instead of every submenu showing open. Desktop keeps hover + click-through. */
 nav.querySelectorAll('.has-dropdown>a').forEach(function(a){
  a.setAttribute('aria-haspopup','true');
  a.setAttribute('aria-expanded','false');
  a.addEventListener('click',function(e){
   if(!(window.matchMedia&&window.matchMedia('(max-width:768px)').matches))return;
   e.preventDefault();
   var li=a.parentNode, open=li.classList.contains('open');
   nav.querySelectorAll('.has-dropdown.open').forEach(function(o){if(o!==li){o.classList.remove('open');var oa=o.querySelector('a');if(oa)oa.setAttribute('aria-expanded','false');}});
   li.classList.toggle('open',!open);
   a.setAttribute('aria-expanded',!open?'true':'false');
  });
 });
}
window.addEventListener('scroll',function(){var h=document.getElementById('siteHeader');if(h)h.classList.toggle('scrolled',window.scrollY>10);},{passive:true});
var obs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target);}});},{threshold:0.07,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.animate').forEach(function(el){obs.observe(el);});
function showFileName(inp){var el=document.getElementById('ap-resume-name');if(!el)return;
 if(inp.files&&inp.files[0]){var f=inp.files[0];
  if(f.size>10*1024*1024){el.textContent='That file is over 10MB \u2014 please attach a smaller one.';el.classList.add('show');inp.value='';return;}
  el.textContent='\u2713 '+f.name+' ('+Math.round(f.size/1024)+' KB)';el.classList.add('show');}else{el.classList.remove('show');}}
function post(f,btn,okText){var body=new FormData(f);btn.disabled=true;btn.textContent='Sending\u2026';
 fetch('/',{method:'POST',body:body}).then(function(r){if(!r.ok)throw 0;btn.textContent=okText;f.reset();})
 .catch(function(){btn.textContent='Call (808) 435-5022';btn.disabled=false;});return false;}
function submitContact(e){
 e.preventDefault();
 var f=e.target, msg=document.getElementById('cf-captcha-msg'), btn=f.querySelector('button[type=submit]');
 var tokenEl=f.querySelector('[name="cf-turnstile-response"]');
 var token=tokenEl?tokenEl.value:'';
 if(!token){ if(msg){msg.textContent='Please complete the captcha before sending.';msg.hidden=false;} return false; }
 if(msg)msg.hidden=true;
 var data={}; new FormData(f).forEach(function(v,k){data[k]=v;});
 var original=btn.innerHTML; btn.disabled=true; btn.textContent='Sending\u2026';
 fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
  .then(function(r){return r.json().then(function(j){return {ok:r.ok&&j&&j.ok,j:j};}).catch(function(){return {ok:r.ok,j:null};});})
  .then(function(res){ if(!res.ok) throw 0; btn.textContent='Request sent \u2713'; f.reset(); if(window.turnstile)try{turnstile.reset();}catch(_){} })
  .catch(function(){ btn.disabled=false; btn.innerHTML=original; if(window.turnstile)try{turnstile.reset();}catch(_){}
    if(msg){msg.textContent='Sorry, that didn\u2019t send. Please try again or call (808) 435-5022.';msg.hidden=false;} });
 return false;
}
function submitApplication(e){e.preventDefault();return post(e.target,e.target.querySelector('button[type=submit]'),'Application sent \u2713');}

/* ---- Training Academy: expandable course details (progressive enhancement) ----
   Cards ship fully expanded so the syllabus is readable without JS.
   When JS runs we reveal the toggle, collapse the extra details, and wire ARIA. */
(function(){
  var toggles=document.querySelectorAll('.crs-toggle');
  if(!toggles.length)return;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  toggles.forEach(function(btn){
    var wrap=btn.closest('.crs-card').querySelector('.crs-details-wrap');
    var panel=document.getElementById(btn.getAttribute('aria-controls'));
    if(!wrap||!panel)return;
    var txt=btn.querySelector('.crs-toggle-txt');
    function set(open){
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(txt)txt.textContent=open?'Hide course details':'View course details';
      wrap.classList.toggle('is-collapsed',!open);
      if(open){panel.removeAttribute('inert');panel.removeAttribute('aria-hidden');}
      else{panel.setAttribute('inert','');panel.setAttribute('aria-hidden','true');}
    }
    btn.hidden=false;
    if(reduce){wrap.style.transition='none';}
    set(false); // start collapsed
    if(reduce){requestAnimationFrame(function(){wrap.style.transition='';});}
    btn.addEventListener('click',function(){set(btn.getAttribute('aria-expanded')!=='true');});
  });
})();

/* ---- Contact page: prefill training interest from ?training= ---- */
(function(){
  try{
    var course=new URLSearchParams(window.location.search).get('training');
    if(!course)return;
    course=course.slice(0,120);
    var form=document.querySelector('form[name="contact"]');
    if(!form)return;
    var msg=form.querySelector('textarea[name="message"]');
    if(msg&&!msg.value){msg.value='Training interest: '+course+'\n\nI\u2019d like to request upcoming class dates and availability.';}
    var sel=form.querySelector('select[name="service"]');
    if(sel){for(var i=0;i<sel.options.length;i++){var o=sel.options[i];if(o.value===course||o.text===course){sel.selectedIndex=i;break;}}}
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  }catch(e){}
})();

/* ---- Insights: category filter (progressive enhancement) ---- */
(function(){
  var bar=document.getElementById('insightFilter');
  var grid=document.getElementById('insightGrid');
  if(!bar||!grid)return;
  bar.hidden=false;
  var chips=bar.querySelectorAll('.insight-fchip');
  var cards=grid.querySelectorAll('.insight-card');
  bar.addEventListener('click',function(e){
    var btn=e.target.closest('.insight-fchip');
    if(!btn)return;
    var f=btn.getAttribute('data-filter');
    chips.forEach(function(c){c.setAttribute('aria-pressed', c===btn?'true':'false');});
    cards.forEach(function(card){
      var cats=(card.getAttribute('data-cats')||'').split('|');
      var show=(f==='*'||cats.indexOf(f)!==-1);
      card.style.display=show?'':'none';
    });
  });
})();
