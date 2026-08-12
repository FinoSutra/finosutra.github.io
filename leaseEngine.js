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
  // Monthly schedule — one row per month, actual/365 day-count interest
  function buildSchedule(pmtArray, pv, ibr, timing, dep, startDate, monthsPerPeriod, termMonths) {
    // The liability must unwind on the SAME basis it was discounted on, or the
    // schedule never reaches zero. calcPV discounts at the periodic rate
    // (ibr / freq), so accrue at the monthly rate that compounds exactly to it.
    // An actual/365 daily accrual here would leave a residual balance at the end
    // and make total interest disagree with (payments - PV).
    var rPeriod     = ibr / 100 * monthsPerPeriod / 12;
    var monthlyRate = monthsPerPeriod === 1
      ? rPeriod
      : Math.pow(1 + rPeriod, 1 / monthsPerPeriod) - 1;
    var openL = pv;
    var sched = [];
    var isBeg = (timing === 'beg' || timing === 'beginning' || timing === 'advance');
    var rouC  = pv;
    var prevDate = startDate ? new Date(startDate) : null;

    for (var mo = 1; mo <= termMonths; mo++) {
      var hasPmt = isBeg ? (mo - 1) % monthsPerPeriod === 0 : mo % monthsPerPeriod === 0;
      var pidx   = isBeg ? Math.round((mo - 1) / monthsPerPeriod) : Math.round(mo / monthsPerPeriod) - 1;
      var pmtAmt = hasPmt ? (pmtArray[pidx] || 0) : 0;

      // Period end date (display only — interest accrues on the periodic rate)
      var periodEndDate = null;
      if (startDate) {
        var d = new Date(startDate);
        d.setMonth(d.getMonth() + mo, 0);
        periodEndDate = d;
        prevDate = new Date(d);
      }

      // Carry the balances in whole rupees — the same figures that are displayed.
      // Rounding each row for display while carrying unrounded balances made the
      // disclosure notes miss by a few rupees at every year boundary.
      var pmtR = Math.round(pmtAmt);
      var depR = Math.round(dep);
      var interest, principal, closeL;
      if (isBeg) {
        if (hasPmt) {
          principal = pmtR;
          interest  = Math.round((openL - pmtR) * monthlyRate);
          closeL    = openL - pmtR + interest;
        } else {
          interest  = Math.round(openL * monthlyRate);
          principal = 0;
          closeL    = openL + interest;
        }
      } else {
        interest  = Math.round(openL * monthlyRate);
        principal = hasPmt ? pmtR - interest : 0;
        closeL    = openL + interest - pmtR;
      }

      if (closeL < 0) closeL = 0;
      rouC = Math.max(0, rouC - depR);

      sched.push({
        period:    mo,
        periodEnd: periodEndDate ? periodEndDate.toISOString().slice(0, 10) : null,
        openL:     openL,
        interest:  interest,
        pmt:       pmtR,
        principal: principal,
        closeL:    closeL,
        dep:       depR,
        rouC:      rouC,
        hasPmt:    hasPmt
      });

      openL = closeL;
    }

    // True up the final month for accumulated per-row rounding so the liability
    // closes at exactly zero and the schedule's own sub-totals tie back to the
    // opening PV — an auditor foots these columns.
    if (sched.length) {
      // Correct at the LAST ROW THAT CARRIES A PAYMENT — that is where the liability
      // is actually extinguished. Under an advance annuity the final payment falls at
      // the start of the last period, so any months after it must carry nil balance
      // and nil interest rather than accruing on rounding dust.
      var lastPaidIdx = -1;
      for (var k = sched.length - 1; k >= 0; k--) {
        if (sched[k].pmt > 0) { lastPaidIdx = k; break; }
      }
      if (lastPaidIdx >= 0) {
        var lp = sched[lastPaidIdx];
        // Both conventions rearrange to interest = closeL + pmt - openL, closeL = 0.
        var impliedInt = lp.pmt - lp.openL;
        if (impliedInt >= 0) {
          lp.interest  = impliedInt;
          lp.principal = isBeg ? lp.pmt : lp.openL;
        }
        lp.closeL = 0;
        for (var j = lastPaidIdx + 1; j < sched.length; j++) {
          sched[j].openL = 0; sched[j].interest = 0;
          sched[j].principal = 0; sched[j].closeL = 0;
        }
      } else {
        sched[sched.length - 1].closeL = 0;
      }
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
  function currentSplit(sched) {
    var currentLiab = 0;
    sched.slice(0, 12).forEach(function (x) { currentLiab += x.principal; });
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

    var pmtArray   = generatePayments(inp, n, monthsPerPeriod);
    var pv         = Math.round(calcPV(pmtArray, r, timing));
    var rouInitial = Math.round(pv + idc - incentive);
    var dep  = rouInitial / termMonths; // monthly straight-line dep

    var sched = buildSchedule(pmtArray, pv, ibr, timing, dep, inp.start, monthsPerPeriod, termMonths);

    // Adjust ROU carrying values if IDC/incentive changed rouInitial vs pv
    if (idc || incentive) {
      var depAdj = Math.round(rouInitial / termMonths);
      var carry  = rouInitial;
      sched = sched.map(function (row) {
        carry = Math.max(0, carry - depAdj);
        return Object.assign({}, row, { dep: depAdj, rouC: carry });
      });
    }

    // Absorb rounding into the final month so accumulated depreciation equals the
    // ROU asset exactly — otherwise the ROU rollforward does not foot and the GL
    // is left with a stub balance in accumulated depreciation.
    if (sched.length) {
      var depSum = sched.reduce(function (s, x) { return s + x.dep; }, 0);
      if (depSum !== rouInitial) {
        sched[sched.length - 1].dep += (rouInitial - depSum);
        sched[sched.length - 1].rouC = 0;
      }
    }

    var annual  = buildAnnual(sched, inp.start, 1); // schedule is monthly
    var currL   = currentSplit(sched);
    var ncurrL  = Math.max(0, pv - currL);
    var totInt  = sched.reduce(function (s, x) { return s + x.interest; }, 0);
    var totPmt  = sched.reduce(function (s, x) { return s + x.pmt; }, 0);
    var depAnnual = Math.round(dep * 12); // monthly dep × 12

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
