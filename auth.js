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
  // ── Razorpay publishable key ID — SINGLE SOURCE OF TRUTH for the whole site.
  // Every page reads this via window.FS_RZP_KEY. Never hardcode the key elsewhere.
  // The matching SECRET lives only in Supabase Edge Function secrets, never here.
  var RZP_KEY   = 'rzp_live_TOZmt4wlnvNqYc';
  global.FS_RZP_KEY = RZP_KEY;

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
      '#fsAuthModal{background:#fff;border-radius:14px;padding:40px 28px 28px;width:440px;max-width:94vw;position:relative;box-shadow:0 32px 80px rgba(0,0,0,.22);animation:fsSlideIn .22s ease;}',
      '@keyframes fsSlideIn{from{transform:translateY(16px);opacity:0;}to{transform:translateY(0);opacity:1;}}',
      '.fs-auth-tab{background:none;border:none;border-bottom:2px solid transparent;padding:10px 20px;font-size:14px;font-weight:600;color:#9CA3AF;cursor:pointer;margin-bottom:-2px;transition:color .15s,border-color .15s;font-family:Inter,sans-serif;}',
      '.fs-auth-tab.active{color:#B8862E;border-bottom-color:#B8862E;font-weight:700;}',
      '.fs-auth-field{margin-bottom:14px;}',
      '.fs-auth-field label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;font-family:Inter,sans-serif;}',
      '.fs-auth-field input{width:100%;padding:10px 12px;border:1.5px solid #D1D5DB;border-radius:8px;font-size:14px;color:#111827;outline:none;box-sizing:border-box;transition:border-color .15s;font-family:Inter,sans-serif;}',
      '.fs-auth-field input:focus{border-color:#15222C;box-shadow:0 0 0 3px rgba(21,34,44,.10);}',
      '.fs-auth-err{font-size:12px;color:#EF4444;margin-bottom:12px;padding:8px 12px;background:#FEF2F2;border-radius:7px;display:none;font-family:Inter,sans-serif;}',
      '.fs-auth-submit{width:100%;padding:12px;background:#15222C;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;transition:background .15s,box-shadow .15s;font-family:Inter,sans-serif;box-shadow:0 8px 20px -6px rgba(21,34,44,.45);}',
      '.fs-auth-submit:hover{background:#0E161C;box-shadow:0 10px 24px -6px rgba(21,34,44,.55);}.fs-auth-submit:disabled{opacity:.55;cursor:not-allowed;box-shadow:none;}',
      '.fs-auth-link{background:none;border:none;color:#B8862E;font-size:13px;font-weight:600;cursor:pointer;text-decoration:underline;padding:0;font-family:Inter,sans-serif;}',
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
      '#fsProBanner{display:none;margin-top:20px;background:linear-gradient(135deg,#FBF8F0,#F6F3EA);border:1.5px solid #E4D9BE;border-radius:14px;padding:20px 22px;position:relative;overflow:hidden;}',
      '#fsProBanner::before{content:"";position:absolute;top:-30px;right:-30px;width:100px;height:100px;background:radial-gradient(circle,rgba(184,134,46,.15),transparent 70%);pointer-events:none;}',
      '.fs-pro-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}',
      '.fs-pro-title{font-size:15px;font-weight:800;color:#111827;margin-bottom:4px;font-family:Inter,sans-serif;}',
      '.fs-pro-sub{font-size:12px;color:#6B7280;margin-bottom:10px;font-family:Inter,sans-serif;}',
      '.fs-pro-pills{display:flex;flex-wrap:wrap;gap:6px;}',
      '.fs-pro-pill{font-size:11px;font-weight:600;color:#8A6423;background:#FBF3E4;padding:3px 10px;border-radius:20px;font-family:Inter,sans-serif;}',
      '.fs-pro-cta{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;}',
      '.fs-btn-subscribe{background:#15222C;color:#fff;border:none;border-radius:10px;padding:11px 22px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 4px 14px rgba(21,34,44,.35);transition:transform .15s,box-shadow .15s,background .15s;font-family:Inter,sans-serif;}',
      '.fs-btn-subscribe:hover{background:#0E161C;transform:translateY(-1px);box-shadow:0 6px 18px rgba(21,34,44,.45);}',
      '.fs-pro-cta-note{font-size:10px;color:#9CA3AF;text-align:right;font-family:Inter,sans-serif;}',
      '.fs-pro-free-tag{display:inline-block;background:#D1FAE5;color:#065F46;font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px;margin-left:8px;vertical-align:middle;}',
      '#fsProActivated{display:none;margin-top:12px;padding:14px 18px;background:linear-gradient(135deg,#DCFCE7,#D1FAE5);border:1.5px solid #22C55E;border-radius:10px;text-align:center;}',
      '@media(max-width:540px){.fs-pro-cta{align-items:flex-start;}.fs-pro-cta-note{text-align:left;}}',
      /* UPGRADE MODAL */
      '#fsUpgradeOverlay{display:none;position:fixed;inset:0;background:rgba(15,15,30,.65);z-index:10000;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:16px;}',
      '#fsUpgradeOverlay.show{display:flex!important;}',
      '#fsUpgradeBox{background:#fff;border-radius:22px;overflow:hidden;width:680px;max-width:96vw;position:relative;box-shadow:0 40px 100px rgba(0,0,0,.28);animation:fsSlideIn .22s ease;}',
      '.fs-um-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,.15);border:none;font-size:18px;color:#fff;cursor:pointer;line-height:1;padding:0;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;}',
      '.fs-um-close:hover{background:rgba(255,255,255,.25);}',
      '.fs-um-header{background:#15222C;padding:22px 28px 20px;}',
      '.fs-um-eyebrow{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#B8862E;margin-bottom:4px;font-family:Inter,sans-serif;}',
      '.fs-um-title{font-size:20px;font-weight:700;color:#fff;margin:0 0 2px;font-family:Inter,sans-serif;}',
      '.fs-um-sub{font-size:12px;color:#D9C9A3;margin:0;font-family:Inter,sans-serif;}',
      '.fs-um-body{padding:20px 28px 22px;}',
      '.fs-um-preview-label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF;margin-bottom:10px;font-family:Inter,sans-serif;}',
      '.fs-um-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:12px;}',
      '.fs-um-chip{font-size:11px;font-weight:600;color:#8A6423;background:#FBF3E4;padding:3px 10px;border-radius:20px;font-family:Inter,sans-serif;}',
      '.fs-um-roi{background:#FBF3E4;border:1px solid #E8D2A0;border-radius:10px;padding:9px 14px;font-size:12px;color:#7A5A1E;margin-bottom:14px;text-align:center;font-family:Inter,sans-serif;line-height:1.5;}',
      /* Preview strip — bigger cells so numbers are legible */
      '.fs-um-preview{display:flex;gap:8px;margin-bottom:14px;}',
      '.fs-um-sheet{flex:1;border:1px solid #E5E7EB;border-radius:9px;overflow:hidden;min-width:0;box-shadow:0 2px 8px rgba(0,0,0,.05);}',
      '.fs-um-sheet-tab{background:#217346;color:#fff;font-size:10px;font-weight:700;padding:5px 8px;font-family:Inter,sans-serif;letter-spacing:.3px;}',
      '.fs-um-sheet-row{display:flex;}',
      '.fs-um-sheet-cell{flex:1;font-size:10px;padding:4px 6px;color:#374151;font-family:Inter,sans-serif;min-width:0;overflow:hidden;white-space:nowrap;border-bottom:1px solid #F3F4F6;font-variant-numeric:tabular-nums;}',
      '.fs-um-sheet-cell.h{background:#F9FAFB;font-weight:700;color:#9CA3AF;font-size:9px;text-transform:uppercase;letter-spacing:.3px;}',
      /* Pricing cards */
      '.fs-um-cards{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:10px;margin:14px 0;align-items:start;}',
      '.fs-um-card{border:1.5px solid #E5E7EB;border-radius:14px;padding:18px 14px 14px;text-align:center;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s;position:relative;}',
      '.fs-um-card:hover{border-color:#15222C;box-shadow:0 6px 20px rgba(21,34,44,.14);transform:translateY(-2px);}',
      '.fs-um-card-featured{border-color:#B8862E;background:linear-gradient(160deg,#FBF3E4,#F6F3EA);box-shadow:0 4px 20px rgba(184,134,46,.18);}',
      '.fs-um-card-featured:hover{box-shadow:0 8px 28px rgba(184,134,46,.26);}',
      '.fs-um-card-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#B8862E,#9C7226);color:#fff;font-size:10px;font-weight:800;padding:3px 12px;border-radius:20px;white-space:nowrap;letter-spacing:.04em;font-family:Inter,sans-serif;}',
      '.fs-um-card-price{font-size:28px;font-weight:800;color:#111827;font-family:Inter,sans-serif;line-height:1.1;margin-top:4px;}',
      '.fs-um-card-price span{font-size:13px;font-weight:500;color:#6B7280;}',
      '.fs-um-card-name{font-size:13px;font-weight:700;color:#15222C;margin:4px 0 2px;font-family:Inter,sans-serif;}',
      '.fs-um-card-desc{font-size:11px;color:#6B7280;line-height:1.5;margin-bottom:10px;font-family:Inter,sans-serif;}',
      /* Feature list inside Pro card */
      '.fs-um-card-list{list-style:none;padding:0;margin:0 0 12px;text-align:left;}',
      '.fs-um-card-list li{font-size:11px;color:#374151;font-family:Inter,sans-serif;padding:3px 0;display:flex;align-items:center;gap:5px;line-height:1.4;}',
      '.fs-um-card-list li::before{content:"✓";color:#B8862E;font-weight:700;flex-shrink:0;}',
      '.fs-um-card-annual .fs-um-card-list li::before{color:#059669;}',
      /* Buttons */
      '.fs-um-btn{width:100%;padding:10px 0;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;border:none;font-family:Inter,sans-serif;transition:opacity .15s;}',
      '.fs-um-btn:hover{opacity:.88;}',
      '.fs-um-btn-muted{background:#F3F4F6;color:#6B7280;border:1.5px solid #E5E7EB!important;}',
      '.fs-um-btn-primary{background:#15222C;color:#fff;box-shadow:0 4px 14px rgba(21,34,44,.3);}',
      /* Social proof + footer */
      '.fs-um-social{text-align:center;font-size:11px;color:#9CA3AF;margin-bottom:10px;font-family:Inter,sans-serif;}',
      '.fs-um-social strong{color:#6B7280;}',
      '.fs-um-footer{text-align:center;font-size:11px;color:#C4C4CC;font-family:Inter,sans-serif;padding-top:10px;border-top:1px solid #F3F4F6;}',
      /* Annual card */
      '.fs-um-card-annual{border-color:#059669!important;background:linear-gradient(160deg,#F0FDF4,#ECFDF5);}',
      '.fs-um-card-annual:hover{box-shadow:0 6px 20px rgba(5,150,105,.14);}',
      '.fs-um-card-badge-green{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#059669,#10B981);color:#fff;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;white-space:nowrap;letter-spacing:.04em;font-family:Inter,sans-serif;}',
      '.fs-um-btn-green{background:linear-gradient(135deg,#059669,#10B981);color:#fff;box-shadow:0 4px 14px rgba(5,150,105,.25);}',
      '@media(max-width:580px){.fs-um-cards{grid-template-columns:1fr;}.fs-um-card-featured,.fs-um-card-annual{margin-top:14px;}.fs-um-preview{display:none;}.fs-um-card-list{display:none;}}',
      /* MOBILE AUTH MODAL — prevent iOS zoom on input focus */
      '@media(max-width:600px){#fsAuthModal{width:calc(100vw - 24px);max-width:calc(100vw - 24px);padding:28px 20px 22px;border-radius:16px;}.fs-auth-field input{font-size:16px;padding:11px 12px;}}'
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
        '<div style="text-align:center;margin-bottom:26px;">' +
          '<div style="display:inline-flex;align-items:center;gap:10px;">' +
            '<img src="/favicon.svg" alt="" aria-hidden="true" style="width:34px;height:34px;flex-shrink:0;"/>' +
            '<div style="text-align:left;">' +
              '<div style="font-size:17px;font-weight:800;color:#15222C;letter-spacing:-0.02em;line-height:1.1;font-family:Inter,sans-serif;">Finosutra</div>' +
              '<div style="font-size:10px;font-weight:700;color:#6B7280;letter-spacing:.06em;text-transform:uppercase;margin-top:2px;font-family:Inter,sans-serif;">— FINANCE ON AUTOPILOT</div>' +
            '</div>' +
          '</div>' +
          '<p id="fsAuthSubtitle" style="font-size:13px;color:#6B7280;margin-top:12px;font-family:Inter,sans-serif;"></p>' +
        '</div>' +
        '<div style="display:flex;border-bottom:2px solid #F3F4F6;margin-bottom:22px;">' +
          '<button class="fs-auth-tab active" id="fsTabLogin" onclick="fsSwitchTab(\'login\')">Log In</button>' +
          '<button class="fs-auth-tab" id="fsTabSignup" onclick="fsSwitchTab(\'signup\')">Create Account</button>' +
        '</div>' +
        '<div id="fsLoginForm">' +
          '<div class="fs-auth-field"><label>Email</label><input type="email" id="fsLoginEmail" placeholder="you@example.com" autocomplete="email"></div>' +
          '<div class="fs-auth-field"><label style="display:flex;justify-content:space-between;align-items:center;">Password <button class="fs-auth-link" onclick="fsSwitchTab(\'forgot\')" style="font-size:12px;font-weight:500;">Forgot password?</button></label><input type="password" id="fsLoginPassword" placeholder="Your password" autocomplete="current-password"></div>' +
          '<div class="fs-auth-err" id="fsLoginError"></div>' +
          '<button class="fs-auth-submit" id="fsLoginSubmit" onclick="fsHandleLogin()">Log In</button>' +
          '<p style="text-align:center;font-size:13px;color:#6B7280;margin-top:14px;font-family:Inter,sans-serif;">No account? <button class="fs-auth-link" onclick="fsSwitchTab(\'signup\')">Create one free</button></p>' +
        '</div>' +
        '<div id="fsForgotForm" style="display:none;">' +
          '<p style="font-size:13px;color:#6B7280;margin-bottom:18px;line-height:1.5;font-family:Inter,sans-serif;">Enter your registered email and we\'ll send a password reset link.</p>' +
          '<div class="fs-auth-field"><label>Email</label><input type="email" id="fsForgotEmail" placeholder="you@example.com" autocomplete="email"></div>' +
          '<div class="fs-auth-err" id="fsForgotError"></div>' +
          '<button class="fs-auth-submit" id="fsForgotSubmit" onclick="fsHandleForgotPassword()">Send Reset Link</button>' +
          '<p style="text-align:center;font-size:13px;color:#6B7280;margin-top:14px;font-family:Inter,sans-serif;"><button class="fs-auth-link" onclick="fsSwitchTab(\'login\')">&#8592; Back to Log In</button></p>' +
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

  // ── Upgrade modal HTML ────────────────────────────────────────────────────────
  function injectUpgradeModal() {
    var html =
      '<div id="fsUpgradeOverlay" onclick="if(event.target===this)fsCloseUpgradeModal()">' +
        '<div id="fsUpgradeBox">' +
          '<div class="fs-um-header">' +
            '<button class="fs-um-close" onclick="fsCloseUpgradeModal()">&#215;</button>' +
            '<div class="fs-um-eyebrow">Finosutra Pro</div>' +
            '<h2 class="fs-um-title">Unlock your Excel workpapers</h2>' +
            '<p class="fs-um-sub">CA-grade &middot; Multi-sheet workbook &middot; Drop straight into audit workpapers</p>' +
          '</div>' +
          '<div class="fs-um-body">' +
          '<div class="fs-um-preview-label">What you get in every export</div>' +
          '<div class="fs-um-preview">' +
            '<div class="fs-um-sheet"><div class="fs-um-sheet-tab">Amortisation</div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell h">Month</div><div class="fs-um-sheet-cell h">Interest</div><div class="fs-um-sheet-cell h">Closing</div></div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell">Jul 26</div><div class="fs-um-sheet-cell">3,562</div><div class="fs-um-sheet-cell">9,96,438</div></div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell">Aug 26</div><div class="fs-um-sheet-cell">7,081</div><div class="fs-um-sheet-cell">9,53,519</div></div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell">Sep 26</div><div class="fs-um-sheet-cell">6,851</div><div class="fs-um-sheet-cell">9,10,370</div></div>' +
            '</div>' +
            '<div class="fs-um-sheet"><div class="fs-um-sheet-tab">Journal Entries</div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell h">Date</div><div class="fs-um-sheet-cell h">Account</div><div class="fs-um-sheet-cell h">Dr / Cr</div></div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell">01-Jul-26</div><div class="fs-um-sheet-cell">ROU Asset</div><div class="fs-um-sheet-cell">Dr 10L</div></div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell">01-Jul-26</div><div class="fs-um-sheet-cell">Lease Liab.</div><div class="fs-um-sheet-cell">Cr 10L</div></div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell">31-Jul-26</div><div class="fs-um-sheet-cell">Finance Cost</div><div class="fs-um-sheet-cell">Dr 3,562</div></div>' +
            '</div>' +
            '<div class="fs-um-sheet"><div class="fs-um-sheet-tab">Annual Rollforward</div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell h">Item</div><div class="fs-um-sheet-cell h">FY 26-27</div></div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell">Opening Liab.</div><div class="fs-um-sheet-cell">10,00,000</div></div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell">Interest</div><div class="fs-um-sheet-cell">84,219</div></div>' +
              '<div class="fs-um-sheet-row"><div class="fs-um-sheet-cell">Payments</div><div class="fs-um-sheet-cell">(1,50,000)</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="fs-um-roi">&#128161; <strong>Most CAs export 3–5&times; per month.</strong> Pro (&#8377;499) costs less than pay-per-report (&#8377;199 &times; 3 = &#8377;597)</div>' +
          '<div class="fs-um-chips">' +
            '<span class="fs-um-chip">&#10003; Amortization schedule</span>' +
            '<span class="fs-um-chip">&#10003; Journal entries</span>' +
            '<span class="fs-um-chip">&#10003; Annual rollforward</span>' +
            '<span class="fs-um-chip">&#10003; Balance sheet impact</span>' +
          '</div>' +
          '<div class="fs-um-cards">' +
            '<div class="fs-um-card" onclick="fsCloseUpgradeModal();fsDoOneTimeExport()">' +
              '<div class="fs-um-card-price">&#8377;199</div>' +
              '<div class="fs-um-card-name">This report only</div>' +
              '<div class="fs-um-card-desc">One-time &middot; No subscription<br>Instant download</div>' +
              '<button class="fs-um-btn fs-um-btn-muted">Download &#8594;</button>' +
            '</div>' +
            '<div class="fs-um-card fs-um-card-featured" onclick="fsCloseUpgradeModal();fsInitiateProSubscription()">' +
              '<div class="fs-um-card-badge">MOST POPULAR</div>' +
              '<div class="fs-um-card-price">&#8377;499<span>/mo</span></div>' +
              '<div class="fs-um-card-name">Pro Unlimited</div>' +
              '<ul class="fs-um-card-list">' +
                '<li>Unlimited exports, all tools</li>' +
                '<li>IND AS 116 &amp; 109 calculators</li>' +
                '<li>Multi-lease portfolio</li>' +
                '<li>Capital gains &amp; advance tax</li>' +
                '<li>Cancel anytime</li>' +
              '</ul>' +
              '<button class="fs-um-btn fs-um-btn-primary">Go Pro &#8594;</button>' +
            '</div>' +
            '<div class="fs-um-card fs-um-card-annual" onclick="fsCloseUpgradeModal();fsInitiateAnnualSubscription()">' +
              '<div class="fs-um-card-badge-green">2 MONTHS FREE</div>' +
              '<div class="fs-um-card-price" style="color:#059669;">&#8377;3,999<span>/yr</span></div>' +
              '<div class="fs-um-card-name">Annual Pro</div>' +
              '<ul class="fs-um-card-list">' +
                '<li>Everything in Pro</li>' +
                '<li>&#8377;333/mo — save &#8377;1,989/yr</li>' +
                '<li>Preferred by CA firms</li>' +
                '<li>One invoice for the year</li>' +
              '</ul>' +
              '<button class="fs-um-btn fs-um-btn-green">Save &#8377;1,989 &#8594;</button>' +
            '</div>' +
          '</div>' +
          '<div class="fs-um-social">Trusted by <strong>CAs, CFOs and finance teams</strong> across India</div>' +
          '<div class="fs-um-footer">&#128274; Secure payment via Razorpay &middot; No hidden charges &middot; Cancel Pro anytime</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  }

  global.fsShowUpgradeModal = function () {
    var o = document.getElementById('fsUpgradeOverlay');
    if (o) o.classList.add('show');
  };

  global.fsCloseUpgradeModal = function () {
    var o = document.getElementById('fsUpgradeOverlay');
    if (o) o.classList.remove('show');
  };

  // ── One-time export payment (₹199) — must be its own Razorpay charge.
  // Do NOT fall back to _fsOriginalExportFn here: on several tool pages that's
  // just the bare export function with no payment step of its own, and on
  // others it's dead code that's unreachable via the normal button click (it
  // only runs through this exact path), so relying on it either gives the
  // file away free or hits whatever quirks that page's own handler has.
  global.fsInitiateOneTimeExport = function () {
    if (global.isProUser) { fsCallToolExport(); return; }

    if (typeof Razorpay === 'undefined') {
      global.showToast('Loading payment…', '#6366F1');
      var rzpScript = document.createElement('script');
      rzpScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
      rzpScript.onload = function () { global.fsInitiateOneTimeExport(); };
      rzpScript.onerror = function () { global.showToast('Could not load payment. Check connection.', '#EF4444'); };
      document.head.appendChild(rzpScript);
      return;
    }

    var options = {
      key:         RZP_KEY,
      amount:      19900, // ₹199 in paise
      currency:    'INR',
      name:        'Finosutra',
      description: 'One-time Excel Export',
      image:       '',
      theme:       { color: '#6366F1' },
      modal:       { ondismiss: function () { global.showToast('Payment cancelled. No charges made.', '#9CA3AF'); } },
      prefill:     { email: global.currentUser ? global.currentUser.email : '', name: '', contact: '' },
      notes:       { plan: 'one_time_export', page: location.pathname },
      handler:     function (response) {
        global.showToast('Payment received! Preparing your download…', '#5EC98A');
        if (typeof global.gtag === 'function') {
          global.gtag('event', 'purchase', {
            transaction_id: response.razorpay_payment_id,
            value:          199,
            currency:       'INR',
            items: [{ item_id: 'one_time_export', item_name: 'One-time Excel Export', price: 199, quantity: 1 }]
          });
        }
        setTimeout(function () { fsRunExportFn('PAID'); }, 300);
      }
    };

    try {
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        global.showToast('Payment failed: ' + (resp.error && resp.error.description || 'Unknown error'), '#FF8A80');
      });
      if (typeof global.gaEvent === 'function') {
        global.gaEvent('begin_checkout', { tool_name: 'One-time Export', value: 199, currency: 'INR' });
      }
      rzp.open();
    } catch (e) {
      alert('Could not open payment window. Please check your connection and try again.');
      console.error(e);
    }
  };

  // Backward-compat: the upgrade modal card still calls fsDoOneTimeExport()
  // by name — keep it pointed at the real payment flow above.
  global.fsDoOneTimeExport = global.fsInitiateOneTimeExport;

  // ── Wrap the export button to intercept Pro users ────────────────────────────
  function wrapExportButton() {
    var btnExp = document.getElementById('btnExp');
    if (!btnExp) return;

    var originalOnclick = btnExp.onclick;

    // Kept for pages that still reference window._fsOriginalExportFn directly.
    // fsDoOneTimeExport() no longer calls this — it runs its own ₹199 charge
    // via fsInitiateOneTimeExport() instead (see above).
    global._fsOriginalExportFn = originalOnclick;

    btnExp.onclick = function (e) {
      if (global.isProUser) {
        fsCallToolExport();
        return;
      }
      // 1 free export per calendar month (tracked in localStorage)
      var monthKey = 'fs_free_exp_' + new Date().toISOString().slice(0, 7); // e.g. "fs_free_exp_2026-06"
      try {
        if (!localStorage.getItem(monthKey)) {
          localStorage.setItem(monthKey, '1');
          global.showToast('🎁 Your 1 free export for this month — enjoy!', '#059669');
          fsCallToolExport();
          return;
        }
      } catch (err) { /* localStorage blocked — fall through to modal */ }
      // Already used free export this month — show upgrade modal
      global.fsShowUpgradeModal();
    };
  }

  // ── Detect and call the right export function for this tool ──────────────────
  // Shared by the Pro path and the one-time-payment path so both actually
  // trigger the tool's real export, regardless of which function name it uses.
  function fsRunExportFn(tag) {
    try {
      if (typeof global.exportXL === 'function')                     { global.exportXL(); return; }
      if (typeof global.generateAndDownloadExcel === 'function')     { global.generateAndDownloadExcel(tag + '_' + Date.now()); return; }
      if (typeof global.generateExcel === 'function')                { global.generateExcel(tag + '_' + Date.now()); return; }
      if (typeof global.downloadExcel === 'function')                { global.downloadExcel(); return; }
      global.showToast('Export not ready. Please calculate first.', '#FF8A80');
    } catch (e) {
      console.error('[auth.js] Export error:', e);
      global.showToast('Export failed. Please try again.', '#FF8A80');
    }
  }

  function fsCallToolExport() {
    global.showToast('&#10003; Downloading your Pro report…', '#5EC98A');
    setTimeout(function () { fsRunExportFn('PRO'); }, 300);
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
        : '&#8659;&nbsp; Download Excel Report &nbsp;<strong>&#8377;199</strong>';
    }
    var sticky = document.querySelector('#sticky-export-bar .sticky-btn');
    if (sticky) {
      sticky.innerHTML = isPro
        ? '&#8659; Download Excel Report &nbsp;<span class="fs-pro-free-tag">PRO FREE</span>'
        : '&#8659; Download Excel Report &nbsp;&#8377;199';
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

    // Mobile nav auth item (inside hamburger dropdown)
    var navAuthMobile = document.getElementById('navAuthMobile');
    if (navAuthMobile) {
      if (!user) {
        navAuthMobile.innerHTML = '<a onclick="fsShowAuthModal(\'login\')" style="cursor:pointer;display:block;padding:9px 13px;border-radius:8px;background:#EEF2FF;color:#4F46E5;font-size:13px;font-weight:700;text-align:center;margin-top:6px;border:1.5px solid #C7D2FE">Log In</a>';
      } else {
        var mShort = user.email.length > 30 ? user.email.slice(0,28)+'…' : user.email;
        var mPro = isPro ? '<span style="background:#FEF3C7;color:#92400E;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px">PRO</span>' : '';
        navAuthMobile.innerHTML =
          '<div style="padding:8px 13px 4px;font-size:12px;color:#6B7280;border-top:1px solid #E5E7EB;margin-top:6px;display:flex;align-items:center;gap:4px">' + mShort + mPro + '</div>' +
          '<button onclick="fsHandleLogout()" style="width:100%;padding:7px 13px;background:none;border:none;color:#EF4444;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;text-align:left">Sign Out</button>';
      }
    }

    // Show/hide Pro upgrade banner
    var banner = document.getElementById('fsProBanner');
    if (banner) banner.style.display = (user && !isPro) ? 'block' : 'none';

    // Show/hide Subscribe to Pro buttons based on Pro status
    document.querySelectorAll('[onclick="fsInitiateProSubscription()"], [onclick*="initiateProSubscription"]').forEach(function(btn) {
      if (user && isPro) {
        btn.style.display = 'none'; // Pro user — hide button entirely
      } else {
        btn.style.display = '';     // Free user or logged out — show and re-enable
        btn.disabled = false;
        btn.style.opacity = '';
      }
    });

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
        fsCheckRenewalAlert();
      } else {
        fsUpdateNavUI(null, false);
      }

      global.supaClient.auth.onAuthStateChange(async function (event, session) {
        if (session) {
          global.currentUser = session.user;
          global.isProUser   = await fsCheckSubscription(session.user.id);
          fsUpdateNavUI(session.user, global.isProUser);
          fsCheckRenewalAlert();
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
        .select('id, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('current_period_end', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!res.error && res.data !== null) {
        global.fsSubPeriodEnd = res.data.current_period_end;
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  function fsCheckRenewalAlert() {
    if (!global.isProUser || !global.fsSubPeriodEnd) return;
    var daysLeft = Math.ceil((new Date(global.fsSubPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 7) return;
    try { if (sessionStorage.getItem('fs_renewal_dismissed')) return; } catch (e) {}
    fsShowRenewalBanner(daysLeft);
  }

  function fsShowRenewalBanner(daysLeft) {
    if (document.getElementById('fsRenewalBanner')) return;
    var label = daysLeft <= 0 ? 'expires today' : daysLeft === 1 ? 'expires tomorrow' : 'expires in ' + daysLeft + ' days';
    var banner = document.createElement('div');
    banner.id = 'fsRenewalBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;background:linear-gradient(90deg,#92400E,#B45309);color:#fff;padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:12px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.2);';
    banner.innerHTML =
      '<span>&#9888; Your Finosutra Pro <strong>' + label + '</strong>. Renew to keep unlimited exports.</span>' +
      '<button onclick="fsCloseRenewalBanner();fsInitiateProSubscription();" style="background:#fff;color:#92400E;border:none;border-radius:6px;padding:5px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:Inter,sans-serif;">Renew Pro &rarr;</button>' +
      '<button onclick="fsCloseRenewalBanner()" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:18px;cursor:pointer;line-height:1;padding:0 4px;margin-left:4px;" title="Dismiss">&times;</button>';
    document.body.insertBefore(banner, document.body.firstChild);
    // Push page content down
    document.body.style.paddingTop = (parseInt(document.body.style.paddingTop || '0') + 44) + 'px';
  }

  global.fsCloseRenewalBanner = function () {
    var b = document.getElementById('fsRenewalBanner');
    if (b) {
      document.body.style.paddingTop = Math.max(0, parseInt(document.body.style.paddingTop || '0') - 44) + 'px';
      b.remove();
    }
    try { sessionStorage.setItem('fs_renewal_dismissed', '1'); } catch (e) {}
  };

  // ── Auth modal controls ───────────────────────────────────────────────────────
  global.fsShowAuthModal = function (tab) {
    var overlay = document.getElementById('fsAuthOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    ['fsLoginEmail', 'fsLoginPassword', 'fsSignupEmail', 'fsSignupPassword'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    ['fsLoginError', 'fsSignupError', 'fsForgotError'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    var fe = document.getElementById('fsForgotEmail'); if (fe) fe.value = '';
    document.getElementById('fsLoginForm').style.display   = 'block';
    document.getElementById('fsSignupForm').style.display  = 'none';
    document.getElementById('fsForgotForm').style.display  = 'none';
    document.getElementById('fsAuthSuccess').style.display = 'none';
    fsSwitchTab(tab || 'login');
    setTimeout(function () {
      var el = document.getElementById(tab === 'signup' ? 'fsSignupEmail' : tab === 'forgot' ? 'fsForgotEmail' : 'fsLoginEmail');
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
    document.getElementById('fsForgotForm').style.display = tab === 'forgot' ? 'block' : 'none';
    document.getElementById('fsTabLogin').className  = 'fs-auth-tab' + (tab === 'login'  ? ' active' : '');
    document.getElementById('fsTabSignup').className = 'fs-auth-tab' + (tab === 'signup' ? ' active' : '');
    document.getElementById('fsAuthSubtitle').textContent = tab === 'login'
      ? 'Sign in to access your account'
      : tab === 'forgot'
      ? 'Reset your password'
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
      if (!global.supaClient && typeof global.supabase !== 'undefined') {
        global.supaClient = global.supabase.createClient(SUPA_URL, SUPA_KEY);
      }
      if (!global.supaClient) throw new Error('Authentication service unavailable. Please refresh the page and try again.');
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
      if (!global.supaClient && typeof global.supabase !== 'undefined') {
        global.supaClient = global.supabase.createClient(SUPA_URL, SUPA_KEY);
      }
      if (!global.supaClient) throw new Error('Authentication service unavailable. Please refresh the page and try again.');
      var res = await global.supaClient.auth.signUp({ email: email, password: password });
      if (res.error) throw res.error;
      if (typeof global.gtag === 'function') {
        global.gtag('event', 'sign_up', { method: 'email' });
      }
      document.getElementById('fsSignupForm').style.display  = 'none';
      document.getElementById('fsAuthSuccess').style.display = 'block';
      document.getElementById('fsSuccessIcon').textContent   = '🎉';
      document.getElementById('fsSuccessTitle').textContent  = 'Account created!';
      document.getElementById('fsSuccessText').textContent   = 'Check your inbox (' + email + ') for a confirmation link, then log in.';
    } catch (e) {
      fsShowErr('fsSignupError', e.message || 'Sign up failed. Please try again.');
    } finally { btn.disabled = false; btn.textContent = 'Create Free Account'; }
  };

  global.fsHandleForgotPassword = async function () {
    var email = (document.getElementById('fsForgotEmail').value || '').trim();
    var btn   =  document.getElementById('fsForgotSubmit');
    if (!email) { fsShowErr('fsForgotError', 'Please enter your email address.'); return; }
    btn.disabled = true; btn.textContent = 'Sending…';
    document.getElementById('fsForgotError').style.display = 'none';
    try {
      var res = await global.supaClient.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://www.finosutra.com/reset-password.html'
      });
      if (res.error) throw res.error;
      document.getElementById('fsForgotForm').style.display  = 'none';
      document.getElementById('fsAuthSuccess').style.display = 'block';
      document.getElementById('fsSuccessIcon').textContent   = '📧';
      document.getElementById('fsSuccessTitle').textContent  = 'Reset link sent!';
      document.getElementById('fsSuccessText').textContent   = 'Check your inbox at ' + email + '. Click the link in the email to set a new password.';
    } catch (e) {
      fsShowErr('fsForgotError', e.message || 'Could not send reset email. Please try again.');
    } finally { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
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

  // ── Annual subscription payment (₹3,999/year) ────────────────────────────────
  global.fsInitiateAnnualSubscription = function () {
    if (global.isProUser) {
      global.showToast('✅ You are already on Finosutra Pro!', '#5EC98A');
      return;
    }
    if (!global.currentUser) {
      global.fsShowAuthModal('signup');
      global.showToast('Create an account first, then subscribe to Annual Pro.', '#6366F1');
      return;
    }
    if (!global.supaClient) { global.showToast('Connection error. Please refresh.', '#EF4444'); return; }

    if (typeof Razorpay === 'undefined') {
      global.showToast('Loading payment…', '#6366F1');
      var rzpScript = document.createElement('script');
      rzpScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
      rzpScript.onload = function () { global.fsInitiateAnnualSubscription(); };
      rzpScript.onerror = function () { global.showToast('Could not load payment. Check connection.', '#EF4444'); };
      document.head.appendChild(rzpScript);
      return;
    }

    var options = {
      key:         RZP_KEY,
      amount:      399900, // ₹3,999 in paise
      currency:    'INR',
      name:        'Finosutra',
      description: 'Annual Pro Plan — Unlimited Exports for 12 Months',
      image:       '',
      theme:       { color: '#6366F1' },
      modal:       { ondismiss: function () { global.showToast('Upgrade cancelled. No charges made.', '#9CA3AF'); } },
      prefill:     { email: global.currentUser.email, name: '', contact: '' },
      notes:       { user_id: global.currentUser.id, plan: 'pro_annual' },
      handler:     async function (response) {
        var payId = response.razorpay_payment_id;
        global.showToast('Payment received! Activating Annual Pro…', '#6366F1');
        await fsActivatePro(payId);
      }
    };

    try {
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        global.showToast('Payment failed: ' + (resp.error && resp.error.description || 'Unknown error'), '#FF8A80');
      });
      rzp.open();
    } catch (e) {
      alert('Could not open payment window. Please check your connection and try again.');
      console.error(e);
    }
  };

  // ── Pro subscription payment ──────────────────────────────────────────────────
  global.fsInitiateProSubscription = function () {
    // Already Pro? Never open payment again
    if (global.isProUser) {
      global.showToast('✅ You are already on Finosutra Pro! Enjoy unlimited exports.', '#5EC98A');
      return;
    }
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
      if (!global.currentUser) throw new Error('No active session. Please log in again.');

      // Get the user's JWT token to authenticate with the Edge Function
      var sessionData = await global.supaClient.auth.getSession();
      var jwt = sessionData.data.session && sessionData.data.session.access_token;
      if (!jwt) throw new Error('Session expired. Please log in again.');

      // Call Edge Function — it verifies payment with Razorpay, then writes to DB
      var response = await fetch(EDGE_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + jwt
        },
        body: JSON.stringify({ payment_id: paymentId })
      });

      var result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Activation failed. Please contact support.');
      }

      // Payment verified and DB updated by server — now update UI
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
      global.showToast('Activation failed: ' + e.message + '. Email billing@finosutra.com with Payment ID: ' + paymentId, '#FF8A80');
      var pb = document.getElementById('fsProBanner');
      if (pb) { pb.style.pointerEvents = ''; pb.style.opacity = ''; }
      console.error('[auth.js] Pro activation error:', e);
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var authOverlay = document.getElementById('fsAuthOverlay');
      if (authOverlay && authOverlay.style.display === 'flex') global.fsCloseAuthModal();
      var upgradeOverlay = document.getElementById('fsUpgradeOverlay');
      if (upgradeOverlay && upgradeOverlay.classList.contains('show')) global.fsCloseUpgradeModal();
    }
  });

  // ── Bootstrap on DOMContentLoaded ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    injectCSS();
    injectAuthModal();
    injectUpgradeModal();
    injectProBanner();
    wrapExportButton();

    // Disable all Pro subscribe buttons until we confirm the user's status
    // Prevents race-condition clicks before async auth check completes
    document.querySelectorAll('[onclick="fsInitiateProSubscription()"], [onclick*="initiateProSubscription"]').forEach(function(btn) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    });

    if (typeof global.supabase !== 'undefined') {
      global.supaClient = global.supabase.createClient(SUPA_URL, SUPA_KEY);
      fsCheckAuthState();
    }

    // Auto-open forgot password panel if redirected from reset-password.html
    if (new URLSearchParams(window.location.search).get('forgot') === '1') {
      setTimeout(function () { global.fsShowAuthModal('forgot'); }, 400);
    }
  });

  // ── Backward-compat aliases ───────────────────────────────────────────────────
  global.showAuthModal    = global.fsShowAuthModal    = function(){ var o=document.getElementById('fsAuthOverlay'); if(o) o.style.display='flex'; };
  global.closeAuthModal   = global.fsCloseAuthModal   = function(){ var o=document.getElementById('fsAuthOverlay'); if(o) o.style.display='none'; };
  global.showToast        = global.fsShowToast        = global.showToast || function(msg,color){ var t=document.createElement('div'); t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:'+(color||'#1E293B')+';color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);font-family:Inter,sans-serif'; t.textContent=msg; document.body.appendChild(t); setTimeout(function(){t.remove();},3000); };

})(window);
