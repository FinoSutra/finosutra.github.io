// ═══════════════════════════════════════════════════════════════════════
// Finosutra — Premium Export Engine v1.0
// IND AS 116 Lease Accounting — Big-4 Style Report Pack
// ═══════════════════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  // ── Brand constants ─────────────────────────────────────────────────
  var BRAND = {
    name:    'Finosutra',
    tagline: 'Finance on Autopilot',
    site:    'finosutra.com',
    version: 'v3.0',
    std:     'IND AS 116 / IFRS 16'
  };

  var CLR = {
    navy:      '002244', // Corporate Navy — dark banner
    navyDark:  '001830', // deeper navy
    purple:    '0052CC', // Corporate Navy accent blue
    purpleLight:'E8F0FF', // accent light
    indigo:    '002E5C', // subtitle navy
    accent:    'D97706', // amber — highlights
    accentLt:  'FEF3C7',
    green:     '059669',
    greenLt:   'D1FAE5',
    red:       'DC2626',
    redLt:     'FEE2E2',
    grey1:     'F0F5FF', // alt row tint (navy-tinted)
    grey2:     'F5F8FF',
    grey3:     'BAD0F8', // border
    grey4:     '6B7280',
    text:      '111827',
    textMid:   '374151',
    white:     'FFFFFF',
  };

  // ── Style factories — Corporate Navy (matches Working Paper format) ──
  // Banner row 1: dark navy bg, white bold title
  function sBanner(v) {
    return { v: v, t: 's', s: { font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: CLR.navy } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 } } };
  }
  // Banner row 2: subtitle navy bg, accent-label text
  function sSub(v) {
    return { v: v, t: 's', s: { font: { name: 'Calibri', sz: 10, color: { rgb: '93BBFB' } }, fill: { fgColor: { rgb: CLR.indigo } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 } } };
  }
  // Banner row 3: accent-light bg, bold accent text
  function sMeta(v) {
    return { v: v, t: 's', s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.purple } }, fill: { fgColor: { rgb: CLR.purpleLight } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 } } };
  }
  // Section header: accent blue bg, white bold text (full-width)
  function subHdr(sz) {
    return { font: { name: 'Calibri', sz: sz || 11, bold: true, color: { rgb: CLR.white } },
             fill: { fgColor: { rgb: CLR.purple } },
             alignment: { horizontal: 'left', vertical: 'center', indent: 1 } };
  }
  // Column header: accent blue bg, white bold, centered
  function navyHdr(sz) {
    return { font: { name: 'Calibri', sz: sz || 10, bold: true, color: { rgb: CLR.white } },
             fill: { fgColor: { rgb: CLR.purple } },
             alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
  }
  function navyHdrR(sz) {
    return { font: { name: 'Calibri', sz: sz || 10, bold: true, color: { rgb: CLR.white } },
             fill: { fgColor: { rgb: CLR.purple } },
             alignment: { horizontal: 'right', vertical: 'center', wrapText: true } };
  }
  // Total row: accent-light bg, navy bold text + number
  function totalLabel() {
    return { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.navy } },
             fill: { fgColor: { rgb: CLR.purpleLight } },
             alignment: { horizontal: 'left', indent: 1 } };
  }
  function totalRow() {
    return { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.navy } },
             fill: { fgColor: { rgb: CLR.purpleLight } },
             numFmt: '#,##0',
             alignment: { horizontal: 'right' } };
  }
  function altRow(i) {
    return i % 2 === 0
      ? { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.text } }, fill: { fgColor: { rgb: CLR.white } } }
      : { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.textMid } }, fill: { fgColor: { rgb: CLR.grey1 } } };
  }
  function numFmt(bold) {
    return { font: { name: 'Calibri', sz: 10, bold: !!bold, color: { rgb: bold ? CLR.navy : CLR.textMid } },
             numFmt: '#,##0', alignment: { horizontal: 'right' } };
  }
  function pctFmt() {
    return { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.textMid } },
             numFmt: '0.00"%"', alignment: { horizontal: 'right' } };
  }
  function noteStyle() {
    return { font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: CLR.grey4 } },
             fill: { fgColor: { rgb: CLR.white } }, alignment: { wrapText: true } };
  }
  function kpiLbl() {
    return { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '93BBFB' } },
             fill: { fgColor: { rgb: CLR.navy } },
             alignment: { horizontal: 'center', vertical: 'bottom', wrapText: true } };
  }
  function kpiVal(color) {
    return { font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: color || CLR.navy } },
             fill: { fgColor: { rgb: CLR.white } },
             numFmt: '#,##0',
             alignment: { horizontal: 'center', vertical: 'top' },
             border: { bottom: { style: 'medium', color: { rgb: color || CLR.navy } } } };
  }
  function warningCell(sev) {
    var c = sev === 'Error' ? CLR.red : sev === 'Warning' ? CLR.accent : CLR.green;
    return { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.white } },
             fill: { fgColor: { rgb: c } }, alignment: { horizontal: 'center' } };
  }
  function metaLabel() {
    return { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.grey4 } }, alignment: { horizontal: 'right' } };
  }
  function metaValue() {
    return { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.navy } }, alignment: { horizontal: 'left' } };
  }

  // ── Cell helpers ─────────────────────────────────────────────────────
  function cv(v, s) { return { v: v, t: typeof v === 'number' ? 'n' : 's', s: s || {} }; }
  function cn(v, s) { return { v: +v || 0, t: 'n', s: s || numFmt() }; }
  function blank()   { return { v: '', t: 's', s: { fill: { fgColor: { rgb: CLR.white } } } }; }
  function blankN(c) { return { v: '', t: 's', s: { fill: { fgColor: { rgb: c || CLR.navy } } } }; }
  function empty(n)  { var r=[]; for(var i=0;i<(n||1);i++) r.push(blank()); return r; }
  function emptyN(n,c){ var r=[]; for(var i=0;i<(n||1);i++) r.push(blankN(c)); return r; }

  // ── Shared banner helper — 4 rows: banner + subtitle + meta + spacer ──
  // Returns { rows: [...], merges: [...], rowHpts: [...] }
  function sheetBanner(title, subtitle, meta, W) {
    var rows = [
      [sBanner('Finosutra  |  ' + title)].concat(emptyN(W - 1, CLR.navy)),
      [sSub(subtitle)].concat(emptyN(W - 1, CLR.indigo)),
      [sMeta(meta)].concat(emptyN(W - 1, CLR.purpleLight)),
      emptyN(W, CLR.white)
    ];
    var merges = [
      merge(0, 0, 0, W - 1),
      merge(1, 0, 1, W - 1),
      merge(2, 0, 2, W - 1)
    ];
    var rowHpts = [{ hpt: 28 }, { hpt: 17 }, { hpt: 17 }, { hpt: 6 }];
    return { rows: rows, merges: merges, rowHpts: rowHpts };
  }

  // ── Footer row — matches working paper footer (navy bg, accent text) ─
  function footerRow(cols) {
    var r = [{ v: 'Prepared using Finosutra  ·  ' + BRAND.site + '  ·  ' + BRAND.std + '  ·  ' + BRAND.version,
               t: 's', s: { font: { name: 'Calibri', sz: 9, color: { rgb: CLR.purple } }, fill: { fgColor: { rgb: CLR.navy } }, alignment: { horizontal: 'left', indent: 1 } } }];
    for (var i = 1; i < cols - 1; i++) r.push(blankN(CLR.navy));
    r.push({ v: 'IND AS 116 Compliant ✓', t: 's', s: { font: { name: 'Calibri', sz: 9, color: { rgb: '93BBFB' } }, fill: { fgColor: { rgb: CLR.navy } }, alignment: { horizontal: 'right' } } });
    return r;
  }

  function ts() {
    var n = new Date();
    return dateStr(n) + ', ' +
      n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  // en-IN renders September as "Sept", which reads as a typo beside "Mar"/"Jun".
  // Format explicitly so every month is three letters.
  var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function dateStr(d) {
    if (!d) return '—';
    try {
      // Date-only strings are read component-wise: new Date('2026-03-31') is UTC
      // midnight, which renders as the 30th anywhere behind UTC.
      var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
      if (iso) return iso[3] + ' ' + MONTHS_SHORT[+iso[2] - 1] + ' ' + iso[1];
      var dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return d;
      return String(dt.getDate()).padStart(2, '0') + ' ' +
             MONTHS_SHORT[dt.getMonth()] + ' ' + dt.getFullYear();
    } catch (e) { return d; }
  }
  function indian(n) {
    return (n === null || n === undefined) ? '—' :
      '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });
  }

  // ── Freeze pane helper ───────────────────────────────────────────────
  function freeze(row, col) {
    return { state: 'frozen', xSplit: col || 0, ySplit: row || 1, topLeftCell: (col ? XLSX.utils.encode_cell({ r: row, c: col }) : undefined) };
  }

  // ── Apply style to a range ───────────────────────────────────────────
  function applyRangeStyle(ws, r1, c1, r2, c2, s) {
    for (var r = r1; r <= r2; r++) {
      for (var c = c1; c <= c2; c++) {
        var addr = XLSX.utils.encode_cell({ r: r, c: c });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };
        ws[addr].s = s;
      }
    }
  }

  // ── Merge helper ─────────────────────────────────────────────────────
  function merge(r1, c1, r2, c2) { return { s: { r: r1, c: c1 }, e: { r: r2, c: c2 } }; }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 1 — Cover Page
  // ════════════════════════════════════════════════════════════════════
  function buildCoverSheet(meta) {
    var W = 6;
    var ban = sheetBanner(
      'IND AS 116 — Lease Accounting Report Pack',
      BRAND.std + '   ·   CONFIDENTIAL   ·   For CA / Finance team use only',
      'Entity: ' + (meta.entity || '—') + '   ·   FY: ' + (meta.fy || '—') + '   ·   Generated: ' + ts(),
      W
    );
    var rows = ban.rows.slice();
    var merges = ban.merges.slice();

    function bl(c) { return blankN(c || CLR.white); }
    function mRow(lbl, val) {
      return [bl(), cv(lbl + ' :', metaLabel()), cv(val || '—', metaValue()), bl(), bl(), bl()];
    }

    rows.push(emptyN(W, CLR.white));
    rows.push([cv('REPORT DETAILS', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(emptyN(W, CLR.white));
    rows.push(mRow('Report Type', 'IND AS 116 Lease Accounting — Premium Report Pack'));
    rows.push(mRow('Standard', BRAND.std));
    rows.push(mRow('Company / Entity', meta.entity || '—'));
    rows.push(mRow('Lease / Portfolio', meta.name || 'Multi-Lease Portfolio'));
    rows.push(mRow('Reporting Period (FY)', meta.fy || '—'));
    rows.push(mRow('Report Generated', ts()));
    rows.push(mRow('Software', 'Finosutra ' + BRAND.version + '  |  ' + BRAND.site));
    rows.push(mRow('Prepared By', meta.preparedBy || 'Finosutra User'));
    rows.push(emptyN(W, CLR.white));

    rows.push([cv('CONTENTS', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(emptyN(W, CLR.white));
    [
      ['1_Cover',               'This page — report details and contents'],
      ['2_Executive_Summary',   'Portfolio KPIs and lease-wise summary table'],
      ['3_Lease_Master',        'All lease input parameters in one register'],
      ['4_Assumptions',         'Accounting assumptions and methodology (IND AS 116)'],
      ['5_Validation',          'Input validation and exception report'],
      ['6_Amortization',        'Period-by-period amortization schedule for all leases'],
      ['7_Annual_Rollforward',  'FY-wise rollforward of liability and ROU asset'],
      ['8_Journal_Entries',     'GL-ready journal entries for ERP / Tally posting'],
      ['9_Disclosure_Note',     'IND AS 116 Para 52 disclosure note for financial statements'],
      ['10_Mgmt_Snapshot',      'Balance sheet, P&L and cash flow snapshot'],
      ['11_Audit_WP',           'Audit working papers — checklist and reconciliation'],
      ['12_Change_Log',         'Audit trail and change log'],
    ].forEach(function(item, i) {
      var alt = i % 2 !== 0;
      var bg = alt ? CLR.grey1 : CLR.white;
      rows.push([
        blankN(bg),
        cv(item[0], { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.purple } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'left', indent: 1 } }),
        cv(item[1], { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.textMid } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'left', indent: 1 } }),
        blankN(bg), blankN(bg), blankN(bg)
      ]);
      merges.push(merge(rows.length - 1, 2, rows.length - 1, W - 1));
    });

    rows.push(emptyN(W, CLR.white));
    rows.push([cv('CONFIDENTIAL — Prepared using Finosutra · finosutra.com. For CA / Finance team use only. Review all outputs before inclusion in financial statements.',{ font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: CLR.grey4 } }, fill: { fgColor: { rgb: CLR.grey2 } }, alignment: { wrapText: true, horizontal: 'left', indent: 1 } })].concat(emptyN(W - 1, CLR.grey2)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(emptyN(W, CLR.white));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 52 }, { wch: 4 }, { wch: 4 }, { wch: 4 }];
    ws['!rows'] = rows.map(function(_, i) {
      if (i === 0) return { hpt: 28 };
      if (i === 1 || i === 2) return { hpt: 17 };
      if (i === 3) return { hpt: 6 };
      return { hpt: 18 };
    });
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 2 — Executive Summary
  // ════════════════════════════════════════════════════════════════════
  function buildExecSummary(leases, calcFn, discData, fy) {
    discData = discData || {};
    var W = 10;
    var ban = sheetBanner('Executive Summary', 'Lease Portfolio Overview  ·  ' + BRAND.std, 'Leases: ' + leases.length + (fy ? '   ·   ' + fy : '') + '   ·   Generated: ' + ts(), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    // KPI row labels
    var kpiLabels = ['No. of Leases', 'Opening Liability', 'Closing Liability', 'ROU Asset NBV', 'Interest Expense', 'Depreciation', 'Cash Outflow', 'Wtd. Avg. IBR'];
    rows.push(kpiLabels.map(function (l) { return cv(l, kpiLbl()); }).concat(empty(W - kpiLabels.length)));
    var startRow = rows.length - 1;
    merges.push(merge(startRow, kpiLabels.length, startRow, W - 1));

    // KPIs come from the FY-scoped disclosure data so this row describes the SAME
    // period as the rest of the pack. It previously mixed whole-of-life interest and
    // cash with one year of depreciation, and reported the day-1 liability as closing.
    var agg = {
      count:    discData.leaseCount || 0,
      openL:    discData.totOpenL   || 0,
      closeL:   discData.totCloseL  || 0,
      rou:      discData.totCloseROU|| 0,
      interest: discData.totInterest|| 0,
      dep:      discData.totDep     || 0,
      cash:     discData.totCashOut || 0
    };
    var wIBR = discData.wAvgIBR || 0;

    var kpiVals = [
      { v: agg.count, s: kpiVal(CLR.navy) },
      { v: agg.openL, s: kpiVal(CLR.purple) },
      { v: agg.closeL, s: kpiVal(CLR.indigo) },
      { v: agg.rou, s: kpiVal(CLR.green) },
      { v: agg.interest, s: kpiVal(CLR.accent) },
      { v: agg.dep, s: kpiVal(CLR.accent) },
      { v: agg.cash, s: kpiVal(CLR.textMid) },
      { v: wIBR, s: Object.assign(kpiVal(CLR.purple), { numFmt: '0.00"%"' }) }
    ];
    rows.push(kpiVals.map(function (k) { return { v: k.v, t: 'n', s: k.s }; }).concat(empty(W - kpiVals.length)));
    rows.push(empty(W));
    rows.push(empty(W));

    // Lease-wise summary table
    rows.push([cv('LEASE-WISE SUMMARY', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));

    // Current liability is struck at the FY-end reporting date, matching the
    // disclosure note. It previously came from the engine's commencement-date
    // default, so the same lease showed two different "current" figures in one pack.
    var fyEndRef = (function(){
      var m = /FY\s*(\d{4})/.exec(String(fy || ''));
      return m ? (parseInt(m[1], 10) + 1) + '-03-31' : null;
    })();
    var tblHdr = ['#', 'Lease Name', 'Entity', 'Start Date', 'Term (mo)', 'IBR %', 'Initial Liab. ₹', 'ROU Asset ₹', 'Curr. Liab. ₹', 'Status'];
    rows.push(tblHdr.map(function (h) { return cv(h, navyHdr()); }));
    var hdrRow = rows.length - 1;
    var idx = 1;

    // Totals are summed from the values actually printed in these columns — the KPI
    // row above is FY-scoped, so it cannot be reused for day-1 column totals.
    var colTot = { initial: 0, rou: 0, curr: 0 };
    leases.forEach(function (l, i) {
      var r = calcFn(l);
      var inp = l.inputs || {};
      var status = !r ? 'Exempt' : 'Active';
      var curLiab = 0;
      if (r) {
        curLiab = (fyEndRef && window.leaseEngine && r.res.schedule)
          ? leaseEngine.currentSplitAt(r.res.schedule, fyEndRef).current
          : r.res.liabCurrent;
        colTot.initial += r.res.pvInitial;
        colTot.rou     += r.res.rouInitial;
        colTot.curr    += curLiab;
      }
      var row = [
        cv(idx++, altRow(i)),
        cv(l.name || '—', Object.assign(altRow(i), { font: { bold: true, name: 'Calibri', sz: 10 } })),
        cv(inp.entity || l.entity || '—', altRow(i)),
        cv(dateStr(inp.start), altRow(i)),
        cn(inp.termMonths || inp.term || 0, Object.assign(altRow(i), { alignment: { horizontal: 'center' } })),
        { v: parseFloat(inp.ibr) || 0, t: 'n', s: Object.assign(altRow(i), { numFmt: '0.00"%"', alignment: { horizontal: 'right' } }) },
        r ? cn(r.res.pvInitial, Object.assign(altRow(i), { numFmt: '#,##0', alignment: { horizontal: 'right' } })) : cv('Exempt', altRow(i)),
        r ? cn(r.res.rouInitial, Object.assign(altRow(i), { numFmt: '#,##0', alignment: { horizontal: 'right' } })) : cv('—', altRow(i)),
        r ? cn(curLiab, Object.assign(altRow(i), { numFmt: '#,##0', alignment: { horizontal: 'right' } })) : cv('—', altRow(i)),
        cv(status, Object.assign(altRow(i), { alignment: { horizontal: 'center' } }))
      ];
      rows.push(row);
    });

    // Total row
    rows.push([
      cv('', totalLabel()), cv('TOTAL', totalLabel()), cv('', totalLabel()),
      cv('', totalLabel()), cv('', totalLabel()), cv('', totalLabel()),
      cn(colTot.initial, totalRow()), cn(colTot.rou, totalRow()), cn(colTot.curr, totalRow()), cv('', totalLabel())
    ]);
    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
    ws['!freeze'] = freeze(hdrRow + 1, 1);
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 3 — Lease Master Input Register
  // ════════════════════════════════════════════════════════════════════
  // Timing is stored as 'beg'/'beginning'/'advance' depending on whether the lease
  // came from the form or an upload. Checking only 'beg' labelled every uploaded
  // advance lease as "Arrears".
  function timingLabel(t) {
    var s = String(t || '').toLowerCase();
    return (s.indexOf('beg') === 0 || s.indexOf('adv') === 0) ? 'Advance' : 'Arrears';
  }
  function escTypeLabel(t) {
    return { pct: 'Percent (%)', amt: 'Fixed ₹', cpi: 'CPI / Index-linked' }[String(t || '').toLowerCase()] || 'None (flat)';
  }
  function leaseEndDate(start, termMonths) {
    if (!start || !termMonths) return '—';
    var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(start));
    var d = iso ? new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3])) : new Date(start);
    if (isNaN(d.getTime())) return '—';
    d.setUTCMonth(d.getUTCMonth() + (parseInt(termMonths, 10) || 0));
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function buildLeaseMaster(leases) {
    var W = 22;
    var ban = sheetBanner('Lease Master Input Register', 'Every input behind the computation — these figures reproduce the schedule  ·  ' + BRAND.std, 'Leases: ' + leases.length + '   ·   Generated: ' + ts(), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    var hdrs = ['#', 'Lease Name', 'Entity', 'Lessor', 'Category', 'Start Date', 'End Date',
                'Term (mo)', 'Rent/Period ₹', 'Frequency', 'Timing', 'IBR %',
                'Esc. Type', 'Esc. %', 'Esc. ₹/step', 'Esc. Interval (yrs)',
                'Rent-Free (mo)', 'IDC ₹', 'Incentive ₹', 'Restoration ₹', 'Exemption', 'Remarks'];
    rows.push(hdrs.map(function (h) { return cv(h, navyHdr()); }));
    var hdrRow = rows.length - 1;

    leases.forEach(function (l, i) {
      var inp = l.inputs || {};
      var s = altRow(i);
      var num = function (v, fmt) { return { v: v, t: 'n', s: Object.assign({}, s, { numFmt: fmt || '#,##0', alignment: { horizontal: 'right' } }) }; };
      var dash = function (v, fmt) { return (v === null || v === undefined || v === '' || !parseFloat(v)) ? cv('—', Object.assign({}, s, { alignment: { horizontal: 'right' } })) : num(parseFloat(v), fmt); };
      var escT = String(inp.escType || 'none').toLowerCase();
      var exempt = inp.isShortTerm ? 'Short-term' : inp.isLowValue ? 'Low-value' : '—';
      rows.push([
        cv(i + 1, s),
        cv(l.name || '—', Object.assign({}, s, { font: { bold: true, name: 'Calibri', sz: 10 } })),
        cv(inp.entity || l.entity || '—', s),
        cv(inp.lessor || '—', s),
        cv(inp.category || '—', s),
        cv(dateStr(inp.start), s),
        cv(dateStr(leaseEndDate(inp.start, inp.termMonths || inp.term)), s),
        cn(inp.termMonths || inp.term || 0, Object.assign({}, s, { alignment: { horizontal: 'center' } })),
        num(parseFloat(inp.pmt) || 0),
        cv({ 12: 'Monthly', 4: 'Quarterly', 2: 'Half-Yearly', 1: 'Annual' }[inp.freq] || 'Monthly', s),
        cv(timingLabel(inp.timing), s),
        num(parseFloat(inp.ibr) || 0, '0.00"%"'),
        cv(escTypeLabel(inp.escType), s),
        escT === 'pct' || escT === 'cpi' ? dash(inp.escPct, '0.00"%"') : cv('—', Object.assign({}, s, { alignment: { horizontal: 'right' } })),
        escT === 'amt' ? dash(inp.escAmt) : cv('—', Object.assign({}, s, { alignment: { horizontal: 'right' } })),
        escT === 'none' ? cv('—', Object.assign({}, s, { alignment: { horizontal: 'center' } }))
                        : cn(parseInt(inp.escYears, 10) || 1, Object.assign({}, s, { alignment: { horizontal: 'center' } })),
        cn(parseFloat(inp.rfMonths) || 0, Object.assign({}, s, { alignment: { horizontal: 'center' } })),
        num(parseFloat(inp.idc) || 0),
        num(parseFloat(inp.incentive) || 0),
        num(parseFloat(inp.restoration) || 0),
        cv(exempt, Object.assign({}, s, { alignment: { horizontal: 'center' } })),
        cv(inp.remarks || '—', Object.assign({}, s, { alignment: { wrapText: true } }))
      ]);
    });

    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
                   { wch: 9 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 8 },
                   { wch: 16 }, { wch: 9 }, { wch: 12 }, { wch: 16 },
                   { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 22 }];
    ws['!freeze'] = freeze(hdrRow + 1, 2);
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 4 — Assumptions & Methodology
  // ════════════════════════════════════════════════════════════════════
  function buildAssumptions() {
    var W = 4;
    var ban = sheetBanner('Assumptions & Methodology', 'Basis of preparation for this IND AS 116 / IFRS 16 working pack', 'Generated: ' + ts(), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    function section(title, items) {
      rows.push([cv(title, subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
      merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
      items.forEach(function (item) {
        rows.push([cv('›', { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.purple } } }),
          cv(item[0], { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.navy } } }),
          cv(item[1], { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.textMid } }, alignment: { wrapText: true } }),
          blank()]);
      });
      rows.push(empty(W));
    }

    section('1. APPLICABLE STANDARD', [
      ['Standard', 'Ministry of Corporate Affairs (MCA) notified IND AS 116 — Leases (equivalent to IFRS 16)'],
      ['Effective date', 'Financial years beginning on or after April 1, 2019'],
      ['Scope', 'All leases except short-term leases (≤12 months) and low-value asset leases where exemption elected']
    ]);

    section('2. LEASE LIABILITY RECOGNITION', [
      ['Initial measurement', 'Present value of unpaid lease payments, discounted at the Incremental Borrowing Rate (IBR) or the rate implicit in the lease'],
      ['IBR determination', 'Rate at which entity can borrow funds for similar term, currency, and collateral as at commencement date'],
      ['Subsequent measurement', 'Carrying amount adjusted for interest accrual, payments made, and remeasurement (if any)'],
      ['PV formula', 'PV = Σ [Pmt(t) / (1+r)^t] where r = IBR per period; t = period number'],
      ['Annuity type', 'Ordinary annuity (payments at end of period) unless advance payment elected'],
      ['Interest accrual basis', 'Effective interest method. Interest accrues monthly at the rate that compounds exactly to the periodic discount rate r, so the liability unwinds on the same basis it was discounted on and total finance charge equals total payments less the present value.'],
      ['Current / non-current split', 'Current portion = principal falling due in the 12 months after the reporting date. Non-current = liability outstanding at that date less the current portion. Struck at the reporting date, not at commencement.']
    ]);

    section('3. RIGHT-OF-USE (ROU) ASSET', [
      ['Initial measurement', 'Initial lease liability + initial direct costs (IDC) + restoration cost provision − lease incentives received'],
      ['Depreciation method', 'Straight-line over the lease term (from commencement to end of lease)'],
      ['Depreciation base', 'Gross ROU asset (no residual value unless renewal option modelled)'],
      ['Impairment', 'Not considered in this working — management to assess separately per IND AS 36']
    ]);

    section('4. ESCALATION / VARIABLE PAYMENTS', [
      ['Fixed % escalation', 'Lease payments stepped up at compounding rate each escalation interval; all payments included in PV calculation'],
      ['Fixed ₹ escalation', 'Lease payments increased by fixed rupee amount each escalation interval; all included in PV'],
      ['CPI / Index-linked', 'Payments estimated using current CPI assumption at commencement (IND AS 116.28); reassessed at modification date'],
      ['Purely variable payments', 'Not included in lease liability (expensed as incurred)']
    ]);

    section('5. PRACTICAL EXPEDIENTS', [
      ['Short-term lease', 'Leases with term ≤12 months recognised as expense on straight-line basis; not on balance sheet'],
      ['Low-value assets', 'Assets with underlying value ≤USD 5,000 (approx ₹4 lakhs) when new; recognised as expense'],
      ['Portfolio approach', 'Where similar characteristics, a portfolio approach may be applied — inputs should reflect portfolio-level assumptions']
    ]);

    section('6. LIMITATIONS AND DISCLAIMERS', [
      ['Basis', 'This working is prepared solely based on inputs provided by the user. The accuracy of all outputs is dependent on the accuracy of inputs.'],
      ['Professional review', 'Users are advised to have these computations independently reviewed by a qualified CA or finance professional before use in financial statements or audit.'],
      ['Modifications', 'Lease modifications, reassessments, terminations, and subleases are not automatically modelled — each should be assessed separately.'],
      ['Security deposits', 'Security deposits under IND AS 109 are not included in this report unless separately computed.'],
      ['Currency', 'All amounts in Indian Rupees (INR) unless stated otherwise.']
    ]);

    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 70 }, { wch: 4 }];
    ws['!merges'] = merges;
    // Give data rows enough height for wrapped text in col C (70ch wide)
    var rowHpts = rows.map(function (row, i) {
      var cell = row[2];
      var txt = (cell && cell.v) ? String(cell.v) : '';
      // Estimate lines needed: ~70 chars per line at 70wch
      var lines = Math.ceil(txt.length / 68) || 1;
      return { hpt: Math.max(18, lines * 15) };
    });
    ws['!rows'] = rowHpts;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 5 — Validation Checks
  // ════════════════════════════════════════════════════════════════════
  function buildValidation(leases, calcFn, fy) {
    var W = 6;
    var ban = sheetBanner('Validation & Exception Report', 'Input validation checks for all leases  ·  ' + BRAND.std, 'Leases checked: ' + leases.length + '   ·   Generated: ' + ts(), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    var hdrs = ['#', 'Lease Name', 'Category', 'Issue Description', 'Severity', 'Status'];
    rows.push(hdrs.map(function (h) { return cv(h, navyHdr()); }));

    var checks = [];
    leases.forEach(function (l) {
      var inp = l.inputs || {};
      var name = l.name || '—';

      if (!inp.start) checks.push({ name: name, cat: 'Date', msg: 'Commencement date is missing', sev: 'Error' });
      if (!inp.termMonths && !inp.term) checks.push({ name: name, cat: 'Term', msg: 'Lease term not specified', sev: 'Error' });
      if (!(parseFloat(inp.pmt) > 0)) checks.push({ name: name, cat: 'Payment', msg: 'Rent per period is zero or missing', sev: 'Error' });
      var ibr = parseFloat(inp.ibr);
      if (!ibr) checks.push({ name: name, cat: 'IBR', msg: 'Discount rate (IBR) not provided', sev: 'Error' });
      else if (ibr < 5) checks.push({ name: name, cat: 'IBR', msg: 'IBR < 5% — unusual for Indian entities. Typical range: 8–14%', sev: 'Warning' });
      else if (ibr > 20) checks.push({ name: name, cat: 'IBR', msg: 'IBR > 20% — very high. Please verify with lending rate.', sev: 'Warning' });
      else checks.push({ name: name, cat: 'IBR', msg: 'IBR of ' + ibr + '% is within acceptable range (5–20%)', sev: 'Info' });
      if (inp.escType && inp.escType !== 'none' && !(parseFloat(inp.escPct) > 0) && !(parseFloat(inp.escAmt) > 0))
        checks.push({ name: name, cat: 'Escalation', msg: 'Escalation type selected but no escalation value provided', sev: 'Warning' });
      if (!inp.lessor) checks.push({ name: name, cat: 'Identity', msg: 'Lessor name not provided — required for disclosure note', sev: 'Info' });
      if (inp.isShortTerm || inp.isLowValue)
        checks.push({ name: name, cat: 'Exemption', msg: (inp.isShortTerm ? 'Short-term' : 'Low-value') + ' exemption applied — lease not on balance sheet', sev: 'Info' });

      var term = parseInt(inp.termMonths || inp.term, 10) || 0;
      if (inp.isShortTerm && term > 12)
        checks.push({ name: name, cat: 'Exemption', msg: 'Short-term exemption applied to a ' + term + '-month lease. Para 6 permits it only for terms of 12 months or less.', sev: 'Error' });
      if (term > 0 && term <= 12 && !inp.isShortTerm && !inp.isLowValue)
        checks.push({ name: name, cat: 'Exemption', msg: 'Term is ' + term + ' months. The short-term exemption may be available — confirm whether it has been elected.', sev: 'Info' });
      if (parseFloat(inp.rfMonths) >= term && term > 0)
        checks.push({ name: name, cat: 'Rent-free', msg: 'Rent-free months (' + inp.rfMonths + ') equal or exceed the lease term — no payments would be recognised.', sev: 'Error' });

      // State the escalation in words. A silent mis-set interval is exactly how a
      // 5%-per-year lease gets computed as a 5%-per-3-years lease.
      var escT = String(inp.escType || 'none').toLowerCase();
      if (escT !== 'none') {
        var every = parseInt(inp.escYears, 10) || 1;
        var step = escT === 'amt' ? ('₹' + Number(inp.escAmt || 0).toLocaleString('en-IN'))
                                  : ((parseFloat(inp.escPct) || 0) + '%');
        checks.push({ name: name, cat: 'Escalation', msg: 'Rent steps up by ' + step + ' every ' + every + ' year' + (every === 1 ? '' : 's') + '. Confirm this matches the lease deed.', sev: 'Info' });
      }

      // ── Self-checks on the computed schedule ──────────────────────────
      var r = calcFn(l);
      if (r && r.res && r.res.schedule && r.res.schedule.length) {
        var sc = r.res.schedule;
        var sumf = function (k) { return sc.reduce(function (a, x) { return a + x[k]; }, 0); };
        var finalL = sc[sc.length - 1].closeL;
        if (Math.abs(finalL) > 1)
          checks.push({ name: name, cat: 'Schedule', msg: 'Lease liability does not extinguish — ₹' + Number(finalL).toLocaleString('en-IN') + ' remains after the final payment.', sev: 'Error' });
        else
          checks.push({ name: name, cat: 'Schedule', msg: 'Amortisation schedule unwinds to nil at the end of the term.', sev: 'Info' });

        var intGap = sumf('interest') - (sumf('pmt') - r.res.pvInitial);
        if (Math.abs(intGap) > 1)
          checks.push({ name: name, cat: 'Schedule', msg: 'Total finance charge differs from (payments less present value) by ₹' + Number(Math.abs(intGap)).toLocaleString('en-IN') + '.', sev: 'Error' });

        var depGap = sumf('dep') - r.res.rouInitial;
        if (Math.abs(depGap) > 1)
          checks.push({ name: name, cat: 'ROU asset', msg: 'Accumulated depreciation differs from the ROU asset by ₹' + Number(Math.abs(depGap)).toLocaleString('en-IN') + '.', sev: 'Error' });

        // Is the reported FY one this lease actually exists in?
        if (fy && inp.start) {
          var fyM = /FY\s*(\d{4})/.exec(String(fy));
          if (fyM) {
            var fyS = new Date(Date.UTC(+fyM[1], 3, 1)), fyE = new Date(Date.UTC(+fyM[1] + 1, 2, 31, 23, 59, 59));
            var cS = new Date(inp.start);
            var cE = new Date(inp.start); cE.setUTCMonth(cE.getUTCMonth() + term);
            if (cS > fyE)
              checks.push({ name: name, cat: 'Reporting period', msg: 'Lease commences ' + dateStr(inp.start) + ', after the end of ' + fy + '. It contributes nothing to this report.', sev: 'Warning' });
            else if (cE < fyS)
              checks.push({ name: name, cat: 'Reporting period', msg: 'Lease ended before ' + fy + ' began. It contributes nothing to this report.', sev: 'Warning' });
            else if (cS >= fyS && cS <= fyE)
              checks.push({ name: name, cat: 'Reporting period', msg: 'Lease commences during ' + fy + ' — only ' + (sc.filter(function (x) { var d = new Date(x.periodEnd); return d >= fyS && d <= fyE; }).length) + ' month(s) fall in this reporting period.', sev: 'Info' });
          }
        }
      }
    });

    if (!checks.length) checks.push({ name: 'All leases', cat: 'General', msg: 'No issues found — inputs appear complete', sev: 'Info' });

    checks.forEach(function (c, i) {
      rows.push([
        cv(i + 1, altRow(i)),
        cv(c.name, Object.assign({}, altRow(i), { font: { bold: true, name: 'Calibri', sz: 10 } })),
        cv(c.cat, altRow(i)),
        cv(c.msg, Object.assign({}, altRow(i), { alignment: { wrapText: true } })),
        cv(c.sev, warningCell(c.sev)),
        cv(c.sev === 'Error' ? 'Action Required' : c.sev === 'Warning' ? 'Review Recommended' : 'Noted', altRow(i))
      ]);
    });

    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 16 }, { wch: 55 }, { wch: 12 }, { wch: 20 }];
    ws['!merges'] = merges;
    ws['!rows'] = rows.map(function (row) {
      var txt = (row[3] && row[3].v) ? String(row[3].v) : '';
      var lines = Math.ceil(txt.length / 52) || 1;
      return { hpt: Math.max(18, lines * 15) };
    });
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 6 — Liability Amortization Schedule
  // ════════════════════════════════════════════════════════════════════
  function buildAmortization(leases, calcFn) {
    var rows = [];
    var merges = [];
    var W = 10;

    var ban = sheetBanner('Amortization Schedule', 'Detailed period-by-period amortization for all recognised leases  ·  ' + BRAND.std, 'Generated: ' + ts(), W);
    ban.rows.forEach(function(r){ rows.push(r); });
    ban.merges.forEach(function(m){ merges.push(m); });

    var hdrs = ['Period', 'Period End', 'Lease Name', 'Opening Liability ₹', 'Interest ₹', 'Payment ₹', 'Principal ₹', 'Closing Liability ₹', 'Depreciation ₹', 'ROU NBV ₹'];
    rows.push(hdrs.map(function (h) { return cv(h, navyHdr()); }));
    var hdrRow = rows.length - 1;

    var grandTotInt = 0, grandTotPmt = 0, grandTotPrin = 0, grandTotDep = 0;
    var rowIdx = 0;

    leases.forEach(function (l) {
      var r = calcFn(l);
      if (!r || !r.res.schedule.length) return;

      // Lease sub-header
      var lhdr = { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.navy } }, fill: { fgColor: { rgb: CLR.purpleLight } } };
      rows.push([
        cv('', lhdr), cv('', lhdr),
        cv(l.name + '  —  IBR: ' + r.inp.ibr + '%  |  Term: ' + r.inp.termMonths + ' mo  |  Rent: ₹' + Number(r.inp.pmt).toLocaleString('en-IN'), lhdr),
        cv('', lhdr), cv('', lhdr), cv('', lhdr), cv('', lhdr), cv('', lhdr), cv('', lhdr), cv('', lhdr)
      ]);
      merges.push(merge(rows.length - 1, 2, rows.length - 1, 9));

      var totInt = 0, totPmt = 0, totPrin = 0, totDep = 0;
      var mod = r.modResult;
      var preModCount = mod ? mod.preModRows.length : Infinity;

      r.res.schedule.forEach(function (row, idx) {
        if(mod && idx >= preModCount) return; // skip post-mod from original schedule
        var s = altRow(rowIdx++);
        var ns = function (v) { return { v: v, t: 'n', s: Object.assign({}, s, { numFmt: '#,##0', alignment: { horizontal: 'right' } }) }; };
        rows.push([
          cv(row.period, Object.assign({}, s, { alignment: { horizontal: 'center' } })),
          cv(dateStr(row.periodEnd), s),
          cv(l.name, s),
          ns(row.openL||row.opening||0), ns(row.interest), ns(row.pmt), ns(row.principal), ns(row.closeL||row.closing||0), ns(row.dep||0), ns(row.rouC||row.rouNBV||0)
        ]);
        totInt += row.interest; totPmt += row.pmt||0; totPrin += row.principal; totDep += row.dep||0;
      });

      // If modified — divider + post-mod rows
      if(mod){
        var modStyle = { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: CLR.accent } }, alignment: { horizontal: 'center' } };
        rows.push([
          cv('MODIFICATION — ' + mod.modDate + '  |  Liability adj: ₹' + Number(mod.liabAdj).toLocaleString('en-IN') + (mod.gainLoss ? '  |  Gain/Loss: ₹' + Number(mod.gainLoss).toLocaleString('en-IN') : ''), modStyle)
        ].concat(emptyN(W - 1, CLR.accent)));
        merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));

        mod.postModRows.forEach(function(row){
          var s = Object.assign({}, altRow(rowIdx++), { fill: { fgColor: { rgb: 'F0FDF4' } } });
          var ns = function(v){ return { v: v||0, t:'n', s: Object.assign({}, s, { numFmt:'#,##0', alignment:{ horizontal:'right' } }) }; };
          var opening = row.closingLiab + row.principal;
          rows.push([
            cv('M'+row.period, Object.assign({}, s, { alignment:{ horizontal:'center' } })),
            cv('—', s), cv(l.name, s),
            ns(opening), ns(row.interest), ns(row.pmt), ns(row.principal), ns(row.closingLiab), ns(row.dep||0), ns(row.rouNBV||0)
          ]);
          totInt += row.interest; totPmt += row.pmt||0; totPrin += row.principal; totDep += row.dep||0;
        });
      }

      // Lease subtotal
      rows.push([
        cv('', totalLabel(CLR.indigo)), cv('', totalLabel(CLR.indigo)),
        cv('Sub-total: ' + l.name, totalLabel(CLR.indigo)),
        cv('', totalLabel(CLR.indigo)),
        cn(totInt, totalRow(CLR.indigo)), cn(totPmt, totalRow(CLR.indigo)),
        cn(totPrin, totalRow(CLR.indigo)), cv('', totalLabel(CLR.indigo)),
        cn(totDep, totalRow(CLR.indigo)), cv('', totalLabel(CLR.indigo))
      ]);
      grandTotInt += totInt; grandTotPmt += totPmt; grandTotPrin += totPrin; grandTotDep += totDep;
      rows.push(empty(W));
    });

    // Grand total
    rows.push([
      cv('', totalLabel()), cv('', totalLabel()), cv('GRAND TOTAL', totalLabel()),
      cv('', totalLabel()), cn(grandTotInt, totalRow()), cn(grandTotPmt, totalRow()),
      cn(grandTotPrin, totalRow()), cv('', totalLabel()), cn(grandTotDep, totalRow()), cv('', totalLabel())
    ]);
    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
    ws['!freeze'] = freeze(hdrRow + 1, 3);
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 7 — Annual Rollforward
  // ════════════════════════════════════════════════════════════════════
  function buildAnnualRollforward(leases, calcFn) {
    var rows = [];
    var merges = [];
    var W = 9;

    var ban = sheetBanner('Annual Rollforward', 'FY-wise rollforward of lease liability & ROU asset  ·  Indian FY (Apr–Mar)  ·  ' + BRAND.std, 'Generated: ' + ts(), W);
    ban.rows.forEach(function(r){ rows.push(r); });
    ban.merges.forEach(function(m){ merges.push(m); });

    var hdrs = ['Financial Year', 'Lease Name', 'Opening Liability ₹', 'Interest ₹', 'Payments ₹', 'Principal ₹', 'Closing Liability ₹', 'Depreciation ₹', 'ROU NBV ₹'];
    rows.push(hdrs.map(function (h) { return cv(h, navyHdr()); }));
    var hdrRow = rows.length - 1;

    // Aggregate by FY
    var fyMap = {};
    var rowIdx = 0;

    leases.forEach(function (l) {
      var r = calcFn(l);
      if (!r || !r.res.annual) return;
      r.res.annual.forEach(function (a) {
        var s = altRow(rowIdx);
        var ns = function (v) { return { v: v, t: 'n', s: Object.assign({}, s, { numFmt: '#,##0', alignment: { horizontal: 'right' } }) }; };
        rows.push([
          cv(a.fy, Object.assign({}, s, { font: { bold: true, name: 'Calibri', sz: 10 } })),
          cv(l.name, s),
          ns(a.openL), ns(a.interest), ns(a.payments), ns(a.principal), ns(a.closeL), ns(a.dep), ns(a.rouC)
        ]);
        rowIdx++;

        // aggregate
        if (!fyMap[a.fy]) fyMap[a.fy] = { fy: a.fy, openL: 0, interest: 0, payments: 0, principal: 0, closeL: 0, dep: 0, rouC: 0 };
        var ag = fyMap[a.fy];
        ag.openL += a.openL;   // was never accumulated — every consolidated year read nil
        ag.interest += a.interest; ag.payments += a.payments; ag.principal += a.principal;
        ag.dep += a.dep; ag.closeL += a.closeL; ag.rouC += a.rouC;
      });
    });

    rows.push(empty(W));
    rows.push([cv('CONSOLIDATED BY FINANCIAL YEAR', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(hdrs.map(function (h) { return cv(h, navyHdr()); }));

    Object.values(fyMap).sort(function (a, b) { return a.fy.localeCompare(b.fy); }).forEach(function (a, i) {
      var s = altRow(i);
      var ns = function (v) { return { v: v, t: 'n', s: Object.assign({}, s, { numFmt: '#,##0', alignment: { horizontal: 'right' } }) }; };
      rows.push([cv(a.fy, Object.assign({}, s, { font: { bold: true, name: 'Calibri', sz: 10 } })), cv('All leases', s),
        ns(a.openL), ns(a.interest), ns(a.payments), ns(a.principal), ns(a.closeL), ns(a.dep), ns(a.rouC)]);
    });

    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
    ws['!freeze'] = freeze(hdrRow + 1, 2);
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 8 — Journal Entries
  // ════════════════════════════════════════════════════════════════════
  function buildJournalEntries(allJEs, fy) {
    var rows = [];
    var merges = [];
    var W = 8;

    // The sheet deliberately spans the whole lease term, but the rest of the pack
    // reports one year — say so, and mark the rows that belong to that year.
    var inFYCount = fy ? allJEs.filter(function (j) { return j.fy === fy; }).length : 0;
    var sub = fy
      ? 'Full lease term shown  ·  ' + inFYCount + ' of ' + allJEs.length + ' entries fall in ' + fy + ' (highlighted)'
      : 'All journal entries for recognised leases  ·  Suitable for ERP / Tally / SAP import';
    var ban = sheetBanner('Journal Entries — GL Posting', sub, 'Entries: ' + allJEs.length + '   ·   Generated: ' + ts(), W);
    ban.rows.forEach(function(r){ rows.push(r); });
    ban.merges.forEach(function(m){ merges.push(m); });

    var hdrs = ['Date', 'FY', 'Entry Type', 'Narration', 'Account Head', 'Lease', 'Dr (₹)', 'Cr (₹)'];
    rows.push(hdrs.map(function (h) { return cv(h, navyHdr()); }));
    var hdrRow = rows.length - 1;

    var typeColors = { day1: CLR.purple, interest: CLR.accent, payment: CLR.green, depn: CLR.indigo, modification: CLR.red };
    var lastDate = '';
    var totDr = 0;

    allJEs.forEach(function (j, i) {
      if (j.date !== lastDate) {
        // Date group header
        var dghdr = { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: CLR.navy } }, fill: { fgColor: { rgb: CLR.grey2 } } };
        rows.push([cv(dateStr(j.date) + '  —  ' + (j.fy || ''), dghdr)].concat(emptyN(W - 1, CLR.grey2)));
        merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
        lastDate = j.date;
      }
      var typeC = typeColors[j.type] || CLR.navy;
      var s = altRow(i);
      var ns = function (v, isdr) { return { v: v || 0, t: 'n', s: { font: { name: 'Calibri', sz: 10, bold: !!v, color: { rgb: v ? (isdr ? CLR.green : CLR.textMid) : CLR.grey3 } }, numFmt: '#,##0', alignment: { horizontal: 'right' } } }; };
      var fyCell = (fy && j.fy === fy)
        ? { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: CLR.green } }, alignment: { horizontal: 'center' } }
        : s;
      rows.push([
        cv(j.date, s),
        cv(j.fy || '', fyCell),
        cv(j.typeLabel, { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: typeC } }, alignment: { horizontal: 'center' } }),
        cv(j.narration, Object.assign({}, s, { alignment: { wrapText: true } })),
        cv(j.account, Object.assign({}, s, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.navy } } })),
        cv(j.leaseName, s),
        ns(j.dr, true), ns(j.cr, false)
      ]);
      totDr += (j.dr || 0);
    });

    rows.push([
      cv('', totalLabel()), cv('', totalLabel()), cv('', totalLabel()),
      cv('', totalLabel()), cv('TOTAL', totalLabel()), cv('', totalLabel()),
      cn(totDr, totalRow()), cn(totDr, totalRow())
    ]);
    rows.push(empty(W));
    rows.push([cv('Note: Total Debit = Total Credit confirms balanced entries (Dr = Cr = ₹' + Number(totDr).toLocaleString('en-IN') + ')', noteStyle())].concat(emptyN(W - 1, CLR.white)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 45 }, { wch: 35 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];
    ws['!freeze'] = freeze(hdrRow + 1, 0);
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 9 — Disclosure Note (IND AS 116 Para 52)
  // ════════════════════════════════════════════════════════════════════
  function buildDisclosure(discData, fy) {
    var rows = [];
    var merges = [];
    var W = 3;

    var ban = sheetBanner('IND AS 116 — Disclosure Note', 'Note to Financial Statements  ·  Para 52 of IND AS 116 / IFRS 16', 'Financial Year: ' + fy + '   ·   Generated: ' + ts(), W);
    ban.rows.forEach(function(r){ rows.push(r); });
    ban.merges.forEach(function(m){ merges.push(m); });

    function noteSection(title, tableRows) {
      rows.push([cv(title, subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
      merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
      tableRows.forEach(function (r) {
        var isTotal = r[2] === 'total';
        var isSub   = r[2] === 'sub';
        rows.push([
          cv(r[0], isTotal ? totalLabel() : isSub ? { font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: CLR.textMid } }, fill: { fgColor: { rgb: CLR.grey2 } } } : { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.text } } }),
          r[1] !== null ? { v: r[1] || 0, t: 'n', s: isTotal ? totalRow() : numFmt() } : blank(),
          blank()
        ]);
      });
      rows.push(empty(W));
    }

    var d = discData;

    noteSection('NOTE 1 — MATURITY ANALYSIS OF LEASE LIABILITIES (Undiscounted) — Para 52(b)', [
      ['Not later than 1 year', d.maturity.y1, ''],
      ['Later than 1 year and not later than 5 years', d.maturity.y1_5, ''],
      ['Later than 5 years', d.maturity.y5plus, ''],
      ['Total undiscounted cash flows', d.maturity.y1 + d.maturity.y1_5 + d.maturity.y5plus, 'total'],
      ['Less: Future finance charges', -(d.totUndiscounted - d.totCloseL), 'sub'],
      ['Present value of lease liabilities', d.totCloseL, 'total']
    ]);

    noteSection('NOTE 2 — MOVEMENT IN LEASE LIABILITY — Para 52(a)', [
      ['Opening balance (1 April)', d.totOpenL, ''],
      ['Add: Liabilities recognised on leases commencing during the year', d.totLiabAdditions || 0, ''],
      ['Add: Interest accrued during the year', d.totInterest, ''],
      ['Less: Lease payments made during the year', -d.totPayments, 'sub'],
      ['Closing balance (31 March)', d.totCloseL, 'total'],
      ['  Of which — Current (due within 12 months)', d.currLiab, 'sub'],
      ['  Of which — Non-current (due after 12 months)', d.ncurrLiab, 'sub']
    ]);

    noteSection('NOTE 3 — RIGHT-OF-USE ASSET ROLLFORWARD — Para 52(a)', [
      ['Opening net carrying amount', d.totOpenROU, ''],
      ['Add: Additions during the year', d.totAdditions, ''],
      ['Less: Depreciation for the year', -d.totDep, 'sub'],
      ['Net Book Value — Closing', d.totCloseROU, 'total']
    ]);

    noteSection('NOTE 4 — AMOUNTS RECOGNISED IN PROFIT & LOSS — Para 52(b)', [
      ['Depreciation on ROU assets (charged to P&L)', d.totPL_Dep, ''],
      ['Finance cost on lease liabilities', d.totPL_Int, ''],
      d.exemptExpense > 0 ? ['Short-term / low-value lease expense (Para 6)', d.exemptExpense, ''] : null,
      ['Total impact on Profit & Loss', d.totPL_Dep + d.totPL_Int + (d.exemptExpense || 0), 'total']
    ].filter(Boolean));

    noteSection('NOTE 5 — ADDITIONAL DISCLOSURES — Para 52(b)', [
      ['Total cash outflow for leases in ' + fy, d.totCashOut, ''],
      ['Weighted average incremental borrowing rate (IBR)', d.wAvgIBR / 100, ''],
      ['Number of leases on balance sheet', d.leaseCount, ''],
      d.exemptExpense > 0 ? ['Short-term / low-value commitments (not on B/S)', d.exemptExpense, ''] : null
    ].filter(Boolean));

    // NOTE 6 — Qualitative Disclosures (only when at least one lease has one)
    if (d.qualNotes && d.qualNotes.length) {
      rows.push([cv('NOTE 6 — QUALITATIVE DISCLOSURES — Para 52(b)', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
      merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));

      rows.push([cv(d.qualNotes.length + ' of ' + d.leaseCount + ' leases have qualitative disclosures configured', noteStyle())].concat(emptyN(W - 1, CLR.white)));
      merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));

      function qLabel(text) {
        rows.push([cv(text, { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: CLR.grey4 } }, alignment: { horizontal: 'left', indent: 1 } })].concat(emptyN(W - 1, CLR.white)));
        merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
      }
      function qText(text) {
        rows.push([cv(text, { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.text } }, alignment: { wrapText: true, vertical: 'top', indent: 1 } })].concat(emptyN(W - 1, CLR.white)));
        merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
      }

      d.qualNotes.forEach(function (q) {
        rows.push([cv(q.name, totalLabel())].concat(emptyN(W - 1, CLR.purpleLight)));
        merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
        if (q.variableRentNote) { qLabel('Variable Lease Payments'); qText(q.variableRentNote); }
        var extTerm = [q.extOptionNote, q.termOptionNote].filter(Boolean).join('   |   ');
        if (extTerm) { qLabel('Extension / Termination Terms'); qText(extTerm); }
        if (q.restrictionsNote) { qLabel('Restrictions & Covenants'); qText(q.restrictionsNote); }
        rows.push(empty(W));
      });
    }

    rows.push([cv('Preparer\'s note: This disclosure note is generated by Finosutra based on user-provided inputs. It should be reviewed and customised by the preparer / CA before inclusion in the financial statements.', noteStyle())].concat(emptyN(W - 1, CLR.white)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 55 }, { wch: 18 }, { wch: 3 }];
    ws['!merges'] = merges;
    ws['!rows'] = rows.map(function(row, i) {
      if (i < 3) return { hpt: [28,17,17,6][i] || 18 };
      var txt = (row[0] && row[0].v) ? String(row[0].v) : '';
      return { hpt: Math.max(18, Math.ceil(txt.length / 52) * 15) };
    });
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 10 — Audit Working Papers
  // ════════════════════════════════════════════════════════════════════
  function buildAuditWorkingPapers(leases, calcFn, meta) {
    var rows = [];
    var merges = [];
    var W = 6;

    var ban = sheetBanner('Audit Working Papers', 'For use by Statutory Auditor / Internal Auditor / Finance Reviewer  ·  ' + BRAND.std, 'Prepared by: ' + (meta.preparedBy || 'Finosutra User') + '   ·   Generated: ' + ts(), W);
    ban.rows.forEach(function(r){ rows.push(r); });
    ban.merges.forEach(function(m){ merges.push(m); });

    // Sign-off block
    var so = subHdr(10);
    rows.push([cv('REPORT SIGN-OFF', so)].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));

    function signRow(label) {
      return [cv(label, metaLabel()), cv('', { border: { bottom: { style: 'thin', color: { rgb: CLR.grey3 } } } }), cv('Date:', metaLabel()), cv('', { border: { bottom: { style: 'thin', color: { rgb: CLR.grey3 } } } }), blank(), blank()];
    }
    rows.push(empty(W));
    rows.push(signRow('Prepared by:'));
    rows.push(empty(W));
    rows.push(signRow('Reviewed by:'));
    rows.push(empty(W));
    rows.push(signRow('Approved by:'));
    rows.push(empty(W));
    rows.push(empty(W));

    // Cross-reference checklist
    rows.push([cv('AUDIT CHECKLIST — IND AS 116', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(empty(W));

    var checks = [
      ['1.', 'Lease identification', 'Has each contract been assessed for IND AS 116 applicability?', 'Yes / No / N/A', ''],
      ['2.', 'Commencement date', 'Is commencement date correctly identified per Para 22?', 'Yes / No', ''],
      ['3.', 'Lease term', 'Does the lease term include extension options management is reasonably certain to exercise?', 'Yes / No', ''],
      ['4.', 'IBR determination', 'Is IBR determined at the commencement date? Is it entity-specific?', 'Yes / No', ''],
      ['5.', 'Variable payments', 'Are variable payments appropriately excluded from the liability?', 'Yes / No / N/A', ''],
      ['6.', 'Initial direct costs', 'Are IDCs correctly identified and added to ROU asset?', 'Yes / No / N/A', ''],
      ['7.', 'Restoration cost', 'Has a provision for dismantling / restoration been made where required?', 'Yes / No / N/A', ''],
      ['8.', 'Short-term exemption', 'Is the short-term exemption appropriately applied (term ≤ 12 months)?', 'Yes / No / N/A', ''],
      ['9.', 'Low-value exemption', 'Is the low-value exemption applied based on value when new?', 'Yes / No / N/A', ''],
      ['10.', 'Depreciation', 'Is ROU asset depreciated over the correct period?', 'Yes / No', ''],
      ['11.', 'Balance sheet presentation', 'Are current / non-current splits correctly classified?', 'Yes / No', ''],
      ['12.', 'Disclosure adequacy', 'Are all Para 52 disclosures included in the financial statements?', 'Yes / No', ''],
      ['13.', 'Modification events', 'Have any lease modifications occurred during the year? If yes, remeasured?', 'Yes / No', ''],
      ['14.', 'Comparative figures', 'Are prior year comparatives consistent and correctly restated?', 'Yes / No', '']
    ];

    rows.push(['#', 'Area', 'Audit Procedure', 'Response', 'Reviewer Notes'].map(function (h) { return cv(h, navyHdr()); }).concat([blank()]));
    checks.forEach(function (c, i) {
      var s = altRow(i);
      rows.push([cv(c[0], s), cv(c[1], Object.assign({}, s, { font: { bold: true, name: 'Calibri', sz: 10 } })), cv(c[2], Object.assign({}, s, { alignment: { wrapText: true } })), cv(c[3], Object.assign({}, s, { alignment: { horizontal: 'center' } })), cv(c[4], s), blank()]);
    });

    rows.push(empty(W));
    rows.push(empty(W));

    // Lease reconciliation table
    rows.push([cv('LEASE LIABILITY RECONCILIATION — AUDIT EVIDENCE', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push([cv('Lease', navyHdr()), cv('Per Finosutra (₹)', navyHdr()), cv('Per Management (₹)', navyHdr()), cv('Difference (₹)', navyHdr()), cv('Explanation', navyHdr()), blank()]);

    leases.forEach(function (l, i) {
      var r = calcFn(l);
      var s = altRow(i);
      rows.push([
        cv(l.name || '—', Object.assign({}, s, { font: { bold: true, name: 'Calibri', sz: 10 } })),
        r ? cn(r.res.pvInitial, Object.assign({}, s, { numFmt: '#,##0', alignment: { horizontal: 'right' } })) : cv('Exempt', s),
        cv('', Object.assign({}, s, { border: { bottom: { style: 'thin', color: { rgb: CLR.grey3 } } } })),
        cv('', Object.assign({}, s, { border: { bottom: { style: 'thin', color: { rgb: CLR.grey3 } } } })),
        cv('', Object.assign({}, s, { border: { bottom: { style: 'thin', color: { rgb: CLR.grey3 } } } })),
        blank()
      ]);
    });

    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 55 }, { wch: 16 }, { wch: 30 }, { wch: 3 }];
    ws['!merges'] = merges;
    ws['!rows'] = rows.map(function(row, i) {
      if (i < 3) return { hpt: [28,17,17,6][i] || 18 };
      var txt = (row[2] && row[2].v) ? String(row[2].v) : '';
      return { hpt: Math.max(20, Math.ceil(txt.length / 52) * 15) };
    });
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 11 — Reporting Snapshot
  // ════════════════════════════════════════════════════════════════════
  function buildReportingSnapshot(leases, calcFn, discData, fy) {
    var rows = [];
    var merges = [];
    var W = 4;

    var ban = sheetBanner('Management Reporting Snapshot', 'Balance Sheet & P&L Impact Summary  ·  ' + BRAND.std, 'Financial Year: ' + (fy || '—') + '   ·   Generated: ' + ts(), W);
    ban.rows.forEach(function(r){ rows.push(r); });
    ban.merges.forEach(function(m){ merges.push(m); });

    function snapshotSection(title, items) {
      rows.push([cv(title, subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
      merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
      items.forEach(function (item) {
        var isTotal = item[2] === 'total';
        rows.push([
          cv(item[0], isTotal ? totalLabel() : { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.textMid } } }),
          item[1] !== null ? { v: item[1] || 0, t: 'n', s: isTotal ? totalRow() : numFmt() } : blank(),
          blank(), blank()
        ]);
      });
      rows.push(empty(W));
    }

    var d = discData || {};
    snapshotSection('BALANCE SHEET — ASSETS', [
      ['Right-of-Use Assets (Net Book Value)', d.totCloseROU || 0, ''],
      ['Total Asset Impact', d.totCloseROU || 0, 'total']
    ]);
    snapshotSection('BALANCE SHEET — LIABILITIES', [
      ['Lease Liability — Current (due within 12 months)', d.currLiab || 0, ''],
      ['Lease Liability — Non-Current (due after 12 months)', d.ncurrLiab || 0, ''],
      ['Total Lease Liability', (d.currLiab || 0) + (d.ncurrLiab || 0), 'total']
    ]);
    snapshotSection('STATEMENT OF PROFIT & LOSS', [
      ['Depreciation on ROU Assets', d.totPL_Dep || 0, ''],
      ['Finance Cost — Interest on Lease Liabilities', d.totPL_Int || 0, ''],
      d.exemptExpense ? ['Short-term / Low-value Lease Expense', d.exemptExpense, ''] : null,
      ['Total charge to P&L for the year', (d.totPL_Dep || 0) + (d.totPL_Int || 0), 'total']
    ].filter(Boolean));
    snapshotSection('CASH FLOW STATEMENT', [
      ['Principal repayment (Financing activities)', d.totPrincipal || 0, ''],
      ['Interest paid (Financing activities)', d.totPL_Int || 0, ''],
      ['Total cash outflow for leases', d.totCashOut || 0, 'total']
    ]);

    // Maturity buckets
    rows.push([cv('MATURITY ANALYSIS (Undiscounted payments)', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    var mat = d.maturity || { y1: 0, y1_5: 0, y5plus: 0 };
    [
      ['< 1 Year', mat.y1],
      ['1 – 5 Years', mat.y1_5],
      ['> 5 Years', mat.y5plus],
      ['Total Undiscounted', mat.y1 + mat.y1_5 + mat.y5plus]
    ].forEach(function (r) {
      rows.push([cv(r[0], r[0] === 'Total Undiscounted' ? totalLabel() : { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.textMid } } }),
        { v: r[1], t: 'n', s: r[0] === 'Total Undiscounted' ? totalRow() : numFmt() }, blank(), blank()]);
    });

    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 3 }, { wch: 3 }];
    ws['!merges'] = merges;
    ws['!rows'] = rows.map(function(_, i) {
      return { hpt: i < 3 ? ([28,17,17,6][i] || 18) : 18 };
    });
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET 12 — Change Log / Audit Trail
  // ════════════════════════════════════════════════════════════════════
  function buildChangeLog(auditRows) {
    var rows = [];
    var merges = [];
    var W = 5;

    var ban = sheetBanner('Change Log & Audit Trail', 'Record of all changes made to leases  ·  ' + BRAND.std, 'Generated: ' + ts(), W);
    ban.rows.forEach(function(r){ rows.push(r); });
    ban.merges.forEach(function(m){ merges.push(m); });

    var hdrs = ['Timestamp', 'Action', 'Lease Name', 'Changed Fields', 'Performed By'];
    rows.push(hdrs.map(function (h) { return cv(h, navyHdr()); }));

    if (auditRows && auditRows.length) {
      auditRows.forEach(function (r, i) {
        var s = altRow(i);
        rows.push([
          cv(r.created_at ? dateStr(r.created_at) : '—', s),
          cv(r.action || '—', Object.assign({}, s, { font: { bold: true, name: 'Calibri', sz: 10 } })),
          cv(r.leaseName || '—', s),
          cv(r.changed_fields ? JSON.stringify(r.changed_fields) : '—', Object.assign({}, s, { alignment: { wrapText: true } })),
          cv(r.user || 'Finosutra User', s)
        ]);
      });
    } else {
      rows.push([cv('No audit trail data available for this session. Sign in and enable the audit log in Supabase to track changes.', noteStyle())].concat(emptyN(W - 1, CLR.white)));
      merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    }

    // Generation record
    rows.push(empty(W));
    rows.push([cv('Report Generation Record', subHdr(10))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push([cv('Generated on', metaLabel()), cv(ts(), metaValue()), blank(), blank(), blank()]);
    rows.push([cv('Software', metaLabel()), cv(BRAND.name + ' ' + BRAND.version, metaValue()), blank(), blank(), blank()]);
    rows.push([cv('Standard', metaLabel()), cv(BRAND.std, metaValue()), blank(), blank(), blank()]);
    rows.push([cv('Website', metaLabel()), cv(BRAND.site, metaValue()), blank(), blank(), blank()]);
    rows.push(empty(W));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 35 }, { wch: 22 }];
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  MASTER BUILD FUNCTION
  // ════════════════════════════════════════════════════════════════════
  function buildPremiumWorkbook(options) {
    if (!window.XLSX) { alert('Excel library not loaded.'); return; }

    var leases     = options.leases || [];
    var calcFn     = options.calcFn;
    var generateJEsFn = options.generateJEsFn;
    var discData   = options.discData || {};
    var fy         = options.fy || '';
    var auditRows  = options.auditRows || [];
    var meta = {
      entity:     options.entity || '',
      name:       options.name || 'Multi-Lease Portfolio',
      fy:         fy,
      preparedBy: options.preparedBy || ''
    };

    var wb = XLSX.utils.book_new();

    // Generate all JEs
    var allJEs = [];
    leases.forEach(function (l) {
      if (generateJEsFn) allJEs = allJEs.concat(generateJEsFn(l));
    });

    // Append all sheets in order
    XLSX.utils.book_append_sheet(wb, buildCoverSheet(meta),                            '1_Cover');
    XLSX.utils.book_append_sheet(wb, buildExecSummary(leases, calcFn, discData, fy),   '2_Executive_Summary');
    XLSX.utils.book_append_sheet(wb, buildLeaseMaster(leases),                         '3_Lease_Master');
    XLSX.utils.book_append_sheet(wb, buildAssumptions(),                               '4_Assumptions');
    XLSX.utils.book_append_sheet(wb, buildValidation(leases, calcFn, fy),              '5_Validation');
    XLSX.utils.book_append_sheet(wb, buildAmortization(leases, calcFn),                '6_Amortization');
    XLSX.utils.book_append_sheet(wb, buildAnnualRollforward(leases, calcFn),           '7_Annual_Rollforward');
    XLSX.utils.book_append_sheet(wb, buildJournalEntries(allJEs, fy),                  '8_Journal_Entries');
    if (fy) XLSX.utils.book_append_sheet(wb, buildDisclosure(discData, fy),            '9_Disclosure_Note');
    XLSX.utils.book_append_sheet(wb, buildReportingSnapshot(leases, calcFn, discData, fy), '10_Mgmt_Snapshot');
    XLSX.utils.book_append_sheet(wb, buildAuditWorkingPapers(leases, calcFn, meta),    '11_Audit_WP');
    XLSX.utils.book_append_sheet(wb, buildChangeLog(auditRows),                        '12_Change_Log');

    var fname = 'Finosutra_IND_AS_116_' + (meta.name || 'Portfolio').replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    XLSX.writeFile(wb, fname);
    return fname;
  }

  // ── Public API ───────────────────────────────────────────────────────
  global.premiumExport = {
    buildWorkbook: buildPremiumWorkbook,
    buildCoverSheet: buildCoverSheet,
    buildDisclosure: buildDisclosure,
    ts: ts,
    indian: indian
  };

})(window);
