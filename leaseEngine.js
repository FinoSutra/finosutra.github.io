// ═══════════════════════════════════════════════════════════════════════
// Finosutra — IND AS 116 / IFRS 16 Lease Calculation Engine
// Version: 2.0 | Pure JS — no DOM access
//
// Usage:
//   var res = leaseEngine.calculate(inp);
//   var err = leaseEngine.validate(inp);
// ═══════════════════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  // ── Frequency helpers ────────────────────────────────────────────────
  var FREQ_MONTHS = { 12: 1, 4: 3, 2: 6, 1: 12 }; // freq → months per period

  function freqFromStr(s) {
    if (!s) return 12;
    s = String(s).toLowerCase();
    if (s.startsWith('q')) return 4;
    if (s.startsWith('h') || s.startsWith('b')) return 2;
    if (s.startsWith('a') || s === '1') return 1;
    return 12; // default monthly
  }

  // ── Payment array generator ──────────────────────────────────────────
  // Returns array of length n with payment for each period (₹)
  function generatePayments(inp, n, monthsPerPeriod) {
    var basePmt   = +inp.pmt   || 0;
    var rfMonths  = +inp.rfMonths || 0;
    var rfPeriods = rfMonths > 0 ? Math.ceil(rfMonths / monthsPerPeriod) : 0;
    var escType   = inp.escType || 'none';
    var escPct    = +inp.escPct  || 0;
    var escAmt    = +inp.escAmt  || 0;
    var escYears  = +inp.escYears || 3;

    var arr = [];
    for (var i = 0; i < n; i++) {
      if (i < rfPeriods) { arr.push(0); continue; }

      var pmt = basePmt;
      var startMonth = i * monthsPerPeriod;
      var yearNumber = Math.floor(startMonth / 12);

      if (escType === 'pct' && escPct) {
        var steps = Math.floor(yearNumber / escYears);
        pmt = basePmt * Math.pow(1 + escPct / 100, steps);
      } else if (escType === 'amt' && escAmt) {
        var stepsA = Math.floor(yearNumber / escYears);
        pmt = basePmt + escAmt * stepsA;
      }
      // 'none' and 'cpi' — treat CPI same as pct for initial recognition
      // (per IND AS 116.28, use current index at commencement)
      arr.push(Math.round(pmt * 100) / 100);
    }
    return arr;
  }

  // ── PV (DCF — handles variable payment arrays) ───────────────────────
  function calcPV(pmtArray, r, timing) {
    if (r === 0) return pmtArray.reduce(function (s, x) { return s + x; }, 0);
    var pv = 0;
    if (timing === 'beg' || timing === 'beginning' || timing === 'advance') {
      pmtArray.forEach(function (pmt, i) { pv += pmt / Math.pow(1 + r, i); });
    } else {
      pmtArray.forEach(function (pmt, i) { pv += pmt / Math.pow(1 + r, i + 1); });
    }
    return pv;
  }

  // ── Amortization schedule builder ────────────────────────────────────
  function buildSchedule(pmtArray, pv, r, timing, dep, startDate, monthsPerPeriod) {
    var openL = pv;
    var sched = [];
    var isBeg = (timing === 'beg' || timing === 'beginning' || timing === 'advance');
    var rouC  = pv; // ROU carrying value (before IDC/incentive adj — caller adds back)

    for (var i = 0; i < pmtArray.length; i++) {
      var pmt      = pmtArray[i];
      var interest, principal, closeL;

      if (isBeg) {
        // Payment at start of period: principal first, then interest on balance
        principal = pmt;
        interest  = Math.round((openL - pmt) * r * 100) / 100;
        closeL    = Math.round((openL - pmt + interest) * 100) / 100;
      } else {
        // Payment at end of period: interest first, then principal
        interest  = Math.round(openL * r * 100) / 100;
        principal = Math.round((pmt - interest) * 100) / 100;
        closeL    = Math.round((openL + interest - pmt) * 100) / 100;
      }

      if (closeL < 0) closeL = 0;
      rouC = Math.max(0, Math.round((rouC - dep) * 100) / 100);

      // Period end date — snap to last day of the period-end month
      var periodEnd = null;
      if (startDate) {
        var d = new Date(startDate);
        var endMonth = d.getMonth() + (i + 1) * monthsPerPeriod;
        // Last day of that month: set to day 0 of the following month
        d.setMonth(endMonth + 1, 0);
        periodEnd = d.toISOString().slice(0, 10);
      }

      sched.push({
        period:    i + 1,
        periodEnd: periodEnd,
        openL:     Math.round(openL),
        interest:  Math.round(interest),
        pmt:       Math.round(pmt),
        principal: Math.round(principal),
        closeL:    Math.round(closeL),
        dep:       Math.round(dep),
        rouC:      Math.round(rouC)
      });

      openL = closeL;
    }
    return sched;
  }

  // ── Annual rollforward (Indian FY: Apr–Mar) ──────────────────────────
  function buildAnnual(sched, startDate, monthsPerPeriod) {
    var annual = {};

    sched.forEach(function (row) {
      var label;
      if (row.periodEnd) {
        var d = new Date(row.periodEnd);
        var m = d.getMonth(); // 0=Jan
        var y = d.getFullYear();
        // Indian FY: Apr(3)–Mar(2) — if month < 3 (Jan/Feb/Mar), FY ends this year
        var fyEnd = m < 3 ? y : y + 1;
        label = 'FY ' + (fyEnd - 1) + '-' + String(fyEnd).slice(2);
      } else {
        label = 'Period ' + row.period;
      }

      if (!annual[label]) {
        annual[label] = {
          fy: label, openL: row.openL, interest: 0,
          payments: 0, principal: 0, dep: 0, closeL: 0, rouC: 0
        };
      }
      annual[label].interest  += row.interest;
      annual[label].payments  += row.pmt;
      annual[label].principal += row.principal;
      annual[label].dep       += row.dep;
      annual[label].closeL     = row.closeL;
      annual[label].rouC       = row.rouC;
    });

    return Object.values(annual);
  }

  // ── Current / non-current split ──────────────────────────────────────
  function currentSplit(sched, freq) {
    var currentLiab = 0;
    sched.slice(0, freq).forEach(function (x) { currentLiab += x.principal; });
    return Math.round(currentLiab);
  }

  // ── Validate ─────────────────────────────────────────────────────────
  function validate(inp) {
    var errors = [];

    if (!inp.name || !String(inp.name).trim()) errors.push({ field: 'name', message: 'Lease name is required' });
    if (!inp.start) errors.push({ field: 'start', message: 'Commencement date is required' });
    if (!(+inp.termMonths > 0)) errors.push({ field: 'termMonths', message: 'Lease term must be greater than 0' });
    if (!(+inp.pmt > 0)) errors.push({ field: 'pmt', message: 'Rent per period must be greater than 0' });

    var ibr = +inp.ibr;
    if (!ibr) {
      errors.push({ field: 'ibr', message: 'IBR / discount rate is required' });
    } else if (ibr < 2) {
      errors.push({ field: 'ibr', message: 'IBR seems very low (< 2%). Typical Indian IBR is 8–14%.' });
    } else if (ibr > 30) {
      errors.push({ field: 'ibr', message: 'IBR seems very high (> 30%). Please verify.' });
    }

    if (inp.start && inp.endDate) {
      if (new Date(inp.endDate) <= new Date(inp.start)) {
        errors.push({ field: 'endDate', message: 'End date must be after commencement date' });
      }
    }

    return { valid: errors.length === 0, errors: errors };
  }

  // ── Main calculate ───────────────────────────────────────────────────
  function calculate(inp) {
    var freq         = +inp.freq || freqFromStr(inp.freqStr) || 12;
    var monthsPerPeriod = FREQ_MONTHS[freq] || 1;
    var termMonths   = +inp.termMonths || 0;
    var n            = Math.max(1, Math.round(termMonths / monthsPerPeriod));
    var ibr          = +inp.ibr || 0;
    var r            = ibr / 100 / freq;
    var idc          = +inp.idc       || 0;
    var incentive    = +inp.incentive || 0;
    var timing       = inp.timing || inp.tim || 'end';

    // Short-term / low-value exemptions
    if (inp.isShortTerm || inp.isLowValue) {
      return {
        pvInitial: 0, rouInitial: 0, rouNBV: 0,
        liabCurrent: 0, liabNonCurrent: 0,
        depnAnnual: 0, depnPeriod: 0, totalInterest: 0,
        totalPayments: +inp.pmt * n,
        schedule: [], annual: [],
        exemption: inp.isShortTerm ? 'short-term' : 'low-value'
      };
    }

    var pmtArray  = generatePayments(inp, n, monthsPerPeriod);
    var pv        = Math.round(calcPV(pmtArray, r, timing));
    var rouInitial = Math.round(pv + idc - incentive);
    var dep       = rouInitial / n; // per-period straight-line

    var sched = buildSchedule(pmtArray, pv, r, timing, dep, inp.start, monthsPerPeriod);

    // Adjust ROU carrying values if IDC/incentive changed rouInitial vs pv
    if (idc || incentive) {
      var rouAdj = rouInitial;
      var depAdj = rouInitial / n;
      sched = sched.map(function (row, i) {
        rouAdj = Math.max(0, Math.round((rouInitial - (i + 1) * depAdj) * 100) / 100);
        return Object.assign({}, row, { dep: Math.round(depAdj), rouC: Math.round(rouAdj) });
      });
    }

    var annual  = buildAnnual(sched, inp.start, monthsPerPeriod);
    var currL   = currentSplit(sched, freq);
    var ncurrL  = Math.max(0, pv - currL);
    var totInt  = sched.reduce(function (s, x) { return s + x.interest; }, 0);
    var totPmt  = sched.reduce(function (s, x) { return s + x.pmt; }, 0);
    var depAnnual = Math.round(dep * freq);

    return {
      pvInitial:      pv,
      rouInitial:     rouInitial,
      rouNBV:         rouInitial, // at commencement date
      liabCurrent:    currL,
      liabNonCurrent: ncurrL,
      depnAnnual:     depAnnual,
      depnPeriod:     Math.round(dep),
      totalInterest:  Math.round(totInt),
      totalPayments:  Math.round(totPmt),
      freq:           freq,
      n:              n,
      termMonths:     termMonths,
      schedule:       sched,
      annual:         annual
    };
  }

  // ── Format helpers (exposed for UI convenience) ──────────────────────
  function f2(n) {
    if (n === null || n === undefined || isNaN(+n)) return '—';
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function fDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return d; }
  }

  function freqLabel(freq) {
    return { 12: 'Monthly', 4: 'Quarterly', 2: 'Half-Yearly', 1: 'Annual' }[freq] || 'Monthly';
  }

  // ── Export ───────────────────────────────────────────────────────────
  global.leaseEngine = {
    calculate:   calculate,
    validate:    validate,
    generatePayments: generatePayments,
    calcPV:      calcPV,
    buildAnnual: buildAnnual,
    f2:          f2,
    fDate:       fDate,
    freqLabel:   freqLabel,
    freqFromStr: freqFromStr
  };

})(window);
