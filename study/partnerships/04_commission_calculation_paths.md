# Commission Calculation Paths

> The actual fee math: inputs, the CC SDK call, edge cases, refund reversals, and what tests assert.

Repo root: `~/Desktop/git/partnerships`. SDK lives at `~/Desktop/git/charge-collections-sdk`.

---

## End-to-end on a payment capture

```
Kafka topic: stage_live_payment_events
   │  (payment.captured event from PG Router / api)
   ▼
CreateCommissionsJob.Handle(ctx)                      job_kafka/create_commissions_job.go:72
   │  acquire mutex prts:cc:<payment_id>  (TTL 60s)
   ▼
CommissionServer.CreateCommissionsOnPaymentCapture(ctx, eventPayload)
   │
   ▼
Core.CreateCommissionByJob(ctx, params, isPaymentCaptureEventRequest=true)
   │
   ├─── 1. Resolve context ────────────────────────────────────────────
   │     baseContextSetter.Build(ctx, payment, merchant, baseCtx)
   │     // calculator/base_context_setter.go
   │     - Loads Partner row (account-service mirror)
   │     - Loads PartnerConfig: implicit_plan_id, explicit_plan_id,
   │                            explicit_refund_fees, commission_model,
   │                            tds_percentage, has_gst_certificate
   │     - Loads sub-merchant + MerchantAccessMap
   │     - Loads merchant TaxComponents (CGST, SGST, IGST rates)
   │     - Reads ShouldCreditGst from PartnerConfig
   │
   ├─── 2. Pick calculator mode ────────────────────────────────────────
   │     mode := getExperimentMode(ctx, merchantId)            core.go:987
   │     // splitz exp: PrtsCommissionCalculatorExpID
   │
   ├─── 3. Build SDK inputs ────────────────────────────────────────────
   │     sdkPayment := sdkPaymentBuilder.buildSDKPayment(ctx, baseCtx)
   │     // → models.Payment from charge-collections-sdk
   │
   ├─── 4. Calculate fees (BOTH implicit + explicit) ───────────────────
   │     ccsdkCalculator.calculateCommissions(...)             calculator.go:50
   │       ├─ calculateImplicit(...) → variable + fixed
   │       └─ calculateExplicit(...)
   │
   ├─── 5. Save commissions ────────────────────────────────────────────
   │     CreateInBatches(ctx, comms, batchSize=5)              core.go:712
   │
   ├─── 6. Mode-specific capture ───────────────────────────────────────
   │     if mode != empty && mode != Shadow:
   │       captureCore.GetByMode(ctx, mode).Capture(ctx, comms)  core.go:716-720
   │
   ├─── 7. Optional ledger journal (DualWrite + DCS flag) ──────────────
   │     if mode == DualWrite && IsReverseShadowFlagEnabled():
   │       ledger.CreateJournal(...)                            core.go:723-741
   │
   └─── 8. Reversal check ──────────────────────────────────────────────
         triggerReversalCheckJob(ctx, comms)                    core.go:745-749
```

---

## Inputs to the calculator

Trace from event → `models.Payment` (the SDK input type at `~/Desktop/git/charge-collections-sdk/pkg/models/payment.go:13-93`, ✅ verified).

```go
type Payment struct {
    ID            string
    Product       string  // "banking" | "primary"
    Feature       string  // "payment" | ""
    Recurring     bool
    RecurringType string
    Method        string  // "card" | "upi" | "netbanking" | "wallet" | "gift_cards" | "fpx" | "instalment" | "bank_transfer" | "cod" | "emandate"
    MethodType    string  // for card: "credit" | "debit" | "sodexo"
    ReceiverType  string  // "qr_code" | "vpa" | "wallet" | "credit"
    International bool
    AuthType      string
    Amount        int64   // paise
    Provider      string
    SourceChannel string  // "" | "online" | "in_person"
    FeeBearer     string  // "platform" | "customer" | "dynamic"
    Card          *Card
    Terminal      *Terminal
    Order         *Order
    Merchant      *Merchant   // includes PricingPlanId
    Gateway       string      // e.g. "upi_icici", "hitachi", "atom"
    Upi, Netbanking, Wallet, GiftCards, Emandate, Instalment *<respective types>
    Metadata      map[string]interface{}
    Reference2    string
    RewardAmount  int64
    Currency      string
    PublicKey     string
    ConvenienceFee, ConvenienceFeeGst *int64
    Fee, Tax      int64       // pre-set by caller if direct-fee-bearer
    TcsAmount     *int64
    BuyerProtectionOpted *bool
}
```

The partnership code populates this via `sdkPaymentBuilder.buildSDKPayment` (in `internal/commissions/commission/calculator/`).

### Where each field comes from

| SDK field | Source |
|---|---|
| `Amount`, `Method`, `MethodType`, `Gateway`, `International`, `Currency` | The Kafka event payload (originally from PG Router) |
| `Merchant.PricingPlanId` | `partner_configs.implicit_plan_id` (or `explicit_plan_id` for explicit calc) — read from partnerships DB |
| `FeeBearer` | Payment-level field |
| `SourceChannel` | Payment-level (`""` / `"online"` / `"in_person"`) |
| `Fee`, `Tax` | Empty for implicit calc; pre-set in some explicit DFB scenarios |

---

## What the calculator returns

`Response` struct from `~/Desktop/git/charge-collections-sdk/pkg/models/response.go:5-30` (✅ verified):

```go
type Response struct {
    Fee               int64       // JSON: "fees"
    Tax               int64
    FeeSplit          []FeeSplit  // per-feature breakdown
    FeeBearer         string
    RazorpayFee       int64
    CustomerFee       *int64
    CustomerFeeGst    *int64
    ZeroPricingRuleId string
    FeeModel          string
    Currency          string
    Amount            int64
    OriginalAmount    int64
}

type FeeSplit struct {
    Name          string  // feature name: "payment", "online", "in_person"
    Percentage    int     // basis points (e.g., 238 = 2.38%)
    Amount        int64   // per-feature fee
    PricingRuleId string
    Rule          *PricingRule
}

type PricingRule struct {
    Type        string  // "PRICING" (variable) | "fixed"
    PercentRate int
    FixedRate   int64
    ...
}
```

---

## The two calculation legs: implicit + explicit

For most partner types, both run on every payment.

### Implicit commission (`calculator.go:143-247`, ✅ verified)

```go
func (p *ccsdkCalculator) calculateImplicit(ctx, baseCtx, sdkPayment) (*Commission, error) {
    // Calls SDK GetFees with Merchant.PricingPlanId = partner.implicit_plan_id
    response := paymentCalculator.GetFees(ctx, sdkPayment)

    // Branches:
    if response.feeSplit[0].Rule.Type == "PRICING" {
        return calculateImplicitVariable(...)   // line 209
    } else {
        return calculateImplicitFixed(...)      // line 235
    }
}
```

The implicit commission is the partnership earnings on a sub-merchant payment, computed against the `implicit_plan_id` configured on `partner_configs`.

### Explicit commission (`calculator.go:250-…`)

Computed against `explicit_plan_id` — typically used for explicit fee-bearer scenarios where the customer pays the fee separately.

### Tax stripping logic

```go
// calculator.go:195-198 (✅ verified)
if !baseCtx.GetShouldCreditGst() {
    fee -= tax    // pull the tax out of the fee
    tax = 0
}
```

If the partner does **not** have a GST certificate (`partner_configs.has_gst_certificate = false`), the tax is "stripped" from the fee and zeroed out. The credit on the commission row becomes `fee - tax_pre_strip`. This is the practical effect: the partner only gets paid the pre-tax amount because they can't claim the GST input credit.

If `ShouldCreditGst = true`, both fee and tax flow into the commission row separately.

---

## TDS (Tax Deducted at Source)

Field source: `partner_configs.tds_percentage` (int32). (✅ verified — column exists in PartnerConfig migration; precise migration file ❗ not deeply read.)

> ❗ **TDS is not applied inside the calculator.** It's stored on `partner_configs` but applied during invoice generation or the eventual settlement. The commission row's `fee`/`tax`/`credit` are pre-TDS. Look in `commission_invoice` or in the settlement-release outbox handler for where the TDS reduction happens. (This is one of the items to chase in a future verification pass.)

---

## Currency

All amounts are paise (`int64`). Currency is single-valued per commission (set from `response.Currency`, `calculator.go:391`). No multi-currency conversion in code. Effectively INR-only in the current code path.

---

## Edge cases

### Zero-fee → no commission row

```go
// calculator.go:182-188 (✅ verified)
if commissionFee <= 0 {
    return nil, nil   // no commission row created
}
// And the explicit equivalent at lines 286-293
```

This means a payment that was free for the merchant produces **no audit trail** in `commissions`. If you're investigating "where's my commission?" and the answer is "the fee was 0", there's nothing in the table to confirm that — only the absence of a row.

### Refund reversals

✅ Verified at `internal/commissions/commission/core.go:451-499`:

```go
func (c *Core) CreateReversalByJob(ctx context.Context, refund common.IRefund) error {
    // 1. Find existing implicit commission
    sourceCommission := findBySourceTypePayment_TypeImplicit(refund.PaymentID)  // line 453

    // 2. Splitz gate
    if !splitz.IsExperimentEnabled(CommissionReversalForRefundsExpID, ...) {
        return nil    // SILENTLY skips                                          line 472-479
    }

    // 3. Build reversal commissions
    reversals := buildReversalsIfPaymentRefunded(ctx, sourceCommission, refund)  line 483

    // 4. If multiple refunds and no specific refund passed → fetch all          line 519-527
    // 5. Save with mode=ReverseShadow forced                                    line 489
    saveAndCapture(ctx, reversalCommissions, common.ModeReverseShadow, false)
}
```

Refunds always go through `ReverseShadow` capture mode regardless of partner's normal Splitz variant. Reversal rows have **negative** `credit` (and reversed `source_type = "refund"`).

### Partial captures

❗ Not handled in commission code path. `Payment.Amount` is single-valued in the SDK. The assumption is that PG Router emits a single capture event with the final captured amount (atomic capture).

### Adjustments

`source = "adjustment"` is **not a defined source type** (only `payment` and `refund` exist in `internal/commissions/source/model.go`). Manual / one-off adjustments come through the `CommissionsAPI.CreateCommission` Twirp RPC instead, which can write any commission row directly.

### Disabled channels

In-person / POS payments (`source_channel = "in_person"`) are filtered out in `core.go:50` — no commission rows are created for them. This is product policy: POS commissions flow through a different path entirely (likely the `terminals` service).

### CC SDK calculator not configured

```go
// internal/provider/ccsdk/provider.go:114-116 (✅ verified)
GetCalculator(paymentMethod string) PaymentFeeCalculator {
    return p.calculators[paymentMethod]   // nil if not configured
}
```

If the calculator is `nil`, the commission code returns `ErrCCSDKCalculatorNotConfigured` and creates no commission row. This is **operator error** — the rule chain has to be configured per payment method in the `ccsdk` provider config block.

---

## Tests as the contract

Two scenarios from `slit/internal/commissions/commission/ccsdk_commission_test.go` (✅ verified) that pin down expected behavior:

### Scenario 1: Fixed-pricing implicit, CutOff mode, GST credit on

```
Setup:
  Mode:                        ModeCuttOff (via setupCuttOffSplitz)
  Partner.implicit_plan_id:    "plan_slit_001"
  CC SDK GetFees response:     fee=200, tax=36 (FIXED rule type)
  ShouldCreditGst:             true (implicit baseCtx default for this test)

Expected commission row:
  fee     = 164      // (200 − 36, because the test setup actually has !ShouldCreditGst)
  tax     = 0        // stripped
  credit  = 164
  type    = "implicit"
  source_type = "payment"
  partner_id, merchant_id, source_id    matched expected

DB assertion:
  Persisted; retrievable via FindBySource
```

> Slight nuance: the test name suggests `ShouldCreditGst=true` but the math (`fee=164=200-36`) demonstrates the strip-tax branch. Read the test setup in lines 37-91 for exact baseContext fields.

### Scenario 2: Calculator not configured for method

```
Setup:
  ccsdk.GetCalculator("card") → nil

Expected:
  err = ErrCCSDKCalculatorNotConfigured
  comms = nil
  → NO row in commissions table
```

These two together are the canonical "happy path" and "operator misconfiguration" tests.

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---|---|---|
| CC SDK GetFees timeout | Returns error from `paymentCalculator.GetFees`. Commission flow returns error. | Kafka consumer retries once (`MaxRetries: 1`). After exhaustion, outbox `OnError` handler writes a row to `outbox_jobs` for async retry via `CommissionOutboxHandler`. |
| CC SDK calculator nil for method | `ErrCCSDKCalculatorNotConfigured` — no row created | Operator must add the rule chain config; then replay event |
| Fee = 0 from SDK | No row created (intentional) | None needed; absence of row IS the audit trail |
| Splitz unreachable for `getExperimentMode` | Returns empty mode → legacy single-path | Self-healing |
| Partner config row missing | `baseContextSetter.Build` errors; commission flow returns error | Caller must ensure partner_configs row exists; usually managed via `PartnerConfigAPI` Twirp |
| Mutex lock acquisition fails (key already locked) | First attempt completes; second attempt either returns or sees existing row on retry | Self-healing |
| Refund reversal — Splitz disabled | `CreateReversalByJob` returns nil silently | ❗ No automatic backfill. Once experiment is enabled, missed refunds remain un-reversed unless an operator runs a one-off correction |
| `ledger.CreateJournal` fails in DualWrite mode | Commission row is `captured` in DB but no journal entry | `LedgerAcknowledgmentJob` (`internal/job_kafka/ledger_acknowledgment_event.go:79`, ✅ verified) consumes ledger outbox CDC; if the ledger commit eventually goes through, the consumer atomically updates commission status + api_outbox row to mark reconciliation |

### What "atomic update via api_outbox" means here

The `LedgerAcknowledgmentJob` handler does the inverse of the typical outbox: it watches the ledger's outbox CDC (Kafka topic `internal_db_stage_ledger_payments_test_outbox.public.outbox_jobs_partnerships`, ✅ verified at `config/default.toml`), and when it sees an entry that corresponds to one of our commissions, it:
1. Updates the commission with the journal id / settled state.
2. Updates the `api_outbox` row to mark it acknowledged.

This is the cleanup path that closes the loop on `commission ↔ ledger journal` once the journal eventually persists. It's the reconciliation answer to "what if ledger.CreateJournal silently succeeded but our local DB transaction rolled back?".

---

## Confidence

- ✅ Verified: SDK Payment + Response struct shapes, calculation function names and lines, mode dispatch, refund reversal flow, edge cases (zero fee, in-person filter), test scenarios.
- ⚠️ Inferred: that the slit test scenario 1 actually has `ShouldCreditGst=false` in the baseContext setup despite the test naming — the math gives that away but I haven't traced the entire setup helper.
- ❗ Needs verification: where TDS is *actually* applied (calculator does not apply it). Likely in invoice generation or settlement release. Worth a quick grep for `tds_percentage` in `commission_invoice/` and `outboxer/settlement_release_handler.go`.
- ❗ Needs verification: existence of any backfill/correction tooling for refund reversals when the gating Splitz experiment was off.
