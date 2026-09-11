// ═══════════════════════════════════════════════════════════════════════════════
// FINOSUTRA — Ads Module (Google AdSense)
// Version: 1.0
//
// Pro subscribers never see ads; everyone else does. Reads window.isProUser,
// which auth.js sets. Load this AFTER auth.js.
//
// HOW TO USE ON A PAGE:
//   1. <script src="auth.js?v=13"></script>   (must come first)
//      <script src="ads.js?v=1"></script>
//   2. Drop slot markers where an ad should render:
//      <ins class="fs-ad-slot" data-ad-slot="XXXXXXXXXX"></ins>
//      (data-ad-slot = the AdSense ad unit ID; create one per placement in
//      the AdSense UI after the account is approved)
//
// SETUP (after AdSense approval):
//   Replace ADSENSE_CLIENT below with the real "ca-pub-..." publisher ID.
//   Until then this module is a no-op everywhere it's included.
// ═══════════════════════════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  var ADSENSE_CLIENT = 'ca-pub-6258197474786729';
  var ENABLED = ADSENSE_CLIENT.indexOf('REPLACE_WITH') === -1;

  function loadAdSenseScript(cb) {
    if (global.adsbygoogle) { cb(); return; }
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT;
    s.crossOrigin = 'anonymous';
    s.onload = cb;
    s.onerror = function () { console.warn('[ads.js] AdSense script failed to load'); };
    document.head.appendChild(s);
  }

  function renderSlots() {
    var slots = document.querySelectorAll('.fs-ad-slot[data-ad-slot]');
    if (!slots.length) return;
    loadAdSenseScript(function () {
      slots.forEach(function (slot) {
        if (slot.dataset.fsRendered) return;
        slot.dataset.fsRendered = '1';
        slot.classList.add('adsbygoogle');
        slot.style.display = 'block';
        slot.setAttribute('data-ad-client', ADSENSE_CLIENT);
        slot.setAttribute('data-ad-format', slot.getAttribute('data-ad-format') || 'auto');
        slot.setAttribute('data-full-width-responsive', 'true');
        try { (global.adsbygoogle = global.adsbygoogle || []).push({}); }
        catch (e) { console.warn('[ads.js] push failed', e); }
      });
    });
  }

  // Pro users: remove slot elements outright (not just hide) so no space is
  // reserved and no ad request is ever made for them.
  function stripSlots() {
    document.querySelectorAll('.fs-ad-slot').forEach(function (slot) { slot.remove(); });
  }

  // auth.js resolves window.isProUser asynchronously (Supabase getSession()
  // on DOMContentLoaded) and has no reliable "auth ready" event — the
  // fs-auth-ready event / fsOnAuthReady hook that nav.js listens for is
  // never actually dispatched or defined anywhere in auth.js (nav.js works
  // around the same gap with its own fsRefreshNavUI fallback). A short fixed
  // delay is a pragmatic stand-in: getSession() reads local storage and
  // normally resolves in well under this window.
  var AUTH_SETTLE_MS = 700;

  function init() {
    if (!ENABLED) return;
    setTimeout(function () {
      if (global.isProUser) stripSlots();
      else renderSlots();
    }, AUTH_SETTLE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
