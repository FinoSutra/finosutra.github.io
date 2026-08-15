/* ═══════════════════════════════════════════════════════════════════
   footer.js — Finosutra shared footer
   Injected into every page so there's one copy to maintain.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var columns = [
    {
      heading: 'Tools',
      links: [
        { label: 'IND AS 116 Lease Workspace', href: '/app.html' },
        { label: 'Standard Lease Calculator', href: '/indas116.html' },
        { label: 'Lease Modification', href: '/indas116-model2.html' },
        { label: 'Escalating Rent Calculator', href: '/indas116-model3.html' },
        { label: 'Security Deposit (IND AS 109)', href: '/security-deposit.html' },
        { label: 'ECL Provision Matrix', href: '/ecl-calculator.html' }
      ]
    },
    {
      heading: 'Tax',
      links: [
        { label: 'GST Calculator', href: '/gst-calculator.html' },
        { label: 'GST Interest & Late Fee', href: '/gst-interest-late-fee-calculator.html' },
        { label: 'Income Tax Calculator', href: '/india-tax-calculator.html' },
        { label: 'Capital Gains', href: '/capital-gains-calculator.html' },
        { label: 'Advance Tax', href: '/advance-tax-calculator.html' },
        { label: 'HRA Exemption', href: '/hra-calculator.html' }
      ]
    },
    {
      heading: 'Resources',
      links: [
        { label: 'Blog', href: '/blog.html' },
        { label: 'Templates', href: '/templates.html' },
        { label: 'All IND AS Tools', href: '/indas-tools.html' },
        { label: 'All GST Tools', href: '/gst-tools.html' },
        { label: 'All Income Tax Tools', href: '/income-tax-hub.html' }
      ]
    },
    {
      heading: 'Company',
      links: [
        { label: 'Pricing', href: '/index.html#pricing' },
        { label: 'Contact', href: '/index.html#contact' },
        { label: 'Privacy Policy', href: '/privacy.html' },
        { label: 'Terms of Service', href: '/terms.html' }
      ]
    }
  ];

  function buildFooter() {
    var footer = document.createElement('footer');
    footer.className = 'fs-footer';
    footer.setAttribute('role', 'contentinfo');

    var inner = document.createElement('div');
    inner.className = 'fs-footer-inner';

    // Grid
    var grid = document.createElement('div');
    grid.className = 'fs-footer-grid';

    // Brand column
    var brandCol = document.createElement('div');

    var brandRow = document.createElement('div');
    brandRow.className = 'fs-footer-brand-row';

    var brandIconWrap = document.createElement('span');
    brandIconWrap.className = 'fs-footer-brand-icon';
    var brandIcon = document.createElement('img');
    brandIcon.src = '/favicon.svg';
    brandIcon.alt = '';
    brandIcon.setAttribute('aria-hidden', 'true');
    brandIconWrap.appendChild(brandIcon);
    brandRow.appendChild(brandIconWrap);

    var brandText = document.createElement('div');

    var brandName = document.createElement('div');
    brandName.className = 'fs-footer-brand';
    brandName.textContent = 'Finosutra';
    brandText.appendChild(brandName);

    var brandTag = document.createElement('div');
    brandTag.className = 'fs-footer-brand-tag';
    brandTag.textContent = '— FINANCE ON AUTOPILOT';
    brandText.appendChild(brandTag);

    brandRow.appendChild(brandText);
    brandCol.appendChild(brandRow);

    var desc = document.createElement('p');
    desc.className = 'fs-footer-desc';
    desc.textContent = 'Professional finance tools built for Indian CAs, CFOs and finance teams.';
    brandCol.appendChild(desc);

    var social = document.createElement('div');
    social.className = 'fs-footer-social';

    var socialLinks = [
      { href: 'mailto:hello@finosutra.com', icon: 'envelope', label: 'Email' },
      { href: 'https://wa.me/918208063319', icon: 'whatsapp', label: 'WhatsApp', brand: true },
      { href: 'https://www.linkedin.com/company/finosutra07/', icon: 'linkedin-in', label: 'LinkedIn', brand: true },
      { href: 'https://www.youtube.com/@cakrishnaswadekar07', icon: 'youtube', label: 'YouTube', brand: true }
    ];

    socialLinks.forEach(function (s) {
      var a = document.createElement('a');
      a.href = s.href;
      a.title = s.label;
      a.setAttribute('aria-label', s.label);
      if (s.href.indexOf('mailto:') !== 0) a.target = '_blank';
      a.rel = 'noopener';
      var i = document.createElement('i');
      i.className = (s.brand ? 'fa-brands' : 'fa-solid') + ' fa-' + s.icon;
      a.appendChild(i);
      social.appendChild(a);
    });

    brandCol.appendChild(social);
    grid.appendChild(brandCol);

    // Link columns
    columns.forEach(function (col) {
      var colDiv = document.createElement('div');
      colDiv.className = 'fs-footer-col';

      var h5 = document.createElement('h5');
      h5.textContent = col.heading;
      colDiv.appendChild(h5);

      col.links.forEach(function (lk) {
        var a = document.createElement('a');
        a.href = lk.href;
        a.textContent = lk.label;
        colDiv.appendChild(a);
      });

      grid.appendChild(colDiv);
    });

    inner.appendChild(grid);

    // Bottom bar
    var bottom = document.createElement('div');
    bottom.className = 'fs-footer-bottom';

    var copy = document.createElement('p');
    var year = new Date().getFullYear();
    copy.textContent = '© ' + year + ' Finosutra. All rights reserved. Made with care in Mumbai, India.';
    bottom.appendChild(copy);

    var legalLinks = document.createElement('p');
    var legalItems = [
      { label: 'Privacy', href: '/privacy.html' },
      { label: 'Terms', href: '/terms.html' },
      { label: 'hello@finosutra.com', href: 'mailto:hello@finosutra.com' }
    ];
    legalItems.forEach(function (item, i) {
      if (i > 0) legalLinks.appendChild(document.createTextNode(' · '));
      var a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      legalLinks.appendChild(a);
    });
    bottom.appendChild(legalLinks);

    inner.appendChild(bottom);
    footer.appendChild(inner);

    return footer;
  }

  function init() {
    var placeholder = document.getElementById('fs-footer');
    var footer = buildFooter();

    if (placeholder) {
      placeholder.parentNode.replaceChild(footer, placeholder);
    } else {
      document.body.appendChild(footer);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
