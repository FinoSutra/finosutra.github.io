(function(){
var CSS='.share-bar{display:flex;align-items:center;gap:8px;padding:10px 16px;border-top:1px solid rgba(99,102,241,0.1);flex-wrap:wrap;background:#fff;}'
+'.shr-label{font-size:12px;color:#6B7280;font-weight:500;margin-right:2px;}'
+'.shr-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;font-family:\'Inter\',sans-serif;border:1px solid #E5E7EB;background:#F9FAFB;color:#374151;transition:all .15s;}'
+'.shr-btn:hover{border-color:#6366F1;color:#6366F1;background:#EEF2FF;}'
+'.shr-wa{border-color:#25D366!important;color:#15803D!important;background:#F0FFF4!important;}'
+'.shr-wa:hover{background:#25D366!important;color:#fff!important;}'
+'.shr-li{border-color:#0A66C2!important;color:#1D4ED8!important;background:#EFF6FF!important;}'
+'.shr-li:hover{background:#0A66C2!important;color:#fff!important;}'
+'.share-box{background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:20px 24px;text-align:center;margin:32px 0;}'
+'.share-box-title{font-size:15px;font-weight:700;color:#1E1B4B;margin-bottom:14px;}'
+'.share-btns{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;}';

var WA='<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

var LI='<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';

function copyLink(btn){
  navigator.clipboard.writeText(location.href).then(function(){
    btn.innerHTML='&#10003; Copied!';
    setTimeout(function(){btn.innerHTML='<i class="fa-solid fa-link" style="font-size:11px"></i> Copy link';},2000);
  });
}

function makeBtns(){
  var copyBtn='<button class="shr-btn" onclick="('+copyLink.toString()+')(this)"><i class="fa-solid fa-link" style="font-size:11px"></i> Copy link</button>';
  var waBtn='<a class="shr-btn shr-wa" href="#" onclick="event.preventDefault();window.open(\'https://wa.me/?text=\'+encodeURIComponent(document.title+\' — \'+location.href),\'_blank\')" rel="noopener">'+WA+' WhatsApp</a>';
  var liBtn='<a class="shr-btn shr-li" href="#" onclick="event.preventDefault();window.open(\'https://www.linkedin.com/sharing/share-offsite/?url=\'+encodeURIComponent(location.href),\'_blank\')" rel="noopener">'+LI+' LinkedIn</a>';
  return copyBtn+waBtn+liBtn;
}

function inject(){
  var s=document.createElement('style');
  s.textContent=CSS;
  document.head.appendChild(s);

  // Blog mode: insert share box before .cta-box
  var cta=document.querySelector('.cta-box');
  if(cta){
    var box=document.createElement('div');
    box.className='share-box';
    box.innerHTML='<p class="share-box-title">Found this useful? Share it</p><div class="share-btns">'+makeBtns()+'</div>';
    cta.parentNode.insertBefore(box,cta);
    return;
  }

  // Tool mode: insert share bar after hero or page-header
  var anchor=document.querySelector('.hero, .page-header');
  if(anchor){
    var bar=document.createElement('div');
    bar.className='share-bar';
    bar.innerHTML='<span class="shr-label">Share:</span>'+makeBtns();
    anchor.parentNode.insertBefore(bar,anchor.nextSibling);
    return;
  }

  // Fallback for app-layout pages: insert slim bar after main nav
  var nav=document.querySelector('nav#mainNav, nav.main-nav');
  if(nav){
    var wrap=document.createElement('div');
    wrap.style.cssText='background:#fff;border-bottom:1px solid rgba(99,102,241,0.1);';
    var bar2=document.createElement('div');
    bar2.className='share-bar';
    bar2.style.cssText='max-width:1200px;margin:0 auto;border-top:none;';
    bar2.innerHTML='<span class="shr-label">Share:</span>'+makeBtns();
    wrap.appendChild(bar2);
    nav.parentNode.insertBefore(wrap,nav.nextSibling);
  }
}

document.addEventListener('DOMContentLoaded',inject);
})();
