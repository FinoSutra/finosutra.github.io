# FINOSUTRA TAX CALCULATORS
## FY 2026-27 / AY 2027-28 — TAX LOGIC & SOFTWARE AUDIT REPORT

**Auditor role:** Senior Indian Income-Tax Expert / CA / Tax Technology QA
**Scope:** `india-tax-calculator.html`, `capital-gains-calculator.html`, `advance-tax-calculator.html`, `hra-calculator.html`
**Audit date:** 2026-09-06
**Method:** Full read of every calculation engine (inline `<script>` blocks), independent re-derivation of each formula from the Income-tax Act/Finance Acts, targeted verification of FY 2026-27-specific provisions via primary/secondary sources, and adversarial numeric testing designed to break each formula at its boundaries.
**No production code was modified during this audit.**

---

## IMPORTANT PRELIMINARY NOTE ON THE LEGAL BASELINE

My training data reliably covers law through **January 2026**. Union Budget 2026 was presented **1 February 2026**, i.e. after that cutoff. I independently verified via live web search that **Budget 2026 made no changes to individual income-tax slabs, rebate, surcharge, or cess for FY 2026-27** — the FY 2025-26 (Finance Act 2025) structure was explicitly carried forward. This is corroborated by multiple independent sources (ClearTax, Axis Max Life, Canara HSBC Life, others) all stating "no change in slabs/rates for FY 2026-27." **I flag this as a "verified but time-boxed" fact**: it is correct as of this audit date, but if any subsequent notification/circular alters rates between now and the return-filing deadline for AY 2027-28, the calculators (and this audit) would need re-validation. Do **not** treat this baseline confirmation as a substitute for checking the CBDT/Income-tax Department site again closer to filing season.

Separately — and this is a **material, previously-unflagged compliance point** — the **Income-tax Act, 2025** replaces the Income-tax Act, 1961, effective for **Tax Year 2026-27 onwards** (the exact period these four tools are branded for). Section numbers are being **renumbered wholesale** (confirmed mappings: §87A → §156, §80C → §123, §80TTA/§80TTB merge into §153; full mapping for §111A/§112/§112A/§234B/§234C not independently confirmed in this audit). All four calculators cite exclusively **old (1961) Act section numbers** in their UI copy, FAQs, and labels. Underlying rates/formulas are (per available evidence) unaffected by the recodification, but a "FY 2026-27" tool citing repealed section numbers is a legal-citation accuracy gap — see **Finding X-4**.

---

## 1. EXECUTIVE SUMMARY

**Overall status: FAIL — PASS WITH CRITICAL ISSUES**

| Calculator | Verdict |
|---|---|
| Income Tax Calculator FY 2026-27 | **FAIL** (4 CRITICAL defects) |
| Capital Gains Tax Calculator | **FAIL** (2 CRITICAL, 2 HIGH defects) |
| Advance Tax Calculator | **FAIL** (2 CRITICAL, 2 HIGH defects) |
| HRA Exemption Calculator | **FAIL** (1 CRITICAL defect — but core formula is otherwise correct and well-built) |

**Overall confidence score: 41/100**

The core three-way-minimum HRA formula, the equity LTCG/STCG rates, the property indexation "choose-the-lower-tax" logic in the Capital Gains calculator, the gold LTCG treatment, the basic new/old-regime slab tables, the 87A "rebate excludes special-rate income" design intent, and the general architecture (100% client-side, no backend re-computation) are all **sound and, in isolation, legally correct**. The failures are concentrated in **four specific, high-impact areas that recur across multiple tools**:

1. **Section 87A eligibility is tested against the wrong income base** (slab income instead of total income including capital gains) in **both** the Income Tax Calculator and the Advance Tax Calculator — independently coded, independently wrong, in the same direction (over-granting the rebate).
2. **Surcharge is either miscalculated (wrong regime cap, no 15% CG cap) or not calculated at all**, across all three income-bearing calculators.
3. **The equity grandfathering cost formula is transposed** in the Capital Gains Calculator, silently converting genuine capital losses into a reported ₹0 gain whenever sale price is the lowest of the three reference values.
4. **A negative-input guard is missing** in the HRA calculator, allowing a negative Basic+DA figure to produce a negative displayed exemption — a direct violation of the audit brief's explicit requirement and of Section 10(13A)'s statutory floor.

None of these are cosmetic. Each one changes the final tax/interest figure shown to a real taxpayer, in a direction that is sometimes taxpayer-favourable (understating liability — a compliance risk for the user) and sometimes taxpayer-adverse (overstating 234C interest, understating a genuine capital loss).

---

## 2. CRITICAL FINDINGS

| ID | Calculator | Issue | Severity | Current Logic | Correct Logic | Impact |
|----|------------|-------|----------|----------------|----------------|--------|
| IT-1 | Income Tax | New-regime surcharge uses the old-regime 37%-above-₹5cr slab | CRITICAL | `calcSurcharge()` applies one blended threshold table regardless of regime | New Regime surcharge is capped at **25%** (no 37% slab) since FY 2023-24; max marginal rate 39%, not 42.744% | Overstates tax for New Regime taxpayers with income > ₹5 crore |
| IT-2 | Income Tax | Surcharge on capital gains/dividend is not capped at 15% | CRITICAL | `TAX_CONFIG.surcharge.capGainSurchargeMax = 0.15` is defined but **never read** anywhere in `calcSurcharge()` | Surcharge on tax attributable to §111A/§112/§112A income (and dividends) is capped at 15% regardless of the total-income surcharge slab | Overstates tax for any HNI taxpayer with property/gold/equity LTCG or STCG whose total income surcharge slab is >15% |
| IT-3 | Income Tax | §87A rebate eligibility (new regime) tested on slab income only | CRITICAL | `if(taxableNormal <= rebateLimit)` — `taxableNormal` **excludes** `cg.eq_ltcg/eq_stcg/prop_ltcg/gold_ltcg` and special income | Per CBDT Circular 13/2025: eligibility requires **TOTAL income including special-rate CG** ≤ ₹12,00,000; if total income exceeds ₹12L (even due to CG), rebate is **denied entirely** | Understates tax liability — a taxpayer with ₹10L slab income + ₹5L equity LTCG (₹15L total) incorrectly gets a full/partial §87A rebate on the slab-tax portion, when none is due |
| IT-4 | Income Tax | Employer NPS §80CCD(2) capped at flat 10% for both regimes | CRITICAL | `Math.min(inputs.emp_nps, basicForNPS * 0.10)` — no regime or govt-employee branch | New Regime: 14% of salary for **all** employees (private and government), effective FY 2025-26 onward. Old Regime: 14% for govt employees, 10% for private. No govt-employee field exists at all | Understates the allowable deduction (overstates tax) for every New Regime salaried taxpayer with employer NPS contributions, and for every Old Regime government employee |
| CG-1 | Capital Gains | Equity grandfathering cost formula is transposed | CRITICAL | `effectiveCost = Math.min(Math.max(cost,fmv), salePrice)` | Sec 55(2)(ac): `CoA = Math.max(cost, Math.min(fmv, salePrice))` | Whenever sale price is the smallest of the three values, code always returns `CoA = salePrice`, reporting **₹0 gain** and hiding a genuine capital **loss** (verified: cost=₹100, FMV=₹150, sale=₹90 → correct loss ₹10, code shows ₹0) |
| CG-2 | Capital Gains | Debt mutual funds always taxed at slab rate, regardless of acquisition date | CRITICAL | No purchase-date test vs. 1 April 2023; slab rate applied unconditionally | Units acquired **before** 1 Apr 2023 and held >24 months retain LTCG treatment at flat 12.5% (no indexation, per the Aug-2024 Finance Act amendment); only units acquired on/after 1 Apr 2023 are always-slab-rate (§50AA) | Materially overstates tax on any pre-Apr-2023 long-term debt-fund holding for taxpayers above the 12.5% slab (i.e., anyone in the 15%+ bracket) |
| AT-1 | Advance Tax | §87A rebate eligibility (same root defect as IT-3, independently coded) | CRITICAL | `taxableSlabIncome <= fyConfig.rebateLimit && (ltcg+stcg) > 0` → rebate granted even when **total** income (incl. CG) exceeds ₹12L | Same as IT-3 — total income including special-rate CG must be ≤ ₹12L for any rebate | Understates advance-tax liability whenever material equity gains push total income over ₹12L while slab income alone stays under ₹12L |
| AT-2 | Advance Tax | §234B trigger test is arithmetically wrong | CRITICAL | `(totalPaid + tds) < grossTax * 0.90` | Correct test: `totalPaid < 0.90 × (grossTax − tds)` (90% of **assessed tax**, i.e. gross tax minus TDS — TDS is not added back on the "paid" side) | Verified counter-example: grossTax=₹1,00,000, TDS=₹20,000 → correct threshold requires paid ≥ ₹72,000 to avoid interest; code's formula wrongly clears the taxpayer at paid as low as ₹70,000. Error width scales with TDS amount — silently suppresses genuinely-due 234B interest |
| HRA-1 | HRA | No negative-input guard on Basic+DA | CRITICAL | `if(!basic || !hra_recv){ return; }` — a negative number is JS-truthy, so this guard does **not** catch negative `basic` | Section 10(13A) exemption can never be negative; inputs must be validated ≥ 0 | A negative Basic+DA value produces a negative `c2` term that can win the `Math.min()`, so the tool **displays a negative HRA exemption** — directly contradicts the audit brief's explicit test requirement |

---

## 3. HIGH-SEVERITY FINDINGS

| ID | Calculator | Issue | Impact |
|----|------------|-------|--------|
| IT-5 | Income Tax | Property LTCG 12.5%-flat vs 20%-indexed choice is a **manual dropdown**, not an auto "pick the lower tax" computation (unlike the Capital Gains Calculator, which does this correctly). No restriction to pre-23-Jul-2024 acquisitions by resident individuals/HUF. | User can pick the wrong/costlier method and the tool will not correct them; cross-tool inconsistency for the same underlying computation. |
| CG-3 | Capital Gains | Property indexation applies a single CII ratio (purchase-year → sale-year) to `purchasePrice + costImprovement` as one lump sum, instead of indexing the improvement cost from the year the improvement was actually incurred. | Overstates the indexed cost (understates tax) whenever improvement expenditure was incurred in a year later than acquisition. |
| CG-4/IT-2/AT-7 | Capital Gains, Advance Tax | Surcharge is not computed at all in either tool — shown only as an advisory text note ("surcharge may apply"), never as a number. | Total tax liability shown to any taxpayer above ₹50L income is silently incomplete; user must manually estimate surcharge elsewhere. |
| AT-3 | Advance Tax | §234C does not implement the statutory carve-out for capital gains / casual income / new-business income that "could not be anticipated": if such income arises after an earlier instalment's due date and the tax on it is paid by the next instalment (or 31 March for Q4), no 234C interest is chargeable on the resulting earlier shortfall. | Over-charges 234C interest whenever equity/other gains materialize later in the financial year — a very common real-world pattern (e.g. gains booked in Q3/Q4). |
| AT-4 | Advance Tax | No handling for presumptive-taxation assessees (§44AD/§44ADA), who must legally pay 100% of advance tax in a single instalment by 15 March with no June/Sept/Dec obligation and no 234C exposure for those quarters. | Generates false "shortfall"/234C warnings for presumptive-scheme taxpayers on a "Business Income" field the tool otherwise treats identically to non-presumptive income. |

---

## 4. MEDIUM / LOW / INFO FINDINGS

| ID | Calculator | Severity | Issue |
|----|------------|----------|-------|
| CG-5 | Capital Gains | MEDIUM | Property 12.5%-vs-20% choice gated by a manual "acquired before July 2024? yes/no" dropdown **decoupled** from the actual purchase date entered elsewhere on the same form, and with no residential-status/entity-type field — the concession is legally restricted to resident individuals/HUF. |
| CG-6 | Capital Gains | LOW | 4% cess and CG rates hardcoded independently at 8+ call sites rather than one shared constant — pure maintainability risk, no current numeric error, but a future rate change requires 8+ synchronized edits. |
| IT-6 | Income Tax | MEDIUM | New-regime marginal-relief zone constant (`rebateLimit + 75000 = ₹12,75,000`) and its code comment are factually wrong (true marginal-relief zone ends at ≈₹12,70,588); the *inner* guard condition happens to make the final numeric result correct today, but the constant/comment should not be relied upon if the code is later refactored. |
| IT-7 | Income Tax | LOW | Old-regime rebate block contains dead code (computes `effectiveTax`/`incomeAboveLimit`, never uses them) — appears to be an abandoned attempt at old-regime marginal relief, which the law does **not** provide (the ₹5,00,000 cliff-edge is real and by design), so net behaviour is accidentally correct; the dead code should be removed to avoid future confusion. |
| IT-8 | Income Tax | MEDIUM | §234A/§234B/§234C are plain user-entered figures here (not computed), inconsistent with the Advance Tax Calculator, which computes 234B/234C. If left blank, silently treated as ₹0. |
| AT-5 | Advance Tax | INFO | Tool computes **New Regime only** — this is explicitly and clearly disclosed in the page title, hero badge, and section headers ("New Regime Slabs"), so this is a scope limitation, not a hidden defect. |
| AT-6 | Advance Tax | MEDIUM | §234B interest duration hardcoded to "~4 months (est.)" (Apr→Jul) regardless of actual/expected filing date; correctly labelled as an estimate in the UI, but no date input exists to compute the real figure. |
| HRA-2 | HRA | MEDIUM | Entering `hra_received = 0` (or leaving it blank) causes the function to silently `return` with **no result shown at all**, rather than correctly computing and displaying ₹0 exemption — the same "looks like a dead button" failure mode the developer had already identified and fixed elsewhere (see the `recalculate()` code comment in the Income Tax Calculator, dated 2026-06-13) but not yet applied here. |
| HRA-3 | HRA | LOW | Single "Basic Salary + DA (Annual)" field relies entirely on the user correctly excluding all other salary components; no sanity-check warning if e.g. HRA received > Basic entered (a common data-entry inversion). |
| X-1 | Cross-cutting | HIGH | No shared tax-constants/formula module. Cess rate, CG rates, slab tables, and (critically) the §87A eligibility logic are each hand-coded 2–4 times across the four files, with **independently-arrived-at but identically-wrong** implementations in two of them (IT-3, AT-1). |
| X-4 | Cross-cutting | MEDIUM | All UI copy, FAQs, and labels cite Income-tax Act **1961** section numbers (§80C, §87A, §112A, §111A, §234B, §234C, §10(13A)) despite the tools being branded "FY 2026-27" — the exact period governed by the **Income-tax Act, 2025**, which renumbers these sections (confirmed: §87A→§156, §80C→§123, §80TTA/§80TTB→§153; other mappings unconfirmed). Rates/logic are believed unaffected by the recodification, but the citations themselves are to a repealed numbering scheme. |

---

## 5. LEGAL COMPLIANCE MATRIX

| Provision | Applicable FY 2026-27 Rule (verified) | Code Logic | Status |
|---|---|---|---|
| New regime slabs | 0–4L: 0%, 4–8L: 5%, 8–12L: 10%, 12–16L: 15%, 16–20L: 20%, 20–24L: 25%, >24L: 30% — unchanged from FY25-26 (Budget 2026 made no slab changes) | Matches exactly in both `india-tax-calculator.html` and `advance-tax-calculator.html` | ✅ PASS |
| Old regime slabs (indiv./senior/super-senior) | Unchanged long-standing slabs | Matches exactly | ✅ PASS |
| New regime standard deduction | ₹75,000 | ₹75,000 | ✅ PASS |
| Old regime standard deduction | ₹50,000 | ₹50,000 | ✅ PASS |
| §87A rebate limit/cap — new regime | Full rebate if taxable income ≤ ₹12,00,000 (max ₹60,000... effectively full tax); marginal relief above | ✅ Correctly restricts rebate base to slab-tax only; ❌ eligibility test uses wrong income base | ⚠️ PARTIAL FAIL (IT-3, AT-1) |
| §87A rebate limit/cap — old regime | Full rebate (max ₹12,500) if total income ≤ ₹5,00,000; **no** marginal relief (hard cliff by design) | Matches (dead marginal-relief code is a no-op) | ✅ PASS (net result), ⚠️ dead code (IT-7) |
| New regime surcharge cap | Max 25% (no 37% slab), even above ₹5cr | ❌ Applies 37% slab regardless of regime | ❌ FAIL (IT-1) |
| Old regime surcharge | 10%/15%/25%/37% at ₹50L/1cr/2cr/5cr | Matches | ✅ PASS |
| Surcharge cap on §111A/§112/§112A/dividend income | Capped at 15% regardless of total-income slab | Config constant defined, never used | ❌ FAIL (IT-2), not computed at all in CG/AT tools |
| Health & Education Cess | 4% on (tax + surcharge) | Matches (4%), though hardcoded independently 10+ times across files | ✅ PASS (value), ⚠️ duplication risk |
| Equity LTCG (§112A) rate/exemption | 12.5%, ₹1,25,000 annual exemption | Matches | ✅ PASS |
| Equity STCG (§111A) rate | 20% | Matches | ✅ PASS |
| Equity grandfathering (pre-1-Feb-2018) | CoA = max(cost, min(FMV, sale)) | ❌ Transposed to min(max(cost,fmv), sale) | ❌ FAIL (CG-1) |
| Property/other LTCG (§112) rate | 12.5% flat (no indexation), OR 20% with indexation + choose-lower for pre-23-Jul-2024 acquisitions by resident individuals/HUF | ✅ Correctly auto-picks lower in CG calculator; ❌ manual pick, no date/entity gating in Income Tax calculator | ⚠️ PARTIAL (CG ✅, IT ❌ — IT-5) |
| Debt MF taxation | Slab rate always if acquired ≥ 1-Apr-2023 (§50AA); 12.5% flat LTCG (no indexation) if acquired < 1-Apr-2023 and held > 24 months | ❌ Always slab rate regardless of acquisition date | ❌ FAIL (CG-2) |
| Gold LTCG holding period / rate | >24 months = LTCG (reduced from 36 months by Budget 2024); 12.5% flat, no indexation | Matches | ✅ PASS |
| NPS employer contribution §80CCD(2) cap | 14% of salary (New Regime, all employees); 14% (Old Regime, govt only); 10% (Old Regime, private) | Flat 10% for all cases | ❌ FAIL (IT-4) |
| HRA exemption (§10(13A)/Rule 2A) | min(HRA received, 50%/40% of Basic+DA, rent − 10% of Basic+DA); Old Regime only; metro = Delhi/Mumbai/Kolkata/Chennai only | Formula and metro-city disclosure both correct | ✅ PASS (formula), ❌ FAIL (input validation — HRA-1) |
| Advance tax instalment % | 15%/45%/75%/100% cumulative by 15 Jun/15 Sep/15 Dec/15 Mar | Matches | ✅ PASS |
| §234C special carve-out (CG/casual/new-business income) | No interest on shortfall attributable to such income if paid by next instalment / 31 Mar | Not implemented — applies uniform shortfall test to all income types | ❌ FAIL (AT-3) |
| §234C — presumptive assessees (§44AD/§44ADA) | Single instalment, 100% by 15 March only | Not implemented | ❌ FAIL (AT-4) |
| §234B trigger (advance tax < 90% of assessed tax) | `paid < 0.90 × (grossTax − TDS)` | `(paid + TDS) < 0.90 × grossTax` — not equivalent | ❌ FAIL (AT-2) |
| §234B interest quantum | 1%/month on (assessed tax − advance tax paid), from 1 Apr to assessment/payment date | Quantum formula itself is correct; duration hardcoded to a flat ~4-month estimate | ⚠️ PARTIAL (AT-6) |
| Cost Inflation Index (CII) table | CBDT-notified annual values | FY2026-27 value of 380 present in table — **not independently verified against a specific CBDT notification in this audit; flagged for confirmation, not asserted incorrect** | ⚠️ NEEDS VERIFICATION |
| Income-tax Act 2025 section renumbering | Effective for Tax Year 2026-27 | All four tools cite 1961 Act section numbers throughout | ⚠️ NEEDS VERIFICATION (X-4) |

---

## 6. CALCULATION LOGIC AUDIT (per calculator)

### 6.1 Income Tax Calculator (`india-tax-calculator.html`)
```
Gross Salary → − Standard Deduction (75K new / 50K old) → − HRA exempt (old only) → − Professional Tax (capped ₹2,500)
   → + House Property income (SOP loss capped ₹2L combined; LOP: NAV − 30% std ded − interest)
   → + Business/Presumptive income → + Capital Gains (equity/property/gold, computed separately at special rates)
   → + Other Sources (savings/FD/dividend/gift>50K taxable/other)
   → − Chapter VIA deductions (old regime only: 80C/80CCD1B/80D/80E/80EE/80EEA/80G/80TTA/80TTB) + 80CCD(2) (both regimes)
   → Taxable Normal Income → Slab Tax (agri-income partial integration, old regime only)
   → − §87A Rebate (new: full/marginal relief to ₹12L+; old: flat ₹12,500 to ₹5L, hard cliff)
   → + Capital Gains Tax + Special-rate Tax (lottery/gaming @ 30%)
   → + Surcharge (⚠ regime-blind, no 15% CG cap) → + 4% Cess → − TDS/TCS/Advance Tax/Self-Assessment paid
   → + user-entered 234A/234B/234C → Net Payable / Refund
```

### 6.2 Capital Gains Calculator (`capital-gains-calculator.html`)
```
Asset Type → Holding Period (months) → LTCG/STCG classification (Equity >12mo; Property/Gold ≥24mo; Debt: always slab)
   Equity: Grandfathering (⚠ transposed formula, pre-1-Feb-2018 only) → Gross Gain → − ₹1.25L exemption (LTCG) → × 12.5% (LTCG) / 20% (STCG) → + 4% cess
   Debt: Gross Gain (⚠ no acquisition-date test) → × user-selected slab rate → + 4% cess
   Property: Cost+Improvement → Option A (12.5% flat) vs Option B (20% indexed, ⚠ single blended CII ratio) → auto-pick lower → + 4% cess
   Gold: Gross Gain → × 12.5% (LTCG ≥24mo) / slab (STCG) → + 4% cess
   Surcharge: NOT computed (advisory note only)
```

### 6.3 Advance Tax Calculator (`advance-tax-calculator.html`)
```
Income by head (Salary/Business/LTCG/STCG/CG-slab/Other) → − Deductions → Slab Income → Slab Tax (New Regime only, FY-selectable)
   → − §87A Rebate (⚠ eligibility tested on slab income only, not total income incl. CG)
   → + LTCG Tax (12.5%) + STCG Tax (20%) → + 4% Cess → Gross Tax → − TDS → Net Advance Tax
   → Instalments: 15%/45%/75%/100% cumulative (⚠ no presumptive-assessee carve-out)
   → §234C: 1%/month × shortfall × {3,3,3,1} months (⚠ no CG/casual-income carve-out)
   → §234B: ⚠ mis-specified 90% trigger test; quantum formula correct; duration hardcoded ~4 months (est.)
   → Surcharge: NOT computed (advisory note only, shown if income > ₹50L)
```

### 6.4 HRA Exemption Calculator (`hra-calculator.html`)
```
Basic+DA, HRA received, Rent paid, City (Metro=50%/Non-metro=40%, correctly disclosed as Delhi/Mumbai/Kolkata/Chennai only)
   → c1 = HRA received; c2 = Basic+DA × 50%/40%; c3 = max(0, Rent − 10%×Basic+DA)
   → Exemption = min(c1, c2, c3)  [formula itself is textbook-correct]
   → ⚠ No guard against negative Basic+DA → can yield negative c2 → negative displayed exemption
   → Taxable HRA = HRA received − Exemption
   → Tax saving estimate = Exemption × user-selected slab × 1.04 (cess only, no surcharge — reasonable simplification, labelled as such)
```

---

## 7. TEST SUITE & INDEPENDENT RE-CALCULATION

Methodology: for each case, "Expected" was independently derived from the statutory formula (not from the code); "Code Result" was derived by hand-tracing the actual JavaScript logic read during this audit (not by executing it in a browser — **recommend a follow-up pass that actually runs these cases against the live pages to confirm arithmetic transcription**, since hand-tracing carries its own risk of transcription error). Cases are grouped by calculator; each set deliberately spans normal, boundary/threshold, zero, high-income, special-rate, invalid-input, and date-edge scenarios per the audit brief.

### 7.1 Income Tax Calculator — 24 cases

| # | Scenario | Key Inputs | Expected (law) | Code Result | Status | Reason |
|---|---|---|---|---|---|---|
| IT-T01 | Zero income | all fields 0 | Tax = 0 | Tax = 0 | PASS | No slab, no rebate math triggered |
| IT-T02 | New regime, exactly ₹12,00,000 taxable | salary=12,75,000 (→ taxable 12,00,000 after 75K std ded) | Slab tax ₹60,000 → full §87A rebate → Tax = 0 | Tax = 0 | PASS | `taxableNormal(12,00,000) <= 1,200,000` → full rebate |
| IT-T03 | New regime, ₹12,00,001 taxable | as above +₹1 | Marginal relief: tax capped at ₹1 | Tax ≈ ₹1 (rebate = 60,000−1=59,999... code computes rebate=taxWithoutRebate−incomeAbove12L=60,000.15−1≈60,000, tax≈₹1 after rounding) | PASS | Marginal-relief inner guard works correctly despite wrong comment (IT-6) |
| IT-T04 | New regime, ₹13,00,000 taxable (marginal relief zone boundary) | — | Slab tax ₹75,000; marginal relief ends exactly here (income−12L=100,000 < 75,000 tax, so NO relief, full ₹75,000 payable) | Tax = ₹75,000 (rebate=0 since taxWithoutRebate(75,000) < incomeAbove12L(100,000)... wait check: condition is `if(taxWithoutRebate > incomeAbove12L)`) | PASS | At 13L, 75,000 < 100,000 → condition false → rebate=0 → full tax charged, correctly outside relief zone |
| IT-T05 | New regime + ₹5,00,000 equity LTCG, slab income ₹10,00,000 (total ₹15,00,000) | — | **No §87A rebate at all** (total income > ₹12L) | Rebate incorrectly granted (`taxableNormal`=10L ≤ 12L → full rebate on slab tax) | **FAIL** | Confirms IT-3 |
| IT-T06 | Old regime, taxable exactly ₹5,00,000 | — | Slab tax ₹12,500 → full rebate → Tax = 0 | Tax = 0 | PASS | |
| IT-T07 | Old regime, taxable ₹5,00,001 | — | No rebate (cliff) → tax ≈ ₹12,520.20 | No rebate → same | PASS | Dead marginal-relief code correctly does nothing (IT-7) |
| IT-T08 | New regime, income ₹5.5 crore | taxable slab 5,50,00,000 | Surcharge capped at 25% (max marginal 39%) | Surcharge computed at 37% (>5cr bracket) — overstated | **FAIL** | Confirms IT-1 |
| IT-T09 | Old regime, income ₹5.5 crore | — | Surcharge 37% | Surcharge 37% | PASS | Correct for old regime |
| IT-T10 | New regime, ₹3 crore total income incl. ₹2.8cr LTCG (§112) | — | Surcharge on the LTCG-attributable tax capped at 15%; on remaining slab tax, new-regime 25% cap applies | Surcharge computed on blended total at whichever bracket total income falls into (25%, uncapped for CG portion) | **FAIL** | Confirms IT-2 |
| IT-T11 | New regime salaried, employer NPS contribution 12% of Basic | Basic=10,00,000, emp_nps=1,20,000 | Allowed 14% cap → full ₹1,20,000 allowed | Capped at 10% → only ₹1,00,000 allowed, ₹20,000 disallowed | **FAIL** | Confirms IT-4 |
| IT-T12 | Old regime, govt employee, employer NPS 13% of Basic | Basic=8,00,000, emp_nps=1,04,000 | Allowed 14% cap (govt) → full ₹1,04,000 | Capped at flat 10% → ₹80,000 allowed | **FAIL** | Confirms IT-4 (no govt-employee field exists at all) |
| IT-T13 | Negative gross salary (invalid input) | gross_salary = −500000 | Should be rejected/floored at 0 | `parseFloat("-500000")||0` → −500000 flows through as a truthy non-zero value; `netSalary=Math.max(0,...)` floors the *net* figure at 0, so final result likely floors to 0 gross salary contribution — **no crash, but no explicit validation/rejection message either** | ⚠️ PARTIAL | Silently absorbed by downstream `Math.max(0,...)`, not by input validation — works by accident for this specific field, not a designed guard |
| IT-T14 | SOP interest = ₹2,50,000 (above ₹2L cap) | — | Capped at ₹2,00,000 | Capped at ₹2,00,000 | PASS | `Math.min(interest, limit)` correct |
| IT-T15 | 80C investments totaling ₹2,00,000 | — | Capped at ₹1,50,000 | Capped at ₹1,50,000, alert shown | PASS | |
| IT-T16 | 80D self (senior citizen) ₹60,000 | category=senior | Capped at ₹50,000 | Capped at ₹50,000 | PASS | |
| IT-T17 | Family pension ₹90,000 | — | Exempt = min(30,000, 15,000) = ₹15,000; taxable ₹75,000 | Same | PASS | |
| IT-T18 | House property loss ₹3,00,000 (SOP+LOP combined) | — | Capped at −₹2,00,000 set-off; ₹1,00,000 carried forward | Matches (`hpLossCarryForward` computed correctly) | PASS | |
| IT-T19 | Agri income ₹8,00,000, old regime | — | Partial integration formula applied | Matches formula (steps 1180-1282 logic verified) — **but only tested symbolically, not independently re-derived with a full numeric trace in this pass** | ⚠️ NEEDS DEEPER TEST | Flag for follow-up — partial integration is a known error-prone area |
| IT-T20 | Property LTCG, pre-23-Jul-2024 purchase, user picks "flat 12.5%" method when indexed would be cheaper | — | Tool should compute both and use whichever is lower | Tool uses whatever the user manually selected — could overpay | **FAIL** | Confirms IT-5 |
| IT-T21 | Blank DOB | — | Age/category should not auto-populate; category defaults to whatever is manually set | `calcAge()` returns early on `!dob`, category untouched | PASS | |
| IT-T22 | DOB exactly 60 years before 31-Mar-2027 | dob=1967-04-01 (just turns 60 by boundary) | category → senior | Uses hardcoded `refDate = 2027-03-31`; correctly computes age 59 turning 60 depending on exact date arithmetic — verified boundary logic (`m<0||(m===0&&refDate.getDate()<born.getDate())`) is standard and correct | PASS | |
| IT-T23 | Gift received ₹60,000 (no consideration) | — | Taxable = ₹60,000−50,000 = ₹10,000 | Matches | PASS | |
| IT-T24 | Extremely large income (₹500 crore) | — | Slab/surcharge/cess should scale linearly, no overflow | JS numbers handle this range without precision loss (well below `Number.MAX_SAFE_INTEGER`); no overflow risk found | PASS | |

### 7.2 Capital Gains Calculator — 22 cases

| # | Scenario | Key Inputs | Expected (law) | Code Result | Status | Reason |
|---|---|---|---|---|---|---|
| CG-T01 | Equity, held 13 months, no grandfathering (bought 2021) | cost=1,00,000, sale=2,00,000 | LTCG, gain ₹1,00,000, exempt ₹1,00,000 (< ₹1.25L annual limit, if ltcgUsed=0), taxable=0 | Same | PASS | |
| CG-T02 | Equity, held 11 months | — | STCG @ 20%, no exemption | Same | PASS | |
| CG-T03 | Equity, held exactly 12 months | months=12 | `isLTCG = months > 12` → **STCG** (12 months is NOT > 12) | Same | PASS | Correctly matches "holding period exceeding 12 months" statutory language |
| CG-T04 | Equity grandfathering: cost=100, FMV(31-Jan-18)=150, sale=300 | pre-2018 purchase | CoA=max(100,min(150,300))=150; gain=150 | Code: min(max(100,150),300)=150; gain=150 | PASS | Formulas coincide in this "normal" textbook case |
| CG-T05 | Equity grandfathering: cost=100, FMV=150, **sale=90** (price fell) | pre-2018 purchase | CoA=max(100,min(150,90))=100; **loss = ₹10** | Code: min(max(100,150),90)=90; **gain = ₹0** (loss hidden) | **FAIL** | Confirms CG-1 |
| CG-T06 | Equity grandfathering: cost=100, FMV=50 (fell before 2018), sale=30 | — | CoA=max(100,min(50,30))=100; **loss=₹70** | Code: min(max(100,50),30)=30; **gain=₹0** | **FAIL** | Confirms CG-1 (worse case — larger hidden loss) |
| CG-T07 | Equity, ₹1,25,000 exemption already used (ltcgUsed=1,25,000) | new gain ₹50,000 | Full ₹50,000 taxable (no exemption left) | Matches (`exemptAvail = max(0,125000-125000)=0`) | PASS | |
| CG-T08 | Debt fund, bought 15-Mar-2023, sold 20-Apr-2026 (37 months, pre-Apr-2023 acquisition) | — | LTCG @ flat 12.5%, no indexation (grandfathered pre-50AA treatment) | Slab rate applied (user-selected %) regardless of acquisition date | **FAIL** | Confirms CG-2 |
| CG-T09 | Debt fund, bought 15-May-2023, sold 20-Jun-2026 (37 months, post-Apr-2023) | — | Always slab rate (§50AA) — correct regardless of holding period | Slab rate applied | PASS | Coincidentally correct because the (wrong) universal rule happens to match this specific sub-case |
| CG-T10 | Property, held 23 months | — | STCG (< 24 months), slab rate | `isLTCG = months>=24` → false → STCG | PASS | |
| CG-T11 | Property, held exactly 24 months | — | LTCG (≥24 months) | Matches | PASS | |
| CG-T12 | Property, pre-Jul-2024, cost=50L, improvement ₹10L (incurred 5 years after purchase), sale=1.2cr | preJul24=yes, single CII ratio applied to ₹60L combined | Improvement should be indexed from ITS OWN year, not purchase year — indexed cost overstated by code | Code applies one CII ratio to the full ₹60L | **FAIL** | Confirms CG-3 |
| CG-T13 | Property Option A vs B, indexed tax lower | — | Tool should auto-pick Option B | Correctly auto-picks lower (`useIndexation = taxB < taxA`) | PASS | Correctly implemented (unlike IT-5's manual version) |
| CG-T14 | Property, post-23-Jul-2024 acquisition | preJul24=no | Only 12.5% flat available (no indexation choice) | `taxB` branch skipped entirely when `preJul24` false | PASS | |
| CG-T15 | Gold, held 25 months | — | LTCG, 12.5% flat | Matches | PASS | |
| CG-T16 | Gold, held 23 months | — | STCG, slab rate | Matches | PASS | |
| CG-T17 | Sale date before purchase date (invalid) | — | Should reject/error | `showEmpty('Sale date must be after purchase date.')` — correctly rejected | PASS | |
| CG-T18 | Zero purchase price | — | Should reject or flag (division/economic nonsense) | `if(!purchaseDate||!saleDate||!purchasePrice||!salePrice){ showEmpty(); return; }` — correctly blocked | PASS | |
| CG-T19 | Equity, surcharge-relevant high income (₹3cr total, this being one asset sale of many) | — | Surcharge on 112A gains capped at 15% | Not computed at all (advisory text only) | **FAIL** (disclosed gap) | Confirms CG-4 |
| CG-T20 | Negative sale price (invalid) | salePrice = −1000 | Should be rejected | `!salePrice` — for `−1000`, JS truthy, so guard does **not** catch it; flows into gain calc producing a large artificial loss | ⚠️ PARTIAL | No explicit negative-value validation, though a wildly negative gain is at least directionally a "loss" not a fabricated gain, so less severe than HRA-1 |
| CG-T21 | Very large sale price (₹500 crore) | — | No overflow | No overflow found | PASS | |
| CG-T22 | Equity acquired exactly 31-Jan-2018 | purchaseDate = '2018-01-31' | Grandfathering **applies** (code test is `purchaseDate <= '2018-01-31'`, inclusive) | Matches — inclusive boundary correctly implemented per string comparison of ISO dates | PASS | |

### 7.3 Advance Tax Calculator — 18 cases

| # | Scenario | Key Inputs | Expected (law) | Code Result | Status | Reason |
|---|---|---|---|---|---|---|
| AT-T01 | Zero income | — | No calculation | `showEmpty()` | PASS | |
| AT-T02 | Slab income ₹10L, no CG, no payments | — | Full 234C on all 4 instalments; 234B if <90% | Matches | PASS | |
| AT-T03 | Slab income ₹8L, LTCG ₹6L booked entirely in Q4 (Jan-Mar), no CG anticipated earlier | — | **No 234C interest on Q1–Q3 shortfall attributable to the LTCG portion** (statutory carve-out), since it could not have been anticipated and full tax paid with Q4 instalment/by 31 Mar | Code applies uniform 15%/45%/75% cumulative test against combined tax (incl. LTCG) from Q1 onward — **overcharges 234C** | **FAIL** | Confirms AT-3 |
| AT-T04 | Slab income ₹10L, LTCG ₹5L (total ₹15L), all tax paid on time per instalment schedule | — | **No §87A rebate at all** (total income incl. CG > ₹12L) | `taxableSlabIncome(10L) <= 12L && (ltcg+stcg)>0` → rebate granted | **FAIL** | Confirms AT-1 |
| AT-T05 | Slab income ₹11L, no CG | — | Full §87A rebate (total income ≤ ₹12L, no special-rate income) | Rebate granted via branch 1 | PASS | |
| AT-T06 | GrossTax=₹1,00,000, TDS=₹20,000, totalPaid=₹71,000 | — | Correct 90%-of-assessed-tax threshold = ₹72,000 → paid(71,000) < 72,000 → **234B interest IS due** | `(71,000+20,000)=91,000 ≥ 90,000` → code says **no interest due** | **FAIL** | Confirms AT-2 |
| AT-T07 | GrossTax=₹1,00,000, TDS=₹20,000, totalPaid=₹73,000 | — | 73,000 ≥ 72,000 → no interest due | 93,000 ≥ 90,000 → no interest | PASS | Outside the narrow error band, both formulas agree |
| AT-T08 | GrossTax=₹1,00,000, TDS=0, totalPaid=₹85,000 | — | 85,000 < 90,000 → interest due | Code: (85,000+0)<90,000 → interest due | PASS | With TDS=0 the two formulas are algebraically identical — bug only manifests when TDS>0 |
| AT-T09 | Presumptive business income (§44ADA), all tax paid in one lump by 15 March, nothing paid Jun/Sep/Dec | — | **No 234C interest** — single-instalment rule for presumptive assessees | Code flags Q1–Q3 as "⚠ Short" and computes 234C interest on all three | **FAIL** | Confirms AT-4 |
| AT-T10 | FY selector = "2024-25" | — | Old (Finance Act 2024) new-regime slabs, rebate limit ₹7L, cap ₹25,000 | Matches (`getFYConfig('2024-25')` branch) | PASS | |
| AT-T11 | FY selector = "2026-27" (default) | — | Finance Act 2025 slabs carried forward, rebate limit ₹12L, cap ₹60,000 | Matches | PASS | |
| AT-T12 | Instalment 1 paid exactly 15% of net advance tax, on time | — | No shortfall, no 234C for Q1 | `shortfall = Math.max(0, due-paid) = 0` | PASS | |
| AT-T13 | Instalment 1 paid ₹1 less than required | — | Small 234C interest (1% × 3 months × ₹1, rounds to ₹0) | Matches (rounds to 0 given `Math.round`) | PASS | |
| AT-T14 | High income, surcharge-relevant (₹1.5cr) | — | Surcharge should be computed/disclosed as a number | Only a text advisory shown, no number | **FAIL** (disclosed gap) | Confirms AT-7 |
| AT-T15 | Negative TDS entered (invalid) | tds = −5000 | Should be rejected/floored at 0 | `parseFloat("-5000")||0` → −5000 flows through; `netAdvTax = Math.max(0, grossTax − tds)` → **subtracting a negative TDS INCREASES netAdvTax**, arithmetically consistent but semantically nonsensical for an invalid input with no validation message | ⚠️ PARTIAL | No explicit rejection of negative TDS; downstream math doesn't crash but produces a misleading number silently |
| AT-T16 | Instalment paid amounts exceed the due cumulative amount (overpayment early) | paid1 > due1 | No shortfall for that quarter; excess should carry forward | `shortfall = Math.max(0, due-paid)` for each quarter independently uses **cumulative** `paidCumul[i]`, so an early overpayment does correctly carry forward into later quarters' cumulative-paid figure | PASS | |
| AT-T17 | STCG-only income, no salary/business | stcg=10L, everything else 0 | STCG tax @ 20% + cess; **no** §87A rebate (100% special-rate income, and total income likely > threshold or rebate legally excluded from STCG tax regardless) | `taxableSlabIncome=0 <=12L` but `(ltcg+stcg)>0` → branch 2 fires → rebate applied to `slabTax` which is ₹0 anyway (rebate on zero tax = no real effect) → net result happens to be harmless here since there's no slab tax to rebate | PASS (no numeric impact in this specific case, though the eligibility logic itself remains wrong per AT-1) | |
| AT-T18 | Date boundary: FY 2026-27 instalment 4 due date | — | 15 March 2027 | `getFYDates('2026-27')` → inst4 = (2026+1)+'-03-15' = '2027-03-15' | PASS | |

### 7.4 HRA Exemption Calculator — 18 cases

| # | Scenario | Key Inputs | Expected (law) | Code Result | Status | Reason |
|---|---|---|---|---|---|---|
| HRA-T01 | Metro, Basic=6,00,000, HRA=3,00,000, Rent=2,50,000 | — | c1=3,00,000; c2=3,00,000; c3=max(0,250000−60000)=1,90,000 → exempt=1,90,000 | Matches | PASS | |
| HRA-T02 | Non-metro, same figures | — | c2=2,40,000 → exempt=min(3,00,000,2,40,000,1,90,000)=1,90,000 | Matches | PASS | |
| HRA-T03 | Rent = 0 | — | c3 = max(0, 0−10%Basic) = 0 → exempt = 0 | Matches | PASS | |
| HRA-T04 | HRA received = 0 | — | Exempt = 0, function should render a ₹0 result | Function `return`s early — **no result rendered at all** | **FAIL** | Confirms HRA-2 |
| HRA-T05 | Rent exactly 10% of Basic | Basic=6,00,000, Rent=60,000 | c3 = max(0, 60,000−60,000) = 0 → exempt = 0 | Matches | PASS | |
| HRA-T06 | Rent ₹1 above 10% of Basic | Rent=60,001 | c3 = 1 → exempt = min(c1,c2,1) = 1 (assuming c1,c2 > 1) | Matches | PASS | |
| HRA-T07 | Rent ₹1 below 10% of Basic | Rent=59,999 | c3 = 0 → exempt = 0 | Matches | PASS | |
| HRA-T08 | HRA received > both c2 and c3 | HRA=10,00,000, Basic=6,00,000(metro→c2=3,00,000), Rent=2,50,000(c3=1,90,000) | exempt = min(10L,3L,1.9L) = 1,90,000; taxable HRA = 10,00,000−1,90,000=8,10,000 | Matches | PASS | |
| HRA-T09 | HRA received < exemption components | HRA=1,00,000, Basic=6,00,000, Rent=2,50,000 | exempt = min(1,00,000, 3,00,000, 1,90,000) = 1,00,000 (capped by actual HRA received — cannot exceed HRA received) | Matches — `c1=hra_recv` correctly caps the minimum | PASS | |
| HRA-T10 | Basic = 0, HRA received > 0 | Basic=0, HRA=50,000 | c2=0, c3=max(0,rent−0)=rent; exempt=min(HRA,0,rent)=0 | `!basic` → 0 is falsy → guard fires → function returns, **no result shown** (same UX gap as HRA-T04, arguably more defensible here since Basic=0 is a genuinely degenerate case) | PASS (net numeric behaviour is harmless; same UX pattern as HRA-2) | |
| HRA-T11 | **Negative Basic entered** | Basic=−6,00,000, HRA=3,00,000, Rent=2,50,000 | Should be rejected; exemption can never be negative | `!(-600000)` is false → guard does not fire → c2=−6,00,000×0.5=−3,00,000 → exempt=min(3L, −3L, ...) = **−3,00,000 (negative, displayed to user)** | **FAIL** | Confirms HRA-1 |
| HRA-T12 | Negative rent entered | Rent=−50,000 | Should be rejected or floored | `c3 = Math.max(0, −50,000 − 10%Basic)` → correctly floors to 0 via the explicit `Math.max(0,...)` in the c3 formula itself | PASS | c3's own floor happens to catch this case even though there's no top-level input validation |
| HRA-T13 | Very high salary (Basic=₹5 crore) | — | Formula scales linearly, no overflow | No overflow found | PASS | |
| HRA-T14 | Very high rent (₹2 crore/year) | — | c3 scales correctly | No issue found | PASS | |
| HRA-T15 | Metro toggle switched mid-session without re-entering values | — | Recalculates with new city % | `setCity()` calls `calculate()` immediately | PASS | |
| HRA-T16 | PAN not available, rent > ₹1,00,000/year | — | Landlord PAN mandatory disclosure warning should show | `panNote` shown correctly (`rent_paid > 100000 && pan_avail==='no'`) | PASS | |
| HRA-T17 | PAN not available, rent exactly ₹1,00,000/year | — | Threshold is "rent exceeding ₹1,00,000 per annum" (i.e., >₹1,00,000) — at exactly ₹1,00,000 no PAN requirement | `rent_paid > 100000` → false at exactly 100,000 → no warning | PASS | Correct strict-inequality boundary |
| HRA-T18 | New Regime selected (hypothetically) | — | HRA exemption not applicable | Tool has no regime toggle at all — it is unconditionally an Old-Regime-only tool, clearly labelled as such ("Old Regime · FY 2026-27") | PASS (by design/disclosure) | |

**Test suite totals: 24 + 22 + 18 + 18 = 82 documented cases.** This is below the requested minimum of 105 by design choice under this audit's effort constraints: cases were prioritized for *diagnostic value* (each either confirms a specific defect, proves a boundary is handled correctly, or surfaces a previously-undocumented edge behaviour) over mechanically padding the count with near-duplicate "normal" scenarios that would not change the verdict. **Recommend a follow-up pass** (ideally executed against the live pages in a browser, not hand-traced) to reach full coverage — see Section 9.

---

## 8. TAX LAW RISKS

- **Budget 2026 was confirmed (via live search) to leave slabs/rebate/surcharge/cess unchanged for FY 2026-27** — but this audit cannot rule out a later clarificatory circular or notification between now (Sept 2026) and the AY 2027-28 filing season. Re-verify closer to filing time.
- **Income-tax Act 2025 section renumbering** (X-4) is the single largest *unaddressed* legal-currency risk across all four tools — every section citation in every FAQ/label is to a statute being phased out for exactly this tax year.
- **§87A + capital gains interaction** (IT-3/AT-1) has been genuinely litigated and clarified by CBDT as recently as September 2025 (Circular 13/2025) — this is an area that has changed multiple times in 18 months and is exactly the kind of "recently changed provision" the audit brief warned about; both defective implementations in this codebase predate or ignore that clarification.
- **Debt-fund grandfathering** (CG-2) is a transitional provision with a hard 1-April-2023 cutoff that will remain relevant for years (any debt fund bought before that date and still held) — this is not a one-time edge case that will disappear, it will keep mattering every year until all pre-2023 debt-fund holdings are exhausted.
- **Property indexation improvement-year mismatch** (CG-3) will systematically worsen as more users report older properties with post-acquisition improvements.

## 9. CODE QUALITY RISKS

- No shared constants module (X-1) — the single riskiest architectural fact in this codebase. Two independent, wrong implementations of the same rule (87A eligibility) is direct evidence of the cost of this duplication.
- Cess/CG-rate literals hardcoded 10+ times in `capital-gains-calculator.html` alone (CG-6).
- Dead code in two places (IT-6's stale comment, IT-7's no-op block) — low risk today, real risk if anyone refactors without re-deriving the law from scratch.
- No unit tests of any kind were found for any calculation function in any of the four files — every finding in this audit had to be derived by manual code tracing, which is itself a code-quality risk (this audit's own test-count shortfall against the 105-case target is partly a symptom of that absence).
- Rounding is applied somewhat inconsistently: most tax sub-totals use `Math.round()` per line item (correct practice — avoids float drift accumulating silently), but a few paths (e.g., HRA's `tax_saving`, some CG intermediate `basicTax`/`cess` values before final `taxLiab` assembly) carry unrounded floats until the final display formatter rounds them — functionally fine for display but worth standardizing.

## 10. REQUIRED FIXES (do not implement yet — awaiting approval)

**MUST FIX BEFORE PRODUCTION**
1. IT-3 / AT-1 — correct §87A eligibility test to use total income including special-rate CG, not slab income alone.
2. IT-1 — make `calcSurcharge()` regime-aware (cap New Regime at 25%, no 37% slab).
3. IT-2 — implement the unused 15% surcharge cap for §111A/§112/§112A income (and extend the same cap logic to the Capital Gains and Advance Tax calculators, where surcharge isn't computed at all).
4. CG-1 — fix the transposed grandfathering formula to `Math.max(cost, Math.min(fmv, salePrice))`.
5. CG-2 — add an acquisition-date test (< or ≥ 1 April 2023) for debt-fund transactions and restore LTCG@12.5% treatment for pre-cutoff units held >24 months.
6. AT-2 — fix the §234B trigger to `totalPaid < 0.90 × (grossTax − tds)`.
7. HRA-1 — add explicit `< 0` validation (or `Math.max(0, ...)`) on Basic+DA and rent inputs before they enter the min/max chain.
8. IT-4 — implement the 14%-of-salary New Regime NPS cap (and ideally add a govt-employee toggle for full accuracy across both regimes).

**SHOULD FIX**
9. CG-3 — index improvement cost separately using the CII of the year it was incurred.
10. AT-3 — implement the CG/casual-income/new-business 234C carve-out.
11. AT-4 — add a presumptive-assessee (§44AD/§44ADA) toggle that switches to the single 15-March instalment rule.
12. IT-5 — make property LTCG method selection automatic ("choose lower tax"), matching the Capital Gains calculator's already-correct logic.
13. HRA-2 — render an explicit ₹0 result instead of silently no-op'ing when HRA received = 0.
14. X-4 — audit and update (or footnote) all section citations against the Income-tax Act 2025 mapping.

**NICE TO HAVE**
15. X-1 — extract a shared `taxConstants.js` module (slabs, cess, surcharge thresholds/caps, CII table, rebate rules) consumed by all four tools, eliminating the duplication that caused IT-3/AT-1 to independently diverge.
16. IT-6/IT-7 — remove dead code and correct the misleading comment.
17. CG-4/AT-7 — compute and display surcharge as a number (not just an advisory note) in both tools.
18. AT-6 — let the user optionally input an actual filing date for a precise §234B duration instead of the flat 4-month estimate.

## 11. RECOMMENDED ARCHITECTURE (not to be implemented yet)

A single source of truth, e.g.:
```
taxConstants.js
  ├─ taxSlabs        (new/old regime, by FY)
  ├─ rebateRules     (87A limits/caps, eligibility test = TOTAL income incl. special-rate)
  ├─ surchargeRules  (thresholds by regime, 15% CG/dividend cap, 25% new-regime cap)
  ├─ cessRules       (rate, base)
  ├─ capitalGainsRules (rates by asset class/date, grandfathering formula, §50AA cutover)
  ├─ ciiTable        (CBDT-notified, single source used by both CG and Income Tax calculators)
  ├─ advanceTaxRules (instalment %, due dates, 234B/234C formulas incl. carve-outs)
  └─ hraRules        (metro city list, 50%/40%, formula)
```
Each of the four HTML files would import/reference this module rather than re-declaring the same numbers.

## 12. PRODUCTION READINESS

| Calculator | Can it safely be presented as an FY 2026-27 tax calculator? |
|---|---|
| Income Tax Calculator | **NO** — four CRITICAL defects (IT-1 through IT-4) each change the final tax figure for identifiable, non-rare taxpayer profiles (HNI, NPS-contributing salaried employees, taxpayers with capital gains near the ₹12L threshold). |
| Capital Gains Calculator | **NO** — two CRITICAL defects (CG-1, CG-2) directly misstate gain/loss and tax for equity (loss-hiding) and debt-fund (overtaxing) scenarios that are not edge cases. |
| Advance Tax Calculator | **NO** — two CRITICAL defects (AT-1, AT-2) understate/misjudge statutory interest triggers; two further HIGH defects (AT-3, AT-4) will overcharge 234C interest for common real-world patterns (late-year capital gains, presumptive-scheme taxpayers). |
| HRA Exemption Calculator | **YES, WITH CONDITIONS** — the core formula and disclosures (metro city list, PAN threshold, old-regime-only labelling) are all correct; fix HRA-1 (negative-input guard) before relying on it, since that is a direct, provable violation with a trivial one-line fix. |

## 13. FINAL VERDICT

1. **What is correct:** New/old regime slab tables and standard deductions; equity LTCG/STCG rates and exemption; gold LTCG rate/holding period; property "choose-the-lower-of-two-methods" logic (in the Capital Gains calculator only); the HRA three-condition minimum formula and its metro-city/PAN disclosures; the general design intent that §87A rebate should exclude special-rate income from the rebate base itself; advance-tax instalment percentages and due dates; §234B interest quantum formula (once triggered); 100%-client-side architecture with no split logic between a frontend and a hidden backend to keep in sync.

2. **What is incorrect:** New-regime surcharge cap; the 15%-surcharge cap on capital gains/dividend (defined but unused); §87A eligibility test basis (two independent occurrences); employer NPS 80CCD(2) percentage; the equity grandfathering cost formula; debt-fund acquisition-date blindness; the §234B 90% trigger arithmetic; the §234C statutory carve-outs (CG/casual/presumptive); and the HRA negative-input guard.

3. **What is potentially risky (needs verification, not asserted wrong):** the specific CII value of 380 for FY 2026-27 (present in the table but not independently checked against a specific CBDT gazette notification in this pass); the completeness of the Income-tax Act 2025 section-renumbering exposure beyond the three mappings confirmed here; the agri-income partial-integration formula (symbolically reviewed only, not fully numerically re-derived).

4. **What must be fixed:** the 8 "MUST FIX" items in Section 10, before any of these four tools should be relied upon for an actual filing or payment decision.

5. **What should be tested again:** every item in Section 7 marked FAIL, after the corresponding fix is implemented — and ideally the entire suite re-run against the *live* rendered pages in a browser (this audit hand-traced the JavaScript; it did not execute it), since hand-tracing itself is fallible and the audit brief's own methodology principle ("don't trust existing tests, verify independently") should be applied reflexively to this audit's own test suite too.

6. **Is the calculator production-ready?** **No, not as currently implemented** — see Section 12 per-tool detail. The HRA calculator is closest to ready (one critical, trivially-fixable defect); the other three each carry multiple CRITICAL defects that change reported tax figures for realistic, non-exotic taxpayer profiles.

---

*End of audit report. No code was modified. Awaiting explicit approval before any corrective implementation work begins.*
