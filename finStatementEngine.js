// ═══════════════════════════════════════════════════════════════════════
// Finosutra — Financial Statement Calculation Engine
// Non-Corporate Entity (Proprietorship) — Full ICAI Note Fidelity
// Format: ICAI Guidance Note on Financial Statements for Non-Corporate Entities
// Version: 2.0 | Pure JS — no DOM access
//
// Usage:
//   var err = finStatementEngine.validate(tb);
//   var res = finStatementEngine.calculate(tb);
//
// ARCHITECTURE NOTE (read before touching validate()/calculate()):
// calculate() is the single source of truth for every note's roll-up.
// validate()'s tally check is DERIVED from calculate()'s own Balance Sheet
// result (balanceSheet.balanced) rather than kept as a second, independent
// "flat sum" formula. A prior version of this engine (see project memory)
// had two separate formulas that drifted out of sync — a realistic test
// case passed the flat tally check but left the Balance Sheet unbalanced
// by exactly the Inventory figure. Checking "does the Balance Sheet
// balance" is mathematically equivalent to "does the trial balance
// tally" (both restate the same double-entry identity), so deriving one
// from the other eliminates that whole class of bug by construction —
// there is only one place the roll-up logic lives.
// ═══════════════════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  var TOLERANCE = 1; // ₹1 rounding tolerance

  function num(v) { var n = +v; return isNaN(n) ? 0 : n; }
  function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
  function sumVals(obj, keys) { return keys.reduce(function (s, k) { return s + num(obj ? obj[k] : 0); }, 0); }

  // ── Metadata: item lists per note (single source of truth — the TB
  //    template, the upload parser, and the export all read from here) ──

  var RESERVE_ITEMS = [
    { key: 'capitalReserve', label: 'Capital Reserve' },
    { key: 'revaluationReserve', label: 'Revaluation Reserve' },
    { key: 'otherReserve', label: 'Other Reserve' },
    { key: 'undistributedSurplus', label: 'Undistributed Surplus (b/f)' }
  ];

  var BORROWING_DIMS = [
    { key: 'securedLT', label: 'Secured - Long Term' },
    { key: 'securedST', label: 'Secured - Short Term' },
    { key: 'unsecuredLT', label: 'Unsecured - Long Term' },
    { key: 'unsecuredST', label: 'Unsecured - Short Term' }
  ];
  var BORROWING_ITEMS = [
    { key: 'termLoanBanks', label: 'Term Loans - from Banks' },
    { key: 'termLoanOthers', label: 'Term Loans - from Other Parties' },
    { key: 'loansOnDemandBanks', label: 'Loans Repayable on Demand - Banks' },
    { key: 'loansOnDemandOthers', label: 'Loans Repayable on Demand - Other Parties' },
    { key: 'deferredPaymentLiabilities', label: 'Deferred Payment Liabilities' },
    { key: 'loansRelatedParties', label: 'Loans/Advances from Related Parties' },
    { key: 'financeLeaseObligations', label: 'Finance Lease Obligations' },
    { key: 'otherLoans', label: 'Other Loans/Advances' }
  ];

  var OTHER_LT_LIAB_ITEMS = [
    { key: 'advanceFromCustomers', label: 'Advance from Customers' },
    { key: 'othersLT', label: 'Others (specify nature)' }
  ];

  var PROVISION_DIMS = [
    { key: 'LT', label: 'Long Term' },
    { key: 'ST', label: 'Short Term' }
  ];
  var PROVISION_ITEMS = [
    { key: 'gratuity', label: 'Provision for Gratuity' },
    { key: 'leaveEncashment', label: 'Provision for Leave Encashment' },
    { key: 'incomeTax', label: 'Provision for Income Tax' },
    { key: 'warrantiesSalesReturn', label: 'Provision for Warranties / Sales Return' },
    { key: 'otherProvisions', label: 'Other Provisions' }
  ];

  var TRADE_PAYABLES_ITEMS = [
    { key: 'msmeDues', label: 'Dues to Micro, Small & Medium Enterprises' },
    { key: 'nonMsmeDues', label: 'Dues to Other Creditors' }
  ];
  // MSMED Act disclosure — informational sub-analysis of msmeDues above,
  // NOT counted again in the tally (it would double-count trade payables).
  var MSMED_DISCLOSURE_ITEMS = [
    { key: 'principalUnpaid', label: 'Principal Unpaid at Year End' },
    { key: 'interestUnpaid', label: 'Interest Unpaid at Year End' },
    { key: 'interestPaidS16', label: "Interest Paid under MSMED Act s.16" },
    { key: 'interestDueSucceeding', label: 'Interest Due - Succeeding Years' },
    { key: 'furtherInterestDue', label: 'Further Interest Due (s.23 disallowance)' }
  ];

  var OTHER_CURR_LIAB_ITEMS = [
    { key: 'financeLeaseCurrentMaturities', label: 'Current Maturities of Finance Lease' },
    { key: 'interestAccruedNotDue', label: 'Interest Accrued but Not Due on Borrowings' },
    { key: 'interestAccruedDue', label: 'Interest Accrued and Due on Borrowings' },
    { key: 'incomeReceivedAdvance', label: 'Income Received in Advance' },
    { key: 'unearnedRevenue', label: 'Unearned Revenue' },
    { key: 'gstPayable', label: 'GST Payable' },
    { key: 'tdsPayable', label: 'TDS Payable' },
    { key: 'otherPayables', label: 'Other Payables' }
  ];

  var ASSET_CLASSES = [
    { key: 'freeholdLand', label: 'Freehold Land', type: 'tangible' },
    { key: 'buildings', label: 'Buildings', type: 'tangible' },
    { key: 'plantEquipment', label: 'Plant and Equipment', type: 'tangible' },
    { key: 'officeEquipment', label: 'Office Equipment', type: 'tangible' },
    { key: 'furnitureFixtures', label: 'Furniture & Fixtures', type: 'tangible' },
    { key: 'vehicles', label: 'Vehicles', type: 'tangible' },
    { key: 'otherTangible', label: 'Other Tangible Assets', type: 'tangible' },
    { key: 'computerSoftware', label: 'Computer Software', type: 'intangible' },
    { key: 'otherIntangible', label: 'Other Intangible Assets', type: 'intangible' }
  ];
  var ASSET_FIELDS = ['openingGross', 'additions', 'deductionsGross', 'openingAccumDep', 'depreciationYear', 'deductionsAccumDep'];

  var INVESTMENT_DIMS = [
    { key: 'nonCurrentQuoted', label: 'Non-Current - Quoted' },
    { key: 'nonCurrentUnquoted', label: 'Non-Current - Unquoted' },
    { key: 'currentQuoted', label: 'Current - Quoted' },
    { key: 'currentUnquoted', label: 'Current - Unquoted' }
  ];
  var INVESTMENT_ITEMS = [
    { key: 'investmentsOtherEntities', label: 'Investments in Other Entities' },
    { key: 'investmentsPartnershipFirm', label: 'Investments in Partnership Firm' },
    { key: 'investmentsPreferenceShares', label: 'Investments in Preference Shares' },
    { key: 'investmentsEquity', label: 'Investments in Equity Instruments' },
    { key: 'investmentsGovtSecurities', label: 'Investments in Govt/Trust Securities' },
    { key: 'investmentsDebentures', label: 'Investments in Debentures/Bonds' },
    { key: 'investmentsMutualFunds', label: 'Investments in Mutual Funds' },
    { key: 'investmentsProperty', label: 'Investment Property' },
    { key: 'otherInvestments', label: 'Other Investments' }
  ];

  var LOANS_ADV_DIMS = [
    { key: 'securedLT', label: 'Secured - Long Term' },
    { key: 'securedST', label: 'Secured - Short Term' },
    { key: 'unsecuredLT', label: 'Unsecured - Long Term' },
    { key: 'unsecuredST', label: 'Unsecured - Short Term' }
  ];
  var LOANS_ADV_ITEMS = [
    { key: 'capitalAdvancesGood', label: 'Capital Advances - Considered Good' },
    { key: 'capitalAdvancesDoubtful', label: 'Capital Advances - Doubtful' },
    { key: 'provisionDoubtfulAdvances', label: 'Less: Provision for Doubtful Advances', isDeduction: true },
    { key: 'loansToPartnersRelatives', label: 'Loans/Advances to Partners or Relatives' },
    { key: 'otherLoansAdvances', label: 'Other Loans and Advances' },
    { key: 'prepaidExpenses', label: 'Prepaid Expenses' },
    { key: 'advanceTaxTDS', label: 'Advance Tax and TDS' },
    { key: 'gstVatServiceTaxCredit', label: 'GST/VAT/Service Tax Credit Receivable' },
    { key: 'securityDepositsGiven', label: 'Security Deposits' },
    { key: 'balanceWithGovtAuthorities', label: 'Balance with Government Authorities' }
  ];

  var OTHER_NC_ASSETS_ITEMS = [
    { key: 'securityDepositsNC', label: 'Security Deposits' },
    { key: 'prepaidExpensesNC', label: 'Prepaid Expenses' },
    { key: 'othersNC', label: 'Others (specify nature)' }
  ];

  // Note 15 — these closing balances are ALSO referenced (not re-entered)
  // by Note 21's COGS / changes-in-inventory formulas.
  var INVENTORY_ITEMS = [
    { key: 'rawMaterials', label: 'Raw Materials' },
    { key: 'wip', label: 'Work-in-Progress' },
    { key: 'finishedGoods', label: 'Finished Goods' },
    { key: 'stockInTrade', label: 'Stock-in-Trade' },
    { key: 'storesSpares', label: 'Stores and Spares' },
    { key: 'looseTools', label: 'Loose Tools' },
    { key: 'otherInventory', label: 'Others (specify nature)' }
  ];

  var RECEIVABLE_DIMS = [
    { key: 'under6mo', label: 'Outstanding < 6 Months' },
    { key: 'over6mo', label: 'Outstanding > 6 Months' }
  ];
  var RECEIVABLE_ITEMS = [
    { key: 'securedGood', label: 'Secured, Considered Good' },
    { key: 'unsecuredGood', label: 'Unsecured, Considered Good' },
    { key: 'doubtful', label: 'Doubtful' }
  ];

  var CASH_EQUIV_ITEMS = [
    { key: 'currentAccounts', label: 'Balances with Banks - Current Accounts' },
    { key: 'cashCreditDebitBalance', label: 'Cash Credit Account (Debit Balance)' },
    { key: 'fdLessThan3Months', label: 'Fixed Deposits (original maturity < 3 months)' },
    { key: 'chequesDrafts', label: 'Cheques, Drafts on Hand' },
    { key: 'cashOnHand', label: 'Cash on Hand' }
  ];
  var OTHER_BANK_BAL_ITEMS = [
    { key: 'earmarkedDeposits', label: 'Earmarked Bank Deposits' },
    { key: 'deposits3to12Months', label: 'Deposits (maturity 3–12 months)' },
    { key: 'marginMoneyDeposits', label: 'Margin Money / Deposits under Lien' },
    { key: 'otherBankBalances', label: 'Others (specify nature)' }
  ];

  var OTHER_CURR_ASSETS_ITEMS = [
    { key: 'interestAccruedNotDueDeposits', label: 'Interest Accrued but Not Due on Deposits' },
    { key: 'interestAccruedDueDeposits', label: 'Interest Accrued and Due on Deposits' }
  ];

  var REVENUE_ITEMS = [
    { key: 'saleOfProducts', label: 'Sale of Products' },
    { key: 'saleOfServices', label: 'Sale of Services' },
    { key: 'grantsDonations', label: 'Grants or Donations Received' },
    { key: 'otherOperatingRevenue', label: 'Other Operating Revenue' }
  ];

  var OTHER_INCOME_ITEMS = [
    { key: 'interestIncome', label: 'Interest Income' },
    { key: 'dividendIncome', label: 'Dividend Income' },
    { key: 'netGainSaleInvestments', label: 'Net Gain on Sale of Investments' },
    { key: 'otherNonOperatingIncome', label: 'Other Non-Operating Income' }
  ];

  var EMPLOYEE_BENEFITS_ITEMS = [
    { key: 'salariesWagesBonus', label: 'Salaries, Wages, Bonus & Allowances' },
    { key: 'pfContribution', label: 'Contribution to PF & Other Funds' },
    { key: 'gratuityExpense', label: 'Gratuity Expense' },
    { key: 'staffWelfare', label: 'Staff Welfare Expenses' }
  ];

  var FINANCE_COST_ITEMS = [
    { key: 'interestBankLoan', label: 'Interest on Bank Loan' },
    { key: 'interestFinanceLease', label: 'Interest on Finance Lease' },
    { key: 'interestOnCapital', label: "Interest on Proprietor's Capital" },
    { key: 'otherBorrowingCosts', label: 'Other Borrowing Costs' },
    { key: 'forexLossFinanceCost', label: 'Forex Loss Treated as Finance Cost' }
  ];

  // Other Expenses — 'provisionDiminutionInvestments' and
  // 'provisionForDoubtfulDebts' are SHARED single inputs that also reduce
  // Note 12 (Investments) and Note 16 (Trade Receivables) respectively —
  // entered once here, not duplicated on the BS notes.
  var OTHER_EXPENSES_ITEMS = [
    { key: 'storesSparesConsumption', label: 'Consumption of Stores & Spare Parts' },
    { key: 'powerFuel', label: 'Power and Fuel' },
    { key: 'rent', label: 'Rent' },
    { key: 'repairsBuildings', label: 'Repairs and Maintenance - Buildings' },
    { key: 'repairsMachinery', label: 'Repairs and Maintenance - Machinery' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'rentRatesTaxes', label: 'Rent, Rates and Taxes' },
    { key: 'labourCharges', label: 'Labour Charges' },
    { key: 'travellingExpenses', label: 'Travelling Expenses' },
    { key: 'auditorsRemuneration', label: "Auditor's Remuneration" },
    { key: 'printingStationery', label: 'Printing and Stationery' },
    { key: 'communicationExpenses', label: 'Communication Expenses' },
    { key: 'legalProfessional', label: 'Legal and Professional Charges' },
    { key: 'advertisementPublicity', label: 'Advertisement and Publicity' },
    { key: 'businessPromotion', label: 'Business Promotion Expenses' },
    { key: 'commission', label: 'Commission' },
    { key: 'clearingForwarding', label: 'Clearing and Forwarding Charges' },
    { key: 'lossSalePPE', label: 'Loss on Sale of Property, Plant and Equipment' },
    { key: 'forexLossOther', label: 'Loss on Foreign Exchange Transactions (net)' },
    { key: 'lossCancellationForwardContracts', label: 'Loss on Cancellation of Forward Contracts' },
    { key: 'lossSaleInvestments', label: 'Loss on Sale of Investments (net)' },
    { key: 'provisionDiminutionInvestments', label: 'Provision for Diminution in Value of Investments' },
    { key: 'provisionForDoubtfulDebts', label: 'Provision for Doubtful Debts' },
    { key: 'miscExpenses', label: 'Miscellaneous Expenses' }
  ];

  // ── Blank input scaffold ────────────────────────────────────────────
  function blankGrid(dims, items) {
    var g = {};
    dims.forEach(function (d) {
      g[d.key] = {};
      items.forEach(function (it) { g[d.key][it.key] = 0; });
    });
    return g;
  }
  function blankFlat(items) {
    var o = {};
    items.forEach(function (it) { o[it.key] = 0; });
    return o;
  }

  function blankInput() {
    return {
      capital: { openingBalance: 0, introduced: 0, remuneration: 0, interest: 0, withdrawals: 0 },
      reserves: blankFlat(RESERVE_ITEMS),
      borrowings: blankGrid(BORROWING_DIMS, BORROWING_ITEMS),
      otherLTLiabilities: blankFlat(OTHER_LT_LIAB_ITEMS),
      provisions: blankGrid(PROVISION_DIMS, PROVISION_ITEMS),
      tradePayables: blankFlat(TRADE_PAYABLES_ITEMS),
      msmedDisclosure: blankFlat(MSMED_DISCLOSURE_ITEMS),
      otherCurrentLiabilities: blankFlat(OTHER_CURR_LIAB_ITEMS),
      fixedAssets: (function () {
        var o = {};
        ASSET_CLASSES.forEach(function (c) {
          o[c.key] = {};
          ASSET_FIELDS.forEach(function (f) { o[c.key][f] = 0; });
        });
        return o;
      })(),
      cwip: { opening: 0, additions: 0, capitalized: 0 },
      iaud: { opening: 0, additions: 0, capitalized: 0 },
      investments: blankGrid(INVESTMENT_DIMS, INVESTMENT_ITEMS),
      loansAdvances: blankGrid(LOANS_ADV_DIMS, LOANS_ADV_ITEMS),
      otherNonCurrentAssets: blankFlat(OTHER_NC_ASSETS_ITEMS),
      inventories: blankFlat(INVENTORY_ITEMS),
      tradeReceivables: blankGrid(RECEIVABLE_DIMS, RECEIVABLE_ITEMS),
      unbilledReceivables: 0,
      cashEquivalents: blankFlat(CASH_EQUIV_ITEMS),
      otherBankBalances: blankFlat(OTHER_BANK_BAL_ITEMS),
      otherCurrentAssets: blankFlat(OTHER_CURR_ASSETS_ITEMS),
      revenue: blankFlat(REVENUE_ITEMS),
      exciseDuty: 0,
      otherIncome: blankFlat(OTHER_INCOME_ITEMS),
      cogs: {
        openingRawMaterial: 0, purchasesRawMaterial: 0,
        purchasesStockInTrade: 0,
        openingStockInTrade: 0, openingWIP: 0, openingFinishedGoods: 0
      },
      employeeBenefits: blankFlat(EMPLOYEE_BENEFITS_ITEMS),
      financeCosts: blankFlat(FINANCE_COST_ITEMS),
      otherExpenses: blankFlat(OTHER_EXPENSES_ITEMS)
    };
  }

  // ── Validate ─────────────────────────────────────────────────────────
  // Basic input sanity, then defer the real tally check to calculate()'s
  // own Balance Sheet result — see architecture note at the top of file.
  function validate(tb) {
    var errors = [];
    tb = tb || {};

    function checkNonNegative(section, obj, items) {
      items.forEach(function (it) {
        if (num(obj ? obj[it.key] : 0) < 0) {
          errors.push({ section: section, field: it.key, message: it.label + ': amount cannot be negative' });
        }
      });
    }
    function checkGridNonNegative(section, grid, dims, items) {
      dims.forEach(function (d) {
        items.forEach(function (it) {
          if (num(grid && grid[d.key] ? grid[d.key][it.key] : 0) < 0) {
            errors.push({ section: section, field: d.key + '.' + it.key, message: d.label + ' — ' + it.label + ': amount cannot be negative' });
          }
        });
      });
    }

    checkNonNegative('reserves', tb.reserves, RESERVE_ITEMS);
    checkGridNonNegative('borrowings', tb.borrowings, BORROWING_DIMS, BORROWING_ITEMS);
    checkNonNegative('otherLTLiabilities', tb.otherLTLiabilities, OTHER_LT_LIAB_ITEMS);
    checkGridNonNegative('provisions', tb.provisions, PROVISION_DIMS, PROVISION_ITEMS);
    checkNonNegative('tradePayables', tb.tradePayables, TRADE_PAYABLES_ITEMS);
    checkNonNegative('otherCurrentLiabilities', tb.otherCurrentLiabilities, OTHER_CURR_LIAB_ITEMS);
    checkNonNegative('otherNonCurrentAssets', tb.otherNonCurrentAssets, OTHER_NC_ASSETS_ITEMS);
    checkNonNegative('inventories', tb.inventories, INVENTORY_ITEMS);
    checkGridNonNegative('tradeReceivables', tb.tradeReceivables, RECEIVABLE_DIMS, RECEIVABLE_ITEMS);
    checkNonNegative('cashEquivalents', tb.cashEquivalents, CASH_EQUIV_ITEMS);
    checkNonNegative('otherBankBalances', tb.otherBankBalances, OTHER_BANK_BAL_ITEMS);
    checkNonNegative('otherCurrentAssets', tb.otherCurrentAssets, OTHER_CURR_ASSETS_ITEMS);
    checkNonNegative('revenue', tb.revenue, REVENUE_ITEMS);
    checkNonNegative('otherIncome', tb.otherIncome, OTHER_INCOME_ITEMS);
    checkNonNegative('employeeBenefits', tb.employeeBenefits, EMPLOYEE_BENEFITS_ITEMS);
    checkNonNegative('financeCosts', tb.financeCosts, FINANCE_COST_ITEMS);
    checkNonNegative('otherExpenses', tb.otherExpenses, OTHER_EXPENSES_ITEMS);

    ASSET_CLASSES.forEach(function (c) {
      var row = (tb.fixedAssets || {})[c.key] || {};
      ASSET_FIELDS.forEach(function (f) {
        if (num(row[f]) < 0) errors.push({ section: 'fixedAssets', field: c.key + '.' + f, message: c.label + ' — ' + f + ': cannot be negative' });
      });
      var closingGross = num(row.openingGross) + num(row.additions) - num(row.deductionsGross);
      var closingAccumDep = num(row.openingAccumDep) + num(row.depreciationYear) - num(row.deductionsAccumDep);
      if (closingGross < -TOLERANCE) errors.push({ section: 'fixedAssets', field: c.key, message: c.label + ': deductions exceed opening + additions (closing gross block would be negative)' });
      if (closingAccumDep < -TOLERANCE) errors.push({ section: 'fixedAssets', field: c.key, message: c.label + ': accumulated depreciation deductions exceed opening + current year (would be negative)' });
      if (closingAccumDep > closingGross + TOLERANCE) errors.push({ section: 'fixedAssets', field: c.key, message: c.label + ': accumulated depreciation cannot exceed gross block' });
    });

    var cap = tb.capital || {};
    if (num(cap.introduced) < 0 || num(cap.withdrawals) < 0) {
      errors.push({ section: 'capital', field: 'capital', message: 'Capital introduced and withdrawals cannot be negative' });
    }

    var basicValid = errors.length === 0;
    var result = calculate(tb);
    var bs = result.balanceSheet;

    if (!bs.balanced) {
      errors.push({
        section: 'tally',
        field: 'tally',
        message: 'Trial balance does not tally: Total Assets ₹' + Math.round(bs.totalAssets).toLocaleString('en-IN') +
          ' vs Total Equity & Liabilities ₹' + Math.round(bs.totalEquityAndLiabilities).toLocaleString('en-IN') +
          ' (difference ₹' + Math.round(Math.abs(bs.difference)).toLocaleString('en-IN') + ')'
      });
    }

    return {
      valid: basicValid && bs.balanced,
      errors: errors,
      totals: { debit: bs.totalAssets, credit: bs.totalEquityAndLiabilities, difference: bs.difference },
      result: result
    };
  }

  // ── Main calculate ───────────────────────────────────────────────────
  function calculate(tb) {
    tb = tb || {};

    function grid(obj, dims, items, filterFn) {
      var total = 0;
      var byDim = {};
      dims.forEach(function (d) {
        var row = (obj || {})[d.key] || {};
        var s = 0;
        items.forEach(function (it) {
          if (filterFn && !filterFn(it)) return;
          var v = num(row[it.key]);
          s += it.isDeduction ? -v : v;
        });
        byDim[d.key] = round2(s);
        total += s;
      });
      return { byDim: byDim, total: round2(total) };
    }
    function flat(obj, items) {
      var total = 0;
      var byItem = {};
      items.forEach(function (it) {
        var v = num(obj ? obj[it.key] : 0);
        byItem[it.key] = v;
        total += it.isDeduction ? -v : v;
      });
      return { byItem: byItem, total: round2(total) };
    }

    // ── Note 3 — Capital Account ──
    var cap = tb.capital || {};
    var capOpening = num(cap.openingBalance), capIntroduced = num(cap.introduced),
      capRemuneration = num(cap.remuneration), capInterest = num(cap.interest), capWithdrawals = num(cap.withdrawals);

    // ── Note 11 — Fixed Assets (full gross-block method) ──
    var faByClass = ASSET_CLASSES.map(function (c) {
      var row = (tb.fixedAssets || {})[c.key] || {};
      var openingGross = num(row.openingGross), additions = num(row.additions), deductionsGross = num(row.deductionsGross);
      var openingAccumDep = num(row.openingAccumDep), depreciationYear = num(row.depreciationYear), deductionsAccumDep = num(row.deductionsAccumDep);
      var closingGross = round2(openingGross + additions - deductionsGross);
      var closingAccumDep = round2(openingAccumDep + depreciationYear - deductionsAccumDep);
      var netBlock = round2(Math.max(0, closingGross - closingAccumDep));
      return {
        key: c.key, label: c.label, type: c.type,
        openingGross: openingGross, additions: additions, deductionsGross: deductionsGross, closingGross: closingGross,
        openingAccumDep: openingAccumDep, depreciationYear: depreciationYear, deductionsAccumDep: deductionsAccumDep, closingAccumDep: closingAccumDep,
        netBlock: netBlock
      };
    });
    var totalNetBlockTangible = round2(faByClass.filter(function (c) { return c.type === 'tangible'; }).reduce(function (s, c) { return s + c.netBlock; }, 0));
    var totalNetBlockIntangible = round2(faByClass.filter(function (c) { return c.type === 'intangible'; }).reduce(function (s, c) { return s + c.netBlock; }, 0));
    var totalDepreciationTangible = round2(faByClass.filter(function (c) { return c.type === 'tangible'; }).reduce(function (s, c) { return s + c.depreciationYear; }, 0));
    var totalDepreciationIntangible = round2(faByClass.filter(function (c) { return c.type === 'intangible'; }).reduce(function (s, c) { return s + c.depreciationYear; }, 0));
    var totalDepreciation = round2(totalDepreciationTangible + totalDepreciationIntangible);

    var cwip = tb.cwip || {}; var closingCWIP = round2(num(cwip.opening) + num(cwip.additions) - num(cwip.capitalized));
    var iaud = tb.iaud || {}; var closingIAUD = round2(num(iaud.opening) + num(iaud.additions) - num(iaud.capitalized));

    // ── Note 4-10 — Liabilities ──
    var reserves = flat(tb.reserves, RESERVE_ITEMS);
    var borrowings = grid(tb.borrowings, BORROWING_DIMS, BORROWING_ITEMS);
    var borrowingsLT = round2(borrowings.byDim.securedLT + borrowings.byDim.unsecuredLT);
    var borrowingsST = round2(borrowings.byDim.securedST + borrowings.byDim.unsecuredST);
    var otherLTLiab = flat(tb.otherLTLiabilities, OTHER_LT_LIAB_ITEMS);
    var provisions = grid(tb.provisions, PROVISION_DIMS, PROVISION_ITEMS);
    var tradePayables = flat(tb.tradePayables, TRADE_PAYABLES_ITEMS);
    var otherCurrLiab = flat(tb.otherCurrentLiabilities, OTHER_CURR_LIAB_ITEMS);

    // ── Note 12-18 — Assets ──
    // provisionDiminutionInvestments lives in Other Expenses (Note 25) and
    // reduces the investments total here — entered once, used twice.
    var provisionDiminutionInvestments = num((tb.otherExpenses || {}).provisionDiminutionInvestments);
    var investmentsGrid = grid(tb.investments, INVESTMENT_DIMS, INVESTMENT_ITEMS);
    var totalInvestments = round2(investmentsGrid.total - provisionDiminutionInvestments);
    var totalInvestmentsNonCurrent = round2(investmentsGrid.byDim.nonCurrentQuoted + investmentsGrid.byDim.nonCurrentUnquoted);
    var totalInvestmentsCurrent = round2(investmentsGrid.byDim.currentQuoted + investmentsGrid.byDim.currentUnquoted);

    var loansAdvGrid = grid(tb.loansAdvances, LOANS_ADV_DIMS, LOANS_ADV_ITEMS);
    var loansAdvLT = round2(loansAdvGrid.byDim.securedLT + loansAdvGrid.byDim.unsecuredLT);
    var loansAdvST = round2(loansAdvGrid.byDim.securedST + loansAdvGrid.byDim.unsecuredST);

    var otherNCAssets = flat(tb.otherNonCurrentAssets, OTHER_NC_ASSETS_ITEMS);
    var inv = flat(tb.inventories, INVENTORY_ITEMS);

    // provisionForDoubtfulDebts lives in Other Expenses (Note 25) and
    // reduces Trade Receivables here — entered once, used twice.
    var provisionForDoubtfulDebts = num((tb.otherExpenses || {}).provisionForDoubtfulDebts);
    var recvGrid = grid(tb.tradeReceivables, RECEIVABLE_DIMS, RECEIVABLE_ITEMS);
    var unbilled = num(tb.unbilledReceivables);
    var totalTradeReceivables = round2(recvGrid.total + unbilled - provisionForDoubtfulDebts);

    var cashEquiv = flat(tb.cashEquivalents, CASH_EQUIV_ITEMS);
    var otherBankBal = flat(tb.otherBankBalances, OTHER_BANK_BAL_ITEMS);
    var totalCashBank = round2(cashEquiv.total + otherBankBal.total);
    var otherCurrAssets = flat(tb.otherCurrentAssets, OTHER_CURR_ASSETS_ITEMS);

    // ── Notes 19-25 — Statement of P&L ──
    var revenue = flat(tb.revenue, REVENUE_ITEMS);
    var exciseDuty = num(tb.exciseDuty);
    var revenueFromOperations = round2(revenue.total - exciseDuty);
    var otherIncome = flat(tb.otherIncome, OTHER_INCOME_ITEMS);
    var totalIncome = round2(revenueFromOperations + otherIncome.total);

    var cogsIn = tb.cogs || {};
    var rawMaterialConsumed = round2(num(cogsIn.openingRawMaterial) + num(cogsIn.purchasesRawMaterial) - num((tb.inventories || {}).rawMaterials));
    var purchasesStockInTrade = num(cogsIn.purchasesStockInTrade);
    var openingCII = round2(num(cogsIn.openingStockInTrade) + num(cogsIn.openingWIP) + num(cogsIn.openingFinishedGoods));
    var closingCII = round2(num((tb.inventories || {}).stockInTrade) + num((tb.inventories || {}).wip) + num((tb.inventories || {}).finishedGoods));
    var changesInInventories = round2(openingCII - closingCII);
    var costOfGoodsSold = round2(rawMaterialConsumed + purchasesStockInTrade + changesInInventories);

    var employeeBenefits = flat(tb.employeeBenefits, EMPLOYEE_BENEFITS_ITEMS);
    var financeCosts = flat(tb.financeCosts, FINANCE_COST_ITEMS);
    var depreciationExpense = totalDepreciation;
    var otherExpenses = flat(tb.otherExpenses, OTHER_EXPENSES_ITEMS);

    var totalExpenses = round2(costOfGoodsSold + employeeBenefits.total + financeCosts.total + depreciationExpense + otherExpenses.total);
    var profitForYear = round2(totalIncome - totalExpenses);

    var profitLoss = {
      revenueFromOperations: revenueFromOperations, otherIncome: otherIncome.total, totalIncome: totalIncome,
      costOfGoodsSold: costOfGoodsSold, employeeBenefits: employeeBenefits.total, financeCosts: financeCosts.total,
      depreciationExpense: depreciationExpense, otherExpensesTotal: otherExpenses.total, totalExpenses: totalExpenses,
      profitForYear: profitForYear,
      notes: {
        revenue: revenue, otherIncome: otherIncome,
        cogs: { rawMaterialConsumed: rawMaterialConsumed, purchasesStockInTrade: purchasesStockInTrade, changesInInventories: changesInInventories, total: costOfGoodsSold },
        employeeBenefits: employeeBenefits, financeCosts: financeCosts, otherExpenses: otherExpenses
      }
    };

    // ── Capital Account closing ──
    var capitalAccount = {
      openingBalance: capOpening, introduced: capIntroduced, remuneration: capRemuneration,
      interest: capInterest, withdrawals: capWithdrawals, profitForYear: profitForYear,
      closingBalance: round2(capOpening + capIntroduced + capRemuneration + capInterest - capWithdrawals + profitForYear)
    };

    // ── Balance Sheet ──
    var nonCurrentLiabilities = { longTermBorrowings: borrowingsLT, total: borrowingsLT };
    var currentLiabilities = {
      shortTermBorrowings: borrowingsST, tradePayables: tradePayables.total,
      otherCurrentLiabilities: otherCurrLiab.total, shortTermProvisions: provisions.byDim.ST,
      total: round2(borrowingsST + tradePayables.total + otherCurrLiab.total + provisions.byDim.ST)
    };
    // Note: Long-term provisions and Other LT liabilities and Reserves also
    // sit on the equity/liabilities side — folded into non-current for BS
    // presentation, matching ICAI's own grouping.
    nonCurrentLiabilities.otherLongTerm = round2(otherLTLiab.total + provisions.byDim.LT);
    nonCurrentLiabilities.total = round2(nonCurrentLiabilities.total + nonCurrentLiabilities.otherLongTerm);

    var ownersFunds = round2(capitalAccount.closingBalance + reserves.total);
    var totalEquityAndLiabilities = round2(ownersFunds + nonCurrentLiabilities.total + currentLiabilities.total);

    var nonCurrentAssets = {
      fixedAssetsNetBlock: round2(totalNetBlockTangible + totalNetBlockIntangible),
      capitalWorkInProgress: Math.max(0, closingCWIP),
      intangibleAssetsUnderDevelopment: Math.max(0, closingIAUD),
      nonCurrentInvestments: totalInvestmentsNonCurrent,
      longTermLoansAdvances: loansAdvLT,
      otherNonCurrentAssets: otherNCAssets.total
    };
    nonCurrentAssets.total = round2(
      nonCurrentAssets.fixedAssetsNetBlock + nonCurrentAssets.capitalWorkInProgress + nonCurrentAssets.intangibleAssetsUnderDevelopment +
      nonCurrentAssets.nonCurrentInvestments + nonCurrentAssets.longTermLoansAdvances + nonCurrentAssets.otherNonCurrentAssets
    );

    var currentAssets = {
      currentInvestments: totalInvestmentsCurrent,
      inventories: inv.total,
      tradeReceivables: totalTradeReceivables,
      cashAndBank: totalCashBank,
      shortTermLoansAdvances: loansAdvST,
      otherCurrentAssets: otherCurrAssets.total
    };
    currentAssets.total = round2(
      currentAssets.currentInvestments + currentAssets.inventories + currentAssets.tradeReceivables +
      currentAssets.cashAndBank + currentAssets.shortTermLoansAdvances + currentAssets.otherCurrentAssets
    );

    var totalAssets = round2(nonCurrentAssets.total + currentAssets.total);
    var bsDifference = round2(totalEquityAndLiabilities - totalAssets);

    var balanceSheet = {
      ownersFunds: ownersFunds, capitalClosing: capitalAccount.closingBalance, reserves: reserves.total,
      nonCurrentLiabilities: nonCurrentLiabilities, currentLiabilities: currentLiabilities,
      totalEquityAndLiabilities: totalEquityAndLiabilities,
      nonCurrentAssets: nonCurrentAssets, currentAssets: currentAssets, totalAssets: totalAssets,
      balanced: Math.abs(bsDifference) <= TOLERANCE, difference: bsDifference
    };

    return {
      raw: tb,
      capitalAccount: capitalAccount,
      fixedAssets: {
        byClass: faByClass,
        totalNetBlockTangible: totalNetBlockTangible, totalNetBlockIntangible: totalNetBlockIntangible,
        totalDepreciationTangible: totalDepreciationTangible, totalDepreciationIntangible: totalDepreciationIntangible,
        totalDepreciation: totalDepreciation,
        cwip: { opening: num(cwip.opening), additions: num(cwip.additions), capitalized: num(cwip.capitalized), closing: closingCWIP },
        iaud: { opening: num(iaud.opening), additions: num(iaud.additions), capitalized: num(iaud.capitalized), closing: closingIAUD }
      },
      notes: {
        reserves: reserves, borrowings: borrowings, otherLTLiabilities: otherLTLiab, provisions: provisions,
        tradePayables: tradePayables, otherCurrentLiabilities: otherCurrLiab,
        investments: investmentsGrid, provisionDiminutionInvestments: provisionDiminutionInvestments, totalInvestments: totalInvestments,
        loansAdvances: loansAdvGrid, otherNonCurrentAssets: otherNCAssets, inventories: inv,
        tradeReceivables: recvGrid, unbilledReceivables: unbilled, provisionForDoubtfulDebts: provisionForDoubtfulDebts, totalTradeReceivables: totalTradeReceivables,
        cashEquivalents: cashEquiv, otherBankBalances: otherBankBal, totalCashBank: totalCashBank,
        otherCurrentAssets: otherCurrAssets
      },
      profitLoss: profitLoss,
      balanceSheet: balanceSheet
    };
  }

  function f2(n) {
    if (n === null || n === undefined || isNaN(+n)) return '—';
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  global.finStatementEngine = {
    RESERVE_ITEMS: RESERVE_ITEMS,
    BORROWING_DIMS: BORROWING_DIMS, BORROWING_ITEMS: BORROWING_ITEMS,
    OTHER_LT_LIAB_ITEMS: OTHER_LT_LIAB_ITEMS,
    PROVISION_DIMS: PROVISION_DIMS, PROVISION_ITEMS: PROVISION_ITEMS,
    TRADE_PAYABLES_ITEMS: TRADE_PAYABLES_ITEMS, MSMED_DISCLOSURE_ITEMS: MSMED_DISCLOSURE_ITEMS,
    OTHER_CURR_LIAB_ITEMS: OTHER_CURR_LIAB_ITEMS,
    ASSET_CLASSES: ASSET_CLASSES, ASSET_FIELDS: ASSET_FIELDS,
    INVESTMENT_DIMS: INVESTMENT_DIMS, INVESTMENT_ITEMS: INVESTMENT_ITEMS,
    LOANS_ADV_DIMS: LOANS_ADV_DIMS, LOANS_ADV_ITEMS: LOANS_ADV_ITEMS,
    OTHER_NC_ASSETS_ITEMS: OTHER_NC_ASSETS_ITEMS,
    INVENTORY_ITEMS: INVENTORY_ITEMS,
    RECEIVABLE_DIMS: RECEIVABLE_DIMS, RECEIVABLE_ITEMS: RECEIVABLE_ITEMS,
    CASH_EQUIV_ITEMS: CASH_EQUIV_ITEMS, OTHER_BANK_BAL_ITEMS: OTHER_BANK_BAL_ITEMS,
    OTHER_CURR_ASSETS_ITEMS: OTHER_CURR_ASSETS_ITEMS,
    REVENUE_ITEMS: REVENUE_ITEMS, OTHER_INCOME_ITEMS: OTHER_INCOME_ITEMS,
    EMPLOYEE_BENEFITS_ITEMS: EMPLOYEE_BENEFITS_ITEMS, FINANCE_COST_ITEMS: FINANCE_COST_ITEMS,
    OTHER_EXPENSES_ITEMS: OTHER_EXPENSES_ITEMS,
    blankInput: blankInput,
    validate: validate,
    calculate: calculate,
    f2: f2
  };

})(window);
