# UPI Payment — End-to-End Flow

> One flow, traced across **api → pg-router → gateway → ledger → settlements**, code-grounded.

Other payment methods are summarized briefly at the end ("Variations") but **not** traced in detail — that's the deliberate scope choice for this Tier-1 doc.

Repos involved (under `~/Desktop/git/`):
- `api` — PHP 8.2 / Laravel 11 monolith
- `pg-router` — Go 1.24.7
- `ledger` — Go 1.23
- `settlements` — Go 1.24

All file paths are relative to those repo roots.

---

## At a glance

```mermaid
sequenceDiagram
    autonumber
    participant Cust as Customer / Checkout SDK
    participant Edge as edge / Kong
    participant API as api (Laravel)
    participant PGR as pg-router
    participant Opt as Optimizer
    participant GW as UPI gateway<br/>(ICICI / Yes / Mindgate / etc.)
    participant NPCI as NPCI / PSP
    participant Cap as api capture
    participant Ldg as ledger
    participant Stl as settlements

    Cust->>Edge: POST /v1/payments/create/ajax<br/>(method=upi, amount, order_id, vpa)
    Edge->>API: route by Kong
    API->>API: PaymentCreateController.postAJAX()<br/>app/Http/Controllers/PaymentCreateController.php:49
    API->>API: Service.process() →<br/>Processor.process()
    API->>API: canRouteThroughUpsRearchFlow(input, isUpiDfb)<br/>Processor.php:6204
    Note over API: UPI eligibility:<br/>method=upi, non-recurring, non-TPV
    API->>PGR: PGRouter.validateAndCreatePaymentUpi(input)<br/>POST /v1/payments/create/upi<br/>app/Services/PGRouter.php:240, 90s timeout

    PGR->>PGR: routing/server.go:266<br/>PaymentCreateController
    PGR->>PGR: setMethod="upi"<br/>routing/controller.go:129
    PGR->>PGR: GetOrderV1AndOrderMapFromRequest()<br/>core/order_accessor.go:108
    PGR->>Opt: selectProvider(ctx, finalRequest)<br/>core/optimizer.go:216
    Opt-->>PGR: ProviderResponse{gateway, provider_id}
    PGR->>PGR: persist outbox row (outbox_jobs)<br/>pgsdk/outbox/outbox.go:23
    PGR-->>API: payment created (gateway selected)

    API->>GW: build UPI request (signed)<br/>app/Gateway/Upi/<psp>/...
    GW->>NPCI: collect / intent
    NPCI-->>Cust: VPA approval prompt / deep link
    Cust->>NPCI: approves
    NPCI->>GW: payment confirmation
    GW->>API: server callback<br/>POST /v1/payments/{id}/callback/{hash}<br/>(or /gateway/upi_<psp>/callback)

    API->>Cap: GatewayController.processServerCallback()<br/>GatewayController.php:117
    Cap->>Cap: Capture.coreCapture(payment, input)<br/>Capture.php:75
    Cap->>Cap: updatePaymentCaptured()<br/>set status=CAPTURED, captured_at, refund_at=null<br/>Capture.php:1842-1850
    Cap->>Cap: createTransactionFromCapturedPayment()<br/>Capture.php:1862
    Cap->>Cap: dispatch event api.payment.captured<br/>Capture.php:1838
    Cap->>Cap: dispatch event api.order.paid<br/>Capture.php:1735

    Cap->>Ldg: LedgerEntryJob.dispatchNow()<br/>topic create-ledger-journal-event<br/>Capture.php:516
    Ldg->>Ldg: JournalAPI.Create<br/>internal/journal/server.go:38<br/>mutex on (transactor_event, transactor_id)
    Ldg->>Ldg: Core.Create()<br/>internal/journal/core.go:205-349
    Ldg->>Ldg: write journal + ledger_entries + outbox<br/>(single DB tx)
    Ldg->>Ldg: SendToOutbox(broker=kafka)<br/>pkg/outbox/core.go:57-79
    Ldg-->>Cap: journal created

    Cap->>Stl: dispatchForSettlementBucketing(txn)<br/>Capture.php:1551
    Note over Stl: settlements consumes payment events<br/>(see "Open Question" below)
    Stl->>Stl: Settlement.Create(req, eligibleFrom)<br/>internal/settlement/core.go:285
    Stl->>Stl: merchantConfig.GetSettlementEnabledByParams<br/>core.go:339
    Stl->>Stl: processor.Process()<br/>(default / aggregate / txn-level)
    Stl-->>Cap: settlement state updated
```

---

## 1. Entry: api receives the request

### Routes (✅ verified)

`api/app/Http/Route.php`:

| Route | Line | Controller |
|---|---|---|
| `POST payments/create/checkout` | 215 | `PaymentCreateController@postCreatePaymentCheckoutCallback` |
| `POST payments/create/ajax` | 219 | `PaymentCreateController@postAJAX` |

The Razorpay SDK on the merchant's site posts to `/v1/payments/create/ajax` after the customer picks UPI in the checkout modal. The Edge / Kong layer (`edge/kong-plugins/`) routes it to api.

### Controller → Service → Processor

```
PaymentCreateController.postAJAX()                          PaymentCreateController.php:49
  ↓
coreCreatePayment()                                         PaymentCreateController.php:446
  ↓
$this->service(E::PAYMENT)->process($input)                 PaymentCreateController.php:431
  ↓
Service::process($input)                                    Service.php:181
  ↓
$this->getNewProcessor()->process($input)
  ↓
Processor::process()                                        Processor.php:6112
```

There's a UPI-specific helper on the service too:

```php
// Service.php:219 (✅ verified)
public function processUpi(array $input) {
    $input['method'] = 'upi';
    return $this->getNewProcessor()->process($input);
}
```

It just sets the method and delegates — same processor entry point.

### The Rearch decision (api → pg-router or stay in monolith)

This is the most consequential branch in the api code path for UPI:

```php
// Processor.php:6204 (✅ verified)
if ($this->canRouteThroughUpsRearchFlow($input, $isUpiDfb)) {
    // Route to pg-router (the new path)
    $paymentData = $this->processPaymentViaPGRouter($input, $startTime);  // line 6219
    // Handles UPI respawn cases at lines 6224-6230
} else {
    // Legacy path — fully in monolith
    ...
}
```

Eligibility for the Rearch flow (`canRouteThroughUpsRearchFlow`, `Processor.php:3821-3862`, ✅ verified):
- `method == Payment\METHOD::UPI`
- non-recurring
- non-TPV (Third-Party Verification)

If any of these don't hold, the legacy path runs entirely in the api monolith. **Most modern UPI traffic flows through pg-router.**

---

## 2. api → pg-router HTTP call

### The client

`api/app/Services/PGRouter.php` is the SDK class.

```php
// PGRouter.php:123 (✅ verified)
const PGRouterValidateAndCreatePaymentUpi = 'v1/payments/create/upi';

// PGRouter.php:240 (✅ verified)
public function validateAndCreatePaymentUpi(array $input,
                                             bool $throwExceptionOnFailure = false): array
{
    return $this->sendRequest(
        self::PGRouterValidateAndCreatePaymentUpi,
        Requests::POST,
        $input,
        $throwExceptionOnFailure,
        90  // timeout in seconds
    );
}
```

### Request payload shape

Built at `Processor.php:5804-5854` (✅ verified). Top-level fields include:
- `merchant_id`
- `order_id`
- `customer_id`, `global_customer_id`
- `subscription_id` (if recurring path is involved — but this is filtered out earlier)
- `raw_request` (the original incoming HTTP body)
- `content_header` (request headers from edge)

Plus the standard payment fields (`method=upi`, `amount`, `currency`, `vpa` for collect, `app_id` for intent, etc.).

### Why a 90s timeout

UPI collect involves an asynchronous wait on the customer to approve the request in their UPI app. The 90s gives enough headroom for the synchronous part of the flow to set up the collect request with the PSP and return a status to the merchant.

---

## 3. pg-router takes over

### Route registration

✅ Verified at `internal/routing/server.go`:

| Path | Line | Handler |
|---|---|---|
| `/v1/payments/create/upi` | 266 | `routing.PaymentCreateController` |
| `/v1/payments/create/ajax` | 233 | `routing.PaymentCreateController` |
| `/v1/payments/create/checkout` | 234 | `routing.PaymentCreateController` |
| `/v1/payments/create/json` | 262 | `routing.PaymentCreateController` |
| `POST /v1/payments/{paymentId}/callback/{hash}` | 164 | `routing.PaymentCallbackController` |
| `POST /v1/payments/{paymentId}/capture` | 240 | `routing.PaymentCaptureController` |

Note: pg-router has its own `payments/create/ajax` and `payments/create/checkout` route variants. The api-monolith's call hits the `payments/create/upi` endpoint.

### Inside the controller

```go
// internal/payments/routing/controller.go:129 (✅ verified)
// When the route is /v1/payments/create/upi, the controller stamps:
requestMap["method"] = "upi"
```

### Order context

```go
// internal/payments/core/order_accessor.go (✅ verified)
GetOrderIdForPayment(...)                         // line 28 — extracts/looks up order id
GetOrderV1AndOrderMapFromRequest(...)             // line 108 — calls orderService.GetOrderV1
PopulateOrderDataToPaymentRequest(...)            // line 55 — merges order data into request
```

The lookup `order_payments` table (`merchant_id, payment_id, order_id, service`) is held in DynamoDB (verified at `internal/database/migrations/20200814150005_schema_dump.go:82` for the SQL mirror; reads use the dynamo-backed repo).

### Gateway selection (the optimizer)

This is the heart of pg-router for UPI:

```go
// internal/payments/core/optimizer.go (✅ verified)
selectProvider(...)                                // line 216
  ↓
c.OptimizerRouter.SelectProvider(ctx, finalRequest)
  ↓
returns ProviderResponse {gateway, provider_id, ...}
```

UPI-specific preprocessing at `optimizer.go:80`:
- If `provider.ProviderId == "razorpay"` OR the merchant is `IsBankingBypassEligible`, AND the Splitz experiment `allowOptimizerBypassViaUPS` is enabled, the optimizer is bypassed (gateway is hard-decided).
- Otherwise, the standard optimizer runs and picks among UPI gateways: ICICI, Yes Bank, HDFC, Axis, etc. (the actual list configured via the optimizer service, not in pg-router).

Inputs to the decision (✅ verified, `routing/controller.go:114-140`):
- merchant ID
- method = `"upi"`
- payment amount
- order data
- partner merchant ID (if applicable)

The result is stashed in the request context for the downstream CPS service:
```go
// optimizer.go:247-250 (✅ verified)
requestMap[constants.OptimizerProviderData] = provider
```

### Outbox write

```go
// internal/pgsdk/outbox/outbox.go:23 (✅ verified)
outboxer.New(...)  // initialized at boot with:
//   pending batch size: 5
//   processor pool: 2
//   max attempts: 3
// (config/func-live.toml:305-310)
```

pg-router writes an outbox row in the same DB transaction as the payment row. The outbox row carries the event payload that will eventually be CDCed to Kafka via the `outbox_jobs` table.

### pg-router DB tables (relevant subset)

✅ Verified at `internal/database/migrations/20200814150005_schema_dump.go`:

| Table | Line | Purpose |
|---|---|---|
| `outbox_jobs` | 149 | `id, payload_name, status, payload_serialized, num_attempts, next_attempt_at, created_at` |
| `order_payments` | 82 | `payment_id (PK), order_id, service, merchant_key, created_at` |
| `orders` | (in same migration) | order state replica |

> Note: pg-router does NOT own the canonical `payments` table for UPI. That stays in the api monolith. pg-router has a payments-namespace store for routing decisions and outbox events.

---

## 4. The actual gateway call

The UPI request is constructed and signed back in the api monolith (the gateway clients live in `api/app/Gateway/Upi/<psp>/`).

✅ Verified directories (under `api/app/Gateway/Upi/`):

```
Axis, Icici, Juspay, Mindgate, Mozart, Rbl, Sbi, Yesbank,
Npci, Cashfree, Payu, Pinelabs
```

Each PSP folder implements:
- Request signing (NPCI public-key format)
- VPA / collect / intent payload construction
- Response parsing
- Reconciliation hooks

### UPI common entity

```php
// app/Gateway/Upi/Base/Entity.php:14-82 (✅ verified)
// Shared fields across UPI PSPs:
VPA, TYPE, AMOUNT, ACQUIRER, GATEWAY_PAYMENT_ID,
NPCI_REFERENCE_ID, NPCI_TXN_ID

// Action enum includes:
AUTHORIZE, AUTHENTICATE
```

### Two flavors of UPI

- **UPI Collect:** customer enters VPA at checkout; PSP sends a collect request to the customer's UPI app; user approves in-app; callback comes back. Slow happy path (10–30s).
- **UPI Intent:** customer is on mobile; deep-links to UPI app; same approval; callback. Faster.

Both terminate in the same callback flow.

---

## 5. Callback → capture

### Callback routes (✅ verified)

`api/app/Http/Route.php`:

| Route | Line | Handler |
|---|---|---|
| `gateway/upi_airtel/callback` | 1370 | `GatewayController@callbackUpiAirtel` |
| `live/upi/callback/{acquirer}/{gateway}` | 926 | `UpiTransferController@processUpiTransferPayment` |
| Generic gateway callback | 996-1003 | `GatewayController` (UPI_RBL, UPI_AIRTEL, UPI_AXISOLIVE, UPI_ICICI, etc.) |

### Server callback handler

```php
// app/Http/Controllers/GatewayController.php:117 (✅ verified)
public function processServerCallback($input, $gatewayDriver) {
    // Extract paymentId from callback (line 147)
    // Fetch from DB:
    $payment = $paymentRepo->fetchPaymentLiveOrTestModeWithGateway(
                  $paymentId, $gatewayDriver);   // line 152
    // ...
}
```

For UPI ICICI specifically there's a different routing path at lines 1015-1020. UPI Juspay at line 1022. The variants exist because PSPs have slightly different callback authentication patterns.

### Capture itself

```php
// app/Models/Payment/Processor/Capture.php:75 (✅ verified)
public function coreCapture(Payment\Entity $payment, array $input = []) { ... }

// At Capture.php:1842-1850 (✅ verified)
$payment->setStatus(Payment\Status::CAPTURED);   // line 1844
$payment->setCaptureTimestamp();                  // line 1846
$payment->setRefundAt(null);                      // line 1848
$payment->setAutoCaptured($autoCaptured);         // line 1850

// Then create transaction at Capture.php:1862
$txn = $this->createTransactionFromCapturedPayment($payment, $txnId);
$this->repo->saveOrFail($txn);                    // line 1921
```

### Events fired

```php
// Capture.php:1838 (✅ verified)
$this->app['events']->dispatch('api.payment.captured', $eventPayload);

// Capture.php:1735 (✅ verified)
$this->app['events']->dispatch('api.order.paid', $eventPayload);
```

These are Laravel events (in-process). Listeners for them publish to Kafka — see next section.

### Ledger journal dispatch

```php
// Capture.php:516 (✅ verified)
LedgerEntryJob::dispatchNow($this->mode, $transactionMessage);

// Constants.php:244 (✅ verified)
const CREATE_LEDGER_JOURNAL_EVENT = 'create-ledger-journal-event';
```

The `LedgerEntryJob` produces a Kafka message on topic `create-ledger-journal-event`. The ledger service consumes this.

### Settlement bucketing

```php
// Capture.php:1551 (✅ verified)
(new Transaction\Core)->dispatchForSettlementBucketing($txn);
```

This dispatches the captured transaction for settlement processing. ❗ The exact downstream mechanism (Kafka topic vs HTTP) is not 100% pinned down — the agent scan didn't find a clear consumer in `settlements/internal/job/` for `stage_live_payment_events`. The earlier Phase 1 scan claimed settlements consumes that topic, but the deep scan couldn't confirm. **This is a key open question** — listed in the verification backlog below.

---

## 6. Ledger creates the journal

### Twirp handler

```go
// internal/journal/server.go:38-120 (✅ verified)
func (s *Server) Create(ctx, req) (resp, error) {
    // Mutex on (transactor_event, transactor_id)         line 53
    defer mutex.Release()                                  // line 60

    // Validate                                            line 70
    if err := ValidateCreateRequest(req); err != nil { ... }

    // Core call                                           line 92
    return s.core.Create(ctx, req)
}
```

### Idempotency by transactor

The mutex key is `(TransactorID, TransactorEvent)`. For a UPI capture, this is the unique pair of:
- `TransactorID` — the api transaction id (`txn_*`)
- `TransactorEvent` — typically a string like `payment_capture`

This pair is what guarantees a journal isn't created twice for the same captured payment.

### Core.Create

```go
// internal/journal/core.go:205-349 (✅ verified)
func (c *Core) Create(ctx, req *common.JournalCreateRequest) (...) {
    // Build entries
    ledger, err := c.LedgerBuilderCore.BuildLedger(...)         // line 224

    // Single transaction:
    db.Transaction(func(tx) error {
        // 1. Save journal row to journals table              line 242
        // 2. Save ledger_entries (one row per leg)
        // 3. Write to outbox_jobs                            line 278-318
        return nil
    })  // rolls back all on any error                       line 322-333

    // 4. Publish journal-created SNS event                   line 344
}
```

### Request struct

```go
// internal/common/struct.go:138-155 (✅ verified)
type JournalCreateRequest struct {
    MerchantId       string
    TransactorID     string   // = api txn id
    TransactorEvent  string   // = "payment_capture", "refund", etc.
    Currency         string
    Amount           int64    // paise
    BaseAmount       int64
    Tenant           string
    // ... + entries (each is a debit/credit on a specific account)
}
```

### Tables

✅ Verified at `internal/journal/model.go:20-286`:

`journals` table (singular `journal` model, plural table):
- `id, merchant_id, amount, base_amount, currency, tenant`
- `transactor_id, transactor_event` — the idempotency key
- `transaction_date, created_at, updated_at`
- `created_at_microsecond, updated_at_microsecond` — μs precision

Plus has-many `ledger_entries` (one row per leg of the journal).

### Outbox to Kafka / SNS

```go
// internal/journal/core.go:278-318 (✅ verified)
if c.CheckIfOutboxPushEnabled(ctx) {
    payload := journalToProtoResponse(...)                 // line 281
    c.OutboxCore.SendToOutbox(broker, topic, payload)      // line 310
}

// pkg/outbox/core.go:57-79 (✅ verified) — broker dispatch
switch broker {
case "kafka": pushToKafkaOutbox(...)
case "sns":   pushToSNSOutbox(...)
}
```

Topic configuration (✅ verified at `config/default.toml:415, 424, 438-443`):
- SNS: `arn:aws:sns:us-east-1:000000000000:journal-created`
- Kafka: `env|LEDGER_QUEUEKAFKA_KAFKA_TOPIC` (env-driven, not hardcoded)

### `MakeshiftTxn` migration pattern

```go
// internal/journal/core.go:290 (✅ verified)
// Comment: "required in the makeshift worker"
```

The `queueMakeshiftTxn` topic is for backfill / migration scenarios where a journal entry is created out-of-band from the normal capture flow. Notes are added to the outbox response so the makeshift worker can correlate. This is a vestige of an earlier migration; not part of the standard UPI capture path. ❗ Worth a separate note when investigating reconciliation issues.

---

## 7. Settlements decides eligibility

### Settlement creation entry

```go
// internal/settlement/core.go:285-384 (✅ verified)
func (c *Core) Create(ctx, req, eligibleFrom int64) (Settlement, error) {
    // Acquire mutex on resource                           lines 316-322

    // Fetch merchant config                              line 325
    merchantConfig := merchantConfigCore.Get(ctx, merchantId, settlementTag)

    // Eligibility check                                   line 339
    reason, ok := merchantConfig.GetSettlementEnabledByParams(ctx, balanceType)
    if !ok {
        return ErrIneligible(reason)
    }

    // Process via factory                                lines 360-362
    return processorFactory.GetProcessor().Process(req, eligibleFrom, orgId)
}
```

### Schedule lookup

✅ Verified at `internal/merchant_config/config.go:135-150`:

UPI is treated as a **domestic** settlement schedule:
```go
// line 138
Domestic + Delimiter + UPI    // → "domestic_upi"
```

Schedule types (✅ verified at lines 29-31):
```
domestic
international
pre_fund_withdrawal
```

Each schedule defines T+0 / T+1 / etc. timing rules. The actual computation of `eligibleFrom` (the T-X timestamp) happens upstream of `Settlement.Create` — ❗ I haven't pinpointed where, but it's most likely in the `merchantConfig` schedule resolver based on payment timestamp + merchant rule.

### Processor variants

✅ Verified at `internal/settlement/factory.go:28`:

```
defaultSettlement
aggregateSettlement
transactionLevelSettlement
orgDefaultSettlement
```

The factory picks one based on the merchant's settlement type (aggregate batches all eligible txns into a single settlement; transactionLevel creates one per txn).

### Transaction fetching

```go
// internal/settlement/default_settlement.go:144-150 (✅ verified)
txns := transactionCore.GetSettlementTransactionDetailsBySource(
    ctx, req, merchantConfig, eligibleFrom, false)
```

Returns the list of transactions inside the eligibility window for this merchant.

### What's in the settlement row

❗ Schema not deeply pulled here — see the settlements repo migrations. From earlier scans: settlements writes to PostgreSQL (primary + replicas), and produces Kafka events on topics like `settlements-refund-transaction-create`, `stage_live_transaction_record_events`, `stage_live_import_transaction_update`.

---

## 8. Open Questions / Verification Backlog

These came up during this trace; **resolve before relying on these claims for incident triage**.

| # | Question | Where I'd look |
|---|---|---|
| 1 | How exactly does settlements get notified of a captured payment? Phase 1 scan said it consumes `stage_live_payment_events`, but the deeper scan of `internal/job/` couldn't find a consumer. | `settlements/cmd/ledger_processor/main.go`, `cmd/workers/main.go`, `cmd/ledger_processor_dlq/`. Possibly via the ledger outbox CDC, not direct payment events. |
| 2 | Where is `eligibleFrom` (the T-X timestamp) computed? | `settlements/internal/merchant_config/` and the scheduler that calls `Settlement.Create`. |
| 3 | What's the prod Kafka topic for ledger outbox? Stage uses `internal_db_stage_ledger_payments_test_outbox.public.outbox_jobs_*`. | `ledger/config/prod-live.toml` (or env var) |
| 4 | What's the prod payment-events topic for pg-router outbox? Stage = `stage_live_payment_events`, prod = `prod_live_payment_events`. | `pg-router/config/prod-live.toml` |
| 5 | How is the api → pg-router → api callback routed back? After pg-router commits the order/payment, the gateway callback comes back to api directly (since `gateway/upi_<psp>/callback` is on api's domain), not via pg-router. ✅ verified by route file in api. |
| 6 | Are events `api.payment.captured` and `api.order.paid` Kafka-published, or just in-process? | Search Laravel listeners; likely a `KafkaProducer` listener subscribes |

---

## 9. Variations Across Payment Methods

Not detailed flow traces — just the headline differences. Code-grounded only where I have direct evidence.

### Cards

- **3DS authentication step.** UPI has no 3DS — the PSP/NPCI auth is in-app. Cards either route through 3DS-1 (challenge form) or 3DS-2 (frictionless), handled by `api/app/Gateway/<gateway>/` plus the `payments-card` Go service for tokenization and the actual auth call.
- **Two-step auth + capture.** Cards typically have an auth step (creates `authorized` payment) followed by a capture step (captures the held authorization). UPI is single-step (collect or intent → capture in one go from the merchant's view).
- **Tokenization.** PCI-scope tokenization is handled by `payments-card` (`internal/bin_sdk_client/`, `internal/affordability/`). UPI uses VPAs which aren't PCI-scoped.
- **Mandate / recurring.** Cards support recurring via stored card; UPI mandates flow through a separate path (`payments-card/internal/mandate/` for cards; UPI mandate is in a different module — ❗ not deeply traced).

### Netbanking

- **Redirect flow, not callback.** Netbanking redirects the customer to the bank's portal; the bank redirects back via 302 with status. Handled at `api/app/Http/Controllers/PaymentController.php` redirect routes.
- **No async wait.** Once the customer completes auth on the bank's site, the response is immediate. There's no equivalent to UPI collect's "wait for VPA approval" period.
- **Lower S2S confidence.** Netbanking PSPs frequently send the completion only via the redirect; an async S2S confirmation may or may not arrive. Reconciliation is more important here than for UPI/cards.

### Wallets

- **Async confirmation common.** Wallet payments often have a delay between debit-from-wallet and confirmation-to-Razorpay. The capture flow may run via an async job.
- **Some wallets are pseudo-cards.** Closed-loop wallets (PhonePe wallet inside the same payment) look more like UPI; open-loop (Mobikwik standalone) look more like netbanking.
- **Razorpay Wallet vs partner wallets.** `wallet` repo handles Razorpay-issued wallet; partner wallet integrations live in `api/app/Gateway/Wallet/`.

> All three of these (cards, netbanking, wallets) **share the same `Capture.coreCapture` codepath** in api once the payment is authorized — see `Capture.php:75`. The differences are in how authentication / authorization happens, not in how capture writes to ledger or triggers settlement.

---

## 10. Failure Modes & Recovery

### Payment retries (customer-side)

| Failure | Behavior | Recovery |
|---|---|---|
| UPI collect approval timeout | NPCI returns timeout after the customer doesn't approve in time. api receives a callback with failure status. Payment row stays `failed` / `created`. | Customer can retry; new payment id |
| Customer's UPI app rejects | Same as above — explicit failure callback | Customer retries with different VPA / app |
| PSP returns 5xx | api handler fails the request; payment in `failed` state | UI prompts retry; merchant-side retry creates a new payment |

### Idempotency

✅ Verified at `api/app/Models/Payment/Core.php:605-658`:

```php
$cacheKey = sprintf('idempotency:%s:%s:%s', $action, $paymentId, $idempotencyKey);  // line 606
$cachedData = $this->app['cache']->get($cacheKey);                                   // line 618

// On cache hit (duplicate request):
if ($cachedData !== null) {
    return existing payment;                                                          // line 630
}

// On cache miss:
acquire mutex lock                                                                    // line 644
execute action
store result in cache                                                                 // line 658
```

The idempotency key is required at validation: `'idempotency_key' => 'required|string'` (`Validator.php:633`).

### Timeouts

| Timeout | Set at | Default |
|---|---|---|
| api → pg-router HTTP | `app/Services/PGRouter.php:240` | 90 seconds |
| pg-router payment timeout | `internal/payments/core/timeout.go:71` | **720 minutes (12 hours)** for UPI |
| Outbox retry max attempts | `pg-router/config/func-live.toml:310` | 3 |
| Queue retry exponent | `pg-router/config/default-live.toml:699-702` | 2x exponential, 2s initial, 30s max |

The 12-hour timeout on UPI is generous because UPI collect can legitimately take a while (customer goes back to their phone after lunch and approves).

### Duplicate prevention

| Layer | Mechanism |
|---|---|
| api request handler | Idempotency key + cache lookup |
| Capture | DB row is updated, not inserted; status transition `authorized → captured` is one-shot |
| Ledger journal | Mutex on `(transactor_id, transactor_event)` (`server.go:53`) |
| Settlement creation | Mutex on resource (`core.go:316-322`) |

So UPI is doubly-protected: the api idempotency key catches double-submits at the front door; the ledger transactor mutex catches double-journal attempts at the back door.

### Reconciliation triggers

| Trigger | Where |
|---|---|
| api callback never arrives | Cron-driven recon job in `api/app/Console/` (❗ not deeply traced; visible existence) |
| ledger journal never created (capture happened, but `LedgerEntryJob` failed) | The `MakeshiftTxn` worker pattern handles backfill (`ledger/internal/journal/core.go:290` notes) |
| Settlement never created for a captured payment | `settlements/internal/settlement/core.go:65-68` allows retry with `MaxFailedRetryAttempts: 1`; periodic settlement cron (`cmd/soh_cron/main.go`) likely re-evaluates eligibility |
| api → pg-router request lost mid-flight | api retries on next merchant attempt; pg-router idempotency in optimizer (provider selection cached) prevents duplicate routing |

### What can stall a UPI payment indefinitely

In order of decreasing likelihood:

1. **NPCI / PSP outage during collect window.** Customer never gets the prompt; the payment ages out at 12 hours per the pg-router timeout. UI typically prompts retry within seconds, so user-facing impact is minimal.
2. **Callback to api fails (network / DNS).** Rare — these are retried by the PSP for ~30 minutes. After that, recon jobs catch up.
3. **`LedgerEntryJob` succeeds in api dispatch but ledger consumer fails.** Capture has happened (api DB shows `captured`) but no journal exists. The makeshift worker backfills.
4. **Settlement bucketing event lost.** Money is captured and journal'd, but the settlement cron never picks it up. Fixed by the periodic settlement re-evaluation; ❗ I haven't fully traced the cron in this scan.

---

## 11. Confidence

- ✅ Verified: api routes + controller dispatch + Rearch decision branching, PGRouter SDK, pg-router routes + optimizer call site + outbox init, gateway folder list, callback routes + capture lines + event dispatch + ledger job dispatch, ledger Twirp handler + Core.Create + idempotency mutex + outbox lines, settlement Core.Create + schedule type for UPI + processor factory, idempotency in api, all timeouts.
- ⚠️ Inferred: precise prod Kafka topic names (most cited values are from stage TOMLs); whether `api.payment.captured` is published to external Kafka (vs in-process only).
- ❗ Needs verification: how settlements actually receives payment events (the agent couldn't find the consumer at the path searched, contradicting the Phase 1 scan); where `eligibleFrom` is computed; the periodic recon cron schedule and behavior; precise behavior of MakeshiftTxn pattern.
