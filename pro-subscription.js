// pro-subscription.js — Shared Pro subscription flow for all Finosutra tools
// Include this file in every paid tool page.

(function () {
  var SB_URL  = 'https://uymuivmktvtxmodblxie.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5bXVpdm1rdHZ0eG1vZGJseGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMjk5NTYsImV4cCI6MjA5NjkwNTk1Nn0.7dsdrDmYR8R891_Cc68K75tUlmwi49KExGGQbBq3qmg';
  var RZP_KEY = 'rzp_live_Sty2e9lT4uXzJJ';
  var EDGE_FN = 'https://uymuivmktvtxmodblxie.supabase.co/functions/v1/create-razorpay-sub';

  function getClient() {
    if (!window._fsSupabase && window.supabase) {
      window._fsSupabase = window.supabase.createClient(SB_URL, SB_ANON);
    }
    return window._fsSupabase;
  }

  // ── Public: check Pro status ─────────────────────────────────────────────
  window.checkProStatus = async function () {
    try {
      var client = getClient();
      if (!client) return { isPro: false };
      var sessRes = await client.auth.getSession();
      var session = sessRes.data.session;
      if (!session) return { isPro: false, client: client };
      var now = new Date().toISOString();
      var res = await client.from('subscriptions').select('id')
        .eq('user_id', session.user.id).eq('status', 'active')
        .gt('current_period_end', now).limit(1).maybeSingle();
      return { isPro: !res.error && !!res.data, client: client, session: session };
    } catch (e) {
      return { isPro: false };
    }
  };

  // ── Public: start Pro subscription flow ──────────────────────────────────
  window.initiateProSubscription = async function (toolName) {
    var client = getClient();
    if (!client) { _toast('Supabase not loaded yet. Please refresh.', '#EF4444'); return; }

    var sessRes = await client.auth.getSession();
    var session = sessRes.data.session;

    if (!session) {
      _showAuthModal(client, toolName);
      return;
    }

    _toast('Setting up your Pro subscription…', '#6366F1');

    try {
      var res = await fetch(EDGE_FN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ user_id: session.user.id, email: session.user.email }),
      });

      var data = await res.json();
      if (!data.subscription_id) {
        _toast('Could not create subscription. Please try again.', '#EF4444');
        console.error('Edge fn error:', data);
        return;
      }

      var rzp = new Razorpay({
        key            : RZP_KEY,
        subscription_id: data.subscription_id,
        name           : 'Finosutra',
        description    : 'Pro Plan — Unlimited Exports',
        theme          : { color: '#6366F1' },
        prefill        : { email: session.user.email },
        handler        : function () {
          if (typeof gtag !== 'undefined') {
            gtag('event', 'pro_subscription_started', { tool_name: toolName || 'unknown' });
          }
          _toast('🎉 Welcome to Finosutra Pro! Activating your account…', '#5EC98A');
          setTimeout(function () { location.reload(); }, 4000);
        },
        modal: {
          ondismiss: function () {
            _toast('Subscription cancelled. No charges made.', '#8B5CF6');
          }
        }
      });
      rzp.on('payment.failed', function (resp) {
        _toast('Payment failed: ' + resp.error.description, '#EF4444');
      });
      rzp.open();

    } catch (err) {
      _toast('Network error. Please try again.', '#EF4444');
      console.error(err);
    }
  };

  // ── Auth modal ───────────────────────────────────────────────────────────
  function _showAuthModal(client, toolName) {
    var existing = document.getElementById('proAuthModal');
    if (existing) { existing.style.display = 'flex'; return; }

    var modal = document.createElement('div');
    modal.id = 'proAuthModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = [
      '<div style="background:#fff;border-radius:16px;padding:32px;max-width:400px;width:90%;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.3);">',
        '<button onclick="document.getElementById(\'proAuthModal\').style.display=\'none\'" ',
          'style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#6B7280;">×</button>',
        '<div style="font-size:24px;margin-bottom:8px;">🚀</div>',
        '<h3 style="font-size:18px;font-weight:800;color:#111827;margin:0 0 6px;">Upgrade to Finosutra Pro</h3>',
        '<p style="font-size:13px;color:#6B7280;margin:0 0 20px;">Sign in or create a free account to subscribe.</p>',
        '<input id="proEmail" type="email" placeholder="your@email.com" ',
          'style="width:100%;padding:10px 14px;border:1.5px solid #D1D5DB;border-radius:8px;font-size:14px;margin-bottom:10px;box-sizing:border-box;outline:none;"/>',
        '<input id="proPassword" type="password" placeholder="Password (min 6 chars)" ',
          'style="width:100%;padding:10px 14px;border:1.5px solid #D1D5DB;border-radius:8px;font-size:14px;margin-bottom:16px;box-sizing:border-box;outline:none;"/>',
        '<button onclick="window._doProSignup()" id="proSignupBtn" ',
          'style="width:100%;padding:12px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;margin-bottom:10px;">',
          'Create Account &amp; Subscribe</button>',
        '<button onclick="window._doProLogin()" id="proLoginBtn" ',
          'style="width:100%;padding:12px;background:#F3F4F6;color:#374151;font-size:14px;font-weight:600;border:none;border-radius:10px;cursor:pointer;">',
          'I already have an account — Sign In</button>',
        '<p id="proAuthErr" style="color:#EF4444;font-size:12px;margin:10px 0 0;display:none;"></p>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    window._proAuthClient  = client;
    window._proToolName    = toolName;

    window._doProSignup = async function () {
      var email = document.getElementById('proEmail').value.trim();
      var pass  = document.getElementById('proPassword').value;
      var err   = document.getElementById('proAuthErr');
      if (!email || !pass) { err.textContent = 'Please enter email and password.'; err.style.display = 'block'; return; }
      document.getElementById('proSignupBtn').textContent = 'Creating account…';
      var r = await window._proAuthClient.auth.signUp({ email: email, password: pass });
      if (r.error) {
        err.textContent = r.error.message; err.style.display = 'block';
        document.getElementById('proSignupBtn').textContent = 'Create Account & Subscribe';
        return;
      }
      document.getElementById('proAuthModal').style.display = 'none';
      _toast('Account created! Verify your email, then come back to subscribe.', '#5EC98A');
    };

    window._doProLogin = async function () {
      var email = document.getElementById('proEmail').value.trim();
      var pass  = document.getElementById('proPassword').value;
      var err   = document.getElementById('proAuthErr');
      if (!email || !pass) { err.textContent = 'Please enter email and password.'; err.style.display = 'block'; return; }
      document.getElementById('proLoginBtn').textContent = 'Signing in…';
      var r = await window._proAuthClient.auth.signInWithPassword({ email: email, password: pass });
      if (r.error) {
        err.textContent = r.error.message; err.style.display = 'block';
        document.getElementById('proLoginBtn').textContent = 'I already have an account — Sign In';
        return;
      }
      document.getElementById('proAuthModal').style.display = 'none';
      window.initiateProSubscription(window._proToolName);
    };
  }

  // ── Internal toast helper ────────────────────────────────────────────────
  function _toast(msg, color) {
    // Delegate to page-level showToast if it exists
    if (typeof window.showToast === 'function') {
      window.showToast(msg, color);
      return;
    }
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:10px;font-size:13px;font-family:Inter,sans-serif;font-weight:bold;z-index:9999;transition:opacity .4s;box-shadow:0 4px 20px rgba(0,0,0,.4);color:#fff;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = color;
    t.style.opacity = '1';
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.style.opacity = '0'; }, 3500);
  }

})();
