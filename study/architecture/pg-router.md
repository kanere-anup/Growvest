# pg-router

> Method-agnostic payment routing layer. Sits between the api monolith and the actual gateway integrations. Picks WHICH gateway processes a given payment, using the Optimizer.

Repo: `~/Desktop/git/pg-router`. Go 1.24.7. Detailed UPI flow lives in `payments/payment_flow_upi.md` — this is the broader service overview.

---

## Mental model

```
api (Laravel)  ── HTTP ──>  pg-router  ── HTTP ──>  Optimizer
                              │                       (gateway choice)
                              │
                              ├─> account-service (merchant context)
                              ├─> dcs (config + flags)
                              ├─> mandate svc (recurring)
                              ├─> ledger SDK (journal create dual-write)
                              └─> outbox → Kafka → settlements / webhooks / etc.
```

The api monolith calls pg-router for specific eligible payments (currently: most UPI, increasing share of cards). pg-router does the heavy routing decision + persists to MySQL + emits events. Gateway-specific construction (request signing for ICICI / Yes / etc.) still happens back in the api monolith.

---

## Binaries

| Binary | File | Purpose |
|---|---|---|
| `cmd/api` | `cmd/api/main.go` | HTTP server (port from config) |
| `cmd/workers/*` | `cmd/workers/<job_name>/main.go` | 18+ Kafka consumers (auto-capture-retry, ledger, notifications, etc.) |
| `cmd/workers/outbox_relay` | `cmd/workers/outbox_relay/main.go:9` | Outbox → Kafka relay loop |
| `cmd/migration` | | Schema migrations |

---

## Internal packages

| Package | Purpose |
|---|---|
| `internal/api/` | HTTP handler + service binding |
| `internal/routing/` | HTTP route registration (`server.go:230-327`) |
| `internal/payments/` | Payment create / capture / verify / fetch / cancel / callbacks |
| `internal/orders/` | Order CRUD, payment list per order |
| `internal/optimizer/` | Calls the Optimizer service for gateway selection |
| `internal/mandate/` | Recurring payment setup (`internal/mandate/interface.go:12-16`) |
| `internal/kafka_processors/` | 18+ async event handler types |
| `internal/ledger/` | Ledger journal create dual-write |
| `internal/cache/` | Merchant + exchange-rate cache |
| `internal/dcs/`, `pkg/dcs/` | DCS client |
| `internal/cps/` | Card Processor Service integration |
| `internal/cross_border_export/` | Cross-border risk provider tokens + DCC info caching (`service.go:13-70`) |
| `internal/cross_border_import/` | Inbound cross-border events |
| `internal/event_producer_sdk/` | Outbox publishing abstraction |

---

## Routes catalog (✅ verified at `internal/routing/server.go`)

### Public (no auth) — callbacks + webhooks

| Path | Method | Line |
|---|---|---|
| `/v1/payments/{paymentId}/callback/{hash}` | GET, POST | 163-166 |
| `/v1/payments/callback/fpx/acmessage` | POST | 167 |
| `/v1/payments/{paymentId}/static_callback` | POST | 168 |
| `/v1/callback/{gateway}` | GET, POST | 204-205 |

### Auth-protected — payment lifecycle

| Path | Method | Line |
|---|---|---|
| `/v1/payments/create/{ajax\|checkout\|json\|redirect\|upi\|recurring}` | POST | 233-267 |
| `/v1/payments/{paymentId}/capture` | POST | 240 |
| `/v1/payments/{paymentId}/verify` | GET | 241 |
| `/v1/payments/{paymentId}` | GET | 242-243 |
| `/v1/payments/{paymentId}/cancel` | GET | 248 |
| `/v1/payments/{paymentId}` | POST | 249 |
| `/v1/payments/card-present/{create\|status\|confirm}` | POST | 270-272 |

### OTP

| Path | Method | Line |
|---|---|---|
| `/v1/payments/{paymentId}/otp_submit/{hash}` | POST | 196 |
| `/v1/payments/{paymentId}/otp_resend` | POST | 197 |

### Orders

| Path | Method | Line |
|---|---|---|
| `/v1/orders` | POST | 287-288 |
| `/v1/orders/{orderId}` | GET | 285-286 |
| `/v1/orders/{orderId}/payments` | GET | 297-298 |
| `/v1/orders/{orderId}` | PATCH | 291 |

### Wallet

| Path | Method | Line |
|---|---|---|
| `/v1/payments/razorpaywallet` | POST | 230 |

### Internal ledger SDK

| Path | Method | Line |
|---|---|---|
| `/v1/ledger-configs/bulk/create` | POST | 224 |
| `/v1/journals/bulk/create` | POST | 225 |
| `/v1/ledger/accounts` | POST | 226-227 |

---

## Optimizer call

```go
// internal/payments/core/optimizer.go:216 (✅ verified)
selectProvider(...) → c.OptimizerRouter.SelectProvider(ctx, finalRequest)
```

UPI-specific bypass (`optimizer.go:80`):
```go
if (provider.ProviderId == "razorpay" || IsBankingBypassEligible)
   && allowOptimizerBypassViaUPS() {
    // skip optimizer; use hard-coded provider
}
```

Result is stashed in the request context for downstream CPS service:
```go
// optimizer.go:247-250
requestMap[constants.OptimizerProviderData] = provider
```

---

## Outbox + Kafka

### Outbox

```go
// cmd/workers/outbox_relay/main.go:56 (✅ verified)
outbox.StartPublish(ctx)
```

Relay process tails the `outbox_jobs` table (`internal/database/migrations/20200814150005_schema_dump.go:149` — schema: `id, payload_name, status, payload_serialized, num_attempts, next_attempt_at, created_at`) and ships rows to Kafka via the SDK.

Outbox config (✅ verified at `config/func-live.toml:305-310`):
- batch size: 5
- worker pool: 2
- max attempts: 3

### Kafka consumers (18+)

Configured at `internal/config/config.go:81-92` (✅ verified):

```
EventQueue
ReminderEventQueue
AutoCaptureRetryQueue
PaymentNotificationEventQueue
PaymentNotificationMailEventQueue
LinkedPaymentsEventQueue
OrderPaidMultiPaymentsWebhookEventQueue
DeviceNotificationEventQueue
OrderCheckoutOpenedClosedEventQueue
```

Topic names are env-driven (e.g., `prod_live_payment_events`, `stage_test_payment_events`, `mysql_cdc_events_prod_pg_router_outbox_jobs`); verbatim values come from `config/prod-live.toml` and `default-live.toml`.

### Kafka topics (verbatim, from config)

**Production:**
- `mysql_cdc_events_prod_pg_router_outbox_jobs` — own outbox CDC
- `prod_live_payment_events` — payment event sink
- `prod_live_payment_events_order_paid_webhook_dlq` — DLQ
- `prod_live_payment_events_payment_webhook_dlq` — DLQ

**Stage:**
- `mysql_cdc_events_stage_pg_router_event_outbox`
- `stage_test_payment_events`

---

## Stores

| Store | Role |
|---|---|
| MySQL (writer + reader) | Primary persistence — orders, payments (routing decisions), outbox |
| Redis (cluster mode) | Cache; cluster host `cluster.cache.np.razorpay.vpc` (`config/default-live.toml:541-548`); standalone for general cache, cluster for OffersEngineSDK |
| DynamoDB | TTL'd routing state, default TTL 2592000s (`config/default-live.toml:12`) |
| Elasticsearch | Optional |

---

## Sync downstreams

✅ Verified from `go.mod` + internal usage:

- Optimizer (gateway choice service)
- CPS (card processor service)
- account-service v2 (`go.mod`)
- DCS, WDA, route, mandate, merchant-service, ledger
- charge-collections-sdk, error-mapping-module, cross-border-sdk

---

## Cross-border + mandate (briefly)

**Cross-border:** `internal/cross_border_export/` caches risk provider tokens + DCC info per payment; `cross_border_import/` for inbound. Both are TTL caches feeding the standard payment flow with cross-border enrichment when needed.

**Mandate:** `internal/mandate/interface.go:12-16` defines `IMandateService` with `CreateMandateSetup(ctx, orderEntity, merchantCategory) → mandateRpc.MandateSetupResponse`. Used during recurring/subscription mandate authorization. The actual mandate service is external; pg-router is a client.

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---|---|---|
| Optimizer down | Payment create fails; api caller retries | Optimizer is HA-deployed; bypass flag exists for some flows |
| MySQL writer down | Payment create fails | Writer failover; reader can serve fetches |
| DynamoDB unavailable | TTL cache empty → re-derive on demand | Self-healing |
| Kafka consumer lag (e.g., webhook event queue) | Merchant webhook delayed | Workers scale horizontally per service |
| Outbox publish max attempts (3) exhausted | Row stays in `outbox_jobs` | Manual intervention; no automatic give-up |
| Auto-capture retry job fails | Authorization eventually times out at PSP (12h for UPI per `internal/payments/core/timeout.go:71`) | Customer / merchant retry creates new payment |
| DLQ topics fill (`*_payment_webhook_dlq`) | Webhooks for merchant order-paid events fail to deliver | Manual replay required |

---

## Confidence

- ✅ Verified: route table, outbox setup, optimizer call sites, Kafka consumer enumeration, Redis config, downstream service list, cross-border + mandate interfaces.
- ⚠️ Inferred: exact production topic names (cited values are stage; prod values follow same pattern with `prod_` prefix).
- ❗ Needs verification: how the Optimizer's bypass-eligibility decision is computed (`IsBankingBypassEligible` source).
