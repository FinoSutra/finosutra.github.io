/* ═══════════════════════════════════════════════════════════════════
   nav.js — Finosutra shared navigation
   Injected into every page so there's one copy to maintain.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var currentPage = location.pathname.split('/').pop() || 'index.html';

  function isActive(href) {
    var hashIdx = href.indexOf('#');
    var path = hashIdx === -1 ? href : href.slice(0, hashIdx);
    var hash = hashIdx === -1 ? '' : href.slice(hashIdx);
    var target = path.split('/').pop() || 'index.html';
    if (target !== currentPage) return false;
    if (hash) return location.hash === hash;
    return true;
  }

  var links = [
    { label: 'Tools', href: '#', dropdown: true },
    { label: 'Resources', href: '#', simpleDropdown: [
        { label: 'Blog', href: '/blog.html' },
        { label: 'Templates & Workpapers', href: '/templates.html' }
      ] },
    { label: 'Pricing', href: '/index.html#pricing' }
  ];

  var dropdownCols = [
    {
      heading: 'Accounting',
      items: [
        { label: 'IND AS 116 — Lease Workspace', href: '/app.html' },
        { label: 'Standard Lease Calculator', href: '/indas116.html' },
        { label: 'Lease Modification', href: '/indas116-model2.html' },
        { label: 'Escalating Rent Calculator', href: '/indas116-model3.html' },
        { label: 'Security Deposit (IND AS 109)', href: '/security-deposit.html' },
        { label: 'SD Portfolio', href: '/sd-portfolio.html' },
        { label: 'ECL Provision Matrix', href: '/ecl-calculator.html' },
        { label: 'Financial Statement Generator', href: '/financial-statement.html' }
      ]
    },
    {
      heading: 'Tax',
      items: [
        { label: 'GST Calculator', href: '/gst-calculator.html' },
        { label: 'GST Interest & Late Fee', href: '/gst-interest-late-fee-calculator.html' },
        { label: 'Income Tax Calculator', href: '/india-tax-calculator.html' },
        { label: 'Capital Gains Calculator', href: '/capital-gains-calculator.html' },
        { label: 'Advance Tax Calculator', href: '/advance-tax-calculator.html' },
        { label: 'HRA Exemption', href: '/hra-calculator.html' }
      ]
    },
    {
      heading: 'More',
      items: [
        { label: 'All IND AS Tools', href: '/indas-tools.html' },
        { label: 'All GST Tools', href: '/gst-tools.html' },
        { label: 'All Income Tax Tools', href: '/income-tax-hub.html' }
      ]
    }
  ];

  function buildDropdown() {
    var dd = document.createElement('div');
    dd.className = 'fs-nav-dropdown';
    dd.setAttribute('role', 'menu');

    dropdownCols.forEach(function (col) {
      var colDiv = document.createElement('div');
      colDiv.className = 'fs-nav-dd-col';

      var h6 = document.createElement('h6');
      h6.textContent = col.heading;
      colDiv.appendChild(h6);

      col.items.forEach(function (item) {
        var a = document.createElement('a');
        a.href = item.href;
        a.textContent = item.label;
        a.setAttribute('role', 'menuitem');
        if (isActive(item.href)) a.className = 'active';
        colDiv.appendChild(a);
      });

      dd.appendChild(colDiv);
    });

    return dd;
  }

  function buildSimpleDropdown(items) {
    var dd = document.createElement('div');
    dd.className = 'fs-nav-dropdown fs-nav-dropdown-simple';
    dd.setAttribute('role', 'menu');

    items.forEach(function (item) {
      var a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      a.setAttribute('role', 'menuitem');
      if (isActive(item.href)) a.className = 'active';
      dd.appendChild(a);
    });

    return dd;
  }

  function buildNav() {
    var nav = document.createElement('nav');
    nav.className = 'fs-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main');

    var inner = document.createElement('div');
    inner.className = 'fs-nav-inner';

    // Logo
    var logo = document.createElement('a');
    logo.href = '/index.html';
    logo.className = 'fs-nav-logo';
    logo.setAttribute('aria-label', 'Finosutra home — Finance on Autopilot');
    var logoImg = document.createElement('img');
    logoImg.src = '/favicon.svg';
    logoImg.alt = '';
    logoImg.setAttribute('aria-hidden', 'true');
    logoImg.loading = 'eager';
    logoImg.width = 36;
    logoImg.height = 36;
    logo.appendChild(logoImg);
    var logoText = document.createElement('div');
    logoText.className = 'fs-nav-logo-text';
    var logoWord = document.createElement('div');
    logoWord.className = 'fs-nav-logo-word';
    logoWord.textContent = 'Finosutra';
    var logoTag = document.createElement('div');
    logoTag.className = 'fs-nav-logo-tag';
    logoTag.textContent = '— FINANCE ON AUTOPILOT';
    logoText.appendChild(logoWord);
    logoText.appendChild(logoTag);
    logo.appendChild(logoText);
    inner.appendChild(logo);

    // Links
    var ul = document.createElement('ul');
    ul.className = 'fs-nav-links';
    ul.id = 'fsNavLinks';

    links.forEach(function (lk) {
      var li = document.createElement('li');

      if (lk.dropdown || lk.simpleDropdown) {
        li.className = 'fs-nav-dd-trigger';
        li.style.position = 'relative';
        var a = document.createElement('a');
        a.href = lk.href;
        a.textContent = lk.label + ' ';
        a.setAttribute('aria-haspopup', 'true');
        a.setAttribute('aria-expanded', 'false');
        var caret = document.createElement('span');
        caret.textContent = '▾';
        caret.style.fontSize = '10px';
        caret.style.opacity = '0.6';
        a.appendChild(caret);
        a.addEventListener('click', function (e) { e.preventDefault(); });
        li.appendChild(a);
        li.appendChild(lk.dropdown ? buildDropdown() : buildSimpleDropdown(lk.simpleDropdown));
      } else {
        var a2 = document.createElement('a');
        a2.href = lk.href;
        a2.textContent = lk.label;
        if (isActive(lk.href)) a2.className = 'active';
        li.appendChild(a2);
      }

      ul.appendChild(li);
    });

    // Auth placeholder for mobile
    var authLi = document.createElement('li');
    authLi.id = 'navAuthMobile';
    ul.appendChild(authLi);

    inner.appendChild(ul);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'fs-nav-actions';
    actions.id = 'navActions';

    var signIn = document.createElement('a');
    signIn.className = 'fs-btn fs-btn-ghost';
    signIn.textContent = 'Sign in';
    signIn.href = '#';
    signIn.id = 'fsNavSignIn';
    signIn.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof fsShowAuthModal === 'function') fsShowAuthModal('login');
    });

    var getStarted = document.createElement('a');
    getStarted.className = 'fs-btn fs-btn-primary fs-btn-sm';
    getStarted.textContent = 'Get started';
    getStarted.href = '/app.html';

    actions.appendChild(signIn);
    actions.appendChild(getStarted);
    inner.appendChild(actions);

    // Toggle button
    var toggle = document.createElement('button');
    toggle.className = 'fs-nav-toggle';
    toggle.id = 'fsNavToggle';
    toggle.setAttribute('aria-label', 'Toggle menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    inner.appendChild(toggle);

    nav.appendChild(inner);
    return nav;
  }

  function init() {
    var placeholder = document.getElementById('fs-nav');
    var nav = buildNav();

    if (placeholder) {
      placeholder.parentNode.replaceChild(nav, placeholder);
    } else {
      document.body.insertBefore(nav, document.body.firstChild);
    }

    // Mobile toggle
    var toggle = document.getElementById('fsNavToggle');
    var navLinks = document.getElementById('fsNavLinks');

    if (toggle && navLinks) {
      toggle.addEventListener('click', function () {
        var open = navLinks.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.innerHTML = open
          ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      });

      document.addEventListener('click', function (e) {
        if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
          navLinks.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
        }
      });
    }

    // Update auth state when ready
    if (typeof window.fsOnAuthReady === 'function') {
      window.fsOnAuthReady(updateAuthUI);
    } else {
      window.addEventListener('fs-auth-ready', function () {
        updateAuthUI();
      });
    }
  }

  function updateAuthUI() {
    var signIn = document.getElementById('fsNavSignIn');
    if (!signIn) return;

    if (typeof fsGetUser === 'function') {
      var user = fsGetUser();
      if (user) {
        signIn.textContent = user.email ? user.email.split('@')[0] : 'Account';
        signIn.href = '/profile.html';
        signIn.onclick = null;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
