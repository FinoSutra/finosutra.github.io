// ═══════════════════════════════════════════════════════════════════════════════
// FINOSUTRA — Shared Auth + Pro Subscription Module
// Version: 1.0 | Covers: all 5 paid tools
//
// HOW TO USE IN ANY TOOL FILE:
//   1. Add before </head>:
//      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//      <script src="auth.js"></script>
//   2. That's it. Auth modal, Pro gate, nav UI all inject automatically.
// ═══════════════════════════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  // ── Constants ───────────────────────────────────────────────────────────────
  var SUPA_URL  = 'https://uymuivmktvtxmodblxie.supabase.co';
  var SUPA_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5bXVpdm1rdHZ0eG1vZGJseGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMjk5NTYsImV4cCI6MjA5NjkwNTk1Nn0.7dsdrDmYR8R891_Cc68K75tUlmwi49KExGGQbBq3qmg';
  var EDGE_URL  = 'https://uymuivmktvtxmodblxie.supabase.co/functions/v1/confirm-subscription';
  var RZP_KEY   = 'rzp_live_Sty2e9lT4uXzJJ';

  // ── Global state ─────────────────────────────────────────────────────────────
  global.currentUser = null;
  global.isProUser   = false;
  global.supaClient  = null;

  // ── Fallback toast (only defined if tool doesn't already have one) ──────────
  if (typeof global.showToast !== 'function') {
    global.showToast = function (msg, color) {
      var t = document.getElementById('toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;color:#fff;z-index:99999;opacity:0;transition:opacity .3s;pointer-events:none;font-family:Inter,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.2);max-width:90vw;text-align:center;';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.background = color || '#6366F1';
      t.style.opacity = '1';
      clearTimeout(t._timer);
      t._timer = setTimeout(function () { t.style.opacity = '0'; }, 3500);
    };
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────
  function injectCSS() {
    var css = [
      /* AUTH MODAL */
      '#fsAuthOverlay{display:none;position:fixed;inset:0;background:rgba(15,15,30,.55);z-index:9999;align-items:center;justify-content:center;backdrop-filter:blur(4px);}',
      '#fsAuthOverlay.show{display:flex!important;}',
      '#fsAuthModal{background:#fff;border-radius:20px;padding:36px 32px 28px;width:440px;max-width:94vw;position:relative;box-shadow:0 32px 80px rgba(0,0,0,.22);animation:fsSlideIn .22s ease;}',
      '@keyframes fsSlideIn{from{transform:translateY(16px);opacity:0;}to{transform:translateY(0);opacity:1;}}',
      '.fs-auth-tab{background:none;border:none;border-bottom:2px solid transparent;padding:10px 20px;font-size:14px;font-weight:600;color:#9CA3AF;cursor:pointer;margin-bottom:-2px;transition:color .15s,border-color .15s;font-family:Inter,sans-serif;}',
      '.fs-auth-tab.active{color:#6366F1;border-bottom-color:#6366F1;}',
      '.fs-auth-field{margin-bottom:14px;}',
      '.fs-auth-field label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;font-family:Inter,sans-serif;}',
      '.fs-auth-field input{width:100%;padding:10px 12px;border:1.5px solid #D1D5DB;border-radius:8px;font-size:14px;color:#111827;outline:none;box-sizing:border-box;transition:border-color .15s;font-family:Inter,sans-serif;}',
      '.fs-auth-field input:focus{border-color:#6366F1;box-shadow:0 0 0 3px rgba(99,102,241,.12);}',
      '.fs-auth-err{font-size:12px;color:#EF4444;margin-bottom:12px;padding:8px 12px;background:#FEF2F2;border-radius:7px;display:none;font-family:Inter,sans-serif;}',
      '.fs-auth-submit{width:100%;padding:12px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .15s;font-family:Inter,sans-serif;}',
      '.fs-auth-submit:hover{opacity:.9;}.fs-auth-submit:disabled{opacity:.55;cursor:not-allowed;}',
      '.fs-auth-link{background:none;border:none;color:#6366F1;font-size:13px;font-weight:600;cursor:pointer;text-decoration:underline;padding:0;font-family:Inter,sans-serif;}',
      /* NAV AUTH */
      '.fs-nav-login-btn{background:none;border:1.5px solid #6366F1;color:#6366F1;padding:6px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;font-family:Inter,sans-serif;white-space:nowrap;}',
      '.fs-nav-login-btn:hover{background:#EEF2FF;}',
      '.fs-nav-user-wrap{display:flex;align-items:center;gap:8px;}',
      '.fs-nav-user-email{font-size:12px;color:#6B7280;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.fs-nav-pro-badge{background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;letter-spacing:.5px;}',
      '.fs-nav-signout-btn{background:none;border:1px solid #E5E7EB;color:#9CA3AF;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;transition:all .15s;font-family:Inter,sans-serif;}',
      '.fs-nav-signout-btn:hover{border-color:#EF4444;color:#EF4444;}',
      '.fs-nav-profile-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#EEF2FF;color:#6366F1;font-size:14px;text-decoration:none;transition:background .15s;}',
      '.fs-nav-profile-btn:hover{background:#C7D2FE;}',
      /* PRO UPGRADE BANNER */
      '#fsProBanner{display:none;margin-top:20px;background:linear-gradient(135deg,#EEF2FF,#F5F3FF);border:1.5px solid #C7D2FE;border-radius:14px;padding:20px 22px;position:relative;overflow:hidden;}',
      '#fsProBanner::before{content:"";position:absolute;top:-30px;right:-30px;width:100px;height:100px;background:radial-gradient(circle,rgba(139,92,246,.15),transparent 70%);pointer-events:none;}',
      '.fs-pro-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}',
      '.fs-pro-title{font-size:15px;font-weight:800;color:#111827;margin-bottom:4px;font-family:Inter,sans-serif;}',
      '.fs-pro-sub{font-size:12px;color:#6B7280;margin-bottom:10px;font-family:Inter,sans-serif;}',
      '.fs-pro-pills{display:flex;flex-wrap:wrap;gap:6px;}',
      '.fs-pro-pill{font-size:11px;font-weight:600;color:#4F46E5;background:#E0E7FF;padding:3px 10px;border-radius:20px;font-family:Inter,sans-serif;}',
      '.fs-pro-cta{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;}',
      '.fs-btn-subscribe{background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;border:none;border-radius:10px;padding:11px 22px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 4px 14px rgba(99,102,241,.35);transition:transform .15s,box-shadow .15s;font-family:Inter,sans-serif;}',
      '.fs-btn-subscribe:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(99,102,241,.45);}',
      '.fs-pro-cta-note{font-size:10px;color:#9CA3AF;text-align:right;font-family:Inter,sans-serif;}',
      '.fs-pro-free-tag{display:inline-block;background:#D1FAE5;color:#065F46;font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px;margin-left:8px;vertical-align:middle;}',
      '#fsProActivated{display:none;margin-top:12px;padding:14px 18px;background:linear-gradient(135deg,#DCFCE7,#D1FAE5);border:1.5px solid #22C55E;border-radius:10px;text-align:center;}',
      '@media(max-width:540px){.fs-pro-cta{align-items:flex-start;}.fs-pro-cta-note{text-align:left;}}'
    ].join('');
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ── Auth modal HTML ───────────────────────────────────────────────────────────
  function injectAuthModal() {
    var html = '<div id="fsAuthOverlay" onclick="if(event.target===this)fsCloseAuthModal()">' +
      '<div id="fsAuthModal">' +
        '<button onclick="fsCloseAuthModal()" style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:24px;color:#D1D5DB;cursor:pointer;line-height:1;">&#215;</button>' +
        '<div style="text-align:center;margin-bottom:20px;">' +
          '<div style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#6366F1,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Finosutra</div>' +
          '<p id="fsAuthSubtitle" style="font-size:13px;color:#6B7280;margin-top:3px;font-family:Inter,sans-serif;"></p>' +
        '</div>' +
        '<div style="display:flex;border-bottom:2px solid #F3F4F6;margin-bottom:22px;">' +
          '<button class="fs-auth-tab active" id="fsTabLogin" onclick="fsSwitchTab(\'login\')">Log In</button>' +
          '<button class="fs-auth-tab" id="fsTabSignup" onclick="fsSwitchTab(\'signup\')">Create Account</button>' +
        '</div>' +
        '<div id="fsLoginForm">' +
          '<div class="fs-auth-field"><label>Email</label><input type="email" id="fsLoginEmail" placeholder="you@example.com" autocomplete="email"></div>' +
          '<div class="fs-auth-field"><label>Password</label><input type="password" id="fsLoginPassword" placeholder="Your password" autocomplete="current-password"></div>' +
          '<div class="fs-auth-err" id="fsLoginError"></div>' +
          '<button class="fs-auth-submit" id="fsLoginSubmit" onclick="fsHandleLogin()">Log In</button>' +
          '<p style="text-align:center;font-size:13px;color:#6B7280;margin-top:14px;font-family:Inter,sans-serif;">No account? <button class="fs-auth-link" onclick="fsSwitchTab(\'signup\')">Create one free</button></p>' +
        '</div>' +
        '<div id="fsSignupForm" style="display:none;">' +
          '<div class="fs-auth-field"><label>Email</label><input type="email" id="fsSignupEmail" placeholder="you@example.com" autocomplete="email"></div>' +
          '<div class="fs-auth-field"><label>Password <span style="color:#9CA3AF;font-weight:400;">(min. 8 chars)</span></label><input type="password" id="fsSignupPassword" placeholder="Create a password" autocomplete="new-password"></div>' +
          '<div class="fs-auth-err" id="fsSignupError"></div>' +
          '<button class="fs-auth-submit" id="fsSignupSubmit" onclick="fsHandleSignup()">Create Free Account</button>' +
          '<p style="text-align:center;font-size:13px;color:#6B7280;margin-top:14px;font-family:Inter,sans-serif;">Already have an account? <button class="fs-auth-link" onclick="fsSwitchTab(\'login\')">Log in</button></p>' +
        '</div>' +
        '<div id="fsAuthSuccess" style="display:none;text-align:center;padding:12px 0;">' +
          '<div id="fsSuccessIcon" style="font-size:52px;line-height:1;margin-bottom:14px;"></div>' +
          '<h3 id="fsSuccessTitle" style="font-size:18px;font-weight:700;color:#111827;margin-bottom:8px;font-family:Inter,sans-serif;"></h3>' +
          '<p id="fsSuccessText" style="font-size:14px;color:#6B7280;line-height:1.55;font-family:Inter,sans-serif;"></p>' +
        '</div>' +
      '</div>' +
    '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  }

  // ── Pro upgrade banner (injected after export button) ────────────────────────
  function injectProBanner() {
    var btnExp = document.getElementById('btnExp');
    if (!btnExp) return;

    // Find a good insertion point: after btnExp's parent row/div
    var insertAfter = btnExp.parentNode;

    var bannerHTML =
      '<div id="fsProBanner">' +
        '<div class="fs-pro-top">' +
          '<div>' +
            '<div class="fs-pro-title">&#9889; Upgrade to Finosutra Pro</div>' +
            '<div class="fs-pro-sub">Unlimited Excel exports this month across all tools.</div>' +
            '<div class="fs-pro-pills">' +
              '<span class="fs-pro-pill">&#10003; Unlimited exports</span>' +
              '<span class="fs-pro-pill">&#10003; All 5 tools</span>' +
              '<span class="fs-pro-pill">&#10003; CA-grade Excel</span>' +
            '</div>' +
          '</div>' +
          '<div class="fs-pro-cta">' +
            '<button class="fs-btn-subscribe" onclick="fsInitiateProSubscription()">Upgrade to Pro &nbsp;&#8377;499<span style="font-size:10px;font-weight:500;opacity:.85;">/mo</span></button>' +
            '<span class="fs-pro-cta-note">Secure payment via Razorpay</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="fsProActivated">' +
        '<div style="font-size:14px;font-weight:700;color:#166534;font-family:Inter,sans-serif;">&#127881; Pro is now active! All exports are free for the next 30 days.</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = bannerHTML;
    while (wrap.firstChild) {
      insertAfter.parentNode.insertBefore(wrap.firstChild, insertAfter.nextSibling);
    }
  }

  // ── Wrap the export button to intercept Pro users ────────────────────────────
  function wrapExportButton() {
    var btnExp = document.getElementById('btnExp');
    if (!btnExp) return;

    var originalOnclick = btnExp.onclick;

    btnExp.onclick = function (e) {
      if (global.isProUser) {
        fsCallToolExport();
        return;
      }
      // Not Pro — call original payment flow
      if (typeof originalOnclick === 'function') {
        originalOnclick.call(this, e);
      }
    };
  }

  // ── Detect and call the right export function for this tool ──────────────────
  function fsCallToolExport() {
    global.showToast('&#10003; Downloading your Pro report…', '#5EC98A');
    setTimeout(function () {
      try {
        if (typeof global.exportXL === 'function')                     { global.exportXL(); return; }
        if (typeof global.generateAndDownloadExcel === 'function')     { global.generateAndDownloadExcel('PRO_' + Date.now()); return; }
        if (typeof global.generateExcel === 'function')                { global.generateExcel('PRO_' + Date.now()); return; }
        if (typeof global.downloadExcel === 'function')                { global.downloadExcel(); return; }
        global.showToast('Export not ready. Please calculate first.', '#FF8A80');
      } catch (e) {
        console.error('[auth.js] Export error:', e);
        global.showToast('Export failed. Please try again.', '#FF8A80');
      }
    }, 300);
    if (typeof global.gaEvent === 'function') {
      global.gaEvent('excel_downloaded', { trigger: 'pro_subscription', page: location.pathname });
    }
  }

  // ── Update export button label ────────────────────────────────────────────────
  function fsUpdateExportLabel(isPro) {
    var btn = document.getElementById('btnExp');
    if (btn) {
      btn.innerHTML = isPro
        ? '&#8659;&nbsp; Download Excel Report <span class="fs-pro-free-tag">FREE</span>'
        : '&#8659;&nbsp; Download Excel Report &nbsp;<strong>&#8377;99</strong>';
    }
    var sticky = document.querySelector('#sticky-export-bar .sticky-btn');
    if (sticky) {
      sticky.innerHTML = isPro
        ? '&#8659; Download Excel Report &nbsp;<span class="fs-pro-free-tag">PRO FREE</span>'
        : '&#8659; Download Excel Report &nbsp;&#8377;99';
    }
  }

  // ── Update nav auth state ─────────────────────────────────────────────────────
  function fsUpdateNavUI(user, isPro) {
    var navActions = document.getElementById('navActions');
    if (navActions) {
      // Preserve any existing nav/back link (handles both nav-back-btn and nav-btn classes)
      var backBtn = navActions.querySelector('a.nav-back-btn') || navActions.querySelector('a.nav-btn');
      var backHTML = backBtn ? backBtn.outerHTML : '';
      if (!user) {
        navActions.innerHTML =
          '<button onclick="fsShowAuthModal(\'login\')" class="fs-nav-login-btn">Log In</button>' + backHTML;
      } else {
        var backHTML2 = backHTML;
        var shortEmail = user.email.length > 22 ? user.email.slice(0, 20) + '…' : user.email;
        var proBadge = isPro ? '<span class="fs-nav-pro-badge">PRO</span>' : '';
        navActions.innerHTML =
          '<div class="fs-nav-user-wrap">' +
            '<span class="fs-nav-user-email" title="' + user.email + '">' + shortEmail + '</span>' +
            proBadge +
            '<a href="/profile.html" class="fs-nav-profile-btn" title="My Account">&#128100;</a>' +
            '<button onclick="fsHandleLogout()" class="fs-nav-signout-btn">Sign Out</button>' +
          '</div>' + backHTML2;
      }
    }

    // Show/hide Pro upgrade banner
    var banner = document.getElementById('fsProBanner');
    if (banner) banner.style.display = (user && !isPro) ? 'block' : 'none';

    // Update export button label
    fsUpdateExportLabel(isPro);
  }

  // ── Supabase: check session + subscription ────────────────────────────────────
  async function fsCheckAuthState() {
    try {
      var sd = await global.supaClient.auth.getSession();
      var session = sd.data.session;
      if (session) {
        global.currentUser = session.user;
        global.isProUser   = await fsCheckSubscription(session.user.id);
        fsUpdateNavUI(session.user, global.isProUser);
      } else {
        fsUpdateNavUI(null, false);
      }

      global.supaClient.auth.onAuthStateChange(async function (event, session) {
        if (session) {
          global.currentUser = session.user;
          global.isProUser   = await fsCheckSubscription(session.user.id);
          fsUpdateNavUI(session.user, global.isProUser);
        } else {
          global.currentUser = null;
          global.isProUser   = false;
          fsUpdateNavUI(null, false);
        }
      });
    } catch (e) {
      console.warn('[auth.js] checkAuthState error:', e);
      fsUpdateNavUI(null, false);
    }
  }

  async function fsCheckSubscription(userId) {
    try {
      var now = new Date().toISOString();
      var res = await global.supaClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('current_period_end', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return !res.error && res.data !== null;
    } catch (e) { return false; }
  }

  // ── Auth modal controls ───────────────────────────────────────────────────────
  global.fsShowAuthModal = function (tab) {
    var overlay = document.getElementById('fsAuthOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    ['fsLoginEmail', 'fsLoginPassword', 'fsSignupEmail', 'fsSignupPassword'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    ['fsLoginError', 'fsSignupError'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    document.getElementById('fsLoginForm').style.display   = 'block';
    document.getElementById('fsSignupForm').style.display  = 'none';
    document.getElementById('fsAuthSuccess').style.display = 'none';
    fsSwitchTab(tab || 'login');
    setTimeout(function () {
      var el = document.getElementById(tab === 'signup' ? 'fsSignupEmail' : 'fsLoginEmail');
      if (el) el.focus();
    }, 120);
  };

  global.fsCloseAuthModal = function () {
    var overlay = document.getElementById('fsAuthOverlay');
    if (overlay) overlay.style.display = 'none';
  };

  global.fsSwitchTab = function (tab) {
    document.getElementById('fsLoginForm').style.display  = tab === 'login'  ? 'block' : 'none';
    document.getElementById('fsSignupForm').style.display = tab === 'signup' ? 'block' : 'none';
    document.getElementById('fsTabLogin').className  = 'fs-auth-tab' + (tab === 'login'  ? ' active' : '');
    document.getElementById('fsTabSignup').className = 'fs-auth-tab' + (tab === 'signup' ? ' active' : '');
    document.getElementById('fsAuthSubtitle').textContent = tab === 'login'
      ? 'Sign in to access your account'
      : 'Create your free Finosutra account';
  };

  global.fsHandleLogin = async function () {
    var email    = (document.getElementById('fsLoginEmail').value  || '').trim();
    var password =  document.getElementById('fsLoginPassword').value || '';
    var btn      =  document.getElementById('fsLoginSubmit');
    var errEl    =  document.getElementById('fsLoginError');
    if (!email || !password) { fsShowErr('fsLoginError', 'Enter your email and password.'); return; }
    btn.disabled = true; btn.textContent = 'Signing in…';
    errEl.style.display = 'none';
    try {
      var res = await global.supaClient.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      global.currentUser = res.data.user;
      global.isProUser   = await fsCheckSubscription(res.data.user.id);
      fsUpdateNavUI(res.data.user, global.isProUser);
      document.getElementById('fsLoginForm').style.display  = 'none';
      document.getElementById('fsAuthSuccess').style.display = 'block';
      document.getElementById('fsSuccessIcon').textContent   = '👋';
      document.getElementById('fsSuccessTitle').textContent  = 'Welcome back!';
      document.getElementById('fsSuccessText').textContent   = global.isProUser
        ? '✅ Pro subscription active — Excel export is free for you!'
        : 'You\'re signed in. Upgrade to Pro for unlimited free exports.';
      setTimeout(global.fsCloseAuthModal, 2800);
    } catch (e) {
      fsShowErr('fsLoginError', e.message || 'Login failed. Please try again.');
    } finally { btn.disabled = false; btn.textContent = 'Log In'; }
  };

  global.fsHandleSignup = async function () {
    var email    = (document.getElementById('fsSignupEmail').value  || '').trim();
    var password =  document.getElementById('fsSignupPassword').value || '';
    var btn      =  document.getElementById('fsSignupSubmit');
    if (!email || !password) { fsShowErr('fsSignupError', 'Enter your email and a password.'); return; }
    if (password.length < 8) { fsShowErr('fsSignupError', 'Password must be at least 8 characters.'); return; }
    btn.disabled = true; btn.textContent = 'Creating account…';
    document.getElementById('fsSignupError').style.display = 'none';
    try {
      var res = await global.supaClient.auth.signUp({ email: email, password: password });
      if (res.error) throw res.error;
      document.getElementById('fsSignupForm').style.display  = 'none';
      document.getElementById('fsAuthSuccess').style.display = 'block';
      document.getElementById('fsSuccessIcon').textContent   = '🎉';
      document.getElementById('fsSuccessTitle').textContent  = 'Account created!';
      document.getElementById('fsSuccessText').textContent   = 'Check your inbox (' + email + ') for a confirmation link, then log in.';
    } catch (e) {
      fsShowErr('fsSignupError', e.message || 'Sign up failed. Please try again.');
    } finally { btn.disabled = false; btn.textContent = 'Create Free Account'; }
  };

  global.fsHandleLogout = async function () {
    try {
      await global.supaClient.auth.signOut();
      global.currentUser = null; global.isProUser = false;
      fsUpdateNavUI(null, false);
      global.showToast('Signed out successfully.', '#6B7280');
    } catch (e) { console.warn('[auth.js] Logout error:', e); }
  };

  function fsShowErr(id, msg) {
    var el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  // ── Pro subscription payment ──────────────────────────────────────────────────
  global.fsInitiateProSubscription = function () {
    if (!global.currentUser) {
      global.fsShowAuthModal('signup');
      global.showToast('Create an account first, then subscribe to Pro.', '#6366F1');
      return;
    }
    if (!global.supaClient) { global.showToast('Connection error. Please refresh.', '#EF4444'); return; }

    // Dynamically load Razorpay script if not already on the page
    if (typeof Razorpay === 'undefined') {
      global.showToast('Loading payment…', '#6366F1');
      var rzpScript = document.createElement('script');
      rzpScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
      rzpScript.onload = function () { global.fsInitiateProSubscription(); };
      rzpScript.onerror = function () { global.showToast('Could not load payment. Check connection.', '#EF4444'); };
      document.head.appendChild(rzpScript);
      return;
    }

    var options = {
      key:         RZP_KEY,
      amount:      49900,
      currency:    'INR',
      name:        'Finosutra',
      description: 'Pro Plan — Unlimited Exports for 30 Days',
      image:       '',
      theme:       { color: '#6366F1' },
      modal:       { ondismiss: function () { global.showToast('Upgrade cancelled. No charges made.', '#9CA3AF'); } },
      prefill:     { email: global.currentUser.email, name: '', contact: '' },
      notes:       { user_id: global.currentUser.id, plan: 'pro' },
      handler:     async function (response) {
        var payId = response.razorpay_payment_id;
        global.showToast('Payment received! Activating Pro…', '#6366F1');
        var pb = document.getElementById('fsProBanner');
        if (pb) { pb.style.pointerEvents = 'none'; pb.style.opacity = '.6'; }
        await fsActivatePro(payId);
      }
    };

    try {
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        global.showToast('Payment failed: ' + (resp.error && resp.error.description || 'Unknown error'), '#FF8A80');
      });
      if (typeof global.gaEvent === 'function') {
        global.gaEvent('begin_checkout', { tool_name: 'Pro Plan', value: 499, currency: 'INR' });
      }
      rzp.open();
    } catch (e) {
      alert('Could not open payment window. Please check your connection and try again.');
      console.error(e);
    }
  };

  async function fsActivatePro(paymentId) {
    try {
      var userId = global.currentUser && global.currentUser.id;
      if (!userId) throw new Error('No active session. Please log in again.');

      var now    = new Date().toISOString();
      var expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Delete existing active subscriptions for this user first (prevent duplicates)
      await global.supaClient
        .from('subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('status', 'active');

      var res = await global.supaClient
        .from('subscriptions')
        .insert({
          user_id:              userId,
          plan:                 'pro',
          status:               'active',
          razorpay_payment_id:  paymentId,
          current_period_start: now,
          current_period_end:   expiry
        });

      if (res.error) throw res.error;

      global.isProUser = true;
      fsUpdateNavUI(global.currentUser, true);
      var pb = document.getElementById('fsProBanner');
      if (pb) pb.style.display = 'none';
      var pa = document.getElementById('fsProActivated');
      if (pa) {
        pa.style.display = 'block';
        setTimeout(function () { pa.style.display = 'none'; }, 8000);
      }
      if (typeof global.gtag === 'function') {
        global.gtag('event', 'purchase', {
          transaction_id: paymentId,
          value:          499,
          currency:       'INR',
          items: [{ item_id: 'pro_monthly', item_name: 'Finosutra Pro — 30 Days', price: 499, quantity: 1 }]
        });
      }
      global.showToast('🎉 Pro activated! All exports are now free.', '#5EC98A');
    } catch (e) {
      global.showToast('Activation failed: ' + e.message + '. Email fino.sutra07@gmail.com with Payment ID: ' + paymentId, '#FF8A80');
      var pb = document.getElementById('fsProBanner');
      if (pb) { pb.style.pointerEvents = ''; pb.style.opacity = ''; }
      console.error('[auth.js] Pro activation error:', e);
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var overlay = document.getElementById('fsAuthOverlay');
      if (overlay && overlay.style.display === 'flex') global.fsCloseAuthModal();
    }
  });

  // ── Bootstrap on DOMContentLoaded ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    injectCSS();
    injectAuthModal();
    injectProBanner();
    wrapExportButton();

    if (typeof global.supabase !== 'undefined') {
      global.supaClient = global.supabase.createClient(SUPA_URL, SUPA_KEY);
      fsCheckAuthState();
    }
  });

  // ── Backward-compat aliases ───────────────────────────────────────────────────
  global.showAuthModal    = global.fsShowAuthModal    = function(){ var o=document.getElementById('fsAuthOverlay'); if(o) o.style.display='flex'; };
  global.closeAuthModal   = global.fsCloseAuthModal   = function(){ var o=document.getElementById('fsAuthOverlay'); if(o) o.style.display='none'; };
  global.showToast        = global.fsShowToast        = global.showToast || function(msg,color){ var t=document.createElement('div'); t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:'+(color||'#1E293B')+';color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);font-family:Inter,sans-serif'; t.textContent=msg; document.body.appendChild(t); setTimeout(function(){t.remove();},3000); };

})(window);
