# route

> Distinct from pg-router. Handles **payment transfers, splits, settlements, reversals**. Originally forked from `upi-switch`. Stores in TiDB.

Repo: `~/Desktop/git/route`. Go 1.24, gRPC.

---

## What it actually does

Don't let the name confuse you with pg-router. This service handles **post-payment money flow** for Razorpay Route (the product) — the feature where merchants split a payment across multiple linked accounts (think marketplaces).

When a customer pays $100 to a marketplace, Route is the service that lets the marketplace platform say "split $80 to seller A, $15 to seller B, $5 to platform fee" — and tracks the resulting transfers, holds, and settlements through their lifecycle.

---

## Binaries (✅ verified)

| Binary | Purpose |
|---|---|
| `cmd/route/main.go` | gRPC server (payment / transfer / reversal / settlement services) |
| `cmd/route_worker/main.go` | Kafka consumer for settlement reconciliation |
| `cmd/route_cron/` | Scheduled job executor |
| `cmd/route-migration/` | TiDB migrations |

---

## Internal packages (✅ verified)

| Package | Purpose |
|---|---|
| `internal/api/` | API client (`/v1/payments/{id}/transfers`, `/v1/transfers/transaction/create`) |
| `internal/payment/` | Payment entity CRUD, builder |
| `internal/transfer/` | Transfer entity creation, ledger integration, settlement tracking |
| `internal/reversal/` | Reversal / refund processing |
| `internal/settlements/` | Settlement hold/release, CDC-driven reconciliation |
| `internal/split/` | Payment split logic |
| `internal/source_payment/` | Source payment tracking (the parent transaction) |
| `internal/idempotency/` | Idempotency-key-based deduplication |
| `internal/tidb/` | TiDB DB layer |
| `internal/on_hold/` | Transfer settlement-hold state |
| `internal/optimizer/` | Routing optimization |
| `internal/provider/scrooge/` | Scrooge service client (settlement provider) |
| `internal/wda/` | WDA integration |
| `internal/event_streaming/` | Kafka producer |
| `internal/terminal/` | Terminal / POS integration |

---

## gRPC services (✅ verified at `proto/route/v1/`)

| Service | Sample methods |
|---|---|
| `route.v1.transfer.TransferService` | `CreateDirectTransfer`, `GetTransfer`, `CreatePaymentTransfer`, `CreateOrderTransfer`, `RetryDirectTransfer` (`transfer.proto:1-200`) |
| `route.v1.payment.PaymentService` | (`payment.proto`) |
| `route.v1.reversal.ReversalService` | (`reversal.proto`) |
| `route.v1.split.SplitService` | (`split.proto`) |
| `route.v1.features.FeaturesService` | (`features.proto`) |
| `route.v1.healthcheck.HealthService` | (`healthcheck.proto`) |
| `settlements.SettlementService` | `Hold`, `Release` (`rpc/settlements/settlement.proto:28-30`) |

HTTP via grpc-gateway. Plus a small util route: `GET /commit.txt` (`internal/commit/handler.go:23`).

---

## Routing logic — what makes route "the routing service"

The name is a bit of a misnomer. Route's "routing" is **transfer routing**: for a given source payment, which linked accounts get how much?

```go
// internal/payment/service/service.go:38-100 (✅ verified)
// Creates payment entities, stores in TiDB
// Manages payment state via Gateway, AuthenticationGateway fields
// internal/payment/migrations/20240909160910_create_payments.go:103-109
// Gateway field tracks processor selection outcome
```

Optimizer integration is via `internal/optimizer/` (calls pg-router-like logic for processor selection on transfer payouts). ⚠️ The exact decision algorithm wasn't fully traced.

---

## Transfers

```go
// proto/route/v1/transfer/transfer.proto:27-99 (✅ verified)
// Transfer entity:
//   source, recipient, amount, status, settlement_status

// Methods on TransferService:
CreateDirectTransfer       // standalone transfer
GetTransfer                // read
CreatePaymentTransfer      // transfer derived from a captured payment
CreateOrderTransfer        // transfer derived from order
RetryDirectTransfer        // retry path
```

---

## TiDB usage

Why TiDB: MySQL-compatible, distributed, scales horizontally — chosen because Route's transfer volume is high and unpredictable (marketplace payouts can spike).

Tables (✅ verified migrations):

| Table | Migration |
|---|---|
| `api_transfers` | `internal/tidb/migrations/20240920120000_create_transfer_table.go:17-47` |
| `api_reversals` | `internal/tidb/migrations/20240920120001_create_reversal_table.go:17` |
| `api_payments` | `internal/payment/migrations/20240909160910_create_payments.go:17-200` |
| `idempotency_keys` | `internal/idempotency/migrations/20250117120000_create_idempotency_table.go` |

Migrations use Goose (`func init() { goose.AddMigrationContext(...) }`).

---

## Idempotency

```go
// internal/idempotency/service/service.go:30-58 (✅ verified)
CreateIdempotencyRequest → CreateIdempotencyRecord(ctx, key, merchant_id)
GetIdempotencyRequest    → GetIdempotencyRecord(...)
```

Backed by `idempotency_keys` table in TiDB. Stores response cache so duplicate requests get the same response without re-executing the transfer.

---

## Kafka

**Consumed:**
- Settlement reconciliation events from Maxwell CDC of `api_transfers`, `api_reversals` (✅ verified at `internal/settlements/service/utils.go:80-106`).

**Produced:**
- Settlement events via `kafka.EventProducer` (✅ verified at `internal/settlements/service/option.go:53-56`).
- Transfer events: import path `eventv1 "github.com/razorpay/rpc/platform/route/event/v1"` (✅ verified at `internal/transfer/server.go:7`).

⚠️ Specific topic names are env-driven; verify in `config/` before relying on them.

---

## Sync downstreams

- account-service (`go.mod:8`)
- DCS (`go.mod:9`)
- Spine (`go.mod:13`)
- Splitz (`go.mod:14`)
- Passport v4 (`go.mod:10`)
- Scrooge (settlement provider) — `internal/provider/scrooge/`
- WDA — `internal/wda/`

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---|---|---|
| TiDB writer down | Transfer create fails | Failover; idempotency record means no double-create on retry |
| Optimizer / Scrooge down | Transfer can't pick a payout route | Retry via `RetryDirectTransfer` |
| Kafka consumer lag (settlement recon) | Settlement state lags behind actual money movement | Catches up when consumer recovers |
| Transfer in `on_hold` state | Frozen until released | `settlements.Release` Twirp call OR cron-driven release after risk clears |
| Source payment refunded after transfers exist | Triggers reversals via `internal/reversal/` | Standard reversal flow runs |

---

## Confidence

- ✅ Verified: binaries, package list, gRPC service names + sample methods, table migrations, idempotency design.
- ⚠️ Inferred: precise Kafka topic names; exact optimizer selection algorithm.
- ❗ Needs verification: how Route interacts with the `settlements` service for the actual payout (Hold/Release calls flow through `pkg/settlements` or via Kafka events).
