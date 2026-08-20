// ═══════════════════════════════════════════════════════════════════════
// Finosutra — Financial Statement Excel Export Engine v2.0
// Non-Corporate Entity (Proprietorship) — Full ICAI Note Fidelity
// Same style conventions as premiumExport.js (Corporate Navy palette).
// Reads item labels from finStatementEngine's metadata arrays — the
// single source of truth — rather than duplicating ~150 label strings.
// ═══════════════════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  var BRAND = { name: 'Finosutra', site: 'finosutra.com', version: 'v2.0', std: 'ICAI Guidance Note — Non-Corporate Entities' };

  var CLR = {
    navy: '002244', navyDark: '001830', purple: '0052CC', purpleLight: 'E8F0FF',
    indigo: '002E5C', accent: 'D97706', accentLt: 'FEF3C7', green: '059669', greenLt: 'D1FAE5',
    red: 'DC2626', redLt: 'FEE2E2', grey1: 'F0F5FF', grey2: 'F5F8FF', grey3: 'BAD0F8',
    grey4: '6B7280', text: '111827', textMid: '374151', white: 'FFFFFF'
  };

  function sBanner(v) { return { v: v, t: 's', s: { font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: CLR.navy } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 } } }; }
  function sSub(v) { return { v: v, t: 's', s: { font: { name: 'Calibri', sz: 10, color: { rgb: '93BBFB' } }, fill: { fgColor: { rgb: CLR.indigo } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 } } }; }
  function sMeta(v) { return { v: v, t: 's', s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.purple } }, fill: { fgColor: { rgb: CLR.purpleLight } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 } } }; }
  function subHdr(sz) { return { font: { name: 'Calibri', sz: sz || 11, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: CLR.purple } }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 } }; }
  function navyHdr(sz) { return { font: { name: 'Calibri', sz: sz || 10, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: CLR.purple } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } }; }
  function navyHdrR(sz) { return { font: { name: 'Calibri', sz: sz || 10, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: CLR.purple } }, alignment: { horizontal: 'right', vertical: 'center', wrapText: true } }; }
  function totalLabel() { return { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.navy } }, fill: { fgColor: { rgb: CLR.purpleLight } }, alignment: { horizontal: 'left', indent: 1 } }; }
  function totalRow() { return { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.navy } }, fill: { fgColor: { rgb: CLR.purpleLight } }, numFmt: '#,##0', alignment: { horizontal: 'right' } }; }
  function lineLabel(indent) { return { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.text } }, alignment: { horizontal: 'left', indent: indent || 1 } }; }
  function numFmtS(bold) { return { font: { name: 'Calibri', sz: 10, bold: !!bold, color: { rgb: bold ? CLR.navy : CLR.textMid } }, numFmt: '#,##0;(#,##0);"-"', alignment: { horizontal: 'right' } }; }
  function metaLabel() { return { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.grey4 } }, alignment: { horizontal: 'right' } }; }
  function metaValue() { return { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.navy } }, alignment: { horizontal: 'left' } }; }
  function warnCell(ok) { return { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: ok ? CLR.green : CLR.red } }, alignment: { horizontal: 'center' } }; }

  function cv(v, s) { return { v: v, t: typeof v === 'number' ? 'n' : 's', s: s || {} }; }
  function cn(v, s) { return { v: +v || 0, t: 'n', s: s || numFmtS() }; }
  function blank() { return { v: '', t: 's', s: { fill: { fgColor: { rgb: CLR.white } } } }; }
  function blankN(c) { return { v: '', t: 's', s: { fill: { fgColor: { rgb: c || CLR.navy } } } }; }
  function empty(n) { var r = []; for (var i = 0; i < (n || 1); i++) r.push(blank()); return r; }
  function emptyN(n, c) { var r = []; for (var i = 0; i < (n || 1); i++) r.push(blankN(c)); return r; }
  function merge(r1, c1, r2, c2) { return { s: { r: r1, c: c1 }, e: { r: r2, c: c2 } }; }
  function freeze(row, col) { return { state: 'frozen', xSplit: col || 0, ySplit: row || 1 }; }
  function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

  function ts() {
    var n = new Date();
    return dateStr(n) + ', ' + n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateStr(d) {
    if (!d) return '—';
    try {
      var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
      if (iso) return iso[3] + ' ' + MONTHS_SHORT[+iso[2] - 1] + ' ' + iso[1];
      var dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return d;
      return String(dt.getDate()).padStart(2, '0') + ' ' + MONTHS_SHORT[dt.getMonth()] + ' ' + dt.getFullYear();
    } catch (e) { return d; }
  }

  function sheetBanner(title, subtitle, meta, W) {
    var rows = [
      [sBanner('Finosutra  |  ' + title)].concat(emptyN(W - 1, CLR.navy)),
      [sSub(subtitle)].concat(emptyN(W - 1, CLR.indigo)),
      [sMeta(meta)].concat(emptyN(W - 1, CLR.purpleLight)),
      emptyN(W, CLR.white)
    ];
    var merges = [merge(0, 0, 0, W - 1), merge(1, 0, 1, W - 1), merge(2, 0, 2, W - 1)];
    return { rows: rows, merges: merges };
  }

  function footerRow(cols) {
    var r = [{ v: 'Prepared using Finosutra  ·  ' + BRAND.site + '  ·  ' + BRAND.std + '  ·  ' + BRAND.version,
      t: 's', s: { font: { name: 'Calibri', sz: 9, color: { rgb: CLR.purple } }, fill: { fgColor: { rgb: CLR.navy } }, alignment: { horizontal: 'left', indent: 1 } } }];
    for (var i = 1; i < cols - 1; i++) r.push(blankN(CLR.navy));
    r.push({ v: 'ICAI Guidance Note format', t: 's', s: { font: { name: 'Calibri', sz: 9, color: { rgb: '93BBFB' } }, fill: { fgColor: { rgb: CLR.navy } }, alignment: { horizontal: 'right' } } });
    return r;
  }

  // ── Generic note-table builders ─────────────────────────────────────
  function noteHdr(rows, merges, W, n, label) {
    rows.push([cv('Note ' + n + ' — ' + label, subHdr(10))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
  }
  function subLabel(rows, W, text) {
    rows.push([cv(text, { font: { name: 'Calibri', sz: 10, bold: true, italic: true, color: { rgb: CLR.textMid } }, alignment: { horizontal: 'left', indent: 1 } })].concat(empty(W - 1)));
  }
  function flatTable(rows, W, items, dataObj, opts) {
    opts = opts || {};
    rows.push([cv('Particulars', navyHdr()), cv('Amount (Rs.)', navyHdrR())].concat(emptyN(W - 2, CLR.purple)));
    var total = 0;
    items.forEach(function (it) {
      var v = +((dataObj || {})[it.key]) || 0;
      if (it.isDeduction) { v = -v; }
      total += v;
      rows.push([cv(it.label, lineLabel(1)), cn(v)].concat(empty(W - 2)));
    });
    rows.push([cv('Total', totalLabel()), cn(round2(total), totalRow())].concat(emptyN(W - 2, CLR.purpleLight)));
    return round2(total);
  }
  function gridTable(rows, W, items, dims, dataGrid) {
    var hdr = [cv('Particulars', navyHdr())];
    dims.forEach(function (d) { hdr.push(cv(d.label, navyHdrR())); });
    for (var p = 1 + dims.length; p < W; p++) hdr.push(cv('', navyHdr()));
    rows.push(hdr);
    var colTotals = dims.map(function () { return 0; });
    items.forEach(function (it) {
      var row = [cv(it.label, lineLabel(1))];
      dims.forEach(function (d, di) {
        var v = +(((dataGrid || {})[d.key] || {})[it.key]) || 0;
        if (it.isDeduction) v = -v;
        colTotals[di] += v;
        row.push(cn(v));
      });
      for (var p2 = 1 + dims.length; p2 < W; p2++) row.push(cv('', {}));
      rows.push(row);
    });
    var totRow = [cv('Total', totalLabel())];
    dims.forEach(function (d, di) { totRow.push(cn(round2(colTotals[di]), totalRow())); });
    for (var p3 = 1 + dims.length; p3 < W; p3++) totRow.push(cv('', totalRow()));
    rows.push(totRow);
    return colTotals;
  }
  function spacer(rows, W) { rows.push(emptyN(W, CLR.white)); }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET — Cover
  // ════════════════════════════════════════════════════════════════════
  function buildCoverSheet(meta) {
    var W = 4;
    var ban = sheetBanner('Financial Statements — Non-Corporate Entity', BRAND.std + '   ·   Proprietorship   ·   CONFIDENTIAL',
      'Entity: ' + (meta.entity || '—') + '   ·   Year ended: ' + (meta.fy || '—') + '   ·   Generated: ' + ts(), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();
    function bl(c) { return blankN(c || CLR.white); }
    function mRow(lbl, val) { return [bl(), cv(lbl + ' :', metaLabel()), cv(val || '—', metaValue()), bl()]; }

    rows.push(emptyN(W, CLR.white));
    rows.push([cv('REPORT DETAILS', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(emptyN(W, CLR.white));
    rows.push(mRow('Entity Name', meta.entity));
    rows.push(mRow('Type of Entity', 'Proprietorship'));
    rows.push(mRow('Format', 'ICAI Guidance Note on Financial Statements for Non-Corporate Entities'));
    rows.push(mRow('Year Ended', meta.fy));
    rows.push(mRow('Report Generated', ts()));
    rows.push(mRow('Software', 'Finosutra ' + BRAND.version + '  |  ' + BRAND.site));
    rows.push(mRow('Prepared By', meta.preparedBy || 'Finosutra User'));
    rows.push(emptyN(W, CLR.white));

    rows.push([cv('CONTENTS', subHdr(11))].concat(emptyN(W - 1, CLR.purple)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(emptyN(W, CLR.white));
    [
      ['1_Cover', 'This page'],
      ['2_Balance_Sheet', 'Balance Sheet as at year end'],
      ['3_Statement_of_PL', 'Statement of Profit and Loss'],
      ['4_Capital_Account', 'Note 3 — Owner’s Capital Account'],
      ['5_Notes_4-6', 'Notes 4-6 — Reserves, Borrowings'],
      ['6_Notes_7-10', 'Notes 7-10 — Other liabilities, Provisions, Payables'],
      ['7_Fixed_Assets', 'Note 11 — Fixed Assets (Gross Block method)'],
      ['8_Notes_12-18', 'Notes 12-18 — Investments, Loans, Inventories, Receivables, Cash'],
      ['9_Notes_19-25', 'Notes 19-25 — Statement of P&L detail']
    ].forEach(function (item, i) {
      var bg = i % 2 !== 0 ? CLR.grey1 : CLR.white;
      rows.push([
        blankN(bg),
        cv(item[0], { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.purple } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'left', indent: 1 } }),
        cv(item[1], { font: { name: 'Calibri', sz: 10, color: { rgb: CLR.textMid } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'left', indent: 1 } }),
        blankN(bg)
      ]);
      merges.push(merge(rows.length - 1, 2, rows.length - 1, W - 1));
    });

    rows.push(emptyN(W, CLR.white));
    rows.push([cv('Formats prescribed in the ICAI Guidance Note and applicable Accounting Standards should be referred to for final presentation. This is a preparer aid, not a substitute for professional judgement.',
      { font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: CLR.grey4 } }, fill: { fgColor: { rgb: CLR.grey2 } }, alignment: { wrapText: true, horizontal: 'left', indent: 1 } })].concat(emptyN(W - 1, CLR.grey2)));
    merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    rows.push(emptyN(W, CLR.white));
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 60 }, { wch: 4 }];
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET — Balance Sheet
  // ════════════════════════════════════════════════════════════════════
  function buildBalanceSheet(result, meta) {
    var W = 4;
    var bs = result.balanceSheet;
    var ban = sheetBanner('Balance Sheet', 'Balance Sheet as at ' + (meta.fy || 'year end'), '(Amount in Rs.)   ·   Entity: ' + (meta.entity || '—'), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    rows.push([cv('Particulars', navyHdr()), cv('Note', navyHdr()), cv('', navyHdr()), cv('Amount (Rs.)', navyHdrR())]);
    var hdrRow = rows.length - 1;

    function section(label) {
      rows.push([cv(label, subHdr(10))].concat(emptyN(W - 1, CLR.purple)));
      merges.push(merge(rows.length - 1, 0, rows.length - 1, W - 1));
    }
    function line(label, note, val, indent) { rows.push([cv(label, lineLabel(indent)), cv(note || '', lineLabel(3)), blank(), cn(val, numFmtS())]); }
    function sub(label, val) { rows.push([cv(label, totalLabel()), blank(), blank(), cn(val, totalRow())]); }

    section('I. EQUITY AND LIABILITIES');
    rows.push([cv("Owner's Funds", lineLabel(1))].concat(empty(W - 1)));
    line("Owner's Capital Account", 'Note 3', bs.capitalClosing, 2);
    line('Reserves and Surplus', 'Note 4', bs.reserves, 2);
    sub('Total — Owners\' Funds', bs.ownersFunds);
    spacer(rows, W);

    rows.push([cv('Non-current liabilities', lineLabel(1))].concat(empty(W - 1)));
    line('Long-term Borrowings', 'Note 5', bs.nonCurrentLiabilities.longTermBorrowings, 2);
    line('Other Long-term Liabilities & Provisions', 'Note 7,8', bs.nonCurrentLiabilities.otherLongTerm, 2);
    sub('Total Non-Current Liabilities', bs.nonCurrentLiabilities.total);
    spacer(rows, W);

    rows.push([cv('Current liabilities', lineLabel(1))].concat(empty(W - 1)));
    line('Short-term Borrowings', 'Note 5', bs.currentLiabilities.shortTermBorrowings, 2);
    line('Trade Payables', 'Note 9', bs.currentLiabilities.tradePayables, 2);
    line('Other Current Liabilities', 'Note 10', bs.currentLiabilities.otherCurrentLiabilities, 2);
    line('Short-term Provisions', 'Note 8', bs.currentLiabilities.shortTermProvisions, 2);
    sub('Total Current Liabilities', bs.currentLiabilities.total);
    spacer(rows, W);
    sub('TOTAL (I)', bs.totalEquityAndLiabilities);
    spacer(rows, W); spacer(rows, W);

    section('II. ASSETS');
    rows.push([cv('Non-current assets', lineLabel(1))].concat(empty(W - 1)));
    line('Property, Plant & Equipment / Intangibles (Net Block)', 'Note 11', bs.nonCurrentAssets.fixedAssetsNetBlock, 2);
    line('Capital Work-in-Progress', 'Note 11', bs.nonCurrentAssets.capitalWorkInProgress, 2);
    line('Intangible Assets under Development', 'Note 11', bs.nonCurrentAssets.intangibleAssetsUnderDevelopment, 2);
    line('Non-current Investments', 'Note 12', bs.nonCurrentAssets.nonCurrentInvestments, 2);
    line('Long-term Loans and Advances', 'Note 13', bs.nonCurrentAssets.longTermLoansAdvances, 2);
    line('Other Non-current Assets', 'Note 14', bs.nonCurrentAssets.otherNonCurrentAssets, 2);
    sub('Total Non-Current Assets', bs.nonCurrentAssets.total);
    spacer(rows, W);

    rows.push([cv('Current assets', lineLabel(1))].concat(empty(W - 1)));
    line('Current Investments', 'Note 12', bs.currentAssets.currentInvestments, 2);
    line('Inventories', 'Note 15', bs.currentAssets.inventories, 2);
    line('Trade Receivables', 'Note 16', bs.currentAssets.tradeReceivables, 2);
    line('Cash and Bank Balances', 'Note 17', bs.currentAssets.cashAndBank, 2);
    line('Short-term Loans and Advances', 'Note 13', bs.currentAssets.shortTermLoansAdvances, 2);
    line('Other Current Assets', 'Note 18', bs.currentAssets.otherCurrentAssets, 2);
    sub('Total Current Assets', bs.currentAssets.total);
    spacer(rows, W);
    sub('TOTAL (II)', bs.totalAssets);
    spacer(rows, W);

    rows.push([
      cv(bs.balanced ? 'Balance Sheet balances — Total (I) = Total (II)' : 'Balance Sheet does NOT balance — check inputs', warnCell(bs.balanced)),
      blankN(bs.balanced ? CLR.green : CLR.red), blankN(bs.balanced ? CLR.green : CLR.red),
      { v: bs.difference, t: 'n', s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: CLR.white } }, fill: { fgColor: { rgb: bs.balanced ? CLR.green : CLR.red } }, numFmt: '#,##0', alignment: { horizontal: 'right' } } }
    ]);
    merges.push(merge(rows.length - 1, 0, rows.length - 1, 2));
    spacer(rows, W);
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 44 }, { wch: 10 }, { wch: 6 }, { wch: 18 }];
    ws['!freeze'] = freeze(hdrRow + 1, 0);
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET — Statement of Profit and Loss
  // ════════════════════════════════════════════════════════════════════
  function buildProfitLoss(result, meta) {
    var W = 4;
    var pl = result.profitLoss;
    var ban = sheetBanner('Statement of Profit and Loss', 'For the year ended ' + (meta.fy || '—'), '(Amount in Rs.)   ·   Entity: ' + (meta.entity || '—'), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    rows.push([cv('Particulars', navyHdr()), cv('Note', navyHdr()), cv('', navyHdr()), cv('Amount (Rs.)', navyHdrR())]);
    var hdrRow = rows.length - 1;

    function line(label, note, val, indent) { rows.push([cv(label, lineLabel(indent)), cv(note || '', lineLabel(3)), blank(), cn(val, numFmtS())]); }
    function sub(label, val) { rows.push([cv(label, totalLabel()), blank(), blank(), cn(val, totalRow())]); }

    line('I. Revenue from operations', 'Note 19', pl.revenueFromOperations, 1);
    line('II. Other Income', 'Note 20', pl.otherIncome, 1);
    sub('III. Total Income (I + II)', pl.totalIncome);
    spacer(rows, W);

    rows.push([cv('IV. Expenses:', lineLabel(1))].concat(empty(W - 1)));
    line('Cost of Goods Sold', 'Note 21', pl.costOfGoodsSold, 2);
    line('Employee Benefits Expense', 'Note 22', pl.employeeBenefits, 2);
    line('Finance Costs', 'Note 23', pl.financeCosts, 2);
    line('Depreciation and Amortization Expense', 'Note 24', pl.depreciationExpense, 2);
    line('Other Expenses', 'Note 25', pl.otherExpensesTotal, 2);
    sub('Total Expenses', pl.totalExpenses);
    spacer(rows, W);

    sub('V. Profit for the Year (III − IV)', pl.profitForYear);
    spacer(rows, W);
    rows.push([cv("Transferred to Owner's Capital Account (Note 3)", lineLabel(1))].concat(empty(W - 1)));
    spacer(rows, W);
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 44 }, { wch: 10 }, { wch: 6 }, { wch: 18 }];
    ws['!freeze'] = freeze(hdrRow + 1, 0);
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET — Capital Account (Note 3)
  // ════════════════════════════════════════════════════════════════════
  function buildCapitalAccountSheet(result, meta) {
    var W = 2;
    var ca = result.capitalAccount;
    var ban = sheetBanner('Note 3 — Owner’s Capital Account', 'Movements in the proprietor’s capital account for the year ended ' + (meta.fy || '—'), 'Entity: ' + (meta.entity || '—'), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();
    rows.push([cv('Particulars', navyHdr()), cv('Amount (Rs.)', navyHdrR())]);
    var hdrRow = rows.length - 1;
    [
      ['Opening Balance (as at 1 April)', ca.openingBalance],
      ['Add: Capital Introduced during the year', ca.introduced],
      ['Add: Remuneration for the year', ca.remuneration],
      ['Add: Interest on Capital for the year', ca.interest],
      ['Less: Withdrawals during the year', -ca.withdrawals],
      ['Add: Share of Profit for the year', ca.profitForYear]
    ].forEach(function (r) { rows.push([cv(r[0], lineLabel(1)), cn(r[1])]); });
    rows.push([cv('Closing Balance (as at year end)', totalLabel()), cn(ca.closingBalance, totalRow())]);
    spacer(rows, W);
    rows.push(footerRow(W));
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 44 }, { wch: 18 }];
    ws['!freeze'] = freeze(hdrRow + 1, 0);
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET — Notes 4-6
  // ════════════════════════════════════════════════════════════════════
  function buildNotes46Sheet(result, meta) {
    var E = window.finStatementEngine;
    var W = 5;
    var raw = result.raw || {};
    var ban = sheetBanner('Notes 4-6 — Reserves, Borrowings', 'For the year ended ' + (meta.fy || '—'), 'Entity: ' + (meta.entity || '—'), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    noteHdr(rows, merges, W, 4, 'Reserves and Surplus');
    flatTable(rows, W, E.RESERVE_ITEMS, result.notes.reserves.byItem);
    spacer(rows, W);

    noteHdr(rows, merges, W, 5, 'Borrowings');
    gridTable(rows, W, E.BORROWING_ITEMS, E.BORROWING_DIMS, raw.borrowings);
    spacer(rows, W);
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET — Notes 7-10
  // ════════════════════════════════════════════════════════════════════
  function buildNotes710Sheet(result, meta) {
    var E = window.finStatementEngine;
    var W = 5;
    var raw = result.raw || {};
    var ban = sheetBanner('Notes 7-10 — Other Liabilities, Provisions, Payables', 'For the year ended ' + (meta.fy || '—'), 'Entity: ' + (meta.entity || '—'), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    noteHdr(rows, merges, W, 7, 'Other Long-term Liabilities');
    flatTable(rows, W, E.OTHER_LT_LIAB_ITEMS, result.notes.otherLTLiabilities.byItem);
    spacer(rows, W);

    noteHdr(rows, merges, W, 8, 'Provisions');
    gridTable(rows, W, E.PROVISION_ITEMS, E.PROVISION_DIMS, raw.provisions);
    spacer(rows, W);

    noteHdr(rows, merges, W, 9, 'Trade Payables');
    flatTable(rows, W, E.TRADE_PAYABLES_ITEMS, result.notes.tradePayables.byItem);
    spacer(rows, W);
    subLabel(rows, W, 'MSMED Act Disclosure (informational)');
    flatTable(rows, W, E.MSMED_DISCLOSURE_ITEMS, raw.msmedDisclosure);
    spacer(rows, W);

    noteHdr(rows, merges, W, 10, 'Other Current Liabilities');
    flatTable(rows, W, E.OTHER_CURR_LIAB_ITEMS, result.notes.otherCurrentLiabilities.byItem);
    spacer(rows, W);
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET — Fixed Assets (Note 11)
  // ════════════════════════════════════════════════════════════════════
  function buildFixedAssetsSheet(result, meta) {
    var W = 7;
    var fa = result.fixedAssets;
    var ban = sheetBanner('Note 11 — Fixed Assets', 'Gross Block + Accumulated Depreciation, for the year ended ' + (meta.fy || '—'), 'Entity: ' + (meta.entity || '—'), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    function assetTable(classes, heading) {
      subLabel(rows, W, heading);
      rows.push([cv('Asset Class', navyHdr()), cv('Opening Gross', navyHdrR()), cv('Additions', navyHdrR()), cv('Deductions', navyHdrR()), cv('Closing Gross', navyHdrR()), cv('Accum. Dep.', navyHdrR()), cv('Net Block', navyHdrR())]);
      var t = { og: 0, ad: 0, dg: 0, cg: 0, cad: 0, nb: 0 };
      classes.forEach(function (c) {
        rows.push([cv(c.label, lineLabel(1)), cn(c.openingGross), cn(c.additions), cn(c.deductionsGross), cn(c.closingGross), cn(c.closingAccumDep), cn(c.netBlock, numFmtS(true))]);
        t.og += c.openingGross; t.ad += c.additions; t.dg += c.deductionsGross; t.cg += c.closingGross; t.cad += c.closingAccumDep; t.nb += c.netBlock;
      });
      rows.push([cv('Total', totalLabel()), cn(round2(t.og), totalRow()), cn(round2(t.ad), totalRow()), cn(round2(t.dg), totalRow()), cn(round2(t.cg), totalRow()), cn(round2(t.cad), totalRow()), cn(round2(t.nb), totalRow())]);
      spacer(rows, W);
    }
    assetTable(fa.byClass.filter(function (c) { return c.type === 'tangible'; }), 'Tangible Assets');
    assetTable(fa.byClass.filter(function (c) { return c.type === 'intangible'; }), 'Intangible Assets');

    subLabel(rows, W, 'Capital Work-in-Progress / Intangible Assets under Development');
    rows.push([cv('Particulars', navyHdr()), cv('CWIP (Rs.)', navyHdrR()), cv('Intangible U/D (Rs.)', navyHdrR())].concat(emptyN(W - 3, CLR.purple)));
    [
      ['Opening Balance', fa.cwip.opening, fa.iaud.opening],
      ['Additions during the year', fa.cwip.additions, fa.iaud.additions],
      ['Less: Capitalized during the year', -fa.cwip.capitalized, -fa.iaud.capitalized]
    ].forEach(function (r) { rows.push([cv(r[0], lineLabel(1)), cn(r[1]), cn(r[2])].concat(empty(W - 3))); });
    rows.push([cv('Closing Balance', totalLabel()), cn(fa.cwip.closing, totalRow()), cn(fa.iaud.closing, totalRow())].concat(emptyN(W - 3, CLR.purpleLight)));
    spacer(rows, W);
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 14 }];
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET — Notes 12-18
  // ════════════════════════════════════════════════════════════════════
  function buildNotes1218Sheet(result, meta) {
    var E = window.finStatementEngine;
    var W = 6;
    var raw = result.raw || {};
    var ban = sheetBanner('Notes 12-18 — Investments, Loans, Inventories, Receivables, Cash', 'For the year ended ' + (meta.fy || '—'), 'Entity: ' + (meta.entity || '—'), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    noteHdr(rows, merges, W, 12, 'Investments');
    gridTable(rows, W, E.INVESTMENT_ITEMS, E.INVESTMENT_DIMS, raw.investments);
    rows.push([cv('Less: Provision for Diminution in Value of Investments (Note 25)', lineLabel(1)), cn(-result.notes.provisionDiminutionInvestments)].concat(empty(W - 2)));
    rows.push([cv('Net Investments', totalLabel()), cn(result.notes.totalInvestments, totalRow())].concat(emptyN(W - 2, CLR.purpleLight)));
    spacer(rows, W);

    noteHdr(rows, merges, W, 13, 'Loans and Advances');
    gridTable(rows, W, E.LOANS_ADV_ITEMS, E.LOANS_ADV_DIMS, raw.loansAdvances);
    spacer(rows, W);

    noteHdr(rows, merges, W, 14, 'Other Non-Current Assets');
    flatTable(rows, W, E.OTHER_NC_ASSETS_ITEMS, result.notes.otherNonCurrentAssets.byItem);
    spacer(rows, W);

    noteHdr(rows, merges, W, 15, 'Inventories');
    flatTable(rows, W, E.INVENTORY_ITEMS, result.notes.inventories.byItem);
    spacer(rows, W);

    noteHdr(rows, merges, W, 16, 'Trade Receivables');
    gridTable(rows, W, E.RECEIVABLE_ITEMS, E.RECEIVABLE_DIMS, raw.tradeReceivables);
    rows.push([cv('Unbilled Receivables', lineLabel(1)), cn(result.notes.unbilledReceivables)].concat(empty(W - 2)));
    rows.push([cv('Less: Provision for Doubtful Debts (Note 25)', lineLabel(1)), cn(-result.notes.provisionForDoubtfulDebts)].concat(empty(W - 2)));
    rows.push([cv('Net Trade Receivables', totalLabel()), cn(result.notes.totalTradeReceivables, totalRow())].concat(emptyN(W - 2, CLR.purpleLight)));
    spacer(rows, W);

    noteHdr(rows, merges, W, 17, 'Cash and Bank Balances');
    flatTable(rows, W, E.CASH_EQUIV_ITEMS, result.notes.cashEquivalents.byItem);
    spacer(rows, W);
    flatTable(rows, W, E.OTHER_BANK_BAL_ITEMS, result.notes.otherBankBalances.byItem);
    spacer(rows, W);

    noteHdr(rows, merges, W, 18, 'Other Current Assets');
    flatTable(rows, W, E.OTHER_CURR_ASSETS_ITEMS, result.notes.otherCurrentAssets.byItem);
    spacer(rows, W);
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  SHEET — Notes 19-25 (P&L detail)
  // ════════════════════════════════════════════════════════════════════
  function buildNotes1925Sheet(result, meta) {
    var E = window.finStatementEngine;
    var W = 5;
    var pl = result.profitLoss;
    var ban = sheetBanner('Notes 19-25 — Statement of P&L Detail', 'For the year ended ' + (meta.fy || '—'), 'Entity: ' + (meta.entity || '—'), W);
    var rows = ban.rows.slice(); var merges = ban.merges.slice();

    noteHdr(rows, merges, W, 19, 'Revenue from Operations');
    flatTable(rows, W, E.REVENUE_ITEMS, pl.notes.revenue.byItem);
    spacer(rows, W);

    noteHdr(rows, merges, W, 20, 'Other Income');
    flatTable(rows, W, E.OTHER_INCOME_ITEMS, pl.notes.otherIncome.byItem);
    spacer(rows, W);

    noteHdr(rows, merges, W, 21, 'Cost of Goods Sold');
    [
      ['Raw Material Consumed (Opening + Purchases − Closing)', pl.notes.cogs.rawMaterialConsumed],
      ['Purchases of Stock-in-Trade', pl.notes.cogs.purchasesStockInTrade],
      ['(Increase)/Decrease in Inventories (FG, WIP, Stock-in-Trade)', pl.notes.cogs.changesInInventories]
    ].forEach(function (r) { rows.push([cv(r[0], lineLabel(1)), cn(r[1])].concat(empty(W - 2))); });
    rows.push([cv('Total Cost of Goods Sold', totalLabel()), cn(pl.notes.cogs.total, totalRow())].concat(emptyN(W - 2, CLR.purpleLight)));
    spacer(rows, W);

    noteHdr(rows, merges, W, 22, 'Employee Benefits Expense');
    flatTable(rows, W, E.EMPLOYEE_BENEFITS_ITEMS, pl.notes.employeeBenefits.byItem);
    spacer(rows, W);

    noteHdr(rows, merges, W, 23, 'Finance Costs');
    flatTable(rows, W, E.FINANCE_COST_ITEMS, pl.notes.financeCosts.byItem);
    spacer(rows, W);

    noteHdr(rows, merges, W, 24, 'Depreciation and Amortization Expense');
    rows.push([cv('Particulars', navyHdr()), cv('Amount (Rs.)', navyHdrR())].concat(emptyN(W - 2, CLR.purple)));
    rows.push([cv('On Tangible Assets (Note 11)', lineLabel(1)), cn(result.fixedAssets.totalDepreciationTangible)].concat(empty(W - 2)));
    rows.push([cv('On Intangible Assets (Note 11)', lineLabel(1)), cn(result.fixedAssets.totalDepreciationIntangible)].concat(empty(W - 2)));
    rows.push([cv('Total', totalLabel()), cn(result.fixedAssets.totalDepreciation, totalRow())].concat(emptyN(W - 2, CLR.purpleLight)));
    spacer(rows, W);

    noteHdr(rows, merges, W, 25, 'Other Expenses');
    flatTable(rows, W, E.OTHER_EXPENSES_ITEMS, pl.notes.otherExpenses.byItem);
    spacer(rows, W);
    rows.push(footerRow(W));

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 44 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    ws['!merges'] = merges;
    return ws;
  }

  // ════════════════════════════════════════════════════════════════════
  //  MASTER BUILD
  // ════════════════════════════════════════════════════════════════════
  function buildWorkbook(options) {
    if (!window.XLSX) { alert('Excel library not loaded.'); return; }
    var result = options.result;
    var meta = { entity: options.entity || '', fy: options.fy || '', preparedBy: options.preparedBy || '' };

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildCoverSheet(meta), '1_Cover');
    XLSX.utils.book_append_sheet(wb, buildBalanceSheet(result, meta), '2_Balance_Sheet');
    XLSX.utils.book_append_sheet(wb, buildProfitLoss(result, meta), '3_Statement_of_PL');
    XLSX.utils.book_append_sheet(wb, buildCapitalAccountSheet(result, meta), '4_Capital_Account');
    XLSX.utils.book_append_sheet(wb, buildNotes46Sheet(result, meta), '5_Notes_4-6');
    XLSX.utils.book_append_sheet(wb, buildNotes710Sheet(result, meta), '6_Notes_7-10');
    XLSX.utils.book_append_sheet(wb, buildFixedAssetsSheet(result, meta), '7_Fixed_Assets');
    XLSX.utils.book_append_sheet(wb, buildNotes1218Sheet(result, meta), '8_Notes_12-18');
    XLSX.utils.book_append_sheet(wb, buildNotes1925Sheet(result, meta), '9_Notes_19-25');

    var fname = 'Finosutra_Financial_Statement_' + (meta.entity || 'Entity').replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    XLSX.writeFile(wb, fname);
    return fname;
  }

  global.finStatementExport = { buildWorkbook: buildWorkbook, ts: ts };

})(window);
