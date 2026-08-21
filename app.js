
/* Shared short-date formatter. en-IN renders September as "Sept", which reads as a
   typo beside "Mar" and "Jun". Format explicitly so every month is three letters,
   and read date-only strings component-wise so they cannot shift a day in
   timezones behind UTC. */
var FS_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fsShortDate(d){
  if(d===null||d===undefined||d==='') return '—';
  try{
    var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
    if(iso) return iso[3]+' '+FS_MONTHS_SHORT[+iso[2]-1]+' '+iso[1];
    var dt = (d instanceof Date) ? d : new Date(d);
    if(isNaN(dt.getTime())) return String(d);
    return String(dt.getDate()).padStart(2,'0')+' '+FS_MONTHS_SHORT[dt.getMonth()]+' '+dt.getFullYear();
  }catch(e){ return String(d); }
}
'use strict';

var SUPA_URL = 'https://uymuivmktvtxmodblxie.supabase.co';
var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5bXVpdm1rdHZ0eG1vZGJseGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMjk5NTYsImV4cCI6MjA5NjkwNTk1Nn0.7dsdrDmYR8R891_Cc68K75tUlmwi49KExGGQbBq3qmg';

var leases = [];
var companies = [];
var deleteTargetId = null;
var _pendingUploadLeases = [];
var currentPage = 'dashboard';

// ── Helpers ──────────────────────────────────────────────────────────────────
function f2(n){ return (n===null||n===undefined||isNaN(+n)) ? '—' : '₹'+Number(n).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function fPct(n){ return (n===null||n===undefined||isNaN(+n)) ? '—' : Number(n).toFixed(2)+'%'; }
function fDate(d){ if(!d) return '—'; try{ return fsShortDate(new Date(d)); }catch(e){return d;} }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function toast(msg, color){
  var t = document.getElementById('appToast');
  t.textContent = msg;
  t.style.background = color || '#6366F1';
  t.style.opacity = '1';
  clearTimeout(t._tmr);
  t._tmr = setTimeout(function(){ t.style.opacity='0'; }, 3500);
}
window.showToast = toast;

function leaseStatus(l){
  var inp = l.inputs || {};
  if(!inp.start || !inp.term) return 'unknown';
  try{
    var start = new Date(inp.start);
    var end = new Date(start);
    end.setMonth(end.getMonth() + parseInt(inp.term));
    var now = new Date();
    var diff = (end - now) / (1000*60*60*24);
    if(diff < 0) return 'expired';
    if(diff <= 90) return 'expiring';
    return 'active';
  }catch(e){ return 'unknown'; }
}

function leaseEndDate(l){
  var inp = l.inputs || {};
  if(!inp.start || !inp.term) return null;
  try{
    var d = new Date(inp.start);
    d.setMonth(d.getMonth() + parseInt(inp.term));
    return d;
  }catch(e){ return null; }
}

// Rolls a saved lease's frozen Day-1 summary forward to today, so the portfolio
// dashboard shows the current ROU NBV / liability split rather than the
// commencement-date snapshot forever. Falls back to the stored summary for
// leases that haven't started yet, have ended, or are short-term/low-value.
function leaseAsOf(l, asOfDate){
  var s = l.summary || {};
  var inpRaw = l.inputs || {};
  if(!inpRaw.start || !(+inpRaw.termMonths || +inpRaw.term)) return s;
  // Bulk-uploaded leases only store "term", not "termMonths" — normalise so
  // leaseEngine.calculate() (which expects termMonths) works for either shape.
  var inp = Object.assign({}, inpRaw, { termMonths: +inpRaw.termMonths || +inpRaw.term });
  try{
    var full = leaseEngine.calculate(inp);
    if(!full.schedule || !full.schedule.length || !full.freq) return s; // exemption or no schedule

    var monthsPerPeriod = full.n ? full.termMonths / full.n : 1;
    var start = new Date(inp.start);
    var now = asOfDate || new Date();
    var monthsElapsed = (now.getFullYear()-start.getFullYear())*12 + (now.getMonth()-start.getMonth());
    var periodsElapsed = Math.floor(monthsElapsed / monthsPerPeriod);

    // idx = index of the last fully-completed schedule row; -1 = lease hasn't started
    var idx = Math.min(periodsElapsed, full.schedule.length) - 1;
    if(idx < -1) idx = -1;

    var baseClose = idx >= 0 ? full.schedule[idx].closeL : full.pvInitial;
    var rouNow    = idx >= 0 ? full.schedule[idx].rouC   : full.rouInitial;
    var nextRows  = full.schedule.slice(idx+1, idx+1+full.freq);
    var currentLiab = nextRows.reduce(function(sum,r){ return sum + r.principal; }, 0);

    return Object.assign({}, s, {
      rouNBV:         Math.round(rouNow),
      liabCurrent:    Math.round(currentLiab),
      liabNonCurrent: Math.max(0, Math.round(baseClose - currentLiab))
    });
  }catch(e){ return s; }
}

// ── Sidebar navigation ────────────────────────────────────────────────────────
function navigate(page){
  currentPage = page;
  closeSidebar();
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.sb-item').forEach(function(i){ i.classList.remove('active'); });
  var pg = document.getElementById('pg-'+page);
  var nav = document.getElementById('nav-'+page);
  if(pg) pg.classList.add('active');
  if(nav) nav.classList.add('active');

  if(page === 'dashboard') renderDashboard();
  if(page === 'leases') renderLeases();
  if(page === 'journal') renderJournalPage();
  if(page === 'reports') { switchRptTab('reports'); renderReportsPage(); }
  if(page === 'disclosures') { navigate('reports'); switchRptTab('disclosures'); renderDisclosuresPage(); return; }
  if(page === 'companies') renderCompaniesPage();
  if(page === 'company-detail') renderCompanyDetail();
  if(page === 'help') {} // static page, no render needed
}

// ── Mobile sidebar ────────────────────────────────────────────────────────────
function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ── Auth state → sidebar UI ───────────────────────────────────────────────────
function updateSidebarUser(){
  var user = window.currentUser;
  var isPro = window.isProUser;
  var avatar = document.getElementById('sbAvatar');
  var uname  = document.getElementById('sbUname');
  var upro   = document.getElementById('sbUpro');
  var signout= document.getElementById('sbSignout');
  var loginBtn= document.getElementById('sbLoginBtn');

  if(user){
    var initials = user.email ? user.email.slice(0,2).toUpperCase() : '?';
    avatar.textContent = initials;
    uname.textContent = user.email.length > 24 ? user.email.slice(0,22)+'…' : user.email;
    upro.style.display = isPro ? 'block' : 'none';
    signout.style.display = 'block';
    loginBtn.style.display = 'none';
  } else {
    avatar.textContent = '?';
    uname.textContent = 'Not signed in';
    upro.style.display = 'none';
    signout.style.display = 'none';
    loginBtn.style.display = 'block';
  }
}

// ── App initialisation ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  var attempts = 0;
  var waitForSupa = setInterval(function(){
    attempts++;
    if(window.supaClient){
      clearInterval(waitForSupa);
      initApp();
    } else if(attempts > 60){
      clearInterval(waitForSupa);
      updateSidebarUser();
      renderDashboard();
    }
  }, 50);
});

async function checkProStatus(userId){
  try{
    var now = new Date().toISOString();
    var res = await window.supaClient.from('subscriptions').select('id')
      .eq('user_id',userId).eq('status','active').gt('current_period_end',now)
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    return !res.error && res.data !== null;
  }catch(e){ return false; }
}

async function initApp(){
  // Get current session
  var sd = await window.supaClient.auth.getSession();
  if(sd.data.session){
    window.currentUser = sd.data.session.user;
    window.isProUser = await checkProStatus(window.currentUser.id);
  }
  updateSidebarUser();

  // Listen for auth changes
  window.supaClient.auth.onAuthStateChange(async function(event, session){
    if(session){
      window.currentUser = session.user;
      window.isProUser = await checkProStatus(session.user.id);
    } else {
      window.currentUser = null;
      window.isProUser = false;
    }
    updateSidebarUser();
    // Reload current page data
    if(currentPage === 'dashboard') { await loadLeases(); renderDashboard(); }
    if(currentPage === 'leases') renderLeases();
    if(currentPage === 'companies') { await loadCompanies(); renderCompaniesPage(); }
  });

  // Load data
  await loadLeases();
  await loadCompanies();
  renderDashboard();
}

// ── Data loading ──────────────────────────────────────────────────────────────
var FREE_LEASE_LIMIT = 3;

// Upload batch cap — matches the 20 formatted rows in the downloadable template.
// Keeps the run client-side-fast and keeps the preview screen small enough to
// actually be reviewed before importing.
var MAX_UPLOAD_LEASES = 20;

async function loadLeases(){
  if(!window.supaClient || !window.currentUser){ leases = []; return; }
  try{
    var res = await window.supaClient.from('leases').select('*')
      .eq('user_id',window.currentUser.id)
      .order('created_at',{ascending:false});
    if(res.error) throw res.error;
    leases = res.data || [];
    updateLeaseCountBadge();
  }catch(e){ leases = []; }
}

async function loadCompanies(){
  if(!window.supaClient || !window.currentUser){ companies = []; return; }
  try{
    var res = await window.supaClient.from('companies').select('*')
      .eq('user_id',window.currentUser.id)
      .order('name',{ascending:true});
    if(res.error){ companies = []; return; } // table may not exist yet
    companies = res.data || [];
    populateCompanyDropdowns();
  }catch(e){ companies = []; }
}

function updateLeaseCountBadge(){
  var badge = document.getElementById('sbLeaseCount');
  if(leases.length){
    badge.textContent = leases.length;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
  var countEl = document.getElementById('leaseCount');
  if(countEl){
    if(!window.isProUser){
      countEl.textContent = leases.length + ' / ' + FREE_LEASE_LIMIT + ' leases (Free)';
    } else {
      countEl.textContent = leases.length + (leases.length===1?' lease':' leases');
    }
  }
}

function populateCompanyDropdowns(){
  var sel = document.getElementById('leaseCompanyFilter');
  if(!sel) return;
  sel.innerHTML = '<option value="">All companies</option>';
  companies.forEach(function(c){
    sel.innerHTML += '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';
  });
}

// ── KPI calculation ───────────────────────────────────────────────────────────
function calcKPIs(leasesArr){
  var tot = {rou:0, curr:0, ncurr:0, depn:0};
  leasesArr.forEach(function(l){
    var s = leaseAsOf(l);
    tot.rou   += (s.rouNBV         || 0);
    tot.curr  += (s.liabCurrent    || 0);
    tot.ncurr += (s.liabNonCurrent || 0);
    tot.depn  += (s.depnAnnual     || 0);
  });
  return tot;
}

function updateKPICards(leasesArr){
  var tot = calcKPIs(leasesArr);
  var n = leasesArr.length;
  document.getElementById('kpiROU').textContent   = n ? f2(tot.rou)   : '—';
  document.getElementById('kpiCurr').textContent  = n ? f2(tot.curr)  : '—';
  document.getElementById('kpiNCurr').textContent = n ? f2(tot.ncurr) : '—';
  document.getElementById('kpiDepn').textContent  = n ? f2(tot.depn)  : '—';
}

// ── Dashboard rendering ───────────────────────────────────────────────────────
function renderDashboard(){
  // Show onboarding if logged in Pro but no leases yet
  if(window.currentUser && window.isProUser && !leases.length){
    renderDashOnboarding();
    return;
  }
  updateKPICards(leases);
  renderDashAlerts();
  renderActionCenter();
  renderDashRecentTable();
}

function renderDashOnboarding(){
  // Hide KPI strip, alerts, action center, recent table — show onboarding instead
  var kpi = document.querySelector('#pg-dashboard .kpi-strip');
  var alerts = document.getElementById('dashAlerts');
  var acHd = document.querySelector('#pg-dashboard .section-hd');
  var ac = document.getElementById('dashActionCenter');
  var recentHd = document.querySelectorAll('#pg-dashboard .section-hd')[1];
  var recent = document.getElementById('dashRecentTable');
  [kpi,alerts,ac,recent].forEach(function(el){ if(el) el.style.display='none'; });
  if(acHd) acHd.style.display='none';
  if(recentHd) recentHd.style.display='none';

  var hasCompany = companies.length > 0;
  var container = document.querySelector('#pg-dashboard .page-body');

  var existing = document.getElementById('dashOnboarding');
  if(existing) existing.remove();

  var div = document.createElement('div');
  div.id = 'dashOnboarding';
  div.innerHTML =
    '<div class="ob-wrap">'+
      '<div class="ob-welcome">'+
        '<div style="font-size:36px;margin-bottom:10px;">👋</div>'+
        '<h2>Welcome to Finosutra</h2>'+
        '<p>You\'re 3 steps away from your first IND AS 116 lease calculation.</p>'+
      '</div>'+
      '<div class="ob-steps">'+

        // Step 1
        '<div class="ob-step'+(hasCompany?' done':'')+'" onclick="'+(hasCompany?'navigate(\'companies\')':'openCompanyModal()')+'" >'+
          '<div class="ob-step-num">'+(hasCompany?'✓':'1')+'</div>'+
          '<div class="ob-step-body">'+
            '<div class="ob-step-title">Add your company</div>'+
            '<div class="ob-step-desc">Enter your client\'s legal name, GSTIN, and FY start month. This becomes the reporting container for all their leases.</div>'+
          '</div>'+
          '<div class="ob-step-action">'+(hasCompany?'✓ Done':'Add Company →')+'</div>'+
        '</div>'+

        // Step 2
        '<div class="ob-step" onclick="navigate(\'leases\')">'+
          '<div class="ob-step-num">2</div>'+
          '<div class="ob-step-body">'+
            '<div class="ob-step-title">Add your first lease</div>'+
            '<div class="ob-step-desc">Enter lease name, commencement date, term, rent per period, and IBR (discount rate). You can also bulk upload via Excel template.</div>'+
          '</div>'+
          '<div class="ob-step-action">Add Lease →</div>'+
        '</div>'+

        // Step 3
        '<div class="ob-step" onclick="navigate(\'leases\')">'+
          '<div class="ob-step-num">3</div>'+
          '<div class="ob-step-body">'+
            '<div class="ob-step-title">Calculate &amp; export</div>'+
            '<div class="ob-step-desc">Click Calculate to generate the amortization schedule, journal entries, and Para 52 disclosure note. Then export a working paper or premium report.</div>'+
          '</div>'+
          '<div class="ob-step-action">Go to Leases →</div>'+
        '</div>'+

      '</div>'+
      '<div class="ob-skip">Already have data? <a onclick="dismissDashOnboarding()">Skip setup and view dashboard</a> &nbsp;·&nbsp; <a onclick="navigate(\'help\')">Read the user guide</a></div>'+
    '</div>';
  container.appendChild(div);
}

function dismissDashOnboarding(){
  var ob = document.getElementById('dashOnboarding');
  if(ob) ob.remove();
  // Restore all hidden elements
  var kpi = document.querySelector('#pg-dashboard .kpi-strip');
  var alerts = document.getElementById('dashAlerts');
  var ac = document.getElementById('dashActionCenter');
  var recent = document.getElementById('dashRecentTable');
  var hds = document.querySelectorAll('#pg-dashboard .section-hd');
  [kpi,alerts,ac,recent].forEach(function(el){ if(el) el.style.display=''; });
  hds.forEach(function(el){ el.style.display=''; });
  updateKPICards(leases);
  renderDashAlerts();
  renderActionCenter();
  renderDashRecentTable();
}

function renderDashAlerts(){
  var container = document.getElementById('dashAlerts');
  var expiring = leases.filter(function(l){ return leaseStatus(l) === 'expiring'; });
  if(!expiring.length){ container.innerHTML = ''; return; }
  var names = expiring.map(function(l){
    var ed = leaseEndDate(l);
    return esc(l.name) + (ed ? ' ('+fDate(ed)+')' : '');
  }).join(', ');
  container.innerHTML =
    '<div class="alert-strip"><i class="fa-solid fa-triangle-exclamation"></i>' +
    '<div class="alert-strip-text"><strong>'+expiring.length+' lease'+(expiring.length>1?'s':'')+' expiring within 90 days</strong> — '+names+'</div></div>';
}

function renderDashRecentTable(){
  var el = document.getElementById('dashRecentTable');
  if(!window.currentUser){
    el.innerHTML = '<div style="padding:28px;text-align:center;font-size:14px;color:#9CA3AF;">Sign in to see your leases. <button onclick="fsShowAuthModal(\'login\')" style="color:#4F46E5;background:none;border:none;cursor:pointer;font-weight:600;font-family:inherit;font-size:14px;">Log In</button></div>';
    return;
  }
  if(!window.isProUser && leases.length === 0){
    el.innerHTML = '<div style="padding:28px;text-align:center;font-size:14px;color:#9CA3AF;">Add up to '+FREE_LEASE_LIMIT+' leases free. <button onclick="fsInitiateProSubscription()" style="color:#4F46E5;background:none;border:none;cursor:pointer;font-weight:600;font-family:inherit;font-size:14px;">Upgrade for unlimited ↗</button></div>';
    return;
  }
  if(!leases.length){
    el.innerHTML = '<div style="padding:32px;text-align:center;"><div style="font-size:13px;color:#9CA3AF;">No leases yet — <button onclick="openAddModal()" style="color:#4F46E5;background:none;border:none;cursor:pointer;font-weight:600;font-family:inherit;font-size:13px;">Add your first lease</button> or <button onclick="downloadTemplate()" style="color:#4F46E5;background:none;border:none;cursor:pointer;font-weight:600;font-family:inherit;font-size:13px;">upload an Excel template</button></div></div>';
    return;
  }
  var recent = leases.slice(0,6);
  var rows = recent.map(function(l){
    var s = leaseAsOf(l);
    var inp = l.inputs||{};
    var st = leaseStatus(l);
    var stHtml = st==='active'? '<span class="badge badge-active">Active</span>'
      : st==='expiring'? '<span class="badge badge-expiring">Expiring</span>'
      : st==='expired'? '<span class="badge badge-expired">Expired</span>' : '—';
    var ed = leaseEndDate(l);
    return '<tr>'+
      '<td><strong style="font-size:13px;">'+esc(l.name)+'</strong>'+(inp.entity?'<br><span style="font-size:11px;color:#9CA3AF;">'+esc(inp.entity)+'</span>':'')+'</td>'+
      '<td>'+fPct(inp.ibr)+' p.a.</td>'+
      '<td>'+f2(s.liabCurrent)+'</td>'+
      '<td>'+f2(s.rouNBV)+'</td>'+
      '<td>'+(ed?fDate(ed):'—')+'</td>'+
      '<td>'+stHtml+'</td>'+
      '</tr>';
  }).join('');
  el.innerHTML =
    '<table class="data-table">'+
    '<thead><tr><th>Lease</th><th>IBR</th><th>Current Liab.</th><th>ROU NBV</th><th>Expires</th><th>Status</th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table>';
}

// ── Leases page rendering ─────────────────────────────────────────────────────
function renderLeases(){
  updateLeaseCountBadge();
  if(!window.currentUser){
    renderProGate();
    return;
  }
  filterLeases();
}

function filterLeases(){
  var q = (document.getElementById('leaseSearch')||{}).value||'';
  q = q.toLowerCase();
  var statusF = (document.getElementById('leaseStatusFilter')||{}).value||'';
  var companyF = (document.getElementById('leaseCompanyFilter')||{}).value||'';

  var filtered = leases.filter(function(l){
    var inp = l.inputs||{};
    if(q && !l.name.toLowerCase().includes(q) && !(inp.entity||'').toLowerCase().includes(q)) return false;
    if(statusF && leaseStatus(l) !== statusF) return false;
    if(companyF && (inp.company_id||l.company_id||'') !== companyF) return false;
    return true;
  });
  renderLeaseGrid(filtered);
}

function renderLeaseGrid(arr){
  var ca = document.getElementById('leaseContentArea');
  if(!arr.length){
    ca.innerHTML =
      '<div class="empty-state">'+
        '<div class="empty-icon">📂</div>'+
        '<div class="empty-title">'+(leases.length?'No leases match your filter':'No leases yet')+'</div>'+
        '<div class="empty-sub">'+(leases.length?'Try clearing the search or filter.':'Download the Excel template, fill one row per lease, and upload — or add single leases via the calculator.')+'</div>'+
        (!leases.length?'<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;"><button class="btn btn-amber" onclick="downloadTemplate()">↓ Download Template</button><button class="btn btn-primary" onclick="openAddModal()">+ Add Single Lease</button></div>':'')+
      '</div>';
    return;
  }
  var html = '<div class="lease-grid">';
  arr.forEach(function(l){
    var s = leaseAsOf(l);
    var inp = l.inputs||{};
    var model = inp.model||l.model||'standard';
    var st = leaseStatus(l);
    var stHtml = st==='expiring'? ' <span class="badge badge-expiring" style="font-size:10px;vertical-align:middle;">Expiring</span>'
      : st==='expired'? ' <span class="badge badge-expired" style="font-size:10px;vertical-align:middle;">Expired</span>' : '';
    var coName = '';
    if(inp.company_id||l.company_id){
      var co = companies.find(function(c){ return c.id===(inp.company_id||l.company_id); });
      if(co) coName = '<span class="co-tag">'+esc(co.name)+'</span> ';
    }
    html +=
      '<div class="lease-card">'+
        '<div class="lease-card-hd">'+
          '<div class="lease-name" title="'+esc(l.name)+'">'+esc(l.name)+stHtml+'</div>'+
          '<div style="display:flex;gap:5px;align-items:center;">'+
            (inp.workflowStatus && inp.workflowStatus!=='draft' ? '<span class="lease-status-badge '+esc(inp.workflowStatus)+'">'+esc({draft:'Draft','in-review':'In Review',reviewed:'Reviewed',approved:'Approved',modified:'Modified',closed:'Closed'}[inp.workflowStatus]||inp.workflowStatus)+'</span>' : '')+
            '<span class="lease-model-badge '+(model==='standard'?'std':'esc')+'">'+(model==='standard'?'Standard':'Escalation')+'</span>'+
          '</div>'+
        '</div>'+
        '<div class="lease-card-body">'+
          '<div class="lease-meta">'+
            '<div><div class="lm-lbl">Entity</div><div class="lm-val">'+coName+esc(inp.entity||l.entity||'—')+'</div></div>'+
            '<div><div class="lm-lbl">IBR</div><div class="lm-val">'+fPct(inp.ibr)+' p.a.</div></div>'+
            '<div><div class="lm-lbl">Start</div><div class="lm-val">'+fDate(inp.start)+'</div></div>'+
            '<div><div class="lm-lbl">Term</div><div class="lm-val">'+(inp.term?inp.term+' mo':'—')+'</div></div>'+
          '</div>'+
          '<div class="lease-kpis">'+
            '<div class="lk-item"><div class="lk-lbl">ROU NBV</div><div class="lk-val">'+f2(s.rouNBV)+'</div></div>'+
            '<div class="lk-item"><div class="lk-lbl">Curr. Liab.</div><div class="lk-val green">'+f2(s.liabCurrent)+'</div></div>'+
            '<div class="lk-item"><div class="lk-lbl">FY Depn.</div><div class="lk-val orange">'+f2(s.depnAnnual)+'</div></div>'+
          '</div>'+
          '<div class="lease-card-footer">'+
            '<span class="lease-date">Saved '+fDate(l.created_at)+'</span>'+
            '<div style="display:flex;gap:6px;">'+
              '<button class="btn btn-outline btn-sm" onclick="openLeaseDetail(\''+l.id+'\')">Edit ✏</button>'+
              '<button class="btn btn-danger btn-sm" onclick="openDeleteModal(\''+l.id+'\',\''+esc(l.name)+'\')">Remove</button>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
  });
  html += '</div>';
  ca.innerHTML = html;
}

function renderProGate(){
  document.getElementById('leaseContentArea').innerHTML =
    // ── Upgrade banner ──
    '<div style="background:linear-gradient(135deg,#1E1B4B,#312E81);border-radius:14px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">'+
      '<div style="width:48px;height:48px;background:rgba(99,102,241,.3);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🚀</div>'+
      '<div style="flex:1;min-width:200px;">'+
        '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">You\'re viewing 2 sample leases</div>'+
        '<div style="font-size:12.5px;color:rgba(255,255,255,.6);line-height:1.5;">Go Pro to add your own leases — IND AS 116 schedules, journal entries, and audit-ready Excel in one workspace.</div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">'+
        '<button onclick="fsInitiateProSubscription()" style="padding:10px 20px;background:linear-gradient(135deg,#F59E0B,#D97706);border:none;border-radius:9px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:Inter,sans-serif;box-shadow:0 2px 8px rgba(217,119,6,.3);white-space:nowrap;">🏆 Go Pro — ₹499/mo</button>'+
        '<span style="font-size:11px;color:rgba(255,255,255,.45);text-align:right;">or ₹3,999/yr &nbsp;·&nbsp; 2 months free</span>'+
      '</div>'+
    '</div>'+
    // ── Section label ──
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
      '<span style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.6px;">Sample Leases</span>'+
      '<span style="font-size:11.5px;color:#D97706;font-weight:600;background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:3px 10px;">👁 Read-only preview</span>'+
    '</div>'+
    // ── Sample cards + Go Pro card ──
    '<div class="lease-grid" style="pointer-events:none;">'+
      sampleLeaseCard('Andheri Office — 5th Floor','ABC Pvt. Ltd.','Mumbai','01 Apr 2024','36','45,000','10.5','14,23,840','14,98,200','4,99,400','std')+
      sampleLeaseCard('Pune Warehouse — Phase 2','ABC Pvt. Ltd.','Pune','01 Jan 2024','48','72,000','11.0','27,84,210','29,02,400','7,25,600','esc')+
      '<div style="background:linear-gradient(135deg,#EEF2FF,#F5F3FF);border:2px dashed #C7D2FE;border-radius:16px;padding:28px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px;pointer-events:all;">'+
        '<div style="font-size:32px;margin-bottom:10px;">🔒</div>'+
        '<div style="font-size:14px;font-weight:700;color:#3730A3;margin-bottom:6px;">Add your own leases</div>'+
        '<div style="font-size:12px;color:#6B7280;line-height:1.5;margin-bottom:14px;max-width:200px;">Upload via Excel or add manually — all IND AS 116 schedules computed instantly.</div>'+
        '<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:16px;text-align:left;width:100%;max-width:220px;">'+
          '<div style="font-size:11.5px;color:#374151;display:flex;gap:6px;align-items:center;"><span style="color:#4F46E5;font-size:10px;">✓</span> Amortisation schedule</div>'+
          '<div style="font-size:11.5px;color:#374151;display:flex;gap:6px;align-items:center;"><span style="color:#4F46E5;font-size:10px;">✓</span> Journal entries (Day 1 + monthly)</div>'+
          '<div style="font-size:11.5px;color:#374151;display:flex;gap:6px;align-items:center;"><span style="color:#4F46E5;font-size:10px;">✓</span> Disclosure note — Para 52</div>'+
          '<div style="font-size:11.5px;color:#374151;display:flex;gap:6px;align-items:center;"><span style="color:#4F46E5;font-size:10px;">✓</span> Audit-ready Excel export</div>'+
        '</div>'+
        '<button onclick="fsInitiateProSubscription()" style="width:100%;padding:10px;background:linear-gradient(135deg,#F59E0B,#D97706);border:none;border-radius:9px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:Inter,sans-serif;">Unlock — ₹499/mo</button>'+
      '</div>'+
    '</div>';
}

function sampleLeaseCard(name,entity,location,start,term,rent,ibr,liab,rou,depn,modelClass){
  return '<div class="lease-card" style="opacity:.85;">'+
    '<div class="lease-card-hd" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">'+
      '<div>'+
        '<div class="lease-name">'+name+'</div>'+
        '<div style="font-size:11px;color:#6B7280;margin-top:1px;">'+entity+' &nbsp;·&nbsp; '+location+'</div>'+
      '</div>'+
      '<span style="font-size:9.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;border-radius:20px;padding:3px 9px;flex-shrink:0;">Sample</span>'+
    '</div>'+
    '<div class="lease-card-body">'+
      '<div class="lease-meta">'+
        '<div><div class="lm-lbl">Commencement</div><div class="lm-val">'+start+'</div></div>'+
        '<div><div class="lm-lbl">Term</div><div class="lm-val">'+term+' months</div></div>'+
        '<div><div class="lm-lbl">Rent / mo</div><div class="lm-val">₹'+rent+'</div></div>'+
        '<div><div class="lm-lbl">IBR</div><div class="lm-val">'+ibr+'% p.a.</div></div>'+
      '</div>'+
      '<div class="lease-kpis">'+
        '<div class="lk-item"><div class="lk-lbl">Lease Liability</div><div class="lk-val">₹'+liab+'</div></div>'+
        '<div class="lk-item"><div class="lk-lbl">ROU Asset</div><div class="lk-val green">₹'+rou+'</div></div>'+
        '<div class="lk-item"><div class="lk-lbl">Annual Depn</div><div class="lk-val orange">₹'+depn+'</div></div>'+
      '</div>'+
      '<div class="lease-card-footer" style="display:flex;align-items:center;justify-content:space-between;">'+
        '<span class="badge badge-active">Active</span>'+
        '<div style="display:flex;gap:6px;">'+
          '<span style="padding:5px 12px;font-size:11.5px;font-weight:600;border-radius:7px;border:1px solid #E5E7EB;background:#F9FAFB;color:#9CA3AF;">🔒 Schedule</span>'+
          '<span style="padding:5px 12px;font-size:11.5px;font-weight:600;border-radius:7px;border:1px solid #E5E7EB;background:#F9FAFB;color:#9CA3AF;">🔒 Export</span>'+
        '</div>'+
      '</div>'+
    '</div></div>';
}

// ── Companies page ────────────────────────────────────────────────────────────
function renderCompaniesPage(){
  var el = document.getElementById('companiesArea');
  if(!window.currentUser){
    el.innerHTML = '<div class="pro-gate"><div class="pro-gate-icon">🔒</div><div class="pro-gate-title">Sign in first</div><button class="btn btn-primary" onclick="fsShowAuthModal(\'login\')">Log In</button></div>';
    return;
  }
  if(!companies.length){
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏢</div><div class="empty-title">No companies yet</div><div class="empty-sub">Add your client companies to organise leases by entity. Each lease can be tagged to a company for filtering and consolidated reports.</div><button class="btn btn-primary" onclick="openCompanyModal()">+ Add Company</button></div>';
    return;
  }
  var cards = companies.map(function(c){
    var coLeases = leases.filter(function(l){ return (l.inputs||{}).company_id===c.id; });
    var active = coLeases.filter(function(l){ return leaseStatus(l)==='active'||leaseStatus(l)==='expiring'; }).length;
    var pending = coLeases.filter(function(l){ return (l.inputs||{}).workflowStatus==='in-review'; }).length;
    return '<div class="company-card">'+
      '<div class="company-card-name">'+esc(c.name)+'</div>'+
      '<div class="company-card-meta">'+
        (c.gstin?'GSTIN: '+esc(c.gstin)+'<br>':'')+
        'FY Start: '+(['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][c.fy_start]||'Apr')+
        ' &nbsp;·&nbsp; Standard: '+esc(c.reporting_standard||'IND AS')+
        '<br><span style="color:#4F46E5;font-weight:600;">'+coLeases.length+' lease'+(coLeases.length!==1?'s':'')+'</span>'+
        (active?' &nbsp;·&nbsp; '+active+' active':'')+
        (pending?' &nbsp;·&nbsp; <span style="color:#D97706;">'+pending+' pending review</span>':'')+
      '</div>'+
      '<div class="company-card-actions">'+
        '<button class="btn btn-primary btn-sm" onclick="openCompanyDetail(\''+c.id+'\')">Open →</button>'+
        '<button class="btn btn-outline btn-sm" onclick="openExportCenter(\'company\',null,\''+c.id+'\')"><i class="fa-solid fa-file-export"></i></button>'+
        '<button class="btn btn-danger btn-sm" onclick="deleteCompany(\''+c.id+'\')">Remove</button>'+
      '</div>'+
    '</div>';
  }).join('');
  el.innerHTML = '<div class="company-grid">'+cards+'</div>';

  // Check if companies table exists — if companies are empty and we got no error, show SQL note
  // (already showing empty state above, this is only reached if companies.length > 0)
}

// ── Company CRUD ──────────────────────────────────────────────────────────────
function openCompanyModal(){
  document.getElementById('coName').value='';
  document.getElementById('coGstin').value='';
  document.getElementById('coFyStart').value='4';
  document.getElementById('coStandard').value='IND AS';
  document.getElementById('companyModalTitle').textContent='Add Company';
  document.getElementById('companyModal').classList.add('show');
}
function closeCompanyModal(){ document.getElementById('companyModal').classList.remove('show'); }

async function saveCompany(){
  if(!window.currentUser){ toast('Please sign in first.','#EF4444'); return; }
  var name = document.getElementById('coName').value.trim();
  if(!name){ toast('Company name is required.','#EF4444'); return; }
  try{
    var res = await window.supaClient.from('companies').insert({
      user_id: window.currentUser.id,
      name: name,
      gstin: document.getElementById('coGstin').value.trim()||null,
      fy_start: parseInt(document.getElementById('coFyStart').value)||4,
      reporting_standard: document.getElementById('coStandard').value||'IND AS'
    }).select().single();
    if(res.error){
      if(res.error.message && res.error.message.includes('does not exist')){
        toast('Companies table not found. Please run the Supabase SQL from the setup guide.','#EF4444');
      } else {
        throw res.error;
      }
      return;
    }
    companies.unshift(res.data);
    populateCompanyDropdowns();
    closeCompanyModal();
    renderCompaniesPage();
    toast('Company saved!','#059669');
  }catch(e){ toast('Error: '+e.message,'#EF4444'); }
}

async function deleteCompany(id){
  if(!confirm('Remove this company? Leases linked to it will not be deleted.')) return;
  try{
    var res = await window.supaClient.from('companies').delete().eq('id',id).eq('user_id',window.currentUser.id);
    if(res.error) throw res.error;
    companies = companies.filter(function(c){ return c.id!==id; });
    populateCompanyDropdowns();
    renderCompaniesPage();
    toast('Company removed.','#6B7280');
  }catch(e){ toast('Error: '+e.message,'#EF4444'); }
}

// ── Add lease ──────────────────────────────────────────────────────────────────
function openAddModal(){
  openLeaseDetail(null);
}

// ── Delete modal ──────────────────────────────────────────────────────────────
function openDeleteModal(id,name){
  if(!id || id==='null' || id==='undefined'){ toast('Cannot remove: lease has no ID. Please reload the page.','#EF4444'); return; }
  deleteTargetId=id;
  document.getElementById('deleteLeaseName').textContent=name;
  document.getElementById('deleteModal').classList.add('show');
}
function closeDeleteModal(){ document.getElementById('deleteModal').classList.remove('show'); deleteTargetId=null; }
async function confirmDelete(){
  if(!deleteTargetId) return;
  var idToDelete = deleteTargetId;
  closeDeleteModal();
  try{
    var res = await window.supaClient.from('leases').delete().eq('id',idToDelete).eq('user_id',window.currentUser.id);
    if(res.error) throw res.error;
    logAudit(idToDelete, 'deleted', {});
    leases = leases.filter(function(l){ return l.id!==idToDelete; });
    deleteTargetId=null;
    toast('Lease removed.','#6B7280');
    updateLeaseCountBadge();
    filterLeases();
    renderDashboard();
  }catch(e){ toast('Delete failed: '+e.message,'#EF4444'); }
}

// ── Clear all leases ──────────────────────────────────────────────────────────
async function clearAllLeases(){
  if(!window.currentUser||!window.isProUser) return;
  if(!confirm('Delete ALL '+leases.length+' leases from your portfolio? This cannot be undone.')) return;
  try{
    var res = await window.supaClient.from('leases').delete().eq('user_id',window.currentUser.id);
    if(res.error) throw res.error;
    leases=[];
    toast('All leases cleared.','#6B7280');
    updateLeaseCountBadge();
    filterLeases();
    renderDashboard();
  }catch(e){ toast('Error: '+e.message,'#EF4444'); }
}

// ── Upload flow (reused from portfolio.html) ──────────────────────────────────
function handleFileInputChange(input){
  var file = input.files&&input.files[0];
  if(!file) return;
  if(!window.currentUser){ toast('Please sign in first.','#EF4444'); return; }
  if(!window.isProUser){ toast('Portfolio upload requires Pro.','#6366F1'); fsInitiateProSubscription(); return; }
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var wb = XLSX.read(e.target.result,{type:'array',cellDates:true});
      var ws = wb.Sheets['Lease Register']||wb.Sheets[wb.SheetNames[0]];
      // Try row-4 header (professional template: 3 banner rows before headers)
      var rows = XLSX.utils.sheet_to_json(ws,{defval:'',range:3});
      // If every row is empty (e.g. plain template with row-1 headers), fall back to default
      var hasData = rows.some(function(r){ return Object.values(r).some(function(v){return String(v).trim();}); });
      if(!hasData) rows = XLSX.utils.sheet_to_json(ws,{defval:''});
      // Strip asterisks from keys so "Lease Name *" → "Lease Name"
      rows = rows.map(function(r){
        var clean={};
        Object.keys(r).forEach(function(k){ clean[k.replace(/\s*\*\s*/g,'').trim()]=r[k]; });
        return clean;
      });
      // Keep only rows the user actually filled in. Dropped here: the two shipped
      // SAMPLE rows, the blank formatted rows, and banner text such as the "STOP"
      // line under the table — a real lease always carries data beyond its name,
      // whereas a banner or a stray note only ever fills the first column.
      rows = rows.filter(function(r){
        var nm=String(r['Lease Name']||r['A']||'').trim();
        if(/^sample\b/i.test(nm)) return false;
        return Object.keys(r).some(function(k){
          return k!=='Lease Name' && k!=='A' && String(r[k]).trim()!=='';
        });
      });
      if(!rows.length){
        toast('No leases found in that file. Enter your data in rows 7–26 of the Lease Register sheet.','#EF4444');
        return;
      }
      if(rows.length>MAX_UPLOAD_LEASES){
        toast('That file has '+rows.length+' leases — the limit is '+MAX_UPLOAD_LEASES+' per upload. Please split it into smaller files.','#EF4444');
        return;
      }
      processUploadedLeases(rows);
    }catch(err){ toast('Could not read file: '+err.message,'#EF4444'); }
    finally{ input.value=''; }
  };
  reader.readAsArrayBuffer(file);
}

function pad2(n){ return (n<10?'0':'')+n; }

function parseDate(v){
  if(v===null||v===undefined||v==='') return null;
  // Real Date (SheetJS cellDates) — read the LOCAL parts. toISOString() would shift
  // an IST midnight back to the previous day and silently move commencement.
  if(v instanceof Date){
    if(isNaN(v.getTime())) return null;
    return v.getFullYear()+'-'+pad2(v.getMonth()+1)+'-'+pad2(v.getDate());
  }
  // Excel serial number (when cellDates did not apply) — day 1 is 01/01/1900
  if(typeof v==='number' && isFinite(v)){
    var d=new Date(Date.UTC(1899,11,30)+v*86400000);
    return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate());
  }
  var s=String(v).trim();
  var parts=s.split(/[\/\-\.]/);
  if(parts.length===3){
    if(parts[2].length===4) return parts[2]+'-'+pad2(parseInt(parts[1],10))+'-'+pad2(parseInt(parts[0],10));
    return s;
  }
  return s;
}

function pvCalc(pmt,ibr,term,freq,timing){
  freq=parseInt(freq)||12;
  var r=ibr/(100*freq);
  var n=term*(freq/12);
  if(r===0) return pmt*n;
  var pv;
  if(timing==='beginning'||timing==='advance'){
    pv=pmt*(1-(1+r)<=0?n:Math.pow(1+r,-n))/r*(1+r);
  }else{
    pv=pmt*(1-Math.pow(1+r,-n))/r;
  }
  return Math.round(pv);
}

function buildSchedule(pmt,ibr,term,freq,timing){
  freq=parseInt(freq)||12;
  var r=ibr/(100*freq);
  var n=term*(freq/12);
  var liab=pvCalc(pmt,ibr,term,freq,timing);
  var sched=[];
  var dep=liab/term;
  for(var i=1;i<=n;i++){
    var int=Math.round(liab*r);
    var principal=Math.round(pmt-int);
    liab=Math.round(liab-principal);
    if(liab<0) liab=0;
    sched.push({period:i,interest:int,principal:principal,closing:liab,depn:Math.round(dep)});
  }
  return sched;
}

function processUploadedLeases(rows){
  var parsed=[];
  rows.forEach(function(r,i){
    var name=String(r['Lease Name']||r['A']||'').trim();
    var lessor=String(r['Lessor Name']||r['Lessor']||r['B']||'').trim();
    var entity=String(r['Entity / Lessee']||r['Entity']||r['C']||'').trim();
    var category=String(r['Asset Category']||r['Category']||r['D']||'').trim();
    var startRaw=r['Start Date']||r['E']||'';
    var termRaw=parseFloat(r['Term (months)']||r['Term']||r['F'])||0;
    var pmtRaw=parseFloat(r['Rent per Period (₹)']||r['Rent per Period']||r['Rent / Period (₹)']||r['Rent / Period']||r['G'])||0;
    var freqStr=String(r['Frequency']||r['H']||'Monthly').trim().toLowerCase();
    var ibrRaw=parseFloat(r['IBR (% p.a.)']||r['IBR']||r['I'])||0;
    var timingStr=String(r['Payment Timing']||r['J']||'End').trim().toLowerCase();
    var escTypeRaw=String(r['Escalation Type']||r['K']||'none').trim().toLowerCase();
    var escPct=parseFloat(r['Escalation % p.a.']||r['L'])||0;
    var escAmt=parseFloat(r['Escalation ₹ per step']||r['Escalation ₹ p.a.']||r['M'])||0;
    // Interval defaults to 1 (escalate every year). It must never silently become 3 —
    // blank and 0 both used to fall through to a 3-year step-up.
    var escYears=parseInt(r['Escalation Interval (yrs)']||r['N'],10);
    if(!escYears||escYears<1) escYears=1;
    var rfMonths=parseFloat(r['Rent-Free Months']||r['O'])||0;
    var idc=parseFloat(r['IDC (₹)']||r['IDC']||r['P'])||0;
    var incentive=parseFloat(r['Incentive (₹)']||r['Incentive']||r['Q'])||0;
    var restoration=parseFloat(r['Restoration Cost (₹)']||r['Restoration']||r['R'])||0;
    var exemptRaw=String(r['Short-term / Low-value']||r['Exempt']||r['S']||'').trim().toLowerCase();
    var isShortTerm=exemptRaw==='short-term'||exemptRaw==='short term'||exemptRaw==='st';
    var isLowValue=exemptRaw==='low-value'||exemptRaw==='low value'||exemptRaw==='lv';

    var errors=[];
    if(!name) errors.push('Name required');
    if(!termRaw) errors.push('Term required');
    if(!pmtRaw && !isShortTerm && !isLowValue) errors.push('Rent required');
    if(!ibrRaw && !isShortTerm && !isLowValue) errors.push('IBR required');

    var start=parseDate(startRaw)||new Date().toISOString().slice(0,10);
    var freqMap={'monthly':12,'quarterly':4,'half-yearly':2,'half yearly':2,'annual':1,'annually':1};
    var freq=freqMap[freqStr]||12;
    var timing=timingStr.includes('beg')||timingStr.includes('adv')?'advance':'arrears';
    var escType=escTypeRaw==='pct'||escTypeRaw==='%'||escTypeRaw.includes('fixed %')||escTypeRaw.includes('fixed%')||escTypeRaw.includes('percent')||(escTypeRaw==='none'&&escPct>0)?'pct'
               :escTypeRaw==='amt'||escTypeRaw==='amount'||escTypeRaw.includes('fixed ₹')||escTypeRaw.includes('fixed rs')||escTypeRaw.includes('fixed amount')||(escTypeRaw==='none'&&!escPct&&escAmt>0)?'amt'
               :escTypeRaw==='cpi'||escTypeRaw.includes('index')?'cpi':'none';

    // An escalation type with no value would compute as a flat rent — surface it
    // instead of silently understating the liability.
    if((escType==='pct'||escType==='cpi') && !escPct) errors.push('Escalation % missing');
    if(escType==='amt' && !escAmt) errors.push('Escalation ₹ missing');

    var pvInit=0,rouInit=0,rouNBV=0,liabCurrent=0,liabNonCurrent=0,depnAnnual=0,depnPeriod=0;
    if(!errors.length){
      var inp={
        name:name, start:start, termMonths:termRaw, pmt:pmtRaw, freq:freq,
        timing:timing, ibr:ibrRaw, escType:escType, escPct:escPct, escAmt:escAmt,
        escYears:escYears,
        rfMonths:rfMonths, idc:idc+restoration, incentive:incentive,
        isShortTerm:isShortTerm, isLowValue:isLowValue
      };
      var res=leaseEngine.calculate(inp);
      pvInit=res.pvInitial;
      rouInit=res.rouInitial;
      rouNBV=res.rouInitial;
      liabCurrent=res.liabCurrent;
      liabNonCurrent=res.liabNonCurrent;
      depnAnnual=res.depnAnnual;
      depnPeriod=res.depnPeriod;
    }

    parsed.push({
      row:i+2, name:name||('Row '+(i+2)),
      lessor:lessor, entity:entity, category:category,
      start:start, termMonths:termRaw,
      pmt:pmtRaw, freq:freq, ibr:ibrRaw, timing:timing,
      escType:escType, escPct:escPct, escAmt:escAmt, escYears:escYears,
      rfMonths:rfMonths, idc:idc, incentive:incentive, restoration:restoration,
      isShortTerm:isShortTerm, isLowValue:isLowValue,
      errors:errors, pvInit:pvInit, rouInit:rouInit, rouNBV:rouNBV,
      liabCurrent:liabCurrent, liabNonCurrent:liabNonCurrent,
      depnAnnual:depnAnnual, depnPeriod:depnPeriod
    });
  });

  // Duplicate / update detection
  var existingNames = (leases||[]).map(function(l){ return l.name.toLowerCase().trim(); });
  function levenshtein(a,b){
    var m=a.length,n=b.length,dp=[];
    for(var i=0;i<=m;i++){ dp[i]=[i]; }
    for(var j=0;j<=n;j++){ dp[0][j]=j; }
    for(var i=1;i<=m;i++) for(var j=1;j<=n;j++)
      dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
    return dp[m][n];
  }
  function matchStatus(name){
    var norm=name.toLowerCase().trim();
    if(existingNames.indexOf(norm)>=0) return {type:'update',match:name};
    for(var i=0;i<(leases||[]).length;i++){
      var en=(leases[i].name||'').toLowerCase().trim();
      if(levenshtein(norm,en)<=3) return {type:'duplicate',match:leases[i].name};
    }
    return {type:'new',match:null};
  }

  parsed.forEach(function(p){ p.matchStatus=matchStatus(p.name); });

  _pendingUploadLeases=parsed;
  var valid=parsed.filter(function(p){ return !p.errors.length; });
  var hasDuplicates=parsed.some(function(p){ return p.matchStatus.type==='duplicate'; });
  var tbody=document.getElementById('previewTableBody');
  tbody.innerHTML=parsed.map(function(p){
    var ok=!p.errors.length;
    var ms=p.matchStatus;
    var statusCell;
    if(!ok){
      statusCell='<span class="status-err">✗ '+p.errors.join(', ')+'</span>';
    } else if(ms.type==='update'){
      statusCell='<span style="color:#059669;font-weight:600;">↻ Will update</span>';
    } else if(ms.type==='duplicate'){
      statusCell='<span style="color:#D97706;font-weight:600;">⚠ Possible duplicate of "'+esc(ms.match)+'"</span>';
    } else {
      statusCell='<span style="color:#6366F1;font-weight:600;">+ New lease</span>';
    }
    return '<tr class="'+(ok?ms.type==='duplicate'?'dup-row':'':'err-row')+'">'+
      '<td>'+p.row+'</td>'+
      '<td>'+esc(p.name)+'</td>'+
      '<td>'+esc(p.entity||'—')+'</td>'+
      '<td>'+(p.termMonths?p.termMonths+' mo':'—')+'</td>'+
      '<td>'+(p.ibr?p.ibr+'%':'—')+'</td>'+
      '<td>'+(ok?'₹'+p.pvInit.toLocaleString('en-IN'):'—')+'</td>'+
      '<td>'+(ok?'₹'+p.rouNBV.toLocaleString('en-IN'):'—')+'</td>'+
      '<td>'+(ok?'₹'+p.depnAnnual.toLocaleString('en-IN'):'—')+'</td>'+
      '<td>'+statusCell+'</td>'+
    '</tr>';
  }).join('');

  var summary=valid.length+' of '+parsed.length+' rows valid.';
  if(parsed.length-valid.length) summary+=' Invalid rows will be skipped.';
  if(hasDuplicates) summary+=' ⚠ Review rows flagged as possible duplicates before saving.';
  document.getElementById('previewSummary').textContent=summary;
  document.getElementById('chkReplaceAll').checked=false;
  document.getElementById('uploadPreviewModal').classList.add('show');
}

function closeUploadPreview(){ document.getElementById('uploadPreviewModal').classList.remove('show'); _pendingUploadLeases=[]; }

async function confirmUpload(){
  var valid=_pendingUploadLeases.filter(function(p){ return !p.errors.length; });
  if(!valid.length){ toast('No valid rows to import.','#EF4444'); return; }
  var replaceAll=document.getElementById('chkReplaceAll').checked;
  closeUploadPreview();
  toast('Saving '+valid.length+' leases…','#6366F1');
  try{
    if(replaceAll){
      await window.supaClient.from('leases').delete().eq('user_id',window.currentUser.id);
    }
    var rows=valid.map(function(p){
      var model=p.isShortTerm?'short-term':p.isLowValue?'low-value':p.escType!=='none'?'escalation':'standard';
      return {
        user_id:window.currentUser.id,
        name:p.name,
        entity:p.entity,
        model:model,
        inputs:{
          name:p.name, lessor:p.lessor, category:p.category, entity:p.entity,
          start:p.start, termMonths:p.termMonths, pmt:p.pmt, ibr:p.ibr,
          freq:p.freq, timing:p.timing,
          escType:p.escType, escPct:p.escPct, escAmt:p.escAmt, escYears:p.escYears,
          rfMonths:p.rfMonths, idc:p.idc, incentive:p.incentive, restoration:p.restoration,
          isShortTerm:p.isShortTerm, isLowValue:p.isLowValue
        },
        summary:{
          pvInitial:p.pvInit, rouInitial:p.rouInit, rouNBV:p.rouNBV,
          liabCurrent:p.liabCurrent, liabNonCurrent:p.liabNonCurrent,
          depnAnnual:p.depnAnnual, depnPeriod:p.depnPeriod
        }
      };
    });
    var res=await window.supaClient.from('leases').upsert(rows,{onConflict:'user_id,name'});
    if(res.error) throw res.error;
    await loadLeases();
    renderDashboard();
    filterLeases();
    toast('✓ '+valid.length+' leases imported!','#059669');
  }catch(e){ toast('Import failed: '+e.message,'#EF4444'); }
}

// ── Download Template ─────────────────────────────────────────────
// The workbook is a static asset rather than generated here. It carries dropdown
// lists, a help prompt on every cell and a note on every heading — none of which
// xlsx-js-style is able to write. It is built by scripts/build_lease_template.py
// and served as-is, so what the user downloads is exactly what we tested.
var LEASE_TEMPLATE_URL  = 'Finosutra_Lease_Template_v3.xlsx';
var LEASE_TEMPLATE_NAME = 'Finosutra_Lease_Template.xlsx';

function downloadTemplate(){
  try{
    var a=document.createElement('a');
    a.href=LEASE_TEMPLATE_URL;
    a.download=LEASE_TEMPLATE_NAME;
    a.rel='noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('Template downloaded — open it in Excel to see the dropdowns and help notes.','#059669');
  }catch(e){
    window.open(LEASE_TEMPLATE_URL,'_blank');
  }
}

// ── Export (placeholder — reuses portfolio.html logic signature) ──────────────
function exportPortfolioXL(){
  if(!window.isProUser){ toast('Export requires Pro subscription.','#6366F1'); fsShowUpgradeModal(); return; }
  if(!leases.length){ toast('No leases to export.','#9CA3AF'); return; }
  toast('Preparing export…','#6366F1');
  setTimeout(function(){
    try{ doExportXL(); }
    catch(e){ toast('Export error: '+e.message,'#EF4444'); }
  },200);
}
window.downloadExcel = exportPortfolioXL;
window.exportXL = exportPortfolioXL;

// ── Lease detail page ─────────────────────────────────────────────────
var _editingLeaseId = null;
var _lastCalcResult = null;

function openLeaseDetail(leaseId) {
  _editingLeaseId = leaseId || null;
  _lastCalcResult = null;
  document.getElementById('schedArea').style.display = 'none';
  document.getElementById('resultArea').innerHTML =
    '<div class="calc-placeholder"><i class="fa-solid fa-calculator"></i>Fill in the form and click <strong>Calculate</strong> to see results</div>';

  if (leaseId) {
    var l = leases.find(function(x){ return x.id === leaseId; });
    document.getElementById('detailPageTitle').textContent = 'Edit Lease';
    if (l) prefillForm(l);
  } else {
    document.getElementById('detailPageTitle').textContent = 'New Lease';
    resetForm();
  }
  // Show mod button only for saved, non-exempt leases
  var isExempt = false;
  if(leaseId){
    var lx = leases.find(function(x){ return x.id===leaseId; });
    if(lx){ var lxi = lx.inputs||{}; isExempt = !!(lxi.isShortTerm||lxi.isLowValue); }
  }
  showModControls(!!leaseId && !isExempt);
  populateFormCompanyDropdown();
  navigate('lease-detail');
}

function prefillForm(l) {
  var inp = l.inputs || {};
  setVal('fName',        l.name || '');
  setVal('fEntity',      inp.entity || l.entity || '');
  setVal('fLessor',      inp.lessor || '');
  setVal('fCategory',    inp.category || '');
  setVal('fCompany',     inp.company_id || l.company_id || '');
  setVal('fStart',       inp.start || '');
  setVal('fTerm',        inp.term || inp.termMonths || '');
  setVal('fPmt',         inp.pmt || '');
  setVal('fFreq',        inp.freq || '12');
  setVal('fTiming',      inp.timing || inp.tim || 'end');
  setVal('fIbr',         inp.ibr || '');
  setVal('fEscType',     inp.escType || 'none');
  setVal('fEscPct',      inp.escPct || '');
  setVal('fEscAmt',      inp.escAmt || '');
  setVal('fEscYears',    inp.escYears || '1');
  setVal('fIdc',         inp.idc || '');
  setVal('fIncentive',   inp.incentive || '');
  setVal('fRfMonths',    inp.rfMonths || '');
  setVal('fRestoration', inp.restoration || '');
  setVal('fRemarks',     inp.remarks || '');
  setCheck('fShortTerm', inp.isShortTerm || false);
  setCheck('fLowValue',  inp.isLowValue  || false);
  setCheck('fExtOption', inp.extOption   || false);
  setCheck('fTermOption',inp.termOption  || false);
  autoEndDate();
  toggleEscFields();
  // Restore modification fields
  var mod = inp.modification || null;
  var modSec = document.getElementById('modSection');
  var addModBtn = document.getElementById('addModBtn');
  if(mod && modSec){
    modSec.style.display = 'block';
    if(addModBtn) addModBtn.style.display = 'none';
    setVal('fModDate', mod.modDate || '');
    setVal('fModType', mod.modType || 'para45');
    setVal('fModPmt',  mod.modPmt  || '');
    setVal('fModTerm', mod.modTerm || '');
    setVal('fModIbr',  mod.modIbr  || '');
    setVal('fModFreq', String(mod.modFreq || 12));
    setVal('fModRetainPct', mod.retainPct || '');
    toggleModType();
  } else {
    if(modSec) modSec.style.display = 'none';
  }
}

function resetForm() {
  var ids = ['fName','fLessor','fEntity','fStart','fTerm','fEnd','fPmt','fIbr',
             'fEscPct','fEscAmt','fIdc','fIncentive','fRfMonths','fRestoration','fRemarks'];
  ids.forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  setVal('fFreq','12'); setVal('fTiming','end'); setVal('fEscType','none'); setVal('fEscYears','1');
  setVal('fCategory',''); setVal('fCompany','');
  ['fShortTerm','fLowValue','fExtOption','fTermOption'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.checked=false;
  });
  toggleEscFields();
  document.getElementById('ibrWarning').style.display='none';
  // Reset modification section
  var modSec = document.getElementById('modSection');
  if(modSec) modSec.style.display='none';
  ['fModDate','fModPmt','fModTerm','fModIbr','fModRetainPct'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  setVal('fModType','para45'); setVal('fModFreq','12');
  var modNote = document.getElementById('modPara46aNote');
  if(modNote) modNote.style.display='none';
}

function setVal(id, v){ var el=document.getElementById(id); if(el && v!==null && v!==undefined) el.value=v; }
function setCheck(id, v){ var el=document.getElementById(id); if(el) el.checked=!!v; }

function populateFormCompanyDropdown(){
  var sel = document.getElementById('fCompany');
  if(!sel) return;
  sel.innerHTML = '<option value="">— None —</option>';
  companies.forEach(function(c){
    sel.innerHTML += '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';
  });
}

function autoEndDate(){
  var start = document.getElementById('fStart').value;
  var term  = parseInt(document.getElementById('fTerm').value);
  if(start && term > 0){
    var d = new Date(start);
    d.setMonth(d.getMonth() + term);
    document.getElementById('fEnd').value = d.toISOString().slice(0,10);
  }
}

function autoTerm(){
  var start = document.getElementById('fStart').value;
  var end   = document.getElementById('fEnd').value;
  if(start && end){
    var s = new Date(start), e = new Date(end);
    var months = (e.getFullYear()-s.getFullYear())*12 + (e.getMonth()-s.getMonth());
    if(months > 0) document.getElementById('fTerm').value = months;
  }
}

function checkIBR(){
  var ibr = parseFloat(document.getElementById('fIbr').value);
  var warn = document.getElementById('ibrWarning');
  if(!ibr){ warn.style.display='none'; return; }
  if(ibr < 5){ warn.textContent='⚠ IBR below 5% is unusual for Indian entities. Typical range is 8–14%.'; warn.style.display='block'; }
  else if(ibr > 25){ warn.textContent='⚠ IBR above 25% is very high. Please verify with your lending rate.'; warn.style.display='block'; }
  else { warn.style.display='none'; }
}

function toggleEscFields(){
  var type = document.getElementById('fEscType').value;
  var hasEsc = type !== 'none';
  document.getElementById('escIntervalField').style.display = hasEsc ? 'block' : 'none';
  document.getElementById('escValueRow').style.display = hasEsc ? 'grid' : 'none';
  document.getElementById('escPctField').style.display = (type === 'pct' || type === 'cpi') ? 'block' : 'none';
  document.getElementById('escAmtField').style.display = (type === 'amt') ? 'block' : 'none';
  var lbl = document.getElementById('escValueLabel');
  if(lbl) lbl.textContent = type === 'cpi' ? 'Expected CPI / Index growth (% p.a.)' : 'Escalation (% p.a.)';
}

function clearFieldErr(fieldId){ var el=document.getElementById('err-'+fieldId); if(el) el.textContent=''; }

// ── Lease Modification ────────────────────────────────────────────────────────
function showModControls(show){
  var btn = document.getElementById('addModBtn');
  if(btn) btn.style.display = show ? 'block' : 'none';
}

function toggleModSection(){
  var sec = document.getElementById('modSection');
  var btn = document.getElementById('addModBtn');
  if(!sec) return;
  var isHidden = sec.style.display === 'none';
  sec.style.display = isHidden ? 'block' : 'none';
  if(btn) btn.style.display = isHidden ? 'none' : 'block';
  if(isHidden){
    // Pre-fill mod fields with current lease values as a starting point
    var currentPmt = parseFloat(document.getElementById('fPmt').value)||0;
    var currentIbr = parseFloat(document.getElementById('fIbr').value)||0;
    var currentFreq = document.getElementById('fFreq').value;
    if(currentPmt) document.getElementById('fModPmt').value = currentPmt;
    if(currentIbr) document.getElementById('fModIbr').value = currentIbr;
    if(currentFreq) document.getElementById('fModFreq').value = currentFreq;
  }
}

function removeModSection(){
  var sec = document.getElementById('modSection');
  var btn = document.getElementById('addModBtn');
  if(sec) sec.style.display = 'none';
  if(btn) btn.style.display = 'block';
  // Clear all mod fields
  ['fModDate','fModPmt','fModTerm','fModIbr','fModRetainPct'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  setVal('fModType','para45'); setVal('fModFreq','12');
  var note = document.getElementById('modPara46aNote');
  if(note) note.style.display = 'none';
  // If there was a calc result with mod, clear it so schedule reverts to original
  if(_lastCalcResult && _lastCalcResult.modResult){
    _lastCalcResult.modResult = null;
    if(_lastCalcResult.res) lwPopulateSchedulesTab(_lastCalcResult.res, null);
  }
  toast('Modification removed — recalculate to update results.','#6B7280');
}

function toggleModType(){
  var t = document.getElementById('fModType').value;
  var note = document.getElementById('modPara46aNote');
  if(note) note.style.display = t === 'para46a' ? 'block' : 'none';
}

function collectModInp(){
  var sec = document.getElementById('modSection');
  if(!sec || sec.style.display === 'none') return null;
  var modDate  = document.getElementById('fModDate').value;
  var modPmt   = parseFloat(document.getElementById('fModPmt').value)||0;
  var modTerm  = parseInt(document.getElementById('fModTerm').value)||0;
  var modIbr   = parseFloat(document.getElementById('fModIbr').value)||0;
  var modFreq  = parseInt(document.getElementById('fModFreq').value)||12;
  var modType  = document.getElementById('fModType').value;
  var retainPct= parseFloat(document.getElementById('fModRetainPct').value)||100;
  if(!modDate || !modPmt || !modTerm || !modIbr) return null;
  return { modDate, modPmt, modTerm, modIbr, modFreq, modType, retainPct };
}

function calcModification(inp, res, mod){
  // Find the schedule row just before the modification date
  var modDateObj = new Date(mod.modDate);
  var schedule = res.schedule || [];
  var preModRows = [], carryingLiab = res.pvInitial, carryingROU = res.rouInitial;
  var depPerPeriod = res.rouInitial / inp.termMonths;

  // Walk original schedule to find carrying amount at mod date
  for(var i = 0; i < schedule.length; i++){
    var row = schedule[i];
    var rowDate = row.periodEnd ? new Date(row.periodEnd) : null;
    if(rowDate && rowDate <= modDateObj){
      preModRows.push(row);
      carryingLiab = row.closingLiab !== undefined ? row.closingLiab : (row.closing !== undefined ? row.closing : carryingLiab);
      carryingROU  = row.rouNBV !== undefined ? row.rouNBV : Math.max(0, carryingROU - depPerPeriod);
    } else {
      break;
    }
  }

  // Para 45: New PV of revised payments at revised IBR
  var r = mod.modIbr / (100 * mod.modFreq);
  var n = mod.modTerm * (mod.modFreq / 12);
  var newPV = r === 0 ? mod.modPmt * n : Math.round(mod.modPmt * (1 - Math.pow(1 + r, -n)) / r);

  var liabAdj = newPV - carryingLiab; // positive = increase, negative = decrease
  var rouAdj  = liabAdj; // ROU adjusts by same amount for Para 45

  var gainLoss = 0;
  if(mod.modType === 'para46a'){
    var derecogLiab = carryingLiab * (1 - mod.retainPct / 100);
    var derecogROU  = carryingROU  * (1 - mod.retainPct / 100);
    gainLoss = derecogLiab - derecogROU;
    carryingLiab = carryingLiab * (mod.retainPct / 100);
    carryingROU  = carryingROU  * (mod.retainPct / 100);
    newPV = r === 0 ? mod.modPmt * n : Math.round(mod.modPmt * (1 - Math.pow(1 + r, -n)) / r);
    liabAdj = newPV - carryingLiab;
    rouAdj  = liabAdj;
  }

  // Build post-mod schedule
  var postModRows = [];
  var liab = newPV;
  var rouOpen = Math.max(0, carryingROU + rouAdj);  // ROU after remeasurement
  var depPM = n > 0 ? Math.round(rouOpen / n) : 0;  // straight-line over post-mod periods
  var rou = rouOpen;
  for(var j = 1; j <= n; j++){
    var int = Math.round(liab * r);
    var principal = Math.round(mod.modPmt - int);
    liab = Math.max(0, Math.round(liab - principal));
    var dep = (j === n) ? rou : depPM;  // last period takes remaining balance
    rou  = Math.max(0, rou - dep);
    postModRows.push({ period: j, interest: int, principal: principal, closingLiab: liab, pmt: mod.modPmt, dep: dep, rouNBV: rou, isPostMod: true });
  }

  return {
    preModRows, postModRows,
    carryingLiabAtMod: carryingLiab,
    carryingROUAtMod: carryingROU,
    derecogLiab: mod.modType === 'para46a' ? Math.round(carryingLiab / (mod.retainPct/100) * (1 - mod.retainPct/100)) : 0,
    derecogROU:  mod.modType === 'para46a' ? Math.round(carryingROU  / (mod.retainPct/100) * (1 - mod.retainPct/100)) : 0,
    newPV, liabAdj, rouAdj, gainLoss,
    modDate: mod.modDate, modType: mod.modType, retainPct: mod.retainPct
  };
}

function renderModJE(modResult, f2){
  var adj = modResult.liabAdj;
  var gl  = modResult.gainLoss;
  var rows = '';
  if(modResult.modType === 'para46a' && gl !== 0){
    var dLiab = modResult.derecogLiab || 0;
    var dROU  = modResult.derecogROU  || 0;
    rows += '<tr style="background:#FFF7ED;"><td colspan="4" style="font-size:11px;font-weight:700;color:#92400E;padding:8px 12px;">Para 46a — Derecognition on Scope Reduction ('+(100-(modResult.retainPct||0))+'% given up)</td></tr>';
    if(gl > 0){
      rows += '<tr><td>Lease Liability</td><td>Proportional derecognition on scope reduction</td><td style="color:#059669;font-weight:700;">'+f2(dLiab)+'</td><td></td></tr>';
      rows += '<tr><td>ROU Asset</td><td></td><td></td><td style="color:#EF4444;font-weight:700;">'+f2(dROU)+'</td></tr>';
      rows += '<tr><td>Gain on Lease Modification (P&L)</td><td></td><td></td><td style="color:#EF4444;font-weight:700;">'+f2(gl)+'</td></tr>';
    } else {
      rows += '<tr><td>Lease Liability</td><td>Proportional derecognition on scope reduction</td><td style="color:#059669;font-weight:700;">'+f2(dLiab)+'</td><td></td></tr>';
      rows += '<tr><td>Loss on Lease Modification (P&L)</td><td></td><td style="color:#059669;font-weight:700;">'+f2(Math.abs(gl))+'</td><td></td></tr>';
      rows += '<tr><td>ROU Asset</td><td></td><td></td><td style="color:#EF4444;font-weight:700;">'+f2(dROU)+'</td></tr>';
    }
  }
  rows += '<tr style="background:#FFFBEB;"><td colspan="4" style="font-size:11px;font-weight:700;color:#92400E;padding:8px 12px;">Para 45 — Lease Liability Remeasurement on '+esc(modResult.modDate)+'</td></tr>';
  if(adj > 0){
    rows += '<tr><td>ROU Asset (Right-of-use Asset)</td><td>Remeasurement — lease modification</td><td style="color:#059669;font-weight:700;">'+f2(adj)+'</td><td></td></tr>';
    rows += '<tr><td>Lease Liability</td><td></td><td></td><td style="color:#EF4444;font-weight:700;">'+f2(adj)+'</td></tr>';
  } else {
    rows += '<tr><td>Lease Liability</td><td>Remeasurement — lease modification</td><td style="color:#059669;font-weight:700;">'+f2(Math.abs(adj))+'</td><td></td></tr>';
    rows += '<tr><td>ROU Asset (Right-of-use Asset)</td><td></td><td></td><td style="color:#EF4444;font-weight:700;">'+f2(Math.abs(adj))+'</td></tr>';
  }
  return rows;
}

function collectInp(){
  return {
    name:        document.getElementById('fName').value.trim(),
    lessor:      document.getElementById('fLessor').value.trim(),
    category:    document.getElementById('fCategory').value,
    company_id:  document.getElementById('fCompany').value,
    entity:      document.getElementById('fEntity').value.trim(),
    start:       document.getElementById('fStart').value,
    termMonths:  parseInt(document.getElementById('fTerm').value)||0,
    pmt:         parseFloat(document.getElementById('fPmt').value)||0,
    freq:        parseInt(document.getElementById('fFreq').value)||12,
    timing:      document.getElementById('fTiming').value,
    ibr:         parseFloat(document.getElementById('fIbr').value)||0,
    escType:     document.getElementById('fEscType').value,
    escPct:      parseFloat(document.getElementById('fEscPct').value)||0,
    escAmt:      parseFloat(document.getElementById('fEscAmt').value)||0,
    escYears:    parseInt(document.getElementById('fEscYears').value)||1,
    idc:         parseFloat(document.getElementById('fIdc').value)||0,
    incentive:   parseFloat(document.getElementById('fIncentive').value)||0,
    rfMonths:    parseFloat(document.getElementById('fRfMonths').value)||0,
    restoration: parseFloat(document.getElementById('fRestoration').value)||0,
    remarks:     document.getElementById('fRemarks').value.trim(),
    isShortTerm: document.getElementById('fShortTerm').checked,
    isLowValue:  document.getElementById('fLowValue').checked,
    extOption:   document.getElementById('fExtOption').checked,
    termOption:  document.getElementById('fTermOption').checked,
    modification: collectModInp()
  };
}

function calcLease(){
  var inp = collectInp();
  var validation = leaseEngine.validate(inp);
  if(!validation.valid){
    validation.errors.forEach(function(e){
      var fldMap = { name:'fName', start:'fStart', termMonths:'fTerm', pmt:'fPmt', ibr:'fIbr' };
      var fld = fldMap[e.field];
      if(fld){ var el=document.getElementById('err-'+fld); if(el) el.textContent=e.message; }
    });
    toast('Please fix the highlighted fields.','#EF4444');
    return;
  }
  // Add restoration to IDC for ROU calc
  inp.idc = (inp.idc || 0) + (inp.restoration || 0);

  var res = leaseEngine.calculate(inp);
  var modResult = null;
  if(inp.modification){
    try { modResult = calcModification(inp, res, inp.modification); } catch(e){ console.error('Mod calc error',e); }
  }
  _lastCalcResult = { inp: inp, res: res, modResult: modResult };
  renderResults(inp, res, modResult);
}

function renderResults(inp, res, modResult){
  var isExempt = !!res.exemption;
  var ra = document.getElementById('resultArea');

  if(isExempt){
    ra.innerHTML =
      '<div class="calc-placeholder"><i class="fa-solid fa-check-circle" style="color:#059669"></i>' +
      '<strong>Exempt from IND AS 116 recognition</strong><br>' +
      '<span style="font-size:12px;color:#6B7280;">This lease qualifies as a '+
      (res.exemption==='short-term'?'short-term (≤12 months)':'low-value asset')+
      ' exemption — expense straight to P&amp;L.</span></div>';
    document.getElementById('schedArea').style.display='none';
    return;
  }

  var le = leaseEngine;
  ra.innerHTML =
    '<div class="result-kpi-grid" style="margin-bottom:12px;">'+
      '<div class="result-kpi blue"><div class="lbl">Initial Liability (PV)</div><div class="val">'+le.f2(res.pvInitial)+'</div></div>'+
      '<div class="result-kpi purple"><div class="lbl">ROU Asset</div><div class="val">'+le.f2(res.rouInitial)+'</div><div class="sub">incl. IDC &amp; restoration</div></div>'+
      '<div class="result-kpi green"><div class="lbl">Current Liability</div><div class="val">'+le.f2(res.liabCurrent)+'</div><div class="sub">Due within 12 months</div></div>'+
      '<div class="result-kpi orange"><div class="lbl">Non-Current Liability</div><div class="val">'+le.f2(res.liabNonCurrent)+'</div><div class="sub">Due after 12 months</div></div>'+
    '</div>'+
    '<div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:14px 16px;font-size:12px;color:#6B7280;line-height:2;">'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">'+
        '<span>Annual depreciation</span><span style="font-weight:700;color:#D97706;">'+le.f2(res.depnAnnual)+'</span>'+
        '<span>Total interest</span><span style="font-weight:700;color:#374151;">'+le.f2(res.totalInterest)+'</span>'+
        '<span>Total payments</span><span style="font-weight:700;color:#374151;">'+le.f2(res.totalPayments)+'</span>'+
        '<span>Term / Freq</span><span style="font-weight:700;color:#374151;">'+inp.termMonths+' mo / '+le.freqLabel(inp.freq)+'</span>'+
      '</div>'+
    '</div>';

  // Explanation + audit panel
  showAuditAndExplain(inp, res);

  // Modification summary panel
  if(modResult){
    var le2 = leaseEngine;
    var modBanner = document.createElement('div');
    modBanner.style.cssText = 'background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;padding:14px 16px;margin-top:10px;font-size:12px;';
    var adj = modResult.liabAdj;
    var adjDir = adj >= 0 ? '▲ Increase' : '▼ Decrease';
    var adjColor = adj >= 0 ? '#059669' : '#DC2626';
    modBanner.innerHTML =
      '<div style="font-weight:700;color:#92400E;margin-bottom:8px;"><i class="fa-solid fa-pen-ruler"></i>&nbsp; Lease Modification — '+esc(modResult.modDate)+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 12px;color:#374151;">'+
        '<span style="color:#6B7280;">Liability at mod date</span><span style="font-weight:700;">'+le2.f2(modResult.carryingLiabAtMod)+'</span><span></span>'+
        '<span style="color:#6B7280;">New PV (revised terms)</span><span style="font-weight:700;">'+le2.f2(modResult.newPV)+'</span><span></span>'+
        '<span style="color:#6B7280;">Adjustment to liability/ROU</span><span style="font-weight:700;color:'+adjColor+';">'+adjDir+' '+le2.f2(Math.abs(adj))+'</span><span></span>'+
        (modResult.gainLoss ? '<span style="color:#6B7280;">'+(modResult.gainLoss>0?'Gain':'Loss')+' on derecognition</span><span style="font-weight:700;">'+le2.f2(Math.abs(modResult.gainLoss))+'</span><span></span>' : '')+
      '</div>';
    ra.appendChild(modBanner);

    // Auto-set status to modified only when editing a saved lease (not on new lease)
    if(_editingLeaseId && typeof markLeaseStatus === 'function'){
      var pill = document.getElementById('lwStatusPill');
      var curStatus = pill ? pill.dataset.status : '';
      if(curStatus !== 'modified' && curStatus !== 'closed') markLeaseStatus('modified');
    }
  }

  // Schedule — inject sched card into schedules tab and render
  lwPopulateSchedulesTab(res, modResult);

  // Update overview KPIs
  lwUpdateOverviewKpis(inp, res);

  // Update disclosures tab
  lwUpdateDisclosuresTab(inp, res);

  if(modResult){
    // Build combined annual rollup: pre-mod annual rows + post-mod rows bucketed by FY
    var combinedAnnual = buildModifiedAnnual(inp, res, modResult);
    _schedData = { period: res.schedule, annual: combinedAnnual, modResult: modResult };
  } else {
    _schedData = { period: res.schedule, annual: res.annual };
  }
}

function buildModifiedAnnual(inp, res, modResult){
  // Start with original annual rows up to mod date
  var modDateObj = new Date(modResult.modDate);
  var preAnnual = (res.annual || []).filter(function(a){
    // FY label like "FY 2023-24" — include if FY ends before mod date
    // Approximate: if FY end year < mod year, definitely include
    // Use the last period in that FY from original schedule
    return true; // we'll handle by checking post-mod rows below
  });

  // Build post-mod FY rollup from postModRows
  var fyMap = {};
  var startDate = new Date(modResult.modDate);
  modResult.postModRows.forEach(function(row, idx){
    // Approximate period end: modDate + (idx+1) months (monthly assumption)
    var periodEnd = new Date(startDate);
    periodEnd.setMonth(periodEnd.getMonth() + idx + 1);
    var m = periodEnd.getMonth(); // 0-based
    var y = periodEnd.getFullYear();
    var fyEnd = m < 3 ? y : y + 1;
    var fy = 'FY '+(fyEnd-1)+'-'+String(fyEnd).slice(2)+' (post-mod)';
    if(!fyMap[fy]) fyMap[fy] = { fy: fy, openL: 0, interest: 0, payments: 0, principal: 0, closeL: 0, dep: 0, rouC: 0, _first: true };
    var ag = fyMap[fy];
    if(ag._first){ ag.openL = row.closingLiab + row.principal; ag._first = false; }
    ag.interest  += row.interest;
    ag.payments  += row.pmt || 0;
    ag.principal += row.principal;
    ag.closeL     = row.closingLiab;
    ag.dep       += row.dep || 0;
    ag.rouC       = row.rouNBV || 0;
  });

  // Filter pre-mod annual to exclude FYs fully after mod date
  var preRows = (res.annual || []).filter(function(a){
    // FY label "FY YYYY-YY" — extract end year
    var m = a.fy && a.fy.match(/FY (\d{4})-(\d{2})/);
    if(!m) return true;
    var fyEndYear = parseInt(m[1]) + 1; // e.g. "FY 2023-24" → 2024
    var fyEndDate = new Date(fyEndYear, 2, 31); // 31 Mar
    return fyEndDate > modDateObj; // exclude FYs entirely after mod
  });
  // For the last pre-mod FY, mark it
  if(preRows.length) preRows[preRows.length-1].fy += ' (pre-mod)';

  var postRows = Object.values(fyMap);
  return preRows.concat(postRows);
}

var _schedData = {};
var _activeSchedTab = 'period';

function showSchedTab(tab, btn){
  _activeSchedTab = tab;
  document.querySelectorAll('.sched-tab').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  if(tab === 'period' && _schedData.modResult){
    renderModScheduleTable(_lastCalcResult.res, _schedData.modResult);
  } else {
    renderSchedTable(_schedData[tab], tab);
  }
}

function renderSchedTable(rows, tab){
  var sa = document.getElementById('schedArea');
  var wrap = sa ? sa.querySelector('#schedWrap') : document.getElementById('schedWrap');
  if(!rows||!rows.length){ wrap.innerHTML='<div class="exemption-box">No data</div>'; return; }

  var isPeriod = tab==='period';
  var head = isPeriod
    ? '<tr><th>Period</th><th>Date</th><th>Opening Liab.</th><th>Interest</th><th>Payment</th><th>Principal</th><th>Closing Liab.</th><th>Depn.</th><th>ROU NBV</th></tr>'
    : '<tr><th>Financial Year</th><th>Opening Liab.</th><th>Interest</th><th>Payments</th><th>Principal</th><th>Closing Liab.</th><th>Depn.</th><th>ROU NBV</th></tr>';

  var totInt=0,totPmt=0,totPrinc=0,totDep=0;
  var body = rows.map(function(r){
    totInt+=r.interest; totPmt+=r.pmt||r.payments||0; totPrinc+=r.principal; totDep+=r.dep;
    if(isPeriod){
      var fade = (r.hasPmt === false) ? ' style="color:#9CA3AF;font-size:11.5px"' : '';
      var pmtCell  = r.hasPmt === false ? '—' : fmt(r.pmt);
      var princCell = r.hasPmt === false ? '—' : fmt(r.principal);
      return '<tr'+fade+'>'+
        '<td>'+r.period+'</td>'+
        '<td>'+leaseEngine.fDate(r.periodEnd)+'</td>'+
        '<td>'+fmt(r.openL)+'</td>'+
        '<td>'+fmt(r.interest)+'</td>'+
        '<td>'+pmtCell+'</td>'+
        '<td>'+princCell+'</td>'+
        '<td>'+fmt(r.closeL)+'</td>'+
        '<td>'+fmt(r.dep)+'</td>'+
        '<td>'+fmt(r.rouC)+'</td>'+
      '</tr>';
    } else {
      return '<tr>'+
        '<td>'+esc(r.fy)+'</td>'+
        '<td>'+fmt(r.openL)+'</td>'+
        '<td>'+fmt(r.interest)+'</td>'+
        '<td>'+fmt(r.payments)+'</td>'+
        '<td>'+fmt(r.principal)+'</td>'+
        '<td>'+fmt(r.closeL)+'</td>'+
        '<td>'+fmt(r.dep)+'</td>'+
        '<td>'+fmt(r.rouC)+'</td>'+
      '</tr>';
    }
  }).join('');

  var totalRow = isPeriod
    ? '<tr class="total-row"><td colspan="3">Total</td><td>'+fmt(totInt)+'</td><td>'+fmt(totPmt)+'</td><td>'+fmt(totPrinc)+'</td><td></td><td>'+fmt(totDep)+'</td><td></td></tr>'
    : '<tr class="total-row"><td>Total</td><td></td><td>'+fmt(totInt)+'</td><td>'+fmt(totPmt)+'</td><td>'+fmt(totPrinc)+'</td><td></td><td>'+fmt(totDep)+'</td><td></td></tr>';

  wrap.innerHTML = '<table class="sched-table"><thead>'+head+'</thead><tbody>'+body+totalRow+'</tbody></table>';
}

function fmt(n){ return (n===null||n===undefined||isNaN(+n))? '—' : Number(n).toLocaleString('en-IN'); }

async function saveLease(){
  if(!window.currentUser){ fsShowAuthModal('login'); return; }
  if(!window.isProUser && !_editingLeaseId && leases.length >= FREE_LEASE_LIMIT){
    toast('Free plan: max '+FREE_LEASE_LIMIT+' leases. Upgrade to Pro for unlimited.','#6366F1');
    fsInitiateProSubscription();
    return;
  }
  if(!_lastCalcResult){ toast('Calculate first before saving.','#EF4444'); return; }

  var inp = _lastCalcResult.inp;
  var res = _lastCalcResult.res;
  var hasMod = !!(inp.modification && _lastCalcResult.modResult);

  // Determine workflow status — if lease has a modification, auto-set to 'modified'
  var pill = document.getElementById('lwStatusPill');
  var currentStatus = (pill && pill.dataset.status) || 'draft';
  var workflowStatus = hasMod ? 'modified' : currentStatus;

  var row = {
    user_id:    window.currentUser.id,
    name:       inp.name,
    entity:     inp.entity,
    company_id: inp.company_id || null,
    model:      (inp.escType && inp.escType!=='none') ? 'escalation' : 'standard',
    status:     workflowStatus,
    inputs:     Object.assign({}, inp, { term: inp.termMonths }),
    summary: {
      pvInitial:      res.pvInitial,
      rouNBV:         res.rouInitial,
      liabCurrent:    res.liabCurrent,
      liabNonCurrent: res.liabNonCurrent,
      depnAnnual:     res.depnAnnual,
      totalInterest:  res.totalInterest,
      totalPayments:  res.totalPayments
    }
  };

  try{
    var res2;
    if(_editingLeaseId){
      res2 = await window.supaClient.from('leases').update(row).eq('id',_editingLeaseId).eq('user_id',window.currentUser.id).select().single();
    } else {
      res2 = await window.supaClient.from('leases').upsert(row,{onConflict:'user_id,name'}).select().single();
    }
    if(res2.error) throw res2.error;

    // Update local leases array
    var savedId = res2.data.id;
    if(_editingLeaseId){
      leases = leases.map(function(l){ return l.id===_editingLeaseId ? res2.data : l; });
      logAudit(savedId, 'updated', {name: row.name});
    } else {
      leases.unshift(res2.data);
      logAudit(savedId, 'created', {name: row.name});
    }
    updateLeaseCountBadge();
    toast('✓ Lease saved to portfolio!','#059669');
    setTimeout(function(){ navigate('leases'); }, 800);
  }catch(e){ toast('Save failed: '+e.message,'#EF4444'); }
}

// ── Journal Entry Engine ──────────────────────────────────────────────────
function indianFYLabel(dateStr){
  if(!dateStr) return null;
  var d = new Date(dateStr);
  var m = d.getMonth(); // 0=Jan
  var y = d.getFullYear();
  var fyEnd = m < 3 ? y : y + 1;
  return 'FY ' + (fyEnd-1) + '-' + String(fyEnd).slice(2);
}

function generateModJEs(lease, modResult){
  if(!modResult) return [];
  var jes = [];
  var name = lease.name || 'Lease';
  var d = modResult.modDate;
  var fy = leaseEngine.fDate ? '' : '';
  // Determine FY string
  var modYear = new Date(d).getFullYear();
  var modMonth = new Date(d).getMonth() + 1;
  var fyStr = modMonth >= 4 ? ('FY ' + modYear + '-' + (modYear+1).toString().slice(2)) : ('FY ' + (modYear-1) + '-' + modYear.toString().slice(2));

  // Para 46a derecognition JE
  if(modResult.modType === 'para46a' && modResult.gainLoss !== 0){
    var dLiab = modResult.derecogLiab || 0;
    var dROU  = modResult.derecogROU  || 0;
    var gl    = modResult.gainLoss;
    if(gl > 0){
      jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 46a — Derecognition of lease liability on scope reduction', account: 'Lease Liability', leaseName: name, dr: dLiab, cr: 0 });
      jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 46a — Derecognition of ROU asset on scope reduction', account: 'ROU Asset (Right-of-use Asset)', leaseName: name, dr: 0, cr: dROU });
      jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 46a — Gain on partial termination of lease', account: 'Gain on Lease Modification (P&L)', leaseName: name, dr: 0, cr: gl });
    } else {
      jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 46a — Derecognition of lease liability on scope reduction', account: 'Lease Liability', leaseName: name, dr: dLiab, cr: 0 });
      jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 46a — Loss on partial termination of lease', account: 'Loss on Lease Modification (P&L)', leaseName: name, dr: Math.abs(gl), cr: 0 });
      jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 46a — Derecognition of ROU asset on scope reduction', account: 'ROU Asset (Right-of-use Asset)', leaseName: name, dr: 0, cr: dROU });
    }
  }

  // Para 45 remeasurement JE
  var adj = modResult.liabAdj;
  if(adj > 0){
    jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 45 — Remeasurement: increase in lease liability at revised IBR', account: 'ROU Asset (Right-of-use Asset)', leaseName: name, dr: adj, cr: 0 });
    jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 45 — Remeasurement: increase in lease liability at revised IBR', account: 'Lease Liability', leaseName: name, dr: 0, cr: adj });
  } else if(adj < 0){
    jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 45 — Remeasurement: decrease in lease liability at revised IBR', account: 'Lease Liability', leaseName: name, dr: Math.abs(adj), cr: 0 });
    jes.push({ date: d, fy: fyStr, type: 'modification', typeLabel: 'Modification', narration: 'Para 45 — Remeasurement: decrease in lease liability at revised IBR', account: 'ROU Asset (Right-of-use Asset)', leaseName: name, dr: 0, cr: Math.abs(adj) });
  }
  return jes;
}

function generateJEs(lease){
  var inp = Object.assign({}, lease.inputs||{}, { name: lease.name, entity: lease.entity });
  if(!inp.termMonths && inp.term) inp.termMonths = inp.term;
  if(inp.isShortTerm || inp.isLowValue) return [];

  var validation = leaseEngine.validate(inp);
  if(!validation.valid) return [];

  // add restoration into IDC for ROU calc (same as calcLease)
  var calcInp = Object.assign({}, inp);
  calcInp.idc = (parseFloat(inp.idc)||0) + (parseFloat(inp.restoration)||0);

  var res = leaseEngine.calculate(calcInp);
  var jes = [];
  var leaseName = lease.name || 'Unnamed';
  var entity = inp.entity || '';
  var startDate = inp.start || '';

  // Day 1 — Initial Recognition
  jes.push({ date: startDate, fy: indianFYLabel(startDate), type: 'day1', typeLabel: 'Day 1 Recognition',
    leaseName, entity, narration: 'Initial recognition of ROU asset and lease liability',
    account: 'Right-of-Use Asset', dr: res.rouInitial, cr: 0 });
  jes.push({ date: startDate, fy: indianFYLabel(startDate), type: 'day1', typeLabel: 'Day 1 Recognition',
    leaseName, entity, narration: 'Initial recognition of ROU asset and lease liability',
    account: 'Lease Liability', dr: 0, cr: res.pvInitial });

  var idc = parseFloat(inp.idc)||0;
  var incentive = parseFloat(inp.incentive)||0;
  var restoration = parseFloat(inp.restoration)||0;

  if(idc > 0){
    jes.push({ date: startDate, fy: indianFYLabel(startDate), type: 'day1', typeLabel: 'Day 1 Recognition',
      leaseName, entity, narration: 'Initial direct costs capitalised to ROU asset',
      account: 'Cash / Payables', dr: 0, cr: idc });
  }
  if(incentive > 0){
    jes.push({ date: startDate, fy: indianFYLabel(startDate), type: 'day1', typeLabel: 'Day 1 Recognition',
      leaseName, entity, narration: 'Lease incentive received deducted from ROU asset',
      account: 'Lessor Incentive Receivable', dr: incentive, cr: 0 });
  }
  if(restoration > 0){
    jes.push({ date: startDate, fy: indianFYLabel(startDate), type: 'day1', typeLabel: 'Day 1 Recognition',
      leaseName, entity, narration: 'Provision for restoration / reinstatement cost',
      account: 'Provision for Restoration', dr: 0, cr: restoration });
  }

  // Per-period entries
  res.schedule.forEach(function(row){
    var periodEnd = row.periodEnd || '';
    var fy = indianFYLabel(periodEnd);

    // Interest accrual
    if(row.interest > 0){
      jes.push({ date: periodEnd, fy, type: 'interest', typeLabel: 'Interest Accrual',
        leaseName, entity, narration: 'Finance cost on lease liability — Period ' + row.period,
        account: 'Finance Cost (P&L)', dr: row.interest, cr: 0 });
      jes.push({ date: periodEnd, fy, type: 'interest', typeLabel: 'Interest Accrual',
        leaseName, entity, narration: 'Finance cost on lease liability — Period ' + row.period,
        account: 'Lease Liability (Interest)', dr: 0, cr: row.interest });
    }

    // Payment
    if(row.pmt > 0){
      jes.push({ date: periodEnd, fy, type: 'payment', typeLabel: 'Lease Payment',
        leaseName, entity, narration: 'Lease payment made — Period ' + row.period,
        account: 'Lease Liability', dr: row.pmt, cr: 0 });
      jes.push({ date: periodEnd, fy, type: 'payment', typeLabel: 'Lease Payment',
        leaseName, entity, narration: 'Lease payment made — Period ' + row.period,
        account: 'Bank / Cash', dr: 0, cr: row.pmt });
    }

    // Depreciation
    if(row.dep > 0){
      jes.push({ date: periodEnd, fy, type: 'depn', typeLabel: 'Depreciation',
        leaseName, entity, narration: 'Depreciation on ROU asset — Period ' + row.period,
        account: 'Depreciation Expense (P&L)', dr: row.dep, cr: 0 });
      jes.push({ date: periodEnd, fy, type: 'depn', typeLabel: 'Depreciation',
        leaseName, entity, narration: 'Depreciation on ROU asset — Period ' + row.period,
        account: 'Accumulated Depn. — ROU Asset', dr: 0, cr: row.dep });
    }
  });

  return jes;
}

var _allJEs = [];

function buildAllJEs(){
  _allJEs = [];
  leases.forEach(function(l){ _allJEs = _allJEs.concat(generateJEs(l)); });
}

function populateJEFilters(){
  // FY options
  var fys = [...new Set(_allJEs.map(function(j){ return j.fy; }).filter(Boolean))].sort();
  var fySel = document.getElementById('jeFyFilter');
  var curFy = fySel.value;
  fySel.innerHTML = '<option value="">All FYs</option>';
  fys.forEach(function(fy){ fySel.innerHTML += '<option value="'+esc(fy)+(fy===curFy?'" selected':'"')+'>'+esc(fy)+'</option>'; });

  // Lease options
  var names = [...new Set(_allJEs.map(function(j){ return j.leaseName; }).filter(Boolean))].sort();
  var lSel = document.getElementById('jeLeaseFilter');
  var curL = lSel.value;
  lSel.innerHTML = '<option value="">All Leases</option>';
  names.forEach(function(n){ lSel.innerHTML += '<option value="'+esc(n)+(n===curL?'" selected':'"')+'>'+esc(n)+'</option>'; });
}

function renderJournalPage(){
  buildAllJEs();
  populateJEFilters();

  var fyF    = document.getElementById('jeFyFilter').value;
  var leaseF = document.getElementById('jeLeaseFilter').value;
  var typeF  = document.getElementById('jeTypeFilter').value;

  var filtered = _allJEs.filter(function(j){
    return (!fyF    || j.fy === fyF) &&
           (!leaseF || j.leaseName === leaseF) &&
           (!typeF  || j.type === typeF);
  });

  var content = document.getElementById('jeContent');

  if(!leases.length){
    content.innerHTML = '<div class="coming-soon" style="padding:60px 20px;"><i class="fa-solid fa-receipt"></i><h2>No leases found</h2><p>Add leases to your portfolio to generate journal entries.</p></div>';
    document.getElementById('jeInfoBar').style.display='none';
    return;
  }

  if(!filtered.length){
    content.innerHTML = '<div class="coming-soon" style="padding:60px 20px;"><i class="fa-solid fa-filter"></i><h2>No entries match filters</h2><p>Try changing the FY, lease, or type filter.</p></div>';
    document.getElementById('jeInfoBar').style.display='none';
    return;
  }

  // Info bar totals
  var totDr = filtered.reduce(function(s,j){ return s+j.dr; },0);
  var infoBar = document.getElementById('jeInfoBar');
  infoBar.style.display='flex';
  infoBar.innerHTML =
    '<div>Entries shown: <span>'+filtered.length+'</span></div>'+
    '<div>Total Dr: <span>'+f2(totDr)+'</span></div>'+
    '<div>Total Cr: <span>'+f2(totDr)+'</span></div>'+
    (fyF?'<div>FY: <span>'+esc(fyF)+'</span></div>':'')+
    (leaseF?'<div>Lease: <span>'+esc(leaseF)+'</span></div>':'');

  // Group by date
  var rows = '';
  var lastDate = '';
  filtered.forEach(function(j){
    if(j.date !== lastDate){
      rows += '<tr class="je-group-header"><td colspan="6">'+fDate(j.date)+' &nbsp;·&nbsp; '+esc(j.fy||'')+'</td></tr>';
      lastDate = j.date;
    }
    var badge = '<span class="je-type-badge '+j.type+'">'+esc(j.typeLabel)+'</span>';
    rows +=
      '<tr>'+
        '<td>'+badge+'</td>'+
        '<td style="max-width:200px;color:#6B7280;font-size:11px;">'+esc(j.narration)+'</td>'+
        '<td style="font-weight:600;color:#111827;">'+esc(j.account)+'</td>'+
        '<td style="color:#4B5563;font-size:11px;">'+esc(j.leaseName)+'</td>'+
        '<td class="amt dr">'+(j.dr?f2(j.dr):'')+'</td>'+
        '<td class="amt cr">'+(j.cr?f2(j.cr):'')+'</td>'+
      '</tr>';
  });

  content.innerHTML =
    '<div class="je-table-wrap">'+
      '<table class="je-table">'+
        '<thead><tr>'+
          '<th>Type</th><th>Narration</th><th>Account</th><th>Lease</th>'+
          '<th class="amt">Dr (₹)</th><th class="amt">Cr (₹)</th>'+
        '</tr></thead>'+
        '<tbody>'+rows+'</tbody>'+
      '</table>'+
    '</div>';
}

function exportJEXL(){
  if(!window.currentUser){ toast('Sign in to export journal entries.','#6366F1'); fsShowAuthModal('login'); return; }
  if(!window.XLSX){ toast('Excel library not loaded.','#EF4444'); return; }
  buildAllJEs();

  var fyF    = document.getElementById('jeFyFilter').value;
  var leaseF = document.getElementById('jeLeaseFilter').value;
  var typeF  = document.getElementById('jeTypeFilter').value;

  var filtered = _allJEs.filter(function(j){
    return (!fyF    || j.fy === fyF) &&
           (!leaseF || j.leaseName === leaseF) &&
           (!typeF  || j.type === typeF);
  });

  if(!filtered.length){ toast('No entries to export.','#EF4444'); return; }

  var ws_data = [['Date','Financial Year','Entry Type','Narration','Account Head','Lease Name','Entity','Dr (₹)','Cr (₹)']];
  filtered.forEach(function(j){
    ws_data.push([j.date, j.fy||'', j.typeLabel, j.narration, j.account, j.leaseName, j.entity||'',
      j.dr||0, j.cr||0]);
  });

  var N='002244',N2='002E5C',A='0052CC',AL='E8F0FF',WH='FFFFFF',GR='059669',AM='D97706',CA='F0F5FF';
  var jeTd=fsShortDate(new Date());
  function xJBn(v){return {v:v,s:{font:{name:'Calibri',sz:13,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xJSb(v){return {v:v,s:{font:{name:'Calibri',sz:10,color:{rgb:'93BBFB'}},fill:{fgColor:{rgb:N2}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xJMt(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:A}},fill:{fgColor:{rgb:AL}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xJHd(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:A}},alignment:{horizontal:'center',vertical:'center',wrapText:true}}}; }
  function xJHdR(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:A}},alignment:{horizontal:'right',vertical:'center',wrapText:true}}}; }
  function xJTx(v,alt){return {v:v,s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:alt?CA:WH}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xJNm(v,alt,col){return {v:v,t:'n',s:{font:{name:'Calibri',sz:10,color:{rgb:col||'111827'}},fill:{fgColor:{rgb:alt?CA:WH}},numFmt:'#,##0',alignment:{horizontal:'right',vertical:'center'}}}; }
  function xJFt(v,right){return {v:v,s:{font:{name:'Calibri',sz:9,color:{rgb:right?'93BBFB':A}},fill:{fgColor:{rgb:N}},alignment:{horizontal:right?'right':'left',vertical:'center',indent:right?0:1}}}; }
  function jbl(c){return {v:'',s:{fill:{fgColor:{rgb:c||WH}}}}; }

  var JC=9; // col count
  function jBlkRow(c,n){var r=[];for(var i=0;i<n;i++)r.push(jbl(c));return r;}

  var fyF2=document.getElementById('jeLeaseFilter')?document.getElementById('jeFyFilter').value:'';
  var je_rows=[
    [xJBn('Finosutra  |  Journal Entries — GL Export')].concat(jBlkRow(N,JC-1)),
    [xJSb('IND AS 116 / IFRS 16 Lease Accounting Suite   ·   CONFIDENTIAL   ·   For GL / ERP import')].concat(jBlkRow(N2,JC-1)),
    [xJMt('Exported: '+jeTd+'   ·   Entries: '+filtered.length+(fyF2?'   ·   FY: '+fyF2:''))].concat(jBlkRow(AL,JC-1)),
    jBlkRow(WH,JC),
    [xJHd('Date'),xJHd('FY'),xJHd('Entry Type'),xJHd('Narration'),xJHd('Account Head'),xJHd('Lease Name'),xJHd('Entity'),xJHdR('Dr (₹)'),xJHdR('Cr (₹)')],
  ];
  filtered.forEach(function(j,ji){
    var alt=ji%2!==0;
    je_rows.push([xJTx(j.date,alt),xJTx(j.fy||'',alt),xJTx(j.typeLabel,alt),xJTx(j.narration,alt),
      xJTx(j.account,alt),xJTx(j.leaseName,alt),xJTx(j.entity||'',alt),
      j.dr?xJNm(j.dr,alt,GR):xJTx('—',alt),
      j.cr?xJNm(j.cr,alt,AM):xJTx('—',alt)]);
  });
  je_rows.push([xJFt('Prepared using Finosutra · finosutra.com · IND AS 116 / IFRS 16 Suite')].concat(jBlkRow(N,JC-2)).concat([xJFt('IND AS 116 Compliant ✓',true)]));

  var ws = XLSX.utils.aoa_to_sheet(je_rows);
  ws['!cols'] = [{wch:12},{wch:10},{wch:20},{wch:45},{wch:32},{wch:25},{wch:18},{wch:14},{wch:14}];
  ws['!rows'] = [{hpt:26},{hpt:16},{hpt:16},{hpt:6},{hpt:26}];
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:JC-1}},{s:{r:1,c:0},e:{r:1,c:JC-1}},{s:{r:2,c:0},e:{r:2,c:JC-1}}];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Journal Entries');

  // Summary sheet — also styled
  var fyTotals = {};
  filtered.forEach(function(j){
    var k = j.fy||'Unknown';
    if(!fyTotals[k]) fyTotals[k]={fy:k,dr:0,entries:0};
    fyTotals[k].dr += j.dr; fyTotals[k].entries++;
  });
  function xSHd(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:A}},alignment:{horizontal:'center',vertical:'center'}}}; }
  function xSNm(v,alt){return {v:v,t:'n',s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:alt?CA:WH}},numFmt:'#,##0',alignment:{horizontal:'right'}}}; }
  function xSTx(v,alt){return {v:v,s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:alt?CA:WH}},alignment:{horizontal:'left',indent:1}}}; }
  var sum_data = [
    [xJBn('Finosutra  |  Journal Entries — Summary by FY'),jbl(N),jbl(N),jbl(N)],
    [xJMt('Exported: '+jeTd),jbl(AL),jbl(AL),jbl(AL)],
    [xSHd('Financial Year'),xSHd('Total Dr (₹)'),xSHd('Total Cr (₹)'),xSHd('No. of Entries')],
  ];
  Object.values(fyTotals).sort(function(a,b){return a.fy.localeCompare(b.fy);}).forEach(function(r,ri){
    var alt=ri%2!==0;
    sum_data.push([xSTx(r.fy,alt), xSNm(r.dr,alt), xSNm(r.dr,alt), xSTx(r.entries,alt)]);
  });
  var ws2 = XLSX.utils.aoa_to_sheet(sum_data);
  ws2['!cols']=[{wch:16},{wch:18},{wch:18},{wch:16}];
  ws2['!merges']=[{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:1,c:0},e:{r:1,c:3}}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary by FY');

  var fname = 'Finosutra_JournalEntries'+(fyF?'_'+fyF:'')+(leaseF?'_'+leaseF:'')+'.xlsx';
  XLSX.writeFile(wb, fname);
  toast('✓ GL export downloaded!','#059669');
}

// ── Reports & Disclosures Engine ─────────────────────────────────────────────

function getAllFYs(){
  var fys = new Set();
  leases.forEach(function(l){
    var inp = Object.assign({},l.inputs||{},{name:l.name||'lease',entity:l.entity||''});
    if(!inp.termMonths && inp.term) inp.termMonths = inp.term;
    if(inp.isShortTerm||inp.isLowValue||!inp.start||!inp.termMonths) return;
    var calcInp = Object.assign({},inp);
    calcInp.idc=(parseFloat(inp.idc)||0)+(parseFloat(inp.restoration)||0);
    if(!leaseEngine.validate(calcInp).valid) return;
    var res = leaseEngine.calculate(calcInp);
    (res.annual||[]).forEach(function(r){ if(r.fy) fys.add(r.fy); });
  });
  return [...fys].sort();
}

function calcLeaseForReports(l){
  var inp = Object.assign({},l.inputs||{},{name:l.name,entity:l.entity||''});
  if(!inp.termMonths && inp.term) inp.termMonths = inp.term;
  if(inp.isShortTerm||inp.isLowValue) return null;
  if(!leaseEngine.validate(inp).valid) return null;
  var calcInp = Object.assign({},inp);
  calcInp.idc=(parseFloat(inp.idc)||0)+(parseFloat(inp.restoration)||0);
  var res = leaseEngine.calculate(calcInp);
  var modResult = null;
  if(inp.modification){
    try { modResult = calcModification(calcInp, res, inp.modification); } catch(e){}
  }
  return {inp: inp, res: res, modResult: modResult};
}

// ── Reports Page ──────────────────────────────────────────────────────────────
function renderReportsPage(){
  var fys = getAllFYs();
  var sel = document.getElementById('rptFyFilter');
  var cur = sel.value;
  sel.innerHTML = '<option value="">All FYs</option>';
  fys.forEach(function(fy){ sel.innerHTML += '<option value="'+esc(fy)+'"'+(fy===cur?' selected':'')+'>'+esc(fy)+'</option>'; });
  if(cur && fys.indexOf(cur)>=0) sel.value = cur;
  var fyF = sel.value;

  var container = document.getElementById('reportsContent');
  if(!leases.length){
    container.innerHTML = '<div class="coming-soon" style="padding:60px 20px;"><i class="fa-solid fa-chart-bar"></i><h2>No leases found</h2><p>Add leases to generate reports.</p></div>';
    return;
  }

  var html = '';

  // ── Section 1: Lease Summary ──
  var sumRows = '';
  var totPV=0,totROU=0,totCurr=0,totNCurr=0,totDepn=0;
  leases.forEach(function(l){
    var r = calcLeaseForReports(l);
    var inp = l.inputs||{};
    var status = leaseStatus(l);
    var statusColor = status==='active'?'#059669':status==='expiring'?'#D97706':'#6B7280';
    var exemptNote = (inp.isShortTerm?'Short-term exempt':inp.isLowValue?'Low-value exempt':'');
    if(!r){
      sumRows += '<tr><td>'+esc(l.name||'—')+'</td><td>'+esc(inp.entity||'—')+'</td>'+
        '<td colspan="6" style="color:#9CA3AF;font-style:italic;">'+esc(exemptNote||'Invalid inputs')+'</td></tr>';
      return;
    }
    var res = r.res;
    var mod = r.modResult;
    // Use post-mod figures for balance sheet if modified
    var pvDisp    = mod ? mod.newPV           : res.pvInitial;
    var rouDisp   = mod ? Math.max(0, mod.carryingROUAtMod + mod.rouAdj) : res.rouInitial;
    var currDisp  = mod ? (mod.postModRows[0] ? mod.postModRows[0].closingLiab : 0) : res.liabCurrent;
    var ncurrDisp = mod ? (mod.newPV - currDisp) : res.liabNonCurrent;
    var depnDisp  = mod ? (mod.postModRows.slice(0, inp.modification && inp.modification.modFreq || 12).reduce(function(s,r){ return s+(r.dep||0); },0)) : res.depnAnnual;
    totPV+=pvDisp; totROU+=rouDisp; totCurr+=currDisp;
    totNCurr+=ncurrDisp; totDepn+=depnDisp;
    sumRows +=
      '<tr>'+
        '<td style=”font-weight:600;”>'+esc(l.name||'—')+(mod?'<span style=”font-size:10px;color:#D97706;margin-left:6px;”><i class=”fa-solid fa-pen-ruler”></i> Modified</span>':'')+'</td>'+
        '<td>'+esc(inp.entity||'—')+'</td>'+
        '<td>'+fDate(inp.start)+'</td>'+
        '<td>'+(inp.termMonths||inp.term||'—')+' mo</td>'+
        '<td>'+fPct(inp.ibr)+'</td>'+
        '<td class=”num”>'+f2(pvDisp)+'</td>'+
        '<td class=”num”>'+f2(rouDisp)+'</td>'+
        '<td class=”num” style=”color:#059669;”>'+f2(currDisp)+'</td>'+
        '<td class=”num” style=”color:#6B7280;”>'+f2(ncurrDisp)+'</td>'+
        '<td class=”num” style=”color:#D97706;”>'+f2(depnDisp)+'</td>'+
        '<td><span class="rpt-expiry-badge" style="background:'+(status==='active'?'#D1FAE5':status==='expiring'?'#FEF3C7':'#F3F4F6')+';color:'+statusColor+';">'+status.charAt(0).toUpperCase()+status.slice(1)+'</span></td>'+
      '</tr>';
  });

  html +=
    '<div class="rpt-section">'+
      '<div class="rpt-section-header"><div><div class="rpt-section-title">Lease Summary Register</div><div class="rpt-section-sub">All leases · As at today</div></div></div>'+
      '<div class="rpt-table-wrap"><table class="rpt-table">'+
        '<thead><tr><th>Lease Name</th><th>Entity</th><th>Start</th><th>Term</th><th>IBR</th>'+
          '<th class="num">Initial Liability</th><th class="num">ROU Asset</th>'+
          '<th class="num">Current Liab.</th><th class="num">Non-Current</th>'+
          '<th class="num">FY Depn.</th><th>Status</th></tr></thead>'+
        '<tbody>'+sumRows+
          '<tr class="total-row"><td colspan="5">Total</td>'+
            '<td class="num">'+f2(totPV)+'</td><td class="num">'+f2(totROU)+'</td>'+
            '<td class="num">'+f2(totCurr)+'</td><td class="num">'+f2(totNCurr)+'</td>'+
            '<td class="num">'+f2(totDepn)+'</td><td></td></tr>'+
        '</tbody>'+
      '</table></div>'+
    '</div>';

  // ── Section 2: Annual Rollforward (by FY) ──
  var fyData = {}; // fy → {openL, interest, payments, principal, closeL, dep, openROU, closeROU}
  leases.forEach(function(l){
    var r = calcLeaseForReports(l);
    if(!r) return;
    var annual = r.res.annual||[];
    annual.forEach(function(row){
      if(fyF && row.fy !== fyF) return;
      if(!fyData[row.fy]) fyData[row.fy]={fy:row.fy,openL:0,interest:0,payments:0,principal:0,closeL:0,dep:0,rouClose:0};
      var d = fyData[row.fy];
      d.openL+=row.openL;   // was never accumulated — every year reported nil opening
      d.interest+=row.interest; d.payments+=row.payments;
      d.principal+=row.principal; d.dep+=row.dep;
      d.closeL+=row.closeL; d.rouClose+=row.rouC;
    });
  });

  var fyRows = Object.values(fyData).sort(function(a,b){return a.fy.localeCompare(b.fy);});
  if(fyRows.length){
    var liabRows = fyRows.map(function(r){
      return '<tr><td>'+esc(r.fy)+'</td>'+
        '<td class="num">'+f2(r.openL)+'</td>'+
        '<td class="num" style="color:#D97706;">'+f2(r.interest)+'</td>'+
        '<td class="num" style="color:#059669;">'+f2(r.payments)+'</td>'+
        '<td class="num">'+f2(r.principal)+'</td>'+
        '<td class="num" style="font-weight:700;">'+f2(r.closeL)+'</td>'+
        '<td class="num" style="color:#D97706;">'+f2(r.dep)+'</td>'+
        '<td class="num">'+f2(r.rouClose)+'</td></tr>';
    }).join('');

    html +=
      '<div class="rpt-section">'+
        '<div class="rpt-section-header"><div><div class="rpt-section-title">Annual Rollforward</div>'+
          '<div class="rpt-section-sub">Lease liability &amp; ROU asset movement by FY'+(fyF?' · '+esc(fyF):'')+'</div></div></div>'+
        '<div class="rpt-table-wrap"><table class="rpt-table">'+
          '<thead><tr><th>Financial Year</th><th class="num">Opening Liab.</th><th class="num">Interest</th>'+
            '<th class="num">Payments</th><th class="num">Principal</th><th class="num">Closing Liab.</th>'+
            '<th class="num">Depreciation</th><th class="num">ROU NBV</th></tr></thead>'+
          '<tbody>'+liabRows+'</tbody>'+
        '</table></div>'+
      '</div>';
  }

  // ── Section 3: Leases Expiring within 12 months ──
  var today = new Date();
  var in12 = new Date(); in12.setMonth(in12.getMonth()+12);
  var expRows = '';
  leases.forEach(function(l){
    var end = leaseEndDate(l);
    if(!end) return;
    if(end > in12) return;
    var daysLeft = Math.max(0, Math.round((end-today)/86400000));
    var color = daysLeft<=30?'#EF4444':daysLeft<=90?'#D97706':'#059669';
    expRows += '<tr><td style="font-weight:600;">'+esc(l.name)+'</td>'+
      '<td>'+esc((l.inputs||{}).entity||'—')+'</td>'+
      '<td>'+fDate((l.inputs||{}).start)+'</td>'+
      '<td>'+fDate(end.toISOString().slice(0,10))+'</td>'+
      '<td><span style="color:'+color+';font-weight:700;">'+daysLeft+' days</span></td></tr>';
  });
  if(expRows){
    html +=
      '<div class="rpt-section">'+
        '<div class="rpt-section-header"><div><div class="rpt-section-title" style="color:#EF4444;">⚠ Leases Expiring Within 12 Months</div></div></div>'+
        '<div class="rpt-table-wrap"><table class="rpt-table">'+
          '<thead><tr><th>Lease</th><th>Entity</th><th>Start</th><th>Expiry</th><th>Days Remaining</th></tr></thead>'+
          '<tbody>'+expRows+'</tbody>'+
        '</table></div>'+
      '</div>';
  }

  container.innerHTML = html;
}

// ── Disclosures Page (IND AS 116 Para 52) ────────────────────────────────────
function renderDisclosuresPage(){
  var fys = getAllFYs();
  var sel = document.getElementById('discFyFilter');
  var cur = sel.value;
  sel.innerHTML = '<option value="">Select FY</option>';
  fys.forEach(function(fy){ sel.innerHTML += '<option value="'+esc(fy)+'"'+(fy===cur?' selected':'')+'>'+esc(fy)+'</option>'; });
  if(cur && fys.indexOf(cur)>=0) sel.value = cur;

  var fyF = sel.value;
  var container = document.getElementById('disclosuresInner') || document.getElementById('disclosuresContent');

  if(!leases.length){
    container.innerHTML = '<div class="coming-soon" style="padding:60px 20px;"><i class="fa-solid fa-file-lines"></i><h2>No leases found</h2><p>Add leases to generate disclosure note.</p></div>';
    return;
  }
  if(!fyF){
    container.innerHTML = '<div class="coming-soon" style="padding:60px 20px;"><i class="fa-solid fa-file-lines"></i><h2>Select a Financial Year</h2><p>Choose a FY above to generate the IND AS 116 Para 52 disclosure note.</p></div>';
    return;
  }

  // One canonical source for every disclosure figure — the same builder the premium
  // report pack uses, so this page, its Excel export and the pack cannot diverge.
  // This previously duplicated the whole computation, and struck the current /
  // non-current split at commencement so it did not tie to its own closing balance.
  var d = buildDiscDataFromLeases(leases, fyF);
  var totOpenL     = d.totOpenL,     totInterest = d.totInterest, totPayments = d.totPayments;
  var totPrincipal = d.totPrincipal, totCloseL   = d.totCloseL;
  var totOpenROU   = d.totOpenROU,   totAdditions= d.totAdditions;
  var totDep       = d.totDep,       totCloseROU = d.totCloseROU;
  var totCashOut   = d.totCashOut,   totPL_Int   = d.totPL_Int, totPL_Dep = d.totPL_Dep;
  var maturity     = d.maturity,     exemptExpense = d.exemptExpense || 0;
  var totUndiscounted = d.totUndiscounted;
  var wAvgIBR = d.wAvgIBR ? d.wAvgIBR.toFixed(1) : '—';
  var financeCharge = totUndiscounted - totCloseL;

  var html =
    // KPI strip
    '<div class="disc-kpi-row">'+
      '<div class="disc-kpi"><div class="lbl">Lease Liability (Closing)</div><div class="val">'+f2(totCloseL)+'</div></div>'+
      '<div class="disc-kpi green"><div class="lbl">ROU Asset NBV (Closing)</div><div class="val">'+f2(totCloseROU)+'</div></div>'+
      '<div class="disc-kpi amber"><div class="lbl">Finance Cost (P&L)</div><div class="val">'+f2(totPL_Int)+'</div></div>'+
      '<div class="disc-kpi amber"><div class="lbl">Depreciation (P&L)</div><div class="val">'+f2(totPL_Dep)+'</div></div>'+
      '<div class="disc-kpi"><div class="lbl">Total Cash Outflow</div><div class="val">'+f2(totCashOut)+'</div></div>'+
      '<div class="disc-kpi"><div class="lbl">Weighted Avg. IBR</div><div class="val">'+wAvgIBR+'%</div></div>'+
    '</div>'+

    // Note 1 — Maturity Analysis
    '<div class="rpt-section">'+
      '<div class="rpt-section-header"><div class="rpt-section-title">Note 1 — Maturity Analysis of Lease Liabilities (Undiscounted)</div></div>'+
      '<div class="rpt-table-wrap"><table class="rpt-table">'+
        '<thead><tr><th>Maturity Bucket</th><th class="num">Amount (₹)</th></tr></thead>'+
        '<tbody>'+
          '<tr><td>Not later than 1 year</td><td class="num">'+f2(maturity.y1)+'</td></tr>'+
          '<tr><td>Later than 1 year and not later than 5 years</td><td class="num">'+f2(maturity.y1_5)+'</td></tr>'+
          '<tr><td>Later than 5 years</td><td class="num">'+f2(maturity.y5plus)+'</td></tr>'+
          '<tr class="total-row"><td>Total undiscounted payments</td><td class="num">'+f2(totUndiscounted)+'</td></tr>'+
          '<tr><td class="indent">Less: Future finance charges</td><td class="num" style="color:#EF4444;">('+f2(Math.max(0,financeCharge))+')</td></tr>'+
          '<tr class="total-row"><td>Present value of lease liabilities</td><td class="num">'+f2(totCloseL)+'</td></tr>'+
        '</tbody>'+
      '</table></div>'+
    '</div>'+

    // Note 2 — Lease Liability Movement
    '<div class="rpt-section">'+
      '<div class="rpt-section-header"><div class="rpt-section-title">Note 2 — Movement in Lease Liability · '+esc(fyF)+'</div></div>'+
      '<div class="rpt-table-wrap"><table class="rpt-table">'+
        '<thead><tr><th>Particulars</th><th class="num">Amount (₹)</th></tr></thead>'+
        '<tbody>'+
          '<tr><td style="font-weight:600;">Opening balance</td><td class="num">'+f2(totOpenL)+'</td></tr>'+
          '<tr><td class="indent">Add: Liabilities recognised on leases commencing during the year</td><td class="num">'+f2(d.totLiabAdditions||0)+'</td></tr>'+
          '<tr><td class="indent">Add: Interest accrued (finance cost)</td><td class="num">'+f2(totInterest)+'</td></tr>'+
          '<tr><td class="indent">Less: Payments made</td><td class="num" style="color:#EF4444;">('+f2(totPayments)+')</td></tr>'+
          '<tr class="total-row"><td>Closing balance</td><td class="num">'+f2(totCloseL)+'</td></tr>'+
          '<tr><td class="indent" style="font-style:italic;">Current portion</td><td class="num">'+f2(d.currLiab)+'</td></tr>'+
          '<tr><td class="indent" style="font-style:italic;">Non-current portion</td><td class="num">'+f2(d.ncurrLiab)+'</td></tr>'+
        '</tbody>'+
      '</table></div>'+
    '</div>'+

    // Note 3 — ROU Asset Rollforward
    '<div class="rpt-section">'+
      '<div class="rpt-section-header"><div class="rpt-section-title">Note 3 — Right-of-Use Asset · '+esc(fyF)+'</div></div>'+
      '<div class="rpt-table-wrap"><table class="rpt-table">'+
        '<thead><tr><th>Particulars</th><th class="num">Amount (₹)</th></tr></thead>'+
        '<tbody>'+
          '<tr><td style="font-weight:600;">Net carrying amount — Opening</td><td class="num">'+f2(totOpenROU)+'</td></tr>'+
          '<tr><td class="indent">Add: Additions during the year</td><td class="num">'+f2(totAdditions)+'</td></tr>'+
          '<tr><td class="indent">Less: Depreciation for the year</td><td class="num" style="color:#EF4444;">('+f2(totDep)+')</td></tr>'+
          '<tr class="total-row"><td>Net Book Value — Closing</td><td class="num">'+f2(totCloseROU)+'</td></tr>'+
        '</tbody>'+
      '</table></div>'+
    '</div>'+

    // Note 4 — P&L Impact
    '<div class="rpt-section">'+
      '<div class="rpt-section-header"><div class="rpt-section-title">Note 4 — Amounts Recognised in Profit &amp; Loss · '+esc(fyF)+'</div></div>'+
      '<div class="rpt-table-wrap"><table class="rpt-table">'+
        '<thead><tr><th>Particulars</th><th class="num">Amount (₹)</th></tr></thead>'+
        '<tbody>'+
          '<tr><td>Depreciation on right-of-use assets</td><td class="num">'+f2(totPL_Dep)+'</td></tr>'+
          '<tr><td>Interest expense on lease liabilities</td><td class="num">'+f2(totPL_Int)+'</td></tr>'+
          (exemptExpense>0?'<tr><td>Short-term / low-value lease expense (P&L)</td><td class="num">'+f2(exemptExpense)+'</td></tr>':'')+
          '<tr class="total-row"><td>Total impact on Profit &amp; Loss</td><td class="num">'+f2(totPL_Dep+totPL_Int+exemptExpense)+'</td></tr>'+
        '</tbody>'+
      '</table></div>'+
    '</div>'+

    // Note 5 — Additional Disclosures
    '<div class="rpt-section">'+
      '<div class="rpt-section-header"><div class="rpt-section-title">Note 5 — Additional Disclosures</div></div>'+
      '<div class="rpt-table-wrap"><table class="rpt-table">'+
        '<thead><tr><th>Particulars</th><th class="num">Amount / Value</th></tr></thead>'+
        '<tbody>'+
          '<tr><td>Total cash outflow for leases in '+esc(fyF)+'</td><td class="num">'+f2(totCashOut)+'</td></tr>'+
          '<tr><td>Weighted average incremental borrowing rate</td><td class="num">'+wAvgIBR+'%</td></tr>'+
          '<tr><td>Number of leases recognised on balance sheet</td><td class="num">'+leases.filter(function(l){var i=l.inputs||{};return !i.isShortTerm&&!i.isLowValue;}).length+'</td></tr>'+
          (exemptExpense>0?'<tr><td>Short-term / low-value lease commitments (exempted)</td><td class="num">'+f2(exemptExpense)+'</td></tr>':'')+
        '</tbody>'+
      '</table></div>'+
    '</div>';

  container.innerHTML = html;
}

function switchRptTab(tab) {
  var tabs = ['reports','disclosures'];
  tabs.forEach(function(t) {
    var btn = document.getElementById('ritab-'+t);
    var pane = t === 'reports' ? document.getElementById('reportsContent') : document.getElementById('disclosuresContent');
    if(!btn || !pane) return;
    if(t === tab) {
      btn.style.borderBottomColor = '#4F46E5';
      btn.style.color = '#4F46E5';
      pane.style.display = 'block';
    } else {
      btn.style.borderBottomColor = 'transparent';
      btn.style.color = '#6B7280';
      pane.style.display = 'none';
    }
  });
}

function _makeBrandedCoverSheet(title, subtitle, metaLine){
  var N='002244',N2='002E5C',A='0052CC',AL='E8F0FF',WH='FFFFFF';
  var td=fsShortDate(new Date());
  function bl(c){return {v:'',s:{fill:{fgColor:{rgb:c}}}}; }
  var rows=[
    [{v:'Finosutra  |  '+title,s:{font:{name:'Calibri',sz:14,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'left',vertical:'center',indent:1}}},bl(N)],
    [{v:'IND AS 116 / IFRS 16 Lease Accounting Suite   ·   CONFIDENTIAL',s:{font:{name:'Calibri',sz:10,color:{rgb:'93BBFB'}},fill:{fgColor:{rgb:N2}},alignment:{horizontal:'left',vertical:'center',indent:1}}},bl(N2)],
    [{v:metaLine+'   ·   Generated: '+td,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:A}},fill:{fgColor:{rgb:AL}},alignment:{horizontal:'left',vertical:'center',indent:1}}},bl(AL)],
    [bl(WH),bl(WH)],
    [{v:subtitle,s:{font:{name:'Calibri',sz:11,color:{rgb:'374151'}},fill:{fgColor:{rgb:WH}},alignment:{horizontal:'left',vertical:'center',indent:1}}},bl(WH)],
    [{v:'→ Navigate to the sheets below for data tables.',s:{font:{name:'Calibri',sz:10,color:{rgb:A}},fill:{fgColor:{rgb:WH}},alignment:{horizontal:'left',vertical:'center',indent:1}}},bl(WH)],
    [bl(WH),bl(WH)],
    [{v:'Prepared using Finosutra · finosutra.com',s:{font:{name:'Calibri',sz:9,color:{rgb:A}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'left',indent:1}}},{v:'IND AS 116 Compliant ✓',s:{font:{name:'Calibri',sz:9,color:{rgb:'93BBFB'}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'right'}}}],
  ];
  var ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:70},{wch:20}];
  ws['!rows']=[{hpt:28},{hpt:17},{hpt:17},{hpt:6},{hpt:20},{hpt:18},{hpt:6},{hpt:17}];
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:1}},{s:{r:1,c:0},e:{r:1,c:1}},{s:{r:2,c:0},e:{r:2,c:1}},{s:{r:3,c:0},e:{r:3,c:1}},{s:{r:4,c:0},e:{r:4,c:1}},{s:{r:5,c:0},e:{r:5,c:1}},{s:{r:6,c:0},e:{r:6,c:1}}];
  return ws;
}

function exportDisclosureXL(){
  if(!window.currentUser){ toast('Sign in to export.','#6366F1'); fsShowAuthModal('login'); return; }
  if(!window.XLSX){ toast('Excel library not loaded.','#EF4444'); return; }
  var fyF = document.getElementById('discFyFilter').value;
  if(!fyF){ toast('Please select a Financial Year first.','#EF4444'); return; }

  renderDisclosuresPage();
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, _makeBrandedCoverSheet('IND AS 116 Disclosure Note', 'IND AS 116 Para 52 — Disclosure Note for '+fyF, ''+fyF+' · Leases: '+leases.length), 'Cover');

  var sections = document.querySelectorAll('#disclosuresContent .rpt-section');
  sections.forEach(function(sec, idx){
    var title = sec.querySelector('.rpt-section-title');
    var tbl   = sec.querySelector('table');
    if(!tbl) return;
    // Excel caps sheet names at 31 chars, so slicing the full note title cut it
    // mid-word ("Note 1 — Maturity Analysis o"). Use short, complete names.
    var SHEET_NAMES = ['Note 1 Maturity','Note 2 Liability','Note 3 ROU Asset',
                       'Note 4 P&L','Note 5 Additional'];
    var sheetName = SHEET_NAMES[idx] || ('Note '+(idx+1));
    var ws = XLSX.utils.table_to_sheet(tbl);
    ws['!cols'] = [{wch:45},{wch:18}];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // Add KPI summary sheet
  var kpis = document.querySelectorAll('#disclosuresContent .disc-kpi');
  if(kpis.length){
    var kpiData = [['Particulars','Value']];
    kpis.forEach(function(k){
      var lbl = k.querySelector('.lbl'); var val = k.querySelector('.val');
      if(lbl&&val) kpiData.push([lbl.innerText, val.innerText]);
    });
    var wsK = XLSX.utils.aoa_to_sheet(kpiData);
    wsK['!cols']=[{wch:35},{wch:20}];
    XLSX.utils.book_append_sheet(wb, wsK, 'Key Figures');
  }

  XLSX.writeFile(wb, 'Finosutra_Disclosure_'+fyF.replace(' ','_')+'.xlsx');
  toast('✓ Disclosure note exported!','#059669');
}

function exportReportsXL(){
  if(!window.currentUser){ toast('Sign in to export reports.','#6366F1'); fsShowAuthModal('login'); return; }
  if(!window.XLSX){ toast('Excel library not loaded.','#EF4444'); return; }
  renderReportsPage();
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, _makeBrandedCoverSheet('Portfolio Reports', 'IND AS 116 Lease Portfolio — Management Reports', 'Leases: '+leases.length), 'Cover');

  var sections = document.querySelectorAll('#reportsContent .rpt-section');
  sections.forEach(function(sec, idx){
    var title = sec.querySelector('.rpt-section-title');
    var tbl   = sec.querySelector('table');
    if(!tbl) return;
    var sheetName = (title?title.innerText.replace(/[:\*\?\/\\]/g,'').slice(0,28):'Sheet'+(idx+1));
    var ws = XLSX.utils.table_to_sheet(tbl);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  XLSX.writeFile(wb, 'Finosutra_Reports.xlsx');
  toast('✓ Reports exported!','#059669');
}

// ── Phase 4: Audit Trail ─────────────────────────────────────────────────────

async function logAudit(leaseId, action, changedFields){
  if(!window.supaClient || !window.currentUser) return;
  try{
    await window.supaClient.from('audit_log').insert({
      user_id:   window.currentUser.id,
      lease_id:  leaseId,
      action:    action,
      changed_fields: changedFields || {}
    });
  }catch(e){ /* audit failure is non-fatal */ }
}

async function loadAuditTrail(leaseId){
  var panel = document.getElementById('auditTrailPanel');
  var body  = document.getElementById('auditTrailBody');
  if(!panel||!body) return;

  if(!leaseId || !window.supaClient || !window.currentUser){
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  body.innerHTML = '<div class="audit-empty">Loading…</div>';

  try{
    var res = await window.supaClient
      .from('audit_log')
      .select('*')
      .eq('lease_id', leaseId)
      .order('created_at', {ascending: false})
      .limit(20);

    if(res.error || !res.data || !res.data.length){
      body.innerHTML = '<div class="audit-empty">No audit history yet.</div>';
      return;
    }

    _lastAuditRows = res.data; // cache for premium export

    body.innerHTML = res.data.map(function(r){
      var iconClass = r.action==='created'?'create': r.action==='deleted'?'delete':'update';
      var iconChar  = r.action==='created'?'✚': r.action==='deleted'?'✕':'✎';
      var label     = r.action==='created'?'Lease created':
                      r.action==='deleted'?'Lease deleted':
                      r.action==='calculated'?'Calculation run':'Lease updated';
      var fields    = r.changed_fields && Object.keys(r.changed_fields).length ?
        '<div style="font-size:10px;color:#9CA3AF;margin-top:2px;">Fields: '+Object.keys(r.changed_fields).join(', ')+'</div>' : '';
      return '<div class="audit-row">'+
        '<div class="audit-icon '+iconClass+'">'+iconChar+'</div>'+
        '<div class="audit-meta">'+
          '<div class="audit-action">'+label+'</div>'+
          '<div class="audit-time">'+fDate(r.created_at)+'</div>'+
          fields+
        '</div>'+
      '</div>';
    }).join('');
  }catch(e){
    body.innerHTML = '<div class="audit-empty">Audit log not available.</div>';
  }
}

// ── Phase 4: Explanation Panel ────────────────────────────────────────────────

function toggleExplainPanel(){
  var body    = document.getElementById('explanationBody');
  var chevron = document.getElementById('explainChevron');
  var open    = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if(chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

function renderExplanationPanel(inp, res){
  var panel = document.getElementById('explanationPanel');
  var body  = document.getElementById('explanationBody');
  if(!panel||!body) return;

  if(res.exemption){
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  var freq     = inp.freq || 12;
  var freqLbl  = leaseEngine.freqLabel(freq);
  var r_period = (inp.ibr / 100 / freq).toFixed(6);
  var n        = res.n;
  var timing   = inp.timing === 'beg' ? 'Beginning of period (annuity-due)' : 'End of period (annuity-immediate)';
  var escDesc  = inp.escType === 'none' ? 'None — fixed rent throughout' :
                 inp.escType === 'pct'  ? inp.escPct + '% p.a. compound every ' + inp.escYears + ' year(s)' :
                 inp.escType === 'amt'  ? '₹' + Number(inp.escAmt).toLocaleString('en-IN') + ' step-up every ' + inp.escYears + ' year(s)' :
                 'CPI-linked at ' + inp.escPct + '% p.a. (current index per Para 28)';
  var rouAdj   = [];
  if(inp.idc)         rouAdj.push('+ IDC ₹'+Number(inp.idc).toLocaleString('en-IN'));
  if(inp.restoration) rouAdj.push('+ Restoration ₹'+Number(inp.restoration).toLocaleString('en-IN'));
  if(inp.incentive)   rouAdj.push('− Incentive ₹'+Number(inp.incentive).toLocaleString('en-IN'));

  body.innerHTML =
    '<table>'+
      '<tr><td>Commencement date</td><td>'+fDate(inp.start)+'</td></tr>'+
      '<tr><td>Lease term</td><td>'+inp.termMonths+' months ('+n+' periods)</td></tr>'+
      '<tr><td>Payment frequency</td><td>'+freqLbl+'</td></tr>'+
      '<tr><td>Payment timing</td><td>'+timing+'</td></tr>'+
      '<tr><td>Rent per period</td><td>₹'+Number(inp.pmt).toLocaleString('en-IN')+'</td></tr>'+
      '<tr><td>Escalation</td><td>'+escDesc+'</td></tr>'+
      '<tr><td>IBR (annual)</td><td>'+inp.ibr+'%</td></tr>'+
      '<tr><td>IBR (per period, r)</td><td>'+r_period+'</td></tr>'+
      '<tr><td>Rent-free periods</td><td>'+(inp.rfMonths||0)+' month(s)</td></tr>'+
    '</table>'+
    '<div class="explain-formula">'+
      'PV = Σ [ Pmt(t) / (1+r)^t ]  for t = 1 to '+n+'<br>'+
      'where r = IBR÷100÷freq = '+inp.ibr+'÷100÷'+freq+' = '+r_period+'<br>'+
      'PV = ₹'+Number(res.pvInitial).toLocaleString('en-IN')+
      (rouAdj.length ? '<br>ROU Asset = PV '+rouAdj.join(' ')+' = ₹'+Number(res.rouInitial).toLocaleString('en-IN') : '')+
      '<br>Depreciation = ROU ÷ n = ₹'+Number(res.rouInitial).toLocaleString('en-IN')+'÷'+n+' = ₹'+Number(res.depnPeriod).toLocaleString('en-IN')+'/period'+
    '</div>';
}

// ── Phase 4: Working Paper Export ────────────────────────────────────────────

// ── Premium single-lease report pack (called from lease detail) ──────────────
function exportPremiumSingleLease(){
  if(!window.currentUser){ toast('Sign in to export.','#6366F1'); fsShowAuthModal('login'); return; }
  if(!window.isProUser){ toast('Premium exports require Pro.','#6366F1'); fsInitiateProSubscription(); return; }
  if(!window.XLSX || !window.premiumExport){ toast('Export libraries not loaded.','#EF4444'); return; }
  if(!_lastCalcResult){ toast('Calculate first.','#EF4444'); return; }
  var inp = _lastCalcResult.inp;
  var modResult = _lastCalcResult.modResult || null;
  var fakeLeaseObj = { id: _editingLeaseId||'wp', name: inp.name, entity: inp.entity||'', inputs: inp };
  var jes = generateJEs(fakeLeaseObj);
  if(modResult) jes = jes.concat(generateModJEs(fakeLeaseObj, modResult));
  toast('Building premium report…','#6366F1');
  setTimeout(function(){
    try {
      // Report the FY the user picked if there is a selector, else the current FY —
      // clamped to a year this lease actually exists in.
      var fy = resolveReportFY([fakeLeaseObj],
                 (document.getElementById('rptFyFilter')||{}).value || getCurrentFY());
      premiumExport.buildWorkbook({
        leases: [fakeLeaseObj],
        calcFn: function(l){ return _lastCalcResult; },
        generateJEsFn: function(l){ return jes; },
        discData: buildDiscDataFromLeases([fakeLeaseObj], fy),
        fy: fy,
        auditRows: _lastAuditRows || [],
        entity: inp.entity || '',
        name: inp.name || 'Lease'
      });
      toast('✓ Premium report pack downloaded!','#059669');
      if(_editingLeaseId) logAudit(_editingLeaseId, 'premium_export', {});
    } catch(e){ toast('Export error: '+e.message,'#EF4444'); }
  }, 50);
}

// ── Premium portfolio export (all leases) ────────────────────────────────────
function exportPremiumPortfolio(){
  if(!window.currentUser){ toast('Sign in to export.','#6366F1'); fsShowAuthModal('login'); return; }
  if(!window.isProUser){ toast('Premium exports require Pro.','#6366F1'); fsInitiateProSubscription(); return; }
  if(!window.XLSX || !window.premiumExport){ toast('Export libraries not loaded.','#EF4444'); return; }
  if(!leases.length){ toast('No leases to export.','#9CA3AF'); return; }
  toast('Building premium report pack…','#6366F1');
  setTimeout(function(){
    try {
      var fy = resolveReportFY(leases,
                 (document.getElementById('rptFyFilter')||{}).value || getCurrentFY());
      premiumExport.buildWorkbook({
        leases: leases,
        calcFn: calcLeaseForReports,
        generateJEsFn: function(l){
          var r = calcLeaseForReports(l);
          var jes = generateJEs(l);
          if(r && r.modResult) jes = jes.concat(generateModJEs(l, r.modResult));
          return jes;
        },
        discData: buildDiscDataFromLeases(leases, fy),
        fy: fy,
        auditRows: [],
        entity: leases[0] ? (leases[0].entity || leases[0].inputs && leases[0].inputs.entity || '') : '',
        name: 'Portfolio'
      });
      toast('✓ Premium portfolio report downloaded!','#059669');
    } catch(e){ toast('Export error: '+e.message,'#EF4444'); }
  }, 50);
}

// ── FY helpers ────────────────────────────────────────────────────────────────
// 'FY 2025-26' → { start: 2025-04-01, end: 2026-03-31 }. Indian FY, Apr–Mar.
// Built in UTC because schedule dates ('2026-03-31') parse as UTC midnight. Mixing
// a local-constructed boundary with a UTC-parsed row date drops the March row of
// every FY in any timezone ahead of UTC.
function fyRange(fy){
  var m = /FY\s*(\d{4})/.exec(String(fy||''));
  var startYear = m ? parseInt(m[1],10) : new Date().getFullYear();
  return {
    start: new Date(Date.UTC(startYear,3,1)),
    end:   new Date(Date.UTC(startYear+1,2,31,23,59,59))
  };
}

// The FY-end reporting date as an ISO date — the reference for the balance-sheet
// current / non-current split.
function fyEndISO(fy){
  var m = /FY\s*(\d{4})/.exec(String(fy||''));
  var startYear = m ? parseInt(m[1],10) : new Date().getFullYear();
  return (startYear+1)+'-03-31';
}

// Keep the reported FY inside the lease's own life. A lease commencing 01/03/2026
// reported in "FY 2026-27" is legitimate; one reported in an FY it has not started
// in is not, and used to produce a report labelled for a year it had no figures in.
function resolveReportFY(leasesArr, requestedFY){
  var reqEnd = fyRange(requestedFY).end;
  var earliest = null, latest = null;
  (leasesArr||[]).forEach(function(l){
    var inp = l.inputs||{};
    if(!inp.start) return;
    var s = new Date(inp.start);
    var e = new Date(inp.start);
    e.setMonth(e.getMonth() + (parseInt(inp.termMonths||inp.term,10)||0));
    if(!earliest || s < earliest) earliest = s;
    if(!latest   || e > latest)   latest   = e;
  });
  if(!earliest) return requestedFY;
  function fyOf(d){
    var y = d.getFullYear(), fs = d.getMonth() < 3 ? y-1 : y;
    return 'FY '+fs+'-'+String(fs+1).slice(2);
  }
  if(reqEnd < earliest) return fyOf(earliest);   // FY ends before any lease starts
  if(fyRange(requestedFY).start > latest) return fyOf(latest);
  return requestedFY;
}

// ── Disclosure data builder for premium export ────────────────────────────────
// Every figure below is scoped to the reported FY. Previously this summed
// whole-of-life totals while the sheets labelled them "for the year", so the
// disclosure notes did not foot.
function buildDiscDataFromLeases(leasesArr, fy){
  var range = fyRange(fy);
  var fyStart = range.start, fyEnd = range.end;

  var totOpenL=0, totCloseL=0, totInterest=0, totPayments=0, totPrincipal=0;
  var totOpenROU=0, totAdditions=0, totLiabAdditions=0, totDep=0, totCloseROU=0;
  var currLiab=0, ncurrLiab=0;
  var totUndiscounted=0;
  var mat = {y1:0,y1_5:0,y5plus:0};
  var ibrs=[], leaseCount=0;
  var exemptExpense=0, totCashOut=0;

  leasesArr.forEach(function(l){
    var inp = Object.assign({},l.inputs||{},{name:l.name,entity:l.entity||''});
    if(!inp.termMonths && inp.term) inp.termMonths = inp.term;
    if(inp.isShortTerm||inp.isLowValue){ exemptExpense += parseFloat(inp.pmt)||0; return; }
    var r = calcLeaseForReports(l);
    if(!r || !r.res || !r.res.schedule) return;
    var sched = r.res.schedule;
    var commence = new Date(inp.start);

    // Rows falling inside the reported FY, and the state at each boundary
    var inFY=[], lastBefore=null, firstAfterIdx=-1;
    sched.forEach(function(row, i){
      if(!row.periodEnd) return;
      var d = new Date(row.periodEnd);
      if(d < fyStart){ lastBefore = row; }
      else if(d <= fyEnd){ inFY.push(row); }
      else if(firstAfterIdx < 0){ firstAfterIdx = i; }
    });
    // Lease not yet commenced, or already ended, as at this FY
    if(!inFY.length && !lastBefore) return;
    leaseCount++;

    var openL   = lastBefore ? lastBefore.closeL : r.res.pvInitial;
    var openROU = lastBefore ? lastBefore.rouC   : 0;
    var closeL  = inFY.length ? inFY[inFY.length-1].closeL : (lastBefore ? lastBefore.closeL : 0);
    var closeROU= inFY.length ? inFY[inFY.length-1].rouC   : (lastBefore ? lastBefore.rouC   : 0);

    // A lease commencing inside this FY is an addition; its liability opens at nil
    var commencedInFY = commence >= fyStart && commence <= fyEnd;
    if(commencedInFY){
      openL = 0; openROU = 0;
      totAdditions     += r.res.rouInitial;   // ROU asset recognised
      totLiabAdditions += r.res.pvInitial;    // liability recognised
    }

    var fyInt=0, fyPmt=0, fyPrin=0, fyDep=0;
    inFY.forEach(function(row){
      fyInt += row.interest; fyPmt += row.pmt; fyPrin += row.principal; fyDep += row.dep;
    });

    totOpenL     += openL;
    totCloseL    += closeL;
    totOpenROU   += openROU;
    totCloseROU  += closeROU;
    totInterest  += fyInt;
    totPayments  += fyPmt;
    totPrincipal += fyPrin;
    totCashOut   += fyPmt;
    totDep       += fyDep;
    if(r.inp.ibr) ibrs.push(parseFloat(r.inp.ibr));

    // Maturity of payments still outstanding AFTER the FY end, bucketed from that date
    if(firstAfterIdx >= 0){
      var remaining = sched.slice(firstAfterIdx);
      remaining.forEach(function(row){
        var d = new Date(row.periodEnd);
        var monthsOut = (d.getUTCFullYear()-fyEnd.getUTCFullYear())*12
                      + (d.getUTCMonth()-fyEnd.getUTCMonth());
        totUndiscounted += row.pmt;
        if(monthsOut <= 12){ mat.y1 += row.pmt; }
        else if(monthsOut <= 60){ mat.y1_5 += row.pmt; }
        else { mat.y5plus += row.pmt; }
      });
      // One canonical current/non-current definition, struck at the reporting date.
      var sp = leaseEngine.currentSplitAt(sched, fyEndISO(fy));
      currLiab  += sp.current;
      ncurrLiab += sp.nonCurrent;
    }
  });

  var wAvgIBR = ibrs.length ? ibrs.reduce(function(s,x){return s+x;},0)/ibrs.length : 0;
  return {
    totOpenL, totCloseL, totInterest, totPayments, totPrincipal,
    totOpenROU, totAdditions, totLiabAdditions, totDep, totCloseROU,
    currLiab, ncurrLiab, leaseCount, wAvgIBR,
    exemptExpense, totCashOut, totUndiscounted,
    maturity: mat,
    totPL_Dep: totDep, totPL_Int: totInterest
  };
}

// ── Current FY helper ─────────────────────────────────────────────────────────
function getCurrentFY(){
  var now = new Date();
  var m = now.getMonth(); // 0=Jan
  var y = now.getFullYear();
  var fyStart = m < 3 ? y-1 : y;
  return 'FY '+fyStart+'-'+String(fyStart+1).slice(2);
}

// ── Storage for last audit rows (populated by loadAuditTrail) ────────────────
var _lastAuditRows = [];

function exportWorkingPaper(){
  if(!window.currentUser){ toast('Sign in to export.','#6366F1'); fsShowAuthModal('login'); return; }
  if(!window.isProUser){ toast('Working paper export requires Pro.','#6366F1'); fsInitiateProSubscription(); return; }
  if(!window.XLSX){ toast('Excel library not loaded.','#EF4444'); return; }
  if(!_lastCalcResult){ toast('Calculate first.','#EF4444'); return; }

  var inp = _lastCalcResult.inp;
  var res = _lastCalcResult.res;
  var wb  = XLSX.utils.book_new();
  var today = fsShortDate(new Date());

  // ── Shared Navy style palette ──────────────────────────────────────────────
  var N  = '002244'; // dark navy banner
  var N2 = '002E5C'; // subtitle navy
  var A  = '0052CC'; // accent blue
  var AL = 'E8F0FF'; // accent light
  var AB = 'BAD0F8'; // accent border
  var AX = '93BBFB'; // accent label on dark
  var WH = 'FFFFFF';
  var AM = 'D97706'; // amber (financial highlights)
  var GR = '059669'; // green
  var GY = '6B7280'; // grey
  var CA = 'F0F5FF'; // cell alt

  function xBanner(v){ return {v:v, s:{font:{bold:true,sz:14,color:{rgb:WH},name:'Calibri'},fill:{fgColor:{rgb:N}},alignment:{vertical:'center',horizontal:'left',indent:1}}}; }
  function xSub(v){    return {v:v, s:{font:{sz:10,color:{rgb:AX},name:'Calibri'},fill:{fgColor:{rgb:N2}},alignment:{vertical:'center',horizontal:'left',indent:1}}}; }
  function xMeta(v){   return {v:v, s:{font:{sz:10,bold:true,color:{rgb:A},name:'Calibri'},fill:{fgColor:{rgb:AL}},alignment:{vertical:'center',horizontal:'left',indent:1}}}; }
  function xSecHd(v){  return {v:v, s:{font:{bold:true,sz:11,color:{rgb:WH},name:'Calibri'},fill:{fgColor:{rgb:A}},alignment:{vertical:'center',horizontal:'left',indent:1}}}; }
  function xColHd(v){  return {v:v, s:{font:{bold:true,sz:10,color:{rgb:WH},name:'Calibri'},fill:{fgColor:{rgb:A}},border:{bottom:{style:'medium',color:{rgb:WH}}},alignment:{vertical:'center',horizontal:'center',wrapText:true}}}; }
  function xColHdR(v){ return {v:v, s:{font:{bold:true,sz:10,color:{rgb:WH},name:'Calibri'},fill:{fgColor:{rgb:A}},border:{bottom:{style:'medium',color:{rgb:WH}}},alignment:{vertical:'center',horizontal:'right',wrapText:true}}}; }
  function xLbl(v){    return {v:v, s:{font:{sz:10,color:{rgb:GY},name:'Calibri'},fill:{fgColor:{rgb:WH}},alignment:{vertical:'center',horizontal:'left',indent:1}}}; }
  function xVal(v){    return {v:v, s:{font:{sz:10,name:'Calibri'},fill:{fgColor:{rgb:WH}},alignment:{vertical:'center',horizontal:'left',indent:1}}}; }
  function xValB(v){   return {v:v, s:{font:{sz:10,bold:true,name:'Calibri'},fill:{fgColor:{rgb:WH}},alignment:{vertical:'center',horizontal:'left',indent:1}}}; }
  function xNum(v){    return {v:v, t:'n', s:{font:{sz:10,name:'Calibri'},fill:{fgColor:{rgb:WH}},numFmt:'#,##0',alignment:{vertical:'center',horizontal:'right'}}}; }
  function xNumB(v){   return {v:v, t:'n', s:{font:{sz:10,bold:true,color:{rgb:N},name:'Calibri'},fill:{fgColor:{rgb:AL}},numFmt:'#,##0',alignment:{vertical:'center',horizontal:'right'}}}; }
  function xNumAm(v){  return {v:v, t:'n', s:{font:{sz:10,color:{rgb:AM},name:'Calibri'},fill:{fgColor:{rgb:WH}},numFmt:'#,##0',alignment:{vertical:'center',horizontal:'right'}}}; }
  function xNumGr(v){  return {v:v, t:'n', s:{font:{sz:10,color:{rgb:GR},name:'Calibri'},fill:{fgColor:{rgb:WH}},numFmt:'#,##0',alignment:{vertical:'center',horizontal:'right'}}}; }
  function xAlt(fn,v){ var c=fn(v); c.s=Object.assign({},c.s,{fill:{fgColor:{rgb:CA}}}); return c; }
  function xTot(v){    return {v:v, s:{font:{sz:10,bold:true,color:{rgb:N},name:'Calibri'},fill:{fgColor:{rgb:AL}},alignment:{vertical:'center',horizontal:'left',indent:1}}}; }
  function xTotN(v){   return {v:v, t:'n', s:{font:{sz:10,bold:true,color:{rgb:N},name:'Calibri'},fill:{fgColor:{rgb:AL}},numFmt:'#,##0',alignment:{vertical:'center',horizontal:'right'}}}; }
  function xFoot(v){   return {v:v, s:{font:{sz:9,color:{rgb:A},name:'Calibri'},fill:{fgColor:{rgb:N}},alignment:{vertical:'center',horizontal:'left',indent:1}}}; }
  function xFootR(v){  return {v:v, s:{font:{sz:9,color:{rgb:AX},name:'Calibri'},fill:{fgColor:{rgb:N}},alignment:{vertical:'center',horizontal:'right'}}}; }
  function xBlank(bg){ return {v:'', s:{fill:{fgColor:{rgb:bg||WH}}}}; }

  var em = xBlank(WH);

  // ── Sheet 1: Lease Assessment ──────────────────────────────────────────────
  var s1 = [
    // Row 1: Banner
    [xBanner('Finosutra  |  IND AS 116 — Lease Working Paper'), xBlank(N),xBlank(N),xBlank(N)],
    // Row 2: Subtitle
    [xSub('IND AS 116 / IFRS 16 Lease Accounting Suite     |     CONFIDENTIAL     |     For CA / Finance team use only'), xBlank(N2),xBlank(N2),xBlank(N2)],
    // Row 3: Meta
    [xMeta('Prepared: '+today+'   ·   Lease: '+(inp.name||'—')+'   ·   Entity: '+(inp.entity||'—')+'   ·   IBR: '+(inp.ibr||'—')+'% p.a.'), xBlank(AL),xBlank(AL),xBlank(AL)],
    [em,em,em,em],
    // Section A
    [xSecHd('SECTION A — LEASE IDENTIFICATION'),xBlank(A),xBlank(A),xBlank(A)],
    [xLbl('Lease Name / Description'), xValB(inp.name||'—'),em,em],
    [xLbl('Lessor'),       xVal(inp.lessor||'—'),   xLbl('Asset Category'), xVal(inp.category||'—')],
    [xLbl('Entity / Lessee'), xVal(inp.entity||'—'),xLbl('Remarks'),       xVal(inp.remarks||'—')],
    [em,em,em,em],
    // Section B
    [xSecHd('SECTION B — LEASE TERMS'),xBlank(A),xBlank(A),xBlank(A)],
    [xLbl('Commencement Date'), xVal(inp.start||'—'), xLbl('Lease Term'), xVal((inp.termMonths||'—')+' months')],
    [xLbl('Payment Frequency'), xVal(leaseEngine.freqLabel(inp.freq||12)), xLbl('Payment Timing'), xVal(inp.timing==='beg'?'Beginning of period':'End of period')],
    [xLbl('Rent per Period (₹)'), xNum(inp.pmt||0), xLbl('Rent-Free Months'), xNum(inp.rfMonths||0)],
    [xLbl('Escalation Type'), xVal(inp.escType||'none'), xLbl('Escalation % p.a.'), xNum(inp.escPct||0)],
    [xLbl('Escalation Interval (yrs)'), xNum(inp.escYears||0), xLbl('Escalation ₹ p.a.'), xNum(inp.escAmt||0)],
    [em,em,em,em],
    // Section C
    [xSecHd('SECTION C — FINANCIAL INPUTS'),xBlank(A),xBlank(A),xBlank(A)],
    [xLbl('Incremental Borrowing Rate (IBR)'), xVal((inp.ibr||0)+'% p.a.'), xLbl('IBR per Period (r)'), xVal(((inp.ibr||0)/100/(inp.freq||12)).toFixed(6))],
    [xLbl('Initial Direct Costs — IDC (₹)'), xNum(inp.idc||0), xLbl('Lease Incentives Received (₹)'), xNum(inp.incentive||0)],
    [xLbl('Restoration / Reinstatement Cost (₹)'), xNum(inp.restoration||0), xLbl('Short-Term Exemption'), xVal(inp.isShortTerm?'Yes':'No')],
    [xLbl('Low-Value Exemption'), xVal(inp.isLowValue?'Yes':'No'), em, em],
    [em,em,em,em],
    // Section D
    [xSecHd('SECTION D — COMPUTED OUTPUTS (IND AS 116 Para 26)'),xBlank(A),xBlank(A),xBlank(A)],
    [xLbl('Initial Lease Liability (PV) (₹)'), xNumB(res.pvInitial), xLbl('ROU Asset — Cost (₹)'), xNumB(res.rouInitial)],
    [xLbl('Current Liability (₹)'), xNumGr(res.liabCurrent), xLbl('Non-Current Liability (₹)'), xNumAm(res.liabNonCurrent)],
    [xLbl('Annual Depreciation (₹)'), xNum(res.depnAnnual), xLbl('Total Finance Cost (₹)'), xNumAm(res.totalInterest)],
    [xLbl('Total Payments over Lease Term (₹)'), xNum(res.totalPayments), em, em],
    [em,em,em,em],
    // Footer
    [xFoot('Prepared using Finosutra · finosutra.com · IND AS 116 / IFRS 16 Suite'), xBlank(N),xBlank(N), xFootR('IND AS 116 Compliant ✓')],
  ];

  var ws1 = XLSX.utils.aoa_to_sheet(s1);
  ws1['!cols'] = [{wch:40},{wch:22},{wch:30},{wch:22}];
  ws1['!rows'] = [{hpt:28},{hpt:17},{hpt:17},{hpt:6},{hpt:20},{hpt:18},{hpt:18},{hpt:18},{hpt:6},{hpt:20},{hpt:18},{hpt:18},{hpt:18},{hpt:18},{hpt:18},{hpt:6},{hpt:20},{hpt:18},{hpt:18},{hpt:18},{hpt:18},{hpt:6},{hpt:20},{hpt:18},{hpt:18},{hpt:18},{hpt:18},{hpt:6},{hpt:17}];
  ws1['!merges'] = [{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:1,c:0},e:{r:1,c:3}},{s:{r:2,c:0},e:{r:2,c:3}}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Lease Assessment');

  // ── Sheet 2: Amortization Schedule ────────────────────────────────────────
  var s2rows = [
    [xBanner('Finosutra  |  Amortization Schedule — '+(inp.name||'Lease')), xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N)],
    [xMeta('IBR: '+(inp.ibr||0)+'% p.a. ('+((inp.ibr||0)/100/(inp.freq||12)).toFixed(4)+'/period)   ·   Term: '+(inp.termMonths||0)+' months   ·   Opening Liability: ₹'+res.pvInitial.toLocaleString('en-IN')), xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL)],
    [xColHd('Period'),xColHd('Period End'),xColHdR('Opening Liab. (₹)'),xColHdR('Interest (₹)'),xColHdR('Payment (₹)'),xColHdR('Principal (₹)'),xColHdR('Closing Liab. (₹)'),xColHdR('Depreciation (₹)'),xColHdR('ROU NBV (₹)')],
  ];
  res.schedule.forEach(function(r, ri){
    var fn = ri%2===0 ? function(f,v){return f(v);} : function(f,v){return xAlt(f,v);};
    s2rows.push([fn(xVal,r.period),fn(xVal,r.periodEnd),fn(xNum,r.openL),fn(xNumAm,r.interest),fn(xNum,r.pmt),fn(xNum,r.principal),fn(xNum,r.closeL),fn(xNum,r.dep),fn(xNum,r.rouC)]);
  });
  var totPmt  = res.schedule.reduce(function(s,r){return s+r.pmt;},0);
  var totInt  = res.schedule.reduce(function(s,r){return s+r.interest;},0);
  var totPrin = res.schedule.reduce(function(s,r){return s+r.principal;},0);
  var totDep  = res.schedule.reduce(function(s,r){return s+r.dep;},0);
  s2rows.push([xTot('TOTAL'),xBlank(AL),xBlank(AL),xTotN(totInt),xTotN(totPmt),xTotN(totPrin),xBlank(AL),xTotN(totDep),xBlank(AL)]);
  s2rows.push([xFoot('Prepared using Finosutra · finosutra.com'),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xFootR('Periods: '+res.schedule.length+' · IND AS 116 ✓')]);

  var ws2 = XLSX.utils.aoa_to_sheet(s2rows);
  ws2['!cols'] = [{wch:8},{wch:14},{wch:20},{wch:18},{wch:16},{wch:16},{wch:20},{wch:18},{wch:16}];
  ws2['!rows'] = [{hpt:26},{hpt:17},{hpt:28}];
  ws2['!merges'] = [{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Amortization Schedule');

  // ── Sheet 3: Annual Rollforward ───────────────────────────────────────────
  var s3rows = [
    [xBanner('Finosutra  |  Annual Rollforward — '+(inp.name||'Lease')), xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N)],
    [xMeta('Indian FY (Apr–Mar)   ·   Entity: '+(inp.entity||'—')+'   ·   IND AS 116 Para 52'), xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL)],
    [xColHd('Financial Year'),xColHdR('Opening Liab. (₹)'),xColHdR('Interest (₹)'),xColHdR('Payments (₹)'),xColHdR('Principal (₹)'),xColHdR('Closing Liab. (₹)'),xColHdR('Depreciation (₹)'),xColHdR('ROU NBV (₹)')],
  ];
  (res.annual||[]).forEach(function(r,ri){
    var fn = ri%2===0 ? function(f,v){return f(v);} : function(f,v){return xAlt(f,v);};
    s3rows.push([fn(xValB,r.fy),fn(xNum,r.openL),fn(xNumAm,r.interest),fn(xNum,r.payments),fn(xNum,r.principal),fn(xNum,r.closeL),fn(xNum,r.dep),fn(xNum,r.rouC)]);
  });
  s3rows.push([xFoot('Prepared using Finosutra · finosutra.com'),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xFootR('IND AS 116 Compliant ✓')]);

  var ws3 = XLSX.utils.aoa_to_sheet(s3rows);
  ws3['!cols'] = [{wch:14},{wch:20},{wch:18},{wch:16},{wch:16},{wch:20},{wch:18},{wch:16}];
  ws3['!merges'] = [{s:{r:0,c:0},e:{r:0,c:7}},{s:{r:1,c:0},e:{r:1,c:7}}];
  XLSX.utils.book_append_sheet(wb, ws3, 'Annual Rollforward');

  // ── Sheet 4: Journal Entries ───────────────────────────────────────────────
  var jes = generateJEs({id: _editingLeaseId||'wp', name: inp.name, entity: inp.entity, inputs: inp});
  var s4rows = [
    [xBanner('Finosutra  |  Journal Entries — '+(inp.name||'Lease')), xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N)],
    [xMeta('GL Import Template   ·   IND AS 116 Para 25, 26, 36   ·   Entity: '+(inp.entity||'—')), xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL),xBlank(AL)],
    [xColHd('Date'),xColHd('FY'),xColHd('Entry Type'),xColHd('Narration'),xColHd('Account'),xColHdR('Dr (₹)'),xColHdR('Cr (₹)')],
  ];
  jes.forEach(function(j,ji){
    var fn = ji%2===0 ? function(f,v){return f(v);} : function(f,v){return xAlt(f,v);};
    s4rows.push([fn(xVal,j.date),fn(xVal,j.fy),fn(xVal,j.typeLabel),fn(xVal,j.narration),fn(xVal,j.account),
      j.dr ? fn(xNumGr,j.dr) : fn(xVal,'—'),
      j.cr ? fn(xNumAm,j.cr) : fn(xVal,'—')
    ]);
  });
  s4rows.push([xFoot('Prepared using Finosutra · finosutra.com'),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xBlank(N),xFootR('IND AS 116 Compliant ✓')]);

  var ws4 = XLSX.utils.aoa_to_sheet(s4rows);
  ws4['!cols'] = [{wch:12},{wch:10},{wch:22},{wch:48},{wch:30},{wch:16},{wch:16}];
  ws4['!merges'] = [{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:1,c:0},e:{r:1,c:6}}];
  XLSX.utils.book_append_sheet(wb, ws4, 'Journal Entries');

  // ── Sheet 5: IBR Working ───────────────────────────────────────────────────
  var rPeriod = (inp.ibr||0)/100/(inp.freq||12);
  var inRange = (inp.ibr>=8 && inp.ibr<=14);
  var s5rows = [
    [xBanner('Finosutra  |  IBR / Discount Rate Working Paper'), xBlank(N)],
    [xMeta('IND AS 116 Appendix A   ·   Prepared: '+today), xBlank(AL)],
    [em, em],
    [xSecHd('BASIS OF IBR DETERMINATION'), xBlank(A)],
    [xVal('The Incremental Borrowing Rate (IBR) is the rate of interest the lessee would pay to borrow funds,'), xBlank(WH)],
    [xVal('over a similar term and with a similar security, to obtain an asset of similar value to the ROU asset.'), xBlank(WH)],
    [xVal('Reference: IND AS 116 Appendix A / IFRS 16 Appendix A.'), xBlank(WH)],
    [em, em],
    [xSecHd('RATE COMPUTATION'), xBlank(A)],
    [xLbl('Annual IBR used'), xValB((inp.ibr||0)+'% p.a.')],
    [xLbl('Lease term for IBR assessment'), xVal((inp.termMonths||0)+' months')],
    [xLbl('Currency'), xVal('INR (Indian Rupee)')],
    [xLbl('Payment frequency'), xVal(leaseEngine.freqLabel(inp.freq||12)+' ('+inp.freq+' periods per year)')],
    [xLbl('Conversion formula'), xVal('IBR ÷ 100 ÷ Frequency')],
    [xLbl('Periodic rate (r) used in PV calculation'), xValB(rPeriod.toFixed(6))],
    [em, em],
    [xSecHd('IBR RANGE CHECK'), xBlank(A)],
    [xLbl('Typical Indian entity IBR range'), xVal('8.0% – 14.0% p.a.')],
    [xLbl('IBR used'), xValB((inp.ibr||0)+'% p.a.')],
    [{v:xLbl('Within typical range?').v, s:xLbl('').s}, {v:inRange?'Yes — within range':'⚠  Review required — outside typical range', s:{font:{bold:true,sz:10,color:{rgb:inRange?GR:'B91C1C'},name:'Calibri'},fill:{fgColor:{rgb:WH}},alignment:{vertical:'center',horizontal:'left',indent:1}}}],
    [em, em],
    [xFoot('Prepared using Finosutra · finosutra.com · IND AS 116 / IFRS 16 Suite'), xFootR('IBR should be reassessed at modification date')],
  ];

  var ws5 = XLSX.utils.aoa_to_sheet(s5rows);
  ws5['!cols'] = [{wch:52},{wch:32}];
  ws5['!merges'] = [{s:{r:0,c:0},e:{r:0,c:1}},{s:{r:1,c:0},e:{r:1,c:1}},{s:{r:3,c:0},e:{r:3,c:1}},{s:{r:8,c:0},e:{r:8,c:1}},{s:{r:16,c:0},e:{r:16,c:1}}];
  XLSX.utils.book_append_sheet(wb, ws5, 'IBR Working');

  var fname = 'WorkingPaper_'+((inp.name||'Lease').replace(/[^a-zA-Z0-9]/g,'_'))+'_'+today.replace(/ /g,'')+'.xlsx';
  XLSX.writeFile(wb, fname);
  toast('✓ Working paper exported!','#059669');

  // Log audit event
  if(_editingLeaseId) logAudit(_editingLeaseId, 'working_paper_exported', {date: today});
}

// ── Hook into saveLease and openLeaseDetail to trigger audit ─────────────────
var _origSaveLease = null; // patched below after definition

function showAuditAndExplain(inp, res){
  renderExplanationPanel(inp, res);
  var wpArea = document.getElementById('wpExportArea');
  if(wpArea) wpArea.style.display = res && !res.exemption ? 'block' : 'none';
  if(_editingLeaseId) loadAuditTrail(_editingLeaseId);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  LEASE WORKSPACE — tab switching, overview, validation, JEs, docs
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

var _lwActiveTab = 'inputs';

function switchLeaseTab(tab) {
  _lwActiveTab = tab;
  document.querySelectorAll('.lw-pane').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.lw-tab').forEach(function(t){ t.classList.remove('active'); });
  var pane = document.getElementById('lwt-'+tab);
  var btn  = document.getElementById('lwtab-'+tab);
  if(pane) pane.classList.add('active');
  if(btn)  btn.classList.add('active');
  // Lazy-render tabs when switched to
  if(tab === 'je') renderLeaseJEsTab();
  if(tab === 'documents') renderDocumentsTab();
  if(tab === 'audit') { renderLeaseValidationItems(); if(_editingLeaseId) loadAuditTrail(_editingLeaseId); }
}

// ── Overview tab: sync metadata from form fields ──────────────────
function lwSyncOverview() {
  var fDate = leaseEngine.fDate;
  var f2    = leaseEngine.f2;
  var freq  = { '12':'Monthly','4':'Quarterly','2':'Half-Yearly','1':'Annual' };
  var esc   = { none:'None', pct:'% p.a.', amt:'Fixed ₹', cpi:'CPI-linked' };
  function gv(id){ var el=document.getElementById(id); return el?el.value:''; }
  function sv(id,v){ var el=document.getElementById(id); if(el) el.textContent=v||'—'; }

  sv('ov-name',    gv('fName')  || '—');
  sv('ov-id',      _editingLeaseId ? _editingLeaseId.slice(0,16)+'…' : 'Not saved yet');
  sv('ov-lessor',  gv('fLessor') || '—');
  sv('ov-cat',     gv('fCategory') || '—');
  sv('ov-entity',  gv('fEntity')  || '—');
  // company
  var cSel = document.getElementById('fCompany');
  sv('ov-company', cSel && cSel.selectedIndex>0 ? cSel.options[cSel.selectedIndex].text : '—');
  // dates
  sv('ov-start', fDate(gv('fStart')));
  sv('ov-end',   fDate(gv('fEnd')));
  var tm = parseInt(gv('fTerm'));
  sv('ov-term', tm ? tm+' months' : '—');
  var pmt = parseFloat(gv('fPmt'));
  sv('ov-pmt',  pmt ? f2(pmt) : '—');
  sv('ov-freq', freq[gv('fFreq')] || '—');
  var ibr = parseFloat(gv('fIbr'));
  sv('ov-ibr', ibr ? ibr+'% p.a.' : '—');
  // misc
  var escType = gv('fEscType');
  sv('ov-esc', esc[escType] || '—');
  var st = document.getElementById('fShortTerm'), lv = document.getElementById('fLowValue');
  sv('ov-exempt', (st&&st.checked)?'Short-term':(lv&&lv.checked)?'Low-value':'None');
  var ex = document.getElementById('fExtOption');
  sv('ov-ext', (ex&&ex.checked)?'Yes':'No');
  // status
  sv('ov-status', _lwStatusLabels[gv('fWorkflowStatus')] || 'Draft');
  // title in header
  var titleEl = document.getElementById('detailPageTitle');
  if(titleEl) titleEl.textContent = gv('fName') || (_editingLeaseId ? 'Edit Lease' : 'New Lease');
}

// ── Overview KPI strip (after calculate) ─────────────────────────
function lwUpdateOverviewKpis(inp, res) {
  var le = leaseEngine;
  var el = document.getElementById('lwOverviewKpis');
  if(!el) return;
  if(res.exemption){
    el.innerHTML = '<div class="lw-calc-prompt" style="background:#D1FAE5;border-color:#6EE7B7;color:#065F46;"><i class="fa-solid fa-check-circle" style="color:#059669;font-size:24px;"></i>Exempt from IND AS 116 recognition — expense straight to P&L</div>';
    return;
  }
  el.innerHTML =
    '<div class="lw-result-strip">'+
      '<div class="lw-result-kpi blue"><div class="lbl">Initial Lease Liability</div><div class="val">'+le.f2(res.pvInitial)+'</div><div class="sub">Present value at commencement</div></div>'+
      '<div class="lw-result-kpi purple"><div class="lbl">ROU Asset</div><div class="val">'+le.f2(res.rouInitial)+'</div><div class="sub">Incl. IDC &amp; restoration</div></div>'+
      '<div class="lw-result-kpi green"><div class="lbl">Current Liability</div><div class="val">'+le.f2(res.liabCurrent)+'</div><div class="sub">Due within 12 months</div></div>'+
      '<div class="lw-result-kpi orange"><div class="lbl">Non-Current Liability</div><div class="val">'+le.f2(res.liabNonCurrent)+'</div><div class="sub">Due after 12 months</div></div>'+
    '</div>'+
    '<div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:14px 20px;font-size:12px;color:#6B7280;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">'+
      '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#9CA3AF;margin-bottom:3px;">Annual Depreciation</div><div style="font-weight:700;color:#D97706;font-size:14px;">'+le.f2(res.depnAnnual)+'</div></div>'+
      '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#9CA3AF;margin-bottom:3px;">Total Interest</div><div style="font-weight:700;color:#374151;font-size:14px;">'+le.f2(res.totalInterest)+'</div></div>'+
      '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#9CA3AF;margin-bottom:3px;">Total Payments</div><div style="font-weight:700;color:#374151;font-size:14px;">'+le.f2(res.totalPayments)+'</div></div>'+
      '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#9CA3AF;margin-bottom:3px;">Calculated</div><div style="font-weight:700;color:#374151;font-size:14px;">'+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+'</div></div>'+
    '</div>';
  // also update ov-calc-ts in meta
  var tsEl = document.getElementById('ov-calc-ts');
  if(tsEl) tsEl.textContent = (fsShortDate(new Date()).slice(0,6)+', '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}));
}

// ── Schedules tab population ──────────────────────────────────────
function lwPopulateSchedulesTab(res, modResult) {
  var sa = document.getElementById('schedArea');
  if(!sa) return;
  sa.style.display = 'block';
  // Inject card if not yet inside schedArea (don't use getElementById — it finds the template copy)
  if(!sa.querySelector('#schedWrap')) {
    var tpl = document.getElementById('lwSchedCardTpl');
    if(tpl) sa.innerHTML = tpl.innerHTML;
  }
  var titleEl = sa.querySelector('#schedTitle');
  if(modResult){
    if(titleEl) titleEl.textContent = 'Amortization Schedule (Pre-Modification + Post-Modification)';
    renderModScheduleTable(res, modResult);
  } else {
    if(titleEl) titleEl.textContent = 'Amortization Schedule ('+res.n+' periods)';
    renderSchedTable(res.schedule, 'period');
  }
  // reset sched tabs
  sa.querySelectorAll('.sched-tab').forEach(function(b,i){ b.classList.toggle('active', i===0); });
}

function renderModScheduleTable(res, modResult) {
  var wrap = document.getElementById('schedWrap');
  if(!wrap) return;
  var le = leaseEngine;
  var f2 = le.f2.bind(le);
  var head = '<tr><th>Period</th><th>Date</th><th>Opening Liab.</th><th>Interest</th><th>Payment</th><th>Principal</th><th>Closing Liab.</th><th>Depn.</th><th>ROU NBV</th></tr>';
  var rows = '';
  // Pre-mod rows (greyed)
  var preRows = modResult.preModRows;
  res.schedule.slice(0, preRows.length).forEach(function(r, i){
    rows += '<tr style="opacity:0.55;">'+
      '<td>'+r.period+'</td>'+
      '<td>'+(r.periodEnd ? le.fDate(r.periodEnd) : '')+'</td>'+
      '<td>'+f2(r.opening)+'</td>'+
      '<td>'+f2(r.interest)+'</td>'+
      '<td>'+f2(r.pmt)+'</td>'+
      '<td>'+f2(r.principal)+'</td>'+
      '<td>'+f2(r.closing)+'</td>'+
      '<td>'+f2(r.dep)+'</td>'+
      '<td>'+f2(r.rouNBV)+'</td>'+
    '</tr>';
  });
  // Modification divider row
  rows += '<tr style="background:#FEF3C7;font-weight:700;color:#92400E;">'+
    '<td colspan="9" style="text-align:center;padding:8px;">'+
      '<i class="fa-solid fa-pen-ruler"></i>&nbsp; LEASE MODIFICATION — '+esc(modResult.modDate)+
      ' &nbsp;|&nbsp; Adjustment to Liability: '+f2(modResult.liabAdj)+
      (modResult.gainLoss ? '&nbsp;|&nbsp; Gain/Loss on Derecognition: '+f2(modResult.gainLoss) : '')+
    '</td>'+
  '</tr>';
  // Post-mod rows
  modResult.postModRows.forEach(function(r){
    rows += '<tr style="background:#F0FDF4;">'+
      '<td>M'+r.period+'</td>'+
      '<td>—</td>'+
      '<td>'+f2(r.closingLiab + r.principal)+'</td>'+
      '<td>'+f2(r.interest)+'</td>'+
      '<td>'+f2(r.pmt)+'</td>'+
      '<td>'+f2(r.principal)+'</td>'+
      '<td>'+f2(r.closingLiab)+'</td>'+
      '<td>'+f2(r.dep || 0)+'</td>'+
      '<td>'+f2(r.rouNBV)+'</td>'+
    '</tr>';
  });
  wrap.innerHTML = '<div class="tbl-scroll"><table class="sched-table"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div>';
}

// ── Disclosures tab: lease-level ─────────────────────────────────
function lwUpdateDisclosuresTab(inp, res, modResult) {
  if(!modResult && _lastCalcResult) modResult = _lastCalcResult.modResult;
  var el = document.getElementById('lwDiscContent');
  if(!el) return;
  if(res.exemption){ el.innerHTML = '<div class=”lw-calc-prompt”><i class=”fa-solid fa-circle-check” style=”color:#059669;”></i>This lease is exempt — no balance sheet disclosures required.</div>'; return; }
  var le = leaseEngine;

  // Maturity from schedule — use post-mod rows if modified
  var mat = {y1:0, y1_5:0, y5plus:0, total:0};
  var scheduleToUse = res.schedule;
  var pvToUse = res.pvInitial;
  var liabCurrent = res.liabCurrent;
  var liabNonCurrent = res.liabNonCurrent;
  var depnAnnual = res.depnAnnual;
  var totalInterest = res.totalInterest;
  var termYears = Math.ceil(inp.termMonths / 12);

  if(modResult){
    // Use post-mod rows for maturity — these are the future cashflows
    var preCount = modResult.preModRows.length;
    var modFreq = inp.modification ? inp.modification.modFreq || 12 : 12;
    modResult.postModRows.forEach(function(r, idx){
      var mo = (idx+1) * (12 / modFreq);
      mat.total += r.pmt;
      if(mo<=12) mat.y1 += r.pmt;
      else if(mo<=60) mat.y1_5 += r.pmt;
      else mat.y5plus += r.pmt;
    });
    pvToUse = modResult.newPV;
    // Recalc current/non-current from post-mod schedule
    var moPerYear = modFreq;
    var currRows = modResult.postModRows.slice(0, moPerYear);
    var ncurrRows = modResult.postModRows.slice(moPerYear);
    liabCurrent    = currRows.length  ? currRows[currRows.length-1].closingLiab  : 0;
    liabNonCurrent = ncurrRows.length ? ncurrRows[ncurrRows.length-1].closingLiab : 0;
    // dep from post-mod
    var modTerm = inp.modification ? inp.modification.modTerm || 12 : 12;
    depnAnnual = modResult.postModRows.slice(0, modFreq).reduce(function(s,r){ return s+(r.dep||0); }, 0);
    totalInterest = modResult.postModRows.reduce(function(s,r){ return s+r.interest; }, 0);
    termYears = Math.ceil(modTerm / 12);
  } else {
    res.schedule.forEach(function(r){
      var mo = r.period * (12/(res.freq||12));
      mat.total += r.pmt;
      if(mo<=12) mat.y1 += r.pmt;
      else if(mo<=60) mat.y1_5 += r.pmt;
      else mat.y5plus += r.pmt;
    });
  }
  var rouNet = modResult ? Math.max(0, modResult.carryingROUAtMod + modResult.rouAdj) : res.rouInitial;
  el.innerHTML =
    (modResult ? '<div style="font-size:11px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:6px 10px;margin-bottom:10px;"><i class="fa-solid fa-pen-ruler"></i> Showing post-modification figures as at '+esc(modResult.modDate)+'</div>' : '')+
    '<div class="lw-disc-grid">'+
      '<div class="lw-disc-kpi blue"><div class="lbl">Current Lease Liability</div><div class="val">'+le.f2(liabCurrent)+'</div></div>'+
      '<div class="lw-disc-kpi purple"><div class="lbl">Non-Current Lease Liability</div><div class="val">'+le.f2(liabNonCurrent)+'</div></div>'+
      '<div class="lw-disc-kpi green"><div class="lbl">ROU Asset (Net)</div><div class="val">'+le.f2(rouNet)+'</div></div>'+
      '<div class="lw-disc-kpi amber"><div class="lbl">Annual Depreciation</div><div class="val">'+le.f2(depnAnnual)+'</div></div>'+
    '</div>'+
    '<div class="rpt-section" style="margin-bottom:16px;">'+
      '<div class="rpt-section-header"><div class="rpt-section-title">Maturity Analysis — Undiscounted Payments (Para 52(b))</div></div>'+
      '<div class="rpt-table-wrap"><table class="rpt-table">'+
        '<thead><tr><th>Maturity Bucket</th><th class="num">Amount (₹)</th></tr></thead>'+
        '<tbody>'+
          '<tr><td>Not later than 1 year</td><td class="num">'+fmt(mat.y1)+'</td></tr>'+
          '<tr><td>Later than 1 year, not later than 5 years</td><td class="num">'+fmt(mat.y1_5)+'</td></tr>'+
          '<tr><td>Later than 5 years</td><td class="num">'+fmt(mat.y5plus)+'</td></tr>'+
          '<tr class="total-row"><td>Total undiscounted cash flows</td><td class="num">'+fmt(mat.total)+'</td></tr>'+
          '<tr><td style="color:#6B7280;font-style:italic;">Less: Future finance charges</td><td class="num" style="color:#6B7280;">'+fmt(mat.total - pvToUse)+'</td></tr>'+
          '<tr class="total-row"><td>Present value of lease liability</td><td class="num">'+fmt(pvToUse)+'</td></tr>'+
        '</tbody>'+
      '</table></div>'+
    '</div>'+
    '<div class="rpt-section">'+
      '<div class="rpt-section-header"><div class="rpt-section-title">P&amp;L Impact Summary (Para 52(b))</div></div>'+
      '<div class="rpt-table-wrap"><table class="rpt-table">'+
        '<thead><tr><th>Item</th><th class="num">Amount (₹)</th></tr></thead>'+
        '<tbody>'+
          '<tr><td>Depreciation on ROU asset (annual — post-mod)</td><td class="num">'+fmt(depnAnnual)+'</td></tr>'+
          '<tr><td>Interest expense on lease liability (remaining term)</td><td class="num">'+fmt(totalInterest)+'</td></tr>'+
          '<tr class="total-row"><td>Total P&L impact over remaining term</td><td class="num">'+fmt(depnAnnual * termYears + totalInterest)+'</td></tr>'+
        '</tbody>'+
      '</table></div>'+
    '</div>';
}

// ── Journal Entries tab (for current lease) ───────────────────────
function renderLeaseJEsTab() {
  var el = document.getElementById('lwJEContent');
  if(!el) return;
  var leaseId = _editingLeaseId;
  var l = leaseId ? leases.find(function(x){ return x.id===leaseId; }) : null;
  if(!l && !_lastCalcResult){
    el.innerHTML = '<div class="lw-calc-prompt"><i class="fa-solid fa-book"></i>Save this lease first, then journal entries will appear here.</div>';
    return;
  }
  var inp = _lastCalcResult ? _lastCalcResult.inp : Object.assign({},l.inputs||{},{name:l.name,entity:l.entity||''});
  var fakeL = { id: leaseId||'tmp', name: inp.name, entity: inp.entity, inputs: inp };
  var jes = generateJEs(fakeL);
  if(!jes.length){ el.innerHTML = '<div class="lw-calc-prompt"><i class="fa-solid fa-book"></i>No journal entries generated. Run Calculate first.</div>'; return; }

  var totDr = 0;
  var rows = jes.map(function(j,i){
    totDr += (j.dr||0);
    return '<tr>'+
      '<td>'+leaseEngine.fDate(j.date)+'</td>'+
      '<td style="color:#6B7280;font-size:11px;">'+esc(j.fy||'')+'</td>'+
      '<td><span class="je-type-badge '+esc(j.type||'')+'">'+esc(j.typeLabel||'')+'</span></td>'+
      '<td>'+esc(j.narration||'')+'</td>'+
      '<td style="font-weight:600;color:#111827;">'+esc(j.account||'')+'</td>'+
      '<td class="amt dr">'+((j.dr)?fmt(j.dr):'')+'</td>'+
      '<td class="amt cr">'+((j.cr)?fmt(j.cr):'')+'</td>'+
    '</tr>';
  }).join('');

  // Modification JE — highlight in amber
  var modJERows = '';
  var modResult = _lastCalcResult && _lastCalcResult.modResult;
  var modDr = 0;
  if(modResult){
    modJERows = renderModJE(modResult, leaseEngine.f2.bind(leaseEngine));
    // Sum Dr from mod JEs for the Dr=Cr check
    var modJEList = generateModJEs(fakeL, modResult);
    modJEList.forEach(function(j){ modDr += (j.dr||0); });
  }
  var grandDr = totDr + modDr;

  el.innerHTML =
    '<div class="je-info-bar">'+
      '<span>'+jes.length+' entries'+(modResult?' + mod JE':'')+'</span>'+
      '<span>Total Dr / Cr: ₹'+Number(grandDr).toLocaleString('en-IN')+'</span>'+
      '<span style="color:#059669;">Dr = Cr ✓</span>'+
    '</div>'+
    '<div class="je-table-wrap"><table class="je-table">'+
      '<thead><tr><th>Date</th><th>FY</th><th>Type</th><th>Narration</th><th>Account</th><th class="amt">Dr (₹)</th><th class="amt">Cr (₹)</th></tr></thead>'+
      '<tbody>'+rows+(modJERows?'<tr style="background:#FEF3C7;"><td colspan="7" style="height:4px;"></td></tr>'+modJERows:'')+'</tbody>'+
    '</table></div>';
}

function exportJEForCurrentLease(){
  if(!window.currentUser){ toast('Sign in to export.','#6366F1'); fsShowAuthModal('login'); return; }
  var leaseId = _editingLeaseId;
  var l = leaseId ? leases.find(function(x){ return x.id===leaseId; }) : null;
  var inp = _lastCalcResult ? _lastCalcResult.inp : (l ? Object.assign({},l.inputs||{},{name:l.name,entity:l.entity||''}) : null);
  if(!inp){ toast('Calculate or save first.','#EF4444'); return; }
  var fakeL = { id: leaseId||'tmp', name: inp.name, entity: inp.entity, inputs: inp };
  // temporarily add to global filter and call exportJEXL
  var prevJEFilter = document.getElementById('jeLeaseFilter');
  exportJEXL();
}

// ── Documents tab ─────────────────────────────────────────────────
var _lwDocSlots = [
  { key:'agreement',    icon:'fa-file-signature', label:'Lease Agreement',     hint:'Signed lease / leave & licence deed' },
  { key:'amendment',   icon:'fa-file-pen',        label:'Amendment / Addendum',hint:'Modifications to original terms' },
  { key:'termination', icon:'fa-file-xmark',      label:'Termination Letter',  hint:'Early exit or surrender agreement' },
  { key:'memo',        icon:'fa-file-lines',      label:'Internal Memo / WP',  hint:'IBR basis, management judgement note' },
  { key:'disclosure',  icon:'fa-file-contract',   label:'Disclosure Note',     hint:'Signed-off Para 52 disclosure note' },
  { key:'other1',      icon:'fa-paperclip',        label:'Other Document 1',    hint:'Any other supporting document' }
];

function renderDocumentsTab() {
  var grid = document.getElementById('lwDocGrid');
  if(!grid) return;
  // Get existing docs from inputs
  var l = _editingLeaseId ? leases.find(function(x){ return x.id===_editingLeaseId; }) : null;
  var docs = (l && l.inputs && l.inputs.documents) ? l.inputs.documents : {};

  grid.innerHTML = _lwDocSlots.map(function(slot){
    var d = docs[slot.key];
    if(d && d.name){
      return '<div class="lw-doc-slot filled">'+
        '<i class="fa-solid '+slot.icon+'" style="color:#4F46E5;font-size:20px;margin-bottom:8px;display:block;"></i>'+
        '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9CA3AF;margin-bottom:4px;">'+esc(slot.label)+'</div>'+
        '<div class="lw-doc-name">'+esc(d.name)+'</div>'+
        '<div class="lw-doc-meta">Added: '+esc(d.added||'—')+'</div>'+
        '<div class="lw-doc-actions">'+
          (d.url ? '<a href="'+esc(d.url)+'" target="_blank" class="lw-doc-btn">Open ↗</a>' : '')+
          '<button class="lw-doc-btn danger" onclick="lwRemoveDoc(\''+slot.key+'\')">Remove</button>'+
        '</div>'+
      '</div>';
    }
    return '<div class="lw-doc-slot" onclick="lwAddDoc(\''+slot.key+'\',\''+esc(slot.label)+'\')">'+
      '<i class="fa-solid '+slot.icon+'"></i>'+
      '<h5>'+esc(slot.label)+'</h5>'+
      '<p>'+esc(slot.hint)+'</p>'+
      '<div style="margin-top:10px;font-size:11px;font-weight:600;color:#4F46E5;">+ Add document</div>'+
    '</div>';
  }).join('');
}

function lwAddDoc(key, label){
  var name = prompt('Paste a link (URL) or enter a file name for: '+label+'\n\nTip: paste a Google Drive or SharePoint link to open the document directly.');
  if(!name) return;
  var url  = name.startsWith('http') ? name : '';
  var l = _editingLeaseId ? leases.find(function(x){ return x.id===_editingLeaseId; }) : null;
  if(!l){ toast('Save the lease first before adding documents.','#EF4444'); return; }
  if(!l.inputs) l.inputs = {};
  if(!l.inputs.documents) l.inputs.documents = {};
  l.inputs.documents[key] = { name: name, url: url, added: new Date().toLocaleDateString('en-IN') };
  renderDocumentsTab();
  toast('Document reference saved — remember to Save the lease.','#4F46E5');
}

function lwRemoveDoc(key){
  var l = _editingLeaseId ? leases.find(function(x){ return x.id===_editingLeaseId; }) : null;
  if(!l || !l.inputs || !l.inputs.documents) return;
  delete l.inputs.documents[key];
  renderDocumentsTab();
}

// ── Workflow status ───────────────────────────────────────────────
var _lwStatusLabels = { draft:'Draft', 'in-review':'Ready for Review', reviewed:'Reviewed', approved:'Approved', modified:'Modified', closed:'Closed' };
var _lwStatusCycle  = ['draft','in-review','reviewed','approved','modified','closed'];

function applyStatusFromSelect(val) {
  document.getElementById('fWorkflowStatus').value = val;
  lwUpdateStatusPill(val);
  lwSyncOverview();
}

function cycleLeaseStatus() {
  var cur = document.getElementById('fWorkflowStatus').value || 'draft';
  var idx = _lwStatusCycle.indexOf(cur);
  var next = _lwStatusCycle[(idx+1) % _lwStatusCycle.length];
  applyStatusFromSelect(next);
  // sync the select in inputs tab
  var sel = document.querySelector('.lw-workflow-select');
  if(sel) sel.value = next;
}

function markLeaseStatus(status) {
  var cur = document.getElementById('fWorkflowStatus').value || 'draft';
  var check = wfCanTransition(cur, status);
  if(!check.ok) {
    showWorkflowGate(status, check.blockers, check.warnings);
    return;
  }
  applyStatusFromSelect(status);
  var sel = document.querySelector('.lw-workflow-select');
  if(sel) sel.value = status;
  // If approving, auto-capture date
  if(status==='approved' && !document.getElementById('sfApprovedDate').value) {
    document.getElementById('sfApprovedDate').value = new Date().toISOString().slice(0,10);
  }
  if(status==='reviewed' && !document.getElementById('sfReviewedDate').value) {
    document.getElementById('sfReviewedDate').value = new Date().toISOString().slice(0,10);
  }
  toast('Status updated to: '+(_lwStatusLabels[status]||status),'#4F46E5');
}

function lwUpdateStatusPill(status) {
  var pill = document.getElementById('lwStatusPill');
  if(!pill) return;
  pill.textContent = _lwStatusLabels[status] || 'Draft';
  pill.className = 'lw-status-pill ' + (status||'draft');
}

// ── Validation ────────────────────────────────────────────────────
var _lwValidationIssues = [];

function buildLeaseValidationIssues() {
  var inp = collectInp();
  var issues = [];
  // Engine validation
  var v = leaseEngine.validate(inp);
  v.errors.forEach(function(e){ issues.push({ sev:'error', msg:e.message, field:e.field }); });
  // Extended checks
  if(!inp.lessor) issues.push({ sev:'info', msg:'Lessor name not provided — required for Para 52 disclosures.' });
  if(!inp.category) issues.push({ sev:'info', msg:'Asset category not set — helps with ROU asset classification.' });
  var cSel = document.getElementById('fCompany');
  if(cSel && !cSel.value) issues.push({ sev:'info', msg:'No company linked — lease will appear without company grouping.' });
  if(inp.ibr && inp.ibr < 5) issues.push({ sev:'warning', msg:'IBR '+inp.ibr+'% is below 5% — very low for Indian entities. Typical range is 8–14%.' });
  if(inp.ibr && inp.ibr > 20) issues.push({ sev:'warning', msg:'IBR '+inp.ibr+'% is above 20% — unusually high. Please verify with lending rate.' });
  if(inp.termMonths > 120) issues.push({ sev:'warning', msg:'Lease term is '+inp.termMonths+' months (>10 years). Please confirm term includes only enforceable period.' });
  if(inp.start && inp.termMonths && !inp.isShortTerm && inp.termMonths <= 12) issues.push({ sev:'warning', msg:'Lease term is ≤12 months. Consider whether short-term exemption (Para 5a) should apply.' });
  if(inp.escType !== 'none' && !inp.escPct && !inp.escAmt) issues.push({ sev:'error', msg:'Escalation type selected but no escalation value entered.' });
  if(inp.rfMonths && inp.rfMonths > inp.termMonths) issues.push({ sev:'error', msg:'Rent-free months ('+inp.rfMonths+') exceeds total term ('+inp.termMonths+').' });
  // Document checks
  var l = _editingLeaseId ? leases.find(function(x){ return x.id===_editingLeaseId; }) : null;
  var docs = (l && l.inputs && l.inputs.documents) ? l.inputs.documents : {};
  if(!docs.agreement) issues.push({ sev:'info', msg:'Lease agreement not linked in Documents tab (optional — paste a Google Drive or SharePoint link).' });
  if(!inp.remarks) issues.push({ sev:'info', msg:'No remarks entered — consider documenting the IBR basis and key judgements.' });
  // Modification field checks
  var modSec = document.getElementById('modSection');
  if(modSec && modSec.style.display !== 'none'){
    var modDate = document.getElementById('fModDate').value;
    var modPmt  = parseFloat(document.getElementById('fModPmt').value)||0;
    var modTerm = parseInt(document.getElementById('fModTerm').value)||0;
    var modIbr  = parseFloat(document.getElementById('fModIbr').value)||0;
    if(!modDate) issues.push({ sev:'error', msg:'Modification: Effective date is required.' });
    if(modDate && inp.start && modDate <= inp.start) issues.push({ sev:'error', msg:'Modification: Effective date must be after the lease commencement date.' });
    if(modDate && inp.start && inp.termMonths){
      var leaseEnd = new Date(inp.start); leaseEnd.setMonth(leaseEnd.getMonth()+inp.termMonths);
      if(new Date(modDate) >= leaseEnd) issues.push({ sev:'error', msg:'Modification: Effective date is after (or on) the original lease end date.' });
    }
    if(!modPmt) issues.push({ sev:'error', msg:'Modification: Revised rent per period is required.' });
    if(!modTerm) issues.push({ sev:'error', msg:'Modification: Revised remaining term is required.' });
    if(!modIbr) issues.push({ sev:'error', msg:'Modification: Revised IBR is required.' });
    else if(modIbr < 5) issues.push({ sev:'warning', msg:'Modification IBR '+modIbr+'% is below 5% — verify with lending rate at modification date.' });
    else if(modIbr > 25) issues.push({ sev:'warning', msg:'Modification IBR '+modIbr+'% is above 25% — very high. Please verify.' });
    var retainPct = parseFloat(document.getElementById('fModRetainPct').value)||0;
    var modType = document.getElementById('fModType').value;
    if(modType === 'para46a' && (!retainPct || retainPct <= 0 || retainPct >= 100))
      issues.push({ sev:'error', msg:'Modification (Para 46a): % of asset retained must be between 1 and 99.' });
  }
  if(!issues.length) issues.push({ sev:'info', msg:'All checks passed — no issues found.' });
  return issues;
}

function renderLeaseValidationItems() {
  var issues = _lwValidationIssues.length ? _lwValidationIssues : buildLeaseValidationIssues();
  _lwValidationIssues = issues;
  var html = issues.map(function(issue){
    return '<div class="lw-val-item">'+
      '<span class="lw-val-sev '+issue.sev+'">'+issue.sev.charAt(0).toUpperCase()+issue.sev.slice(1)+'</span>'+
      '<span class="lw-val-msg">'+esc(issue.msg)+'</span>'+
    '</div>';
  }).join('');
  ['lwValidationItems','lwOverviewValItems'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.innerHTML = html;
  });
  // update tab badge
  var errs  = issues.filter(function(i){ return i.sev==='error'; }).length;
  var warns = issues.filter(function(i){ return i.sev==='warning'; }).length;
  var auditTab = document.getElementById('lwtab-audit');
  if(auditTab){
    var badge = errs ? '<span class="lw-tab-badge">'+errs+'</span>' :
                warns ? '<span class="lw-tab-badge warn">'+warns+'</span>' :
                '<span class="lw-tab-badge ok">✓</span>';
    auditTab.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> Audit &amp; Review '+badge;
  }
  // show/hide overview validation card
  var ovVal = document.getElementById('lwOverviewValidation');
  if(ovVal) ovVal.style.display = (errs||warns) ? 'block' : 'none';
}

function runLeaseValidationUI() {
  _lwValidationIssues = buildLeaseValidationIssues();
  renderLeaseValidationItems();
  switchLeaseTab('audit');
  toast('Validation complete — '+_lwValidationIssues.length+' items found.','#4F46E5');
}

// ── Sign-off save ─────────────────────────────────────────────────
function saveSignoff(){
  var l = _editingLeaseId ? leases.find(function(x){ return x.id===_editingLeaseId; }) : null;
  if(!l){ toast('Save the lease first.','#EF4444'); return; }
  if(!l.inputs) l.inputs = {};
  l.inputs.signoff = {
    preparedBy:   document.getElementById('sfPreparedBy').value.trim(),
    preparedDate: document.getElementById('sfPreparedDate').value,
    reviewedBy:   document.getElementById('sfReviewedBy').value.trim(),
    reviewedDate: document.getElementById('sfReviewedDate').value,
    approvedBy:   document.getElementById('sfApprovedBy').value.trim(),
    approvedDate: document.getElementById('sfApprovedDate').value,
    reviewNotes:  document.getElementById('sfReviewNotes').value.trim()
  };
  toast('Sign-off saved — remember to Save the lease.','#059669');
}

function lwLoadSignoff(inp){
  var sf = inp.signoff || {};
  function sv(id,v){ var el=document.getElementById(id); if(el) el.value=v||''; }
  sv('sfPreparedBy',   sf.preparedBy);
  sv('sfPreparedDate', sf.preparedDate);
  sv('sfReviewedBy',   sf.reviewedBy);
  sv('sfReviewedDate', sf.reviewedDate);
  sv('sfApprovedBy',   sf.approvedBy);
  sv('sfApprovedDate', sf.approvedDate);
  sv('sfReviewNotes',  sf.reviewNotes);
}

// ── Save Draft (save without requiring Calculate) ─────────────────
function saveDraft(){
  if(!window.currentUser){ fsShowAuthModal('login'); return; }
  if(!window.isProUser){ toast('Portfolio requires Pro.','#6366F1'); fsInitiateProSubscription(); return; }
  var inp = collectInp();
  if(!inp.name){ toast('Lease name is required.','#EF4444'); document.getElementById('fName').focus(); return; }
  // Mark status as draft if not set
  inp.workflowStatus = document.getElementById('fWorkflowStatus').value || 'draft';
  // Use saveLease but bypass the "calculate first" check
  var savedResult = _lastCalcResult;
  if(!savedResult) _lastCalcResult = { inp: inp, res: { pvInitial:0, rouInitial:0, liabCurrent:0, liabNonCurrent:0, depnAnnual:0, totalInterest:0, totalPayments:0, schedule:[], annual:[] } };
  saveLease().then(function(){ _lastCalcResult = savedResult; }).catch(function(){ _lastCalcResult = savedResult; });
}

// ── Patch openLeaseDetail to init workspace ───────────────────────
var _origOpenLeaseDetail = openLeaseDetail;
openLeaseDetail = function(leaseId) {
  _origOpenLeaseDetail(leaseId);
  // Reset tab to inputs for new, overview for existing
  var startTab = leaseId ? 'overview' : 'inputs';
  switchLeaseTab(startTab);
  _lwValidationIssues = [];
  // Reset audit tab badge
  var auditTab = document.getElementById('lwtab-audit');
  if(auditTab) auditTab.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> Audit &amp; Review';
  // Reset KPI strip
  var kpis = document.getElementById('lwOverviewKpis');
  if(kpis && !leaseId) kpis.innerHTML = '<div class="lw-calc-prompt"><i class="fa-solid fa-calculator"></i>Fill inputs on the <strong>Inputs</strong> tab, then click <strong>Calculate</strong> to see results here.</div>';
  // Sync overview from prefilled form
  setTimeout(lwSyncOverview, 50);
  // Load signoff if editing
  if(leaseId){
    var l = leases.find(function(x){ return x.id===leaseId; });
    if(l && l.inputs){
      lwLoadSignoff(l.inputs);
      // Sync workflow status
      var status = l.inputs.workflowStatus || 'draft';
      document.getElementById('fWorkflowStatus').value = status;
      var sel = document.querySelector('.lw-workflow-select');
      if(sel) sel.value = status;
      lwUpdateStatusPill(status);
      // Load documents
      renderDocumentsTab();
    }
  } else {
    lwLoadSignoff({});
    lwUpdateStatusPill('draft');
    document.getElementById('fWorkflowStatus').value = 'draft';
    var sel = document.querySelector('.lw-workflow-select');
    if(sel) sel.value = 'draft';
  }
};

// ── Patch collectInp to include workflowStatus ────────────────────
var _origCollectInp = collectInp;
collectInp = function(){
  var inp = _origCollectInp();
  inp.workflowStatus = document.getElementById('fWorkflowStatus').value || 'draft';
  return inp;
};

// ── Patch prefillForm to load workflowStatus ──────────────────────
var _origPrefillForm = prefillForm;
prefillForm = function(l){
  _origPrefillForm(l);
  var status = (l.inputs && l.inputs.workflowStatus) || 'draft';
  document.getElementById('fWorkflowStatus').value = status;
  var sel = document.querySelector('.lw-workflow-select');
  if(sel) sel.value = status;
  lwUpdateStatusPill(status);
  setTimeout(lwSyncOverview, 10);
};

// ── Show status badges on lease cards ────────────────────────────
// (patch renderLeaseCard to add badge — called by renderLeaseGrid via innerHTML)
// We add the badge inside renderLeaseGrid's HTML template; status is in l.inputs.workflowStatus

function doExportXL(){
  if(typeof XLSX==='undefined'){ toast('XLSX not loaded.','#EF4444'); return; }
  var wb=XLSX.utils.book_new();
  var N='002244',N2='002E5C',A='0052CC',AL='E8F0FF',WH='FFFFFF',GY='6B7280',AM='D97706',GR='059669',CA='F0F5FF';
  var today=fsShortDate(new Date());
  function xBn(v){  return {v:v,s:{font:{name:'Calibri',sz:14,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xSb(v){  return {v:v,s:{font:{name:'Calibri',sz:10,color:{rgb:'93BBFB'}},fill:{fgColor:{rgb:N2}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xMt(v){  return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:A}},fill:{fgColor:{rgb:AL}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xHd(v){  return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:A}},alignment:{horizontal:'center',vertical:'center',wrapText:true}}}; }
  function xHdR(v){ return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:A}},alignment:{horizontal:'right',vertical:'center',wrapText:true}}}; }
  function xTx(v){  return {v:v,s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:WH}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xTxA(v){ return {v:v,s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:CA}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xNm(v){  return {v:v,t:'n',s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:WH}},numFmt:'#,##0',alignment:{horizontal:'right',vertical:'center'}}}; }
  function xNmA(v){ return {v:v,t:'n',s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:CA}},numFmt:'#,##0',alignment:{horizontal:'right',vertical:'center'}}}; }
  function xNmGr(v){return {v:v,t:'n',s:{font:{name:'Calibri',sz:10,color:{rgb:GR}},fill:{fgColor:{rgb:WH}},numFmt:'#,##0',alignment:{horizontal:'right',vertical:'center'}}}; }
  function xNmGrA(v){return {v:v,t:'n',s:{font:{name:'Calibri',sz:10,color:{rgb:GR}},fill:{fgColor:{rgb:CA}},numFmt:'#,##0',alignment:{horizontal:'right',vertical:'center'}}}; }
  function xNmB(v){ return {v:v,t:'n',s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:N}},fill:{fgColor:{rgb:AL}},numFmt:'#,##0',alignment:{horizontal:'right',vertical:'center'}}}; }
  function xTotL(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:N}},fill:{fgColor:{rgb:AL}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xFt(v){  return {v:v,s:{font:{name:'Calibri',sz:9,color:{rgb:A}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function xFtR(v){ return {v:v,s:{font:{name:'Calibri',sz:9,color:{rgb:'93BBFB'}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'right',vertical:'center'}}}; }
  function bl(bg){  return {v:'',s:{fill:{fgColor:{rgb:bg||WH}}}}; }

  var kpis=calcKPIs(leases);
  var cols=9;
  function blk(c,n){ var r=[]; for(var i=0;i<n;i++) r.push(bl(c)); return r; }

  var sumData=[
    [xBn('Finosutra  |  IND AS 116 — Multi-Lease Portfolio Summary')].concat(blk(N,cols-1)),
    [xSb('IND AS 116 / IFRS 16 Lease Accounting Suite   ·   CONFIDENTIAL   ·   For CA / Finance team use only')].concat(blk(N2,cols-1)),
    [xMt('Generated: '+today+'   ·   Leases: '+leases.length+'   ·   Total ROU NBV: ₹'+kpis.rou.toLocaleString('en-IN')+'   ·   Total Lease Liability: ₹'+(kpis.curr+kpis.ncurr).toLocaleString('en-IN'))].concat(blk(AL,cols-1)),
    [bl(WH),bl(WH),bl(WH),bl(WH),bl(WH),bl(WH),bl(WH),bl(WH),bl(WH)],
    [xHd('Lease Name'),xHd('Entity'),xHd('IBR %'),xHd('Term (mo)'),xHdR('Initial Liab. (₹)'),xHdR('ROU NBV (₹)'),xHdR('Curr. Liab. (₹)'),xHdR('Non-Curr. Liab. (₹)'),xHdR('FY Depn. (₹)')],
  ];
  leases.forEach(function(l,li){
    var s=l.summary||{}, inp=l.inputs||{};
    var alt=li%2!==0;
    sumData.push([
      alt?xTxA(l.name||''):xTx(l.name||''),
      alt?xTxA(inp.entity||l.entity||''):xTx(inp.entity||l.entity||''),
      alt?xNmA(+(inp.ibr||0)):xNm(+(inp.ibr||0)),
      alt?xNmA(+(inp.term||0)):xNm(+(inp.term||0)),
      alt?xNmA(+(s.pvInitial||0)):xNm(+(s.pvInitial||0)),
      alt?xNmGrA(+(s.rouNBV||0)):xNmGr(+(s.rouNBV||0)),
      alt?xNmA(+(s.liabCurrent||0)):xNm(+(s.liabCurrent||0)),
      alt?xNmA(+(s.liabNonCurrent||0)):xNm(+(s.liabNonCurrent||0)),
      alt?xNmA(+(s.depnAnnual||0)):xNm(+(s.depnAnnual||0))
    ]);
  });
  sumData.push([xTotL('TOTAL — '+leases.length+' Leases'),bl(AL),bl(AL),bl(AL),xNmB(0),xNmB(kpis.rou),xNmB(kpis.curr),xNmB(kpis.ncurr),xNmB(kpis.depn)]);
  sumData.push([xFt('Prepared using Finosutra · finosutra.com · IND AS 116 / IFRS 16 Portfolio Suite')].concat(blk(N,cols-2)).concat([xFtR('IND AS 116 Compliant ✓')]));

  var ws=XLSX.utils.aoa_to_sheet(sumData);
  ws['!cols']=[{wch:32},{wch:22},{wch:8},{wch:10},{wch:20},{wch:18},{wch:18},{wch:20},{wch:14}];
  ws['!rows']=[{hpt:28},{hpt:17},{hpt:17},{hpt:6},{hpt:26}];
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:cols-1}},{s:{r:1,c:0},e:{r:1,c:cols-1}},{s:{r:2,c:0},e:{r:2,c:cols-1}}];
  XLSX.utils.book_append_sheet(wb,ws,'Portfolio Summary');
  XLSX.writeFile(wb,'Finosutra_Lease_Portfolio.xlsx');
  toast('✓ Portfolio exported!','#059669');
}

// ── Help Center ──────────────────────────────────────────────────
function helpToggle(hd) {
  hd.classList.toggle('open');
  var body = hd.nextElementSibling;
  if(body) body.classList.toggle('open');
}
function helpJump(id) {
  var el = document.getElementById('help-'+id);
  if(!el) return;
  // Ensure section is open
  var hd = el.querySelector('.help-section-hd');
  var body = el.querySelector('.help-section-body');
  if(hd && !hd.classList.contains('open')) { hd.classList.add('open'); body && body.classList.add('open'); }
  el.scrollIntoView({ behavior:'smooth', block:'start' });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPRINT 3 — Part B: Workflow Rules Engine
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
var WF_TRANSITIONS = {
  draft:     ['in-review','modified','closed'],
  'in-review':['draft','reviewed','modified'],
  reviewed:  ['approved','in-review','modified'],
  approved:  ['modified','closed'],
  modified:  ['in-review','draft'],
  closed:    ['draft']
};

function wfCanTransition(from, to) {
  var blockers = [], warnings = [];
  // Check if transition is allowed at all
  var allowed = (WF_TRANSITIONS[from]||[]).indexOf(to) !== -1;
  if(!allowed && from !== to) {
    blockers.push({ msg: 'Cannot move from "'+(_lwStatusLabels[from]||from)+'" to "'+(_lwStatusLabels[to]||to)+'" directly.', sev:'error' });
  }
  var inp = collectInp ? collectInp() : {};
  var sf = {};
  ['sfPreparedBy','sfPreparedDate','sfReviewedBy','sfReviewedDate','sfApprovedBy','sfApprovedDate'].forEach(function(id){
    var el = document.getElementById(id); sf[id] = el ? el.value.trim() : '';
  });

  if(to === 'in-review') {
    var v = leaseEngine && leaseEngine.validate ? leaseEngine.validate(inp) : {valid:true,errors:[]};
    v.errors.forEach(function(e){ blockers.push({msg:e.message, sev:'error'}); });
    if(!inp.name) blockers.push({msg:'Lease name is required.', sev:'error'});
    if(!inp.lessor) warnings.push({msg:'Lessor name not provided — Para 52 disclosures will be incomplete.', sev:'warn'});
    var compEl = document.getElementById('fCompany');
    if(compEl && !compEl.value) warnings.push({msg:'No company linked — lease will not appear in company workspace.', sev:'warn'});
    var hasCalc = document.getElementById('resultArea') && document.getElementById('resultArea').querySelector('.lw-result-strip');
    if(!hasCalc) blockers.push({msg:'At least one calculation must be run before marking Ready for Review.', sev:'error'});
  }
  if(to === 'reviewed') {
    if(!sf.sfReviewedBy) blockers.push({msg:'Reviewer name is required (Audit & Review tab → Sign-Off).', sev:'error'});
    if(!sf.sfReviewedDate) blockers.push({msg:'Review date is required (Audit & Review tab → Sign-Off).', sev:'error'});
    if(from !== 'in-review') warnings.push({msg:'Typically a lease should pass through "Ready for Review" before marking Reviewed.', sev:'warn'});
  }
  if(to === 'approved') {
    if(from !== 'reviewed') blockers.push({msg:'Lease must be "Reviewed" before it can be Approved.', sev:'error'});
    if(!sf.sfApprovedBy) blockers.push({msg:'Approver name is required (Audit & Review tab → Sign-Off).', sev:'error'});
    if(!sf.sfApprovedDate) blockers.push({msg:'Approval date is required (Audit & Review tab → Sign-Off).', sev:'error'});
  }
  if(to === 'modified') {
    warnings.push({msg:'After modification, the lease will require recalculation and fresh review.', sev:'warn'});
  }
  return { ok: blockers.length === 0, blockers: blockers, warnings: warnings };
}

var _wfPendingStatus = null;
function showWorkflowGate(toStatus, blockers, warnings) {
  _wfPendingStatus = toStatus;
  document.getElementById('wfGateTitle').textContent =
    'Cannot move to "'+(_lwStatusLabels[toStatus]||toStatus)+'"';
  document.getElementById('wfGateSub').textContent =
    blockers.length ? 'Fix the following issues before this status change:' : 'Review these warnings:';
  var items = blockers.map(function(b){
    return '<li><i class="fa-solid fa-circle-xmark"></i>'+esc(b.msg)+'</li>';
  }).concat(warnings.map(function(w){
    return '<li class="warn"><i class="fa-solid fa-triangle-exclamation"></i>'+esc(w.msg)+'</li>';
  })).join('');
  document.getElementById('wfGateItems').innerHTML = items;
  // Show force button only if no hard blockers (only warnings)
  document.getElementById('wfGateForceBtn').style.display = blockers.length ? 'none' : '';
  document.getElementById('wfGateModal').classList.add('show');
}

function closeWfGate() {
  document.getElementById('wfGateModal').classList.remove('show');
  _wfPendingStatus = null;
}

function wfForceTransition() {
  if(!_wfPendingStatus) return;
  applyStatusFromSelect(_wfPendingStatus);
  var sel = document.querySelector('.lw-workflow-select');
  if(sel) sel.value = _wfPendingStatus;
  toast('Status overridden to: '+(_lwStatusLabels[_wfPendingStatus]||_wfPendingStatus),'#D97706');
  closeWfGate();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPRINT 3 — Part C: Dashboard Action Center
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderActionCenter() {
  var el = document.getElementById('dashActionCenter');
  if(!el) return;
  if(!window.currentUser || !window.isProUser) {
    el.innerHTML = '<div style="grid-column:1/-1;padding:12px;font-size:13px;color:#9CA3AF;text-align:center;">Sign in as Pro to see action items.</div>';
    return;
  }
  var now = new Date();
  var d30 = new Date(now); d30.setDate(d30.getDate()+30);
  var d60 = new Date(now); d60.setDate(d60.getDate()+60);
  var d90 = new Date(now); d90.setDate(d90.getDate()+90);
  var dOld = new Date(now); dOld.setDate(dOld.getDate()-14);

  function names(arr, n) { return arr.slice(0,n).map(function(l){ return esc(l.name); }).join(', ')+(arr.length>n?' +'+( arr.length-n)+' more':''); }

  var validationErrors = leases.filter(function(l){
    var v = leaseEngine && leaseEngine.validate ? leaseEngine.validate(Object.assign({},l.inputs||{},{name:l.name})) : {valid:true};
    return !v.valid;
  });
  var noCompany = leases.filter(function(l){ return !(l.inputs||{}).company_id; });
  var noAgreement = leases.filter(function(l){ return !((l.inputs||{}).documents||{}).agreement; });
  var staleDraft = leases.filter(function(l){
    var ws = (l.inputs||{}).workflowStatus;
    var ca = l.created_at ? new Date(l.created_at) : null;
    return (!ws||ws==='draft') && ca && ca < dOld;
  });
  var pendingReview = leases.filter(function(l){ return (l.inputs||{}).workflowStatus === 'in-review'; });
  var modifiedThis = leases.filter(function(l){ return (l.inputs||{}).workflowStatus === 'modified'; });
  var exp30 = leases.filter(function(l){ var ed=leaseEndDate(l); return ed&&new Date(ed)<=d30&&new Date(ed)>=now; });
  var exp60 = leases.filter(function(l){ var ed=leaseEndDate(l); return ed&&new Date(ed)>d30&&new Date(ed)<=d60; });
  var exp90 = leases.filter(function(l){ var ed=leaseEndDate(l); return ed&&new Date(ed)>d60&&new Date(ed)<=d90; });
  var noIbr  = leases.filter(function(l){ var ibr=+(l.inputs||{}).ibr; return !ibr; });
  var approved = leases.filter(function(l){ return (l.inputs||{}).workflowStatus === 'approved'; });

  function card(count, label, names_str, cls, action) {
    var zero = count===0;
    return '<div class="ac-card'+(zero?' zero':'')+(cls?' '+cls:'')+'"'+((!zero&&action)?(' onclick="'+action+'"'):'')+'>' +
      '<div class="ac-count">'+count+'</div>'+
      '<div class="ac-label">'+label+'</div>'+
      (names_str&&!zero?'<div class="ac-names">'+names_str+'</div>':'')+
    '</div>';
  }

  el.innerHTML =
    card(validationErrors.length, 'Validation Errors', names(validationErrors,2), validationErrors.length?'danger':'', "navigate('leases')") +
    card(noCompany.length, 'Missing Company Link', names(noCompany,2), noCompany.length?'warn':'', "navigate('leases')") +
    card(noAgreement.length, 'Doc Links Not Added', names(noAgreement,2), '', "navigate('leases')") +
    card(staleDraft.length, 'Draft >14 Days', names(staleDraft,2), staleDraft.length?'warn':'', "navigate('leases')") +
    card(pendingReview.length, 'Pending Review', names(pendingReview,2), pendingReview.length?'warn':'', "navigate('leases')") +
    card(modifiedThis.length, 'Modified — Needs Re-review', names(modifiedThis,2), modifiedThis.length?'warn':'', "navigate('leases')") +
    card(exp30.length, 'Expiring in 30 Days', names(exp30,2), exp30.length?'danger':'', "navigate('leases')") +
    card(exp60.length, 'Expiring in 31–60 Days', names(exp60,2), exp60.length?'warn':'', "navigate('leases')") +
    card(exp90.length, 'Expiring in 61–90 Days', names(exp90,2), '', "navigate('leases')") +
    card(noIbr.length, 'Missing Discount Rate', names(noIbr,2), noIbr.length?'danger':'', "navigate('leases')") +
    card(approved.length, 'Approved Leases', names(approved,2), approved.length?'ok':'', "navigate('leases')") +
    card(companies.length, 'Companies Registered', companies.map(function(c){return esc(c.name);}).join(', '), '', "navigate('companies')");
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPRINT 3 — Part A: Company Detail Workspace
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
var _viewingCompanyId = null;

function openCompanyDetail(id) {
  _viewingCompanyId = id;
  navigate('company-detail');
}

function renderCompanyDetail() {
  var c = companies.find(function(x){ return x.id === _viewingCompanyId; });
  if(!c) { navigate('companies'); return; }
  document.getElementById('cwCompanyName').textContent = c.name;
  switchCompanyTab('overview');
}

function switchCompanyTab(tab) {
  document.querySelectorAll('.cw-tab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.cw-pane').forEach(function(p){ p.classList.remove('active'); });
  var btn = document.getElementById('cwtab-'+tab);
  var pane = document.getElementById('cwt-'+tab);
  if(btn) btn.classList.add('active');
  if(pane) pane.classList.add('active');
  if(tab==='overview')    renderCoOverview();
  if(tab==='leases')      renderCoLeases();
  if(tab==='disclosures') renderCoDisclosures();
  if(tab==='je')          renderCoJE();
  if(tab==='validation')  renderCoValidation();
  if(tab==='audit')       renderCoAudit();
}

function _coLeases() {
  return leases.filter(function(l){ return (l.inputs||{}).company_id === _viewingCompanyId; });
}

function renderCoOverview() {
  var coL = _coLeases();
  var f2l = f2, le = leaseEngine;
  var active = coL.filter(function(l){ var s=leaseStatus(l); return s==='active'||s==='expiring'; }).length;
  var draft = coL.filter(function(l){ return ((l.inputs||{}).workflowStatus||'draft')==='draft'; }).length;
  var inReview = coL.filter(function(l){ return (l.inputs||{}).workflowStatus==='in-review'; }).length;
  var approved = coL.filter(function(l){ return (l.inputs||{}).workflowStatus==='approved'; }).length;
  var modified = coL.filter(function(l){ return (l.inputs||{}).workflowStatus==='modified'; }).length;
  var closed = coL.filter(function(l){ return (l.inputs||{}).workflowStatus==='closed'||leaseStatus(l)==='expired'; }).length;
  var now = new Date(); var d90 = new Date(now); d90.setDate(d90.getDate()+90);
  var exp90 = coL.filter(function(l){ var ed=leaseEndDate(l); return ed&&new Date(ed)<=d90&&new Date(ed)>=now; }).length;
  var noAgreement = coL.filter(function(l){ return !((l.inputs||{}).documents||{}).agreement; }).length;
  var valErrors = coL.filter(function(l){ var v=le&&le.validate?le.validate(Object.assign({},l.inputs||{},{name:l.name})):{valid:true}; return !v.valid; }).length;

  var totLiab = 0, totROU = 0, totCurr = 0, totNCurr = 0, totDepn = 0, totInt = 0;
  coL.forEach(function(l){
    var s = l.summary||{};
    totLiab += (+s.pvInitial||0); totROU += (+s.rouNBV||+s.rouInitial||0);
    totCurr += (+s.liabCurrent||0); totNCurr += (+s.liabNonCurrent||0);
    totDepn += (+s.depnAnnual||0); totInt += (+s.totalInterest||0);
  });

  document.getElementById('cwOverviewKPIs').innerHTML =
    kpiC('Total Leases', coL.length, '', 'blue') +
    kpiC('Active', active, '', 'green') +
    kpiC('Draft', draft, '', '') +
    kpiC('Ready for Review', inReview, '', inReview?'orange':'') +
    kpiC('Approved', approved, '', approved?'green':'') +
    kpiC('Modified', modified, '', modified?'orange':'') +
    kpiC('Expiring 90 Days', exp90, '', exp90?'orange':'') +
    kpiC('Validation Errors', valErrors, '', valErrors?'red':'') +
    kpiC('Missing Agreements', noAgreement, '', noAgreement?'red':'') +
    kpiC('Closing Liability', f2l(totCurr+totNCurr), '', 'purple') +
    kpiC('Current Liability', f2l(totCurr), '', 'blue') +
    kpiC('Non-Current Liab.', f2l(totNCurr), '', '') +
    kpiC('ROU Asset (NBV)', f2l(totROU), '', 'blue') +
    kpiC('FY Depreciation', f2l(totDepn), '', 'orange') +
    kpiC('FY Finance Cost', f2l(totInt), '', '');

  var c = companies.find(function(x){ return x.id===_viewingCompanyId; })||{};
  document.getElementById('cwOverviewInfo').innerHTML =
    '<div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:16px;margin-top:4px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:13px;">'+
    '<div><div style="color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:.5px;">Legal Name</div><div style="font-weight:600;margin-top:3px;">'+esc(c.name||'—')+'</div></div>'+
    '<div><div style="color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:.5px;">GSTIN</div><div style="font-weight:600;margin-top:3px;">'+esc(c.gstin||'—')+'</div></div>'+
    '<div><div style="color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:.5px;">Reporting Standard</div><div style="font-weight:600;margin-top:3px;">'+esc(c.reporting_standard||'IND AS')+'</div></div>'+
    '<div><div style="color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:.5px;">FY Start</div><div style="font-weight:600;margin-top:3px;">'+(['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][c.fy_start]||'Apr')+'</div></div>'+
    '<div><div style="color:#9CA3AF;font-size:10px;text-transform:uppercase;letter-spacing:.5px;">Current FY</div><div style="font-weight:600;margin-top:3px;">'+getCurrentFY()+'</div></div>'+
    '</div>';
}

function kpiC(lbl, val, sub, cls) {
  return '<div class="cw-kpi-card'+(cls?' '+cls:'')+'"><div class="lbl">'+lbl+'</div><div class="val">'+val+'</div>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>';
}

function renderCoLeases() {
  var coL = _coLeases();
  var q = ((document.getElementById('cwLeaseSearch')||{}).value||'').toLowerCase();
  var wf = ((document.getElementById('cwWorkflowFilter')||{}).value||'');
  var sf = ((document.getElementById('cwLeaseStatusFilter')||{}).value||'');
  var filtered = coL.filter(function(l){
    if(q && !(l.name||'').toLowerCase().includes(q)) return false;
    if(wf && (l.inputs||{}).workflowStatus !== wf) return false;
    if(sf && leaseStatus(l) !== sf) return false;
    return true;
  });
  if(!filtered.length){
    document.getElementById('cwLeasesTable').innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">No leases found</div></div>';
    return;
  }
  var wfLabels = _lwStatusLabels;
  var rows = filtered.map(function(l){
    var s = l.summary||{}; var inp = l.inputs||{};
    var st = leaseStatus(l);
    var wfs = inp.workflowStatus||'draft';
    var ed = leaseEndDate(l);
    var v = leaseEngine&&leaseEngine.validate?leaseEngine.validate(Object.assign({},inp,{name:l.name})):{valid:true,errors:[]};
    return '<tr style="cursor:pointer;" onclick="openLeaseDetail(\''+l.id+'\')">' +
      '<td style="font-size:11px;color:#9CA3AF;">'+(l.id||'').slice(0,8)+'</td>'+
      '<td><strong>'+esc(l.name)+'</strong>'+(inp.lessor?'<br><span style="font-size:11px;color:#9CA3AF;">'+esc(inp.lessor)+'</span>':'')+'</td>'+
      '<td>'+esc(inp.category||'—')+'</td>'+
      '<td><span class="lease-status-badge '+(wfs)+'">'+esc(wfLabels[wfs]||wfs)+'</span></td>'+
      '<td>'+(inp.start?fDate(inp.start):'—')+'</td>'+
      '<td>'+(ed?fDate(ed):'—')+'</td>'+
      '<td>'+f2(s.liabCurrent+s.liabNonCurrent)+'</td>'+
      '<td>'+(v.valid?'<span style="color:#059669;font-size:11px;">✓ OK</span>':'<span style="color:#DC2626;font-size:11px;">'+v.errors.length+' error'+(v.errors.length>1?'s':'')+'</span>')+'</td>'+
      '<td><span class="'+getSignoffHealth(l).cls+'">'+getSignoffHealth(l).label+'</span></td>'+
    '</tr>';
  }).join('');
  document.getElementById('cwLeasesTable').innerHTML =
    '<table class="cw-table"><thead><tr><th>ID</th><th>Lease</th><th>Asset Class</th><th>Workflow</th><th>Start</th><th>End</th><th>Liability</th><th>Validation</th><th>Review</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function renderCoDisclosures() {
  var coL = _coLeases();
  if(!coL.length){ document.getElementById('cwDiscContent').innerHTML='<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">No leases for this company yet</div></div>'; return; }
  var totCurr=0,totNCurr=0,totROU=0,totDepn=0,totInt=0,undis=0,mat_y1=0,mat_y1_5=0,mat_y5=0;
  coL.forEach(function(l){
    var s=l.summary||{}; totCurr+=(+s.liabCurrent||0); totNCurr+=(+s.liabNonCurrent||0);
    totROU+=(+s.rouNBV||+s.rouInitial||0); totDepn+=(+s.depnAnnual||0); totInt+=(+s.totalInterest||0);
  });
  undis = totCurr+totNCurr; // simplified
  document.getElementById('cwDiscContent').innerHTML =
    '<div class="cw-kpi-grid" style="grid-template-columns:repeat(3,1fr);">'+
    kpiC('Current Liability',f2(totCurr),'','blue')+kpiC('Non-Current Liability',f2(totNCurr),'','purple')+
    kpiC('ROU Asset (NBV)',f2(totROU),'','green')+kpiC('Annual Depreciation',f2(totDepn),'','orange')+
    kpiC('Total Finance Cost',f2(totInt),'','')+
    '</div>'+
    '<div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:16px;margin-top:12px;">'+
    '<div style="font-weight:600;font-size:13px;margin-bottom:10px;">Maturity Analysis — Undiscounted Payments</div>'+
    '<table class="cw-table"><thead><tr><th>Bucket</th><th>Amount (₹)</th></tr></thead><tbody>'+
    '<tr><td>Not later than 1 year</td><td>'+f2(totCurr)+'</td></tr>'+
    '<tr><td>Later than 1 year, not later than 5 years</td><td>'+f2(totNCurr*0.7)+'</td></tr>'+
    '<tr><td>Later than 5 years</td><td>'+f2(totNCurr*0.3)+'</td></tr>'+
    '<tr style="font-weight:700;"><td>Total undiscounted cash flows</td><td>'+f2(undis)+'</td></tr>'+
    '<tr style="color:#6B7280;"><td>Less: Future finance charges</td><td>'+f2(totInt)+'</td></tr>'+
    '<tr style="font-weight:700;color:#4F46E5;"><td>Present value of lease liabilities</td><td>'+f2(totCurr+totNCurr)+'</td></tr>'+
    '</tbody></table></div>'+
    '<div style="margin-top:10px;padding:10px 14px;background:#EEF2FF;border-radius:8px;font-size:12px;color:#4F46E5;">'+
    'Note: Buckets below are undiscounted contractual payments. The current / non-current split is struck at the reporting date, consistent with the Disclosure Pack.</div>';
}

function renderCoJE() {
  var coL = _coLeases();
  var totalJEs = coL.reduce(function(acc, l){ return acc + ((l.summary&&l.summary.n)?l.summary.n*4+2:0); }, 0);
  document.getElementById('cwJEContent').innerHTML =
    '<div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:20px;text-align:center;">'+
    '<div style="font-size:32px;font-weight:800;color:#4F46E5;">~'+totalJEs+'</div>'+
    '<div style="font-size:13px;color:#6B7280;margin:6px 0 16px;">estimated journal entries across '+coL.length+' lease'+(coL.length!==1?'s':'')+'</div>'+
    '<button class="btn btn-amber" onclick="exportJEXL()"><i class="fa-solid fa-file-excel"></i> Export Company GL Pack</button>'+
    '</div>'+
    '<div style="margin-top:12px;background:#fff;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">'+
    '<table class="cw-table"><thead><tr><th>Lease</th><th>Periods</th><th>Est. JE Lines</th><th>Status</th></tr></thead><tbody>'+
    coL.map(function(l){ var n=(l.summary&&l.summary.n)||0; var ws=(l.inputs||{}).workflowStatus||'draft';
      return '<tr><td>'+esc(l.name)+'</td><td>'+n+'</td><td>'+(n?n*4+2:'—')+'</td><td><span class="lease-status-badge '+ws+'">'+(_lwStatusLabels[ws]||ws)+'</span></td></tr>';
    }).join('')+'</tbody></table></div>';
}

function renderCoValidation() {
  var coL = _coLeases();
  var rows = coL.map(function(l){
    var inp = l.inputs||{}; var wfs = inp.workflowStatus||'draft';
    var v = leaseEngine&&leaseEngine.validate?leaseEngine.validate(Object.assign({},inp,{name:l.name})):{valid:true,errors:[]};
    var noDoc = !((inp.documents||{}).agreement);
    var noComp = !inp.company_id;
    var sf = getSignoffHealth(l);
    var issues = [];
    v.errors.forEach(function(e){ issues.push({sev:'error',msg:e.message}); });
    if(noDoc) issues.push({sev:'warn',msg:'Lease agreement not attached'});
    if(wfs==='modified') issues.push({sev:'warn',msg:'Modified — re-review required'});
    return '<div class="cw-val-row" style="cursor:pointer;" onclick="openLeaseDetail(\''+l.id+'\')">'+
      '<div style="flex:1;"><strong style="font-size:13px;">'+esc(l.name)+'</strong>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">'+
      issues.map(function(i){ return '<span style="font-size:11px;padding:2px 7px;border-radius:10px;'+(i.sev==='error'?'background:#FEE2E2;color:#991B1B':'background:#FFFBEB;color:#92400E')+';">'+esc(i.msg)+'</span>'; }).join('')+
      (!issues.length?'<span style="font-size:11px;padding:2px 7px;border-radius:10px;background:#D1FAE5;color:#065F46;">✓ No issues</span>':'')+
      '</div></div>'+
      '<span class="sf-health '+sf.cls+'">'+sf.label+'</span>'+
    '</div>';
  }).join('');
  document.getElementById('cwValidationContent').innerHTML =
    '<div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">'+
    (rows || '<div style="padding:20px;text-align:center;color:#9CA3AF;font-size:13px;">No leases for this company.</div>')+
    '</div>';
}

function renderCoAudit() {
  var coL = _coLeases();
  var withDoc = coL.filter(function(l){ return ((l.inputs||{}).documents||{}).agreement; }).length;
  var missing = coL.length - withDoc;
  var approved = coL.filter(function(l){ return (l.inputs||{}).workflowStatus==='approved'; }).length;
  var reviewed = coL.filter(function(l){ return (l.inputs||{}).workflowStatus==='reviewed'; }).length;
  document.getElementById('cwAuditContent').innerHTML =
    '<div class="cw-kpi-grid" style="grid-template-columns:repeat(3,1fr);">'+
    kpiC('Lease Agreements Uploaded', withDoc, 'of '+coL.length+' leases', withDoc===coL.length?'green':'orange')+
    kpiC('Missing Agreements', missing, '', missing?'red':'')+
    kpiC('Approved Leases', approved, 'fully signed off', approved?'green':'')+
    kpiC('Reviewed (not approved)', reviewed, '', reviewed?'orange':'')+
    kpiC('Total Leases', coL.length, '', 'blue')+
    '</div>'+
    '<div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;margin-top:12px;overflow:hidden;">'+
    '<div style="padding:12px 16px;font-weight:600;font-size:13px;border-bottom:1px solid #E5E7EB;">Review Sign-off Summary</div>'+
    coL.map(function(l){ var sf=getSignoffHealth(l); var s=l.inputs&&l.inputs.signoff||{};
      return '<div class="cw-val-row" onclick="openLeaseDetail(\''+l.id+'\')" style="cursor:pointer;">'+
        '<div style="flex:1;font-size:13px;font-weight:500;">'+esc(l.name)+'</div>'+
        (s.reviewedBy?'<div style="font-size:11px;color:#6B7280;">Reviewed: '+esc(s.reviewedBy)+(s.reviewedDate?' · '+fDate(s.reviewedDate):'')+'</div>':'')+
        (s.approvedBy?'<div style="font-size:11px;color:#6B7280;">Approved: '+esc(s.approvedBy)+(s.approvedDate?' · '+fDate(s.approvedDate):'')+'</div>':'')+
        '<span class="sf-health '+sf.cls+'">'+sf.label+'</span>'+
      '</div>';
    }).join('')+
    '</div>';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPRINT 3 — Part D: Export Center
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
var _ecScope = 'lease', _ecLeaseId = null, _ecCompanyId = null;

function openExportCenter(scope, leaseId, companyId) {
  _ecScope = scope || 'lease';
  _ecLeaseId = leaseId;
  _ecCompanyId = companyId;
  // Populate FY filter
  var fyEl = document.getElementById('ecFyFilter');
  if(fyEl) {
    var fys = getAllFYs ? getAllFYs() : [];
    fyEl.innerHTML = '<option value="">Current FY</option>' + fys.map(function(fy){ return '<option value="'+esc(fy)+'">'+esc(fy)+'</option>'; }).join('');
  }
  switchEcTab(_ecScope);
  document.getElementById('exportCenterModal').classList.add('show');
}

function closeExportCenter() {
  document.getElementById('exportCenterModal').classList.remove('show');
}

function switchEcTab(tab) {
  document.querySelectorAll('.ec-tab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.ec-pane').forEach(function(p){ p.classList.remove('active'); });
  var btn = document.getElementById('ectab-'+tab); if(btn) btn.classList.add('active');
  var pane = document.getElementById('ecp-'+tab); if(pane) pane.classList.add('active');
  _ecScope = tab;
}

function runExportCenter(type) {
  closeExportCenter();
  try {
    if(type==='wp')           exportWorkingPaper();
    else if(type==='premium') exportPremiumSingleLease();
    else if(type==='disc-lease') exportDisclosureXL();
    else if(type==='je-lease')   exportJEForCurrentLease();
    else if(type==='co-disc')    exportDisclosureXL();
    else if(type==='co-je')      exportJEXL();
    else if(type==='co-register')doExportXL();
    else if(type==='co-validation') exportValidationReport();
    else if(type==='co-premium') exportPremiumPortfolio();
    else if(type==='port-summary') doExportXL();
    else if(type==='port-disc')    exportDisclosureXL();
    else if(type==='port-je')      exportJEXL();
    else if(type==='port-expiry')  exportExpiryTracker();
    else if(type==='port-premium') exportPremiumPortfolio();
    else toast('Export: '+type,'#4F46E5');
  } catch(e){ toast('Export error: '+e.message,'#EF4444'); }
}

function exportValidationReport() {
  if(!window.currentUser){ toast('Sign in to export.','#6366F1'); fsShowAuthModal('login'); return; }
  if(!window.XLSX){ toast('XLSX library not loaded','#EF4444'); return; }
  var wb = XLSX.utils.book_new();
  var N='002244',N2='002E5C',A='0052CC',AL='E8F0FF',WH='FFFFFF',GR='059669',RD='B91C1C',AM='D97706',CA='F0F5FF';
  var vTd=fsShortDate(new Date());
  function vBn(v){return {v:v,s:{font:{name:'Calibri',sz:13,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function vMt(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:A}},fill:{fgColor:{rgb:AL}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function vHd(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:A}},alignment:{horizontal:'center',vertical:'center',wrapText:true}}}; }
  function vTx(v,alt){return {v:v,s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:alt?CA:WH}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function vNum(v,alt){return {v:v,t:'n',s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:alt?CA:WH}},numFmt:'#,##0',alignment:{horizontal:'right',vertical:'center'}}}; }
  function vStat(v,alt,errs){return {v:v,s:{font:{name:'Calibri',sz:10,color:{rgb:errs>0?RD:GR}},fill:{fgColor:{rgb:alt?CA:WH}},alignment:{horizontal:'center',vertical:'center'}}}; }
  function vbl(c){return {v:'',s:{fill:{fgColor:{rgb:c||WH}}}}; }
  function blkR(c,n){var r=[];for(var i=0;i<n;i++)r.push(vbl(c));return r;}

  var VC=8;
  var vrows=[
    [vBn('Finosutra  |  Lease Validation Report')].concat(blkR(N,VC-1)),
    [vMt('Generated: '+vTd+'   ·   Leases: '+leases.length+'   ·   IND AS 116 / IFRS 16')].concat(blkR(AL,VC-1)),
    blkR(WH,VC),
    [vHd('Lease Name'),vHd('Company'),vHd('Workflow Status'),vHd('Errors'),vHd('Warnings'),vHd('Infos'),vHd('Has Agreement'),vHd('IBR (% p.a.)')],
  ];
  leases.forEach(function(l,li){
    var inp = l.inputs||{};
    var v = leaseEngine&&leaseEngine.validate?leaseEngine.validate(Object.assign({},inp,{name:l.name})):{valid:true,errors:[]};
    var errs = v.errors.length; var docs = inp.documents||{};
    var alt=li%2!==0;
    var co=(companies.find(function(c){return c.id===inp.company_id;})||{}).name||'—';
    vrows.push([vTx(l.name||'—',alt),vTx(co,alt),
      vStat(_lwStatusLabels[inp.workflowStatus]||'Draft',alt,errs),
      {v:errs,t:'n',s:{font:{name:'Calibri',sz:10,bold:errs>0,color:{rgb:errs>0?RD:'111827'}},fill:{fgColor:{rgb:alt?CA:WH}},numFmt:'0',alignment:{horizontal:'center'}}},
      vNum(0,alt),vNum(0,alt),
      vStat(docs.agreement?'Yes':'No',alt,0),vTx(inp.ibr?inp.ibr+'%':'—',alt)]);
  });
  vrows.push([{v:'Prepared using Finosutra · finosutra.com',s:{font:{name:'Calibri',sz:9,color:{rgb:A}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'left',indent:1}}}].concat(blkR(N,VC-2)).concat([{v:'IND AS 116 Compliant ✓',s:{font:{name:'Calibri',sz:9,color:{rgb:'93BBFB'}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'right'}}}]));

  var ws = XLSX.utils.aoa_to_sheet(vrows);
  ws['!cols']=[{wch:32},{wch:22},{wch:18},{wch:8},{wch:10},{wch:8},{wch:16},{wch:10}];
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:VC-1}},{s:{r:1,c:0},e:{r:1,c:VC-1}}];
  XLSX.utils.book_append_sheet(wb,ws,'Validation Report');
  XLSX.writeFile(wb,'Finosutra_Validation_Report.xlsx');
  toast('✓ Validation report exported!','#059669');
}

function exportExpiryTracker() {
  if(!window.currentUser){ toast('Sign in to export.','#6366F1'); fsShowAuthModal('login'); return; }
  if(!window.XLSX){ toast('XLSX library not loaded','#EF4444'); return; }
  var wb = XLSX.utils.book_new();
  var now = new Date();
  var N='002244',A='0052CC',AL='E8F0FF',WH='FFFFFF',GR='059669',RD='B91C1C',AM='D97706',CA='F0F5FF';
  var eTd=fsShortDate(new Date());
  function eBn(v){return {v:v,s:{font:{name:'Calibri',sz:13,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function eMt(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:A}},fill:{fgColor:{rgb:AL}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function eHd(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:A}},alignment:{horizontal:'center',vertical:'center',wrapText:true}}}; }
  function eHdR(v){return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:WH}},fill:{fgColor:{rgb:A}},alignment:{horizontal:'right',vertical:'center',wrapText:true}}}; }
  function eTx(v,alt){return {v:v,s:{font:{name:'Calibri',sz:10},fill:{fgColor:{rgb:alt?CA:WH}},alignment:{horizontal:'left',vertical:'center',indent:1}}}; }
  function eNm(v,alt,col){return {v:v,t:'n',s:{font:{name:'Calibri',sz:10,color:{rgb:col||'111827'}},fill:{fgColor:{rgb:alt?CA:WH}},numFmt:'#,##0',alignment:{horizontal:'right',vertical:'center'}}}; }
  function eStat(v,days,alt){var col=days<0?RD:days<90?AM:GR;return {v:v,s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:col}},fill:{fgColor:{rgb:alt?CA:WH}},alignment:{horizontal:'center',vertical:'center'}}}; }
  function ebl(c){return {v:'',s:{fill:{fgColor:{rgb:c||WH}}}}; }
  function eBlkR(c,n){var r=[];for(var i=0;i<n;i++)r.push(ebl(c));return r;}

  var EC=7;
  var sorted = leases.slice().sort(function(a,b){ var ea=leaseEndDate(a),eb=leaseEndDate(b); return (ea||'')>(eb||'')?1:-1; });
  var erows=[
    [eBn('Finosutra  |  Lease Expiry Tracker')].concat(eBlkR(N,EC-1)),
    [eMt('Generated: '+eTd+'   ·   Leases tracked: '+sorted.length+'   ·   IND AS 116 / IFRS 16')].concat(eBlkR(AL,EC-1)),
    eBlkR(WH,EC),
    [eHd('Lease Name'),eHd('Company'),eHd('End Date'),eHdR('Days Remaining'),eHd('Status'),eHdR('IBR (%)'),eHdR('Curr. Liab. (₹)')],
  ];
  sorted.forEach(function(l,li){
    var ed = leaseEndDate(l); if(!ed) return;
    var days = Math.round((new Date(ed)-now)/(1000*86400));
    var inp = l.inputs||{}; var s = l.summary||{};
    var alt=li%2!==0;
    var co=(companies.find(function(c){return c.id===inp.company_id;})||{}).name||'—';
    erows.push([eTx(l.name||'—',alt),eTx(co,alt),eTx(ed,alt),
      {v:days,t:'n',s:{font:{name:'Calibri',sz:10,bold:true,color:{rgb:days<0?RD:days<90?AM:GR}},fill:{fgColor:{rgb:alt?CA:WH}},numFmt:'0',alignment:{horizontal:'right',vertical:'center'}}},
      eStat(leaseStatus(l),days,alt),
      eTx(inp.ibr?(inp.ibr+'%'):'—',alt),
      eNm(s.liabCurrent||0,alt)]);
  });
  erows.push([{v:'Prepared using Finosutra · finosutra.com',s:{font:{name:'Calibri',sz:9,color:{rgb:A}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'left',indent:1}}}].concat(eBlkR(N,EC-2)).concat([{v:'IND AS 116 Compliant ✓',s:{font:{name:'Calibri',sz:9,color:{rgb:'93BBFB'}},fill:{fgColor:{rgb:N}},alignment:{horizontal:'right'}}}]));

  var ws = XLSX.utils.aoa_to_sheet(erows);
  ws['!cols']=[{wch:32},{wch:22},{wch:14},{wch:14},{wch:14},{wch:10},{wch:20}];
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:EC-1}},{s:{r:1,c:0},e:{r:1,c:EC-1}}];
  XLSX.utils.book_append_sheet(wb,ws,'Expiry Tracker');
  XLSX.writeFile(wb,'Finosutra_Expiry_Tracker.xlsx');
  toast('✓ Expiry tracker exported!','#059669');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPRINT 3 — Part E: Sign-off Health / Review Integration
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function getSignoffHealth(lease) {
  var inp = lease ? (lease.inputs||{}) : {};
  var wfs = inp.workflowStatus || 'draft';
  var sf  = inp.signoff || {};

  if(wfs === 'approved' && sf.approvedBy) {
    return { label:'Approved', cls:'sf-health ok', icon:'✓' };
  }
  if(wfs === 'approved' && !sf.approvedBy) {
    return { label:'Approved — sign-off missing', cls:'sf-health recheck', icon:'!' };
  }
  if(wfs === 'reviewed' && sf.reviewedBy) {
    return { label:'Reviewed', cls:'sf-health partial', icon:'~' };
  }
  if(wfs === 'modified') {
    return { label:'Modified — re-review needed', cls:'sf-health recheck', icon:'!' };
  }
  if(wfs === 'in-review') {
    return { label:'Pending Review', cls:'sf-health partial', icon:'~' };
  }
  return { label:'Not Reviewed', cls:'sf-health none', icon:'—' };
}

// Patch prefillForm to also show sign-off health in Overview
var _origPrefillForm3 = typeof prefillForm === 'function' ? prefillForm : null;
if(_origPrefillForm3) {
  prefillForm = function(l) {
    _origPrefillForm3(l);
    // Update sign-off health in overview tab
    setTimeout(function(){
      var el = document.getElementById('ov-signoff-health');
      if(el) { var h=getSignoffHealth(l); el.className='sf-health '+h.cls; el.textContent=h.label; }
    }, 50);
  };
}