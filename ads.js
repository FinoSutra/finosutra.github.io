// ═══════════════════════════════════════════════════════════════════════════════
// FINOSUTRA — Ads Module (Google AdSense Auto Ads)
// Version: 2.0
//
// Pro subscribers never see ads; everyone else does. Reads window.isProUser,
// which auth.js sets. Load this AFTER auth.js on every page.
//
// Uses AdSense Auto Ads — Google decides ad placement automatically once
// Auto Ads is turned on for finosutra.com in the AdSense dashboard. No
// per-page ad units or slot markup needed; this script only decides whether
// the base AdSense script loads at all for a given visitor.
// ═══════════════════════════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  var ADSENSE_CLIENT = 'ca-pub-6258197474786729';

  var adsenseScriptSrc = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT;

  function loadAdSenseScript() {
    if (document.querySelector('script[src="' + adsenseScriptSrc + '"]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = adsenseScriptSrc;
    s.crossOrigin = 'anonymous';
    s.onerror = function () { console.warn('[ads.js] AdSense script failed to load'); };
    document.head.appendChild(s);
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
    setTimeout(function () {
      if (!global.isProUser) loadAdSenseScript();
    }, AUTH_SETTLE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
